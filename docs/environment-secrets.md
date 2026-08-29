# Secrets & Environment — Where to Get Everything

> Part of the [Willow docs](../README.md#documentation). This guide tells you
> **exactly where** to find or create every variable Willow needs — the UI
> clicks, the URLs, and which service each secret belongs to.
>
> Willow uses a **single root `.env.local`** (template: [`.env.example`](../.env.example)).
> This page is the human-readable companion to that file.

## Quick reference

| Variable | Service | Where to get it | Type |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) → **Create new secret key** | Secret |
| `DATABASE_URL` | Neon Postgres | `neon env pull` (local) or paste the pooled URL into `.env.local` | Secret |
| `R2_ACCOUNT_ID` | Cloudflare R2 | Dashboard → **R2** → top-right account ID | Non-secret |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 | R2 → **Manage R2 API Tokens** → create (shown once) | Secret |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 | same token creation (shown once) | Secret |
| `R2_API_TOKEN` | Cloudflare | [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** (R2 read) | Secret |
| `R2_BUCKET` | Cloudflare R2 | the bucket you created (default `willow-audio`) | Non-secret |
| `AUTH_SECRET` | local | generate: `openssl rand -hex 32` | Secret |
| `CRON_SECRET` | local | generate: `openssl rand -hex 32` | Secret |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | local | generate: `npm run vapid -w @willow/web` | Secret (private) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Vercel | copy of `VAPID_PUBLIC_KEY` — the only client-visible var | Non-secret |
| `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | Vercel | Vercel project **Settings** → ID fields | Non-secret |
| `VERCEL_TOKEN` | Vercel | [vercel.com/account/tokens](https://vercel.com/account/tokens) → **Create Token** (team-scoped) | Secret (CI-only) |
| `WILLOW_API_URL` | Vercel | the **Vercel production URL** (e.g. `https://willow-alpha-one.vercel.app`) — set as a GitHub var for cron | Non-secret |
| `WILLOW_PRODUCTION_URL` | Vercel | the **Vercel production URL** — set as a GitHub var for the smoke test | Non-secret |

---

## OpenAI

| Variable | Required? | Type |
| --- | --- | --- |
| `OPENAI_API_KEY` | yes (all AI features) | Secret |

**Where:** [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

1. Sign in to the OpenAI platform.
2. Click **API keys** in the left sidebar.
3. Click **Create new secret key**.
4. Give it a name (e.g. `willow`) and choose a **Project**.
5. **Copy the key immediately** — it's shown only once (starts with `sk-` or `sk-proj-`).

> The key must have access to `gpt-live-transcribe` (transcription) and
> `gpt-4o-mini` (cleanup/prompts/digest). Server-side only — never ship it to
> the client.

---

## Neon (Postgres)

### Database connection — `DATABASE_URL`

- **Local dev:** in the repo root, run:
  ```bash
  neon env pull  # writes .env.local DATABASE_URL
  ```
  Or paste the pooled connection string from the Neon Console:
  Console → **Project** → **Connect** → **Connection string** (Pooled).
- **Production:** set `DATABASE_URL` as a **Vercel project env var** (server-only)
  **and** as a **GitHub secret** (the deploy pipeline's migrate step needs it).

---

## Cloudflare R2 (audio storage)

### `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`

**Where (UI):** [dash.cloudflare.com](https://dash.cloudflare.com) → **R2**

| Variable | Where to get it |
| --- | --- |
| `R2_ACCOUNT_ID` | R2 page → top-right, under the account menu ("Account ID" — a 32-char hex string) |
| `R2_ACCESS_KEY_ID` | R2 → **Manage R2 API Tokens** → **Create API token** (shown once) |
| `R2_SECRET_ACCESS_KEY` | same token creation (shown once) |

**Creating the R2 token:**
1. Go to **R2** → **Manage R2 API Tokens** (top-right).
2. Click **Create API token**.
3. Set **Permissions** → **Object Read & Write**.
4. Scope it: **Apply to specific bucket(s) only** → select `willow-audio` (recommended) or "All buckets".
5. **Create** → copy the `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` (shown once).

### `R2_API_TOKEN` (usage-gate token)

A **Cloudflare API token** (not R2-specific) with R2 read permission, used to check bucket size before minting upload URLs.

**Where (UI):** [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token**

1. Click **Create Token**.
2. Under "Custom token" → **Get started**.
3. **Permissions:** Account → **R2 Storage** → **Read**.
4. **Account Resources:** Include your account.
5. **Create** → copy the token (starts with `_` or a long alphanumeric string; shown once).

### `R2_BUCKET`

The bucket name — create it once if you don't have it:
```bash
npx wrangler r2 bucket create willow-audio
# then set the CORS policy (see docs/audio-storage-r2.md)
```

---

## Local secrets (generate yourself)

These have **no external provider** — you generate them locally and they never
leave the repo except as GitHub secrets.

| Variable | Generate with | Notes |
| --- | --- | --- |
| `AUTH_SECRET` | `openssl rand -hex 32` | Better Auth session secret |
| `CRON_SECRET` | `openssl rand -hex 32` | Shared with GitHub Actions for `/api/cron/*` |

### Web Push — `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

```bash
npm run vapid -w @willow/web
```
This writes the three values into `.env.local` (or `--print` them).
`VAPID_SUBJECT` is a `mailto:` address (e.g. `mailto:you@example.com`).
Without these, push reminders/digests are disabled.

---

## GitHub (CI secrets & tokens)

These are **CI-only secrets** — not in `.env.local` (except the ones the push
script copies).

---

## Vercel (frontend)

### Project IDs — `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

**Where (UI):**
- `VERCEL_ORG_ID` = the **Team ID** (not the slug). Vercel project →
  **Settings** → **General** → the `orgId` field; or account **Settings** →
  **Teams** → the team's **ID**. The **slug** (e.g. `imsudips-projects`) is
  separate and only used for the CLI `--scope` flag.
- `VERCEL_PROJECT_ID` = project → **Settings** → **General** → **Project ID** (`prj_...`).

```bash
# The orgId is in the linked project config:
cat .vercel/project.json          # → { "orgId": "...", "projectId": "prj_..." }
vercel project inspect willow     # → ID (prj_...)
vercel teams ls                   # → team slug (not the orgId)
```

> ⚠️ `deploy.yml` passes `VERCEL_ORG_ID` straight to the Vercel CLI — it must be
> the **orgId / Team ID**, not the team slug.

### `VERCEL_TOKEN`

**Where (UI):** [vercel.com/account/tokens](https://vercel.com/account/tokens) → **Create Token**

1. Name it (e.g. `ci`).
2. **Scope:** ⚠️ must be **team `imsudip's projects` → "All Projects"** (i.e. a
   **team-scoped** token), or Full Account. A **project-scoped** token breaks
   `vercel pull` ("Could not retrieve Project Settings" — [vercel/vercel#17506](https://github.com/vercel/vercel/issues/17506)).
3. Set an **expiration** (note: expired tokens break the deploy pipeline).
4. **Create** → copy the `vcp_...` token (shown once).

> ⚠️ The CLI command is `vercel tokens add "<name>"` (not `vercel tokens
> create`). Also, creating tokens via the CLI requires a **classic** personal
> access token — if you logged in with OAuth (browser), use the Tokens page above.

Then store it:
```bash
gh secret set VERCEL_TOKEN
```

### `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (Vercel project env)

The **only** client-visible var. Set it in the Vercel project:

1. Vercel project → **Settings** → **Environment Variables**.
2. Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = your VAPID public key (copy from
   `.env.local`).
3. Environment: **Production** (and Preview if you want previews working).
4. **Redeploy** after changing it.

> All other server vars (`DATABASE_URL`, `OPENAI_API_KEY`, `AUTH_SECRET`,
> `R2_*`, `CRON_SECRET`, `VAPID_*`, `PUBLIC_ORIGIN`) are set as server-only
> Vercel project env vars too — they never reach the client.

### GitHub vars for cron + smoke test

- `WILLOW_API_URL` = the **Vercel production URL** (e.g.
  `https://willow-alpha-one.vercel.app`) — `cron.yml` hits `/api/cron/*` on it.
- `WILLOW_PRODUCTION_URL` = the same production URL — `deploy.yml` smoke-tests
  `/api/health` on it.

---

## What goes into GitHub (push script)

`scripts/push-secrets-to-github.sh` copies values from `.env.local` into GitHub
Actions as **Secrets** or **Variables**:

| GitHub setting | Type | From `.env.local` |
| --- | --- | --- |
| `DATABASE_URL` | Secret | `DATABASE_URL` |
| `OPENAI_API_KEY` | Secret | `OPENAI_API_KEY` |
| `AUTH_SECRET` | Secret | `AUTH_SECRET` |
| `CRON_SECRET` | Secret | `CRON_SECRET` |
| `R2_API_TOKEN` | Secret | `R2_API_TOKEN` |
| `R2_ACCOUNT_ID` | Secret | `R2_ACCOUNT_ID` |
| `R2_ACCESS_KEY_ID` | Secret | `R2_ACCESS_KEY_ID` |
| `R2_SECRET_ACCESS_KEY` | Secret | `R2_SECRET_ACCESS_KEY` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Secret | same |
| `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | **Variable** | same |

**Not set by the script (create once yourself):** `VERCEL_TOKEN` (team-scoped —
see above), `WILLOW_API_URL` and `WILLOW_PRODUCTION_URL` (the Vercel prod URL).
