# Round 1 — tekbranddesigner (independent analysis)

> Lens: recognisability, cross-media consistency, brand architecture in colour.
> First move: "Does it survive one-colour print?"
> Sources looked at: baseline renders 1–6, 07-review screens (index, apprendre, tekpractice, soirées 375), logo sheet, boards A/B/C, `04-design-system.md`, `tokens.css`, `metrics.md`, `03-logos/README.md`.
> Contrast values below were computed with the WCAG 2.x formula (script run during this review). Riso ink hexes are screen approximations; check them against the print shop's ink chart before use.

## Draft reasoning (short lines)

1. One-colour test first: the coil and wordmark are line art. They survive.
2. Logo sheet: the mono and reverse versions already exist. That is good discipline.
3. The favicon drops the sodium plug at 16 px. Fine, because ink carries it.
4. The core is ink + paper + sodium, which is a real two-ink system.
5. On the poster render, ink ground + paper type + sodium strand is the strongest asset.
6. The hero render: one orange gesture against calm ink reads as Tekonest instantly.
7. Branch cables add four more hues next to the sodium.
8. The semantics render shows nine chromatic signals in one table.
9. The Réseau green is the "existe" green, and TekPractice blue is the "dev" blue.
10. So a green rule beside an "En projet" orange dot mixes up two meanings.
11. Apprendre amber fails 3:1 (1.87). It is also a third warm next to sodium.
12. In grayscale, branches 41–45 L\* collapse. Only the amber stands apart.
13. Riso with two inks can't carry five branches. They drop out.
14. One-colour offset: branch identity disappears completely, so it must live elsewhere.
15. Conclusion: hue is the wrong carrier for branches. Words and position work.
16. Warmth today: the orange alone carries it. The ink is cold blue-violet.
17. The paper #FAFAF7 is almost a neutral screen white. It reads technical, not cultural.
18. Technical precision is excellent. Cultural warmth is under-delivered, not absent.
19. Warmth should come from photography, type scale and Arabic type, not hue.
20. The orange's role is right: plug, strand, focus, one gesture per surface.
21. Its weight is slightly diluted when it is also the Soirées branch colour.
22. Making sodium = Soirées makes events the "real" Tekonest. It skews the architecture.
23. The products (dark studio, white TekPractice) already have their own skins. Good.
24. Their accents leaking into the umbrella as branch cables creates double coding.
25. Stereotype check: nothing oriental. Gold+turquoise and flag colours are absent.
26. Amber next to sodium on the night poster could drift to "sunset/desert".
27. Purple Organiser is generic SaaS. It says nothing about Tekonest.
28. Instagram feed: ink tiles with a sodium strand will grid recognisably.
29. Small screens: 3 px cables are fine, but the meaning is unreadable without labels.
30. Merch: navy + one orange spot prints cheaply on screen print, in two screens.
31. Dark grounds: sodium on ink 4.81:1, non-text pass. Good for posters.
32. Decision: keep the two inks and demote the branch hues.

## 1. What works and should be retained

- **Encre de nuit `#16163F` + Papier + Sodium `#E8590C`** is the brand. It is a true two-ink system: it works in screen print and riso (Midnight/Federal Blue + Orange), and as spot colour plus black in offset.
- **The coil as line art**, with mono and reverse variants already drawn, and the favicon that keeps its form without the plug.
- **Sodium as a gesture, not a fill**: one strand, one plug, one rule per surface. The poster render (5) and hero (1) prove it.
- **Sodium-text `#B4430A`** as the accessible text twin. This discipline is correct.
- **Status = dot + word, never colour alone.** Keep the principle and change the colours (see 5).
- **Products keep their own skins** under « par Tekonest » (the learning render 4). That is an endorsed architecture, and it is right.

## 2. Warmth vs. precision

Precision: yes, fully. Warmth: only through the orange. The ink is a cool blue-violet, the paper is near-white, and Bricolage gives some humanity. The nights' audience will feel "well-run tech collective" before "a place where cultures meet". The fix is **not** to add more "warm" hues, which leads straight to the terracotta/desert cliché. Instead:
- warm the neutrals slightly;
- give the ink a touch more red;
- let real photography and Arabic type (Plex Arabic) carry culture.

