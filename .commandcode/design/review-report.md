# Willow — Design Review

**Mode:** review · **Date:** 2026-08-20 · **Register:** Product (mobile-first PWA)

**Score: 34/50** · **Verdict: Needs changes**

---

## TL;DR

Willow is a genuinely warm, authored surface. The golden-hour palette, serif journal voice, and truthful recording visualizer give it a real point of view. The weaknesses are structural: the type scale leans on a single weight, card-chrome spreads too thin, dark mode is broken in practice, and the record flow lacks recovery states. The top issue (dark mode) is a `HIGH` that must land before polish.

**Primary recommendation:** Wire the dark-mode tokens into the semantic aliases (`@custom-variant dark` + `.dark` overrides in `index.css`) so Settings → Dark doesn't ship an unreadable canvas, then run `a11y` for the form labels and dialog focus trap.

---

## First Impression

A warm, cream-and-amber diary that feels like golden hour, not a wellness template. The Lora serif on headings and journal text gives it a genuine handwritten-voice quality. The first thing I'd act on is the record button; the second is the Today greeting. The overall mood is calm and private, matching the product's promise.

---

## Heuristic Scores

| # | Heuristic | Score | Key finding |
|---|---|---|---|
| 1 | First impression | 8/10 | Warm, authored, memorable. Serif + amber is a real identity. |
| 2 | Hierarchy | 6/10 | Clear on Today; weak on Stats (equal cards, empty states). |
| 3 | Color voice | 7/10 | Golden palette is disciplined; dark mode is broken; danger/warning use raw reds. |
| 4 | Type voice | 6/10 | Single-weight serif, small body; decent measure; tight tab labels. |
| 5 | Interaction feel | 7/10 | Custom player + wave visualizer are polished; missing recovery/empty/error states in record flow; no focus ring on radio-style toggles. |

**Total: 34/50**

---

## Cognitive Load / Risk

- **PASS** — Warm, low-contrast, private surface; no autoplay, no parallax, no carousel. `prefers-reduced-motion` disables the two custom animations.
- **WATCH** — Text on low-contrast fills (mood chips, disabled calendar, `text-muted` on `bg-accent-soft`).
- **FAIL** — Dark mode is unusable: the semantic palette never flips, so `bg-canvas/90` stays warm-cream with white text, and `text-ink` stays near-black in dark mode.

---

## Primary Flow (record → review → today)

1. **Arrive** — Today greeting + date + prompts. Warm, calm, clear.
2. **Record** — Idle → tap mic → flood gradient + live aura. The aura truthfully reflects the voice. No elapsed-time caption during `processing`/`cleaning` (only "A moment").
3. **Review** — Cleaned/raw tabs; polished title + body edit; mood/tags; keep-audio toggle. The fixed bottom bar overlaps content (no bottom padding on the scroll container).
4. **Save** — Returns to Today. The new entry appears.
5. **Failure path** — Mic denied shows an error + Back. Transcription failure shows a message and returns to idle. But there's no retry, no cancel during processing, and no way to see the saved-but-untranscribed entry until it's in the list.

---

## Findings

