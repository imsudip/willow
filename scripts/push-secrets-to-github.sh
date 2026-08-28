#!/usr/bin/env bash
# Push Willow deploy secrets + vars from the root .env.local to GitHub Actions
# (repo-level) via `gh`, without printing any secret value.
#
#   Secrets → gh secret set    (masked in Actions)
#   Vars    → gh variable set  (non-secret config: models, timezone, ids, urls)
#
# Reads the SINGLE unified env file at the repo root (see .env.example).
#
# Usage: bash scripts/push-secrets-to-github.sh
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=".env.local"
[ -f "$ENV_FILE" ] || { echo "✗ $ENV_FILE not found (copy .env.example → .env.local)"; exit 1; }

# A helper that reads a KEY=value line from the .env and sets it via gh,
# printing only the key name + masked value, never the real value.
set_secret() { # $1 = key
  local key="$1" val
  val="$(grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
  if [ -z "$val" ]; then echo "  · ${key}: MISSING (skipped)"; return 0; fi
  printf '%s' "$val" | gh secret set "$key" >/dev/null
  echo "  · ${key}: set (value masked)"
}

set_var() { # $1 = key
  local key="$1" val
  val="$(grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
  if [ -z "$val" ]; then echo "  · ${key}: MISSING (skipped)"; return 0; fi
  printf '%s' "$val" | gh variable set "$key" --body "$val" >/dev/null
  echo "  · ${key}: set"
}

echo "→ GitHub repo: $(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo unknown)"

echo "── Secrets ──"
for k in \
  NEON_API_KEY OPENAI_API_KEY AUTH_SECRET CRON_SECRET \
  R2_API_TOKEN R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY \
  VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY; do
  set_secret "$k"
done

echo "── Variables ──"
for k in \
  NEON_PROJECT_ID NEON_BRANCH_ID NEON_FUNCTION_SLUG \
  R2_BUCKET R2_STORAGE_LIMIT_BYTES MAX_UPLOADS_PER_USER_PER_DAY MAX_AUDIO_UPLOAD_BYTES \
  PUBLIC_ORIGIN CRON_TIMEZONE TRANSCRIPTION_MODEL CLEANUP_MODEL REMINDER_CRON VAPID_SUBJECT; do
  set_var "$k"
done

echo "── Vercel / static vars (not in .env) ──"
set_var_from() { # $1 = key, $2 = value (may be literal)
  printf '%s' "$2" | gh variable set "$1" --body "$2" >/dev/null
  echo "  · ${1}: set"
}
# Vercel vars come from .env.local too (VERCEL_ORG_ID / VERCEL_PROJECT_ID);
# VERCEL_TOKEN is a CI-only secret you create once with `vercel tokens create`.
for k in VERCEL_ORG_ID VERCEL_PROJECT_ID; do
  set_var "$k"
done

echo "✓ Done. Verify with: gh secret list && gh variable list"
echo "  (Remember: VERCEL_TOKEN and GH_VARIABLES_TOKEN are CI-only secrets —"
echo "   create them via the Vercel dashboard / GitHub fine-grained PAT, then"
echo "   'gh secret set <NAME>'.)"
