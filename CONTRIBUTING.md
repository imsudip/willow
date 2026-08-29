# Contributing to Willow

Thanks for wanting to help! Willow is a voice-first journaling PWA — a hobby
project that runs on free tiers (Vercel + Neon + Cloudflare R2 + GitHub
Actions; OpenAI usage is metered pay-per-token). This guide gets you from
clone to running code.

## Project layout

```text
apps/web        Next.js app — the whole app: client SPA + /api Route Handlers
packages/shared Zod schemas + constants shared by the app
```

## Prerequisites

- Node.js 22+
- An OpenAI API key (`gpt-4o-mini-transcribe` + `gpt-4o-mini`)
- (For full local testing) a Neon project + Cloudflare R2, or just run the app
  against a local Postgres you already have

## First run

```bash
npm install

# 1. Configure the env — ONE file at the repo root for everything
cp .env.example .env.local
#    set OPENAI_API_KEY (required for transcription)

# 2. Point the app at a Postgres database
#    Option A (Neon):  neon env pull   # writes .env.local DATABASE_URL
#    Option B (local):  put DATABASE_URL=postgres://...  in .env.local

# 3. Optional: web-push keys
npm run vapid -w @willow/web

# 4. Start the Next.js dev server (serves the SPA + /api Route Handlers)
npm run dev            # http://localhost:3000
```

Open http://localhost:3000.

> **The single env file**: `.env.local` at the repo root is read by the app
> (`apps/web/src/lib/env-load.ts`) and drizzle-kit (`drizzle.config.ts`). Copy
> `.env.example` once and you're set — every variable is annotated there.

> **R2 in local dev**: the app needs `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
> `R2_SECRET_ACCESS_KEY`, and `R2_API_TOKEN` to mint audio URLs. If you're
> only working on non-audio features, set dummy values — the endpoints that
> don't touch R2 will still work.

## Scripts

```bash
npm run dev                     # Next dev server :3000
npm run build                   # shared → web (Next build, webpack for Serwist)
npm run typecheck               # all workspaces
npm test                        # shared tests
npm run test -w @willow/web     # web unit tests
npm run migrate -w @willow/web  # apply Drizzle migrations to Neon
npm run lint -w @willow/web     # eslint
```

## Database changes

Schema lives in `apps/web/src/lib/db/schema.ts` (Drizzle + Postgres). Migrations
live in `apps/web/drizzle/` and are **applied by the deploy pipeline** in CI
(`drizzle-kit migrate` against Neon before the Vercel build).

To add a migration:

1. Edit `schema.ts`.
2. Generate SQL: `cd apps/web && npx drizzle-kit generate --name <name>`.
   (If you hit the `@willow/shared` resolution error, temporarily inline the
   `MOODS` constant at the top of `schema.ts`, generate, then revert.)
3. Apply locally: `npm run migrate -w @willow/web` (uses `DATABASE_URL`).
4. Commit the new `drizzle/<name>.sql` + updated `meta/_journal.json` — the
   deploy pipeline will apply it on the next push.

## Code style

- TypeScript everywhere, strict mode.
- API endpoints are Next.js Route Handlers, small and colocated in
  `apps/web/src/app/api/`.
- Client is local-first: IndexedDB (Dexie) is the source of truth, the server
  is a sync target. Keep it that way — never make the UI block on the network,
  and don't add SSR/RSC screen rendering (see `docs/migration-nextjs.md`).
- Every user-scoped API route MUST filter by the session user's id. The cron
  routes are the only exception and are secret-gated.
- Run `npm run typecheck` and `npm test` before pushing.

## Deploying (maintainers)

See `docs/ci-cd-github-actions.md` for the full pipeline. In short:

```bash
# one-time: push .env.local secrets/vars to GitHub
bash scripts/push-secrets-to-github.sh
# (VERCEL_TOKEN must exist as a GitHub secret — create it in the Vercel
#  dashboard at vercel.com/account/tokens, then `gh secret set VERCEL_TOKEN`)

# merge an approved PR into main → the Deploy pipeline runs automatically
# (never push to main directly — use the normal PR flow)
```

The pipeline (`deploy.yml`) tests, migrates Neon, deploys the Next.js app to
Vercel, smoke-tests the live URL, and tags a release.

## Reporting issues

Use the issue templates (`.github/ISSUE_TEMPLATE/`) — include what you did,
what you expected, what happened, and (if relevant) whether it's the SPA, an
API route, or the sync behavior. For **security** issues, see `SECURITY.md`.
