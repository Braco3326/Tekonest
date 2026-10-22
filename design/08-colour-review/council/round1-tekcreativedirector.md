# Round 1 — tekcreativedirector (independent analysis)

> Lens: meaning, emotion and the cultural signals colour sends; what each audience feels in the first second.
> Evidence I looked at: baseline renders 1–6, the 07-review screens (index, apprendre, tekpractice, soirees-375), boards A/B/C, `04-design-system.md`, `tokens.css`, `metrics.md`.
> These are **proposals**, not founder decisions. I computed every contrast ratio below with the WCAG formula, against the stated ground.

## First move: what should someone feel in one second?

- Target feeling: "a warm room in Paris at night, run by people who know the craft."
- Today's desktop hero says "calm, competent". It does not say "night".
- The poster (ink ground, white coil, sodium strand) says "night". It is the best render.
- Night-goer: the website feels like an edtech or a fintech. The poster feels like a party.
- Artist: they see respect and clarity, but nothing of their own music.
- Organiser: they feel trust. Navy and white read as "serious partner".
- BTS student: the coil means something to them. Coiling a cable is a ritual they know.
- Verdict: the meaning lives in the coil and the strand, not in the palette.

## 1. What works and should be kept

- Encre de nuit `#16163F`: night without black. Keep it as the brand's voice.
- Sodium `#E8590C`: the Paris street lamp is a real, local and non-ethnic sign. Keep it.
- One warm strand leaving the coil is the strongest idea in the system.
- Papier `#FAFAF7` is a neutral bridge between the dark studio app and white TekPractice.
- The poster's ink ground with paper type should become the default for events.
- The products keep their own skins. That is right and honest.
- Colour arrives only as thin strands. Restraint is the brand. Keep it.

## 2. Does Bobine carry cultural warmth as well as technical precision?

- Precision: yes, clearly. Ink, hairlines and calm paper feel exact.
- Warmth: only partly. 90 % of the surface is cool white and navy.
- The warmth sits in 3 px of orange. On mobile it nearly vanishes.
- The music (Arab/SWANA, Afro, electronic) gets no colour presence at all.
- That is safer than cliché, but it borders on "corporate SaaS calm".
- Warmth should come from **dark editorial grounds and people**, not from ethnic hues.
- On the website the hero is paper. On posters it is night. Swap the weight for Soirées.

## 3. Is the orange in the right role, with the right weight?

- The role is right: one signal, the strand that leaves for the next project.
- But it does triple duty: brand signal, Soirées branch and the "En projet" status.
- Evidence: Réseau (a green cable) carries an orange "Réseau en projet" dot. That muddles the meaning.
- Evidence: the TekPractice page has an orange nav underline above a blue cable rule.
- It is too light on paper screens and well balanced on the ink poster.
- Fix: keep orange only for the brand strand, focus and primary emphasis.
- Release Soirées from owning orange. Remove orange from the status set.

## 4. Five branch accents: useful navigation or fragmentation?

- On the home doors, three rules in three colours read as a SaaS feature grid.
- Five hues next to each other in the status table look like a rainbow legend.
- Visitors navigate by name and task, not by remembering colours.
- Apprendre amber `#E8B04B` fails contrast (1.87:1) and adds a third warm tone.
- Green, amber and orange side by side flirt with pan-African flag readings.
- In grayscale, four of the five cables sit at L\* 41–56, too close to tell apart.
- Verdict: fragmentation. Branch colour does not carry the umbrella meaning; the shared strand does.

## 5. Can status colours be confused with branch colours?

- Yes. They use **identical hexes**: Réseau is the "existe" green and TekPractice is the "dev" blue.
- Sodium-text is both "projet" and the Soirées text colour.
- In the status table the branch underline and the status dot compete.
- In grayscale every status sits at L\* 44–46. Only the label separates them.
- Fix: statuses become **shape plus ink**, never hue (see Option B).

## 6. How the system holds up in each medium

- **Posters:** strong on ink. The sodium strand on night passes (4.81:1). Keep it.
- **Website:** clear but cool. Soirées pages need night grounds to feel like nights.
- **Learning products:** the bridge works because the products keep their own skins.
- **Social assets:** square ink posts work. Paper posts look like an announcement.
- **Small screens:** 3 px rules survive. The orange strand becomes too small in the mobile hero.
- **Monochrome:** ink and paper survive. Branch and status colours collapse, so meaning must not depend on hue.
- **Print:** two inks (navy and orange) are cheap to print and suit risograph. Five cables would add cost. (Production is outside my expertise; this needs checking with print.)

## 7. Unintended stereotypes or clichés

- Navy and orange: no ethnic reading, but a common startup combination. The risk is genericness.
- Amber/gold next to the night ink edges towards "gold on night = oriental".
- Green, amber and orange together come close to a pan-African trio, so never group them.
- Organiser purple `#6A4BC4` is a generic SaaS violet with no meaning.
- Board B's warm-light-on-violet is beautiful, but it reads as nightclub, as already noted.
- No current colour is offensive. The risks come from combinations, not from single hues.

