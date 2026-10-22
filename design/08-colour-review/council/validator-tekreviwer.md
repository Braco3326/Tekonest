# Validator — tekreviwer (colour only, evaluation only)

> I recomputed every ratio with my own WCAG 2.x script (sRGB linearisation, (L1+.05)/(L2+.05)). I did not use `tools/metrics.py`. I read R from `options/R-recommended-hybrid.json`, `make_options.py`, `render.py` and the site CSS, and sampled pixels in the R renders.

## 1. Methodology adherence: PASS
Each expert kept to their lens: the creative director on meaning, the brand designer on reproduction tests, the designer on token jobs and probes. The brand designer marks riso claims as "trade judgement, not measured", which is honest.

## 2. Internal consistency: FLAG
- **Brand designer:** says the plug is `#FF8A4C` "on a guest ground", and also allows guests from the full G1–G7 list. On the pale guests G1–G4, `#FF8A4C` measures **1.52–1.74:1**. The creative director's own rule (sodium texte on pale grounds) has to apply there.
- **Creative director:** proposes paper `#F8F6F1` but never checks the line tokens. The input border `#8E8EA8` then measures **2.95:1 (fail)**.
- **Creative director:** in round 2 the paper moves from `#FAF8F3` to `#F8F6F1` and the night from `#1B1633` to `#1B1736`, yet the file states "no position change".

## 3. Position changes: PASS
- The brand designer's and the designer's changes each cite a trigger in a render or a measurement.
- The brand designer moved from ink `#141432` back to `#16163F` without logging it. The designer's churn argument supports the move, but it should still be recorded as a change.

## 4. Calibration: FLAG (mild)
The council shows 78/82/78 confidence, but R carries an unresolved conflict: the creative director **blocks** "pattern cables that reuse status shapes", and R ships exactly that. While that dispute stands, aggregate confidence should be no higher than about 70.

## 5. Contrast recomputation: PASS
All 32 claimed pairs match to ±0.01, including every R metric. Two notes:
- The creative director's prune 9.81:1 is for `#F4F0EA`. White on prune is 11.14:1.
- The designer's "≥6.6 on #16163F" is understated: it measures 7.37:1.

There is one category error: R's "Focus ring on footer 16.45:1" checks a pair that never renders (see 6a).

## 6. R fidelity: FLAG
- **a. Focus blocker not fixed.** `--focus-ring: 3px solid var(--focus-color)` is declared at `:root`, so the `var()` resolves to ink there and is inherited already resolved. Redeclaring `--focus-color` in `.site-footer` and in the hero changes nothing, because `site.css` uses `outline: var(--focus-ring)`. Footer focus is still **ink on ink, 1:1**. This is the exact defect the designer blocks.
- **b. Pattern collision.** The "later" status is a **dotted** ring, and Apprendre and TekPractice use **dotted** cables. In render 6 the Organisateurs row also puts a dashed cable beside a dotted "plus tard" ring. In addition, the experts specify the later status as a dashed ring (◌) while the CSS draws it dotted.
- **c. Double line too thin.** The double border is drawn at 5 px on doors and 4 px on the board, against the designer's 6 px. That leaves 1–2 px lines, the same greying risk the designer raised.
- **d. Two oranges on one poster.** In the poster, the lockup plug is `#E8590C` and the coil strand and plug are `#FF8A4C`. This contradicts "plug stays #E8590C except guest grounds" and the avatar single-version risk.
- **e. Guest colour not encoded.** R has no `--guest-accent` and does not write down any of these rules:
  - poster-only vs poster+social (still unresolved: the brand designer says the avatar and templates stay navy);
  - plug ≥3.5:1;
  - drop G5;
  - sodium texte on pale guests;
  - never beside the night ground.
- **f. Disagreements decided silently.**
  - Paper: R keeps `#FAFAF7` over the creative director's `#F8F6F1`. This is correct given the 2.95:1 input border, but it should be logged.
  - Night: R uses `#16163F` with `#D2D2E4`, not `#1B1736` with Brume. The single-navy argument stands, but the creative director's dissent has to be recorded.
- **g. Selectors.** R still uses `[style*=]` selectors. Its own comment says `data-branch`, and the designer blocks `[style*=]`. This is acceptable in a render, not in production.
- **h.** The creative director asked for the coil and strand in the empty right half of the hero. That is a geometry change, out of colour scope, but it should be listed as follow-up.

## 7. Overstated evidence: FLAG
`research/colour_references.md` explicitly finds **no source** naming the gold/turquoise "oriental" palette or red-gold-green as a cliché ("inference, not cited finding"). The experts state these as fact:
- the creative director's "pan-African flag readings", "gold on night = oriental" and "plum + orange edges towards sunset/spice";
- the brand designer's "desert sunset".

Other overstatements:
- **"Paris street lamp is a real, local sign":** the research shows Paris replacing sodium with 2,700 K LED since 2011, so the sign is nostalgic and time-stamped, not current.
- **Brand designer's riso inks:** "riso-available" Federal Blue, Burgundy and Midnight are unverified, because the official RISO list was not retrieved.
- **"This is how good cultural houses avoid stereotypes":** no source is given.

## 8. Colour as sole carrier in R: PASS
- Branches are carried by name and border style, and statuses by shape and label.
- The `aria-current` state adds an underline, not just a hue.
- Native borders survive forced colours.

Weak spot: Apprendre and TekPractice share dotted, so the name alone separates them. That is acceptable, but it should be documented.

## Required corrections
1. Fix the focus ring: use `outline: var(--focus-width) solid var(--focus-color)` in `site.css`, or redeclare `--focus-ring` in every dark scope. Then probe the rendered outline, not a token pair.
2. Make the status/cable sets disjoint. Either draw "later" as a dashed ring and give cables only solid and double, or follow the creative director and make all cables solid ink.
3. Set the double rule to 6 px or more on screen, with a print gap of 0.5 mm or more.
4. Use one plug colour per artefact: `#E8590C` on navy (4.81:1), keeping `#FF8A4C` for strand and text only. Alternatively, recolour the lockup to match.
5. Encode the guest rules: the `--guest-accent` scope, sodium texte on G1–G4, `#FF8A4C` on G6 and G7 only, drop G5, and a founder decision on poster vs social scope.
6. Log the paper and night-ground decisions as dissents with their evidence.
7. Restate the cultural claims as inferences, and date the sodium story.
8. Replace the `[style*=]` selectors with `data-branch`.
