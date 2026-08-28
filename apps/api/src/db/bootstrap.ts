import { migrate as runMigrations } from "drizzle-orm/node-postgres/migrator";
import { resolve, dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { db } from "./index.js";
import { env } from "../env.js";

// Applies any journaled migrations that haven't run yet. Drizzle's migrator
// tracks applied migrations in its own __drizzle_migrations table, so running
// it on every boot is safe and idempotent — later migrations apply exactly
// once even when the schema already exists.
// We search a few plausible locations for the bundled ./drizzle folder
// because Neon Functions extracts the deployment zip to a runtime-specific path.
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
  const dir = findMigrationsDir();

  // One-time reconciliation: databases created before this migrator tracked
  // runs (the old bootstrap skipped migrations entirely, or the schema was
  // created via `drizzle-kit push`) have the tables but no
  // __drizzle_migrations row, so the migrator would re-run every migration
  // and fail on CREATE TABLE. If the tracking table is missing but the
  // schema already exists, record the journal as already applied.
  await reconcileExistingSchema(dir);

  await runMigrations(db, { migrationsFolder: dir });
}

/**
 * If the app tables already exist but Drizzle's migration tracking does not
 * (e.g. the schema was created via `drizzle-kit push`, or by the old bootstrap
 * that skipped migrations), seed the tracking table with every journal entry
 * so the migrator treats the existing schema as applied.
 *
 * Targets drizzle.__drizzle_migrations — the exact table Drizzle's migrator
 * uses (schema "drizzle" is its default) — with its exact DDL, and is
 * idempotent: IF NOT EXISTS / ON CONFLICT make re-runs no-ops.
 */
async function reconcileExistingSchema(migrationsDir: string) {
  const journalPath = join(migrationsDir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries: { tag: string; when: number }[];
  };

  await db.transaction(async (tx) => {
    await tx.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);
    await tx.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS "drizzle_migrations_hash_unique" ON drizzle.__drizzle_migrations (hash)`,
    );

    // Drizzle decides what to run by comparing each migration's journal
    // `when` (folderMillis) against the *latest* row's created_at — so seed
    // created_at with the journal's `when` values, not now().
    for (const entry of journal.entries) {
      const hash = await hashFile(join(migrationsDir, `${entry.tag}.sql`));
      await tx.execute(
        sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${entry.when}) ON CONFLICT (hash) DO NOTHING`,
      );
    }
  });
}

async function hashFile(path: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export async function closeDb() {
  await db.$client.end();
}
