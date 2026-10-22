# Round 2 — tekcreativedirector (structured challenge, colour only)

> Evidence: comparison-board, vision-board, full renders 1/3/5 for 0, A, B, C, the metrics.md files and the research file. I computed the new contrast values with the WCAG formula.

## 1. Challenge to the other experts

**tekbranddesigner**
- **Strongest point:** the one-colour and two-ink riso test. The renders bear it out: only ink, paper and sodium survive in the grayscale column.
- **Most dangerous assumption:** that "warmth comes from photography and Arabic type". None exists yet. Until it does, colour is the only warmth we can ship, so the ground has to do part of that work.

**tekdesigner**
- **Strongest point:** the token-job audit. Identical status/branch hexes and the orange focus ring sitting on the orange cable are real, measured defects.
- **Most dangerous assumption:** that A is a step "towards C". A keeps five branch hues and adds a prune Organiser. It entrenches the rainbow legend instead of retiring it. A fixes compliance, not meaning.

## 2. Scores (1–5)

| | A Bobine affinée | B Nuit éditoriale | C Encre + invitée |
|---|---|---|---|
| Brand fit | 3: correct but still "calm edtech"; events page is all paper and grey | 4: the Soirées hero on Nuit finally says "night" | 4: the frame is pure Tekonest; the prune poster still reads as us because the coil and sodium hold |
| Distinctiveness | 2: navy + orange + 4 cables = generic SaaS doors | 3: night/day split is ownable; teal/raspberry/bronze cables are boutique-generic | 4: ink-only doors + one guest ground is rare in nightlife |
| Emotional range | 2: one register (day) | 4: day for information, night for culture | 4: range lives in the guest ground; but the website itself is the coldest of all four |
| Legibility | 4 | 4: écru reads well; sodium on sunken is thin (3.10) | 4: ink everywhere |
| Accessibility | 4: all pass, but hue is still a branch cue | 4: passes; margins on écru are thin | 4: patterns pass CVD and grayscale, but dotted/dashed **collide with the status shapes** (see 3) |
| Cross-service coherence | 3: amber/blue leak from the products as umbrella cables | 3: écru drifts from white TekPractice; cables still leak | 5: products keep their skins; the umbrella is neutral |
| Maintenance | 4: small diff | 3: two grounds plus five cables | 3: needs a guest-colour routine; patterns add CSS |

## 3. Defects seen in the renders

- **A, events (3):** no night anywhere. The hero is paper with a 60 px orange rule. It is too timid for a party page.
- **B, events (3):** the Nuit hero is right, but its right half is empty navy. The sodium rule is the only light, so it reads as a "dark corporate banner", not a room.
- **B, home doors (1):** teal + raspberry + bronze on écru reads as heritage boutique or tea-house. It reintroduces the branch hues we agreed to drop.
- **C, doors (1) + vision board:** the Organiser **dashed** cable sits beside the **dashed-ring** "plus tard" status, and Apprendre's **dotted** cable echoes the dotted "later" ring. Patterns now carry two meanings, the same defect we killed in hue. Dashes also read as "unfinished/wireframe".
- **C, poster (5):** prune `#5B2A4E` with sodium clair is handsome, but as the *default* render it implies "Tekonest = plum". Plum + orange also edges towards "sunset/spice". It must stay a per-night guest, never the default.
- **All:** the nav underline is still sodium on product pages that have their own accent. Forbid sodium next to a product accent in the same strip.
- **Forbid:** a guest colour beside Nuit in the same artefact; pale guest + pure sodium; any two guest colours together.

## 4. Final position

Hybrid **C frame + B night**. This is consistent with round 1, sharpened by the renders: no position change.
- **Umbrella:** ink + paper + sodium only. Every door rule is a **solid ink 3 px**, and the branch is carried by its name. **Drop C's patterns** (collision with the status shapes).
- **Paper:** `#F8F6F1` (a half-step towards B, not écru). Ink 15.93:1, sodium 3.31:1, captions `#6B6B8A` 4.75:1. Reject B's `#F2EEE7` sunken band (sodium 3.10, too thin).
- **Soirées:** B's Nuit `#1B1736` full-bleed hero, with type `#F4F0EA` (15.13:1), Brume `#B9B2CC`, and sodium clair `#FF8A4C` (7.36:1). The coil + strand must sit in the empty right half: same geometry, colour only.
- **Default poster ground** = Nuit `#1B1736`. A guest colour (e.g. prune `#5B2A4E`, text 9.81:1, sodium clair 4.77:1) replaces Nuit only per night, chosen with the artists.
- **Statuses:** ink shapes as rendered, 12 px.

POSITION: C frame (ink + paper + sodium, solid ink rules, no branch hues or patterns) + B Nuit for Soirées and default posters + guest colour per night | CONFIDENCE: 78 | RISK: I block branch hues on the umbrella (A/B cables), pattern cables that reuse status shapes, a guest colour as the default poster ground, sodium on `#F2EEE7`, and plum/gold/teal guest sets presented as "cultural" codes.
