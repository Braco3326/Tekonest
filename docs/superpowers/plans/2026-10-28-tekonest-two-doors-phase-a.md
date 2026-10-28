# Tekonest two doors, Phase A: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Tekonest umbrella site from three doors (with a network) into two doors, *Se former* and *Créer avec nous*, with a new client-facing *Créer avec nous* page, without changing the visual identity.

**Architecture:** The site is static HTML built from page fragments in `website-prototype/src/pages/` by a shared layout. Python is not installed, so the build is ported to Node first and proved byte-identical to the committed pages before any content edit. Every content change is driven by `node:test` checks that read the built pages. No dependencies are needed for the build or the checks; Playwright and axe are used only in the last task.

**Tech Stack:** Node 24 (`node:test`, `node:fs`), plain HTML/CSS, Playwright + axe-core (Task 7 only).

**Spec:** `docs/superpowers/specs/2026-10-28-tekonest-two-doors-design.md` (sections 1 to 6). Phase B (generated visuals, spec section 7) gets its own plan once the shot-list assets exist.

## Global Constraints

- Work only in `C:\Users\braco\dev\tekonest-site` on branch `site/two-doors`. Never push, never deploy, never switch to another branch.
- Never stage the three files `design/09-logo-nest/TEKONEST-lockup-reverse.svg`, `TEKONEST-lockup.svg`, `TEKONEST-wordmark.svg` (Windows case collision). Always `git add` explicit paths.
- Windows: use `npm.cmd` and `npx.cmd`, not `npm`. Python is not installed.
- French typography: a narrow no-break space (U+202F) before `; : ! ?` and inside « ». Page fragments write it as `&#8239;`. No point médian (inclusive writing uses épicène words or full doublets).
- Status vocabulary: « Existe », « En développement », « En projet », « À décider ». No price, no availability claim, no legal or pay wording, no « gratuit ».
- Identity unchanged: tokens, fonts, Cadre/Bande/Médaillon components stay as they are. CSS variable names (for example `--cable-organiser`) are not renamed.
- `website-prototype/tekpractice/jouer/` is a deployed app build: never edit it.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Old bookmarks `/organiser`, `/organiser.html`, `/reseau`, `/reseau.html` must still land somewhere sensible: the `_redirects` file is tested line by line (Task 3 and Task 5).
- The in-page anchor `#entrees` (hero button) must still exist after the home rewrite: the link check covers anchors (Task 2, re-run in Task 4).
- A lone « : » or « ? » at the start of a line: the typography check scans all built pages (Task 2) and covers the new page (Task 3).
- Two doors in a three-column grid, or four family cards in an uneven grid, leave a blank column at 801 to 1100 px: CSS rules are checked (Tasks 3 and 4) and screenshots at 768 and 1440 px are reviewed (Task 7).
- A family card or the new page implying something is already offered or priced: every card must carry a « En projet » tag and the page must contain no price words (Task 3).

---

### Task 1: Node build, proved identical to the Python build

**Files:**
- Create: `website-prototype/package.json`, `website-prototype/.gitignore`, `website-prototype/tools/build.mjs`, `website-prototype/tools/build.test.mjs`
- Modify: `website-prototype/README.md` ("Edit it" section)
- Delete: `website-prototype/src/build.py`

**Interfaces:**
- Produces, in `build.mjs`: `export const NNBSP = "\u202f"`; `export const NAV: [href: string, label: string][]` (same five entries as `build.py` today); `export function frenchTypography(html: string): string`; `export function build(options?: { outDir?: string }): string[]` (writes every page, returns the file names built; `outDir` defaults to `website-prototype/`).
- `package.json`: `"type": "module"`, scripts `"build": "node tools/build.mjs"`, `"test": "node --test"`, `"verify:browser": "node tools/verify-browser.mjs"`.

