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

test("families grid is two columns above 800px", () => {
  const css = page("assets/css/site.css");
  assert.match(css, /\.families\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 800px\)\s*\{\s*\.families\s*\{[^}]*grid-template-columns: 1fr/);
});

const main = (name) => {
  const html = plain(page(name));
  return html.slice(html.indexOf("<main"), html.indexOf("</main>"));
};

test("home shows exactly two doors", () => {
  const doors = main("index.html").match(/<ul class="doors[\s\S]*?<\/ul>/)[0];
  assert.equal((doors.match(/<li class="door cadre">/g) || []).length, 2);
  assert.deepEqual(
    [...doors.matchAll(/<h3><a href="([^"]+)">/g)].map((m) => m[1]),
    ["apprendre.html", "creer.html"]
  );
  assert.doesNotMatch(main("index.html"), /reseau\.html/);
});

test("home hero copy and section titles say two entrances", () => {
  const html = main("index.html");
  assert.match(html, /<p class="lead">Se former, créer : des fils tressés ensemble\.<\/p>/);
  assert.match(html, /<a class="btn btn-light" href="#entrees">Les deux entrées<\/a>/);
  assert.match(html, /<p class="eyebrow">Deux entrées<\/p>/);
  assert.doesNotMatch(html, /trois entrées/i);
});

test("status board lists three branches and the build date", () => {
  const html = main("index.html");
  const rows = [...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)][0][1].match(/<tr>[\s\S]*?<\/tr>/g);
  assert.deepEqual(
    rows.map((r) => r.match(/<th[^>]*><a [^>]*>([^<]+)<\/a>/)[1]),
    ["Apprendre", "TekPractice", "Créer avec nous"]
  );
  assert.doesNotMatch(html, /Réseau/);
  assert.match(html, /Mis à jour le 28 octobre 2026\./);
  assert.match(rows[2], /<span class="status status--prep">En projet<\/span>/);
});

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

// ---- Phase B2, Task 4: panel tokens, dividers, frames, bullets, hero layout ----
const css = () => page("assets/css/site.css");
const ruleBlock = (text, selector) => {
  const i = text.indexOf(selector + " {");
  return i < 0 ? "" : text.slice(i, text.indexOf("}", i));
};

test("the panel tokens exist", () => {
  const tokens = page("assets/css/tokens.css");
  for (const name of ["--pearl", "--pearl-dim", "--walnut-dark", "--ebony", "--wire"]) assert.match(tokens, new RegExp(`${name}\s*:`), name);
});

test("the dividers use the rendered tiles", () => {
  for (const [rule, tile] of [[".rule-rope", "rope"], [".rule-tri", "tri"], [".rule-saw", "saw"]]) {
    const block = ruleBlock(css(), rule);
    assert.match(block, new RegExp(`assets/img/panel/${tile}-tile-1x\.webp|\.\./img/panel/${tile}-tile-1x\.webp`), `${rule} tile`);
    assert.ok(existsSync(rootPath(`assets/img/panel/${tile}-tile-1x.webp`)), `${tile} tile file`);
  }
  assert.match(ruleBlock(css(), ".rule"), /repeat-x/);
});

test("the old diamond strip, hero canvas and replay button are gone from the CSS", () => {
  const text = css();
  assert.doesNotMatch(text, /\.bande\b/);
  assert.doesNotMatch(text, /\.site-footer::before/);
  assert.doesNotMatch(text, /\.hero-nuit canvas/);
  assert.doesNotMatch(text, /\.btn-replay/);
});

test("cards carry nested fillets", () => {
  const block = ruleBlock(css(), ".door.cadre, .family.cadre");
  assert.match(block, /box-shadow:\s*inset 0 0 0 5px[^;]*,\s*inset 0 0 0 6px/);
});

test("lists use the star bullet", () => {
  assert.match(ruleBlock(css(), ".cols ul"), /list-style:\s*none/);
  assert.match(ruleBlock(css(), ".cols li"), /background:[^;]*data:image\/svg\+xml/);
});

