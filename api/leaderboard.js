// Public leaderboards, built from everyone's best time per track (best_times).
// No sign-in needed to read; if you are signed in, your own row comes back too.
//
// GET /api/leaderboard?track=<id>[&q=<name>][&limit=50]
//     -> { track, total, entries: [{ rank, username, time, car, replay, updatedAt }], me: entry | null }
//        q filters by username (case-insensitive substring) but ranks stay global.
// GET /api/leaderboard?player=<username>
//     -> { player: { username } | null, records: [{ track, rank, total, time, car, replay, updatedAt }] }
// GET /api/leaderboard?players=<name>
//     -> { players: [{ username, tracks }] }   username search across everyone with a time
// GET /api/leaderboard?replay=<username>&track=<id>
//     -> { replay: { username, track, time, splits, ghost, car, updatedAt } | null }
import { db, ensureSchema } from './_lib/db.js';
import { handle, send, currentUser } from './_lib/auth.js';

const TRACK_RE = /^[a-z0-9_-]{1,32}$/;
const NAME_RE = /^[A-Za-z0-9_-]{1,20}$/;
const SEARCH_RE = /^[A-Za-z0-9_-]{0,20}$/;

// The retired Tech Hub car: runs saved with it show as the Nikhil car it was styled after.
const DISGUISE = { hub: 'nikhil' };
const publicCar = (c) => DISGUISE[c] ?? c;

const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);

const entry = (r) => ({
  rank: Number(r.rank),
  username: r.username,
  time: r.time_s,
  car: publicCar(r.car_id),
  replay: !!r.has_replay,
  updatedAt: r.updated_at,
});

export default handle(async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, { error: 'Method not allowed' });
  }
  await ensureSchema();
  const sql = db();
  const params = new URL(req.url, 'http://x').searchParams;

  // ---- one run's replay (the stored ghost) ----
  if (params.has('replay')) {
    const name = params.get('replay') || '';
    const track = params.get('track') || '';
    if (!NAME_RE.test(name)) return send(res, 400, { error: 'Bad username' });
    if (!TRACK_RE.test(track)) return send(res, 400, { error: 'Bad track id' });
    const rows = await sql`
      SELECT u.username, b.track_id, b.time_s, b.splits, b.ghost, b.car_id, b.updated_at
      FROM best_times b JOIN users u ON u.id = b.user_id
      WHERE lower(u.username) = lower(${name}) AND b.track_id = ${track}`;
    const r = rows[0];
    return send(res, 200, {
      replay: r && Array.isArray(r.ghost) && r.ghost.length >= 14
        ? { username: r.username, track: r.track_id, time: r.time_s, splits: r.splits, ghost: r.ghost, car: publicCar(r.car_id), updatedAt: r.updated_at }
        : null,
    });
  }

  // ---- find players by username ----
  if (params.has('players')) {
    const q = (params.get('players') || '').trim();
    if (!SEARCH_RE.test(q) || !q) return send(res, 200, { players: [] });
    const pattern = '%' + likeEscape(q.toLowerCase()) + '%';
    const rows = await sql`
      SELECT u.username, COUNT(b.track_id) AS tracks
      FROM users u JOIN best_times b ON b.user_id = u.id
      WHERE lower(u.username) LIKE ${pattern}
      GROUP BY u.id, u.username
      ORDER BY (lower(u.username) = ${q.toLowerCase()}) DESC, (lower(u.username) LIKE ${likeEscape(q.toLowerCase()) + '%'}) DESC, u.username
      LIMIT 12`;
    return send(res, 200, { players: rows.map((r) => ({ username: r.username, tracks: Number(r.tracks) })) });
  }

  // ---- one player's records on every track ----
  if (params.has('player')) {
    const name = params.get('player') || '';
    if (!NAME_RE.test(name)) return send(res, 400, { error: 'Bad username' });
    const users = await sql`SELECT id, username FROM users WHERE lower(username) = lower(${name})`;
    if (!users[0]) return send(res, 200, { player: null, records: [] });
    const rows = await sql`
      SELECT * FROM (
        SELECT b.user_id, b.track_id, b.time_s, b.car_id, b.updated_at,
               jsonb_array_length(b.ghost) >= 14 AS has_replay,
               RANK() OVER (PARTITION BY b.track_id ORDER BY b.time_s) AS rank,
               COUNT(*) OVER (PARTITION BY b.track_id) AS total
        FROM best_times b
        WHERE b.track_id IN (SELECT track_id FROM best_times WHERE user_id = ${users[0].id})
      ) r
      WHERE r.user_id = ${users[0].id}
      ORDER BY r.track_id`;
    return send(res, 200, {
      player: { username: users[0].username },
      records: rows.map((r) => ({ track: r.track_id, total: Number(r.total), ...entry({ ...r, username: users[0].username }) })),
    });
  }

  // ---- one track's board ----
  const track = params.get('track') || '';
  if (!TRACK_RE.test(track)) return send(res, 400, { error: 'Bad track id' });
  const q = (params.get('q') || '').trim();
  if (!SEARCH_RE.test(q)) return send(res, 400, { error: 'Usernames only use letters, numbers, _ and -.' });
  const limit = Math.max(1, Math.min(100, Number.parseInt(params.get('limit'), 10) || 50));
  const pattern = '%' + likeEscape(q.toLowerCase()) + '%';
  const user = await currentUser(req).catch(() => null);

  const [rows, totals, mine] = await Promise.all([
    sql`
      SELECT * FROM (
        SELECT u.username, b.time_s, b.car_id, b.updated_at,
               jsonb_array_length(b.ghost) >= 14 AS has_replay,
               RANK() OVER (ORDER BY b.time_s) AS rank
        FROM best_times b JOIN users u ON u.id = b.user_id
        WHERE b.track_id = ${track}
      ) r
      WHERE lower(r.username) LIKE ${pattern}
      ORDER BY r.rank, r.updated_at
      LIMIT ${limit}`,
    sql`SELECT COUNT(*) AS n FROM best_times WHERE track_id = ${track}`,
    user
      ? sql`
        SELECT * FROM (
          SELECT b.user_id, u.username, b.time_s, b.car_id, b.updated_at,
                 jsonb_array_length(b.ghost) >= 14 AS has_replay,
                 RANK() OVER (ORDER BY b.time_s) AS rank
          FROM best_times b JOIN users u ON u.id = b.user_id
          WHERE b.track_id = ${track}
        ) r WHERE r.user_id = ${user.id}`
      : Promise.resolve([]),
  ]);

  return send(res, 200, {
    track,
    total: Number(totals[0]?.n || 0),
    entries: rows.map(entry),
    me: mine[0] ? entry(mine[0]) : null,
  });
});