## 3. Orange: role and weight

- **Role: right.** It is the plug, the leaving strand and the focus ring: "towards the next project".
- **Weight: slightly wrong because of double duty.** As the Soirées cable it stops being the brand's signal and becomes one branch's colour. That makes Soirées look like the "main" Tekonest and the others like sub-brands.
- **Recommendation:** sodium belongs to the umbrella only. On event posters it is still dominant, because the nights *are* the most public face. It is dominant there as the brand, not as a branch.

## 4. Five branch accents: navigation or fragmentation?

Fragmentation, from my lens.
- On screen they are pleasant but they carry no meaning: nobody learns "purple = organisers".
- In print they fail. One-colour loses them all, and riso two-ink keeps at most one.
- In grayscale, four of five sit at L\* 41–45.
- They also compete with statuses.

Navigation is already solved by labels, the header and page titles. **Recommendation:**
- Branches are carried by the **name in the lockup** (« tekonest Soirées »), by **position/numbering**, and by **one shared rule style**.
- The products' accents (TekPractice blue, learning amber/green) appear **only inside product previews and products**, never as umbrella cables.

## 5. Status vs. branch confusion

Yes, it is confusing today. The metrics confirm identical pairs: Réseau = existe (`#12775A`), TekPractice = dev (`#2E5FE6`). In the semantics render, a green-ruled "Réseau" sits beside an orange "En projet" dot. That reads as contradictory. And the "projet" orange equals the brand signal, so the brand looks "unfinished".

**Fix:** statuses become **shape + word in neutral ink**, which is print-proof and colour-blind-proof:

| Status | Mark | Colour |
| --- | --- | --- |
| Existe | ● filled dot | ink |
| En développement | ◐ half dot | ink |
| En projet | ○ ring | ink-2 |
| Plus tard / à décider | ◌ dashed ring | ink-3 |

Sodium is then never a status.

## 6. Media stress test (current palette)

| Medium | Result |
| --- | --- |
| Event poster (ink ground) | ✅ Strongest asset. Amber/green from the products must never appear here |
| Website | ✅ calm. ⚠ the cables add noise without meaning |
| Learning products | ✅ own dark skin + endorsement. ⚠ if amber also becomes the umbrella's Apprendre colour, it stops being theirs |
| Social / Instagram grid | ✅ ink tiles + strand will be recognisable. Keep 1 template system |
| Small screens / 16 px | ✅ the favicon is solid. Cables at 3 px are fine but mean nothing |
| One-colour (black, photocopy) | ✅ logo. ❌ branch and status colour meaning lost (statuses fixed by shapes) |
| Riso 2-ink (Midnight + Orange) | ✅ core. ❌ 5 cables impossible |
| Offset (CMYK or 2 spot) | ✅ Sodium ≈ an orange spot ink. Confirm the spot match with the printer; I did not look one up. Navy as a second spot or as CMYK. ⚠ #E8590C may print duller in CMYK on uncoated stock, so proof it |
| Merch (screen print) | ✅ two screens, or one: the coil in ink on a sodium tee works too |

## 7. Stereotypes and clichés

- Current palette: **no** oriental or pan-African clichés. That is good.
- Watch-outs:
  - Amber `#E8B04B` + sodium on night navy edges towards "desert sunset". Keep amber inside the learning product.
  - Purple `#6A4BC4` is generic startup and makes no cultural claim. It is harmless but empty.
  - Do **not** answer "more cultural" with saffron, henna-terracotta, gold, kente/pan-African triads, or neon club gradients.

---

## Option B — "Bobine éditoriale" (warmer, more cultural editorial interpretation)

The same two-ink brand, with warmer neutrals, a slightly redder night ink, and an editorial dark ground. No new hues. The cream here is a cool-ish *papier journal*, never a yellow cream, and there is no terracotta.

