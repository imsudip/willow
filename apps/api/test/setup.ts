/**
 * Vitest global setup.
 *
 * Ensures the app can boot during tests even on a fresh runner with no
 * .env.local. Priority:
 *   1. Real env (CI secrets / shell) — DATABASE_URL etc. are injected by CI.
 *   2. Root .env.local (local dev).
 *   3. Safe dummy defaults for vars the app requires but the smoke tests
 *      don't actually exercise (e.g. R2 creds are only needed to mint URLs).
 *
 * NOTE: the API smoke tests hit a real Postgres (better-auth "pg" provider).
 * On CI, pass a DATABASE_URL via the GitHub Actions env (the deploy pipeline
 * already has one from Neon). Without it, tests that touch the DB will fail.
 */
import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// 1. Load root .env.local if present (harmless if env already set — dotenv
//    never overrides existing process.env by default).
const rootEnv = resolve(process.cwd(), ".env.local");
if (existsSync(rootEnv)) loadDotenv({ path: rootEnv });

// 2. Fill any still-missing required vars with safe dummy values so the app
//    can import/boot. Real tests needing a DB require DATABASE_URL from env.
const dummyDefaults: Record<string, string> = {
  CRON_SECRET: "test-cron-secret-min-16-chars!!",
  AUTH_SECRET: "test-auth-secret-min-8",
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://localhost:5432/willow_test",
  R2_ACCOUNT_ID: "test-account",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
  R2_API_TOKEN: "test-token",
};

for (const [key, value] of Object.entries(dummyDefaults)) {
  if (process.env[key] === undefined) process.env[key] = value;
}
