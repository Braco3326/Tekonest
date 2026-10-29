import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NAV } from "./build.mjs";

const ROOT = new URL("../", import.meta.url);
const rootPath = (name) => fileURLToPath(new URL(name, ROOT));

/** File text with Windows line endings normalised. */
export const page = (name) => readFileSync(rootPath(name), "utf8").replace(/\r\n/g, "\n");
/** Root-level built pages. */
export const pages = () => readdirSync(rootPath("")).filter((f) => f.endsWith(".html")).sort();
/** Visible text after <body>: scripts, styles and tags removed. */
export const bodyText = (html) =>
  html
    .slice(html.indexOf("<body>"))
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, "");

test("every built page has a source fragment", () => {
  for (const name of pages()) {
    assert.ok(existsSync(rootPath(`src/pages/${name}`)), `${name} has no fragment in src/pages`);
  }
});

test("every local link and anchor resolves", () => {
  const problems = [];
  for (const name of pages()) {
    const html = page(name);
    for (const [, ref] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|mailto:|tel:|data:)/.test(ref)) continue;
      const [path, hash] = ref.split("#");
      const targetName = path === "" ? name : path.split("?")[0];
      let target = rootPath(targetName);
      if (!existsSync(target)) {
        problems.push(`${name}: ${ref} (missing file)`);
        continue;
      }
      if (statSync(target).isDirectory()) target = `${target}/index.html`;
      if (!existsSync(target)) {
        problems.push(`${name}: ${ref} (directory without index.html)`);
        continue;
      }
      if (hash && target.endsWith(".html")) {
        const text = readFileSync(target, "utf8");
        if (!text.includes(`id="${hash}"`)) problems.push(`${name}: ${ref} (no id="${hash}")`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test("no space before ; : ! ? or » in text nodes", () => {
  const problems = [];
  for (const name of pages()) {
    const text = bodyText(page(name));
    const bad = text.match(/ [;:!?»]|« /g);
    if (bad) problems.push(`${name}: ${bad.length} (${[...new Set(bad)].join(" | ")})`);
  }
  assert.deepEqual(problems, []);
});

test("the header nav marks exactly the current page", () => {
  for (const [href] of NAV) {
    const html = page(href);
    const nav = html.slice(html.indexOf('<nav id="site-nav"'), html.indexOf("</nav>"));
    const marks = [...nav.matchAll(/<a href="([^"]+)" aria-current="page">/g)].map((m) => m[1]);
    assert.deepEqual(marks, [href], `${href}: header nav marks ${JSON.stringify(marks)}`);
  }
});

const plain = (text) => text.replace(/ /g, " ");

test("creer page content", () => {
  const html = plain(page("creer.html"));
  assert.match(html, /<h1[^>]*>Une expérience au service de votre projet\.<\/h1>/);
  const families = [...html.matchAll(/<li class="family cadre">([\s\S]*?)<\/li>/g)].map((m) => m[1]);
  assert.deepEqual(
    families.map((f) => f.match(/<h3>(.*?)<\/h3>/)[1]),
    ["Création sonore", "Prise de son", "Live", "Direction artistique, mixage et mastering"]
  );
  for (const f of families) assert.match(f, /<span class="status status--prep">En projet<\/span>/);
  assert.match(html, /<a class="btn btn-primary" href="contact\.html">Parlez-nous de votre projet<\/a>/);
  assert.match(html, /Ce n'est ni un devis ni un engagement/);
});

test("creer page makes no price or availability claim", () => {
  assert.doesNotMatch(bodyText(plain(page("creer.html"))), /€|tarif|prix|gratuit|réserv/i);
});

test("organiser.html is gone and creer.html replaces it in the nav", () => {
  assert.equal(existsSync(rootPath("organiser.html")), false);
  assert.equal(existsSync(rootPath("src/pages/organiser.html")), false);
  assert.ok(!NAV.some(([href]) => href === "organiser.html"));
  assert.match(page("index.html"), /<li><a href="creer\.html">Créer avec nous<\/a><\/li>/);
});

test("old organiser links redirect", () => {
  const redirects = page("_redirects");
  assert.match(redirects, /^\/organiser \/creer\.html 301$/m);
  assert.match(redirects, /^\/organiser\.html \/creer\.html 301$/m);
});

test("families grid is two columns from 48 em", () => {
  const css = page("assets/css/site.css");
  assert.match(css, /\.families\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 47\.99em\)\s*\{\s*\.families\s*\{[^}]*grid-template-columns: 1fr/);
});

const main = (name) => {
  const html = plain(page(name));
  return html.slice(html.indexOf("<main"), html.indexOf("</main>"));
};

test("doors grid has two columns", () => {
  assert.match(page("assets/css/site.css"), /\.doors\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
});

test("no network, no three-door wording, no Rebels in any built page", () => {
  const problems = [];
  for (const name of pages()) {
    const hits = plain(page(name)).match(/r[ée]seau|trois entrées|organiser\.html|Rebels/gi);
    if (hits) problems.push(`${name}: ${[...new Set(hits)].join(", ")}`);
  }
  assert.deepEqual(problems, []);
});

test("reseau.html is gone and its old URLs redirect home", () => {
  assert.equal(existsSync(rootPath("reseau.html")), false);
  assert.equal(existsSync(rootPath("src/pages/reseau.html")), false);
  const redirects = page("_redirects");
  assert.match(redirects, /^\/reseau \/ 301$/m);
  assert.match(redirects, /^\/reseau\.html \/ 301$/m);
});

test("nav has four entries in the agreed order", () => {
  assert.deepEqual(NAV, [
    ["apprendre.html", "Se former"],
    ["creer.html", "Créer avec nous"],
    ["histoire.html", "L'histoire"],
    ["contact.html", "Contact"],
  ]);
});

test("footer carries the new tagline and date", () => {
  for (const name of pages()) {
    const footer = plain(page(name)).split("<footer")[1];
    assert.match(footer, /Un nid pour les métiers du son : se former, créer ensemble\./, name);
    assert.match(footer, /Prototype de conception, 28 octobre 2026\./, name);
  }
});

test("histoire describes the creation service", () => {
  const text = bodyText(plain(page("histoire.html")));
  assert.match(text, /une expérience au service des projets des autres/);
  assert.match(text, /Un musicien et un DJ ont dit oui pour cofonder le projet/);
});

test("contact note mentions a project to create with us", () => {
  assert.match(bodyText(plain(page("contact.html"))), /un projet à créer avec nous/);
});

test("home does not claim Tekonest already works in all seven trades", () => {
  const html = plain(main("index.html"));
  assert.match(html, /les sept métiers avec lesquels Tekonest veut travailler/);
  assert.doesNotMatch(html, /dans lesquels Tekonest travaille/);
});

// ---- Phase B3: the marquetry as a theme, never as pictures (spec section 9) ----
const css = () => page("assets/css/site.css");
const ruleBlock = (text, selector) => {
  const i = text.indexOf(selector + " {");
  return i < 0 ? "" : text.slice(i, text.indexOf("}", i));
};
const homeHtml = () => plain(page("index.html"));
const BRANCH = ["apprendre", "creer", "histoire", "contact", "accessibilite", "tekpractice"];
const mainOf = (name) => { const h = plain(page(name + ".html")); return h.slice(h.indexOf("<main"), h.indexOf("</main>")); };

test("the panel tokens exist", () => {
  const tokens = page("assets/css/tokens.css");
  for (const name of ["--pearl", "--pearl-dim", "--walnut-dark", "--ebony", "--wire"]) assert.match(tokens, new RegExp(`${name}\\s*:`), name);
});

test("no picture of the panel ships: no raster file, no canvas, no panel script", () => {
  const raster = /\.(webp|jpe?g|png|gif|avif)\b/i;
  for (const name of pages()) {
    const h = page(name);
    assert.doesNotMatch(h, /<canvas\b/, `${name}: canvas`);
    assert.doesNotMatch(h, /panel\.js/, `${name}: panel script`);
    assert.doesNotMatch(h, new RegExp(`(?:src|srcset|href|content)="[^"]*${raster.source}`, "i"), `${name}: raster reference`);
  }
  assert.doesNotMatch(css(), new RegExp(`url\\([^)]*${raster.source}`, "i"), "site.css references a raster file");
  for (const gone of ["assets/img/panel", "assets/js/panel.js"]) assert.equal(existsSync(rootPath(gone)), false, `${gone} is still shipped`);
});

test("the bands are rules in the stylesheet, not files", () => {
  for (const rule of [".rule-rope", ".rule-tri", ".rule-saw"]) {
    const block = ruleBlock(css(), rule) + ruleBlock(css(), rule + "::before");   // the triangle band draws on its pseudo-elements
    assert.ok(ruleBlock(css(), rule), `${rule} has no rule`);
    assert.match(block, /mask(-image)?:/, `${rule} is not drawn by a mask`);
    assert.doesNotMatch(block, /url\((?!["']?data:image\/svg\+xml)/, `${rule} points at a file`);
  }
  assert.match(ruleBlock(css(), ".rule"), /display:\s*block/);
});

test("the rope is a chain of rounded links, not straight stripes", () => {
  // Straight parallel bars read as hazard tape. The mask must draw rounded (rx) links.
  assert.match(decodeURIComponent(ruleBlock(css(), ".rule-rope")), /<rect[^>]*\brx=/);
});

test("the wire frame and the roundel are CSS components", () => {
  assert.match(ruleBlock(css(), ".cadre-filet--fil"), /border-color:\s*var\(--wire\)/);
  assert.match(ruleBlock(css(), ".roundel"), /border-radius:\s*50%/);
});

test("the old diamond strip, hero canvas and replay button are gone from the CSS", () => {
  const text = css();
  assert.doesNotMatch(text, /\.bande\b/);
  assert.doesNotMatch(text, /\.site-footer::before/);
  assert.doesNotMatch(text, /\.hero-nuit canvas/);
  assert.doesNotMatch(text, /\.btn-replay/);
  assert.doesNotMatch(text, /\.hero-panel|\.branch-hero__art|\.site-footer__seal|\.cta-nuit__bg/);
});

test("cards carry nested fillets", () => {
  const block = ruleBlock(css(), ".door.cadre, .family.cadre");
  assert.match(block, /box-shadow:\s*inset 0 0 0 5px[^;]*,\s*inset 0 0 0 6px/);
});

test("lists use the star bullet", () => {
  assert.match(ruleBlock(css(), ".cols ul"), /list-style:\s*none/);
  assert.match(ruleBlock(css(), ".cols li"), /background:[^;]*data:image\/svg\+xml/);
});

test("the old halo animation is gone", () => {
  assert.doesNotMatch(css(), /halo-turn/);
  assert.doesNotMatch(css(), /\.direction\b/);
});

test("the home hero is a typographic field inside the wire frame, with no picture", () => {
  const hero = homeHtml().match(/<section class="hero-nuit"[\s\S]*?<\/section>/);
  assert.ok(hero, "no hero");
  assert.match(hero[0], /<div class="cadre-filet cadre-filet--fil" aria-hidden="true"><\/div>/);
  assert.doesNotMatch(hero[0], /<img|<figure|<canvas|<button/);
});

test("the old hero is gone", () => {
  assert.doesNotMatch(homeHtml(), /nid-stage|nid-son|nid-replay|home\.js|texture-damas|class="bande"|hero-panel/);
});

test("the dividers follow the mapping", () => {
  const html = homeHtml();
  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  assert.equal((main.match(/class="rule /g) || []).length, 2, "rope and triangle band inside the home page content (the sawtooth is the footer's)");
  assert.doesNotMatch(html, /rule--sunken/, "a band between two fields of the same colour is invisible, so there is none");
  assert.match(html, /<\/section>\s*<div class="rule rule-rope" role="presentation"><\/div>\s*<section class="section[^"]*" aria-labelledby="etat">/);
  assert.match(html, /<div class="rule rule-tri" role="presentation"><\/div>\s*<section class="cta-nuit" aria-labelledby="maintenant">/);
});

test("the closing band is a flat field in the wire frame", () => {
  const band = homeHtml().match(/<section class="cta-nuit"[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(band, /<img|cta-nuit__bg/);
  assert.match(band, /<div class="cadre-filet cadre-filet--fil" aria-hidden="true"><\/div>/);
});

test("every branch page has a rope divider right after its hero", () => {
  for (const n of BRANCH) {
    assert.match(mainOf(n), /<section class="branch-hero"[\s\S]*?<\/section>\s*<div class="rule rule-rope" role="presentation"><\/div>/, n);
  }
});

test("creer opens with the triangle band", () => {
  assert.match(mainOf("creer"), /^<main id="contenu">\s*<div class="rule rule-tri" role="presentation"><\/div>\s*<section class="branch-hero"/);
});

test("apprendre's hero is text only", () => {
  const m = mainOf("apprendre");
  assert.doesNotMatch(m, /branch-hero__grid|branch-hero__art|<img/);
});

test("every page ends with a sawtooth divider, the roundel and the credit line", () => {
  for (const name of pages()) {
    const h = plain(page(name));
    assert.match(h, /<\/main>\s*<div class="rule rule-saw" role="presentation"><\/div>\s*<footer class="site-footer">/, name);
    assert.match(h, /<div class="roundel" aria-hidden="true">\s*<svg[\s\S]*?<\/svg>\s*<\/div>/, `${name}: roundel`);
    assert.match(h, /Motifs inspirés de la marqueterie de Damas\. Géométrie reconstruite par Tekonest\./, name);
  }
});

test("every page preloads the fonts it paints first, so text cannot shift when they arrive", () => {
  for (const name of pages()) {
    for (const file of ["tektur-medium", "ibm-plex-sans-latin-400-normal", "ibm-plex-sans-latin-500-normal", "ibm-plex-sans-latin-600-normal"]) {
      assert.match(page(name), new RegExp(`<link rel="preload" href="assets/fonts/${file}\\.woff2" as="font" type="font/woff2" crossorigin>`), `${name}: ${file}`);
    }
  }
});

test("no page declares a share image", () => {
  for (const name of pages()) assert.doesNotMatch(page(name), /og:image/, name);
});

// ---- Phase C: the Berghain model (spec 2026-10-29-tekonest-berghain-adaptation.md) ----
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

const heroOf = () => homeHtml().match(/<section class="hero-nuit"[\s\S]*?<\/section>/)[0];

test("the home hero states what Tekonest is, then holds two equal doors", () => {
  const h = heroOf();
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
  assert.ok(h.indexOf("</ul>") < h.indexOf("</section>") && h.indexOf('class="lead"') < h.indexOf('class="doors'), "the statement comes before the doors");
});

test("the doors are two equal columns from 48 em and stack below", () => {
  assert.match(ruleBlock(css(), ".doors"), /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css(), /@media \(max-width: 47\.99em\)\s*\{[^}]*\.doors\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(ruleBlock(css(), ".door--dark"), /box-shadow:\s*inset 0 0 0 5px[^;]*,\s*inset 0 0 0 6px/);
});

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
  assert.match(css(), /\.board--groups/);
});

test("the seven fils are seven numbered rows and the marquetry sentence has moved", () => {
  const html = main("index.html");
  const fils = html.match(/<ol class="fils">[\s\S]*?<\/ol>/)[0];
  assert.deepEqual([...fils.matchAll(/<span class="fil-n">(\d\d)<\/span>/g)].map((m) => m[1]), ["01", "02", "03", "04", "05", "06", "07"]);
  assert.match(html, /Le nid a sept fils : les sept métiers avec lesquels Tekonest veut travailler\./);
  assert.doesNotMatch(html, /marqueterie|Un nid tient ensemble/);
});

test("the stylesheets are brace-balanced and never close more than they open", () => {
  for (const f of ["assets/css/site.css", "assets/css/tokens.css"]) {
    let depth = 0;
    for (const ch of page(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/"[^"]*"/g, '""')) {
      if (ch === "{") depth++;
      if (ch === "}") { depth--; assert.ok(depth >= 0, `${f}: a stray }`); }
    }
    assert.equal(depth, 0, `${f}: unbalanced braces`);
  }
});
