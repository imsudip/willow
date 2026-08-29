import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import webpush from "web-push";

// Generates VAPID keys and appends them to the repo-root .env.local (creates
// it if needed), or prints the keys to stdout if --print is passed.
// Usage: node scripts/generate-vapid.mjs [--print]
const here = dirname(fileURLToPath(import.meta.url));
// scripts → apps/web → repo root
const envPath = join(here, "..", "..", "..", ".env.local");
const printOnly = process.argv.includes("--print");

const keys = webpush.generateVAPIDKeys();
const newVars = {
  VAPID_PUBLIC_KEY: keys.publicKey,
  VAPID_PRIVATE_KEY: keys.privateKey,
  VAPID_SUBJECT: "mailto:journal@localhost",
};

if (printOnly) {
  console.log(JSON.stringify(newVars, null, 2));
  process.exit(0);
}

let existing = {};
try {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) existing[m[1]] = m[2];
  }
} catch {
  /* .env.local doesn't exist yet */
}

const merged = { ...existing, ...newVars };
const out = Object.entries(merged)
  .map(([k, v]) => `${k}=${v}`)
  .join("\n");
mkdirSync(dirname(envPath), { recursive: true });
writeFileSync(envPath, out + "\n");

console.log("VAPID keys written to .env.local");
