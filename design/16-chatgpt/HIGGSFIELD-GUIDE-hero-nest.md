# Hero nest: Higgsfield + ChatGPT guide (v4)

## A. How to use it (the cheap way)

1. **Don't paste the long brief into Higgsfield's main box.** That box is an *image prompt*. A long brief confuses the model and still costs credits. Only the **short prompts in part C** go there.
2. **Think in the ChatGPT app (free), generate in Higgsfield (credits).**
   - Paste the **Project bible (part B)** into a normal ChatGPT chat. It opens the reference images itself from GitHub (links below).
   - Use it to judge results and adjust prompts.
   - The "Work with ChatGPT" box in Higgsfield (bottom right) can also work, but it may start generations by itself and spend your credits. Use it only to ask questions.
3. **Higgsfield settings before each run** (the bar under the prompt box):
   - **Image** (not video).
   - **Model: change "Auto" to a fixed cheap model.** Auto may pick an expensive one. Open the model list, compare the credit number, and pick the cheapest model that accepts a reference image (Nano Banana, Seedream or Flux if available).
   - **Ratio: 16:9** for hero frames (yours is on 4:3), 1:1 for the square nest.
   - **Count: 1/4 = 1 image.** Keep it at 1.
   - **"+" → upload `ref-1-nest-geometry.png`** as the reference for every nest frame.
   - The number on the green button is the cost (2 credits now). With ~10 free credits/day that's about 5 images a day, so do **F1 → F2 → F3 first**, and only then the storyboard.
4. Download the images you like and send them to me, named F1-hero.png, F2-hero.png, F3-hero.png… I'll rebuild the chosen one in code (WebGL), so the image is a **style reference**. It doesn't need to be perfect.

---

## Reference images (on GitHub, public)

- ref-1, nest geometry: https://raw.githubusercontent.com/Braco3326/Tekonest/design/tekonest-umbrella-brand/design/16-chatgpt/refs/ref-1-nest-geometry.png
- ref-2, current hero: https://raw.githubusercontent.com/Braco3326/Tekonest/design/tekonest-umbrella-brand/design/16-chatgpt/refs/ref-2-current-hero.png
- ref-4, marquetry details: https://raw.githubusercontent.com/Braco3326/Tekonest/design/tekonest-umbrella-brand/design/16-chatgpt/refs/ref-4-marquetry.png
- Logo source (SVG, exact geometry): https://raw.githubusercontent.com/Braco3326/Tekonest/design/tekonest-umbrella-brand/design/09-logo-nest/tekonest-mark-reverse.svg
- This guide: https://github.com/Braco3326/Tekonest/blob/design/tekonest-umbrella-brand/design/16-chatgpt/HIGGSFIELD-GUIDE-hero-nest.md

**ChatGPT:** don't attach images; the bible below tells it to open these links. **Higgsfield:** it needs the file uploaded with "+". Download ref-1 once from the link and reuse it.

---

## B. Project bible: paste into ChatGPT (once, no attachments needed)

