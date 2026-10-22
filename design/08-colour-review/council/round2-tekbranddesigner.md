# Round 2 — tekbranddesigner (structured challenge)

> Evidence: comparison-board, vision-board, renders 1/3/5 for 0, A, B, C; metrics.md; options JSON. I computed the extra contrast values with WCAG 2.x. Riso behaviour is my trade judgement; it is not measured here.

## 1. Challenge

**tekcreativedirector**
- Strongest point: warmth comes from the **ground**. B's events render (a full-bleed night hero) is the first web screen that feels like a night, and it adds no hue.
- Most dangerous assumption: that a guest colour can replace the brand ground. C's poster render puts prune `#5B2A4E` under the coil. On an Instagram grid, every tile would then be a different colour, and recognition would rest on a 40 px coil alone.

**tekdesigner**
- Strongest point: the token-job audit. The ink focus ring and shape statuses fix measured defects, and the vision board shows that statuses survive every CVD simulation and grayscale.
- Most dangerous assumption: that A is a safe stop. A still has five hues at L\* 38–56. In the grayscale column they are a single grey.

## 2. Scores (1–5)

| | A | B | C |
|---|---|---|---|
| Brand fit | 3: same navy+sodium, but branch hues still dilute the strand | 4: night hero = the poster's voice on the web | 4: purest ink+sodium, but the prune poster loses the navy |
| Distinctiveness | 2: five rules look like a SaaS feature grid | 3: night ground is own-able; the hue set is not | 4: ink patterns (double, dashed) are unusual and ownable |
| Emotional range | 2: cool throughout | 4: day/night split | 4: guest ink gives each edition its own feeling |
| Legibility | 4: all pass | 4: all pass; sodium 3.26 on écru is thin | 5: ink everywhere, 16.45:1 |
| Accessibility | 4: no ΔE<12 pairs | 4: same | 5: meaning never carried by hue |
| Cross-service coherence | 3: product hues leak into the umbrella | 3: teal+bronze+raspberry are a new set to govern | 4: products keep their skins and the umbrella is neutral |
| Maintenance | 3: 5 hues × 2 tokens | 2: new paper, line, ink and 3 new hues, plus two oranges | 4: one pattern set; the guest list needs a routine |

## 3. Reproduction

- **One-colour / photocopy:** A and B lose all branch identity. C is identical in one colour. The patterns do the job, and the grayscale column of the vision board proves it.
- **Riso (2 inks):** A and B fail because five cable hues cannot print. In B, `#E8590C` and `#FF8A4C` collapse into one riso orange; that is acceptable but needs documenting. C works as navy + orange, or as guest + orange. **Caveat:** the Réseau double line has 2 px gaps, which will fill in with riso dot gain. In print it needs at least a 0.5 mm gap. Large guest floods will also show roller unevenness on riso, so proof them.
- **Small social avatar:** coil + plug on navy works in all three. C must forbid guest grounds on the avatar. B's plug is lighter (`#FF8A4C`), which risks two avatar versions.
- **375 px:** in A and B the coloured 3 px rules are visible but carry no meaning. In C, solid, double and dashed read clearly. Dotted and dash-dot are close at 375 px, so they need a minimum 4 px height and a label. The sodium strand is small in all three, and this is a geometry issue, not a colour one.
- **Warmer paper:** I checked `#F8F6F1`. It drops the input border `#8E8EA8` to **2.95:1 (fail)** and sodium to 3.31. Warming the paper therefore forces changes to the line tokens too, which is expensive. Warmth should come from the night ground instead.

## 4. Final position

[POSITION CHANGE: Prefer C, B as fallback → C frame + B's night ground for Soirées, guest colour restricted | Trigger: the B events render shows a night ground carrying warmth with no hue; the C poster render shows a guest flood breaking grid recognition; my paper test shows a warmer paper fails the input border.]

Exact tokens:
- Keep `--color-paper #FAFAF7`, `--color-ink #16163F` and ink-2/3. Use **one navy only**. Drop `#1B1736`/`#1B1838`, because the logo files and riso ink map to one navy.
- `--color-signal #E8590C` covers the plug, the strand and the active nav. Keep `--color-signal-text #B4430A`. Add `--signal-on-dark #FF8A4C` (7.37:1 on navy) for night text only. The plug stays `#E8590C` everywhere except guest grounds.
- `--focus-ring: 3px solid var(--color-ink)`. On night grounds it is `#FAFAF7`.
- Branches: all `--cable-*` = `#16163F` with C's patterns. Minimum height is 4 px on screen and the double-line gap is at least 0.5 mm in print.
- Statuses: shape in ink (● ◐ ○ ◌), 11–12 px.
- New `--ground-night #16163F` for the Soirées hero and footer, with `--ink-on-night #FAFAF7` and `--ink-2-on-night #B9B2CC` (8.44:1).
- Guest: `--guest-accent`, one per edition, from the creative director's G1–G7 list. It may flood **that edition's poster only**. The avatar, recurring social templates and the website stay navy. On a guest ground, the plug is `#FF8A4C`, because `#E8590C` on prune is only 3.11:1.

POSITION: C frame (ink + sodium, patterned ink branches, shape statuses, ink focus) + B's navy night ground for Soirées; single navy `#16163F`, paper unchanged; guest colour poster-only | CONFIDENCE: 82 | RISK: Guest-colour governance slips (several guests, or guests on the avatar/templates), and the grid loses its navy anchor; riso dot gain closes the double-line pattern unless it is proofed.
