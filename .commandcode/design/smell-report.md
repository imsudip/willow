# Willow — Smell Report

**Mode:** smell · **Date:** 2026-08-20 · **Register:** Product (mobile-first PWA) · **Surface:** apps/web (Today / Entries / Entry Detail / Review / Stats / Settings / Record / Login + Shell)

**Score: 8/10 — FAINT** · **Verdict: Needs changes** (no HIGH; 1 LOW systemic tell + 1 watch)

---

## TL;DR

Willow reads as authored, not generated. A warm OKLCH golden-hour palette, Lora serif journal voice, flood gradient ritual, LiveKit aura tied to real mic volume, and film-grain noise give it a point of view that survives the 2-second sniff test. No blue-violet tech gradient, no generic tech hue, no unearned glass, no stat monument, no icon toppers, no bounce, no default type. One systemic tell remains: uniform `rounded-2xl border bg-surface` card chrome repeats until hierarchy flattens — the app interior form of the feature-tile grid.

**Primary next step:** Run `/design deslop` or `/design relayout` on `StatsScreen` and `TodayScreen` prompts — keep 1–2 stat cards, let the weekly digest read as a letter on `bg-accent-soft` without a border, and stagger the remaining surfaces. No recolor needed.

---

## Heuristic Scores

| # | Odor | Score | Key finding |
|---|---|---|---|
| 1 | Tech gradient | 1 | Absent — flood and shimmer are amber/gold OKLCH 65–80, not indigo/cyan; limited to the record ritual + one CTA. |
| 2 | Generic tech hue | 1 | Absent — accent is `oklch(0.72 0.15 65)` amber and `oklch(0.62 0.16 60)` strong; no blue-violet identity. |
| 3 | Feature tile grid | 0 | **Present (faint)** — `StatsScreen` 5 equal `rounded-2xl border bg-surface p-5` cards + `TodayScreen` 3 equal prompt cards; every tile equal, nothing prioritized. |
| 4 | Accent rail | 1 | Absent — no left-stripe decoration on cards or callouts. |
| 5 | Unearned blur | 1 | Absent — `backdrop-blur` only on fixed tab bars (`Shell` + `Review` bottom bar) for depth separation, not on frosted cards. |
| 6 | Stat monument | 1 | Absent — streak is `text-3xl`, bar chart is restrained; numbers serve the story, not a hero. |
| 7 | Icon topper | 1 | Absent — `Flame`/`TrendingUp` are inline with text, not rounded-square toppers above headings. |
| 8 | Bounce everywhere | 1 | Absent — `fade-up 0.3s ease-out` + `breathing` wave-bars; `WordRotate`/`TextAnimate` use `easeOut`; respects `prefers-reduced-motion`. |
| 9 | Default type | 1 | Absent — `Lora Variable` serif for journal headings + system sans for chrome; variable 400–700 available, measure 70ch. |
| 10 | Center stack | 1 | Absent — `max-w-lg mx-auto` is a phone-portrait product container (PWA), not a safe-middle landing hero; all screens left-align headings. |

**Heuristic total: 9/10 odors absent.** Overall smell score **8/10 — FAINT** (1 confirmed faint tell).

---

## Findings

| # | Severity | Discipline | Location | Before | After | Why |
|---|---|---|---|---|---|---|
| 1 | LOW | Layout | `apps/web/src/features/stats/StatsScreen.tsx:68-145`, `apps/web/src/features/today/TodayScreen.tsx:98-104` | Every block is `rounded-2xl border border-line bg-surface p-4/p-5`: streak, 14-day chart, mood calendar, moods-lately, digest (plus 3 prompt cards on Today) — same chrome, same weight, stacked | Keep streak + chart as bordered cards; render digest as a borderless `bg-accent-soft p-6` letter; group moods-lately as inline rows without a card shell; on Today, replace the 3 equal prompt cards with 1 hero prompt + 2 quiet text prompts or a single "A place to start" card with stacked prompts separated by `border-t` dividers | Cards signal an unchosen layout — when every section is the same tile, the scan path has no priority; the digest is the emotional payoff and should not look like the utility widgets around it. This is the interior-app mirror of the feature-tile grid reflex. Faint because the cards carry real, differentiated data — the smell is repetition, not empty marketing tiles. |

---

## Considered but Rejected