> **First, open and study these reference images (public GitHub links):**
> - ref-1, the exact logo geometry: https://raw.githubusercontent.com/Braco3326/Tekonest/design/tekonest-umbrella-brand/design/16-chatgpt/refs/ref-1-nest-geometry.png (SVG source: https://raw.githubusercontent.com/Braco3326/Tekonest/design/tekonest-umbrella-brand/design/09-logo-nest/tekonest-mark-reverse.svg)
> - ref-2, the current hero: https://raw.githubusercontent.com/Braco3326/Tekonest/design/tekonest-umbrella-brand/design/16-chatgpt/refs/ref-2-current-hero.png
> - ref-4, the marquetry details: https://raw.githubusercontent.com/Braco3326/Tekonest/design/tekonest-umbrella-brand/design/16-chatgpt/refs/ref-4-marquetry.png
>
> If a link fails, tell me and I'll upload the image.
>
> **Project: TEKONEST** (always uppercase in the logo), Paris. A "nest" for the craft of sound and live production. It is an umbrella with three entrances:
> 1. **Se former**: a platform to pass the BTS Métiers de l'audiovisuel, option Son, and **TekPractice**, a 3D simulator to learn how to wire real audio gear (consoles, mics, speakers).
> 2. **Créer avec nous**: organising, accompanying and producing projects with a creative and technical team.
> 3. **Rejoindre le réseau**: technicians and artists who get fairly paid work.
>
> **Values:** honest (every offer shows its real status; nothing is sold yet), fair pay, real craft, French first.
>
> **The logo, the core of the visual (ref-1):** a woven nest of **7 identical ellipses** (ratio 100:82), each rotated 360/7 ≈ 51.4°, centres slightly offset, with an **open empty centre**. 7 threads = the 7 trades of the network: son, lumière, scène, musique, image, production, transmission. The wordmark TEKONEST is set in the font Tektur.
>
> **The hero (ref-2):** on tekonest.com the nest sits on the right of a dark first screen. It forms from dust, then **beats like a loudspeaker membrane (112 BPM)**, sending a thin amber ring and a plum ring outward at each beat. Today it's flat lines; we want a premium, designed look that a developer will rebuild in WebGL.
>
> **Palette:**
> - Nuit `#131114` (background);
> - Papier `#F3EDE3`;
> - Ambre `#DD9349` (light, gold; only on dark);
> - Prune `#612D45`;
> - walnut `#6B4A33`.
>
> **Craft details (ref-4), used sparingly:** inlaid woodwork (walnut, mother-of-pearl, hair-thin gold lines), a 12-point star medallion, square double frames, a thin inlaid band.
>
> **Never:** audio cables, people, crowds, concerts, calligraphy, lanterns, mosaics, folklore clichés, neon, glossy plastic, text or letters in images.
>
> **Your job:** help me get 3 style frames from **Higgsfield on its free plan** (few credits), using its cheapest good model with a reference image.
> - When I show you a result, tell me in 3 bullets what is right, what is wrong (especially whether the 7-loop shape broke), and give me a **corrected Higgsfield prompt under 70 words**.
> - When I've chosen a style, write the WebGL hand-off in this format: THREAD / LIGHT / OVER-UNDER ORDER / BACKGROUND / BEAT / FORMATION / DO-DON'T / RISKS.
>
> Reply "ok" and wait.

---

## C. Higgsfield prompts: paste one at a time (reference: ref-1, ratio 16:9, 1 image)

**F1: Fils de lumière**
> Seven identical glowing ellipses woven into a ring, exactly like the reference shape, open empty centre. Threads of warm light: cream-white cores #F3EDE3, amber glow #DD9349, brighter where loops cross over and under. Soft haze, faint plum glow #612D45 in the centre, fine dust. Deep near-black background #131114. Ring on the right third, left half empty and dark. Minimal, premium, no text.

**F2: Marqueterie**
> Seven identical ellipses woven into a ring, exactly like the reference shape, made of thin mother-of-pearl strips inlaid in dark walnut wood, edged with hair-thin gold lines. Faint inlaid 12-point star behind. Square double-line frame. Slightly top-down view, raking amber light #DD9349 showing relief. Near-black background #131114. Ring on the right third, left half empty. Elegant, minimal, no text.

**F3: Acier de Damas**
> Seven identical ellipses woven into a ring, exactly like the reference shape, forged from dark Damascus steel with flowing layered ripple patterns like frozen sound waves, polished edges catching amber light #DD9349. Very faint ripple lines across the background, tone on tone. Near-black background #131114. Ring on the right third, left half empty and dark. Sculptural, precise, no text.

**Then, with your chosen style (replace [STYLE] with its description):**

S: Storyboard (16:9)
> 2×2 grid of four panels in [STYLE]: 1 scattered particles; 2 particles forming seven woven ellipses, half complete; 3 the complete seven-loop ring at rest, open centre; 4 the ring slightly expanded with one thin amber ring #DD9349 and one plum ring #612D45 travelling outward like a sound wave. Near-black background #131114, no text.

N: Nest alone (1:1)
> The seven-loop woven ring alone, exactly like the reference shape, in [STYLE], centred, isolated on a plain near-black background #131114, sharp details, no text.

---

## D. What to send me

- The F1, F2 and F3 frames you like.
- The storyboard and the square nest, in the chosen style.
- ChatGPT's WebGL hand-off text.
