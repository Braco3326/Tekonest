#!/usr/bin/env node
// Render the site's static images (posters, dividers, textures, seal) from the same code that draws the animation.
// Usage: node tools/render-assets.mjs [outDir]   (default: assets/img/panel/)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = pathToFileURL(resolve(HERE, "..", "..", "visuals", "assets.html")).href;
const DEFAULT_OUT = resolve(HERE, "..", "assets", "img", "panel");

/** Render every asset into outDir. Returns [{ name, bytes }]. */
export async function renderAssets(outDir = DEFAULT_OUT) {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(SOURCE);
    const assets = await page.evaluate(() => window.ASSETS.map((a) => a.name));
    const written = [];
    for (const name of assets) {
      const url = await page.evaluate((n) => window.renderAsset(n), name);
      if (!url.startsWith("data:image/webp;base64,")) throw new Error(`${name}: the browser did not produce a WebP (${url.slice(0, 30)})`);
      const bytes = Buffer.from(url.split(",")[1], "base64");
      writeFileSync(join(outDir, name), bytes);
      written.push({ name, bytes: bytes.length });
    }
    if (errors.length) throw new Error(`page errors while rendering: ${errors.join("; ")}`);
    return written;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_OUT;
  for (const { name, bytes } of await renderAssets(out)) console.log(`${name.padEnd(24)} ${(bytes / 1024).toFixed(1)} KB`);
}
