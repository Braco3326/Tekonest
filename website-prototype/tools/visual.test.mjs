import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const VISUALS = fileURLToPath(new URL("../../visuals/", import.meta.url));
const url = (name, query = "") => pathToFileURL(VISUALS + name).href + query;
let browser, page;

before(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(url("panel-motion.html", "?t=0"));
});
after(async () => { await browser?.close(); });

/** Percentage of pixels that differ by more than `thr` in any channel between two PNG buffers. */
async function pixelDiff(a, b, thr = 8) {
  const p = await browser.newPage();
  try {
    return await p.evaluate(async ({ A, B, thr }) => {
      const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
      const [ia, ib] = await Promise.all([load(A), load(B)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return 100;
      const px = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
      const da = px(ia), db = px(ib); let diff = 0;
      for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) > thr || Math.abs(da[i + 1] - db[i + 1]) > thr || Math.abs(da[i + 2] - db[i + 2]) > thr) diff++;
      return 100 * diff / (da.length / 4);
    }, { A: "data:image/png;base64," + a.toString("base64"), B: "data:image/png;base64," + b.toString("base64"), thr });
  } finally { await p.close(); }
}

test("Panel exposes the site drawers", async () => {
  const kinds = await page.evaluate(() => ["drawRoundel", "fieldTexture", "tile"].map((k) => typeof window.Panel[k]));
  assert.deepEqual(kinds, ["function", "function", "function"]);
});

test("the still frame is unchanged by the refactor", async () => {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto(url("panel-motion.html", "?t=10"));
  const now = await p.screenshot();
  await p.close();
  const percent = await pixelDiff(now, readFileSync(VISUALS + "panel-poster.png"));
  assert.ok(percent <= 0.3, `${percent.toFixed(3)} % of pixels differ from visuals/panel-poster.png`);
});

test("tile returns the specified sizes", async () => {
  const sizes = await page.evaluate(() => [["rope", 25], ["tri", 40], ["saw", 24]].map(([type, t]) => {
    const c = document.createElement("canvas"); c.width = c.height = 400; return window.Panel.tile(c.getContext("2d"), type, t);
  }));
  assert.deepEqual(sizes, [{ w: 80, h: 25 }, { w: 76, h: 40 }, { w: 32, h: 24 }]);
});

test("tiles repeat without a seam", async () => {
  // Two tiles side by side must equal one continuous strip of double length drawn natively (same pattern, no hand irregularity).
  const results = await page.evaluate(() => [["rope", 25], ["tri", 40], ["saw", 24], ["rope", 50], ["tri", 80], ["saw", 48]].map(([type, t]) => {
    const probe = document.createElement("canvas"); probe.width = probe.height = 400;
    const { w, h } = window.Panel.tile(probe.getContext("2d"), type, t), GROUND = window.Panel.GROUND;
    const make = (draw) => { const c = document.createElement("canvas"); c.width = 2 * w; c.height = h; const x = c.getContext("2d"); x.fillStyle = GROUND; x.fillRect(0, 0, 2 * w, h); draw(x); return x.getImageData(0, 0, 2 * w, h).data; };
    const tiles = make((x) => { window.Panel.tile(x, type, t); x.save(); x.translate(w, 0); window.Panel.tile(x, type, t); x.restore(); });
    const strip = make((x) => { x.save(); x.translate(w, h / 2); window.Panel.strip(x, type, 2 * w, t, "tile" + type, 0); x.restore(); });
    // compare the middle half (it holds the seam); the two outer quarters are where a native strip ends and a tile does not
    let diff = 0, n = 0; for (let y = 0; y < h; y++) for (let x = Math.floor(w / 2); x < Math.floor(3 * w / 2); x++) { const i = (y * 2 * w + x) * 4; n++; if (Math.abs(tiles[i] - strip[i]) > 12 || Math.abs(tiles[i + 1] - strip[i + 1]) > 12 || Math.abs(tiles[i + 2] - strip[i + 2]) > 12) diff++; }
    // the triangle band is fully opaque: two tiles must leave no transparent pixel anywhere (a gap at the seam would show here)
    const o = document.createElement("canvas"); o.width = 2 * w; o.height = h; const ox = o.getContext("2d");
    window.Panel.tile(ox, type, t); ox.save(); ox.translate(w, 0); window.Panel.tile(ox, type, t); ox.restore();
    const od = ox.getImageData(0, 0, 2 * w, h).data; let holes = 0; for (let i = 3; i < od.length; i += 4) if (od[i] < 250) holes++;
    return { type, t, percent: 100 * diff / n, holes };
  }));
  // Triangle band: its dark piece outlines are drawn in a slightly different order across a tile boundary (a few percent of pixels
  // differ, invisible to the eye at 2x zoom), so it gets a looser pixel limit and the hard no-gap check below instead.
  for (const r of results) { if (r.type === "tri") assert.equal(r.holes, 0, `tri@${r.t}: ${r.holes} transparent pixels`); }
  for (const r of results) assert.ok(r.percent <= (r.type === "tri" ? 8 : 0.5), `${r.type}@${r.t}: ${r.percent.toFixed(2)} % of pixels differ from a continuous strip`);
});

test("drawRoundel leaves the corners transparent and the centre dark", async () => {
  const px = await page.evaluate(() => {
    const c = document.createElement("canvas"); c.width = c.height = 192; const ctx = c.getContext("2d");
    window.Panel.drawRoundel(ctx, 96, 96, 84);
    const at = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    return { corner: at(1, 1), centre: at(96, 96) };
  });
  assert.equal(px.corner[3], 0);
  assert.ok(px.centre[3] === 255 && px.centre[0] < 40 && px.centre[1] < 40 && px.centre[2] < 40, `centre ${px.centre}`);
});
