/**
 * Visual QA — captures full-page screenshots of key pages (desktop + mobile).
 * Usage: node scripts/screenshots.mjs [baseUrl] [outDir]
 * Defaults: http://localhost:3000 → ./screenshots (gitignored)
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const outDir = process.argv[3] ?? "./screenshots";
mkdirSync(outDir, { recursive: true });

const pages = [
  ["landing", "/"],
  ["cours", "/cours"],
  ["cours-e3", "/cours/e3-ptes"],
  ["lecon-acoustique", "/cours/e3-ptes/unite/acoustique"],
  ["tuteur", "/tuteur"],
  ["annales", "/annales"],
  ["a-propos", "/a-propos"],
  ["inscription", "/inscription"],
];

const viewports = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
];

const browser = await chromium.launch();
for (const [vpName, viewport] of viewports) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  for (const [name, path] of pages) {
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const file = `${outDir}/${name}-${vpName}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(`✓ ${file}`);
  }
  await context.close();
}
await browser.close();