---

## Option B — "Nuit éditoriale" (a warmer, more cultural editorial reading of Bobine)

Idea: day paper for information and night ink for culture. Warmth comes from the ground and the people, not from added hues.

| Token | Hex | Role | Contrast |
| --- | --- | --- | --- |
| Papier | `#FAF8F3` | Day ground. A touch warmer than today, but **not** cream | — |
| Encre de nuit | `#16163F` | Text and logo (kept) | 16.21:1 on Papier |
| Nuit de salle | `#1B1633` | **New full-bleed ground** for Soirées pages, posters, social and the footer: a warmer night | 16.36:1 with Papier type |
| Encre 2 | `#4D4560` | Secondary text, warmed | 8.47:1 |
| Encre 3 | `#6B6480` | Captions only | 5.26:1 |
| Sodium | `#E8590C` | The only brand hue: strand, plug, focus and the key call to action. Non-text | 3.37:1 on Papier, 4.85:1 on Nuit |
| Sodium texte | `#B4430A` | Sodium as text on Papier | 5.28:1 |
| Sodium clair | `#FF8A4C` | Sodium as text on Nuit (event dates, the strand on night) | 7.44:1 |
| Brume | `#B9B2CC` | Secondary text on Nuit | 8.52:1 |

**Branches:** no hue per branch on the umbrella. Each branch is marked by its **name and the position of the strand**, with a ground rule:
- Soirées always on Nuit.
- Réseau and Organiser on Papier.
- Apprendre and TekPractice show their own product skins.

The 3 px rule stays, in ink on Papier and in Sodium clair on Nuit.

**Statuses:** shape plus ink only, always with a label:
- Existe: filled dot.
- En développement: half-filled dot.
- En projet: open ring.
- Plus tard / À décider: dashed ring.

This survives grayscale and print. It also frees sodium from status duty.

## Option C — "Couleur invitée" (my distinct alternative)

Idea: Tekonest stays strictly ink, paper and one sodium strand. Each night, the **artists choose one guest colour** for that night's poster and social posts.

This turns the principle « les artistes programment ; le contexte, pas le costume » into colour. Culture enters through the people's own choice, never through a code we impose. The brand frame stays fixed and recognisable, and the guest colour changes. It is like a festival that keeps its grid and lets each edition own its colour.

**Fixed core (everywhere)**

| Token | Hex | Role |
| --- | --- | --- |
| Papier | `#FAFAF7` | Ground |
| Encre de nuit | `#16163F` | Text, logo, statuses (shapes as in Option B) |
| Sodium | `#E8590C` | Strand, plug, focus only (3.42:1 on Papier, 4.81:1 on ink) |
| Sodium texte | `#B4430A` | Sodium as text (5.36:1) |

**Guest colour set (posters, social, the event page hero only; one per night).** The set is pre-tested, and the names are neutral codes, not cultural labels:

| Code | Hex | Text on it | Plug on it |
| --- | --- | --- | --- |
| G1 pâle | `#CFE3D6` | Ink, 12.79:1 | Sodium texte, 4.17:1 |
| G2 pâle | `#D6D2F0` | Ink, 11.74:1 | Sodium texte, 3.83:1 |
| G3 pâle | `#BFD7EA` | Ink, 11.57:1 | Sodium texte, 3.77:1 |
| G4 pâle | `#E9C7D9` | Ink, 11.17:1 | Sodium texte, 3.64:1 |
| G5 sombre | `#2F5D50` | White, 7.49:1 | `#FF8A4C`, 3.21:1 |
| G6 sombre | `#5B2A4E` | White, 11.13:1 | `#FF8A4C`, 4.77:1 |
| G7 sombre | `#2B3F7A` | White, 10.03:1 | `#FF8A4C`, 4.29:1 |

I left out peach, gold, turquoise and terracotta on purpose, because they carry the clichés.

**Rules**
- One guest colour per artefact.
- Never two guests side by side in brand material.
- The coil and the wordmark are always ink or paper.
- Pure sodium never sits on a pale guest ground; the plug turns Sodium texte.
- **Branches:** no colour. Products keep their own skins.
- **Smile detail:** the year's archive page shows every night as a strand in its guest colour, so the community's colours become the brand's history.

---

## Perspective check

- **End user:** they should feel invited, and see their own night reflected in its colour.
- **Daily user (organisers, students):** a calm, readable ink-and-paper system, with statuses they can trust in black and white.
- **Unexpected detail:** the archive of strands in the guests' colours (Option C).

POSITION: Keep ink, paper and the sodium strand. Drop five branch hues and the coloured statuses (shape plus ink instead). Give Soirées night grounds (Option B) now, and pilot "Couleur invitée" (Option C) for event artefacts. | CONFIDENCE: 75% | RISK: I would block amber or gold on night, green with gold and orange grouped together, identical hexes for status and branch, any palette chosen to "represent" a culture, and neon or gradient nightlife codes.