| Token | Hex | Role | Contrast (computed) |
| --- | --- | --- | --- |
| Papier journal | `#F6F3EC` | page ground (warmer than #FAFAF7, still neutral) | — |
| Papier creux | `#EEEAE1` | bands, quote sections | ink 14.17:1 |
| Encre de nuit chaude | `#1B1838` | text, logo, poster ground (a hint more violet-red, less "corporate navy") | 15.35:1 on papier |
| Encre 2 | `#4A4466` | secondary text | 8.20:1 |
| Encre 3 | `#6B6580` | captions | 4.99:1 on papier, 4.61:1 on creux |
| Sodium | `#E8590C` | plug, strand, focus, 1 rule per surface, **non-text** | 3.23:1 on papier, 4.75:1 on encre |
| Sodium texte | `#B4430A` | sodium as text/links | 5.06:1 on papier, 4.67:1 on creux |

- **Branches:** all use an ink rule. The branch is named in the lockup « tekonest · Soirées ». Optionally, a numbered index (01–05) for print.
- **Products:** the learning platform and TekPractice keep their skins and accents only inside product contexts.
- **Statuses:** neutral shapes (section 5).
- **Editorial warmth:** large pull-quotes on Papier creux; Plex Sans Arabic for real artist names, set at equal size to the Latin type and never decorative; credited documentary photography in available light.
- **Print:** riso Midnight (or Federal Blue) + Orange. One-colour = encre.

## Option C — "Encre + édition" (my distinct proposal)

The master brand becomes strictly **one ink + one signal**. Culture is expressed by **each edition**, not by a fixed brand palette. This is how good multi-programme cultural houses avoid stereotypes: the identity is a frame, and the artists and editions bring the colour.

**Fixed brand (every surface)**

| Token | Hex | Role | Contrast |
| --- | --- | --- | --- |
| Papier | `#FAFAF7` | ground | — |
| Encre | `#141432` | text, logo, UI, all rules, statuses (shapes) | 17.08:1 |
| Sodium | `#E8590C` | **only** the plug, the strand and the focus ring | 4.99:1 on encre (non-text) |
| Sodium texte | `#B4430A` | links / inline signal text | 5.36:1 |

**Edition inks (Soirées posters and social only, one per edition, chosen with the programmed artists)**

These are a small library of riso-available inks, used *with* encre or sodium as a two-ink job. They are never permanent branch colours, and never more than one per edition. Hexes are approximate screen previews of the riso inks.

| Edition ink | Approx. hex | Note |
| --- | --- | --- |
| Federal Blue | `#3D5588` | 7.04:1 on papier, usable as text |
| Burgundy | `#914E72` | 5.68:1 on papier, usable as text |
| Teal | `#00838A` | 4.35:1. **Non-text / large display only** |
| Orange (riso) | `#FF6C2F` | for sodium-led editions |

**Rules for C**
- The website, Réseau, Organiser and statuses are ink + sodium only.
- The products keep their own skins.
- An edition ink never sits next to another edition ink, and never with gold or turquoise.
- Fluorescent pink and gradients are excluded.
- **Gains:**
  - one-colour = identical brand;
  - riso = encre + 1 edition ink;
  - recognisability lives in the coil, the type and the sodium plug;
  - cultural specificity comes from real editions, never from a palette pretending to be "Arab" or "Afro".
- **Cost:** it needs an edition-design routine, i.e. a poster template plus an ink-choice step with the artists.

## Hand-off note

Token changes go to **tekdesigner** for encoding; I do not edit `tokens.css`. The architecture choice (B vs C vs keep A) is the **founder's** decision.

POSITION: Keep Encre + Sodium as the only umbrella colours. Remove the five branch hues from the umbrella (branches are named, not coloured). Make statuses neutral shapes. Prefer C (fixed two-ink frame + per-edition ink), with B as the low-risk fallback | CONFIDENCE: 78% | RISK: I would block any palette that keeps branch hues identical to status hues, uses sodium as a status, keeps amber `#E8B04B` as an umbrella colour (it fails 3:1 and drifts to "desert"), or adds more than two inks to any print job.
