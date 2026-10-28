# Tekonest umbrella website — prototype

A static, French-first, responsive prototype of the Tekonest umbrella site, in **Direction A "Bobine"**. Draft pending founder review. **Not deployed, not published.**

## View it

Open `index.html` in a browser. No server or build is needed to view it.

## Edit it

- Page content lives in `src/pages/*.html` (a fragment per page, with a `<!-- title: … | description: … -->` header).
- The shared header and footer live in `tools/build.mjs`.
- Run `node tools/build.mjs` (Node 22+, no install needed) to regenerate the root `*.html` files. It also applies French typography: narrow no-break spaces before `; : ! ?` and inside « ».
- Run `npm run build:all` to regenerate every generated file in one go (the three generators below). `node --test` fails if one is stale.
- Styles: `assets/css/tokens.css` holds the design tokens (source of truth) and `assets/css/site.css` the components.

## The marquetry panel (generated files)

The home hero, the dividers and the image assets come from one body of canvas code in [`../visuals/`](../visuals/) (`lib/damas.js`, `lib/nest.js`, `lib/panel.js`, `hero-panel.js`). Nothing in it is hand-edited downstream:

| Generator | Writes | What it does |
|---|---|---|
| `node tools/build.mjs` | root `*.html` | Fragments and layout into pages |
| `node tools/build-visuals.mjs` | `assets/js/panel.js` | Bundles the four sources (header: "Generated … Do not edit") |
| `node tools/render-assets.mjs` | `assets/img/panel/*.webp` | Renders posters, share image, divider tiles, closing texture, field crop and footer seal with the browser's WebP encoder (needs Playwright's Chromium) |

Budgets, all enforced by tests: home JS ≤ 25 KB gzip (measured 15.7), poster ≤ 120 KB at 720 px and ≤ 180 KB at 1200 px (107.6 and 172.1), divider tiles ≤ 20 KB, closing texture and field crop ≤ 150 KB (138.4 and 111.5). `node tools/verify-browser.mjs` checks the hero in a browser (LCP, layout shift, reduced motion, Save-Data, keyboard pause) and runs axe on every page; `node tools/check-visual.mjs ../visuals/panel-motion.html 500` checks the animation itself.

## Honest by design

- **No data is collected.** Sign-ups are disabled and labelled « Inscriptions bientôt ouvertes ».
- **No links** go to ticketing, booking or a live product.
- Every branch shows its real status.
- **Fonts are self-hosted** (SIL OFL 1.1, licence files in `assets/fonts/`); no third-party requests.

Docs: [`../design/`](../design/).
