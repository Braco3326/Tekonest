#!/usr/bin/env node
// Build the Tekonest umbrella prototype: shared layout + page fragments → static HTML.
// Node port of the former src/build.py (no dependencies). Run: node tools/build.mjs
// French typography: a narrow no-break space (U+202F) is inserted before ; : ! ? and inside « »
// in text content (never inside tags).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = join(ROOT, "src", "pages");

export const NNBSP = " ";
const FOOTER_DATE = "28 octobre 2026";

export const NAV = [
  ["apprendre.html", "Se former"],
  ["creer.html", "Créer avec nous"],
  ["histoire.html", "L'histoire"],
  ["contact.html", "Contact"],
];

const LAYOUT = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<meta name="robots" content="noindex">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/css/tokens.css">
<link rel="stylesheet" href="assets/css/site.css">
<script src="assets/js/site.js"></script>
</head>
<body>
<a class="skip" href="#contenu">Aller au contenu</a>
<div class="proto-banner"><div class="wrap"><p>Prototype de site (brouillon). Rien n'est en vente et aucune donnée n'est collectée.</p></div></div>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="index.html"><img src="assets/img/lockup.svg" alt="Tekonest, accueil" width="150" height="32"></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
    <nav id="site-nav" class="site-nav" aria-label="Navigation principale">
      <ul>
{nav}
      </ul>
    </nav>
  </div>
</header>
<main id="contenu">
{content}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div>
      <img src="assets/img/lockup-reverse.svg" alt="Tekonest" width="140" height="30">
      <p>Un nid pour les métiers du son : se former, créer ensemble.</p>
    </div>
    <nav aria-label="Pied de page">
      <ul>
{footnav}
        <li><a href="accessibilite.html">Accessibilité</a></li>
      </ul>
    </nav>
    <p class="fine">Prototype de conception, {footer_date}. Tekonest n'a pas encore de structure juridique ; les services marqués « en préparation », « en développement » ou « en réflexion » ne sont pas proposés aujourd'hui. Polices : Tektur et IBM Plex Sans (licence SIL OFL 1.1), hébergées sur ce site. Motifs inspirés de la marqueterie de Damas.</p>
  </div>
</footer>
</body>
</html>
`;

function navItems(current, indent = "        ") {
  return NAV.map(([href, label]) => {
    const cur = href === current ? ' aria-current="page"' : "";
    return `${indent}<li><a href="${href}"${cur}>${label}</a></li>`;
  }).join("\n");
}

/** Insert narrow no-break spaces in text nodes only. */
export function frenchTypography(html) {
  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith("<")) return part;
      return part
        .replace(/\s+([;:!?»])/g, `${NNBSP}$1`)
        .replace(/«\s*/g, `«${NNBSP}`);
    })
    .join("");
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? values[key] : match
  );
}

/** Build every page fragment into outDir (default: website-prototype/). Returns the file names built. */
export function build({ outDir = ROOT } = {}) {
  mkdirSync(outDir, { recursive: true });
  const built = [];
  for (const name of readdirSync(PAGES).filter((f) => f.endsWith(".html")).sort()) {
    const text = readFileSync(join(PAGES, name), "utf8")
      .replace(/\r\n/g, "\n")
      .replaceAll("&#8239;", NNBSP);
    const m = text.match(/^<!--\s*title:\s*([\s\S]*?)\s*\|\s*description:\s*([\s\S]*?)\s*-->\s*/);
    if (!m) throw new Error(`${name}: missing <!-- title: … | description: … --> header`);
    const [, title, description] = m;
    const content = text.slice(m[0].length);
    const html = fill(LAYOUT, {
      title,
      description,
      nav: navItems(name),
      footnav: navItems(null),
      content,
      footer_date: FOOTER_DATE,
    });
    const [head, body] = [html.slice(0, html.indexOf("<body>")), html.slice(html.indexOf("<body>") + 6)];
    writeFileSync(join(outDir, name), `${head}<body>${frenchTypography(body)}`, "utf8");
    built.push(name);
  }
  return built;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const name of build()) console.log("built", name);
}
