import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "../env";
import * as schema from "./schema";

/**
 * Drizzle + Neon over HTTP. Chosen for Next.js serverless: no TCP pool to
 * warm on cold starts, and transactions / advisory locks still work (Neon is
 * real Postgres). Singleton via globalThis avoids re-creating the client on
 * every module reload in dev (Next.js HMR) and every cold start.
 */
const globalForDb = globalThis as unknown as {
  db?: ReturnType<typeof createDb>;
};

function createDb() {
  const sql = neon(env.DATABASE_URL);
  return drizzle(sql, { schema });
}

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") globalForDb.db = db;

export { schema };
