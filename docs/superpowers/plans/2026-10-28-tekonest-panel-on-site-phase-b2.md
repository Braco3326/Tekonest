# Tekonest marquetry panel on the site, Phase B2: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the approved marquetry panel on the Tekonest site: the making animation as the home hero, its parts as dividers, card frames, textures, a footer seal and list bullets, with no video and no new dependency.

**Architecture:** The panel already exists as deterministic canvas code in `visuals/lib/` (`damas.js`, `nest.js`, `panel.js`). This plan (1) exposes the few drawers the site needs, (2) renders the static images from that same code with the existing Playwright dev dependency, (3) bundles the code into one small script for the home page, (4) rewires the HTML and CSS, and (5) extends the browser checks. Sources stay in `visuals/`, outside the published `website-prototype/` folder.

**Tech Stack:** Node 24 (`node:test`), plain HTML/CSS/JS, canvas 2D, Playwright Chromium (already installed as a dev dependency) including its WebP encoder.

**Spec:** `docs/superpowers/specs/2026-10-28-tekonest-two-doors-design.md`, sections 7.3, 7.6 and 8 (decisions 11 to 15).

## Global Constraints

- Work only in `C:\Users\braco\dev\tekonest-site` on branch `site/visuals`. Never push, never deploy, never switch branch. Never stage `design/09-logo-nest/TEKONEST-lockup-reverse.svg`, `TEKONEST-lockup.svg` or `TEKONEST-wordmark.svg` (Windows case collision); always `git add` explicit paths.
- Windows: use `npm.cmd` and `npx.cmd`. No new dependency of any kind (Playwright and axe-core are already dev dependencies).
- Everything inside `website-prototype/` is published. Sources (`visuals/`) are not; the bundle and rendered images are generated into `website-prototype/assets/` and committed, like the built pages.
- Never edit `website-prototype/tekpractice/jouer/`.
- Budgets (measured on 28 Oct 2026, see Task 2): JS loaded on the home page (`site.js` + `panel.js`) ≤ 25 KB gzip (the bundle is about 15 KB today); hero poster ≤ 120 KB at 720 px and ≤ 180 KB at 1200 px; each divider tile ≤ 20 KB; closing texture ≤ 150 KB; the *Se former* field crop ≤ 150 KB. (The spec's earlier 60 KB poster figure is corrected in Task 8.)
- Motion rules: ease-out only, no glow, no particles, no spin, no text in the artwork. Reduced motion, `Save-Data` and no JS show the poster only. Anything that moves for more than 5 seconds has a real pause button.
- The mark is the brand mark as continuous loops, no cuts, Papier white `#F3EDE3`.
- French typography and honesty rules of the Phase A plan still hold (narrow no-break space before `; : ! ?` and inside « », status vocabulary, no new claim that anything is available, no point médian).
- Phase A checks must stay green: `node --test` from `website-prototype/` (24 tests today) plus whatever this plan adds.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- **LCP and layout shift on the home page:** the poster must be the LCP element (eager, `fetchpriority="high"`, explicit `width`/`height`) and the hero figure must reserve its square before the canvas appears. Pinned in Task 5 (markup) and Task 7 (browser LCP and CLS = 0).
- **Reduced motion, `Save-Data`, no JS:** the canvas must never start and the poster must stay visible. Pinned in Task 7.
- **Pause control:** keyboard operable, with `aria-pressed` and a visible label that changes, hidden again once the animation has finished. Pinned in Task 7.
- **Seamless repeating tiles:** the rope, sawtooth and diamond-in-triangle tiles must not show a seam where they repeat, at 1× and 2×. Pinned in Task 2.
- **Leftovers of the old hero:** ids and files the removed script used (`nid-stage`, `nid-son`, `nid-replay`, `home.js`, `texture-damas.*`, the `.bande` rule) must be gone from HTML, CSS and `assets/`, and no page may keep a dangling link. Pinned in Tasks 4 and 5.

---

### Task 1: Reusable drawers in the panel library

**Files:**
- Modify: `visuals/lib/panel.js`
- Create: `website-prototype/tools/visual.test.mjs`

**Interfaces:**
- Consumes: the existing `Panel.build`, `Panel.render`, `Damas.buildKhatam`, `Nest.build`, `Nest.draw`.
- Produces (all on `window.Panel`):
  - `Panel.drawRoundel(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, opts?: { mark?: string }): void`: the static roundel (cut-out disc, hairline rings, gold wire, the mark as continuous loops; `mark` defaults to `#F3EDE3`).
  - `Panel.fieldTexture(ctx, x0: number, y0: number, cols: number, rows: number, S: number, opts?: { seed?: number, hand?: number }): void`: the 8-fold strapwork field on a `cols`×`rows` lattice of octagons with apothem `S`, drawn with the same piece styling as the panel.
  - `Panel.tile(ctx, type: "rope" | "tri" | "saw", t: number): { w: number, h: number }`: draws one seamless repeating tile at the origin on a transparent ground (no strip base fill, hand imperfection 0) and returns its size. Widths are exactly two units: rope `2 * round(1.6 * t)`, tri `2 * round(0.95 * t)`, saw `2 * round(0.667 * t)`; height is `t`.
- `visuals/panel-poster.png` stays the reference for the unchanged still.

- [ ] **Step 1: Write the failing tests** in `tools/visual.test.mjs` (they drive Chromium through `@playwright/test`, serve nothing, and load `visuals/panel-motion.html?t=…` by `file://` URL): `Panel exposes the site drawers` (each of `drawRoundel`, `fieldTexture`, `tile` is a function); `the still frame is unchanged by the refactor` (render `panel-motion.html?t=10` and compare with `visuals/panel-poster.png`, differing pixels ≤ 0.3 %, threshold 8 per channel); `tile returns the specified sizes` (`tile(ctx, "rope", 25)` is `80×25`, `tile(ctx, "tri", 40)` is `76×40`, `tile(ctx, "saw", 24)` is `32×24`); `tiles repeat without a seam` (for each type, draw the tile on a transparent canvas of its returned size and compare its first and last pixel columns: mean absolute channel difference ≤ 40 on opaque pixels, and the alpha of both columns within 40); `drawRoundel leaves the corners transparent and the centre dark` (alpha 0 at the canvas corner, near-black opaque at the centre).
- [ ] **Step 2: Run** `node --test tools/visual.test.mjs` from `website-prototype/`. Expected: the first test FAILS (`undefined is not a function`), the pixel test passes.
- [ ] **Step 3: Implement the three functions** in `panel.js` by extracting, not duplicating: the field piece drawing now inside `build()` becomes a shared `drawFieldPiece(ctx, piece, clip)` used by both the panel items and `fieldTexture`; the roundel drawing used by the `disc`, `ring1`, `ring2`, `wire` and `mark` items becomes `drawRoundel`, called at progress 1; `tile` calls the existing strip builders (`rope`, `tri`, `saw`) with a new optional `hand` argument (default 0.5 so the panel is unchanged, 0 for tiles) and draws every cell but not `base()`.
- [ ] **Step 4: Run** `node --test tools/visual.test.mjs`. Expected: all PASS. Then run `node tools/check-visual.mjs ../visuals/panel-motion.html 500`. Expected: three `OK` lines.
- [ ] **Step 5: Commit**

```bash
git add visuals/lib/panel.js website-prototype/tools/visual.test.mjs
git commit -m "visuals: roundel, field texture and tile drawers for the site"
```

### Task 2: Render the static images from the same code

**Files:**
- Create: `visuals/assets.html`, `website-prototype/tools/render-assets.mjs`, `website-prototype/tools/assets.test.mjs`, and the generated `website-prototype/assets/img/panel/*.webp`

**Interfaces:**
- Consumes: Task 1's `Panel.drawRoundel`, `Panel.fieldTexture`, `Panel.tile`; `Panel.build`, `Panel.render`.
- Produces: `render-assets.mjs` exporting `renderAssets(outDir: string): Promise<{ name: string, bytes: number }[]>` (also a CLI: `node tools/render-assets.mjs [outDir]`, default `assets/img/panel/`). `visuals/assets.html` exposes `window.ASSETS: { name: string, width: number, height: number, quality: number }[]` and `window.renderAsset(name: string): string` (a `data:image/webp` URL). Files written, exactly:
  - `hero-poster-720.webp` (720×720, q 0.7) and `hero-poster-1200.webp` (1200×1200, q 0.7): the panel's final frame, panel only, no outer margin.
  - `og-share.webp` (1200×630, q 0.8): Nuit `#131114` ground, panel centred at 590 px.
  - `rope-tile-1x.webp` (80×25), `rope-tile-2x.webp` (160×50), `tri-tile-1x.webp` (76×40), `tri-tile-2x.webp` (152×80), `saw-tile-1x.webp` (32×24), `saw-tile-2x.webp` (64×48): transparent, lossless-leaning (q 0.95).
  - `closing-texture.webp` (1600×900, q 0.6): `fieldTexture` on Nuit, `S = 56`.
  - `sefo-field.webp` (900×900, q 0.6): `fieldTexture`, `S = 64`, a different seed.
  - `footer-seal.webp` (192×192, transparent, q 0.9): `drawRoundel` with `r = 84`.

- [ ] **Step 1: Write the failing tests** in `tools/assets.test.mjs`: `all assets are produced with the specified sizes` (call `renderAssets` into a temp directory; the file list equals the list above and each file's pixel size matches, read from the WebP header with a small helper); `budgets hold` (poster 720 ≤ 120 KB, poster 1200 ≤ 180 KB, every tile ≤ 20 KB, closing texture ≤ 150 KB, `sefo-field` ≤ 150 KB); `rendering twice gives the same bytes` (two temp directories, equal SHA-256 per file); `the committed images are current` (a fresh render equals `assets/img/panel/*` byte for byte, with the hint `node tools/render-assets.mjs`).
- [ ] **Step 2: Run** `node --test tools/assets.test.mjs`. Expected: FAIL (`render-assets.mjs` not found).
- [ ] **Step 3: Implement `visuals/assets.html`** (loads the three libs, defines `ASSETS` and `renderAsset`, each asset drawn with the Task 1 drawers and encoded with `canvas.toDataURL("image/webp", quality)`; tiles on transparent canvases) **and `render-assets.mjs`** (launches Chromium, loads `visuals/assets.html` by `file://` URL, calls `renderAsset` per entry, writes the decoded bytes; throws if a tile's first and last columns differ by more than the Task 1 seam limit, so a bad tile is never written). Add `"render:assets": "node tools/render-assets.mjs"` to `package.json`.
- [ ] **Step 4: Run** `node tools/render-assets.mjs`, then `node --test tools/assets.test.mjs`. Expected: PASS. If a budget fails, lower that asset's quality in `ASSETS` (never the size) and re-run; record the final qualities in the commit message.
- [ ] **Step 5: Commit**

```bash
git add visuals/assets.html website-prototype/tools/render-assets.mjs website-prototype/tools/assets.test.mjs website-prototype/package.json website-prototype/assets/img/panel
git commit -m "assets: render the panel's posters, dividers, textures and seal from the same code"
```

### Task 3: Bundle the code and write the hero bootstrap

**Files:**
- Create: `visuals/hero-panel.js`, `website-prototype/tools/build-visuals.mjs`, `website-prototype/tools/bundle.test.mjs`, and the generated `website-prototype/assets/js/panel.js`

**Interfaces:**
- Consumes: `window.Panel` (`build`, `warm`, `render`).
- Produces: `build-visuals.mjs` exporting `bundle(): string` (the contents of `damas.js`, `nest.js`, `panel.js`, `hero-panel.js`, in that order, each separated by `\n;\n`, preceded by a header comment `/* Generated by tools/build-visuals.mjs from visuals/. Do not edit. */`) and a CLI writing `assets/js/panel.js`. `hero-panel.js` defines no global; it looks for `figure.hero-panel` and, inside it, `img.hero-panel__poster`, `canvas.hero-panel__canvas` and `button.hero-panel__pause`.

Behaviour of `hero-panel.js`:
- Does nothing when there is no `figure.hero-panel`, when `matchMedia("(prefers-reduced-motion: reduce)").matches`, or when `navigator.connection && navigator.connection.saveData`.
- Starts once, after the `load` event and an idle moment, when the figure is at least 40 % in view and the document is visible; resumes the same animation (never restarts it) if the tab is hidden and shown again.
- Builds `Panel.build(980, { seed: 1306, hand: 1.4 })`, calls `Panel.warm(model)`, sizes the canvas to the figure's width times `min(devicePixelRatio, 2)`, draws frame 0, then removes `hidden` from the canvas and the pause button; the poster stays in the DOM underneath.
- Draws with `Panel.render(ctx, 490, 490, model, t, { live: true })` under a scale of `canvas.width / 980`, `t` from `requestAnimationFrame`, stopping at `model.duration` (10 s) and holding the last frame; on finish the pause button gets `hidden` again.
- The pause button toggles running state, `aria-pressed` (`"false"` while playing), and its label between `Mettre en pause l'animation` and `Reprendre l'animation`.
- Re-sizes on window resize (debounced 150 ms) and redraws the current frame.

- [ ] **Step 1: Write the failing tests** in `tools/bundle.test.mjs`: `the bundle holds the four sources in order` (first line is the header; the positions of `window.Damas =`, `window.Nest =` or `g.Nest =`, `g.Panel =` and the bootstrap marker `hero-panel` increase); `the committed bundle is current` (equals `bundle()` after `\r\n` normalisation, hint `node tools/build-visuals.mjs`); `the bundle is within budget` (gzip of `assets/js/panel.js` plus gzip of `assets/js/site.js` ≤ 25 × 1024 bytes); `the bootstrap never starts under reduced motion or Save-Data` (source contains both guards; a real browser check follows in Task 7); `no globals are added` (the file defines no `var`/`function` at top level outside IIFEs, checked by running it in `node:vm` with a stub `window` and asserting `Object.keys(context).length` did not grow beyond `window`).
- [ ] **Step 2: Run** `node --test tools/bundle.test.mjs`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `visuals/hero-panel.js` and `build-visuals.mjs`** as specified above; add `"build:visuals": "node tools/build-visuals.mjs"` to `package.json`.
- [ ] **Step 4: Run** `node tools/build-visuals.mjs && node --test tools/bundle.test.mjs`. Expected: PASS, with the gzip total printed in the test output.
- [ ] **Step 5: Commit**

```bash
git add visuals/hero-panel.js website-prototype/tools/build-visuals.mjs website-prototype/tools/bundle.test.mjs website-prototype/assets/js/panel.js website-prototype/package.json
git commit -m "site: bundle the panel code and the hero bootstrap into one small script"
```

### Task 4: Tokens, dividers, card frames, bullets, hero layout (CSS only)

**Files:**
- Modify: `website-prototype/assets/css/tokens.css`, `website-prototype/assets/css/site.css`, `website-prototype/tools/site.test.mjs`

**Interfaces:**
- Consumes: the tiles from Task 2.
- Produces: CSS variables `--pearl: #E8DFD0`, `--pearl-dim: #CBBFAD`, `--walnut-dark: #3A281C`, `--ebony: #14100E`, `--wire: var(--color-amber)` (added only if not already defined; `--noyer` stays the walnut); classes `.rule`, `.rule-rope` (height 25 px, tile 80×25), `.rule-tri` (40 px, 76×40), `.rule-saw` (24 px, 32×24), each `repeat-x` with `background-image: url(assets/img/panel/<name>-tile-1x.webp)` and an `image-set` at 2×; `.hero-panel`, `.hero-panel__poster`, `.hero-panel__canvas`, `.hero-panel__pause`, `.hero-nuit__grid`, `.branch-hero__grid`, `.branch-hero__art`, `.site-footer__seal`.

- [ ] **Step 1: Write the failing tests** (read `site.css` and `tokens.css`): `the new tokens exist`; `the dividers use the rendered tiles` (each `.rule-*` rule contains the matching `assets/img/panel/*-tile-1x.webp` and `repeat-x`, and the file exists); `the old diamond strip is gone` (no `.bande` selector and no `bande` in `site.css`, no `.site-footer::before` strip); `the old hero canvas and replay button are gone` (no `.hero-nuit canvas`, no `.btn-replay` rule); `cards carry nested fillets` (the `.door.cadre, .family.cadre` rule has an inset `box-shadow` with two hairlines); `lists use the star bullet` (`.cols ul` has `list-style: none` and its `li` a `background` data-URI star); `the hero figure reserves its square` (`.hero-panel` has `aspect-ratio: 1`); `the old halo animation is gone` (no `halo-turn` keyframes and no `.direction` selector; the other existing animations are left alone).
- [ ] **Step 2: Run** `node --test tools/site.test.mjs`. Expected: the new tests FAIL.
- [ ] **Step 3: Edit the CSS.** Add the tokens; add the `.rule*` classes; remove `.bande`, the footer `::before` strip, `.hero-nuit canvas`, `.btn-replay` rules (and `.hero-actions .btn-replay`), `.cta-nuit__bg img` (replace by `.cta-nuit__bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .38; }`), and the unused `.direction*`, `.medaillons*` rules; make `.hero-nuit` a two-column grid at ≥ 801 px (`.hero-nuit__grid`: text 1fr, figure `min(46vw, 560px)`, centred vertically) and a single column below (figure first, 86 vw max); style `.hero-panel` (position relative, `aspect-ratio: 1`, `margin: 0`), the poster and canvas (`position: absolute; inset: 0; width: 100%; height: 100%`), and the pause button (bottom-left, reuse the removed `.btn-replay` look: 1 px `#857B81` border, 44 px min height, focus ring `var(--focus-color)`); give `.door.cadre, .family.cadre` `box-shadow: inset 0 0 0 5px var(--color-surface), inset 0 0 0 6px var(--noyer)`; set `.cols ul { list-style: none; padding: 0 }` and `.cols li` a 12 px prune star as `background` (data-URI SVG of two squares, one turned 45°, stroke `%23612D45`) with `padding-left: 1.5rem`; add `.branch-hero__grid` (two columns at ≥ 801 px, the art hidden at ≤ 800 px) and `.site-footer__seal` (96 px).
- [ ] **Step 4: Run** `node --test`. Expected: PASS (the pages still reference removed classes until Tasks 5 and 6, which only matters to tests added there).
- [ ] **Step 5: Commit**

```bash
git add website-prototype/assets/css website-prototype/tools/site.test.mjs
git commit -m "css: panel tokens, rope/tri/saw dividers, nested card fillets, star bullets, hero layout; retire the diamond strip"
```

### Task 5: Home page markup and removal of the old hero

**Files:**
- Modify: `website-prototype/src/pages/index.html`, `website-prototype/tools/site.test.mjs`
- Delete: `website-prototype/assets/js/home.js`, `website-prototype/assets/img/photos/texture-damas.jpg`, `website-prototype/assets/img/photos/texture-damas.webp`

**Interfaces:**
- Consumes: Task 2 images, Task 3 script, Task 4 classes.
- Produces: the home hero figure and dividers as specified in the checks below.

- [ ] **Step 1: Write the failing tests** (built `index.html`): `the hero is the panel figure` (one `figure.hero-panel` holding `img.hero-panel__poster` with `src` `assets/img/panel/hero-poster-720.webp`, `srcset` listing the 720 and 1200 files with `720w`/`1200w`, `sizes`, `width="720"`, `height="720"`, `fetchpriority="high"`, no `loading="lazy"`, and an `alt` that starts with `Panneau de marqueterie`; a `canvas.hero-panel__canvas` with `hidden` and `aria-hidden="true"`; a `button.hero-panel__pause` with `hidden`, `type="button"`, `aria-pressed="false"`); `the hero text is unchanged` (the h1 `Un nid pour les métiers du son.`, the lead, the honesty line and the `Les deux entrées` button are all still present); `the old hero is gone` (no `nid-stage`, `nid-son`, `nid-replay`, `home.js`, `texture-damas`, `class="bande"` anywhere in `index.html`, and no file `assets/js/home.js` or `texture-damas.*`); `the dividers follow the mapping` (a `rule-rope` divider immediately after the hero section, a `rule-saw` divider immediately before the status board section, no other divider); `the closing band uses the field texture` (an `img.cta-nuit__bg` with `assets/img/panel/closing-texture.webp`, `alt=""`, `width="1600"`, `height="900"`, `loading="lazy"`); `only the home page loads the panel script` (`index.html` has exactly one `<script src="assets/js/panel.js" defer>`, no other page does, and `assets/js/panel.js` exists); the link and anchor test from Phase A still passes.
- [ ] **Step 2: Run** `node --test`. Expected: the new tests FAIL.
- [ ] **Step 3: Edit `index.html`.** Replace the hero's canvas, `.cadre-filet`, sound and replay buttons with a `.wrap.hero-nuit__grid` holding the text block (unchanged copy, one action: the `Les deux entrées` link) and the figure, with this markup: `<figure class="hero-panel"><img class="hero-panel__poster" src="assets/img/panel/hero-poster-720.webp" srcset="assets/img/panel/hero-poster-720.webp 720w, assets/img/panel/hero-poster-1200.webp 1200w" sizes="(max-width: 800px) 86vw, 560px" width="720" height="720" fetchpriority="high" decoding="async" alt="Panneau de marqueterie : un cadre de bandes autour d'un champ de lanières, et la marque Tekonest au centre, dans un médaillon."><canvas class="hero-panel__canvas" width="720" height="720" hidden aria-hidden="true"></canvas><button class="hero-panel__pause" type="button" aria-pressed="false" hidden>Mettre en pause l'animation</button></figure>` (write `&#8239;` before the colon in the alt). Replace the three `.bande` divs as the mapping says (rope after the hero, saw before the status board, none elsewhere); replace the `picture.cta-nuit__bg` with the `img` above; replace the `home.js` script tag with `panel.js`. Delete the three old files with `git rm`.
- [ ] **Step 4: Run** `node tools/build.mjs && node --test`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add website-prototype/src/pages/index.html website-prototype/index.html website-prototype/tools/site.test.mjs
git rm -q website-prototype/assets/js/home.js website-prototype/assets/img/photos/texture-damas.jpg website-prototype/assets/img/photos/texture-damas.webp
git commit -m "site: the home hero is the panel being made; dividers and closing texture from the panel; old hero removed"
```

### Task 6: Branch pages, footer seal and share image

**Files:**
- Modify: `website-prototype/src/pages/{apprendre,creer,histoire,contact,accessibilite,tekpractice}.html` and their built pages, `website-prototype/tools/build.mjs`, `website-prototype/tools/site.test.mjs`

**Interfaces:**
- Consumes: Task 2 images, Task 4 classes.
- Produces: the page-level dividers, the footer seal and credit, the `og:image` tag.

- [ ] **Step 1: Write the failing tests**: `every branch page has a rope divider right after its hero` (for `apprendre`, `creer`, `histoire`, `contact`, `accessibilite` and, if it has a `.branch-hero`, `tekpractice`: the first `.rule-rope` follows the closing tag of the first `.branch-hero` section directly); `creer opens with the diamond-in-triangle band` (the first element in `<main>` of `creer.html` is `.rule-tri`); `apprendre shows the field crop` (`.branch-hero__grid` with an `img.branch-hero__art` using `assets/img/panel/sefo-field.webp`, `alt=""`, `width="900"`, `height="900"`, `loading="lazy"`); `every page has the footer seal and a saw divider before the footer` (an `img.site-footer__seal` with `assets/img/panel/footer-seal.webp`, `alt=""`, `width="96"`, `height="96"`, `loading="lazy"`; a `.rule-saw` immediately before `<footer`); `the credit line is in the footer` (the footer text contains `Motifs inspirés de la marqueterie de Damas` and `Géométrie reconstruite par Tekonest.`, and still contains the Phase A tagline and date); `every page declares the share image` (a `<meta property="og:image" content="https://tekonest.com/assets/img/panel/og-share.webp">` in the head); the Phase A banned-string and link tests still pass.
- [ ] **Step 2: Run** `node --test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** In each fragment add the rope divider after the hero section; add `.rule-tri` at the top of `creer.html`; wrap the `apprendre.html` hero content in `.branch-hero__grid` and add the art image; in `build.mjs` change the layout: add the `og:image` meta, add `<div class="rule rule-saw" role="presentation"></div>` before `<footer>`, add the seal image inside the footer's first block, and append ` Géométrie reconstruite par Tekonest.` to the `fine` paragraph (write the `&#8239;`-free sentence exactly so the Phase A footer assertions still match).
- [ ] **Step 4: Run** `node tools/build.mjs && node --test`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add website-prototype/src/pages website-prototype/*.html website-prototype/tools/build.mjs website-prototype/tools/site.test.mjs
git commit -m "site: dividers, footer seal, credit line and share image across the pages"
```

### Task 7: Browser verification of motion, loading and accessibility

**Files:**
- Modify: `website-prototype/tools/verify-browser.mjs`; screenshots under `design/07-review/screens-2026-10-28-b/`

**Interfaces:**
- Consumes: the whole site, served by `serveStatic` from `tools/static-server.mjs`.
- Produces: extra named checks in the verifier output; it still exits non-zero on any failure.

- [ ] **Step 1: Write the checks** (each prints `OK`/`FAIL` with its name): `home, reduced motion: the canvas stays hidden and the poster stays visible after 2 s`; `home, no JavaScript: the poster is visible and no canvas is`; `home, Save-Data: the canvas stays hidden` (an init script defines `navigator.connection = { saveData: true }`); `home: the poster is the LCP element` (a `PerformanceObserver` for `largest-contentful-paint` reports an `IMG` whose class contains `hero-panel__poster`); `home: layout shift is 0` (sum of `layout-shift` entries without recent input is below 0.001 after load plus 3 s); `home: the animation starts` (after 2.5 s the canvas is visible and the pause button visible); `home: the pause button works by keyboard` (focus it, press Enter: `aria-pressed="true"` and the label `Reprendre l'animation`; press Enter again: `"false"` and `Mettre en pause l'animation`); `home: the pause button goes away when the animation ends` (after 11 s it is hidden, canvas still visible); `every page: axe 0 violations, no overflow at 320, 375, 768 and 1440 px` (320 added for reflow); screenshots at 375 and 1440 px for every page, plus 768 for `index`, `creer`, `apprendre`, to the new folder.
- [ ] **Step 2: Run** `node tools/verify-browser.mjs`. Expected: any FAIL names the broken page or behaviour; fix the page, script or CSS (never weaken a check) and re-run until every line is `OK` and the last line reads `0 violations, 0 overflow, menu OK`.
- [ ] **Step 3: Review the screenshots** of `index` at 375 and 1440 px and `creer` at 1440 px for text overlapping the panel, an empty column, a seam in a divider, or a card frame that clips its text; fix and re-run Step 2 if any appears.
- [ ] **Step 4: Run the Phase B gate:** `node tools/check-visual.mjs ../visuals/panel-motion.html 500`. Expected: three `OK` lines.
- [ ] **Step 5: Commit**

```bash
git add website-prototype/tools/verify-browser.mjs design/07-review/screens-2026-10-28-b
git commit -m "test: browser checks for the hero panel (LCP, CLS, reduced motion, Save-Data, pause) and all pages"
```

### Task 8: Pipeline, documentation and hand-over

**Files:**
- Modify: `website-prototype/package.json`, `website-prototype/README.md`, `docs/superpowers/specs/2026-10-28-tekonest-two-doors-design.md`

**Interfaces:**
- Produces: one command that regenerates every generated file, and an accurate spec.

- [ ] **Step 1: Write the failing test** `tools/pipeline.test.mjs`: `build:all regenerates nothing new` (run `node tools/build.mjs`, `node tools/build-visuals.mjs`, `node tools/render-assets.mjs` and assert `git status --porcelain -- website-prototype/assets website-prototype/*.html` is empty afterwards, ignoring line-ending-only noise).
- [ ] **Step 2: Run** `node --test tools/pipeline.test.mjs`. Expected: FAIL only if a generated file is stale; if it passes immediately, keep it as a guard.
- [ ] **Step 3: Add** `"build:all": "node tools/build.mjs && node tools/build-visuals.mjs && node tools/render-assets.mjs"` to `package.json`; document the three generators, the `visuals/` sources and the budgets in the website README; correct section 8.3 and 8.4 of the spec: poster budget ≤ 120 KB at 720 px and ≤ 180 KB at 1200 px (measured 108 and 172 KB at quality 0.7), closing texture and field crop ≤ 150 KB.
- [ ] **Step 4: Run** `npm.cmd run build:all && node --test`. Expected: all tests PASS with the new totals.
- [ ] **Step 5: Commit**

```bash
git add website-prototype/package.json website-prototype/README.md website-prototype/tools/pipeline.test.mjs docs/superpowers/specs/2026-10-28-tekonest-two-doors-design.md
git commit -m "build: one command regenerates pages, bundle and images; docs and spec budgets corrected"
```

- [ ] **Step 6: Hand over.** Report the commit list, the test totals and the measured sizes (JS gzip, posters, tiles). State what is not covered: a screen-reader pass, Lighthouse, a real-device check of the animation, the real capture for *Se former*, the artisan or expert review, and the Cloudflare cache after any deploy. Do not push: pushing `design/tekonest-umbrella-brand` is what publishes tekonest.com, and any pushed branch gets a public preview.
