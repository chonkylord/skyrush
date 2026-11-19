// GET  /api/auth                                  -> { user } (null when signed out)
// GET  /api/auth?ticket                           -> { ticket, server } for the Render multiplayer server
// POST /api/auth { action: 'signup', username, password }
// POST /api/auth { action: 'login',  username, password }
// POST /api/auth { action: 'logout' }
import { sign as cryptoSign } from 'node:crypto';
import { db, ensureSchema } from './_lib/db.js';
import {
  handle, send, readJson, currentUser, createSession, destroySession,
  hashPassword, verifyPassword, dummyVerify,
} from './_lib/auth.js';

const USERNAME_RE = /^[A-Za-z0-9_-]{3,20}$/;
// Render's URL for the service in render.yaml; override with the MP_SERVER_URL env var.
const DEFAULT_MP_SERVER = 'wss://david-hlopetki-mp.onrender.com';

export default handle(async (req, res) => {
  await ensureSchema();

  if (req.method === 'GET') {
    const user = await currentUser(req);
    const wantsTicket = (req.query?.ticket ?? new URL(req.url, 'http://x').searchParams.get('ticket')) != null;
    if (!wantsTicket) return send(res, 200, { user });
    // Short-lived signed pass for the multiplayer server on Render. It checks the
    // signature with the public key in mp-server/, so it never touches the DB.
    if (!user) return send(res, 401, { error: 'Sign in to play multiplayer.' });
    const key = process.env.MP_TICKET_KEY;
    if (!key) return send(res, 503, { error: 'Multiplayer is not set up yet.' });
    const payload = Buffer.from(JSON.stringify({ uid: user.id, name: user.username, exp: Date.now() + 60_000 })).toString('base64url');
    const sig = cryptoSign(null, Buffer.from(payload), key.replace(/\\n/g, '\n')).toString('base64url');
    return send(res, 200, { ticket: `${payload}.${sig}`, server: process.env.MP_SERVER_URL || DEFAULT_MP_SERVER });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const body = readJson(req);
  if (!body) return send(res, 415, { error: 'Expected a JSON body' });

  if (body.action === 'logout') {
    await destroySession(req, res);
    return send(res, 200, { user: null });
  }

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const sql = db();

  if (body.action === 'signup') {
    if (!USERNAME_RE.test(username)) {
      return send(res, 400, { error: 'Username must be 3–20 letters, numbers, _ or -.' });
    }
    if (password.length < 8 || password.length > 200) {
      return send(res, 400, { error: 'Password must be at least 8 characters.' });
    }
    const passHash = await hashPassword(password);
    const rows = await sql`
      INSERT INTO users (username, pass_hash) VALUES (${username}, ${passHash})
      ON CONFLICT DO NOTHING
      RETURNING id, username`;
    if (!rows[0]) return send(res, 409, { error: 'That username is taken.' });
    await createSession(res, req, rows[0].id);
    return send(res, 201, { user: { id: String(rows[0].id), username: rows[0].username } });
  }

  if (body.action === 'login') {
    if (!username || !password || password.length > 200) {
      return send(res, 400, { error: 'Enter your username and password.' });
    }
    const rows = await sql`SELECT id, username, pass_hash FROM users WHERE lower(username) = lower(${username})`;
    const user = rows[0];
    const ok = user ? await verifyPassword(password, user.pass_hash) : await dummyVerify(password);
    if (!ok) return send(res, 401, { error: 'Wrong username or password.' });
    await createSession(res, req, user.id);
    return send(res, 200, { user: { id: String(user.id), username: user.username } });
  }

  return send(res, 400, { error: 'Unknown action' });
});
