#!/usr/bin/env node
// Save one frame of a visual as a PNG, optionally cropped.
// Usage: node tools/frame.mjs <visual.html> <t> <out.png> [x y width height]
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const [file, t, out, x, y, width, height] = process.argv.slice(2);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${pathToFileURL(resolve(file)).href}?t=${t}`);
  const clip = x === undefined ? undefined : { x: +x, y: +y, width: +width, height: +height };
  await page.screenshot({ path: out, clip });
  console.log("wrote", out);
} finally {
  await browser.close();
}
