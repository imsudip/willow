# Willow

Voice-first journaling PWA. Ramble at the end of the day; the app transcribes, cleans, and stores it as a journal entry.

## Repo

- `apps/web` — React + Vite PWA (mobile-first, warm "golden hour" design)
- `apps/api` — Hono API (SQLite, Better Auth, OpenAI transcription + AI features, Web Push)
- `packages/shared` — Zod schemas, constants, shared types

## Requirements

- Node.js 22+
- An [OpenAI API key](https://platform.openai.com/api-keys) with access to `gpt-4o-mini-transcribe` (transcription) and `gpt-4o-mini` (cleanup/prompts/digest)
- VAPID keys for web push (optional; without them reminders/digests are disabled)

## Run locally (dev)

```bash
npm install

# configure env
cp apps/api/.env.example apps/api/.env
# edit apps/api/.env — set OPENAI_API_KEY (required for transcription)

# optional: generate web-push keys
npm run vapid -w @willow/api

# start both servers
npm run dev            # API on :8777 (hot reload)
npm run dev:web        # web on :5173 (proxies /api → :8777)
```

Open http://localhost:5173 (web) or http://localhost:8777 (API serves the built PWA in prod).

## Run in production

```bash
npm run build          # shared → dist, web → dist, api → dist
npm start              # builds then runs node apps/api/dist/index.js on :8777
```

The API serves the built PWA + `/api/*` from one process. Set `DATA_DIR` (default `./data`) to where SQLite and audio live.

## Deploy

The whole app is one container: **the API serves the built frontend**, so there's nothing else to host (no CDN needed for MVP — though you can put Cloudflare in front later for caching).

```bash
docker build -t willow .
docker run -d --name willow \
  -p 8777:8777 \
  -v willow-data:/data \
  -e OPENAI_API_KEY=sk-... \
  -e VAPID_PUBLIC_KEY=... \
  -e VAPID_PRIVATE_KEY=... \
  -e VAPID_SUBJECT=mailto:you@example.com \
  -e AUTH_SECRET=$(openssl rand -hex 32) \
  willow
```

That's it — `https://your-domain` serves both the app and API. Mount `-v willow-data:/data` so SQLite + audio survive redeploys.

### Where to host

| Option | Notes |
|---|---|
| **Railway** | Easiest — point it at the repo, it detects the Dockerfile, add env vars + a volume mount at `/data`. Auto-deploys on push. |
| **Fly.io** | Great for personal apps — `fly launch`, attach a volume, one small machine. Cheapest for low traffic. |
| **A $5 VPS (DigitalOcean/Hetzner)** | `docker run` it behind Caddy (auto-HTTPS). Most control, ~$5/mo. |
| **Render** | Good free tier; Docker support, disk mounts for `/data`. |

All need: the env vars below + `OPENAI_API_KEY`, and **HTTPS** (required for mic access + PWA install + push).

### Environment reference

| Var | Required | Notes |
|---|---|---|
| `OPENAI_API_KEY` | yes (transcription) | Server-side only; never shipped to the client |
| `AUTH_SECRET` | no | Auto-generated on first run if absent; set it in prod so sessions survive restarts |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | for push | `npm run vapid -w @willow/api` generates them |
| `REMINDER_CRON` | no | Default `30 18 * * *` (18:30) |
| `PUBLIC_ORIGIN` | no | Your deployed origin (e.g. `https://willow.app`); sets auth cookies + trusted origins. Set in prod. |
| `DATA_DIR` | no | Default `./data` — mount a volume here |
| `PORT` | no | Default `8777` |
| `TRANSCRIPTION_MODEL` / `CLEANUP_MODEL` | no | Defaults `gpt-4o-mini-transcribe` / `gpt-4o-mini` |

### Costs

- **Transcription:** ~$0.006/min for `gpt-4o-mini-transcribe` — a 5-min daily ramble ≈ **$1/mo**
- **Cleanup + prompts + digest:** pennies (small token calls, cached daily)
- **Hosting:** $0–5/mo depending on provider

### Push notifications (PWA)

The client subscribes in Settings → Push notifications. For the badge icon, drop a white-on-transparent leaf at `apps/web/public/badge.png` and reference it in `vite.config.ts` + `src/sw.ts`. The service worker precaches everything so the app installs and works offline.

## Scripts

- `npm run dev` — API watch on :8777 (web on :5173 via `npm run dev:web`)
- `npm run build` / `npm run typecheck` / `npm test` — full repo
- `npm run start` — production build + serve
- `npm run vapid -w @willow/api` — generate web-push keys into `.env`
