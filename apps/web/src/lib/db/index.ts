import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { env } from "../env";
import * as schema from "./schema";

/**
 * Drizzle + Neon over HTTP. Chosen for Next.js serverless: no TCP pool to
 * warm on cold starts. NOTE: drizzle-orm/neon-http does NOT support
 * interactive transactions (db.transaction throws) — for atomic multi-step
 * logic (e.g. the upload-quota gate) use a single SQL statement or the raw
 * Neon client's non-interactive `transaction([...])`.
 *
 * Singleton via globalThis avoids re-creating the client on every module
 * reload in dev (Next.js HMR) and every cold start.
 */
type WillowDb = NeonHttpDatabase<typeof schema>;
type WillowSql = NeonQueryFunction<false, false>;

const globalForDb = globalThis as unknown as {
  db?: WillowDb;
  sql?: WillowSql;
};

function createDb(): { db: WillowDb; sql: WillowSql } {
  const sql = neon(env.DATABASE_URL);
  return { db: drizzle(sql, { schema }), sql };
}

// Call createDb() once and cache both the drizzle instance and the raw Neon
// SQL client on globalThis (avoids re-creating clients on HMR / cold starts).
const instance = globalForDb.db ? { db: globalForDb.db, sql: globalForDb.sql! } : createDb();

export const db: WillowDb = instance.db;
export const neonSql: WillowSql = instance.sql;

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
  globalForDb.sql = neonSql;
}

export { schema };
