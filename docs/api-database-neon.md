# Wiki — API & Database (Neon)

> Part of the [Willow docs](../README.md#documentation). See also
> [Architecture](../ARCHITECTURE.md) for the big-picture flow.

## What this is

Willow is a **single Next.js app** (`apps/web`). The **API is the app's Route
Handlers** — there is no separate API server anymore. The app handles:

- **Auth** — Better Auth (email/password) backed by Postgres tables
- **Entries** — journal entries, sync, stats
- **Transcription & AI** — OpenAI: audio → transcript → cleaned entry, daily
  prompts, weekly digest
- **Web Push** — VAPID push notifications
- **Cron endpoints** — `/api/cron/{reminder,digest,retention}`, auth-gated by
  `CRON_SECRET`

All `/api/*` routes live under `apps/web/src/app/api/` as Next.js **Route
Handlers**, with shared server logic in `apps/web/src/lib/`.

## How it's hosted

| Piece | Host | Why |
|---|---|---|
| App (Next.js: UI + API) | **Vercel** | Free, no cold-start billing, edge CDN |
| Database | **Neon Postgres** | Free tier: 100 CU-hrs/mo, 0.5 GB; scale-to-zero after 5 min idle |

The Next.js app connects to Neon over **HTTP** using the
`@neondatabase/serverless` driver + `drizzle-orm/neon-http` — serverless-native,
no TCP connection pool to warm on cold starts.

## Database access (Drizzle)

- Schema: `apps/web/src/lib/db/schema.ts` (unchanged from the pre-migration layout).
- DB singleton: `apps/web/src/lib/db/index.ts` (a `globalThis` singleton so
  dev HMR / cold starts don't re-create the client).
- Driver: `drizzle-orm/neon-http` + `@neondatabase/serverless`.
- Transactions and advisory locks still work (Neon is real Postgres) — used by
  the R2 upload-quota gate in `apps/web/src/lib/r2.ts`.

## Migrations

Migrations live in `apps/web/drizzle/`. They are **applied in CI** (the
`deploy.yml` pipeline runs `drizzle-kit migrate` against Neon's `DATABASE_URL`
before building), not at runtime.

Locally:

```bash
cd apps/web
npx drizzle-kit generate --name <name>   # create a new migration for a schema change
npm run migrate                          # apply pending migrations (reads repo-root .env.local)
```

> `drizzle.config.ts` imports `./src/lib/env-load` so `drizzle-kit` reads the
> single repo-root `.env.local` (matching the app's own env loading).

## Configuration

All values live in the **single root `.env.local`** (template:
[`.env.example`](../.env.example)). In production the same values are set as
**Vercel project env vars** (server-only) and as **GitHub secrets/vars** for CI
+ cron. See [environment-secrets.md](environment-secrets.md) for where each one
goes.

Key vars used by the API:

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon pooled connection string |
| `OPENAI_API_KEY` | yes | Transcription + cleanup + prompts + digest |
| `TRANSCRIPTION_MODEL` / `CLEANUP_MODEL` | no | Defaults `gpt-4o-mini-transcribe` / `gpt-4o-mini` |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | yes | R2 S3 creds for presigned URLs |
| `R2_API_TOKEN` | yes | Cloudflare API token (R2 read) for the usage gate |
| `R2_BUCKET` | no | Default `willow-audio` |
| `CRON_SECRET` | yes | Shared with GitHub Actions |
| `AUTH_SECRET` | yes | Better Auth session secret |
| `PUBLIC_ORIGIN` | yes in prod | Vercel URL; drives Better Auth baseURL |
| `CRON_TIMEZONE` | no | Default `Asia/Kolkata`; must match workflow schedules |
| `VAPID_*` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | for push | Web Push keys |
| `R2_STORAGE_LIMIT_BYTES` | no | Default 9.9 GB |
| `MAX_UPLOADS_PER_USER_PER_DAY` | no | Default 50 |
| `MAX_AUDIO_UPLOAD_BYTES` | no | Default 10 MB |
| `REMINDER_CRON` | no | Default `30 18 * * *` |

## Deploying

**Automated** (recommended): push to `main` → `.github/workflows/deploy.yml`
builds the Next.js app and deploys it to Vercel (migrations run first).

**Manual**:

```bash
cd apps/web
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

## Managing (local dev / DB changes)

```bash
# point at your Neon branch (writes .env.local DATABASE_URL)
neon env pull   # or paste the pooled URL into .env.local

# schema changes → migrations
cd apps/web && npx drizzle-kit generate --name <name>
# apply locally:
npm run migrate -w @willow/web
```

Committed migrations are applied by the deploy pipeline on the next push.

## Troubleshooting

- **Better Auth "Invalid origin"** — `PUBLIC_ORIGIN` must match the deployed
  origin exactly, and dev uses `localhost:3000` via `trustedOrigins`
  (`apps/web/src/lib/auth-server.ts`).
- **`/api/prompts/daily` 500 (unique violation)** — a check-then-insert race
  was fixed with `.onConflictDoNothing` on `(user_id, date)`; keep the insert
  conflict-safe if you touch it.
- **Cold start / first-request latency** — Vercel functions can take a moment
  on a cold start; not a bug.
