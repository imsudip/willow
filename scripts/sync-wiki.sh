#!/usr/bin/env bash
# Mirror Willow's docs/ folder to the GitHub Wiki.
#
# The wiki is a PUBLIC COPY of docs/ (which stays the source of truth for local
# dev, PR review, and versioning). Run this whenever docs/ changes:
#
#   bash scripts/sync-wiki.sh
#
# It clones/pulls the wiki repo, copies each docs page (rewriting relative
# links to wiki-friendly form), preserves the Home/sidebar/footer, and pushes.
#
# Requirements: git + push access to https://github.com/imsudip/willow.wiki.git
# (the wiki must already have at least one page created via the web UI).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WIKI_DIR="${TMPDIR:-/tmp}/willow.wiki"
WIKI_URL="https://github.com/imsudip/willow.wiki.git"
REPO_URL="https://github.com/imsudip/willow"

# Map docs/ source files → wiki page names.
# Order matters for the copy loop; Home/_Sidebar/_Footer are written separately.
declare -A PAGES=(
  [docs/api-database-neon.md]="API-Database-Neon.md"
  [docs/frontend-vercel.md]="Frontend-Vercel.md"
  [docs/audio-storage-r2.md]="Audio-Storage-R2.md"
  [docs/ci-cd-github-actions.md]="CI-CD-GitHub-Actions.md"
  [docs/ai-features-openai.md]="AI-Features-OpenAI.md"
  [docs/environment-secrets.md]="Secrets-and-Environment.md"
)

clone_or_pull() {
  if [ -d "$WIKI_DIR/.git" ]; then
    git -C "$WIKI_DIR" pull --ff-only
  else
    rm -rf "$WIKI_DIR"
    git clone "$WIKI_URL" "$WIKI_DIR"
  fi
}

write_static_pages() {
  # Home (landing page)
  cat > "$WIKI_DIR/Home.md" <<EOF
<div align="center">
  <img src="https://raw.githubusercontent.com/imsudip/willow/main/apps/web/public/icon-512.png" alt="Willow" width="90" />
  <h1>Willow Wiki</h1>
  <p>Voice-first journaling PWA — community documentation.</p>
</div>

Welcome to the **Willow** wiki! Willow is a voice-first journaling PWA that
transcribes your rambles, cleans them up, and stores them as journal entries —
running entirely on free tiers (Vercel + Neon + Cloudflare R2 + GitHub Actions).

This wiki mirrors the [repo docs]($REPO_URL/tree/main/docs) as standalone pages.

## Getting around

- **[Secrets & Environment](Secrets-and-Environment)** — where to get every token/secret
- **[API & Database (Neon)](API-Database-Neon)** — Next.js Route Handlers, Neon, migrations, deploy
- **[Frontend (Vercel)](Frontend-Vercel)** — Next.js PWA, same-origin API, rollback
- **[Audio storage (R2)](Audio-Storage-R2)** — presigned URLs, guardrails
- **[CI/CD & cron (GitHub Actions)](CI-CD-GitHub-Actions)** — pipelines, secrets
- **[AI features (OpenAI)](AI-Features-OpenAI)** — models, cost

## Quick start

\`\`\`bash
npm install
cp .env.example .env.local   # ONE env file for everything
npm run dev                  # Next.js dev server :3000 (SPA + /api)
\`\`\`

See the [README]($REPO_URL#readme) for the full overview, screenshots, and
troubleshooting.
EOF

  # Sidebar
  cat > "$WIKI_DIR/_Sidebar.md" <<EOF
**Willow Wiki**

- [Home](Home)
- [Secrets & Environment](Secrets-and-Environment)
- [API & Database (Neon)](API-Database-Neon)
- [Frontend (Vercel)](Frontend-Vercel)
- [Audio storage (R2)](Audio-Storage-R2)
- [CI/CD & cron (GitHub Actions)](CI-CD-GitHub-Actions)
- [AI features (OpenAI)](AI-Features-OpenAI)

---

**[Main repo]($REPO_URL)** · [README]($REPO_URL#readme)
EOF

  # Footer
  cat > "$WIKI_DIR/_Footer.md" <<EOF
---
*Willow Wiki — a [Willow]($REPO_URL) community project. Questions? Open a [discussion]($REPO_URL/discussions).*
EOF
}

copy_pages() {
  local src dst
  for src in "${!PAGES[@]}"; do
    dst="${PAGES[$src]}"
    [ -f "$REPO_ROOT/$src" ] || { echo "⚠️ missing $src (skipping)"; continue; }
    cp "$REPO_ROOT/$src" "$WIKI_DIR/$dst"

    # Rewrite repo-relative links to wiki-friendly form.
    # 1) Header blockquote "Part of the [Willow docs](../README.md#documentation)..." → wiki Home
    sed -i 's|^> Part of the \[Willow docs\](\.\./README\.md#documentation)\. This guide tells you|> Part of the [Willow Wiki](Home) — also mirrored in [docs/]('"$REPO_URL"'/tree/main/docs). This guide tells you|' "$WIKI_DIR/$dst"
    sed -i 's|^> Part of the \[Willow docs\](\.\./README\.md#documentation)\. See also|> Part of the [Willow Wiki](Home) — also mirrored in [docs/]('"$REPO_URL"'/tree/main/docs). See also|' "$WIKI_DIR/$dst"
    # 2) Drop the "> [Architecture](../ARCHITECTURE.md) ..." line
    sed -i '/^> \[Architecture\](\.\.\/ARCHITECTURE\.md) for the big-picture flow\.$/d' "$WIKI_DIR/$dst"
    # 3) .env.example relative links → repo URL
    sed -i 's|\[`\.env\.example`\](\.\./\.env\.example)|[`.env.example`]('"$REPO_URL"'/blob/main/.env.example)|g' "$WIKI_DIR/$dst"
    # 4) Any remaining repo-relative md links → point at the repo tree (best-effort)
    sed -i -E 's|\[([^]]*)\]\(\.\./([^)#]*\.md)(#[^)]*)?\)|[\1]('"$REPO_URL"'/blob/main/\2)|g' "$WIKI_DIR/$dst"
  done
}

main() {
  echo "→ Syncing docs/ → wiki…"
  clone_or_pull
  write_static_pages
  copy_pages

  cd "$WIKI_DIR"
  if git status --porcelain | grep -q .; then
    git add -A
    git commit -q -m "chore: sync wiki with docs/

Auto-generated by scripts/sync-wiki.sh (mirrors the repo docs/ folder)."
    git push origin master
    echo "✓ Wiki updated: https://github.com/imsudip/willow/wiki"
  else
    echo "✓ Wiki already up to date."
  fi
}

main
