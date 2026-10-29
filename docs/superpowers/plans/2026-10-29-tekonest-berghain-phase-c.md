# Phase C Implementation Plan: the Berghain model on the Tekonest site

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One canonical status list, two equal doors above the fold, a closed status vocabulary, a six-size type scale and plain copy, on every page.
**Architecture:** Pure static change: fragments in `website-prototype/src/pages/`, the layout in `tools/build.mjs`, rules in `assets/css/site.css` and `tokens.css`. No new file type, font, dependency or picture.
**Tech Stack:** HTML fragments, `tools/build.mjs`, vanilla CSS, `node --test` (`tools/site.test.mjs`), Playwright verifier (`tools/verify-browser.mjs`).
**Spec:** `docs/superpowers/specs/2026-10-29-tekonest-berghain-adaptation.md` (decisions 23-30, acceptance in section 7). Branch: `site/theme` (local head carries the Phase B3 theme and this spec). Run commands from `website-prototype/`.

## Global Constraints

- Four status labels only, with these classes: **Version d'essai** `status--now`, **En développement** `status--dev`, **En projet** `status--prep`, **À venir** `status--later` (glyphs already in `site.css`).
- Six type tokens only: `--text-label` 0.8125rem, `--text-sm` 0.875rem, `--text-base` 1.0625rem, `--text-lg` 1.25rem, `--text-2xl` `clamp(1.75rem, 1.2rem + 2vw, 2.5rem)`, `--text-hero` `clamp(2.25rem, 1.4rem + 3.6vw, 3.75rem)`. No new font file. No new colour token.
- Three breakpoints only: `(max-width: 39.99em)`, `(max-width: 47.99em)`, `(max-width: 63.99em)`.
- Two ornament types per viewport: frames (wire frame, nested fillets) and bands (rope, triangle, sawtooth); the footer roundel is the footer's.
- No picture, canvas or disabled control. French copy with the build's narrow no-break spaces (write `&#8239;` in fragments before `: ; ! ?`). The honesty rule: nothing is described as available that is not; `robots noindex` stays; the credit line stays.
- Commit with explicit paths, never `git checkout --` a generated page (rebuild with `node tools/build.mjs` instead). Nothing is pushed without the founder's go.

## Review Focus

- **Door equality:** at 48 em, 768 px and 1024 px the two doors are side by side with equal widths; below 48 em they stack in order 01, 02 and both are reachable by keyboard; each door's status text is its own (honest asymmetry), never styled as better or worse. Pinned in Tasks 2 and 6.
- **Grouped status table semantics:** group rows are `th scope="rowgroup"`; the stacked layout below 48 em keeps the group names and the `data-label`s readable; axe reports 0 violations. Pinned in Tasks 3 and 6.
- **Dark-panel contrast and focus:** door numbers, names, status and links on Nuit meet 4.5:1; the focus ring is Papier inside the hero. Pinned in Tasks 2 and 6 (axe plus a keyboard check).
- **Nothing claims availability:** only TekPractice is « Version d'essai »; legend and footer wording agree. Pinned in Tasks 3 and 5.
- **Breakpoint unification regressions:** no overflow or clipped text at 320, 375, 768, 1024 and 1440 px; the footer, seven fils and tables behave at 48 em exactly. Pinned in Tasks 1 and 6.

---

### Task 1: Type scale, breakpoints, section-head tokens

**Files:**
- Modify: `assets/css/tokens.css` (the `--text-*` block), `assets/css/site.css` (every `font-size`/`font:` and `@media`), `tools/site.test.mjs`

**Interfaces:**
- Produces: tokens `--text-label`, `--text-sm`, `--text-base`, `--text-lg`, `--text-2xl`, `--text-hero`; `--text-xl` and `--text-3xl` no longer exist. The three breakpoint values above. Later tasks use only these.

- [ ] **Step 1: Write the failing tests** in `tools/site.test.mjs` (a "Phase C" block after the Phase B3 block):

