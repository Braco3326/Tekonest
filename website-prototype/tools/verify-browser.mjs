#!/usr/bin/env node
// Browser checks for the built pages: axe (WCAG 2.2 AA), horizontal overflow, mobile menu,
// reduced motion and no-JS rendering. Saves screenshots for review.
// Run (from website-prototype/): node tools/verify-browser.mjs
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SHOTS = join(ROOT, "..", "design", "07-review", "screens-2026-10-28");
const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;
const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
// Screenshots: 375 and 1440 for every page, 768 for the pages whose grid changed.
const WIDE_GRID_PAGES = new Set(["index", "creer", "histoire"]);

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webp": "image/webp", ".jpg": "image/jpeg",
  ".png": "image/png", ".json": "application/json", ".glb": "model/gltf-binary",
};

function serve() {
  const server = createServer((req, res) => {
    let path = normalize(decodeURIComponent(new URL(req.url, BASE).pathname)).replace(/^([/\\])+/, "");
    let file = join(ROOT, path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(PORT, "127.0.0.1", () => resolve(server)));
}

const failures = [];
const ok = (message) => console.log(`OK    ${message}`);
const fail = (message) => { failures.push(message); console.log(`FAIL  ${message}`); };

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const names = readdirSync(ROOT).filter((f) => f.endsWith(".html")).map((f) => f.replace(/\.html$/, "")).sort();
  const server = await serve();
  const browser = await chromium.launch();
  let axeViolations = 0;
  let overflows = 0;

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    for (const name of names) {
      await page.goto(`${BASE}/${name}.html`, { waitUntil: "load" });
      await page.waitForTimeout(400);
      const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      axeViolations += violations.length;
      if (violations.length) {
        for (const v of violations) fail(`${name} @${viewport.width}: axe ${v.id} (${v.nodes.length} nodes) ${v.helpUrl}`);
      }
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 0) { overflows += 1; fail(`${name} @${viewport.width}: horizontal overflow ${over}px`); }
      if (!violations.length && over <= 0) ok(`${name} @${viewport.width}: axe 0, overflow 0`);
      if (viewport.width !== 768 || WIDE_GRID_PAGES.has(name)) {
        await page.screenshot({ path: join(SHOTS, `${name}-${viewport.width}.jpg`), type: "jpeg", quality: 70, fullPage: true });
      }
    }
    await context.close();
  }

  // Mobile menu: toggle, Escape closes, focus returns to the button.
  {
    const context = await browser.newContext({ viewport: VIEWPORTS[0] });
    const page = await context.newPage();
    await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
    const toggle = page.locator("button.nav-toggle");
    await toggle.click();
    const opened = await toggle.getAttribute("aria-expanded");
    await page.keyboard.press("Escape");
    const closed = await toggle.getAttribute("aria-expanded");
    const focused = await page.evaluate(() => document.activeElement?.classList.contains("nav-toggle"));
    if (opened === "true" && closed === "false" && focused) ok("menu @375: opens, Escape closes, focus returns");
    else fail(`menu @375: expanded after click=${opened}, after Escape=${closed}, focus on toggle=${focused}`);
    await context.close();
  }

  // Reduced motion and no JavaScript: the h1 must still be visible.
  for (const [label, options] of [
    ["reduced motion", { reducedMotion: "reduce" }],
    ["no JavaScript", { javaScriptEnabled: false }],
  ]) {
    for (const name of ["index", "creer"]) {
      const context = await browser.newContext({ viewport: VIEWPORTS[0], ...options });
      const page = await context.newPage();
      await page.goto(`${BASE}/${name}.html`, { waitUntil: "load" });
      const visible = await page.locator("h1").first().isVisible();
      if (visible) ok(`${name} with ${label}: h1 visible`);
      else fail(`${name} with ${label}: h1 not visible`);
      await context.close();
    }
  }

  await browser.close();
  server.close();
  console.log(failures.length
    ? `\n${failures.length} failure(s)`
    : `\n${axeViolations} violations, ${overflows} overflow, menu OK`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => { console.error(error); process.exit(1); });