- [ ] **Step 1: Write the failing test** in `tools/build.test.mjs`: `Node build output equals the committed pages` builds into a temp directory (`fs.mkdtempSync`) and, for each of the 8 files in `src/pages/`, asserts `normalise(builtText) === normalise(committedText)` where `normalise` replaces `\r\n` with `\n`. Second test `frenchTypography puts a narrow no-break space before ; : ! ? and around « »` with the input `Bonjour : « oui » ?` expecting `Bonjour\u202f: «\u202foui\u202f»\u202f?`.
- [ ] **Step 2: Run** `node --test tools/build.test.mjs` from `website-prototype/`. Expected: FAIL (module `build.mjs` not found).
- [ ] **Step 3: Implement `build.mjs`** by porting `src/build.py` exactly: the `NAV` list, the `LAYOUT` template (head, proto banner, header with `{nav}`, `<main>{content}</main>`, footer with `{footnav}` and the Accessibilité link), `nav_items(current, indent)` (adds ` aria-current="page"` on the matching link), the fragment header regex `/<!--\s*title:\s*(.*?)\s*\|\s*description:\s*(.*?)\s*-->\s*/s`, the replacement of `&#8239;` by U+202F in fragments, and the typography applied only to what follows `<body>`, never inside tags. Write LF line endings. Keep the footer date as the constant `FOOTER_DATE = "22 octobre 2026"` so output stays identical; later tasks change it.
- [ ] **Step 4: Run** `node --test tools/build.test.mjs`. Expected: both tests PASS. If the equivalence test fails, fix `build.mjs` until it passes; do not touch the committed pages.
- [ ] **Step 5: Create `package.json` and `.gitignore`** (`node_modules/`, `test-results/`, `playwright-report/`), delete `src/build.py` with `git rm`, and update the README bullets: header/footer now live in `tools/build.mjs`, regenerate with `node tools/build.mjs`.
- [ ] **Step 6: Run** `node tools/build.mjs` then `git status --short website-prototype`. Expected: no modified `*.html` (line-ending-only noise from Windows autocrlf is acceptable; content must be unchanged: `git diff --ignore-cr-at-eol --stat` prints nothing for `*.html`).
- [ ] **Step 7: Commit**

```bash
git add website-prototype/package.json website-prototype/.gitignore website-prototype/tools website-prototype/README.md
git rm -q website-prototype/src/build.py
git commit -m "build: port the page build to Node, byte-identical to the Python output"
```

### Task 2: Site invariants that already hold

**Files:**
- Create: `website-prototype/tools/site.test.mjs`

**Interfaces:**
- Consumes: built pages in `website-prototype/*.html`, `NAV` from `tools/build.mjs`.
- Produces: helpers in `site.test.mjs` used by later tasks: `page(name: string): string` (file text, `\r\n` normalised to `\n`), `bodyText(html: string): string` (the part after `<body>` with `<script>`, `<style>` and tags removed), `pages(): string[]` (root `*.html` names).

- [ ] **Step 1: Write the tests** (all pass on today's site): `every built page has a source fragment` (each root `.html` has `src/pages/<same name>`); `every local link and anchor resolves` (for each `href`/`src` that is not `http`, `mailto` or `#`-only, the target file exists under `website-prototype/`; for `file.html#id` and same-page `#id`, the id exists in that file); `no space before ; : ! ? or » in text nodes` (on `bodyText` of every page, `/ [;:!?»]/` has no match, and there is no U+0020 right after `«`); `the header nav marks exactly the current page` (for every page listed in `NAV`, the header `<nav>` block holds exactly one `aria-current="page"`, on that page's link).
- [ ] **Step 2: Run** `node --test tools/site.test.mjs`. Expected: PASS. If a test fails on the existing site, record the failing page in the commit message and restrict the test to the checked pages; do not edit pages in this task.
- [ ] **Step 3: Commit**

```bash
git add website-prototype/tools/site.test.mjs
git commit -m "test: site invariants (links, anchors, typography, aria-current)"
```

### Task 3: Créer avec nous page, new nav, redirects

**Files:**
- Create: `website-prototype/src/pages/creer.html`, `website-prototype/_redirects`
- Modify: `website-prototype/tools/build.mjs` (NAV), `website-prototype/assets/css/site.css`, `website-prototype/src/pages/index.html` and any page linking `organiser.html`, `website-prototype/tools/site.test.mjs`
- Delete: `website-prototype/src/pages/organiser.html`, `website-prototype/organiser.html`

**Interfaces:**
- Consumes: `build()`, `NAV`, `page()`, `bodyText()`.
- Produces: `NAV` entry `["creer.html", "Créer avec nous"]` in place of `organiser.html`; CSS class `.families` (2 columns above 800 px, 1 column at or below); `_redirects` file.

