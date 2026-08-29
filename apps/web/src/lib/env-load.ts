/**
 * Loads the single unified Willow environment file for Next.js.
 *
 * The repo keeps ONE env file at the workspace root (`.env.local`, template
 * `.env.example`) serving every service. Next.js only auto-loads `.env*` from
 * the app dir, so this loader is invoked from `next.config.ts` (which runs in
 * the same Node process as `next dev`/`next build`) to populate process.env
 * from the repo root.
 *
 * Lookup order (first match wins):
 *   1. $WILLOW_ENV_FILE — explicit override
 *   2. <repo root>/.env.local   (the normal case)
 *   3. <repo root>/.env
 *   4. <app dir>/.env.local     (fallback)
 *   5. <app dir>/.env
 *
 * Process env vars always take precedence (dotenv never overrides), which is
 * how Vercel / CI inject secrets without editing a file.
 */
import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// src/lib → src → apps/web → repo root
const appDir = resolve(here, "..", "..");
const repoRoot = resolve(appDir, "..", "..");

const candidates = [
  process.env.WILLOW_ENV_FILE,
  join(repoRoot, ".env.local"),
  join(repoRoot, ".env"),
  join(appDir, ".env.local"),
  join(appDir, ".env"),
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
