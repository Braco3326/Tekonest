# Round 2 — tekdesigner (structured challenge, colour only)

> Evidence: renders, metrics.md, `make_options.py`, site/tokens CSS, plus my own Playwright probes on scratch copies (focused outline colour, forced colours, status crops at 375 px and 200 %).

## 1. Challenge

| Expert | Strongest point | Most dangerous assumption |
| --- | --- | --- |
| tekcreativedirector | Warmth from the **ground** (Soirées on night), not hues. | That night grounds are free: B's ring resolves at `:root`, so it is 1:1 on Nuit. G5 plug is only 3.21:1. |
| tekbranddesigner | One-colour/riso test: branches cannot be hue. | Ink #141432: asset churn for +0.6 contrast. A small team keeping a per-edition routine; teal (4.35:1) leaking into text. |

## 2. Scores (1–5)

| | Brand fit | Distinct. | Emotion | Legibility | A11y | Cross-service | Maintenance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | 3 | 2 | 2 | 5 | 4 | 3 | 3 |
| B | 4 | 3 | 4 | 4 | 3 | 3 | 2 |
| C | 4 | 4 | 3 | 5 | 4 | 5 | 3 |

- **A:** 9 chromatic signals; cables at grayscale L\* 38–56. Correct but forgettable.
- **B:** warmest render, but it overrides the whole neutral ramp, scoped hero hacks, hard-coded hovers.
- **C:** clean in 6-semantics and mobile, CVD- and print-proof. Maintenance is low only because of the implementation (§3).

## 3. Audit

**Status shapes.** At 375 px all four are distinct (○ vs ◌ is weakest); at 200 % unambiguous. Labels are present, so no 1.4.1 issue. **Defect:** in forced colours the fills become Canvas, so ●, ◐ and ○ collapse to one ring. Fix: `forced-color-adjust:none` with `CanvasText` fills.

**C's cable patterns.** They are not robust as specified.
- Gradient backgrounds vanish in forced colours: the probe found `.door` with no border and no image.
- The 2/2/2 px double line greys out at 110–125 % zoom; dash-dot is hard to learn.
- `[style*="--cable-…"]` is a brittle selector, and `.signup` (site.css:177) was missed.
- **Fix:** native `border-top-style` (solid, double, dashed, dotted) via `data-branch`. Apprendre and TekPractice share dotted, which retires dash-dot.

**Hard-coded colours the specs missed.**
`#26265C` (hover), `#D2D2E4` and `#36366A` (footer) are patched only by B; A and C are safe while ink stays unchanged. `.preview-*` colours are product skins; keep them.

**B's sodium margins.** 3.26:1 and 3.10:1 pass by only 0.10–0.26. More warmth, a CMYK proof or a dim phone would fail them, and the `aria-current` underline relies on this margin.

**Focus (1.4.11 / 2.4.7; 2.4.11 not obscured).** This is a **blocker in all three options**.
- `--focus-ring` is pre-composed at `:root`, so footer links get an ink ring on an ink ground: 1:1 measured (baseline sodium: 4.81:1).
- Fix: `--focus-color` and `--focus-width`, with `--focus-color` re-declared in each dark scope.
- 2.4.11: keep `scroll-padding-top: 96px` for the sticky header.

## 4. Final position — hybrid "C-native"

`[POSITION CHANGE: A now, converge to C → hybrid C-native directly | Trigger: C's renders hold at 375 px; native borders remove its implementation risk, so two migrations cost more than one.]`

| Token | Value |
| --- | --- |
| `--color-paper / ink / ink-2 / ink-3` | unchanged (#FAFAF7 / #16163F / #4A4A6E / #6B6B8A) |
| `--color-signal` | #E8590C: plug, strand, `aria-current` only |
| `--focus-color` | `var(--color-ink)`; in `.site-footer` and night scopes, #FAFAF7 (16.45:1) |
| `--focus-width` | 3px (offset 3px); rules use `outline: var(--focus-width) solid var(--focus-color)` |
| `--cable-*` (all five) and `--cable-*-text` | #16163F |
| `--cable-style` | soirees solid · reseau double (6px) · organiser dashed · apprendre/tekpractice dotted |
| `--status-now/dev/prep/later` | `var(--color-ink)` + shapes + forced-colours fallback |
| `--night-ground` | #16163F for the Soirées hero (from B, without the ink change); `--signal-on-night` #FF8A4C (7.36:1 on #1B1736, ≥6.6 on #16163F) |
| `--guest-accent` | poster/social scope only; plug ≥ 3.5:1 on it (drop G5) |

Rejected: B's écru ramp (sodium margin, drift from TekPractice white), ink #141432, umbrella branch hues.

POSITION: Hybrid C-native. Ink and sodium form the umbrella. Branches use native border patterns, statuses use ink shapes, the Soirées hero sits on night, and the guest accent is poster-only. The focus colour is split per ground. | CONFIDENCE: 78 | RISK: I block any option that ships with the pre-composed `--focus-ring` (1:1 on the footer), gradient-drawn cables (they vanish in forced colours), `[style*=]` selectors, or sodium below 3.3:1 on any ground.
