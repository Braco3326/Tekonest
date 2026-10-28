# Tekonest umbrella site: two doors, then a generated visual layer

Date: 2026-10-28. Status: **draft for founder review**. Phase A (sections 1 to 6 below, structure and content) comes first. Phase B (section 7, generated visuals and motion) follows on the same branch, because it attaches to the Phase A pages. Branch `site/two-doors`, cut from `origin/design/tekonest-umbrella-brand` (`6485dc0`). Local only: nothing is pushed or deployed.

## 1. Purpose

Bring the public umbrella site (`website-prototype/`, live at tekonest.com) in line with the founder's 28 Oct definition of Tekonest, without changing its visual identity.

Success looks like this: a visitor sees **two doors**, *Se former* and *Créer avec nous*. The second door is a client-facing creative and technical service, "une expérience au service de votre projet". Nothing on the site mentions a network, and nothing promises what does not exist.

## 2. Decisions already taken (founder, 28 Oct 2026)

| # | Decision |
| --- | --- |
| 1 | The umbrella has two doors: **Se former** (Apprendre platform + TekPractice) and **Créer avec nous**. |
| 2 | Door names stay as they are. |
| 3 | **Créer avec nous** is a service for people with a project (show, film, event, artistic project) who want to discuss it with the Tekonest team. Four families: création sonore (composition sonore et cinématique, sound design); prise de son (tournage, captation); live (DJ set, prestation technique à la demande); direction artistique, mixage et mastering. |
| 4 | The artist and technician **network is set aside**: removed from the public site and the map's visible structure. Its files stay in git history (nothing is deleted). It was built for the Rebels pilot. |
| 5 | Rebels × Tekonest stays a separate project. |
| 6 | Legal questions (structure, pay rules, performer and licence rules) are discussed after the structure is settled. They are out of scope here and no legal claim is added. |
| 7 | Phase A scope: structure and content on the current identity (Nuit, Papier, Crème, Ambre, Prune; Tektur; Damas motifs). No new visual direction. |
| 8 | Phase B: the next level of the site comes from rich visuals and motion rendered to video. Claude Motion builds animations as code (shapes, text, images) and exports MP4; it is not a video-generation model, so the clips are made either in Claude Motion (if the founder's plan has it) or as deterministic canvas animations in `visuals/` by the assistant, then rendered. Code is used only for what code does better (see 7.1). |
| 9 | The identity stays fixed in Phase B: generated assets are art-directed to it, and the exact logo, text and interface are always code on top. |
| 10 | Generated visuals are **circles with the Damascus design and nothing more**. |

## 3. Out of scope

- A new visual direction (the identity stays) and a public "all angles" (2D/3D/4D/5D) element. Revisit later.
- A coded WebGL hero. Superseded by the generated hero film (Phase B).
- Legal, pay and structure wording beyond what the site already says.
- Deploying. Pushing `design/tekonest-umbrella-brand` is what publishes tekonest.com, and any pushed branch gets a public Cloudflare preview.
- The private mind map branch (`site/tekonest-map`). Its outline needs a follow-up edit after this round.
- Public-repo exposure of brand and Rebels documents (people's names, founder status). Raised separately.

## 4. Design

### 4.1 Information architecture

- Navigation: **Se former · Créer avec nous · L'histoire · Contact**. Footer adds Accessibilité.
- Home shows two doors. The "Trois entrées" section becomes "Deux entrées".
- `reseau.html` leaves the build (source fragment and built file removed with `git rm`).
- `organiser.html` is replaced by `creer.html`, so the file name matches the label.
- `_redirects` (new): `/organiser`, `/organiser.html` → `/creer.html`; `/reseau`, `/reseau.html` → `/`. This keeps old links alive.

### 4.2 The page *Créer avec nous* (`creer.html`)

Draft French copy (inclusive-writing rules of `design/01-positioning.md` apply, no point médian):

- Status tag: **Offre en projet**. Each family card also carries « En projet » until the founder confirms what is already deliverable.
- h1: « Une expérience au service de votre projet. »
- Lead: « Spectacle, tournage, événement, projet artistique : vous venez avec une idée, nous la construisons avec vous. »
- Four cards:
  1. **Création sonore**: composition sonore et cinématique, sound design pour l'image, la scène ou une installation.
  2. **Prise de son**: pour un tournage, une captation ou un enregistrement.
  3. **Live**: un DJ set ou une prestation technique à la demande, selon les besoins du projet.
  4. **Direction artistique, mixage et mastering**: accompagner la direction artistique d'un projet, mixer et masteriser vos titres.
- « Comment ça se passe » (4 numbered steps): vous nous parlez de votre projet; nous en discutons avec l'équipe; nous vous proposons une façon de travailler ensemble; nous le réalisons.
- Call to action: « Parlez-nous de votre projet » → `contact.html`. Note: « Ce n'est ni un devis ni un engagement, de votre côté comme du nôtre. »
- No price, no availability claim, no pay or legal wording. The current Rebels × Tekonest line is removed (separate project).

### 4.3 Other pages

| Page | Change |
| --- | --- |
| `index.html` | Meta description and hero line: « Se former, créer : des fils tressés ensemble. » Button « Les deux entrées ». Two door cards (Se former, Créer avec nous). « Sept fils, sept métiers » keeps the seven trades but drops "le réseau veut réunir": reworded as the seven trades Tekonest works with. Status board: two rows removed or changed (Réseau removed; Créer avec nous row reflects the four families and "En projet"), date set to the build date, TekPractice next step reworded from the project's status map. |
| `histoire.html` | Rewrite the "deuxième envie" paragraph (network) as the creation service. The sentence about the musician and the DJ who agreed to cofound is left untouched (founder question F-04 stays open). |
| `contact.html` | Remove "pour le réseau" from the helper note; add « un projet à créer avec nous ». |
| `build` shared layout | Nav and footer text updated; footer line « rejoindre un réseau payé correctement » replaced; footer date set to the build date. |
| `apprendre.html`, `tekpractice.html`, `accessibilite.html` | Only links and wording that point at removed pages. |

### 4.4 Brand documents kept in sync (small, separate commit)

- `design/05-site-map.md`: new tree (two doors, `creer.html`).
- `design/12-design-system/README.md`: logo line "sept personnes du réseau" → "sept métiers"; "trois entrées" → "deux entrées".
- `brand/04-decisions-and-questions.md`: add decision D-09 (network set aside, door 2 redefined, 28 Oct 2026). Earlier records are not rewritten.

### 4.5 Build tooling

`src/build.py` needs Python, which is not installed. Replace it with a Node build (`website-prototype/tools/build.mjs`, same layout, same French typography rules: narrow no-break space before `; : ! ?` and inside « »).

Safety: before any page edit, the Node build runs on the **unchanged** sources and its output must be byte-identical to the committed `*.html`. Only then are pages edited. `build.py` is removed in the same branch once equivalence is shown, and the website README is updated.

## 5. Testing and acceptance

1. Equivalence: Node build output equals committed pages before edits (see 4.5).
2. Banned strings absent from all built pages (`_redirects` is not a page): `reseau`, `Réseau`, `Trois entrées`, `trois entrées`, `organiser.html`, `Rebels`. The word `réseau` is grepped too, and every hit is read by hand, because it can legitimately mean an audio network on the learning pages; no hit may refer to the network service.
3. Every internal link and image resolves (link-check script, 0 broken).
4. axe-core WCAG 2.2 AA: 0 violations at 375 and 1440 px on every page.
5. No horizontal overflow at 375, 768, 1440 px.
6. Nav at 375 px: toggle, Esc closes, focus returns (as in the 22 Oct review).
7. Reduced-motion and no-JS views still readable.
8. Screenshots at 1440 and 390 px of each page saved under `design/07-review/screens-2026-10-28/`.
9. Statuses: every offer shows an honest status; no sentence says something is available that is not.

Not covered: screen-reader pass, real five-second test, live deployment checks, Cloudflare cache purge for `/soirees`.

## 6. Risks and open questions

| Item | Note |
| --- | --- |
| Which of the four families the founder can already deliver | Until answered, all are « En projet ». |
| Redirect targets | `/reseau` → `/` is a recommendation; `/reseau` could instead 404. Founder may prefer a short note on the home page. |
| Contact e-mail (F-05) | Still undecided. The Contact page and every call to action stay "à définir". |
| Histoire page names the founder and mentions cofounders | Open question F-04, unchanged by this round. |
| Pushing publishes the site | Production branch is `design/tekonest-umbrella-brand`. This work lives on `site/two-doors` and merges only on the founder's go. |
| Public repo | Brand and Rebels documents are public. Not changed here; raised separately. |
| Git ownership on the E: drive | Work happens in a clone on C: (`C:\Users\braco\dev\tekonest-site`) to avoid global git setting changes. |
| Case-colliding logo SVGs | Three files under `design/09-logo-nest/` show as modified on Windows; they are never staged. |

## 7. Phase B: generated visual layer

> **Superseded in part (28 Oct 2026, night).** After the Damascene marquetry research and the founder's review of the first samples, the visual subject is no longer "circles only" and the G1 to G7 slot table in 7.4 is replaced by section 8. Sections 7.3 (delivery rules) and 7.6 (tests) still apply to anything that moves. The animation is deterministic canvas code, not video, so the video-specific budget in 7.3 applies only to a later social export.

Informed by a three-expert council on 28 Oct 2026 (motion director, performance and accessibility engineer, marquetry art director). The council's default was code-first; the founder overrode it for the creative layer (decision 8). What survives from the council are the guardrails.

### 7.1 Three layers

| Layer | Made with | Used for |
| --- | --- | --- |
| **Rendered visuals** (the creative layer) | Claude Motion (MP4, built as code) or the canvas animations in `visuals/`, rendered to MP4 or WebM; stills and posters exported from the final frame | Hero film, ambient loops, Créer avec nous visuals, Histoire film, section atmosphere, social teasers, key art and posters |
| **Coded** (only what code does better) | CSS, SVG, small JS | The exact logo and wordmark, all text, status badges and interface, hover and focus states, page transitions, the pause control, and anything driven by real data (for example a waveform of a real recording) |
| **Real** (never generated) | Your own captures | TekPractice and E3 course screens, any recording, photo or object that claims to be Tekonest's own work |

The brief for the generated assets (shot list, constraints, specs) is [`2026-10-28-tekonest-generated-visuals-brief.md`](2026-10-28-tekonest-generated-visuals-brief.md).

### 7.2 Art direction (keeps the identity)

- **Subject: circles with the Damascus design, nothing more.** Rings, discs and medallions carrying a Damascus-inspired pattern. No other shape or object appears in any generated asset.
- Every generated asset starts from the fixed identity: Nuit ground, Ambre and Prune accents, Papier and Crème highlights (hex values from `tokens.css`), the Damascus pattern references (`design/16-chatgpt/refs/ref-4-marquetry.png`, `design/11-damas/damas-board.png`), walnut, mother-of-pearl and gold-leaf as abstract material vocabulary. The nest geometry (`ref-1-nest-geometry.png`) is used only for the Histoire film.
- The precise nest, medallion and logo are **never generated**: they are code or the existing SVG, composited over generated footage.
- One camera language across all clips: locked-off or very slow, 24 fps, no handheld, no flashing, no text in the frame.
- Imperfection is allowed and wanted (tolerance, grain, an off-register piece). Curate: several takes per asset, pick the best, grade to the palette in post.
- Material truth: abstract material scenes only. No generated people, crowds, studios or hands presented as Tekonest's real work, no testimonials, no clients (the honesty rule).
- Motifs: animate the **method** (pieces seated once, rings laid), never spin, glow or loop the Médaillon or the Bande. Credit "inspired by Damascus marquetry". Do not call the 12-point star Damascene.

### 7.3 Delivery rules (non-negotiable, whatever the style)

- The LCP element is a static poster (WebP, ≤ 60 KB), never a video frame. The video loads after the poster.
- `muted loop playsinline preload="none"`, `autoplay` set by JS only when in view, motion allowed, no `Save-Data`. Under `prefers-reduced-motion`, `Save-Data` or without JS: poster only, no video request.
- Any clip that moves longer than 5 seconds has a real pause button (keyboard reachable, visible label, ≥ 24 px) on the page.
- No audio track. No flashing above 3 Hz. No text baked into video.
- Every decorative video is `aria-hidden`; any video with meaning has a text alternative.
- Budget (revised from the engineer's 1.5 MB cap, to be measured): ≤ 4 MB per clip, ≤ 8 MB of video per page, H.264 High `+faststart` plus an AV1 or VP9 WebM source, ≤ 1280 px wide, ≤ 24 fps. Hard Cloudflare Pages limit: 25 MiB per file. Larger files go to R2 with a documented origin.
- No third-party motion libraries.

### 7.4 Where the generated assets go (superseded by section 8)

| Page | Slot | Asset |
| --- | --- | --- |
| Home | Hero background | G1 "Le cercle se pose" film, one-shot, ends on a held frame that is the poster |
| Home | Closing band (replaces `texture-damas.jpg`) | G2 "Onde" slow loop. This also removes a texture whose provenance the asset register contradicts. |
| Créer avec nous | Hero right half | G3 hero film |
| Créer avec nous | The four family cards | G4a to G4d, four square clips of 3 to 4 seconds |
| Se former | Right half of the hero | G5 "Un cercle pour apprendre" clip, beside a **real** screen capture |
| Histoire | Under the story | G6 "weave" explainer, 8 seconds, ends on the logo |
| Social, OG | Share images | G7 teasers (1:1, 9:16) and OG still |

### 7.5 Phase B prerequisites

1. Phase A merged on the branch (the pages these slots belong to exist).
2. The open accessibility checks done and recorded: screen-reader pass, 200% zoom, Lighthouse mobile.
3. A pause control built and tested (nothing in `home.js` pauses the hero today).
4. A video toolchain: confirm whether ffmpeg is available; if not, compression is done with an approved tool.
5. The founder runs Claude Motion with the brief. I cannot run it from this session.
6. Real captures of TekPractice and the E3 course supplied for the "Real" layer.

### 7.6 Phase B tests

1. Reduced motion, `Save-Data` and no-JS: no video request in the network log, posters shown.
2. Pause control works by keyboard and screen reader; focus ring visible.
3. LCP is a poster ≤ 2.0 s on mobile 4G throttling; CLS 0.
4. Budget check: report transferred MB per page.
5. No frame flashes above 3 Hz (check the generated clips themselves).
6. axe still 0 violations at 375 and 1440 px; reflow at 320 px.
7. Each clip compared to the palette tokens and to the nest geometry reference; rejected if off.
8. Review by the founder for fit with the identity, and by a Damascus-marquetry artisan for the motif rules before publishing.

### 7.7 Honest limits

- Generated imagery does not by itself remove the "AI-made" look. The mitigations are art direction, curation, restraint, real captures where the product is shown, and the exact brand marks in code. This reduces the risk; it does not remove it.
- I have no documentation for Claude Motion in this session beyond that it outputs MP4. The brief is tool-agnostic and also works for other generators.
- Browser support for scroll-driven animation and whether Cloudflare Pages serves MP4 range requests were not verified. Neither is required by this design.

## 8. Phase B2: the marquetry panel on the site

Status: mapping approved by the founder on 28 Oct 2026. Research basis: the report "Damascene marquetry design language" (five research notes, kept outside the repo for now). Built and checked so far, all on the local branch `site/visuals`: `visuals/lib/damas.js` (pieces, shared vertices, materials), `visuals/lib/nest.js` (the mark), `visuals/lib/panel.js` (the panel and its making-order timeline), `visuals/panel-motion.html` (10 s, deterministic), `visuals/panel-poster.png`, and the gates `website-prototype/tools/check-visual.mjs`, `frame.mjs`, `contact-sheet.mjs`, `imgdiff.mjs`.

### 8.1 Decisions (founder)

| # | Decision |
| --- | --- |
| 11 | The visual subject is the **marquetry panel**: a nest of bands (walnut margin, fillets, rope, diamond-in-triangle, sawtooth) around a strapwork field with a plain roundel. It replaces "circles only". |
| 12 | The **home hero is replaced** by the panel being made. The old star-and-dust hero and its optional sound pulse are removed. |
| 13 | The **Histoire scroll-scrubbed version is deferred**. |
| 14 | The **dividers are replaced everywhere**: the diamond `.bande` strip is retired in favour of the rope and sawtooth bands. |
| 15 | The **mark in the roundel is the brand mark as continuous loops, no cuts, in Papier white** (`#F3EDE3`). |

### 8.2 Where each part goes

| Part of the panel | Where | How |
| --- | --- | --- |
| The panel being made (10 s) | Home hero, right of the headline | Poster first (final frame), then the animation once after load; pause button; still frame under reduced motion, `Save-Data` and no JS |
| Roundel with the mark | Footer seal, share image | Small static roundel in the footer; the 1200×630 share image is cut from the poster |
| Walnut margin and fillets | Card frames: the two door cards and the four *Créer avec nous* cards | The existing amber-corner Cadre gains nested hairline fillets |
| Rope band | Divider | Replaces the diamond strip between the home hero and the doors; sits under the page heroes |
| Sawtooth | Divider before the footer and above the status board | Thin strip |
| Diamond-in-triangle band | Top of the *Créer avec nous* page | The one band with wood in it, so it marks the creative door |
| Strapwork field | Home closing band, and the *Se former* hero's right half | Static crops. The home crop replaces `texture-damas.jpg` (its provenance contradicts the asset register). The *Se former* crop sits beside a **real** screen capture, never in place of one |
| Corner star | List bullets | An eight-point star replaces the dot |
| Materials (pearl, walnut, plum, wire) | Design tokens | New CSS variables: `--pearl`, `--pearl-dim`, `--walnut`, `--walnut-dark`, `--ebony`, `--wire` |

### 8.3 Delivery

- **No video and no new library.** The animation is the same canvas code that produced the still, so what plays is what was reviewed.
- `website-prototype/tools/build-visuals.mjs` concatenates `visuals/lib/damas.js`, `nest.js`, `panel.js` and a small `hero-panel.js` into `assets/js/panel.js`, loaded with `defer` on `index.html` only. Budget: total JS on the home page ≤ 25 KB gzip.
- `website-prototype/tools/render-assets.mjs` renders the static images from the same code with the existing Playwright dev dependency, using the browser's own WebP encoder: hero poster (720 and 1200 px wide, ≤ 120 KB and ≤ 180 KB; measured 108 and 172 KB at WebP quality 0.7), share image 1200×630, divider tiles for rope, sawtooth and diamond-in-triangle (repeat-x, 1× and 2×, ≤ 20 KB each), the closing-band field texture, the *Se former* field crop and the footer seal, all under `assets/img/panel/`. Running it twice yields the same pixels.
- Home hero markup: a `<figure>` with a fixed `aspect-ratio`, the poster `<img>` (the LCP element) and a `<canvas>` that the script reveals only when motion is allowed, `Save-Data` is off and the figure is in view; a real pause button (`aria-pressed`, visible label, at least 24 px); the canvas has `role="img"` and a text alternative.
- CSS: the dividers become classes (`.rule-rope`, `.rule-saw`, `.rule-tri`) using the rendered tiles; Cadre gets the nested fillets; list bullets use an inline SVG star.

### 8.4 Tests and acceptance

1. `node tools/check-visual.mjs ../visuals/panel-motion.html` passes: frames identical whatever the drawing order, the last second holds still, an offline frame under 500 ms.
2. Home: the poster is the LCP element; with reduced motion, `Save-Data` or no JS, no canvas animation starts (checked in the browser script); the pause button works by keyboard; the measured gzip size of the JS loaded on the home page is ≤ 25 KB; CLS is 0.
3. axe reports 0 violations and no horizontal overflow at 375, 768 and 1440 px on every page; reflow at 320 px and at 200% zoom is checked.
4. No file references `texture-damas.jpg` or the diamond `.bande` any more; the banned-string checks of section 5 still pass.
5. Asset budgets hold (poster ≤ 120 KB at 720 px and ≤ 180 KB at 1200 px, each divider tile ≤ 20 KB, closing texture and field crop ≤ 150 KB); the build reports transferred KB per page.
6. `render-assets.mjs` run twice gives identical pixel hashes.
7. The honesty rule holds: no new text claims anything is available.

### 8.5 Respect and credit

The footer keeps « Motifs inspirés de la marqueterie de Damas » and adds that the geometry was reconstructed by the designer. The site never says the pieces are Damascene craft, and the panel is described as inspired by Damascene wood marquetry. An expert or artisan review of the finished work, and the question of commissioning and paying one real panel, are founder decisions before launch and are not part of this round.

### 8.6 Out of scope and open items

- Histoire scroll-scrubbed making (decision 13) and an MP4 or WebM export for social (needs an approved encoder).
- Real captures of TekPractice and the E3 course for the *Se former* hero.
- Contact e-mail (F-05), legal wording and naming checks.
- Whether the 10 s animation should be shortened: tune after seeing it on the page.
- The black sawn scrolls, the figurative scene and the multicolour stripe band from the reference photos are deliberately not used (no process source, an individual maker's work, and an open register decision).
