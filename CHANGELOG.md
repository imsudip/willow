# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **CI/CD pipeline** (`deploy.yml`): test → deploy API to Neon → deploy web to
  Vercel → re-sync `WILLOW_API_URL` for cron → smoke test → tag release.
- **CI gate** (`ci.yml`): typecheck + tests on every PR and push to `main`.
- **Unified single env file** at the repo root (`.env.example` / `.env.local`)
  serving the API, web build, Neon Functions, GitHub Actions, and Vercel.
- **`scripts/push-secrets-to-github.sh`** — pushes `.env.local` secrets/vars to
  GitHub Actions via `gh` (values masked).
- **`apps/api/scripts/neon-deploy.mjs`** — CI-first Neon Functions deploy
  wrapper (reads env, health-checks `/api/health`).
- **Per-service wikis** under `docs/` (API+Neon, Vercel, R2, GitHub Actions,
  OpenAI) and a docs index.
- **Community files**: `SECURITY.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`,
  `.github/FUNDING.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, issue templates.
- **`AGENTS.md`** — agent start / best-practices guide.
- **README** rewritten in a Readest-style layout (features, planned, screenshots,
  getting started, docs, troubleshooting, support, license).

### Changed
- `cron.yml` uses a unified `CRON_SECRET` (was `WILLOW_CRON_SECRET`).
- README/CONTRIBUTING docs updated to the single `.env.local` flow.

### Removed
- Redundant files no longer used: `design.md`, `new-design.md`, `Dockerfile`,
  `.dockerignore`, `apps/api/scripts/deploy-function.mjs`.
- `apps/api/.env.example` (superseded by the root `.env.example`).
- `.commandcode/` local agent state purged from history.

### Security
- Rotated the `NEON_API_KEY` (old keys revoked) — see SECURITY.md for reporting.
