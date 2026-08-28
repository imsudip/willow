# Wiki — Frontend & Vercel

> Part of the [Willow docs](../README.md#documentation). See also
> [Architecture](../ARCHITECTURE.md) for the big-picture flow.

## What this is

The **web app** (`apps/web`) is a mobile-first **React + Vite PWA** — a warm,
"golden hour" journaling UI. It's a fully static build served by **Vercel**:

- Vite + React 19 + Tailwind 4
- PWA via `vite-plugin-pwa` (injectManifest, `src/sw.ts`) — offline-first
- Offline sync via **IndexedDB (Dexie)** and a background sync engine
  (`apps/web/src/lib/db.ts`, `sync.ts`)
- Audio recorded in the browser, uploaded straight to R2 via presigned URLs

## How it's hosted

| Piece | Host | Why |
|---|---|---|
| Frontend (Vite PWA) | **Vercel** (static) | Free, no cold starts, 126 PoPs |

Because the frontend is **static**, it has no Vercel serverless functions — so
there's no usage billing, and deploys are immutable (instant rollback).

### SPA fallback + API proxy

- `apps/web/vercel.json` rewrites all non-API routes to `index.html` (SPA
  fallback) and disables caching on `sw.js` so PWA updates propagate.
- `apps/web/middleware.ts` (Vercel Routing Middleware, Edge runtime) proxies
  `/api/*` to the Neon function URL from the `WILLOW_API_URL` env var — so the
  function URL stays out of the client bundle and the browser never needs CORS.
  (vercel.json can't read env vars, which is why the proxy lives in middleware.)

## Configuration

All values live in the **single root `.env.local`** (template:
[`.env.example`](../.env.example)). Vars relevant to the frontend:

| Var | Where | Notes |
|---|---|---|
| `VITE_VAPID_PUBLIC_KEY` | Vite build-time (via `envDir` → repo root) | Web-push public key baked into the client |
| `WILLOW_API_URL` | **Vercel project env** (not `.env.local`) | Neon function URL the edge middleware proxies to |

> `VITE_*` vars are exposed to the client — **never** put secrets in them.
> `WILLOW_API_URL` is set in the Vercel project dashboard (and injected by the
> `Deploy` workflow at build time), not in `.env.local`.

## Deploying

**Automated** (recommended): push to `main` → `.github/workflows/deploy.yml`
runs `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`
with `WILLOW_API_URL` injected.

**Manual**:

```bash
cd apps/web
vercel link --yes --project willow
vercel build --prod --yes   # builds locally (workspace-aware)
vercel deploy --prebuilt --prod --yes
```

**One-time setup** (only if not using the pipeline):

```bash
# in the Vercel project: Settings → Environment Variables
vercel env add WILLOW_API_URL production   # → the Neon function URL
vercel env add VITE_VAPID_PUBLIC_KEY production
```

## Managing / troubleshooting

- **Rollback**: Vercel keeps every production deployment immutable — roll back
  from the Dashboard with one click (a pointer update, not a rebuild).
- **Preview URLs**: every PR gets a preview URL automatically (skip if you're
  deploying through the pipeline instead).
- **PWA updates**: bump the build (sw.js is served with `no-cache`), and
  clients update on next launch (autoUpdate).
- **API proxy not working** — confirm `WILLOW_API_URL` is set in the Vercel
  project and points at the function's `invocation_url` (get it with
  `neon functions list`; the live one here is `.compute.c-5.us-east-2.aws.neon.tech`).
