#!/usr/bin/env node
// Compare two PNG files pixel by pixel in a browser canvas. Usage: node tools/imgdiff.mjs <a.png> <b.png> [threshold=8]
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const [a, b, thr = "8"] = process.argv.slice(2);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const data = (f) => "data:image/png;base64," + readFileSync(f).toString("base64");
  const res = await page.evaluate(async ({ A, B, thr }) => {
    const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const [ia, ib] = await Promise.all([load(A), load(B)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { size: [ia.width, ia.height, ib.width, ib.height] };
    const px = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const da = px(ia), db = px(ib); let diff = 0, n = da.length / 4;
    for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) > thr || Math.abs(da[i + 1] - db[i + 1]) > thr || Math.abs(da[i + 2] - db[i + 2]) > thr) diff++;
    return { pixels: n, different: diff, percent: +(100 * diff / n).toFixed(4) };
  }, { A: data(a), B: data(b), thr: Number(thr) });
  console.log(JSON.stringify(res));
} finally {
  await browser.close();
}
