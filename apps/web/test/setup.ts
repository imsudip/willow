/**
 * Vitest global setup for the Next.js web app.
 *
 * Loads the repo-root .env.local so server modules (env.ts, db, r2) can
 * import. Route-handler smoke tests that touch the DB require a real
 * DATABASE_URL (from .env.local or CI env), same as the old Hono smoke tests.
 */
import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const rootEnv = resolve(repoRoot, ".env.local");
if (existsSync(rootEnv)) loadDotenv({ path: rootEnv });
