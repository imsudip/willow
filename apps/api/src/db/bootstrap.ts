import { migrate as runMigrations } from "drizzle-orm/node-postgres/migrator";
import { resolve, dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { db } from "./index.js";
import { env } from "../env.js";

// Creates tables if the DB is fresh, applies new migrations otherwise.
// Safe to run on every server start. We search a few plausible locations
// for the bundled ./drizzle folder because Neon Functions extracts the
// deployment zip to a runtime-specific path.
const bundleDir = dirname(fileURLToPath(import.meta.url));

function findMigrationsDir(): string {
  const candidates = [
    env.MIGRATIONS_DIR,
    "./drizzle",
    join(bundleDir, "drizzle"),
    join(process.cwd(), "drizzle"),
    join(dirname(bundleDir), "drizzle"),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    if (existsSync(join(dir, "meta", "_journal.json"))) return dir;
  }
  // Fall back to the env value or repo layout; the error is informative.
  return env.MIGRATIONS_DIR ?? resolve(bundleDir, "../../drizzle");
}

export async function migrate() {
  // Idempotent: if the schema already exists (e.g. migrations applied
  // manually or by a previous function boot), skip. This avoids re-running
  // CREATE TABLE statements that fail on the Neon Function runtime.
  const exists = await db.execute(
    sql`SELECT to_regclass('public.account') IS NOT NULL AS ok`,
  );
  if (exists.rows[0]?.ok) return;
  await runMigrations(db, { migrationsFolder: findMigrationsDir() });
}

export async function closeDb() {
  await db.$client.end();
}
