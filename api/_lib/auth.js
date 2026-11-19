// Password hashing, DB-backed sessions and small HTTP helpers.
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';

const scryptAsync = promisify(scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
export const COOKIE = 'dh_session';
const SESSION_DAYS = 30;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  const [alg, N, r, p, saltB64, keyB64] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: +N, r: +r, p: +p });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Used when the username doesn't exist, so response timing doesn't reveal that.
let _dummyHash = null;
export async function dummyVerify(password) {
  _dummyHash ??= await hashPassword('not-a-real-password');
  await verifyPassword(password, _dummyHash);
  return false;
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

export async function createSession(res, req, userId) {
  const sql = db();
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await sql`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (${sha256(token)}, ${userId}, ${expires.toISOString()})`;
  // Opportunistic cleanup of this user's expired sessions.
  await sql`DELETE FROM sessions WHERE user_id = ${userId} AND expires_at < now()`;
  setCookie(res, req, token, SESSION_DAYS * 86400);
}

export async function destroySession(req, res) {
  const token = readCookie(req, COOKIE);
  if (token) await db()`DELETE FROM sessions WHERE token_hash = ${sha256(token)}`;
  setCookie(res, req, '', 0);
}

// Returns { id, username } for a valid session cookie, else null.
export async function currentUser(req) {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const rows = await db()`
    SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${sha256(token)} AND s.expires_at > now()`;
  return rows[0] ? { id: String(rows[0].id), username: rows[0].username } : null;
}

function isLocalHost(req) {
  const host = String(req.headers.host || '');
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
}

function setCookie(res, req, value, maxAge) {
  const parts = [`${COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (!isLocalHost(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

// --- HTTP helpers ---------------------------------------------------------

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// State-changing requests must be JSON. Browsers can't send a cross-site JSON
// POST without a CORS preflight (which we never approve), so together with
// SameSite=Lax cookies this blocks CSRF.
export function readJson(req) {
  const type = String(req.headers['content-type'] || '');
  if (!type.includes('application/json')) return null;
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return null;
}

export function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error(err);
      send(res, 500, { error: 'Server error. Please try again.' });
    }
  };
}
