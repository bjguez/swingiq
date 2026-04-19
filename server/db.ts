import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

// Safe additive migrations — run on every startup, idempotent
export async function runStartupMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS youtube_video_id text`);
    await client.query(`ALTER TABLE blueprint_content ADD COLUMN IF NOT EXISTS youtube_video_id text`);
  } finally {
    client.release();
  }
}