- [ ] **Step 1: Write the failing tests** in `site.test.mjs`: `creer page content` (h1 text is `Une expérience au service de votre projet.` after typography; contains exactly 4 elements with class `family` whose `<h3>` texts are `Création sonore`, `Prise de son`, `Live`, `Direction artistique, mixage et mastering`; each holds a `status--prep` tag reading `En projet`; the CTA link text `Parlez-nous de votre projet` points to `contact.html`; the text `Ce n'est ni un devis ni un engagement` is present); `creer page makes no price or availability claim` (`bodyText` has no match for `/€|tarif|prix|gratuit|réserv/i`); `organiser.html is gone and creer.html replaces it in the nav` (file absent, `NAV` has no `organiser.html`, header nav of `index.html` links `creer.html`); `old organiser links redirect` (`_redirects` contains the lines `/organiser /creer.html 301` and `/organiser.html /creer.html 301`); `families grid is two columns above 800px` (`site.css` contains `.families` with `repeat(2, minmax(0, 1fr))` and a `max-width: 800px` rule with `1fr`).
- [ ] **Step 2: Run** `node --test tools/site.test.mjs`. Expected: the five new tests FAIL.
- [ ] **Step 3: Create `src/pages/creer.html`** with header `<!-- title: Créer avec nous — Tekonest | description: Une expérience au service de votre projet : création sonore, prise de son, live, direction artistique, mixage et mastering. Offre en projet. -->` and the structure of the old organiser page (`branch-hero` with `--cable: var(--cable-organiser)`, then a section, then a sunken CTA section). Copy, exactly (write `&#8239;` before `: ; ? !` and inside « »):
  - status tag `status status--prep`: `Offre en projet`
  - h1: `Une expérience au service de votre projet.`
  - lead: `Spectacle, tournage, événement, projet artistique : vous venez avec une idée, nous la construisons avec vous.`
  - cards (`<ul class="families">` of `<li class="family cadre">`, each with `<h3>`, `<p>`, `<span class="status status--prep">En projet</span>`): *Création sonore* / `Composition sonore et cinématique, sound design pour l'image, la scène ou une installation.`; *Prise de son* / `Pour un tournage, une captation ou un enregistrement.`; *Live* / `Un DJ set ou une prestation technique à la demande, selon les besoins du projet.`; *Direction artistique, mixage et mastering* / `Accompagner la direction artistique d'un projet, mixer et masteriser vos titres.`
  - h2 `Comment ça se passe` then an `<ol class="steps">` of four items: `Vous nous parlez de votre projet.` / `Nous en discutons avec l'équipe.` / `Nous vous proposons une façon de travailler ensemble.` / `Nous le réalisons.`
  - CTA section: h2 `Un projet en tête&#8239;?`, then `<a class="btn btn-primary" href="contact.html">Parlez-nous de votre projet</a>`, then the note `Ce n'est ni un devis ni un engagement, de votre côté comme du nôtre.` No mention of Rebels.
- [ ] **Step 4: Add `.families` CSS** next to `.products` in `site.css`: `display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-6); list-style: none; padding: 0;`, and `@media (max-width: 800px) { .families { grid-template-columns: 1fr; } }`. Reuse `.cadre` for the card frame.
- [ ] **Step 5: Swap the page** with `git rm` of `src/pages/organiser.html` and `organiser.html`; change the `NAV` entry in `build.mjs`; replace every `href="organiser.html"` in other fragments (home door, home board row) with `creer.html`; create `_redirects` with exactly the four lines:

```
/organiser /creer.html 301
/organiser.html /creer.html 301
/reseau / 301
/reseau.html / 301
```

- [ ] **Step 6: Run** `node tools/build.mjs && node --test`. Expected: all tests PASS (the `/reseau` redirect lines are asserted in Task 5; the file already contains them).
- [ ] **Step 7: Commit**

```bash
git add website-prototype
git reset -q design/09-logo-nest
git commit -m "site: Créer avec nous becomes a client-facing service page (creer.html), redirects for old URLs"
```

### Task 4: Home page with two doors

**Files:**
- Modify: `website-prototype/src/pages/index.html`, `website-prototype/assets/css/site.css`, `website-prototype/tools/site.test.mjs`

**Interfaces:**
- Consumes: `page()`, `bodyText()`.
- Produces: the id `entrees` kept on the doors section heading; CSS `.doors` two columns.

