# Round 1 — tekdesigner (design-system engineer, colour and accessibility)

> Independent analysis. I did not read the other members' files. Every number below was measured with `tools/metrics.py`: WCAG 2.x contrast, Machado 2009 CVD simulation at severity 1.0, CIE76 ΔE, and CIELAB L\*. Specs were tested in scratch JSON. No repo file other than this one was changed.

First move: **what is each token for?**

## 0. Token audit: count the jobs each token does

- `--color-signal` #E8590C does six jobs today.
- Those jobs are logo plug, coil strand, focus ring, active-nav underline, Soirées cable and the hue of the "projet" status.
- `#B4430A` is both the sodium text colour and the `status-prep` dot.
- `#12775A` is both the Réseau cable and the `status-now` dot, so they are identical.
- `#2E5FE6` is both the TekPractice cable and the `status-dev` dot, so they are identical.
- The Apprendre cable #E8B04B measures 1.87:1 on paper and fails the 3:1 non-text minimum.
- In grayscale, all branch cables sit at L\* 41–56; only Apprendre stands out, at 75.
- Verdict: four tokens have two or more jobs. That is the core defect.

## 1. What works, keep it

- Paper #FAFAF7 with ink #16163F gives 16.45:1. Calm, gallery-grade. Keep.
- The ink-2 and ink-3 ramp gives 8.05 and 4.90:1. Correct, keep.
- Sodium on ink measures 4.81:1, and the poster reads instantly (render 5).
- One warm accent on a cool neutral is recognisable in a single glance.
- Status tags always pair dot and text, so colour is never alone. Good.
- The products keep their own skins (dark studio, white TekPractice), which is the right separation.
- The plug dot is the strongest brand device, and it survives at 16 px.
- Line-only illustration avoids decorative "oriental" clichés. Keep the rule.

## 2. Cultural warmth versus technical precision

- Precision reads clearly: ink, grid, Plex, thin cables.
- Warmth comes from one thing only: a single orange stroke.
- The paper is a cool off-white, and the ink is blue-violet, which reads as tech and corporate.
- On the Soirées page (render 3), warmth is absent. It is all ink and grey.
- The events voice needs photos to carry warmth. Colour alone cannot do it.
- My lens is weak here. I defer to the cultural members on the degree of warmth.

## 3. Orange's role and weight

- The weight is right: it appears sparingly and is always the "leaving strand".
- The role is wrong: six jobs blur the meaning of "signal".
- Observed in focus-1440: the orange focus ring wraps the Soirées card's orange rule.
- The ring and the cable merge, so focus on Soirées is barely perceivable.
- Observed on Apprendre and TekPractice: the nav underline is orange while the page cable is amber or blue.
- So orange reads as "current page" and also as "Soirées". That is a conflict.
- Observed in render 6: the Réseau row shows a green cable next to an orange "En projet" dot.
- The orange status dot implies Soirées ownership. That is false semantics.
- Fix: sodium means "Tekonest signal" only, meaning the logo, the coil and the active state.
- The focus ring moves to ink, 3 px with a 3 px offset: 16.45:1 and never a branch colour.

## 4. Five branch accents: navigation or fragmentation?

- On the home page, three doors with three rules work as wayfinding (render 1).
- Five hues plus four status hues plus two product skins makes eleven hues. That is fragmentation.
- Branch colour is only reinforced on rules. The nav and links ignore it, so its value is weak.
- Apprendre and TekPractice are both "learning" and could share one cable.
- In monochrome or print, the cables are indistinguishable (L\* 41–56).
- Conclusion: hue is a tolerable secondary cue. Never make it the identifier.

## 5. Can status colours be confused with branch colours?

- Yes, measurably: two pairs are identical (Réseau=existe, TekPractice=dev).
- `projet` #B4430A against the Soirées cable is only ΔE 19 at best, ΔE 15 for protan.
- Statuses should leave hue entirely. Encode them by shape plus a neutral value.
- Proposal: existe ● filled ink, dev ◐ half, projet ○ ring, later ◌ dashed ring.
- Shape encoding survives CVD, grayscale, photocopies and 1-bit print.

## 6. Across media

- **Posters and social:** the ink ground with paper type and a sodium plug works (4.81:1).
- **Posters and social:** do not add branch hues to posters; the result looks like a corporate deck.
- **Website:** fine once the token jobs are split; see Option A.
- **Learning platform:** its dark skin is valid. Amber #e8b04b on #0b0e13 measures 9.89:1.
- **Learning platform:** its red #f06a5d against sodium is ΔE 14 for tritan, so keep sodium out of feedback states.
- **TekPractice:** blue #2E5FE6 stays inside the product, and the umbrella endorses it in ink.
- **Small screens:** the 3 px cable rule holds. The 9 px status dot is too small for shape coding, so it needs 12 px.
- **Monochrome and print:** branches collapse today. Needs pattern or name, never hue alone.
- **Print:** sodium #E8590C is close to Pantone 1665 or 166. Proof it; it is not my lens.
- **Dark mode:** a ground of #121230 with text #EDEDF5 gives 15.61:1.
- **Dark mode:** lift sodium to #FF7A2E on dark (6.99:1), which is also safe for text.
- **Dark mode:** cables on #121230 are green #3FB58C at 7.10, violet #9C86F0 at 6.13 and blue #6E95FF at 6.41.

## 7. Stereotypes (brief)

- The current palette avoids gold, turquoise, terracotta and "spice" coding. Good.
- Risk in any "warmer" option: saffron, terracotta and indigo read as orientalist shorthand.
- Name tokens after sound or light (sodium, bronze), never after spices or regions.
- Pan-African red, gold and green triads must never appear as a branch set.

---

## Proposals

### Option A — "Bobine, refined": change the jobs, not the look

