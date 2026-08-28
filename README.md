# Willow

[![Live](https://img.shields.io/badge/Live-willow--alpha--one.vercel.app-8B5CF6)](https://willow-alpha-one.vercel.app/)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)

Voice-first journaling PWA. Ramble at the end of the day; the app transcribes, cleans, and stores it as a journal entry.

**Try it live: [https://willow-alpha-one.vercel.app/](https://willow-alpha-one.vercel.app/)**

- **Architecture** — see [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit (Vercel + Neon + Cloudflare R2 + GitHub Actions, all free-tier)
- **Contributing** — see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, scripts, and DB workflows

## Screenshots

| Today | Entry | Stats | Weekly digest | Settings |
|:---:|:---:|:---:|:---:|:---:|
| <img src="assets/screenshots/today.webp" alt="Today screen" width="180"> | <img src="assets/screenshots/entry.webp" alt="Entry detail with audio player" width="180"> | <img src="assets/screenshots/stats.webp" alt="Stats with streak, activity, mood calendar" width="180"> | <img src="assets/screenshots/stats-digest.webp" alt="Weekly digest" width="180"> | <img src="assets/screenshots/settings.webp" alt="Settings" width="180"> |

## Repo

- `apps/web` — React + Vite PWA (mobile-first, warm "golden hour" design)
- `apps/api` — Hono API (Postgres, Better Auth, OpenAI transcription + AI features, Web Push)
- `packages/shared` — Zod schemas, constants, shared types

## Requirements

- Node.js 22+
- An [OpenAI API key](https://platform.openai.com/api-keys) with access to `gpt-4o-mini-transcribe` (transcription) and `gpt-4o-mini` (cleanup/prompts/digest)
- VAPID keys for web push (optional; without them reminders/digests are disabled)
- A Neon account (Postgres + Functions) and a Cloudflare account (R2) for deployment

## Run locally (dev)

```bash
npm install

# configure env
cp apps/api/.env.example apps/api/.env
# edit apps/api/.env — set OPENAI_API_KEY (required for transcription)
# and the R2/Neon values below.

# optional: generate web-push keys
npm run vapid -w @willow/api

# start both servers
npm run dev            # API on :8777 (hot reload)
npm run dev:web        # web on :5173 (proxies /api → :8777)
```

Open http://localhost:5173 (web) or http://localhost:8777 (API).

## Deploy (free tier)

The app is split across three free-tier services:

| Piece | Host | Why |
|---|---|---|
| Frontend (Vite PWA) | **Vercel** (static) | Free, no cold starts; `/api/*` is proxied to Neon via `vercel.json` |
| API (Hono) | **Neon Functions** | Long-running Node 24 serverless next to Postgres; `export default app` works directly |
| Database | **Neon Postgres** | Free tier: 100 CU-hrs, 0.5 GB storage (scale-to-zero after 5 min) |
| Audio files | **Cloudflare R2** | Free tier: 10 GB, 1M Class A + 10M Class B ops/mo, no egress fees |
| Scheduled jobs | **GitHub Actions** | Timezone-aware cron; triggers `/api/cron/*` on the function |

### Deploying the API to Neon Functions

```bash
# one-time: link the repo to your Neon project (us-east-2 — required for Functions)
neon link

# build the function bundle (esbuild, everything inlined except native deps)
npm run build -w @willow/api
npm run build:function -w @willow/api

# package index.mjs + drizzle/ migrations into a zip (the CLI's --src only ships
# the bundle, so we use the API for the custom zip)
mkdir -p apps/api/dist/fnzip
cp apps/api/dist/function.mjs apps/api/dist/fnzip/index.mjs
cp -r apps/api/drizzle apps/api/dist/fnzip/drizzle
(cd apps/api/dist/fnzip && zip -r ../function.zip index.mjs drizzle)

# deploy via the API with env vars as JSON (see scripts/deploy-function.mjs)
```

The function runs `migrate()` on boot (idempotent — skips if tables exist).

### Deploying the frontend to Vercel

```bash
cd apps/web
vercel link --yes --project willow
vercel build --prod --yes   # builds locally (workspace-aware)
vercel deploy --prebuilt --prod --yes
```

`apps/web/vercel.json` rewrites non-API routes to the SPA (`index.html`), and
`apps/web/middleware.ts` proxies `/api/*` to your Neon function URL at the
edge (set the `WILLOW_API_URL` env var in the Vercel project — vercel.json
can't read env vars, which is why the proxy lives in middleware).

### Scheduled jobs (GitHub Actions)

`.github/workflows/cron.yml` runs three jobs (evening reminder, weekly digest,
audio retention) on a timezone-aware schedule and hits
`$WILLOW_API_URL/api/cron/{reminder,digest,retention}` with
`Authorization: Bearer $WILLOW_CRON_SECRET`.

Set repo secrets/vars:

```bash
gh secret set WILLOW_CRON_SECRET --body "$CRON_SECRET"
gh variable set WILLOW_API_URL --body "https://<branch>-<slug>.compute.<cell>.us-east-2.aws.neon.tech"
```

### Environment reference

| Var | Required | Notes |
|---|---|---|
| `OPENAI_API_KEY` | yes (transcription) | Server-side only; never shipped to the client |
| `DATABASE_URL` | yes | Neon pooled URL; injected automatically on Functions, `neon env pull` locally |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | yes (audio) | R2 S3 API token (Object Read & Write) for presigned URLs |
| `R2_API_TOKEN` | yes (audio gate) | Cloudflare API token with R2 read, for the free-tier usage check |
| `CRON_SECRET` | yes (jobs) | Shared secret the GitHub Actions workflow sends to `/api/cron/*`; no default — set it |
| `AUTH_SECRET` | yes | Better Auth session secret; no default — set it (`openssl rand -hex 32`) |
| `CRON_TIMEZONE` | no | IANA zone for the reminder's "today" boundary (default `Asia/Kolkata`; must match the workflow schedule) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | for push | `npm run vapid -w @willow/api` generates them |
| `PUBLIC_ORIGIN` | in prod | Your deployed origin (e.g. `https://willow.vercel.app`); CORS + trusted origins |
| `R2_STORAGE_LIMIT_BYTES` | no | Free-tier gate: reject uploads past this (default 9.9 GB) |
| `MAX_UPLOADS_PER_USER_PER_DAY` | no | Abuse gate: per-user daily upload cap (default 50) |
| `MAX_AUDIO_UPLOAD_BYTES` | no | Per-recording cap enforced via presigned PUT Content-Length (default 10 MB) |
| `MIGRATIONS_DIR` | no | Where the bundled `drizzle/` folder lives on the function runtime |

### Audio flow (R2 presigned URLs)

1. Client calls `POST /api/entries/:id/audio-url` (auth-gated, storage + quota checked) — the entry is **not** marked as having audio yet
2. Server mints a 1-hour presigned R2 PUT URL (Content-Length-capped via `MAX_AUDIO_UPLOAD_BYTES`)
3. Client PUTs the blob straight to R2 (never through the function)
4. Client calls `POST /api/entries/:id/audio-complete`; the server verifies the object exists (HEAD), then atomically marks the entry `audioPresent`
5. Playback: `GET /api/entries/:id/audio` mints a 1-hour presigned GET URL

### R2 CORS (required once)

Presigned uploads come from the browser, so the bucket needs a CORS policy
allowing `PUT`/`GET`/`HEAD` with the audio content type from your app origin
(and `http://localhost:5173` for dev). Save this as `r2-cors.json`:

```json
{
  "rules": [
    {
      "allowed": {
        "methods": ["GET", "PUT", "HEAD"],
        "origins": ["https://<your-app>.vercel.app", "http://localhost:5173"],
        "headers": ["Content-Type"]
      },
      "maxAgeSeconds": 3600
    }
  ]
}
```

Apply it with:

```bash
npx wrangler r2 bucket cors set willow-audio --file r2-cors.json
```

### Costs

- **Transcription:** ~$0.006/min for `gpt-4o-mini-transcribe` — a 5-min daily ramble ≈ **$1/mo**
- **Cleanup + prompts + digest:** pennies (small token calls, cached daily)
- **Hosting:** $0 (Neon free tier + Vercel static + R2 free tier + GitHub Actions free minutes)
- **OpenAI:** metered pay-per-token (see above)

### Push notifications (PWA)

The client subscribes in Settings → Push notifications. For the badge icon, drop a white-on-transparent leaf at `apps/web/public/badge.png` and reference it in `vite.config.ts` + `src/sw.ts`. The service worker precaches everything so the app installs and works offline.

## Scripts

- `npm run dev` — API watch on :8777 (web on :5173 via `npm run dev:web`)
- `npm run build` / `npm run typecheck` / `npm test` — full repo
- `npm run build:function -w @willow/api` — esbuild bundle for the Neon Function
- `npm run vapid -w @willow/api` — generate web-push keys into `.env`

## License

[GNU Affero General Public License v3.0](LICENSE) — if you modify and run this
software as a network service, you must offer your modified source to your
users. See the [AGPL FAQ](https://www.gnu.org/licenses/agpl-3.0.html) for
details.