- [ ] **Step 1: Write the failing tests** (built `index.html`): `home shows exactly two doors` (two `<li class="door`, linking `apprendre.html` and `creer.html`, none linking `reseau.html`); `home hero copy` (lead `Se former, créer : des fils tressés ensemble.`, button `Les deux entrées` linking `#entrees`, eyebrow `Deux entrées`, no `trois entrées` in any case); `status board lists three branches and the build date` (rows for Apprendre, TekPractice, Créer avec nous, none for Réseau; text `Mis à jour le 28 octobre 2026.`; the Créer avec nous row has `status--prep` reading `En projet`); `doors grid has two columns` (`site.css` `.doors` rule contains `repeat(2, minmax(0, 1fr))`).
- [ ] **Step 2: Run** `node --test`. Expected: the four new tests FAIL.
- [ ] **Step 3: Edit `index.html`**: meta description → `Se former au son, ou créer un projet avec nous : Tekonest est un nid parisien pour les métiers du son. Tekonest se construit pas à pas.`; hero lead and button as above; section eyebrow `Deux entrées`; the sentence under the h2 → `Chacune peut vivre seule. Ensemble, elles forment le nid.`; remove the third door (`reseau.html`) entirely; second door: who `Pour les projets de spectacle, de film, d'événement`, link `creer.html`, text `Composition sonore, prise de son, live, direction artistique, mixage et mastering, au service de votre projet.`, tag `status status--prep` `Offre en projet`.
- [ ] **Step 4: Edit the « Sept fils » block**: first paragraph → `Un nid tient ensemble des brins très différents. Le nôtre a sept fils : les sept métiers dans lesquels Tekonest travaille. Ses motifs (cadres, médaillon, bandes incrustées) viennent de la marqueterie de Damas, faite de bois et de nacre.`; delete the `<p class="note">` line that links `reseau.html`.
- [ ] **Step 5: Edit the status board**: remove the Réseau row; set the Créer avec nous row to audience `Porteuses et porteurs de projet`, status `status--prep` `En projet`, next step `Préciser l'offre avec les premières demandes.`; set the TekPractice next step to `Terminer le mode Création.`; set the date line to `Mis à jour le 28 octobre 2026.`
- [ ] **Step 6: In `site.css`** change the `.doors` rule to two columns (`repeat(2, minmax(0, 1fr))`) and keep the existing `@media (max-width: 800px)` single-column rule.
- [ ] **Step 7: Run** `node tools/build.mjs && node --test`. Expected: PASS, including the anchor check for `#entrees`.
- [ ] **Step 8: Commit**

```bash
git add website-prototype
git reset -q design/09-logo-nest
git commit -m "site: home page with two doors and an updated status board"
```

### Task 5: Remove the network everywhere else

**Files:**
- Modify: `website-prototype/tools/build.mjs` (NAV, layout footer text, `FOOTER_DATE`), `website-prototype/src/pages/histoire.html`, `website-prototype/src/pages/contact.html`, `website-prototype/tools/site.test.mjs`
- Delete: `website-prototype/src/pages/reseau.html`, `website-prototype/reseau.html`

**Interfaces:**
- Consumes: `NAV`, `page()`, `bodyText()`, `pages()`.
- Produces: `NAV` of four entries in order: `apprendre.html` "Se former", `creer.html` "Créer avec nous", `histoire.html` "L'histoire", `contact.html` "Contact"; `FOOTER_DATE = "28 octobre 2026"`.

- [ ] **Step 1: Write the failing tests**: `no network, no three-door wording, no Rebels in any built page` (for every root `.html`, the full text has no match for `/r[ée]seau|trois entrées|organiser\.html|Rebels/i`); `reseau.html is gone and its old URLs redirect home` (file absent; `_redirects` has `/reseau / 301` and `/reseau.html / 301`); `nav has four entries in the agreed order` (equality with the list above); `footer carries the new tagline and date` (footer text contains `Un nid pour les métiers du son : se former, créer ensemble.` and `Prototype de conception, 28 octobre 2026.`); `histoire describes the creation service` (contains `une expérience au service des projets des autres` and still contains `Un musicien et un DJ ont dit oui pour cofonder le projet`); `contact note mentions a project to create with us` (contains `un projet à créer avec nous`).
- [ ] **Step 2: Run** `node --test`. Expected: these tests FAIL.
- [ ] **Step 3: Implement**: `git rm` the Réseau fragment and built page; update `NAV`; footer tagline → `Un nid pour les métiers du son : se former, créer ensemble.`; `FOOTER_DATE` → `28 octobre 2026`; Histoire third paragraph → `À l'automne 2026, une deuxième envie prend forme : une expérience au service des projets des autres, du son à la direction artistique. Un musicien et un DJ ont dit oui pour cofonder le projet ; les rôles restent à définir.` (the cofounder sentence is kept word for word); Contact note → `Merci d'indiquer dans votre message si vous écrivez pour un projet à créer avec nous, la plateforme d'apprentissage ou TekPractice.`; remove any remaining match of the banned pattern in other fragments (run the test to list them; do not rewrite pages beyond the matching sentence).
- [ ] **Step 4: Run** `node tools/build.mjs && node --test`. Expected: all PASS. Read each remaining hit of the word `réseau` by hand if the test reports one (the test is strict, so none is expected).
- [ ] **Step 5: Commit**

