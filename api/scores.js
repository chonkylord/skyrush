// All routes require a signed-in user.
// GET  /api/scores               -> { scores: [{ track, time, updatedAt }] }   (no ghosts: keeps it small)
// GET  /api/scores?track=<id>    -> { score: { track, time, splits, ghost, car, updatedAt } | null }
// POST /api/scores { track, time, splits, ghost, car }
//      -> { saved, best: { track, time, updatedAt } }  (only replaces a slower time)
import { db, ensureSchema } from './_lib/db.js';
import { handle, send, readJson, currentUser } from './_lib/auth.js';

const TRACK_RE = /^[a-z0-9_-]{1,32}$/;
const MAX_TIME = 3600;                 // 1 hour
const MAX_GHOST = 7 * 30 * 60 * 15;    // 7 values @ 30 Hz for 15 minutes
const MAX_SPLITS = 200;

const finite = (n) => typeof n === 'number' && Number.isFinite(n);

export default handle(async (req, res) => {
  await ensureSchema();
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'Sign in to save scores.' });
  const sql = db();

  if (req.method === 'GET') {
    const track = req.query?.track ?? new URL(req.url, 'http://x').searchParams.get('track');
    if (track != null) {
      if (!TRACK_RE.test(track)) return send(res, 400, { error: 'Bad track id' });
      const rows = await sql`
        SELECT track_id, time_s, splits, ghost, car_id, updated_at FROM best_times
        WHERE user_id = ${user.id} AND track_id = ${track}`;
      const r = rows[0];
      return send(res, 200, {
        score: r ? { track: r.track_id, time: r.time_s, splits: r.splits, ghost: r.ghost, car: r.car_id, updatedAt: r.updated_at } : null,
      });
    }
    const rows = await sql`
      SELECT track_id, time_s, updated_at FROM best_times WHERE user_id = ${user.id} ORDER BY track_id`;
    return send(res, 200, { scores: rows.map((r) => ({ track: r.track_id, time: r.time_s, updatedAt: r.updated_at })) });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const body = readJson(req);
  if (!body) return send(res, 415, { error: 'Expected a JSON body' });
  const { track, time } = body;
  const splits = body.splits ?? [];
  const ghost = body.ghost ?? [];
  const car = typeof body.car === 'string' && /^[a-z0-9_-]{1,32}$/.test(body.car) ? body.car : null;

  if (typeof track !== 'string' || !TRACK_RE.test(track)) return send(res, 400, { error: 'Bad track id' });
  if (!finite(time) || time <= 0 || time > MAX_TIME) return send(res, 400, { error: 'Bad time' });
  if (!Array.isArray(splits) || splits.length > MAX_SPLITS || !splits.every((s) => s === null || finite(s))) {
    return send(res, 400, { error: 'Bad splits' });
  }
  if (!Array.isArray(ghost) || ghost.length > MAX_GHOST || ghost.length % 7 !== 0 || !ghost.every(finite)) {
    return send(res, 400, { error: 'Bad ghost' });
  }

  // Upsert, but only overwrite when the new time is strictly faster.
  const rows = await sql`
    INSERT INTO best_times (user_id, track_id, time_s, splits, ghost, car_id, updated_at)
    VALUES (${user.id}, ${track}, ${time}, ${JSON.stringify(splits)}::jsonb, ${JSON.stringify(ghost)}::jsonb, ${car}, now())
    ON CONFLICT (user_id, track_id) DO UPDATE
      SET time_s = EXCLUDED.time_s, splits = EXCLUDED.splits, ghost = EXCLUDED.ghost,
          car_id = EXCLUDED.car_id, updated_at = now()
      WHERE best_times.time_s > EXCLUDED.time_s
    RETURNING track_id, time_s, updated_at`;
  if (rows[0]) {
    return send(res, 200, { saved: true, best: { track: rows[0].track_id, time: rows[0].time_s, updatedAt: rows[0].updated_at } });
  }
  const cur = await sql`SELECT track_id, time_s, updated_at FROM best_times WHERE user_id = ${user.id} AND track_id = ${track}`;
  return send(res, 200, { saved: false, best: { track: cur[0].track_id, time: cur[0].time_s, updatedAt: cur[0].updated_at } });
});
