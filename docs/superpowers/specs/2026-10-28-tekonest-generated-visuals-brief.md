# Tekonest generated visuals: production brief

Date: 2026-10-28. Status: **draft for founder review**. Companion to [`2026-10-28-tekonest-two-doors-design.md`](2026-10-28-tekonest-two-doors-design.md), section 7. Tool-agnostic: written for Claude Motion (video) and any image generator for stills and posters.

## 1. How to use it

1. Run the shots in order of priority (section 5). Produce 3 to 5 takes per shot.
2. Keep the best take. Send it back as a file; the poster frame is exported from it.
3. I check each take against section 3 (the constants) and the delivery rules (spec 7.3), then compress and place it. Nothing is published without your go.

## 2. Style in one paragraph

Circles carrying the Damascus design, and nothing else. Rings, discs and medallions in dark walnut, mother-of-pearl, gold leaf and plum-stained wood on a night ground, seen in macro. Each ring is laid one piece at a time and then rests. Slight imperfection is wanted. Nothing glows, nothing explodes, nothing spins.

## 3. Constants (every shot)

| Constant | Value |
| --- | --- |
| Subject | **Circles only** (rings, discs, medallions) carrying a Damascus-inspired pattern. Nothing else is in the frame |
| Ground | Nuit `#131114` |
| Accents | Ambre `#DD9349` (on Nuit only), Prune `#612D45`, Papier `#F3EDE3`, Crème `#EAE2D5` |
| Pattern references | `design/16-chatgpt/refs/ref-4-marquetry.png`, `design/11-damas/damas-board.png`, `design/11-damas/marqueterie-system.png` |
| Nest reference (G6 only) | `design/16-chatgpt/refs/ref-1-nest-geometry.png`: 7 identical ellipses (100:82), each rotated about 51.4°, open centre |
| Camera | Locked-off or a very slow push (under 4% over the whole clip). No handheld, no whip, no zoom pop |
| Frame rate and size | 24 fps, 1920×1080 for wide shots, 1080×1080 for square, 1080×1920 for vertical |
| Text | None in the frame. Ever |
| Sound | No audio track |
| Flashing | None. No change in brightness faster than 3 Hz |
| People | None. No hands, faces, crowds or studios |
| Logo | Never generated. The real logo is composited in code on the final frame |
| Motion rule | Pieces and rings are laid one after another and then rest. No spinning, pulsing or glowing, and no looping of a border pattern |

## 4. Negative list (reject a take if it has)

Anything that is not a circle with the Damascus design: any other shape, line, particle or object. Also: glossy 3D blobs; perfectly symmetric emblems with identical hairlines; photoreal fake "wood and pearl" that looks like a stock texture; fake calligraphy or verses; lanterns; mosaic wallpaper; neon; lens flare; bokeh; readable text; any person.

## 5. Shot list (priority order)

| ID | Name | Where | Length, loop | What happens |
| --- | --- | --- | --- | --- |
| **G1** | Le cercle se pose | Home hero (1920×1080) | 6 s, one-shot, ends on a held frame | Rings of Damascus pattern are laid one after another, from the outside in, each timed slightly differently. One ring hesitates, then seats. They close into a single circular medallion with an **open centre** left for the logo. The last second holds still, composed to leave a calm area for the headline on the left. The held frame is the poster. |
| **G2** | Onde | Home closing band (1920×600) | 10 s, seamless loop | Very slow, tone-on-tone concentric ripples like the layered steel of Damascus, in walnut and plum on Nuit. Almost still. Nothing bright. It replaces the unverified `texture-damas.jpg`. |
| **G3** | Une expérience pour votre projet | Créer avec nous hero (1920×1080, subject on the right half) | 6 s, one-shot, held end frame | One ring is laid, then three more seat around it, each with a different pattern density. They rest as a cluster of four circles. Left half left empty for text. |
| **G4a** | Création sonore | Family card (1080×1080) | 4 s, loop | A circle of fine concentric Damascus lines, laid ring by ring from the centre outward, then settling. |
| **G4b** | Prise de son | Family card (1080×1080) | 4 s, loop | A circle of watered-steel ripples that breathes outward very slowly and returns. |
| **G4c** | Live | Family card (1080×1080) | 4 s, loop | A circle made of diamond-and-square inlay pieces seated one by one around the rim, then still. |
| **G4d** | Direction artistique, mixage et mastering | Family card (1080×1080) | 4 s, loop | Two rings of different patterns slide into alignment and lock, then repeat. |
| **G5** | Un cercle pour apprendre | Se former hero right half (1080×1080) | 5 s, loop | A single disc whose Damascus pattern is laid ring by ring and rests. It sits beside a **real** screen capture, never in place of one. |
| **G6** | Le tissage | Histoire (1920×1080) | 8 s, one-shot, ends on a held frame | Seven circles are drawn one by one, each slightly differently timed, and interlace into the nest. The camera does not move. The last frame is still. |
| **G7** | Teasers | Social, OG | 6 s each: 1:1 and 9:16, plus one still 1200×630 | Cuts from G1 and G6, with no text. Text is added in code or in the post tool. |

## 6. Stills

For each clip, export the final held frame as the poster (WebP, ≤ 60 KB at display size). The Open Graph image (1200×630) is a still of the circular medallion on Nuit with the logo composited in code.

## 7. What I need back

- The chosen takes as MP4 files (best quality available), named `G1.mp4` and so on, with the prompt or settings used for each (so we can re-run a take).
- Any shot you reject, with a one-line reason, so I adjust the brief.
- Your own captures for the "Real" layer: a screen recording of TekPractice (the current Mode Création), a screen capture of the E3 course, and at least one object or recording of yours that can appear on the Histoire page. Real material stays real.

## 8. Open questions

- Should the seven ellipses of the nest in G6 count as the "circles"? I assumed yes, because they are the logo.
- Is there anything in the shot list you would not want to see on the site?
