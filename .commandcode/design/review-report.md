# Willow — Design Review

**Mode:** review · **Date:** 2026-08-20 · **Register:** Product (mobile-first PWA, voice journaling)

**Score: 36/50** · **Verdict: Needs changes**

---

## TL;DR

Willow is a warm, genuinely authored surface: the cream-and-lavender "Observatory" palette, the Lora serif journal voice, and the truthful recording visualizer give it a real point of view. The previous HIGH (broken dark mode) is **fixed** — dark mode now renders as a coherent warm charcoal. The weaknesses that remain are accessibility-driven: muted text fails contrast on the light theme, the fixed review bar clips the tags, and the greeting duplicates itself for screen readers. The `design.md` spec ("Resonate Journal") describes a different system (deep indigo, sans-serif, 20px radius) that the implementation deliberately evolved past; the drift is coherent but undocumented.

**Primary recommendation:** Fix the light-theme `muted` contrast (2.2:1) and the review fixed-bar clip, then run `a11y` for the greeting duplication and form labels.

---

## First Impression

Warm cream, lavender accents, Lora serif — the app reads as a private diary, not a wellness template. The record button with its golden-hour shimmer is the strongest element; the greeting is the second. The mood is calm, private, and consistent with the product promise.

---

## Heuristic Scores

| # | Heuristic | Score | Key finding |
|---|---|---|---|
| 1 | First impression | 8/10 | Warm, authored, memorable. Serif + lavender is a real identity. |
| 2 | Hierarchy | 7/10 | Clear on Today; Stats digest is a letter, not a tile. Calendar and mood trend read well. |
| 3 | Color voice | 7/10 | Palette is disciplined; light `muted`/`warning` fail contrast; dark mode is healthy. |
| 4 | Type voice | 7/10 | Serif voice is strong; muted captions are too low-contrast; tab labels at 12px are borderline. |
| 5 | Interaction feel | 7/10 | Custom player + wave visualizer polished; fixed review bar clips tags; shimmer overlay sits over the mic; `enforceMaxDuration` calls a bare recorder stop that would strand the UI. |

**Total: 36/50**

---

## Cognitive Load / Risk

- **PASS** — Warm, low-contrast, private surface; no autoplay, no parallax, no carousel. `prefers-reduced-motion` disables the two custom animations.
- **WATCH** — Dark mode is now coherent; the light theme's `muted` text (2.2:1) is the main readability risk.
- **FAIL** — Review fixed bottom bar clips the tags at end of scroll; `ShimmerButton` overlay paints over the mic icon.

---

## Design.md Fidelity

The repo root `design.md` ("Resonate Journal") specifies: deep indigo `#331A47` primary, sans-serif type, 20px radius, pale-peach-to-lavender gradient pill CTA, lotus iconography. The implementation ("Willow") uses cream/lavender OKLCH tokens, Lora serif, 16px radius, solid violet pill, no lotus. The drift is a coherent, deliberate evolution (warmth over indigo, serif over sans), but the spec was never updated, so it no longer describes the product. This is not a design flaw in the UI, but a documentation debt that will mislead the next designer.

---

## Primary Flow (record → review → today)

1. **Arrive** — Today greeting + date + prompts. Warm, calm, clear.
2. **Record** — Idle → tap mic → flood gradient + live aura. The aura truthfully reflects the voice.
3. **Review** — Cleaned/raw tabs; polished title + body edit; mood/tags; keep-audio toggle. **The fixed bottom bar clips the tags at the end of scroll** (verified at 1280px: last content bottom 633px vs bar top 554px).
4. **Save** — Returns to Today. The new entry appears.
5. **Failure path** — Mic denied shows an error + Back. Transcription failure shows a message and returns to idle. There is no retry, no cancel during processing, and no way to see the saved-but-untranscribed entry until it's in the list.

---

## Findings

