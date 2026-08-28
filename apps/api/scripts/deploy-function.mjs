#!/usr/bin/env node
/**
 * Deploys the Willow API to Neon Functions.
 *
 * Builds the esbuild bundle + custom zip (index.mjs + drizzle/ migrations),
 * then POSTs it to the Neon deploy API. The Neon CLI's `--src` only ships the
 * bundled entry, so the drizzle migration folder wouldn't reach the runtime —
 * hence the custom zip.
 *
 * Usage:
 *   node scripts/deploy-function.mjs
 *
 * Requires env: NEON_API_KEY, plus everything in apps/api/.env
 * (loaded via dotenv).
 */
import { execSync } from "node:child_process";
import { readFileSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const apiDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(apiDir, "dist");
const fnZipDir = join(distDir, "fnzip");
const zipPath = join(distDir, "function.zip");
const envFile = join(apiDir, ".env");

const {
  NEON_API_KEY,
  NEON_PROJECT_ID,
  NEON_BRANCH_ID,
  NEON_FUNCTION_SLUG,
  OPENAI_API_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT,
  CRON_SECRET,
  AUTH_SECRET,
  R2_API_TOKEN,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_STORAGE_LIMIT_BYTES = "9900000000",
  MAX_UPLOADS_PER_USER_PER_DAY = "50",
  MAX_AUDIO_UPLOAD_BYTES = "10485760",
  MIGRATIONS_DIR = "./drizzle",
} = process.env;

const required = [
  "NEON_API_KEY",
  "NEON_PROJECT_ID",
  "NEON_BRANCH_ID",
  "NEON_FUNCTION_SLUG",
  "OPENAI_API_KEY",
  "CRON_SECRET",
  "AUTH_SECRET",
  "R2_API_TOKEN",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing env var(s): ${missing.join(", ")} (set them in ${envFile} or the shell)`);
  console.error("Neon ids come from: neon project list / neon branches list / the Functions tab");
  process.exit(1);
}

console.log("→ Building function bundle…");
execSync("npm run build -w @willow/api", { stdio: "inherit", cwd: join(apiDir, "..", "..") });
execSync("npx esbuild src/function.ts --bundle --platform=node --target=node24 --format=esm "
  + "--banner:js=\"import{createRequire as ___cr}from'module';import{fileURLToPath as ___f}from'url';import{dirname as ___d}from'path';const require=___cr(import.meta.url);const __filename=___f(import.meta.url);const __dirname=___d(__filename);\" "
  + "--alias:pg-native=/tmp/pg-native-stub.js "
  + "--outfile=dist/function.mjs",
  { stdio: "inherit", cwd: apiDir });

console.log("→ Packaging zip (index.mjs + drizzle/)…");
rmSync(fnZipDir, { recursive: true, force: true });
mkdirSync(fnZipDir, { recursive: true });
cpSync(join(distDir, "function.mjs"), join(fnZipDir, "index.mjs"));
cpSync(join(apiDir, "drizzle"), join(fnZipDir, "drizzle"), { recursive: true });
execSync("zip -rq ../function.zip index.mjs drizzle", { cwd: fnZipDir });

console.log("→ Deploying to Neon…");
const environment = JSON.stringify({
  OPENAI_API_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT,
  CRON_SECRET,
  AUTH_SECRET,
  R2_API_TOKEN,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_STORAGE_LIMIT_BYTES,
  MAX_UPLOADS_PER_USER_PER_DAY,
  MAX_AUDIO_UPLOAD_BYTES,
  MIGRATIONS_DIR,
});

const form = new FormData();
form.append("zip", new Blob([readFileSync(zipPath)], { type: "application/zip" }), "function.zip");
form.append("environment", environment);

const res = await fetch(
  `https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches/${NEON_BRANCH_ID}/functions/${NEON_FUNCTION_SLUG}/deployments`,
  { method: "POST", headers: { Authorization: `Bearer ${NEON_API_KEY}` }, body: form },
);
const body = await res.json();
if (!res.ok) {
  console.error("Deploy failed:", JSON.stringify(body));
  process.exit(1);
}
console.log(`✓ Deployment ${body.deployment.id} ${body.deployment.status}`);
console.log(`  URL: https://${NEON_BRANCH_ID}-${NEON_FUNCTION_SLUG}.compute.c-5.us-east-2.aws.neon.tech/`);
