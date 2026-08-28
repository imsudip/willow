This UI language is basically **calm therapy app + premium journal + soft spirituality**. The design is doing three things:

1. Warm neutral background instead of pure white.
2. Very soft lavender as the only accent color.
3. Rounded cards with almost no shadows.

## Core Color Palette

### Backgrounds

| Usage                | Color       | Hex       |
| -------------------- | ----------- | --------- |
| Main Background      | Warm Ivory  | `#F7F1EA` |
| Secondary Background | Soft Beige  | `#EFE6DD` |
| Card Background      | Cream White | `#FBF8F4` |
| Elevated Card        | Warm White  | `#FEFCF9` |

### Primary Accent

| Usage            | Color     |
| ---------------- | --------- |
| Primary Lavender | `#C7A9FF` |
| Hover Lavender   | `#B892FF` |
| Light Lavender   | `#E8DBFF` |
| Lavender Glow    | `#F2EBFF` |

### Text

| Usage          | Color     |
| -------------- | --------- |
| Primary Text   | `#1E1A17` |
| Secondary Text | `#6E665F` |
| Muted Text     | `#9B948D` |
| Disabled Text  | `#C4BCB3` |

### Supporting Colors

| Usage       | Color     |
| ----------- | --------- |
| Success     | `#7DBE8A` |
| Warning     | `#E4C27A` |
| Soft Pink   | `#F6D9E9` |
| Soft Purple | `#DDD0FF` |
| Border      | `#E5DDD5` |

---

## Border Radius System

```css
--radius-sm: 12px;
--radius-md: 20px;
--radius-lg: 28px;
--radius-xl: 36px;
--radius-full: 999px;
```

Most cards use:

```css
border-radius: 1rem; /* 16px — matches design.md and the .card component */
```

The reflection button:

```css
border-radius: 999px;
```

---

## Shadow Style

Very subtle.

```css
box-shadow:
0px 1px 2px rgba(0,0,0,0.03),
0px 6px 20px rgba(0,0,0,0.04);
```

Avoid modern SaaS shadows.

---

## Typography


### Suggested Scale

| Size | Usage         |
| ---- | ------------- |
| 32px | Hero          |
| 24px | Screen Titles |
| 20px | Card Titles   |
| 16px | Body          |
| 14px | Secondary     |
| 12px | Labels        |
| 10px | Metadata      |

---

## Component Language

### Cards

```css
background: #FBF8F4;
border: 1px solid #E5DDD5;
border-radius: 1rem; /* 16px */
padding: 20px;
```

### Pills

```css
background: #EFE6DD;
color: #6E665F;
border-radius: 999px;
padding: 6px 12px;
```

### AI Insight Card

```css
background: linear-gradient(
180deg,
#FBF8F4 0%,
#F7F1EA 100%
);
```

### Progress Bars

```css
track: #EFE6DD;
fill: #C7A9FF;
```

### Graphs

```css
line: #B892FF;
fill: rgba(199,169,255,0.18);
```

---

## Signature Element

The most recognizable part of the UI is the glowing lavender circle:

```css
background:
radial-gradient(
circle,
#FFF8ED 0%,
#F8EEDC 100%
);

border: 3px solid #C7A9FF;

box-shadow:
0 0 30px rgba(199,169,255,0.35);
```

This creates the "mindfulness app" feeling.

---

## Tailwind Theme

```js
colors: {
  background: "#F7F1EA",
  surface: "#FBF8F4",
  border: "#E5DDD5",

  primary: "#C7A9FF",
  primaryLight: "#E8DBFF",

  text: "#1E1A17",
  textSecondary: "#6E665F",
  textMuted: "#9B948D",

  success: "#7DBE8A",
  warning: "#E4C27A",
}
```

### Keywords for Designers/AI

If you want to replicate this style in Figma, Midjourney, Lovable, v0, Bolt, etc.:

> *Warm ivory background, soft lavender accent, mindful wellness aesthetic, premium journaling app, calm minimalism, organic rounded cards, subtle gradients, soft shadows, Apple Health inspired, luxury therapy app, emotional intelligence dashboard, feminine-neutral design language, spiritual minimalism, breathing space UI.*
