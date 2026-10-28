#!/usr/bin/env node
// Contact sheet of a visual at chosen times, for review without an encoder.
// Usage: node tools/contact-sheet.mjs <visual.html> <out.png> <t1,t2,...> [cellWidth=640] [columns=3]
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const [file, out, list, cellWidth = "640", columns = "3"] = process.argv.slice(2);
const times = list.split(",").map(Number);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(pathToFileURL(resolve(file)).href + "?t=0");
  const dataUrl = await page.evaluate(({ ts, cw, columns }) => {
    const cols = Math.min(columns, ts.length), rows = Math.ceil(ts.length / cols), ch = Math.round(cw * 9 / 16);
    const sheet = document.createElement("canvas"); sheet.width = cols * cw; sheet.height = rows * ch;
    const sctx = sheet.getContext("2d"), src = document.getElementById("c");
    ts.forEach((t, i) => {
      window.drawFrame(t);
      sctx.drawImage(src, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch);
      sctx.fillStyle = "#8c8186"; sctx.font = "16px system-ui";
      sctx.fillText("t = " + t.toFixed(2) + " s", (i % cols) * cw + 10, Math.floor(i / cols) * ch + 22);
    });
    return sheet.toDataURL("image/png");
  }, { ts: times, cw: Number(cellWidth), columns: Number(columns) });
  writeFileSync(out, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("wrote", out);
} finally {
  await browser.close();
}
