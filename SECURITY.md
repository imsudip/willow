# Security Policy

Willow is a self-hostable, voice-first journaling app that handles **personal
journal entries, audio recordings, authentication cookies, and secrets**. This
document explains how to report security issues and what we support.

## Supported Versions

| Version | Supported |
| --- | --- |
| `main` (latest) | ✅ |
| Tagged releases (`release-*`) | ✅ |
| Older releases | ❌ |

We recommend always running the latest `main` (or the newest tagged release).
Only the current deployment is patched for vulnerabilities.

## Reporting a Vulnerability

**Please do NOT open a public issue for security problems.**

Instead, report privately:

- **GitHub private advisory**: go to the repo →
  [Security](https://github.com/imsudip/willow/security/advisories) →
  *"Report a vulnerability"* (preferred — gives us a private channel + fix
  workflow).
- **Email**: if you need a direct channel, open a private advisory first and
  mention a preferred contact; for this project a direct email address is only
  shared to reporters of confirmed issues.

### What to include

- **Repro**: exact steps (device, browser, web/API/sync area)
- **Impact**: what an attacker could do
- **Affected component**: API, web app, sync engine, or deployment (Neon/Vercel/R2)
- Whether it affects a **self-hosted** or the hosted instance

### Our commitments

- We aim to acknowledge reports within **48 hours**.
- We aim to triage and respond with a fix plan within **7 days**.
- We credit reporters (unless they ask to stay anonymous).

## Scope

**In scope:**

- The API (`apps/api`) — auth, entry/sync endpoints, cron endpoints, R2
  presigned-URL handling
- The web app (`apps/web`) — client-side auth, IndexedDB sync, service worker
- The deployment/CI configuration (`apps/api/scripts/*`, `.github/workflows/*`,
  `scripts/*`) insofar as it could leak secrets or credentials

**Out of scope:**

- The infrastructure providers themselves (Neon, Vercel, Cloudflare R2, OpenAI)
  — report those to the respective vendors
- Dependencies with known CVEs — patch via `npm audit` / dependency bumps; report
  upstream if it's a zero-day

## Responsible Disclosure

We ask that you give us a reasonable window (default **90 days**) to fix and
release before publicly disclosing. We'll coordinate a release date with you.

## Security-relevant config

- **Secrets** (API keys, `AUTH_SECRET`, `CRON_SECRET`, R2 credentials) live only
  in the gitignored `.env.local` and GitHub Actions secrets — never in the repo.
- **`VITE_*` vars are client-visible** — never put secrets there.
- The API **never** receives raw audio through the proxy; uploads go straight to
  R2 via short-lived presigned URLs.
