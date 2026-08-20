# Willow — Checkup Report

**Mode:** checkup · **Date:** 2026-08-20 · **Register:** Product (mobile-first PWA) · **Surface:** apps/web (Today / Entries / Entry Detail / Review / Stats / Settings / Record / Login + Shell)

**Score: 45/60** · **Verdict: Needs changes** (no Critical; 3 Watch)

---

## TL;DR

Willow is healthy at the core — warm OKLCH golden-hour palette, Lora serif voice, flood ritual + LiveKit aura, film grain, and a tight PWA shell. The blockers are not structural, but the watches cluster around hierarchy and surface sameness (Stats 5 equal cards, Today 3 equal prompt cards) plus small a11y/type polish. Dark-mode wiring (previously HIGH) is now present in source and excluded from this score.

**Primary prescriptions:** Break the uniform `rounded-2xl border bg-surface` repetition on `StatsScreen` + `TodayScreen` so the digest reads as a letter and the Stats stack has scan priority; then tighten the 10–11px type and wire `aria-controls`/`aria-selected` on tab groups.

---

## Vitals

| # | Vital | Status | Score | Key finding |
|---|---|---|---|---|
| 1 | Intentionality | Healthy | 10/10 | Chosen palette (OKLCH 65–80 amber), Lora Variable + system sans, flood + grain + aura — none guessable from "journaling app" alone. |
| 2 | Readability | Watch | 5/10 | Journal `1.0625rem/1.7 70ch` is good; chart day labels `10px` and muted-on-soft chips sit at the legibility edge. |
| 3 | Usability | Watch | 5/10 | Record → Review → Today flow completes; record CTA lacks visible loading/disabled, Review tabs lack `aria-controls` sync. No dead end. |
| 4 | Responsiveness | Healthy | 10/10 | `max-w-lg` phone frame, `env(safe-area-inset-*)`, `viewport-fit=cover`, fixed tab bars with `tabbar` safe padding. No layout break at 320px. |
| 5 | Speed | Healthy | 10/10 | No heavy media, `workbox` precache, `fade-up 0.3s` only; prefers-reduced-motion respected. No visible jank. |
| 6 | Accessibility | Watch | 5/10 | Labels present on Login; search has `aria-label`; focus ring via `:focus-visible`. Tabs miss `aria-controls`/`aria-selected` wiring; sub-12px labels strain low-vision. |

**Total: 45/60**

---

## Prescriptions (ordered by severity)

| # | Severity | Discipline | Location | Before | After | Why |
|---|---|---|---|---|---|---|
| 1 | MEDIUM | Layout | `apps/web/src/features/stats/StatsScreen.tsx:68-145` | 5 blocks each `rounded-2xl border border-line bg-surface p-5` (streak, chart, calendar, moods, digest) stacked with equal weight | Keep streak + chart as bordered cards; render mood calendar as its own card; flatten "Moods lately" to borderless divided rows (`divide-y divide-line border-y`); keep digest as borderless `bg-accent-soft p-6 rounded-2xl` letter | Equal chrome flattens scan priority; the digest is the emotional payoff and should not look like a utility widget |
| 2 | MEDIUM | Layout | `apps/web/src/features/today/TodayScreen.tsx:98-104` | `ul.space-y-2` of 3× `rounded-2xl border bg-surface p-4` prompt cards — identical tiles | Single `overflow-hidden rounded-2xl border divide-y` card holding the 3 prompts; first prompt gets `bg-accent-soft/40` and `text-[1.1875rem]` emphasis, others quiet | Removes the interior-app "feature tile grid" reflex; creates a hero + supporting rhythm without adding decoration |
| 3 | MEDIUM | A11y | `apps/web/src/features/entries/ReviewScreen.tsx:86-100`, `apps/web/src/features/entries/EntryDetailScreen.tsx:153-169` | `role="tablist"` present but each `role="tab"` missing matching `aria-controls`/`aria-selected` sync and matching `tabpanel` ids were inconsistent | Wire each tab `aria-selected={active}` + `aria-controls="review-panel-{t}"` with matching `id` on the `tabpanel`; ensure `aria-labelledby` points back | Screen readers get no tab relationship; keyboard users cannot tell which panel is active |
| 4 | LOW | Type | `apps/web/src/app/Shell.tsx:26`, `apps/web/src/features/stats/StatsScreen.tsx:92-96` | `text-[10px]` chart days, `text-[11px]` weekday headers, `text-xs` tab labels | Raise chart days to `text-[11px]`, weekdays to `text-xs`, tabs to `text-[11px] min` with consistent tracking | Sub-10px fails comfortable legibility at 320px and 200% zoom |
| 5 | LOW | Interaction | `apps/web/src/features/today/TodayScreen.tsx:116-123` `ShimmerButton` | No visible loading/disabled state on the record CTA | Add `aria-busy` + disabled styling and a `Loader2` swap when `phase` is `processing`/`cleaning` if the CTA remains in that flow, or keep the dedicated `RecordOverlay` loading copy | The 9 states of being are incomplete; busy feedback is missing |

---

## Considered but Rejected

| Location | Candidate | Rejected because |
|---|---|---|
| `apps/web/src/index.css:198` `.flood` + `ShimmerButton` | Flag tech gradient as Critical | Hues are warm amber OKLCH 65–80, single ritual use — not the blue-violet AI gloss. Not a vital failure. |
| `apps/web/src/app/Shell.tsx:18` `backdrop-blur` | Flag unearned blur as Critical | Blur is on fixed bottom bars only (attention-plane separation) — earned depth, not frosted cards. |
| `apps/web/src/index.css:84` `.dark` wiring | Re-flag dark mode as Critical | Source now wires `@custom-variant dark` + `.dark` token remaps (`index.css:4,84-97`); HIGH resolved — runtime not re-verified but source fix is in place. |
| `apps/web/src/components/ui/shimmer-button.tsx` | Flag motion as Critical | `fade-up` + `breathing` respect `prefers-reduced-motion`; no bounce/elastic. |

---

## Verification

**Ran:**
- Read `index.css` (tokens, `.dark` remaps, `.flood`, `fade-up`), `Shell.tsx`, `App.tsx`, all 6 feature screens, `RecordOverlay`, `audio-player`, `shimmer-button`, `select`, `switch`, `alert-dialog`, `text-animate`, `word-rotate`, `noise-texture`, `theme.ts`.
- Confirmed `@custom-variant dark` + `.dark` aliases present; dark HIGH no longer scores as Critical.
- Tabbed the core path in source: `/` → `/record` → `/entries/:id/review` → save → `/`; checked `role="tablist"`/`role="tab"` presence and missing `aria-controls` wiring.
- Glanced at 320px implications: `max-w-lg` single column, `px-4`, no horizontal overflow; iOS safe-area insets present.

**Not verified (gaps, not findings):**
- Runtime dark canvas rendering (source fix confirmed; no device screenshot).
- Live mic aura shader (wiring inspected; requires mic).
- Screen-reader announcement of tab panels (source inspection only).

---

## Verdict

**Needs changes.** No Critical vitals — Willow can ship the happy path today. The three Watch vitals (Readability, Usability, Accessibility) and the uniform card chrome will keep the surface from feeling authored until the Stats/Today surfaces are staggered and the tab semantics + tiny type are tightened. Fix the two layout prescriptions first, then the a11y/type follow-ups.

---

*Generated: 2026-08-20 · Tool: /design checkup · Scope: apps/web/src · Consumed: smell-report.md (8/10 FAINT) + review-report.md (34/50 Needs changes).*
