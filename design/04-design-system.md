# Phase 3b — Tekonest umbrella design system (draft)

> Agents: **tekdesigner** (system) and **tekbranddesigner** (identity). The tokens are implemented in [`website-prototype/assets/css/tokens.css`](../website-prototype/assets/css/tokens.css), and that CSS file is the source of truth. Target: **WCAG 2.2 AA**.

## 1. Shared vs. per-branch

| Shared across the umbrella (never varies) | May vary by branch |
| --- | --- |
| Logo, name and endorsement line « par Tekonest » | One **cable colour** per branch (rules, tags, focus accents) |
| Paper, ink and sodium colours; type families; spacing scale; status tags and wording | Imagery: documentary portraits for Réseau, product screenshots for Apprendre and TekPractice |
| Accessibility rules, French typography rules, honesty rules | **Product interfaces**: the learning platform keeps its dark studio skin (`--tn-*` tokens, Space Grotesk / Inter / JetBrains Mono); TekPractice keeps its white gallery (`#F5F6F8`, accent `#2E5FE6`, Inter). Only the endorsement and the umbrella links are shared |

## 2. Colour (semantic tokens)

Contrast is measured against Papier `#FAFAF7` and computed with the WCAG formula. The script and results are in [`07-review/README.md`](07-review/README.md).

| Token | Hex | Role | Contrast |
| --- | --- | --- | --- |
| `--color-paper` | `#FAFAF7` | Page ground | — |
| `--color-surface` | `#FFFFFF` | Raised panels | — |
| `--color-sunken` | `#F1F1EC` | Alternating bands, disabled fields | — |
| `--color-ink` | `#16163F` | Text, logo, primary button | 16.4:1 |
| `--color-ink-2` | `#4A4A6E` | Secondary text | 8.1:1 |
| `--color-ink-3` | `#6B6B8A` | Captions only | 4.9:1 |
| `--color-line-strong` | `#8E8EA8` | Input borders, essential dividers | 3.05:1 (non-text, ≥ 3:1) |
| `--color-signal` | `#E8590C` | Sodium: focus ring, plug, leaving strand. **Never as text** | 3.4:1 (non-text) |
| `--color-signal-text` | `#B4430A` | Sodium used as text | 5.4:1 |
| `--cable-reseau` | `#12775A` | Network rules and text | 5.3:1 |
| `--cable-organiser` | `#6A4BC4` | Organisers | 5.9:1 |
| `--cable-apprendre` | `#E8B04B` | Learning rule (decorative only). Text uses `#8A5A00` | 1.9:1 rule / 5.7:1 text |
| `--cable-tekpractice` | `#2E5FE6` | TekPractice | 5.2:1 |

**Status colours** are always shown with a text label: `now` green, `dev` blue, `prep` sodium-text, `later` grey. Colour alone never carries meaning.

## 3. Typography

| Role | Family | Settings |
| --- | --- | --- |
| Display (h1–h3, quotes) | **Bricolage Grotesque** variable (`opsz` axis, weight 200–800) | 700, tracking −0.03em, line height 1.02, sentence case, `text-wrap: balance` |
| Text and UI | **IBM Plex Sans** 400 / 500 / 600 | 17 px base, line height 1.6, measure ≤ 66 characters |
| Arabic (artist names and titles, when needed) | **IBM Plex Sans Arabic** (OFL), designed as Plex's companion | Real Arabic only, `lang="ar" dir="rtl"`, proofread by native readers. Not yet used in the prototype |

**Scale (rem):**
- 0.875 (small)
- 1.0625 (base)
- 1.25 (large)
- 1.5 (xl)
- 1.75 → 2.5 (2xl, fluid)
- 2 → 3.25 (section titles, fluid)
- 2.6 → 5.75 (hero, fluid)

**Never:**
- all caps on labels;
- one accented word inside a headline;
- labels above every heading.

## 4. Space, grid, borders

- **Space:** 4-point base (4, 8, 12, 16, 24, 32, 48, 64, 96, 128).
- **Grid:** 12 columns, max 1200 px; gutter `clamp(16px, 4vw, 40px)`. Text is left-aligned. The hero is 7/5 columns and collapses to one column below 800 px.
- **Borders encode hierarchy:**
  - a 3 px **cable rule** marks a branch;
  - 1 px hairlines separate rows;
  - controls use an 8 px radius, tags are fully rounded, and panels stay nearly square (2 px).

## 5. Components (in the prototype)

- **Header and navigation.**
  - Sticky header with 7 task-based links, plus Accessibilité in the footer.
  - Under 960 px a "Menu" disclosure button opens the menu: `aria-expanded`, Esc closes it, and focus moves to the first link. Without JavaScript the full menu stays visible.
- **Door.** A route card: cable rule, action title (the only link, and the whole card is clickable), audience line and status tag.
- **Status tag.** Dot plus text; never colour alone.
- **Status board.** A semantic `<table>` with a caption. Under 720 px it becomes stacked rows with inline labels.
- **Connections list.** Link, description and status.
- **Product preview.** Each product shown in its *own* skin, with the « par Tekonest » endorsement.
- **Disabled sign-up.** Real `<label>` and `<input disabled>`, a disabled button reading « Inscriptions bientôt ouvertes », and a note saying no data is collected. There is never a fake confirmation.
- **Photo slot.** A dashed frame describing the future, consented photo.
- **Buttons.**
  - Primary: ink background, white text.
  - Ghost: ink outline.
  - Disabled: grey.
  - All buttons are at least 48 px high, above the 24 px minimum target in WCAG 2.5.8.

## 6. Imagery rules

1. **No stock photos of people.** Stock models cannot stand in for Tekonest's community, and Pexels' terms forbid implying endorsement.
2. **Real people, written consent per use** (*droit à l'image*, Code civil art. 9), and a credit on every photo (« © Nom / Tekonest »). Minors need written parental consent.
3. **Crowd shots** are only acceptable when no one is singled out. Prefer portraits and people at work.
4. **Illustration** is line drawing only: the coil and signal-flow diagrams. No arabesques, lanterns or faux-Arabic lettering.
5. Every image is recorded in [`06-assets-licences.md`](06-assets-licences.md).

## 7. Motion

- **One orchestrated moment:** the hero coil draws itself (≈1.4 s) on page load. This is not WCAG 2.2.2 territory (it lasts under 5 s and does not loop).
- **Everything else** moves only in answer to the visitor: hover, menu, focus.
- **`prefers-reduced-motion: reduce`:** the coil appears static, already drawn.

## 8. Writing rules (summary)

- **French first**, with narrow no-break spaces before `; : ! ?` and inside « » (applied automatically by the build script). Accented capitals; the date format is « 22 octobre 2026 ».
- **No point médian in the interface.** Use épicène words first, then « vous », then full doublets (« techniciennes et techniciens »).
- **Status words** map 1:1 to the brand status map and are used everywhere identically:

  | Status map | Site label | Tag colour |
  | --- | --- | --- |
  | Existing | « Existe » | `now` green |
  | Under development | « En développement » | `dev` blue |
  | Proposed | « En projet » (e.g. « Réseau en projet ») | `prep` sodium |
  | Proposed, later | « En projet, plus tard » / « Offre en projet, pas encore proposée » | `later` grey |
  | Undecided | « À décider » | `later` grey |
- **Every call to action names what happens.** There is no generic « Commencer ».
