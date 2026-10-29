# Tekonest umbrella website — prototype

A static, French-first, responsive prototype of the Tekonest umbrella site, in **Direction A "Bobine"**. Draft pending founder review. **Not deployed, not published.**

## View it

Open `index.html` in a browser. No server or build is needed to view it.

## Edit it

- Page content lives in `src/pages/*.html` (a fragment per page, with a `<!-- title: … | description: … -->` header).
- The shared header and footer live in `tools/build.mjs`.
- Run `node tools/build.mjs` (Node 22+, no install needed) to regenerate the root `*.html` files. It also applies French typography: narrow no-break spaces before `; : ! ?` and inside « ».
- `node --test` fails if the built pages are stale.
- Styles: `assets/css/tokens.css` holds the design tokens (source of truth) and `assets/css/site.css` the components.

## The marquetry theme

The look of the site is inspired by Damascene marquetry (« Motifs inspirés de la marqueterie de Damas »), and **no picture of it ships**: the motifs are CSS in `assets/css/site.css` (gradients, masks, borders), coloured by the tokens in `assets/css/tokens.css`. The system is the anatomy of a panel: a frame, then a band, then a single wire, then the field.

| Part | Class | Where |
|---|---|---|
| Rope band | `.rule .rule-rope` | under every page hero |
| Diamond-in-triangle band | `.rule .rule-tri` | top of *Créer avec nous*, above the closing band |
| Sawtooth band | `.rule .rule-saw` | above the footer |
| Wire frame | `.cadre-filet .cadre-filet--fil` | inside the home hero and the closing band |
| Roundel | `.roundel` | footer (the brand mark inlined from `assets/img/symbol.svg`) |

A band belongs to the field below it. The lab that explored the panel (canvas code, samples, the animation) stays in [`../visuals/`](../visuals/) and is not built into the site. `node tools/verify-browser.mjs` checks that no picture loads, that the bands are drawn, and runs axe on every page.

## The layout system (Phase C, after Berghain)

One canonical list grouped by state, two equal doors, a plain statement first. The rules, all enforced by `tools/site.test.mjs` and `tools/verify-browser.mjs`:

- **Six type sizes** (tokens in `tokens.css`): `--text-label` 13, `--text-sm` 14, `--text-base` 17, `--text-lg` 20, `--text-2xl` 28→40, `--text-hero` 36→60. No other size, no new font.
- **Three breakpoints**: `max-width` 39.99em, 47.99em (doors side by side, tables as tables from 48 em) and 63.99em.
- **Four status labels, defined once on the home page** (`dl.legend`) and used everywhere, each with its glyph class: Version d'essai `status--now`, En développement `status--dev`, En projet `status--prep`, À venir `status--later`.
- **Components**: `.door--dark` (the two hero doors), `.board--groups` (the grouped status table), `.legend`, `.rows` and `.rows--n` (hairline rows), `.fils` (the seven trades as rows), `.foot-cols` and `.foot-fine` (footer).
- **Ornament budget**: two ornament types per viewport (frames, bands); no pictures; no disabled buttons.

Spec: `docs/superpowers/specs/2026-10-29-tekonest-berghain-adaptation.md`.

## Honest by design

- **No data is collected.** Sign-ups are disabled and labelled « Inscriptions bientôt ouvertes ».
- **No links** go to ticketing, booking or a live product.
- Every branch shows its real status.
- **Fonts are self-hosted** (SIL OFL 1.1, licence files in `assets/fonts/`); no third-party requests.

Docs: [`../design/`](../design/).
