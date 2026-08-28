# AGENTS.md — Willow agent & contributor guide

> This file is the **agent start** for AI coding agents and a concise orientation
> for humans. Read this first. For the app overview see [README.md](README.md),
> for architecture deep-dives see [ARCHITECTURE.md](ARCHITECTURE.md), and for
> per-service operations see the [docs/](docs/README.md) wikis.

## Repo layout

```text
apps/
  api/     Hono API (Node 22+, Postgres/Drizzle, Better Auth, OpenAI, Web Push)
  web/     React 19 + Vite PWA (Tailwind 4, Dexie, service worker)
packages/
  shared/  Zod schemas + constants shared by web & api (built first)
docs/      per-service wikis (API+Neon, Vercel, R2, GitHub Actions, OpenAI)
scripts/   one-shot tooling (env sync, secret push)
.github/
  workflows/  ci.yml (gate), deploy.yml (pipeline), cron.yml (scheduled jobs)
```

Monorepo is npm **workspaces**. `@willow/shared` must be **built** before
`@willow/api` or `@willow/web` typecheck/build (they import its `dist`).

## Golden rules

1. **Secrets never in code, logs, or chat.** Server-side env vars live only in
   the gitignored `.env.local` and GitHub Actions secrets. `VITE_*` vars are
   client-visible — never put secrets there.
2. **One env file.** The repo uses a single root `.env.local` (template
   `.env.example`). The API loads it via `apps/api/src/env-load.ts`; Vite loads
   it via `envDir` in `apps/web/vite.config.ts`. Do not add per-app `.env`
   files.
3. **Migrations, not `drizzle-kit push` in prod.** Schema changes are committed
   as migrations in `apps/api/drizzle/` and applied automatically on Neon
   function boot. Only `drizzle-kit push` for **local** convenience.
4. **Don't commit to `main` directly.** Work on a feature branch, open a PR.
   The `Deploy` pipeline runs on push to `main` — a direct push deploys prod.
5. **Server-only OpenAI.** The API proxies every model call; the key never
   reaches the client. Audio is uploaded to R2 via presigned URLs, never
   through the API.
6. **Free-tier discipline.** Keep changes within the free tiers: Neon Postgres
   (100 CU-hrs), R2 (10 GB), Vercel static, GitHub Actions minutes. Guardrails
   (`R2_STORAGE_LIMIT_BYTES`, `MAX_UPLOADS_PER_USER_PER_DAY`) protect R2.

## Commands

```bash
npm ci                          # install (use this over npm install for CI parity)
npm run build                   # shared → web → api
npm run typecheck               # all workspaces
npm test                        # shared + api tests (vitest)
npm run dev                     # API watch :8777
npm run dev:web                 # web :5173 (proxies /api → :8777)
npm run lint -w @willow/web     # eslint (note: no ESLint config in repo yet)
```

> **No ESLint config exists** in the repo, so `npm run lint` currently fails.
> CI gates are `typecheck` + `test` only. If you wire up ESLint, add it back to
> `.github/workflows/ci.yml` and `deploy.yml`.

## Environment

Everything is driven by one file:

```bash
cp .env.example .env.local   # then fill in values
```

- **`apps/api/src/env.ts`** — Zod-validated env schema (authoritative list).
- **`apps/api/src/env-load.ts`** — loads `.env.local` from the repo root
  (lookup order: `$WILLOW_ENV_FILE` → repo root → package dir).
- **`.env.example`** — annotated template covering every service.

CI/deploy secrets come from GitHub Actions (populated by
`scripts/push-secrets-to-github.sh`). Vercel project env is set in the Vercel
dashboard (see `docs/frontend-vercel.md`).

## API (apps/api)

- **Stack**: Hono (`app.ts`), Better Auth (`auth.ts`), Drizzle + `pg`
  (`db/`), OpenAI (`services/openai.ts`).
- **Two entrypoints**:
  - `src/index.ts` — standalone Node server (local dev, `@hono/node-server` +
    WebSocket).
  - `src/function.ts` — Neon Functions runtime (`export default app`);
    deployed via the esbuild bundle + zip in `scripts/neon-deploy.mjs`.
- **Migrations**: `apps/api/drizzle/`; applied on boot by `db/bootstrap.ts`
  (`migrate()`) — idempotent. Run `cd apps/api && npx drizzle-kit generate
  --name <name>` for schema changes.
- **Free-tier gates**: R2 usage check + per-user upload quota live in the
  audio-URL route.
- **Tests**: `test/` (vitest). Covers smoke + timezone helpers.

### Adding env vars

1. Add to the Zod schema in `apps/api/src/env.ts` (with default where sane).
2. Add to `.env.example` with a comment.
3. If needed by the deployed function, ensure it's forwarded by
   `scripts/neon-deploy.mjs` (the `environment` JSON) and optionally added to
   `scripts/push-secrets-to-github.sh`.

## Web (apps/web)

- **Stack**: React 19 + Vite 6 + Tailwind 4 (`@tailwindcss/vite`),
  `vite-plugin-pwa` (injectManifest, `src/sw.ts`), Dexie (`src/lib/db.ts`),
  sync engine (`src/lib/sync.ts`), Better Auth client (`src/lib/auth.tsx`).
- **Routing**: `react-router-dom`; screens under `src/features/*`.
- **Styling**: Tailwind v4 with design tokens in `src/index.css`; UI primitives
  in `src/components/ui/`.
- **Env**: Vite reads the **root** `.env.local` (via `envDir`). Only `VITE_*`
  vars reach the client.
- **Deploy**: static build → Vercel; `/api/*` is proxied by
  `middleware.ts` at the edge using `WILLOW_API_URL`. No Vercel serverless
  functions — keep it that way (free tier + no usage billing).

## Docs & process

- **README.md** — user-facing overview (Readest-style: features, screenshots,
  getting started, docs, troubleshooting). Keep it high-level.
- **ARCHITECTURE.md** — the deep dive. Update it when data flow / deployment
  changes meaningfully.
- **docs/** — per-service wikis. Each service page: what it is, how it's
  hosted, config, deploy, manage, troubleshoot.
- **CONTRIBUTING.md** — first-run + DB workflow guidance.
- **Workflow conventions**:
  - Branch per feature: `feature/<short-name>`.
  - PRs run `ci.yml` (typecheck + tests). `deploy.yml` runs on push to `main`.
  - Keep deploy concerns in `.github/workflows/deploy.yml`; add service-level
    docs rather than bloating the README.

## CI/CD

| Workflow | When | Purpose |
|---|---|---|
| `ci.yml` | PR + push to main | `npm ci` → typecheck → test (cheap gate) |
| `deploy.yml` | push to main | test → deploy API (Neon) → deploy web (Vercel) → sync cron var → smoke → tag |
| `cron.yml` | schedule | evening reminder / weekly digest / audio retention |

Deploy secrets/vars: see `docs/ci-cd-github-actions.md`. One-time local setup:
`bash scripts/push-secrets-to-github.sh` (reads `.env.local`, pushes via `gh`).