| Location | Candidate | Rejected because |
|---|---|---|
| `apps/web/src/index.css:198-209` `.flood` + `ShimmerButton.tsx:50-51` | Flag tech gradient / tech hue for the amber flood + conic shimmer | Hues are OKLCH 65–80 warm amber (`#d99a3d` → `#b87a2a`, shimmer `#ffe9c9`), not blue-violet/indigo; shimmer is confined to the single record CTA and the flood to the record ritual — both project-specific decisions, not generic AI gloss. Replacing them with a different warm gloss would trade one decoration for another. |
| `apps/web/src/app/Shell.tsx:18`, `apps/web/src/features/entries/ReviewScreen.tsx:186` `bg-canvas/90 backdrop-blur` | Flag unearned blur | Blur lives on fixed bottom bars (tab bar + review action bar) to separate the attention plane from the content plane — earned depth per the 3-plane model, not a frosted-card material. No glass panels on cards. |
| `apps/web/src/features/stats/StatsScreen.tsx:69-74` streak + `StatsScreen.tsx:82-85` bars | Flag stat monument | Numbers are `text-3xl` and `h-24` bars with restrained `max 80px` height — warm and modest, not a hero monument filling space. |
| `apps/web/src/components/ui/shimmer-button.tsx`, `apps/web/src/components/ui/text-animate.tsx`, `apps/web/src/components/ui/word-rotate.tsx` | Flag default type / generic motion / bounce | Type is chosen (Lora Variable + system sans, `journal` 70ch measure) not default Inter; motion is `easeOut`/`ease-in-out` discretely used on greeting + aura + capture phrases, with `prefers-reduced-motion` disabling both custom animations. No elastic/bounce. |
| `apps/web/src/app/Shell.tsx:13` `max-w-lg mx-auto` + `RecordOverlay.tsx:154` `fixed inset-0 flood` | Flag center stack | `max-w-lg` is the product frame for a phone-first PWA (optimal thumb reach, one-column journal), not a landing-page safe-middle fallback. Record is intentionally centered as a ritual; every other screen left-aligns headings and entries. |
| `apps/web/src/index.css:34-46` palette | Flag domain default trap (cream journal = health/teal reflex) | Cream `oklch(0.96)` canvas alone would be the domain default, but the identity commits to amber OKLCH, serif voice, noise grain, and a LiveKit-driven aura — specific material choices that cannot be guessed from "journaling app" alone. |

---

## Verification

**Ran:**
- Read `apps/web/src/index.css` (tokens + `.flood` + `fade-up`/`breathe`), `Shell.tsx`, `App.tsx`, `theme.ts`, `index.html`, all 6 feature screens (`TodayScreen`, `EntriesScreen`, `EntryDetailScreen`, `ReviewScreen`, `StatsScreen`, `MoodCalendar`, `SettingsScreen`, `LoginScreen`), `RecordOverlay`, `audio-player`, `shimmer-button`, `select`, `switch`, `checkbox`, `alert-dialog`, `text-animate`, `word-rotate`, `noise-texture`, `package.json`.
- Confirmed palette is OKLCH amber 60–80, not blue-violet; shimmer `#ffe9c9` on `#d99a3d/#b87a2a`.
- Confirmed no `Accent rail` left-border, no `Icon topper` rounded-square pattern, no `Stat monument` hero numbers, no frosted-glass cards, no elastic bounce.
- Confirmed `Lora Variable` ships 400–700 and `journal` uses `font-serif 1.0625rem/1.7 70ch`; `prefers-reduced-motion` disables `wave-bar` + `fade-up`.
- Confirmed `Shell` tab bar and `Review` bottom bar are the only `backdrop-blur` surfaces (both fixed bars; earned depth).
- Counted identical card chrome: `StatsScreen` 5× `rounded-2xl border border-line bg-surface p-5` + Today 3× prompt cards.

**Not verified (gaps, not findings):**
- Live aura Shader rendering and mic-volume mapping — inspected wiring only (`recorder.liveKitTrack` → `AgentAudioVisualizerAura` `color="#ff8c42"`), requires mic.
- Whether Tailwind `bg-canvas/90` opacity appears as intended in a built preview — source shows intent, rendered screenshot not captured this pass.
- Dark-mode token flip in a running build — `index.css` now wires `dark:` aliases (`:69-93`), but rendered dark canvas not exercised (review report's HIGH is resolved in source; runtime not verified).

---

## Verdict

**Needs changes — faint smell, no blockers.** Willow has a strong, project-specific identity and avoids the clustered AI tells that trigger identity failure. The single systemic smell is uniform card chrome flattening the Stats and Today hierarchy — a LOW layout deslop, not a rebrand. Fix the card surface hierarchy and the surface is **Clean**.

**Next modes:** `/design deslop` (targeted card-surface pass on `StatsScreen` + `TodayScreen`), then `/design refine` if the team wants to push the golden-hour lane further. No `/design recolor` needed — palette is already a decision.

---

*Generated: 2026-08-20 · Tool: /design smell · Scope: `apps/web/src` · Review report consumed: `.commandcode/design/review-report.md` (34/50 Needs changes — HIGH dark-mode wiring verified fixed in source this pass).*