```js
test("the type scale has six sizes and nothing else sets a size", () => {
  const tokens = page("assets/css/tokens.css");
  const names = [...tokens.matchAll(/--text-([a-z0-9]+)\s*:/g)].map((m) => m[1]).sort();
  assert.deepEqual(names, ["2xl", "base", "hero", "label", "lg", "sm"]);
  for (const [, n] of css().matchAll(/var\(--text-([a-z0-9]+)\)/g)) assert.ok(names.includes(n), `--text-${n} is not in the scale`);
  for (const [, v] of css().matchAll(/font-size:\s*([^;}]+)/g)) assert.doesNotMatch(v, /\d(rem|px)\b/, `raw size ${v}`);
  for (const [, v] of css().matchAll(/\bfont:\s*([^;}]+)/g)) assert.doesNotMatch(v, /\d(rem|px)\b/, `raw size in font: ${v}`);
});

test("site.css uses three breakpoints only", () => {
  const q = [...css().matchAll(/@media \(max-width: ([^)]+)\)/g)].map((m) => m[1]);
  assert.ok(q.length >= 5);
  for (const v of q) assert.ok(["39.99em", "47.99em", "63.99em"].includes(v), `breakpoint ${v}`);
});
```
Update the existing test "families grid is two columns above 800px" to expect `@media (max-width: 47.99em)` instead of 800px.
- [ ] **Step 2: Run** `node --test tools/site.test.mjs`. Expected: the two new tests FAIL (`--text-xl` present, raw sizes, px queries).
- [ ] **Step 3: Implement.** In `tokens.css` define the six tokens (comment each with px) and delete `--text-xl`, `--text-3xl`. In `site.css` map every use: `--text-xl`→`--text-lg`, `--text-3xl`→`--text-2xl`; any raw or `clamp()` size (the failing test lists each) becomes a token; raw `0.75rem` (eyebrow, `.fil-n`) → `var(--text-label)` (also set `.eyebrow` to uppercase 500 as now); `1.375rem`, `1.125rem` → `var(--text-lg)`; `0.95rem` → `var(--text-sm)`; `1.0625rem` → `var(--text-base)`. Convert media queries by this table: 600→39.99em; 720, 760, 800→47.99em; 860, 960, 1100→63.99em.
- [ ] **Step 4: Run** `node --test` then `node tools/verify-browser.mjs`. Expected: all tests PASS; `0 violations, 0 overflow, menu OK` (768 px is now desktop for the old 800 px rules: confirm no overflow).
- [ ] **Step 5: Commit** `git add website-prototype/assets/css website-prototype/tools/site.test.mjs` then `git commit -m "css: six-size type scale and three breakpoints"`.

### Task 2: Home hero with two equal doors

**Files:**
- Modify: `src/pages/index.html` (hero and the old « Deux entrées » section), `assets/css/site.css` (`.hero-nuit`, `.doors`, `.door` dark variant), `tools/site.test.mjs`

**Interfaces:**
- Consumes: Task 1 tokens and breakpoints.
- Produces: markup contract for each door, `li.door.door--dark` containing in order `p.door-n` ("01"/"02"), `h2.door-name > a`, `p.door-who`, `p.door-sentence`, `p.door-state > span.status`, `p.door-action > a.inner`. Hero order: `p.eyebrow`, `h1#hero-titre`, `p.lead`, `p.honest`, `ul.doors.doors--hero`, then the rope band. The old `<section aria-labelledby="entrees">` is deleted; the next section is `aria-labelledby="etat"` (Task 3).

- [ ] **Step 1: Write the failing tests** (replace the old "home shows exactly two doors", "home hero copy and section titles say two entrances", "doors grid has two columns" tests, and update "the hero text is unchanged" and "the dividers follow the mapping" so the rope is followed by `aria-labelledby="etat"`):

