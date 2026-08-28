#!/usr/bin/env node
/**
 * Deploy the Willow API to Neon Functions, CI-first.
 *
 * This is the README's manual zip + API-deploy flow, made scriptable so it
 * runs in a pipeline (GitHub Actions, locally, anywhere). It builds the esbuild
 * bundle, packages it with the drizzle migrations, and POSTs the zip to the
 * Neon deploy API with the runtime environment as JSON.
 *
 * Unlike a local-run deploy script, this one reads all values from the process
 * environment so secrets can live in CI secrets. It is the script the
 * `deploy.yml` workflow calls.
 *
 * Usage:
 *   node scripts/neon-deploy.mjs
 *
 * Requires env (secrets → env, or in the shell):
 *   NEON_API_KEY, NEON_PROJECT_ID, NEON_BRANCH_ID, NEON_FUNCTION_SLUG
 *   OPENAI_API_KEY, CRON_SECRET, AUTH_SECRET,
 *   R2_API_TOKEN, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 *
 * Optional env (defaults below are safe for the free tier):
 *   TRANSCRIPTION_MODEL, CLEANUP_MODEL, REMINDER_CRON, CRON_TIMEZONE,
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUBLIC_ORIGIN,
 *   R2_BUCKET, R2_STORAGE_LIMIT_BYTES, MAX_UPLOADS_PER_USER_PER_DAY,
 *   MAX_AUDIO_UPLOAD_BYTES, MIGRATIONS_DIR
 *
 * Set WILLOW_SKIP_HEALTHCHECK=1 to skip the post-deploy ping (useful during
 * smoke tests where the first boot is expected to be slow).
 */
import { execSync } from "node:child_process";
import { readFileSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(apiDir, "dist");
const fnZipDir = join(distDir, "fnzip");
const zipPath = join(distDir, "function.zip");

const {
    NEON_API_KEY,
    NEON_PROJECT_ID,
    NEON_BRANCH_ID,
    NEON_FUNCTION_SLUG,
    OPENAI_API_KEY,
    TRANSCRIPTION_MODEL,
    CLEANUP_MODEL,
    REMINDER_CRON,
    CRON_TIMEZONE,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
    CRON_SECRET,
    AUTH_SECRET,
    PUBLIC_ORIGIN,
    R2_API_TOKEN,
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
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
    console.error(`Missing env var(s): ${missing.join(", ")}`);
    console.error("Set them as CI secrets (or in the shell for local runs).");
    process.exit(1);
}

console.log("→ Building function bundle…");
// @willow/shared must be built first — the API imports its dist, and a fresh
// checkout (e.g. CI) won't have it yet.
execSync("npm run build -w @willow/shared", { stdio: "inherit", cwd: join(apiDir, "..", "..") });
execSync("npm run build -w @willow/api", { stdio: "inherit", cwd: join(apiDir, "..", "..") });
execSync("npx esbuild src/function.ts --bundle --platform=node --target=node24 --format=esm "
    + "--banner:js=\"import{createRequire as ___cr}from'module';import{fileURLToPath as ___f}from'url';import{dirname as ___d}from'path';const require=___cr(import.meta.url);const __filename=___f(import.meta.url);const __dirname=___d(__filename);\" "
    + "--alias:pg-native=./scripts/pg-native-stub.js "
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
    TRANSCRIPTION_MODEL,
    CLEANUP_MODEL,
    REMINDER_CRON,
    CRON_TIMEZONE,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
    CRON_SECRET,
    AUTH_SECRET,
    PUBLIC_ORIGIN,
    R2_API_TOKEN,
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
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

// Derive the invocation URL from Neon function metadata (the cell is assigned
// by Neon, not hard-coded). If metadata is unavailable, fall back to the known
// US East (Ohio) pattern so the health check still has a target.
async function getInvocationUrl() {
    try {
        const res = await fetch(
            `https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches/${NEON_BRANCH_ID}/functions/${NEON_FUNCTION_SLUG}`,
            { headers: { Authorization: `Bearer ${NEON_API_KEY}` } },
        );
        if (!res.ok) return null;
        const meta = await res.json();
        return meta?.function?.invocation_url || null;
    } catch {
        return null;
    }
}

const baseUrl = (await getInvocationUrl())?.replace(/\/$/, "")
    ?? `https://${NEON_BRANCH_ID}-${NEON_FUNCTION_SLUG}.compute.c-5.us-east-2.aws.neon.tech`;
console.log(`  URL: ${baseUrl}/`);

// Optional post-deploy health check so the pipeline knows the API actually boots.
if (process.env.WILLOW_SKIP_HEALTHCHECK !== "1") {
    const healthUrl = process.env.WILLOW_HEALTH_URL ?? `${baseUrl}/api/health`;
    try {
        const start = Date.now();
        const res = await fetch(healthUrl);
        const ms = Date.now() - start;
        console.log(`✓ Health check ${healthUrl} → HTTP ${res.status} (${ms}ms)`);
        if (!res.ok) throw new Error(`health check returned ${res.status}`);
    } catch (err) {
        console.error(`✗ Health check failed: ${err.message}`);
        console.error("  (first boot after scale-to-zero can be slow; verify manually)");
        process.exit(1);
    }
}
