import test, { before } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderAssets } from "./render-assets.mjs";

const PANEL_DIR = fileURLToPath(new URL("../assets/img/panel/", import.meta.url));
const EXPECTED = {
  "hero-poster-720.webp": [720, 720], "hero-poster-1200.webp": [1200, 1200], "og-share.webp": [1200, 630],
  "rope-tile-1x.webp": [80, 25], "rope-tile-2x.webp": [160, 50], "tri-tile-1x.webp": [76, 40], "tri-tile-2x.webp": [152, 80],
  "saw-tile-1x.webp": [32, 24], "saw-tile-2x.webp": [64, 48],
  "closing-texture.webp": [1280, 720], "sefo-field.webp": [900, 900], "footer-seal.webp": [192, 192],
};
const KB = 1024;
const BUDGET = { "hero-poster-720.webp": 120 * KB, "hero-poster-1200.webp": 180 * KB, "closing-texture.webp": 150 * KB, "sefo-field.webp": 150 * KB };
const TILE_BUDGET = 20 * KB;

/** Pixel size of a WebP file from its header (lossy VP8, extended VP8X or lossless VP8L). */
function webpSize(b) {
  assert.equal(b.toString("ascii", 0, 4), "RIFF");
  assert.equal(b.toString("ascii", 8, 12), "WEBP");
  const fmt = b.toString("ascii", 12, 16);
  if (fmt === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (fmt === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (fmt === "VP8L") { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  throw new Error(`unknown WebP chunk ${fmt}`);
}
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

let dirA, dirB, listA;
before(async () => {
  dirA = mkdtempSync(join(tmpdir(), "tekonest-assets-a-"));
  dirB = mkdtempSync(join(tmpdir(), "tekonest-assets-b-"));
  listA = await renderAssets(dirA);
  await renderAssets(dirB);
});

test("all assets are produced with the specified sizes", () => {
  assert.deepEqual(listA.map((a) => a.name).sort(), Object.keys(EXPECTED).sort());
  for (const [name, size] of Object.entries(EXPECTED)) assert.deepEqual(webpSize(readFileSync(join(dirA, name))), size, name);
});

test("budgets hold", () => {
  for (const { name, bytes } of listA) {
    const limit = name.includes("-tile-") ? TILE_BUDGET : BUDGET[name];
    if (limit) assert.ok(bytes <= limit, `${name}: ${(bytes / KB).toFixed(1)} KB, limit ${(limit / KB).toFixed(0)} KB`);
  }
});

test("rendering twice gives the same bytes", () => {
  for (const name of Object.keys(EXPECTED)) assert.equal(sha(join(dirA, name)), sha(join(dirB, name)), name);
});

test("the committed images are current", () => {
  assert.ok(existsSync(PANEL_DIR), "assets/img/panel/ is missing: run node tools/render-assets.mjs");
  assert.deepEqual(readdirSync(PANEL_DIR).filter((f) => f.endsWith(".webp")).sort(), Object.keys(EXPECTED).sort());
  for (const name of Object.keys(EXPECTED)) assert.equal(sha(join(PANEL_DIR, name)), sha(join(dirA, name)), `${name} is stale: run node tools/render-assets.mjs`);
});
