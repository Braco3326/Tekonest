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
