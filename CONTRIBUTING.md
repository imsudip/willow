# Contributing to Willow

Thanks for wanting to help! Willow is a voice-first journaling PWA — a hobby
project that runs entirely on free tiers (Vercel + Neon + Cloudflare R2 +
GitHub Actions). This guide gets you from clone to running code.

## Project layout

```
apps/web        React + Vite PWA (mobile-first)
apps/api        Hono API (Postgres, Better Auth, OpenAI, Web Push)
packages/shared Zod schemas + constants shared by web & api
```

## Prerequisites

- Node.js 22+
- An OpenAI API key (`gpt-4o-mini-transcribe` + `gpt-4o-mini`)
- (For full local testing) a Neon project + Cloudflare R2, or just run the API
  against a local Postgres you already have

## First run

```bash
npm install

# 1. Configure the API env
cp apps/api/.env.example apps/api/.env
#    set OPENAI_API_KEY (required for transcription)

# 2. Point the API at a Postgres database
#    Option A (Neon):  neon link && neon checkout main   # writes .env.local
#    Option B (local):  export DATABASE_URL=postgres://...  in apps/api/.env

# 3. Optional: web-push keys
npm run vapid -w @willow/api

# 4. Start both servers
npm run dev            # API on :8777 (hot reload)
npm run dev:web        # web on :5173 (proxies /api → :8777)
```

Open http://localhost:5173.

> **R2 in local dev**: the API needs `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
> `R2_SECRET_ACCESS_KEY`, and `R2_API_TOKEN` to mint audio URLs. If you're
> only working on non-audio features, set dummy values — the endpoints that
> don't touch R2 will still work.

## Scripts

```bash
npm run dev                     # API watch :8777
npm run dev:web                 # web :5173
npm run build                   # shared → web → api
npm run typecheck               # all workspaces
npm test                        # shared + api tests
npm run lint -w @willow/web     # eslint
npm run build:function -w @willow/api   # esbuild bundle for Neon Functions
```

## Database changes

Schema lives in `apps/api/src/db/schema.ts` (Drizzle + Postgres). Migrations
live in `apps/api/drizzle/` and are **applied automatically when the Neon
Function boots**.

To add a migration:

1. Edit `schema.ts`.
2. Generate SQL: `cd apps/api && npx drizzle-kit generate --name <name>`.
   (If you hit the `@willow/shared` resolution error, temporarily inline the
   `MOODS` constant at the top of `schema.ts`, generate, then revert.)
3. Apply locally: `cd apps/api && npx drizzle-kit push` (uses `DATABASE_URL`).
4. Commit the new `drizzle/<name>.sql` + updated `meta/_journal.json` — the
   deployed function will apply it on next boot (the migrate step is
   idempotent).

## Code style

- TypeScript everywhere, strict mode, `NodeNext` modules.
- Hono for the API; routes are small and colocated in `apps/api/src/routes/`.
- Client is local-first: IndexedDB (Dexie) is the source of truth, the server
  is a sync target. Keep it that way — never make the UI block on the network.
- Every user-scoped API route MUST filter by the session user's id. The cron
  routes are the only exception and are secret-gated.
- Run `npm run typecheck` and `npm test` before pushing.

## Deploying (maintainers)

See `ARCHITECTURE.md` §7 for the full deploy runbook. In short:

```bash
# API → Neon Functions
node apps/api/scripts/deploy-function.mjs   # requires NEON_API_KEY + .env

# Frontend → Vercel
cd apps/web && vercel build --prod --yes && vercel deploy --prebuilt --prod --yes
```

## Reporting issues

Include: what you did, what you expected, what happened, and (if relevant)
whether it's the web app, the API, or the sync behavior.
