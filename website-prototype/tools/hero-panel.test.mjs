// Browser tests for the home hero bootstrap (visuals/hero-panel.js): what it does when things go wrong or the page is not in front.
// Each test opens the home page in real Chromium (Playwright, already a dev dependency).
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { serveStatic } from "./static-server.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
let server, browser;
before(async () => {
  server = await serveStatic(ROOT);
  browser = await chromium.launch({ args: ["--js-flags=--expose-gc"] });
});
after(async () => { await browser?.close(); await server?.close(); });

async function open(init, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${server.url}/index.html`, { waitUntil: "load" });
  const hero = {
    poster: page.locator("figure.hero-panel img.hero-panel__poster"),
    canvas: page.locator("figure.hero-panel canvas.hero-panel__canvas"),
    button: page.locator("figure.hero-panel button.hero-panel__pause"),
  };
  return { context, page, hero, errors };
}

test("a failure while drawing hands the figure back to the poster", { timeout: 30000 }, async () => {
  // After a few frames every render call throws, as an out-of-memory canvas would.
  const init = () => document.addEventListener("DOMContentLoaded", () => {
    const render = window.Panel.render; let n = 0;
    window.Panel.render = function () { if (++n > 6) throw new Error("boom"); return render.apply(this, arguments); };
  });
  const { context, page, hero } = await open(init);
  await page.waitForTimeout(4000);
  assert.equal(await hero.canvas.isVisible(), false, "the half-drawn canvas is still on screen");
  assert.equal(await hero.button.isVisible(), false, "the pause button is still on screen");
  assert.equal(await hero.poster.isVisible(), true, "the poster is not visible");
  await context.close();
});

test("a page opened in a background tab plays when it comes to the front", { timeout: 30000 }, async () => {
  const init = () => {
    let hidden = true;
    Object.defineProperty(document, "hidden", { get: () => hidden, configurable: true });
    Object.defineProperty(document, "visibilityState", { get: () => (hidden ? "hidden" : "visible"), configurable: true });
    window.__show = () => { hidden = false; document.dispatchEvent(new Event("visibilitychange")); };
  };
  const { context, page, hero } = await open(init);
  await page.waitForTimeout(2500);
  assert.equal(await hero.canvas.isVisible(), false, "it started while hidden");
  await page.evaluate(() => window.__show());
  await hero.canvas.waitFor({ state: "visible", timeout: 4000 });
  assert.equal(await hero.button.isVisible(), true);
  await context.close();
});

test("keyboard focus stays in the hero when the pause button goes away at the end", { timeout: 40000 }, async () => {
  const { context, page, hero } = await open();
  await hero.canvas.waitFor({ state: "visible", timeout: 5000 });
  await hero.button.focus();
  await hero.button.waitFor({ state: "hidden", timeout: 16000 });
  const active = await page.evaluate(() => (document.activeElement === document.body ? "BODY" : document.activeElement.tagName + "." + document.activeElement.className));
  assert.notEqual(active, "BODY", "focus fell back to the page body");
  assert.match(active, /FIGURE/, `focus moved to ${active}, not to the hero figure`);
  await context.close();
});

test("the canvases are freed: finished layers drop their live bake and the finished panel releases its model", { timeout: 40000 }, async () => {
  const init = () => {
    window.__cv = [];
    const make = document.createElement.bind(document);
    document.createElement = (tag, o) => { const el = make(tag, o); if (String(tag).toLowerCase() === "canvas") window.__cv.push(new WeakRef(el)); return el; };
    window.__alive = async () => { for (let i = 0; i < 4; i++) { gc(); await new Promise((r) => setTimeout(r, 40)); } return window.__cv.filter((r) => r.deref()).length; };
  };
  const { context, page, hero } = await open(init);
  await hero.canvas.waitFor({ state: "visible", timeout: 5000 });
  await page.waitForTimeout(7000);                       // about 7 s into the animation, most layers done
  const mid = await page.evaluate(() => window.__alive());
  await hero.button.waitFor({ state: "hidden", timeout: 12000 });
  const end = await page.evaluate(() => window.__alive());
  console.log(`# live canvases created by the hero: mid-animation ${mid}, after the end ${end}`);
  assert.ok(mid <= 22, `${mid} canvases alive mid-animation (14 layer caches, the mask and the sheen are expected, plus the layers in progress)`);
  assert.ok(end <= 3, `${end} canvases still alive after the animation ended`);
  await context.close();
});

test("a resize after the animation ended redraws the finished panel at the new size", { timeout: 40000 }, async () => {
  const { context, page, hero } = await open();
  await hero.canvas.waitFor({ state: "visible", timeout: 5000 });
  await hero.button.waitFor({ state: "hidden", timeout: 16000 });
  await page.setViewportSize({ width: 700, height: 900 });
  await page.waitForTimeout(800);
  const { w, lit } = await page.evaluate(() => {
    const cv = document.querySelector("canvas.hero-panel__canvas"), d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let lit = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] > 60) lit++;       // pearl and gold, not the near-black ground
    return { w: cv.width, lit };
  });
  assert.ok(w > 0 && lit > 200, `canvas ${w}px wide with ${lit} lit samples: the redraw is blank`);
  await context.close();
});