| # | Severity | Discipline | Location | Before | After | Why |
|---|---|---|---|---|---|---|
| 1 | HIGH | Color | `apps/web/src/index.css:57-73` (aliases), `Shell.tsx:18`, `RecordOverlay.tsx:154` | Dark mode flips `html.dark`, but `--background`/`--foreground`/`--primary`/`--border` never remap; `bg-canvas/90` stays cream, `text-ink` stays near-black | Add `@custom-variant dark` and `.dark` alias overrides (canvas-dark, surface-dark, ink-dark, etc.) so Settings → Dark renders a readable warm-charcoal canvas | "Dark mode exists" but is unreadable; every dark-mode screen breaks |
| 2 | MEDIUM | Type | `TodayScreen.tsx:63`, `EntriesScreen.tsx:38`, `StatsScreen.tsx:66`, `SettingsScreen.tsx:77`, `EntryDetailScreen.tsx:129` | All page headings are `font-serif text-3xl font-medium` — one size, one weight, repeated 5× | Give the Today greeting a larger display size (text-4xl) and lighter weight (font-normal); keep tab screens at text-2xl | Flat scale reads as uncommitted; the greeting is the one moment that deserves a display voice |
| 3 | MEDIUM | Layout | `StatsScreen.tsx:68-117` | Every stat is a `rounded-2xl border bg-surface p-5` card; streak, chart, calendar, trend, digest all equal weight | Keep streak + chart as cards; let the digest sit on `bg-accent-soft` without a border; tighten the mood list into a two-column grid | Cards signal an unchosen layout; the digest is the emotional payoff and should read as a letter, not a tile |
| 4 | MEDIUM | Color | `RecordOverlay.tsx:167`, `SettingsScreen.tsx:151`, `EntryDetailScreen.tsx:113` | `bg-accent text-white`, `bg-accent-strong text-white`, `bg-night` all use opaque white for the mic/stop/danger glyphs | Use the golden palette for the primary accent (`accent-strong`), and a warm off-white (`oklch(0.98 0.01 80)`) for glyphs on amber; keep `text-white` only for true danger | Two white-on-warm elements read as a hard cut; the warm identity should extend to interactive fills |
| 5 | MEDIUM | A11y | `LoginScreen.tsx:39-65`, `EntriesScreen.tsx:42-47` | Placeholder-only inputs on login and search; no `<label>` | Add real `<label>` elements (visually-hidden where appropriate); search gets an `aria-label="Search entries"` | Placeholder is not a label; screen readers get no name for these fields |
| 6 | LOW | Type | `Shell.tsx:26`, `EntriesScreen.tsx:61`, `StatsScreen.tsx:80` | `text-[11px]` tab labels and `text-[10px]` chart day labels | Raise to 12px minimum (tabs) and 11px (chart), or drop the chart labels and add `aria-label`s | Sub-12px text is hard to read and fails the tap-target scale |
| 7 | LOW | Interaction | `TodayScreen.tsx:116-129`, `ReviewScreen.tsx:86-100` | Record CTA has no visible loading or disabled state; Review tabs lack `aria-controls`/`aria-selected` sync | Add a loading state to the record CTA; wire `role="tablist"` with `aria-controls` and `aria-selected` on both tab groups | The 9 states of being are incomplete; keyboard/screen-reader users get no tab relationship |
| 8 | LOW | Surface | `TodayScreen.tsx:70-93` | "Today's entries" card slices to 3 with a "See all entries →" link; no empty-state illustration | Keep the 3-entry cap, but add a "Today is quiet" empty state with a prompt | Taste preference: dashboard shows latest 3 entries with a link; the empty state should invite the first ramble |

---

## Considered but Rejected

| Location | Candidate | Rejected because |
|---|---|---|
| `index.css` `.flood` | Add a stronger dark-mode flood gradient | Dark-mode tokens don't exist yet; fixing the alias layer first makes this a follow-up |
| `StatsScreen.tsx` bar chart | Replace with a line chart | The bar chart is clear and honest; a line chart adds noise for a 14-day span |
| `MoodCalendar.tsx` | Add emoji icons to mood legend | Emojis would break the warm, quiet voice; color + text labels already carry meaning |
| `ShimmerButton` | Remove the shimmer entirely | The shimmer is the golden-hour signature; keep it, just fix the glyph contrast |
| `EntriesScreen.tsx` | Add pagination | The list is already grouped by day and searchable; pagination adds friction at MVP scale |

---

## Verification

**Ran:**
- Read all 6 screens + Shell + audio player + shimmer button + select/switch/alert-dialog/noise-texture + theme + CSS tokens.
- Confirmed Lora variable font ships 400–700 (`@fontsource-variable/lora`).
- Confirmed `prefers-reduced-motion` disables `wave-bar` + `fade-up`; `animate-in`/`zoom-in` utilities are **not** present in the CSS (tw-animate-css is not installed), so alert-dialog/select open animations are **not verified** — likely no-ops.
- Confirmed no `@custom-variant dark` and no `.dark` alias overrides in `index.css` → dark mode tokens never apply.

**Not verified:**
- `aria-controls`/`aria-selected` wiring on tabs (I inspected source; did not run a screen reader).
- Dialog focus trap behavior (Radix handles it, but I did not exercise it).
- Whether `text-warning`/`text-danger` meet contrast in dark mode (dark mode doesn't render at all today).
- Live recording aura behavior (requires mic; inspected the wiring only).

---

## Verdict

**Needs changes.** The surface has a strong, warm, authored identity and the core record flow is genuinely good. The dark-mode breakage is a `HIGH` that must be fixed before polish, and the type-scale, layout, and form-label findings are focused follow-ups. Once the dark tokens and form labels land, this is an `Approve`.
