// Shared Neon (Postgres) access for the API routes.
// Files under api/_lib are not exposed as routes by Vercel.
import { neon } from '@neondatabase/serverless';

let _sql = null;
export function db() {
  if (!_sql) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    _sql = neon(url);
  }
  return _sql;
}

// Tables are created lazily, once per warm function instance.
// Every statement is idempotent, so concurrent cold starts are safe.
let _schema = null;
export function ensureSchema() {
  if (!_schema) {
    const sql = db();
    _schema = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS users (
        id          BIGSERIAL PRIMARY KEY,
        username    TEXT NOT NULL,
        pass_hash   TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username))`;
      await sql`CREATE TABLE IF NOT EXISTS sessions (
        token_hash  TEXT PRIMARY KEY,
        user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at  TIMESTAMPTZ NOT NULL
      )`;
      await sql`CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id)`;
      await sql`CREATE TABLE IF NOT EXISTS best_times (
        user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        track_id    TEXT NOT NULL,
        time_s      DOUBLE PRECISION NOT NULL,
        splits      JSONB NOT NULL DEFAULT '[]',
        ghost       JSONB NOT NULL DEFAULT '[]',
        car_id      TEXT,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, track_id)
      )`;
      await sql`CREATE INDEX IF NOT EXISTS best_times_track_idx ON best_times (track_id, time_s)`;
    })().catch((err) => {
      _schema = null; // retry on the next request
      throw err;
    });
  }
  return _schema;
}