test("the hero figure reserves its square", () => {
  assert.match(ruleBlock(css(), ".hero-panel"), /aspect-ratio:\s*1\b/);
  assert.match(css(), /\.hero-panel__pause\[hidden\]/);
});

test("the old halo animation is gone", () => {
  assert.doesNotMatch(css(), /halo-turn/);
  assert.doesNotMatch(css(), /\.direction\b/);
});

// ---- Phase B2, Task 5: the home page ----
const homeHtml = () => plain(page("index.html"));

test("the hero is the panel figure", () => {
  const fig = homeHtml().match(/<figure class="hero-panel">[\s\S]*?<\/figure>/);
  assert.ok(fig, "no figure.hero-panel");
  const f = fig[0];
  const img = f.match(/<img class="hero-panel__poster"[^>]*>/)[0];
  assert.match(img, /src="assets\/img\/panel\/hero-poster-720\.webp"/);
  assert.match(img, /srcset="assets\/img\/panel\/hero-poster-720\.webp 720w, assets\/img\/panel\/hero-poster-1200\.webp 1200w"/);
  assert.match(img, /sizes="/);
  assert.match(img, /width="720"/);
  assert.match(img, /height="720"/);
  assert.match(img, /fetchpriority="high"/);
  assert.doesNotMatch(img, /loading="lazy"/);
  assert.match(img, /alt="Panneau de marqueterie/);
  assert.match(f, /<canvas class="hero-panel__canvas"[^>]*\bhidden\b[^>]*aria-hidden="true"|<canvas class="hero-panel__canvas"[^>]*aria-hidden="true"[^>]*\bhidden\b/);
  assert.match(f, /<button class="hero-panel__pause" type="button" aria-pressed="false" hidden>Mettre en pause l'animation<\/button>/);
});

test("the hero text is unchanged", () => {
  const html = homeHtml();
  assert.match(html, /<h1 id="hero-titre">Un nid pour les métiers du son\.<\/h1>/);
  assert.match(html, /Se former, créer : des fils tressés ensemble\./);
  assert.match(html, /Tekonest se construit pas à pas\. Rien n'est encore en vente/);
  assert.match(html, /<a class="btn btn-light" href="#entrees">Les deux entrées<\/a>/);
});

test("the old hero is gone", () => {
  const html = homeHtml();
  assert.doesNotMatch(html, /nid-stage|nid-son|nid-replay|home\.js|texture-damas|class="bande"/);
  for (const gone of ["assets/js/home.js", "assets/img/photos/texture-damas.jpg", "assets/img/photos/texture-damas.webp"]) assert.equal(existsSync(rootPath(gone)), false, gone);
});

test("the dividers follow the mapping", () => {
  const html = homeHtml();
  assert.equal((html.match(/class="rule /g) || []).length, 2, "exactly two dividers on the home page");
  assert.match(html, /<\/section>\s*<div class="rule rule-rope" role="presentation"><\/div>\s*<section class="section" aria-labelledby="entrees">/);
  assert.match(html, /<div class="rule rule-saw" role="presentation"><\/div>\s*<section class="section section--sunken" aria-labelledby="etat">/);
});

test("the closing band uses the field texture", () => {
  const img = homeHtml().match(/<img class="cta-nuit__bg"[^>]*>/);
  assert.ok(img, "no img.cta-nuit__bg");
  assert.match(img[0], /src="assets\/img\/panel\/closing-texture\.webp"/);
  assert.match(img[0], /alt=""/);
  assert.match(img[0], /width="1280"/);
  assert.match(img[0], /height="720"/);
  assert.match(img[0], /loading="lazy"/);
});

test("only the home page loads the panel script", () => {
  assert.equal((homeHtml().match(/<script src="assets\/js\/panel\.js" defer><\/script>/g) || []).length, 1);
  for (const name of pages().filter((n) => n !== "index.html")) assert.doesNotMatch(page(name), /panel\.js/, name);
  assert.ok(existsSync(rootPath("assets/js/panel.js")));
});