```js
const hero = () => homeHtml().match(/<section class="hero-nuit"[\s\S]*?<\/section>/)[0];

test("the home hero states what Tekonest is, then holds two equal doors", () => {
  const h = hero();
  assert.match(h, /<h1 id="hero-titre">Un nid pour les métiers du son\.<\/h1>/);
  assert.match(h, /<p class="lead">Deux entrées : se former au son, ou créer un projet avec nous\.<\/p>/);
  assert.match(h, /Tekonest se construit pas à pas\. Rien n'est encore en vente : chaque ligne de cette page dit ce qui existe et ce qui se prépare\./);
  assert.doesNotMatch(homeHtml(), /href="#entrees"|des fils tressés ensemble|Les deux entrées/);
  const doors = [...h.matchAll(/<li class="door door--dark">([\s\S]*?)<\/li>/g)].map((m) => m[1]);
  assert.equal(doors.length, 2);
  const shape = (d) => [...d.matchAll(/class="(door-n|door-name|door-who|door-sentence|door-state|door-action)"/g)].map((m) => m[1]);
  assert.deepEqual(shape(doors[0]), ["door-n", "door-name", "door-who", "door-sentence", "door-state", "door-action"]);
  assert.deepEqual(shape(doors[1]), shape(doors[0]));
  assert.deepEqual(doors.map((d) => d.match(/<p class="door-n">(\d\d)<\/p>/)[1]), ["01", "02"]);
  assert.deepEqual([...h.matchAll(/<h2 class="door-name"><a href="([^"]+)">([^<]+)</g)].map((m) => [m[1], m[2]]), [["apprendre.html", "Se former"], ["creer.html", "Créer avec nous"]]);
  assert.match(doors[0], /Étudiantes et étudiants en BTS Son/);
  assert.match(doors[0], /<span class="status status--dev">En développement<\/span>/);
  assert.match(doors[0], /<a class="inner" href="tekpractice\/jouer\/">Jouer à TekPractice \(version d'essai\)<\/a>/);
  assert.match(doors[1], /Porteuses et porteurs de projet : spectacle, film, événement/);
  assert.match(doors[1], /<span class="status status--prep">En projet<\/span>/);
  assert.match(doors[1], /<a class="inner" href="contact\.html">Écrire pour un projet<\/a>/);
});

test("the doors are two equal columns from 48 em and stack below", () => {
  assert.match(ruleBlock(css(), ".doors"), /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css(), /@media \(max-width: 47\.99em\)\s*\{[^}]*\.doors\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(ruleBlock(css(), ".door--dark"), /box-shadow:\s*inset 0 0 0 5px[^;]*,\s*inset 0 0 0 6px/);
});
```
- [ ] **Step 2: Run** `node --test tools/site.test.mjs`. Expected: FAIL (old hero, no `.door--dark`).
- [ ] **Step 3: Implement** the hero per the spec table in section 5.1 (copy exactly as in the tests; `&#8239;` before the colons and the `?`). Statement left-aligned to the container; `.door--dark` is `.door.cadre` recoloured for Nuit: ground `var(--color-ink)`, text `var(--color-on-dark)` / `--color-on-dark-2`, nested fillet in `var(--noyer-dark)`, amber door number (`--text-label`, Tektur), whole-door link overlay kept, `.inner` link above it, focus ring Papier. Remove the hero's `min-height` and centring; delete the retired « Deux entrées » section and the unused `.doors--cadre`/`.door-nid` rules if nothing else uses them. **Reorder the remaining home sections now** so the existing status section (`aria-labelledby="etat"`, still the old table) directly follows the rope and « Sept fils » follows it; Task 3 then only rewrites their content.
- [ ] **Step 4: Run** `node --test`. Expected: PASS except tests owned by Task 3 (home status table and seven fils still on the old structure: update the "status board" test in Task 3, keep this task green by leaving the old table in place until then).
- [ ] **Step 5: Commit** `git add website-prototype/src/pages/index.html website-prototype/*.html website-prototype/assets/css website-prototype/tools/site.test.mjs` then `git commit -m "site: home hero states what Tekonest is and holds the two equal doors"`.

### Task 3: Status legend, grouped index, compact seven fils

**Files:**
- Modify: `src/pages/index.html`, `assets/css/site.css` (`.legend`, `.board--groups`, `.fils`), `tools/site.test.mjs`

**Interfaces:**
- Consumes: Task 2 hero and its rope band; the four status classes.
- Produces: `dl.legend` (home only) and `table.board.board--groups` markup contract used in tests; `ol.fils > li.fil` with `.fil-n` = "01".."07".

- [ ] **Step 1: Write the failing tests** (replace "status board lists three branches and the build date"):

