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
