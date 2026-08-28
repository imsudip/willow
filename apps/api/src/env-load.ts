/**
 * Loads the single unified environment file for Willow.
 *
 * The repo keeps ONE env file at the workspace root (`.env.local`, template in
 * `.env.example`) that serves every service: the API runtime, the web build
 * (Vite), Neon Functions, Vercel, and GitHub Actions.
 *
 * Lookup order (first match wins):
 *   1. $WILLOW_ENV_FILE — explicit override
 *   2. <workspace root>/.env.local   (monorepo root — the normal case)
 *   3. <workspace root>/.env         (fallback)
 *   4. <this package>/.env.local     (standalone usage of @willow/api)
 *   5. <this package>/.env           (legacy location)
 *
 * Process env vars always take precedence over anything in the file (dotenv
 * never overrides by default), which is what lets CI / Neon Functions inject
 * secrets without editing a file.
 */
import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// src/ → apps/api → repo root
const pkgDir = resolve(here, "..");
const repoRoot = resolve(pkgDir, "..", "..");

const candidates = [
  process.env.WILLOW_ENV_FILE,
  join(repoRoot, ".env.local"),
  join(repoRoot, ".env"),
  join(pkgDir, ".env.local"),
  join(pkgDir, ".env"),
].filter(Boolean) as string[];

const found = candidates.find((p) => existsSync(p));
if (found) {
  loadDotenv({ path: found });
} else {
  console.warn(
    `[env] No environment file found. Tried:\n  ${candidates.join("\n  ")}\n` +
      `Copy .env.example → .env.local and fill in your values.`,
  );
}