```js
test("the home status index is one grouped table with a single legend", () => {
  const html = main("index.html");
  const labels = [["status--now", "Version d'essai"], ["status--dev", "En développement"], ["status--prep", "En projet"], ["status--later", "À venir"]];
  const legend = html.match(/<dl class="legend">([\s\S]*?)<\/dl>/)[1];
  assert.deepEqual([...legend.matchAll(/<span class="status (status--\w+)">([^<]+)<\/span>/g)].map((m) => [m[1], m[2]]), labels);
  for (const name of pages().filter((n) => n !== "index.html")) assert.doesNotMatch(page(name), /class="legend"/, name);
  const table = html.match(/<table class="board board--groups">[\s\S]*?<\/table>/)[0];
  assert.deepEqual([...table.matchAll(/<th scope="rowgroup"[^>]*>([^<]+)<\/th>/g)].map((m) => m[1]), ["Déjà là", "En construction", "Ensuite"]);
  const rows = table.match(/<tr>\s*<th scope="row"[\s\S]*?<\/tr>/g);
  assert.deepEqual(rows.map((r) => r.match(/<th scope="row"[^>]*>(?:<a [^>]*>)?([^<]+)/)[1]),
    ["TekPractice", "Apprendre", "Créer avec nous", "Cours des autres épreuves", "TekPractice dans le cours E4"]);
  assert.deepEqual(rows.map((r) => r.match(/status (status--\w+)/)[1]), ["status--now", "status--dev", "status--prep", "status--later", "status--later"]);
  for (const r of rows) assert.deepEqual([...r.matchAll(/data-label="([^"]+)"/g)].map((m) => m[1]), ["Pour qui", "État", "Prochaine étape"]);
  assert.equal((html.match(/Mis à jour le 28 octobre 2026\./g) || []).length, 1);
  assert.ok(html.indexOf('aria-labelledby="etat"') < html.indexOf('aria-labelledby="fils"'));
});

test("the seven fils are seven numbered rows and the marquetry sentence has moved", () => {
  const html = main("index.html");
  const fils = html.match(/<ol class="fils">[\s\S]*?<\/ol>/)[0];
  assert.deepEqual([...fils.matchAll(/<span class="fil-n">(\d\d)<\/span>/g)].map((m) => m[1]), ["01", "02", "03", "04", "05", "06", "07"]);
  assert.match(html, /Le nid a sept fils : les sept métiers avec lesquels Tekonest veut travailler\./);
  assert.doesNotMatch(html, /marqueterie|Un nid tient ensemble/);
});
```
- [ ] **Step 2: Run** `node --test tools/site.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.** Legend text (one line each, after the statuses): Version d'essai « utilisable dès maintenant, encore en travaux » · En développement « en construction, pas encore ouvert » · En projet « une intention : rien n'est promis » · À venir « prévu, après une autre étape ». Index rows exactly as the spec table in 5.1 (group header rows span 4 columns). `.board--groups`: group row in `--text-label` uppercase, hairline rows, 44 px minimum row height, stacked below 47.99em with the group header kept. Seven fils: one row each (mark 28 px, number, name, one line); keep the page's single signature, drop the sunken background if it duplicates the table's. The « Fil n/7 » text becomes "01"…"07".
- [ ] **Step 4: Run** `node --test` and `node tools/verify-browser.mjs`. Expected: PASS, 0 violations.
- [ ] **Step 5: Commit** `git add website-prototype/src/pages/index.html website-prototype/index.html website-prototype/assets/css website-prototype/tools/site.test.mjs` then `git commit -m "site: grouped status index with one legend, compact seven fils"`.

### Task 4: Créer and Se former as rows; dead controls and commentary removed

**Files:**
- Modify: `src/pages/creer.html`, `src/pages/apprendre.html`, `assets/css/site.css` (add `.rows`; delete `.families`, `.family*`, `.products`, `.product*`, `.preview-*`, `.endorse`), `tools/site.test.mjs`

**Interfaces:**
- Consumes: Task 1 tokens; status vocabulary.
- Produces: `ol.rows > li` (child order `span.row-n`, `h3`, `p`) used by *Créer*; `ul.rows` used by *Se former*.

- [ ] **Step 1: Write the failing tests** (replace "creer page content" and delete "families grid is two columns above 800px"):

```js
test("creer lists four numbered rows with no repeated badge", () => {
  const html = plain(page("creer.html"));
  assert.match(html, /<h1[^>]*>Une expérience au service de votre projet\.<\/h1>/);
  assert.match(html, /Quatre manières de travailler ensemble\. Toutes sont encore en projet : dites-nous ce dont votre projet a besoin\./);
  const rows = [...html.matchAll(/<ol class="rows">([\s\S]*?)<\/ol>/g)][0][1].match(/<li>[\s\S]*?<\/li>/g);
  assert.deepEqual(rows.map((r) => r.match(/<h3>(.*?)<\/h3>/)[1]), ["Création sonore", "Prise de son", "Live", "Direction artistique, mixage et mastering"]);
  assert.equal((html.match(/class="status /g) || []).length, 1, "the status is said once, in the hero");
  assert.match(html, /<span class="status status--prep">En projet<\/span>/);
  assert.match(html, /<a class="btn btn-primary" href="contact\.html">Parlez-nous de votre projet<\/a>/);
  assert.match(html, /Ce n'est ni un devis ni un engagement/);
});

test("apprendre keeps no mock, no design commentary and no disabled control", () => {
  const html = plain(page("apprendre.html"));
  assert.doesNotMatch(html, /product-preview|preview-apprendre|endorse|Proposition\s*:|<button[^>]*disabled/);
  assert.match(html, /Pas encore ouvert\./);
  assert.match(html, /<a href="contact\.html">Nous écrire<\/a>/);
  assert.deepEqual([...html.matchAll(/<ul class="rows">([\s\S]*?)<\/ul>/g)].map((m) => (m[1].match(/<li>/g) || []).length), [4, 3], "four existing and three upcoming items stay");
});

test("no page has a disabled button, and the retired card and mock styles are gone", () => {
  for (const name of pages()) assert.doesNotMatch(page(name), /<button[^>]*\bdisabled\b/, name);
  assert.doesNotMatch(css(), /\.families|\.family\b|\.product-preview|\.preview-(apprendre|tekpractice)|\.endorse/);
  assert.match(ruleBlock(css(), ".rows li"), /min-height:\s*44px/);
});
```
- [ ] **Step 2: Run** `node --test tools/site.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.** *Créer*: hero badge becomes « En projet »; the four families become `ol.rows` rows (number "01"-"04", h3, description unchanged); keep « Comment ça se passe » and the closing call. *Se former*: delete the `.products` block, the CSS mock and the « Proposition » line; « Ce qui existe déjà » (four items) and « Ce qui se prépare » (three items) become `ul.rows` lists with the existing wording; « Accès à la plateforme » keeps its two sentences, the disabled button becomes `<p>Pas encore ouvert. <a href="contact.html">Nous écrire</a></p>`. `.rows`: hairline separators, `--text-base`, 44 px rows, no card chrome.
- [ ] **Step 4: Run** `node --test` and `node tools/verify-browser.mjs`. Expected: PASS.
- [ ] **Step 5: Commit** `git add website-prototype/src/pages website-prototype/*.html website-prototype/assets/css website-prototype/tools/site.test.mjs` then `git commit -m "site: Créer and Se former as rows; mock, commentary and disabled button removed"`.

### Task 5: Status vocabulary everywhere, TekPractice, L'histoire, footer and menu

**Files:**
- Modify: `src/pages/tekpractice.html`, `src/pages/histoire.html`, `tools/build.mjs` (footer), `assets/css/site.css` (footer, `.site-nav`), `tools/site.test.mjs`

**Interfaces:**
- Consumes: the four labels and classes; the roundel and credit line from Phase B3.
- Produces: `footColumns()` in `build.mjs` returning the two link columns used by the layout.

- [ ] **Step 1: Write the failing tests:**

```js
test("every status on every page is one of the four labels, with its own class", () => {
  const ok = { "Version d'essai": "status--now", "En développement": "status--dev", "En projet": "status--prep", "À venir": "status--later" };
  for (const name of pages()) {
    for (const [, cls, text] of plain(page(name)).matchAll(/<span class="status (status--\w+)">([^<]+)<\/span>/g)) {
      assert.equal(ok[text], cls, `${name}: « ${text} » with ${cls}`);
    }
  }
});

test("TekPractice says Version d'essai once and drops the repeated Nouveau badges", () => {
  const html = plain(page("tekpractice.html"));
  assert.match(html, /<span class="status status--now">Version d'essai<\/span>/);
  assert.doesNotMatch(html, />Nouveau<\/span>/);
  assert.match(html, /<span class="status status--later">À venir<\/span>/);
});

test("L'histoire explains the motifs before the values", () => {
  const html = plain(page("histoire.html"));
  assert.match(html, /Les motifs du site \(cadres, bandes, médaillon\) sont inspirés de la marqueterie de Damas, faite de bois et de nacre\. Ils sont dessinés par Tekonest et ne prétendent pas reproduire ce savoir-faire\./);
  assert.ok(html.indexOf('id="motifs"') < html.indexOf('id="valeurs"'));
});

test("the footer has two link columns and the dated fine print under État", () => {
  for (const name of pages()) {
    const f = plain(page(name)).split("<footer")[1];
    assert.deepEqual([...f.matchAll(/<p class="foot-title">([^<]+)<\/p>/g)].map((m) => m[1]), ["Entrées", "Tekonest", "État"], name);
    assert.deepEqual([...f.split('<p class="foot-title">Tekonest</p>')[0].matchAll(/<li><a href="([^"]+)"/g)].map((m) => m[1]), ["apprendre.html", "creer.html"], name);
    assert.match(f, /seuls les services marqués « version d'essai » sont utilisables aujourd'hui, ceux marqués « en développement », « en projet » ou « à venir » ne sont pas proposés\./, name);
    assert.match(f, /Géométrie reconstruite par Tekonest\./, name);
  }
});
```
- [ ] **Step 2: Run** `node --test tools/site.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.** TekPractice: hero badge « Version d'essai » (`status--now`, replacing « En développement · version d'essai »); delete the five « Nouveau » spans; the last row's « En préparation » becomes « À venir » (`status--later`). L'histoire: new `<section class="section" aria-labelledby="motifs">` before « Ce qui guide le projet » (give that section `id="valeurs"` on its heading). `build.mjs`: add `footColumns()` (Entrées: `apprendre.html`, `creer.html`; Tekonest: `histoire.html`, `contact.html`, `accessibilite.html`), each column headed by `<p class="foot-title">`; fine print under `<p class="foot-title">État</p>` with the new sentence; `.site-nav li:nth-child(n+3) a` in `--color-ink-2` (the two doors stay full ink). Update the home door and index statuses already done in Tasks 2-3.
- [ ] **Step 4: Run** `node --test`, three times in a row (the suite runs files in parallel; it must stay green), then `node tools/verify-browser.mjs`. Expected: PASS.
- [ ] **Step 5: Commit** `git add website-prototype/src/pages website-prototype/*.html website-prototype/tools website-prototype/assets/css` then `git commit -m "site: closed status vocabulary, TekPractice badges, motifs on L'histoire, two-column footer"`.

### Task 6: Browser checks, screenshots, docs

**Files:**
- Modify: `tools/verify-browser.mjs`, `README.md`, `docs/superpowers/specs/2026-10-29-tekonest-berghain-adaptation.md` (status line), screenshots under `design/07-review/screens-2026-10-29/`

**Interfaces:**
- Consumes: everything above. Produces: named verifier checks, all `OK`.

- [ ] **Step 1: Write the checks** (named exactly; each prints `OK` or `FAIL`):
  - `home, 1440×900: both doors are fully visible without scrolling`.
  - `home, 390×844: the first door's name and action are visible, the second starts within one scroll`.
  - `home, 768 and 1440: the two doors differ in width by at most 1 px`.
  - `home, 390: the doors stack in order 01 then 02` (document order equals visual order).
  - `home: both doors are reachable by keyboard and the focus ring is visible` (Tab until each door link is focused; the focused element's outline width ≥ 2 px).
  - Extend the page list for axe, overflow and screenshots to 1024 px as well as 320, 375, 768 and 1440; screenshots to `screens-2026-10-29/`.
- [ ] **Step 2: Run** `node tools/verify-browser.mjs`. Expected: any FAIL names the page and width; fix the page or CSS, never weaken a check; finish at `0 violations, 0 overflow, menu OK`.
- [ ] **Step 3: Review the screenshots** (home at 390 and 1440, *Créer* and *Se former* at 1440, a footer) for: two ornament types per viewport, door text overlapping the frame, a table that clips at 320, a status label wrapping badly.
- [ ] **Step 4: Update `README.md`** (type scale, breakpoints, status vocabulary, `.rows`, `.board--groups`, `.legend`) and the spec's status line to « built ».
- [ ] **Step 5: Run** `node --test` three times and `node tools/verify-browser.mjs`. Expected: all green.
- [ ] **Step 6: Commit** `git add website-prototype/tools/verify-browser.mjs website-prototype/README.md docs/superpowers/specs design/07-review/screens-2026-10-29` then `git commit -m "test: browser checks for the doors, the status index and 1024 px; docs"`.
