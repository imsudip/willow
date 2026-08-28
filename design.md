# Willow | Design System

*Calm therapy app + premium journal + soft spirituality.* Warm ivory backgrounds, soft lavender as the only accent, rounded cards with almost no shadows.

## 1. Core Color Palette

### Backgrounds
| Usage                | Name         | Hex       |
| -------------------- | ------------ | --------- |
| Main Background      | Warm Ivory   | `#F7F1EA` |
| Secondary Background | Soft Beige   | `#EFE6DD` |
| Card Background      | Cream White  | `#FBF8F4` |
| Elevated Card        | Warm White   | `#FEFCF9` |

### Primary Accent
| Usage            | Name           | Hex       |
| ---------------- | -------------- | --------- |
| Primary Lavender | Primary        | `#C7A9FF` |
| Hover Lavender   | Strong         | `#B892FF` |
| Light Lavender   | Soft           | `#E8DBFF` |
| Lavender Glow    | Glow           | `#F2EBFF` |
| Deep Lavender    | Deep (text-safe) | `#7255B0` |

### Text
| Usage          | Hex       |
| -------------- | --------- |
| Primary Text   | `#1E1A17` |
| Secondary Text | `#6E665F` |
| Muted Text     | `#9B948D` |
| Disabled Text  | `#C4BCB3` |

### Supporting Colors
| Usage      | Hex       |
| ---------- | --------- |
| Success    | `#7DBE8A` |
| Warning    | `#E4C27A` |
| Soft Pink  | `#F6D9E9` |
| Soft Purple| `#DDD0FF` |
| Border     | `#E5DDD5` |

---

## 2. Typography System

**Typeface:** Clean, modern sans-serif (e.g., Inter, SF Pro, or custom "Willow Sans"); Lora for journal/serif accents.

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

## 3. UI Components & Layout

### Global Variables
*   **Grid System:** 8px grid.
*   **Spacing Units:** 16px (standard padding/margin).
*   **Border Radius:** 16px for standard cards (`rounded-2xl`), 12px for buttons and inputs (`rounded-xl`), full (999px) for pills and the reflection button.

### Components
*   **Card Containers:** Cream White `#FBF8F4` background, 1px `#E5DDD5` border, 16px radius (`rounded-2xl`), 20px padding, and a very subtle shadow (`0 1px 2px rgba(0,0,0,0.03), 0 6px 20px rgba(0,0,0,0.04)`).
*   **Pills/Tags:** Soft Beige `#EFE6DD` background, Secondary Text `#6E665F`, full radius, 6px 12px padding.
*   **Primary Button ("Start Reflection"):** Signature glowing lavender circle — radial cream gradient (`#FFF8ED` → `#F8EEDC`) fill, 3px `#C7A9FF` border, `0 0 30px rgba(199,169,255,0.35)` glow.
*   **Primary Action Buttons:** Lavender `#C7A9FF` fill with near-black `#1E1A17` text, 12px radius (`rounded-xl`).
*   **Text Buttons:** Deep Lavender `#7255B0` (accessible on ivory).
*   **AI Insight Card:** Linear gradient `#FBF8F4` → `#F7F1EA`.
*   **Progress Bars:** Track `#EFE6DD`, fill `#C7A9FF`.
*   **Graphs:** Line `#B892FF`, area fill `rgba(199,169,255,0.18)`.

---

## 4. Iconography
*   **Style:** Outline style, consistent stroke weight (approx 1.5px to 2px).
*   **Color:** Ink `#1E1A17` or Secondary Text `#6E665F`; active/accent states use lavender.
*   **Examples:** Lotus (brand/mindfulness), Bell (notifications), Settings (gear), Bar Chart (stats), Edit (pencil/box), Share (network), Favorite (star), AI Insight (lightbulb).