| # | Severity | Discipline | Location | Before | After | Why |
|---|---|---|---|---|---|---|
| 1 | HIGH | A11y | `index.css` `--color-muted: oklch(0.52 0.015 290)`; used across `Shell.tsx:27`, `TodayScreen.tsx:57`, `EntriesScreen.tsx:73`, `StatsScreen.tsx:107` | Light-theme `muted` text is 2.2:1 against canvas — below the 4.5:1 WCAG AA bar for normal text (verified: tab labels, captions, dates, day headings) | Darken `--color-muted` to ~`oklch(0.45 0.015 290)` (≈4.6:1) or raise it to a token with AA contrast on both `canvas` and `surface` | Muted text is the app's primary secondary voice; at 2.2:1 it fails for low-vision users and in sunlight |
| 2 | HIGH | Interaction | `ReviewScreen.tsx:186-203` (fixed bar), container `pb-28` | At end of scroll the tags (`walk ×`, `rain ×`) are clipped behind the fixed Discard/Save bar (verified: tag bottom 633px vs bar top 554px at 1280×633) | Raise the container bottom padding (e.g. `pb-44`) or add `scroll-margin`/`mb` to the last section so the final content clears the bar | Content that cannot be fully seen or tapped is a functional block; the tags are the last interactive element before Save |
| 3 | MEDIUM | A11y | `components/ui/text-animate.tsx:287` + `TodayScreen.tsx:58-66` | The greeting h1 emits `Good evening, Design` twice (sr-only span + animated words) plus an `aria-label` — screen readers announce it twice | Drop the `aria-label` and sr-only span when the visible text is the accessible name, or set `accessible={false}` on the greeting | Duplicated announcements are a screen-reader failure; the snapshot shows the text twice in the a11y tree |
| 4 | MEDIUM | Color | `index.css` `--color-warning: oklch(0.7 0.13 80)`; `TodayScreen.tsx:51` offline banner | Warning text on `warning/10` is 1.6:1 — the offline banner is unreadable against the cream canvas | Darken the warning token (e.g. `oklch(0.55 0.12 70)` ≈4.5:1) or use a darker text-on-tint treatment | The offline banner is the only status the user sees when sync breaks; it must be legible |
| 5 | MEDIUM | Interaction | `lib/audio.ts:108-112` + `RecordOverlay.tsx:70` | `enforceMaxDuration` calls `recorder.stop()` directly after 10 min — the overlay stays in "recording" phase with no `onstop` handler, so the UI strands (no navigate, no phase change, no entry saved) | Route the max-duration stop through the same `stop()` flow that transitions to processing/saves the entry | A 10-minute recording is the realistic ceiling; the current path leaves the user stuck on the record screen with no way out |
| 6 | MEDIUM | Surface | `components/ui/shimmer-button.tsx:55-63` | The inner overlay (`absolute inset-0 size-full`) paints after the mic SVG and sits on top of it (verified: overlay z-auto after svg in DOM, same center) — the subtle inset shadow washes over the icon | Move the overlay before the `{children}` in DOM, or add `relative z-10` to the children | The record CTA is the product's hero control; its icon should not be under a translucent overlay |
| 7 | LOW | A11y | `EntriesScreen.tsx:42-47` search, `LoginScreen.tsx:39-65` | Login inputs have real `<label>`s (good), but the search input uses `placeholder` as its only visible name and has no visible label | The search has an `aria-label="Search entries"` already; add a visible label or `aria-labelledby` when space allows | Placeholder is not a label; screen-reader users get the aria-label, but sighted users see only placeholder |
| 8 | LOW | Type | `Shell.tsx:26` tab labels, `EntriesScreen.tsx:73` day headings, `StatsScreen.tsx:80` chart labels | Sub-12px text and muted gray at 2.2:1 | Raise to 12px minimum and fix the muted token; the contrast fix covers the day headings | Small + low-contrast text is the hardest to read; the token fix is the higher-leverage move |

---

## Considered but Rejected

| Location | Candidate | Rejected because |
|---|---|---|
| `design.md` | Adopt the spec's indigo/sans/20px system | The implementation's cream-lavender-serif is warmer and more distinctive; the spec is stale, not the UI |
| `StatsScreen.tsx` bar chart | Replace with a line chart | The bar chart is clear and honest for a 14-day span |
| `MoodCalendar.tsx` | Add emoji icons to the mood legend | Emojis would break the warm, quiet voice; color + text labels already carry meaning |
| `ShimmerButton` | Remove the shimmer entirely | The shimmer is the golden-hour signature; keep it, fix the overlay order instead |
| `RecordOverlay` live aura | Replace with a static waveform | The truthful voice-reactive aura is the strongest interaction in the app |

---

## Verification

**Ran:**
- Walked the live app in a browser: login → signup → Today → record overlay (idle) → Entries → Stats → Settings → dark mode → synthetic entry detail/review → back to Today.
- Confirmed dark mode now flips `html.dark` and tokens render warm charcoal (`oklch(0.19 0.015 295)` bg, `oklch(0.93)` ink) — the prior HIGH is resolved.
- Measured contrast ratios from the actual OKLCH tokens: `muted` 2.2:1 on canvas, `warning` 1.6:1, `accent-strong`-as-text 1.9:1, dark-mode `muted` 5.3:1 (passes).
- Measured review-screen clipping: last content bottom 633px vs fixed bar top 554px at 1280×633.
- Inspected the shimmer overlay: absolute div after the mic SVG, same center, z-auto → paints over the icon.
- Verified greeting h1 DOM: `Good evening, Design` appears twice (sr-only + animated) plus an `aria-label`.
- Verified detail/review tabs wire `aria-selected`/`aria-controls` correctly.
- Confirmed `enforceMaxDuration` calls a raw recorder stop with no UI transition (source inspection; not runtime-triggered).

**Not verified:**
- Live recording phase (mic permission not grantable in the headless flow) — the aura, phrase rotation, and stop flow were inspected in source only.
- The `enforceMaxDuration` strand (10-min boundary not reached).
- Dialog focus trap (Radix handles it; not exercised).
- Push notification permission flow (requires a VAPID key / service worker).

---

## Verdict

**Needs changes.** The surface has a strong, warm, authored identity and the core record flow is genuinely good. Dark mode is fixed. The light-theme `muted` contrast, the review fixed-bar clip, and the greeting duplication are the priorities; the max-duration strand and shimmer overlay are focused interaction fixes. Once those land, this is an `Approve`.
