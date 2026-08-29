# AGENTS.md — Willow agent & contributor guide

> This file is the **agent start** for AI coding agents and a concise orientation
> for humans. Read this first. For the app overview see [README.md](README.md),
> for architecture deep-dives see [ARCHITECTURE.md](ARCHITECTURE.md), and for
> per-service operations see the [docs/](docs/README.md) wikis.

## Repo layout

```text
apps/
  web/     Next.js app (App Router) — the whole app: client SPA + /api Route
           Handlers (Postgres/Drizzle via neon-http, Better Auth, OpenAI, R2,
           Web Push). Tailwind 4, Dexie, Serwist service worker.
packages/
  shared/  Zod schemas + constants shared by the app (built first)
docs/      per-service wikis (API+Neon, Vercel, R2, GitHub Actions, OpenAI)
scripts/   one-shot tooling (env sync, secret push)
.github/
  workflows/  ci.yml (gate), deploy.yml (pipeline), cron.yml (scheduled jobs)
```

Monorepo is npm **workspaces**. `@willow/shared` must be **built** before
`apps/web` typecheck/build (it imports the package's `dist`).

> There is no separate `apps/api` — the API is the Next.js Route Handlers in
> `apps/web/src/app/api/*`.

## Golden rules

1. **Secrets never in code, logs, or chat.** Server-side env vars live only in
   the gitignored `.env.local`, GitHub Actions secrets, and Vercel project env.
   Only `NEXT_PUBLIC_*` vars reach the client — never put secrets there.
2. **One env file.** The repo uses a single root `.env.local` (template
   `.env.example`). The app loads it via `apps/web/src/lib/env-load.ts`
   (called from `next.config.ts`); drizzle-kit reads it via
   `apps/web/drizzle.config.ts`. In prod, the same values are Vercel project
   env + GitHub secrets. Do not add per-app `.env` files.
3. **Migrations, not `drizzle-kit push` in prod.** Schema changes are committed
   as migrations in `apps/web/drizzle/` and applied by the `deploy.yml`
   pipeline (`drizzle-kit migrate` against Neon before build). Only
   `drizzle-kit push` for **local** convenience.
4. **Don't commit to `main` directly.** Work on a feature branch, open a PR.
   The `Deploy` pipeline runs on push to `main` — a direct push deploys prod.
5. **Server-only OpenAI.** Route Handlers make every model call; the key never
   reaches the client. Audio is uploaded to R2 via presigned URLs, never
   through the app.
6. **Free-tier discipline.** Keep changes within the free tiers: Neon Postgres
   (100 CU-hrs), R2 (10 GB), Vercel, GitHub Actions minutes. Guardrails
   (`R2_STORAGE_LIMIT_BYTES`, `MAX_UPLOADS_PER_USER_PER_DAY`) protect R2.
7. **Path A (client-rendered SPA + Next server).** Willow is offline-first and
   will later wrap into a native app — keep the browser-rendered SPA + Dexie as
   the source of truth. Don't add SSR/RSC screen rendering. See
   `docs/migration-nextjs.md`.

## Commands

```bash
npm ci                          # install (use this over npm install for CI parity)
npm run build                   # shared → web (Next build; uses webpack for Serwist)
npm run typecheck               # all workspaces
npm test                        # shared tests (vitest)
npm run dev                     # Next dev server :3000 (serves SPA + /api)
npm run test -w @willow/web     # web unit tests (vitest)
npm run migrate -w @willow/web  # apply Drizzle migrations to Neon
npm run vapid -w @willow/web    # generate VAPID keys into .env.local
```

> **No ESLint config exists** in the repo, so there is no `npm run lint` yet.
> CI gates are `typecheck` + `test` only. If you wire up ESLint, add it back to
> `.github/workflows/ci.yml` and `deploy.yml`.
>
> The Next build uses **webpack** (`next build --webpack`) because Serwist
> (`@serwist/next`) doesn't support Turbopack yet.

## Environment

Everything is driven by one file:

```bash
cp .env.example .env.local   # then fill in values
```

- **`apps/web/src/lib/env.ts`** — Zod-validated env schema (authoritative list).
- **`apps/web/src/lib/env-load.ts`** — loads `.env.local` from the repo root
  (called from `next.config.ts`).
- **`.env.example`** — annotated template covering every service.

CI/deploy secrets come from GitHub Actions (populated by
`scripts/push-secrets-to-github.sh`). Vercel project env is set in the Vercel
dashboard (see `docs/frontend-vercel.md`).

### Adding env vars

1. Add to the Zod schema in `apps/web/src/lib/env.ts` (with default where sane).
2. Add to `.env.example` with a comment.
3. If server-side: set it in the **Vercel project env**; if CI needs it, add it
   to `scripts/push-secrets-to-github.sh`. If client-visible (rare — only
   `NEXT_PUBLIC_*`), prefix with `NEXT_PUBLIC_`.

## App (apps/web)

- **Stack**: Next.js 16 (App Router) + React 19 + Tailwind 4 + Serwist.
- **Server (API)**: Route Handlers in `src/app/api/*` — auth
  (`src/lib/auth-server.ts` + `[...all]/route.ts`), entries/sync/audio,
  prompts, digest, push, transcribe, cron, health. Shared server logic in
  `src/lib/` (db, r2, env, timezone, services/*).
- **Database**: Drizzle + `drizzle-orm/neon-http` (`src/lib/db/index.ts`,
  `globalThis` singleton), schema in `src/lib/db/schema.ts`, migrations in
  `drizzle/`.
- **Client (SPA)**: client-rendered SPA served by the catch-all
  `src/app/[[...slug]]/page.tsx` (client-only mount — no SSR). Routing via
  `react-router-dom`, screens under `src/features/*`. Dexie (`src/lib/db.ts`),
  sync engine (`src/lib/sync.ts`), Better Auth client (`src/lib/auth.tsx`).
- **Service worker**: Serwist (`src/app/sw.ts` → `public/sw.js`).
- **Styling**: Tailwind v4 with design tokens in `src/index.css`; UI primitives
  in `src/components/ui/`.
- **Env**: `NEXT_PUBLIC_*` vars reach the client (only
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` today).
- **Tests**: `test/` (vitest) — timezone unit tests; API flows are validated
  via browser E2E (Next Route Handlers need the request scope).
- **Deploy**: single Vercel deploy (SPA + API + auth + cron endpoints all in
  one project). No proxy, no separate API host.

## Docs & process

- **README.md** — user-facing overview (Readest-style: features, screenshots,
  getting started, docs, troubleshooting). Keep it high-level.
- **ARCHITECTURE.md** — the deep dive. Update it when data flow / deployment
  changes meaningfully.
- **docs/** — the **source of truth** for per-service docs. Each service page:
  what it is, how it's hosted, config, deploy, manage, troubleshoot.
- **GitHub Wiki** — a **public mirror** of `docs/` (see
  `scripts/sync-wiki.sh`). The README links to the wiki, not to `docs/*.md`.
- **CONTRIBUTING.md** — first-run + DB workflow guidance.
- **Workflow conventions**:
  - Branch per feature: `feature/<short-name>`.
  - PRs run `ci.yml` (typecheck + tests). `deploy.yml` runs on push to `main`.
  - Keep deploy concerns in `.github/workflows/deploy.yml`; add service-level
    docs rather than bloating the README.

### Keeping everything in sync (IMPORTANT)

When you make **any** change, update **all** the places it touches. Ask
yourself, for each file below, "does this change?":

| Change type | `docs/*.md` | Wiki | `README.md` | `.env.example` | `AGENTS.md` / `ARCHITECTURE.md` |
| --- | --- | --- | --- | --- | --- |
| New/removed env var | ✅ (env page) | ✅ | — | ✅ | ✅ if it's architecture-relevant |
| New API route / service | ✅ (service page) | ✅ | — | — | ✅ if data flow changes |
| New feature / screen | — | ✅ | ✅ (features/screenshots) | — | — |
| Deploy/CI change | ✅ (CI page) | ✅ | — | — | ✅ |
| Config default change | ✅ | ✅ | — | ✅ | — |

**Process:**
1. Edit the `docs/*.md` source files first (they're the canonical copy).
2. Re-mirror the wiki: `bash scripts/sync-wiki.sh` (copies `docs/` → wiki repo,
   rewrites links, pushes). 
3. Update `README.md` / `.env.example` / `ARCHITECTURE.md` if the row says so.
4. If you're a contributor without wiki push access, note in the PR description:
   `[ ] wiki re-mirrored (or needs re-mirror after merge)`.

> The wiki is a **copy**, not the source. Never edit the wiki repo directly for
> content — edit `docs/` and re-mirror.

## CI/CD

| Workflow | When | Purpose |
|---|---|---|
| `ci.yml` | PR + push to main | `npm ci` → typecheck → test (cheap gate) |
| `deploy.yml` | push to main | test → migrate Neon (via `DATABASE_URL`) → deploy the single Next.js app to Vercel → smoke → tag |
| `cron.yml` | schedule | evening reminder / weekly digest / audio retention |

Deploy secrets/vars: see `docs/ci-cd-github-actions.md`. One-time local setup:
`bash scripts/push-secrets-to-github.sh` (reads `.env.local`, pushes via `gh`).
