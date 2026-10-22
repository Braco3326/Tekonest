# Tekonest umbrella website — prototype

A static, French-first, responsive prototype of the Tekonest umbrella site, in **Direction A "Bobine"**. Draft pending founder review. **Not deployed, not published.**

## View it

Open `index.html` in a browser. No server or build is needed to view it.

## Edit it

- Page content lives in `src/pages/*.html` (a fragment per page, with a `<!-- title: … | description: … -->` header).
- The shared header and footer live in `src/build.py`.
- Run `python3 src/build.py` to regenerate the root `*.html` files. It also applies French typography: narrow no-break spaces before `; : ! ?` and inside « ».
- Styles: `assets/css/tokens.css` holds the design tokens (source of truth) and `assets/css/site.css` the components.

## Honest by design

- **No data is collected.** Sign-ups are disabled and labelled « Inscriptions bientôt ouvertes ».
- **No links** go to ticketing, booking or a live product.
- Every branch shows its real status.
- **Fonts are self-hosted** (SIL OFL 1.1, licence files in `assets/fonts/`); no third-party requests.

Docs: [`../design/`](../design/).