```bash
git add website-prototype
git reset -q design/09-logo-nest
git commit -m "site: remove the network from the public site (nav, footer, story, contact)"
```

### Task 6: Keep the brand and design documents in sync

**Files:**
- Modify: `design/05-site-map.md`, `design/12-design-system/README.md`, `brand/04-decisions-and-questions.md`

**Interfaces:** none.

- [ ] **Step 1: `design/05-site-map.md`**: replace the page tree so it lists `Accueil`, `Se former` (`apprendre.html`, `tekpractice.html`), `Créer avec nous` (`creer.html`), `L'histoire`, `Contact`, `Accessibilité`; remove the Réseau line; add a dated note `Revised 28 Oct 2026: two doors; the network is set aside.`
- [ ] **Step 2: `design/12-design-system/README.md`**: in the opening paragraph replace the three-entrance sentence with `Tekonest est une marque parisienne qui réunit deux entrées : se former (Apprendre, TekPractice) et créer avec nous (une expérience au service de votre projet).`; in the logo paragraph replace `sept fils, sept personnes du réseau` with `sept fils, sept métiers`.
- [ ] **Step 3: `brand/04-decisions-and-questions.md`**: add after the D-08 row a row `| D-09 | The artist and technician network is set aside and leaves the public site (it was built for the Rebels pilot). **Créer avec nous** becomes a client-facing creative and technical service: création sonore, prise de son, live, direction artistique, mixage et mastering. Legal questions are discussed after the structure is settled. | 28 Oct 2026 | Founder, chat |`. Earlier rows are not edited.
- [ ] **Step 4: Verify** with `git grep -n "personnes du réseau\|trois entrées" -- design/12-design-system/README.md design/05-site-map.md` printing nothing.
- [ ] **Step 5: Commit**

```bash
git add design/05-site-map.md design/12-design-system/README.md brand/04-decisions-and-questions.md
git commit -m "docs: sync site map, design system and decisions with the two-door structure"
```

### Task 7: Browser verification (needs the founder's go to install)

**Files:**
- Create: `website-prototype/tools/verify-browser.mjs`, screenshots under `design/07-review/screens-2026-10-28/`
- Modify: `website-prototype/package.json` (devDependencies), `website-prototype/package-lock.json` (generated)

**Interfaces:**
- Consumes: built pages; Playwright Chromium already installed at `%LOCALAPPDATA%\ms-playwright`.

- [ ] **Step 1: Ask the founder** for permission to run `npm.cmd install --save-dev @playwright/test@^1.44.0 @axe-core/playwright@^4.14.0` in `website-prototype/` (no browser download is needed). Do not continue without a yes.
- [ ] **Step 2: Write `tools/verify-browser.mjs`**: serves `website-prototype/` on `127.0.0.1:4173` with a small `node:http` static server; for every root page at 375, 768 and 1440 px wide it (a) runs axe with tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` and requires 0 violations, (b) requires `document.documentElement.scrollWidth <= window.innerWidth`, (c) saves `design/07-review/screens-2026-10-28/<page>-<width>.jpg`; at 375 px on `index.html` it clicks the `Menu` button, requires `aria-expanded="true"`, presses Escape, requires `aria-expanded="false"` and focus back on the button. For `index.html` and `creer.html` it also opens the page once with `reducedMotion: "reduce"` and once with JavaScript disabled (`javaScriptEnabled: false`) and requires the `<h1>` to be visible in both. It prints one line per check and exits non-zero on any failure.
- [ ] **Step 3: Run** `node tools/verify-browser.mjs`. Expected: every line `OK`, final line `0 violations, 0 overflow, menu OK`, exit code 0. Fix real failures in the pages; do not weaken the script.
- [ ] **Step 4: Review the screenshots** of `index`, `creer`, `histoire` at 768 and 1440 px for an empty column or an uneven card grid; fix the CSS if one appears and re-run Step 3.
- [ ] **Step 5: Commit**

```bash
git add website-prototype/package.json website-prototype/package-lock.json website-prototype/tools/verify-browser.mjs design/07-review/screens-2026-10-28
git commit -m "test: axe, overflow, menu and screenshots for the two-door site"
```

- [ ] **Step 6: Hand over**: report the commit list, the test output, and these items not covered here: `_redirects` only works on Cloudflare (verify after the founder's deploy go), screen-reader pass, 200% zoom, Lighthouse. Do not push.
