# Wiki — Frontend & Vercel

> Part of the [Willow docs](../README.md#documentation). See also
> [Architecture](../ARCHITECTURE.md) for the big-picture flow.

## What this is

Willow is a **single Next.js app** (`apps/web`) — a mobile-first, offline-first
**PWA** with a warm "golden hour" journaling UI. It serves both the UI **and**
the API:

- Next.js 16 (App Router) + React 19 + Tailwind 4
- **Client-rendered SPA** served via a catch-all route (offline-first by
  design; no SSR — the browser renders everything, so it works offline)
- PWA via **Serwist** (`@serwist/next`; service worker at `src/app/sw.ts`)
- Offline sync via **IndexedDB (Dexie)** and a background sync engine
  (`apps/web/src/lib/db.ts`, `sync.ts`)
- Audio recorded in the browser, uploaded straight to R2 via presigned URLs
- **API** = the app's Route Handlers (`apps/web/src/app/api/*`) — same origin,
  no proxy, no CORS

## How it's hosted

| Piece | Host | Why |
|---|---|---|
| App (Next.js: UI + API + auth + cron endpoints) | **Vercel** | Free, edge CDN, one deploy |

Because the app is a client-rendered SPA, there's no SSR/render cost on
request; the Route Handlers are the only dynamic functions (serverless).

### Same-origin by design

There is **no `/api` proxy anymore** — the browser calls `/api/*` on the same
origin, and Next.js serves those Route Handlers. No CORS, no edge middleware,
no `WILLOW_API_URL` in the client bundle.

## Configuration

All values live in the **single root `.env.local`** (template:
[`.env.example`](../.env.example)). In production, the same values are set as
**Vercel project env vars**. Only `NEXT_PUBLIC_*` vars reach the client:

| Var | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Vercel project env (client-visible) | Web-push public key baked into the client |
| `DATABASE_URL`, `OPENAI_API_KEY`, `AUTH_SECRET`, `R2_*`, `CRON_SECRET`, `VAPID_*`, `PUBLIC_ORIGIN`, etc. | Vercel project env (server-only) | Server-side secrets; never shipped to the client |

> Only `NEXT_PUBLIC_*` vars are exposed to the browser — **never** put secrets
> in them. Server-only vars stay on the server.

## Deploying

**Automated** (recommended): push to `main` → `.github/workflows/deploy.yml`
runs migrations → `vercel pull` → `vercel build --prod` →
`vercel deploy --prebuilt --prod`.

**Manual**:

```bash
cd apps/web
vercel link --yes --project willow
npm run migrate          # apply Drizzle migrations to Neon (needs DATABASE_URL)
vercel build --prod --yes   # workspace-aware
vercel deploy --prebuilt --prod --yes
```

**One-time setup** (only if not using the pipeline):

```bash
# in the Vercel project: Settings → Environment Variables
vercel env add DATABASE_URL production
vercel env add OPENAI_API_KEY production
# ...all the server vars from .env.example
vercel env add NEXT_PUBLIC_VAPID_PUBLIC_KEY production
```

## Managing / troubleshooting

- **Rollback**: Vercel keeps every production deployment immutable — roll back
  from the Dashboard with one click (a pointer update, not a rebuild).
- **Preview URLs**: every PR gets a preview URL automatically (skip if you're
  deploying through the pipeline instead).
- **PWA updates**: bump the build (sw.js is served with `no-cache`), and
  clients update on next launch.
- **Deep links / hard refresh on `/entries/...`** — the catch-all
  `src/app/[[...slug]]/page.tsx` serves the SPA for every non-API path, so
  client-side routes work on refresh. If a route 404s, make sure it isn't
  colliding with an `/api/*` path.
