#!/usr/bin/env node
// Gate for a deterministic visual (page exposing window.drawFrame(t) and window.VISUAL = { duration }):
// frames must be identical whatever order they are drawn in, the last second must hold still, and a frame must stay light.
// Usage: node tools/check-visual.mjs <visual.html> [maxMsPerFrame=60]
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const [file, maxMs = "60"] = process.argv.slice(2);
const browser = await chromium.launch();
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("pageerror", (e) => { console.log("PAGE ERROR:", e.message); failed = true; });
  await page.goto(`${pathToFileURL(resolve(file)).href}?t=0`);
  const r = await page.evaluate(() => {
    const D = window.VISUAL.duration, cv = document.getElementById("c"), ctx = cv.getContext("2d");
    const hash = () => { const d = ctx.getImageData(0, 0, cv.width, cv.height).data; let h = 2166136261; for (let i = 0; i < d.length; i += 17) { h ^= d[i]; h = Math.imul(h, 16777619); } return h >>> 0; };
    const ts = [0.5, D * 0.2, D * 0.4, D * 0.6, D * 0.8, D];
    const forward = ts.map((t) => { window.drawFrame(t); return hash(); });
    const backward = ts.slice().reverse().map((t) => { window.drawFrame(t); return hash(); }).reverse();
    window.drawFrame(D - 1); const a = hash(); window.drawFrame(D); const b = hash();
    let worst = 0; for (let t = 0; t <= D; t += 0.5) { const t0 = performance.now(); window.drawFrame(t); worst = Math.max(worst, performance.now() - t0); }
    return { order: JSON.stringify(forward) === JSON.stringify(backward), hold: a === b, worstMs: +worst.toFixed(1), duration: D };
  });
  const lines = [
    [r.order, "same frame whatever the drawing order"],
    [r.hold, `last second holds still (t=${r.duration - 1} equals t=${r.duration})`],
    [r.worstMs <= Number(maxMs), `worst offline frame ${r.worstMs} ms (limit ${maxMs} ms)`],
  ];
  for (const [ok, text] of lines) { console.log(`${ok ? "OK  " : "FAIL"} ${text}`); if (!ok) failed = true; }
} finally {
  await browser.close();
}
process.exitCode = failed ? 1 : 0;
