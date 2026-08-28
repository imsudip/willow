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
| `DATABASE_URL` | Neon Postgres | `neon env pull` (local) / auto-injected on Functions | Secret |
| `R2_ACCOUNT_ID` | Cloudflare R2 | Dashboard → **R2** → top-right account ID | Non-secret |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 | R2 → **Manage R2 API Tokens** → create (shown once) | Secret |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 | same token creation (shown once) | Secret |
| `R2_API_TOKEN` | Cloudflare | [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** (R2 read) | Secret |
| `R2_BUCKET` | Cloudflare R2 | the bucket you created (default `willow-audio`) | Non-secret |
| `AUTH_SECRET` | local | generate: `openssl rand -hex 32` | Secret |
| `CRON_SECRET` | local | generate: `openssl rand -hex 32` | Secret |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | local | generate: `npm run vapid -w @willow/api` | Secret (private) |
| `NEON_PROJECT_ID` / `NEON_BRANCH_ID` / `NEON_FUNCTION_SLUG` | Neon | Neon Console (or `neon project list` / `neon branch list` / `neon functions list`) | Non-secret |
| `NEON_API_KEY` | Neon | Console → **Account settings** → **API keys** → **Create new API key** | Secret |
| `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | Vercel | Vercel project **Settings** → ID fields | Non-secret |
| `VERCEL_TOKEN` | Vercel | [vercel.com/account/tokens](https://vercel.com/account/tokens) → **Create Token** | Secret (CI-only) |
| `GH_VARIABLES_TOKEN` | GitHub | [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new) → fine-grained PAT, "Variables" write | Secret (CI-only) |
| `WILLOW_API_URL` | Neon/Vercel | The Neon function URL — set in the **Vercel project**, not `.env.local` | Non-secret |
| `VITE_VAPID_PUBLIC_KEY` | Vercel | Copy of `VAPID_PUBLIC_KEY` — set in the **Vercel project** for prod builds | Non-secret |

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

## Neon (Postgres + Functions)

### Database connection — `DATABASE_URL`

- **Deployed (Neon Functions):** injected automatically — you do **not** set this.
- **Local dev:** in the repo root, run:
  ```bash
  neon link          # one-time, links the repo to your Neon project
  neon checkout main # writes .env.local DATABASE_URL (and pulls branch env)
  ```
  Or paste the pooled connection string from the Neon Console:
  Console → **Project** → **Connect** → **Connection string** (Pooled).

### Deploy identifiers — `NEON_PROJECT_ID`, `NEON_BRANCH_ID`, `NEON_FUNCTION_SLUG`

**Where (UI):** [console.neon.tech](https://console.neon.tech)

| Variable | Where to look |
| --- | --- |
| `NEON_PROJECT_ID` | Console → select your project → the ID is in the URL (`/project/<id>`) and under **Project settings** |
| `NEON_BRANCH_ID` | Console → **Branches** → select the branch → the ID is in the URL (`/branches/<id>`) |
| `NEON_FUNCTION_SLUG` | Console → **Compute** → **Functions** (or Neon CLI `neon functions list`) |

**Or via CLI:**
```bash
neon project list    # → ID
neon branch list     # → ID
neon functions list  # → Slug + invocation URL
```

> ⚠️ Functions are only supported in **AWS US East (Ohio)** — create the project
> there or the deploy API will reject it.

### `NEON_API_KEY`

**Where (UI):** Neon Console → click your **avatar** (top-right) → **Account settings** → **API keys** → **Create new API key**.

1. Give it a descriptive name (e.g. `ci-deploy`).
2. Click **Create**.
3. **Copy the key once** — it starts with `napi_` and is shown only once (revoke/recreate if lost).

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
npm run vapid -w @willow/api
```
This prints the three values; add them to `.env.local`. `VAPID_SUBJECT` is a
`mailto:` address (e.g. `mailto:you@example.com`). Without these, push
reminders/digests are disabled.

---

## GitHub (CI secrets & tokens)

These are **CI-only secrets** — not in `.env.local` (except the ones the push
script copies).

### `GH_VARIABLES_TOKEN`

**What it's for:** the deploy pipeline re-syncs the `WILLOW_API_URL` repo
variable. The default `GITHUB_TOKEN` can't write repo variables (403), so it
uses this fine-grained PAT.

**Where (UI):** [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)

1. **Resource owner:** your GitHub user.
2. **Repository access:** Only select repositories → `willow`.
3. **Permissions:** Repository permissions → **Variables** → **Read and write**.
4. **Generate token** → copy the `github_pat_...` value (shown once).

Then store it:
```bash
gh secret set GH_VARIABLES_TOKEN
```

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
2. **Scope:** team `imsudips-projects` → project `willow` (recommended) or Full Account.
3. Set an **expiration** (note: expired tokens break the deploy pipeline).
4. **Create** → copy the `vcp_...` token (shown once).

> ⚠️ The CLI command is `vercel tokens add "<name>"` (not `vercel tokens
> create`). Also, creating tokens via the CLI requires a **classic** personal
> access token — if you logged in with OAuth (browser), use the Tokens page above.

Then store it:
```bash
gh secret set VERCEL_TOKEN
```

### `WILLOW_API_URL` + `VITE_VAPID_PUBLIC_KEY` (Vercel project env)

These live in the **Vercel project**, not `.env.local`:

1. Vercel project → **Settings** → **Environment Variables**.
2. Add `WILLOW_API_URL` = your Neon function's **`invocation_url`** — don't
   hand-build it (Neon assigns the cell). Get it from the Neon Console
   (**Compute → Functions**) or the CLI:
   ```bash
   neon functions list           # → Slug + Invocation URL
   neon functions get <slug>     # → the function's invocation_url
   ```
   Copy the `invocation_url` (e.g. `https://<branch_id>-<slug>.compute.<cell>.us-east-2.aws.neon.tech`).
3. Add `VITE_VAPID_PUBLIC_KEY` = your VAPID public key (copy from `.env.local`).
4. Environment: **Production** (and Preview if you want previews working).
5. **Redeploy** after changing them.

---

## What goes into GitHub (push script)

`scripts/push-secrets-to-github.sh` copies values from `.env.local` into GitHub
Actions as **Secrets** or **Variables**:

| GitHub setting | Type | From `.env.local` |
| --- | --- | --- |
| `NEON_API_KEY` | Secret | `NEON_API_KEY` |
| `OPENAI_API_KEY` | Secret | `OPENAI_API_KEY` |
| `AUTH_SECRET` | Secret | `AUTH_SECRET` |
| `CRON_SECRET` | Secret | `CRON_SECRET` |
| `R2_API_TOKEN` | Secret | `R2_API_TOKEN` |
| `R2_ACCOUNT_ID` | Secret | `R2_ACCOUNT_ID` |
| `R2_ACCESS_KEY_ID` | Secret | `R2_ACCESS_KEY_ID` |
| `R2_SECRET_ACCESS_KEY` | Secret | `R2_SECRET_ACCESS_KEY` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Secret | same |
| `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | **Variable** | same |

**Not set by the script (create once yourself):** `VERCEL_TOKEN` and
`GH_VARIABLES_TOKEN` (see above).
