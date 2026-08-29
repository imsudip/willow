import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import webpush from "web-push";

// Generates VAPID keys and appends them to the repo-root .env.local (creates
// it if needed). Existing VAPID keys are preserved by default — replacing the
// pair would invalidate every existing push subscription — so only `--rotate`
// regenerates them. `--print` emits only the public key + subject (never the
// private key).
// Usage:
//   node scripts/generate-vapid.mjs            # create keys if missing, else keep
//   node scripts/generate-vapid.mjs --rotate   # force a new key pair
//   node scripts/generate-vapid.mjs --print    # print public key + subject only
const here = dirname(fileURLToPath(import.meta.url));
// scripts → apps/web → repo root
const envPath = join(here, "..", "..", "..", ".env.local");
const printOnly = process.argv.includes("--print");
const rotate = process.argv.includes("--rotate");

function readExisting() {
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
    return existing;
}

const existing = readExisting();
const hasPair = existing.VAPID_PUBLIC_KEY && existing.VAPID_PRIVATE_KEY;

if (printOnly) {
    // Never print the private key — it's a push-signing secret.
    const out = {
        VAPID_PUBLIC_KEY: hasPair ? existing.VAPID_PUBLIC_KEY : "(not set — run generate-vapid.mjs)",
        VAPID_SUBJECT: existing.VAPID_SUBJECT ?? "mailto:journal@localhost",
    };
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
}

let newVars;
if (rotate || !hasPair) {
    const keys = webpush.generateVAPIDKeys();
    newVars = {
        VAPID_PUBLIC_KEY: keys.publicKey,
        VAPID_PRIVATE_KEY: keys.privateKey,
        VAPID_SUBJECT: "mailto:journal@localhost",
    };
} else {
    // Keep the existing pair authoritative so subscriptions stay valid.
    newVars = {};
}

const merged = { ...existing, ...newVars };
const out = Object.entries(merged)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
mkdirSync(dirname(envPath), { recursive: true });
writeFileSync(envPath, out + "\n");

if (rotate || !hasPair) {
    console.log("VAPID keys written to .env.local");
} else {
    console.log("VAPID keys already present in .env.local — kept (use --rotate to replace).");
}