- The palette is nearly unchanged. Only one hue moves (Apprendre).

| Token | Hex | Single job | Measured |
| --- | --- | --- | --- |
| `--color-paper` | #FAFAF7 | ground | — |
| `--color-ink` | #16163F | text, logo, **focus ring** | 16.45:1 |
| `--color-ink-2` / `-3` | #4A4A6E / #6B6B8A | secondary / captions | 8.05 / 4.90:1 |
| `--color-signal` | #E8590C | brand only: plug, coil strand, active nav | 3.42:1 non-text |
| `--color-signal-text` | #B4430A | sodium as text, never a status | 5.36:1 |
| `--focus-ring` | 3px solid var(--color-ink), offset 3px | focus only | 16.45:1 |
| `--cable-soirees` | #E8590C (alias of signal, documented) | Soirées rule | 3.42:1 |
| `--cable-reseau` | #12775A | Réseau rule | 5.27:1 |
| `--cable-organiser` | #6A4BC4 | Organiser rule | 5.88:1 |
| `--cable-apprendre` | **#7A5200** (deep amber/bronze) | Apprendre rule and text | 6.62:1 (was 1.87) |
| `--cable-tekpractice` | #2E5FE6 | TekPractice rule | 5.15:1 |
| `--status-*` | ink #16163F + **shape** (● ◐ ○ ◌), 12 px | status only | 16.45:1 |

- CVD check: no branch or status pair falls under ΔE 12 in any simulation, which I measured.
- Why not #A86F00 for Apprendre: it collides with sodium for protan (ΔE 1).
- The Soirées alias of signal is the one tolerated double job. It is documented, not hidden.
- The site CSS cost is small: the focus token, four status rules and one cable.

### Option B — "Écru editorial": warmer and more cultural, measured

- A warmer ground, a deeper ink, a rose instead of violet. Statuses use shape, as in A.

| Token | Hex | Job | Measured on #F6F1E8 |
| --- | --- | --- | --- |
| `--color-paper` | #F6F1E8 (écru) | ground | — |
| `--color-ink` | #1C1638 (aubergine-night) | text, logo, focus | 15.28:1 |
| `--color-ink-2` / `-3` | #4A4466 / #5F5A78 | secondary / captions | 8.08 / 5.80:1 |
| `--color-signal` | #E8590C | brand signal | 3.18:1 (thin margin) |
| `--color-signal-text` | #A3360B | sodium as text | 6.04:1 |
| `--cable-soirees` | #E8590C | Soirées | 3.18:1 |
| `--cable-reseau` | #0F6B6B (deep teal) | Réseau | 5.60:1 |
| `--cable-organiser` | #B0306A (raspberry) | Organiser | 5.37:1 |
| `--cable-apprendre` | #7A5200 (bronze) | Apprendre | 6.15:1 |
| `--cable-tekpractice` | #2E5FE6 | TekPractice | 4.79:1 |

- Rejected #7A3B69 plum: it is ΔE 3 from teal for deutan, so it would be invisible.
- The remaining flags concern only the neutral status greys, which shape already disambiguates.
- Risk: sodium drops to 3.18:1 on écru. Any extra warmth in the ground fails the 3:1 minimum.
- Risk: the écru ground drifts from the TekPractice white, so the family resemblance weakens.

### Option C — "One signal" (my proposal): hue for the brand, form for meaning

- The umbrella uses two inks and one sodium, nothing more.
- Branches are identified by **name plus cable pattern**, never by hue.
- Cable patterns: Soirées solid, Réseau double line, Organiser dashed, Apprendre dotted, TekPractice square-wave.
- The cable pattern is drawn in ink #16163F at 16.45:1, and it survives print, fax and 1-bit output.
- Statuses use shape in ink (● ◐ ○ ◌), as in A.
- Sodium #E8590C has a single job: the "leaving strand", meaning the logo plug, coil, active nav and the poster accent.
- Products keep their own hues inside their skins: amber on dark, blue on white.
- The umbrella shows products only through screenshots and the "par Tekonest" endorsement.
- Dark mode: ground #121230, text #EDEDF5 (15.61), ink-2 #B4B4CC (8.95), signal #FF7A2E (6.99).
- Warmth comes from photography and Arabic, French and English type, not from palette sprawl.
- Cost: less "colourful", and the cultural members may find it too austere.
- Mitigation: events posters may add **one** guest hue per event, set by the artists.
- The guest hue lives in a `--guest-accent` token, scoped to that poster and never system-wide.

| Token | Hex | Job | Measured |
| --- | --- | --- | --- |
| `--color-paper` / `--color-ink` | #FAFAF7 / #16163F | ground / text, cables, focus, status | 16.45:1 |
| `--color-signal` | #E8590C | leaving strand only | 3.42:1 paper, 4.81:1 ink |
| `--color-signal-text` | #B4430A | rare sodium text | 5.36:1 |
| `--dark-ground` / `--dark-ink` | #121230 / #EDEDF5 | dark mode | 15.61:1 |
| `--dark-signal` | #FF7A2E | signal on dark | 6.99:1 |
| `--guest-accent` | per event | one poster only | must pass 3:1 on its ground |

## Recommendation

- Ship A now: it fixes every measured defect with minimal visual change.
- Move towards C for print, social and long-term maintenance.
- Treat B as a ground-and-ink mood study. It is not my preference, because sodium hits 3.18:1 on écru.

POSITION: Option A immediately, converging on Option C. Branches and statuses must stop sharing hues, and statuses move to shape. | CONFIDENCE: 80% | RISK: I block the identical branch/status pairs (#12775A, #2E5FE6), the orange focus ring on an orange cable, the Apprendre rule at 1.87:1, #A86F00 (protan ΔE 1 to sodium), and any warmer ground that pushes sodium under 3:1.
