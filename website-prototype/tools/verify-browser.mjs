#!/usr/bin/env node
// Browser checks for the built pages: axe (WCAG 2.2 AA), horizontal overflow, mobile menu, reduced motion and
// no-JS rendering, and the theme (no picture loads, the bands are drawn by CSS, layout shift 0).
// Saves screenshots for review.
// Run (from website-prototype/): node tools/verify-browser.mjs
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { serveStatic } from "./static-server.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SHOTS = join(ROOT, "..", "design", "07-review", "screens-2026-10-29");
const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 375, height: 812 };
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
// Screenshots: 375 and 1440 for every page, 768 for the pages whose grid changed.
const SHOT_WIDTHS = [375, 768, 1440];
const WIDE_GRID_PAGES = new Set(["index", "creer", "apprendre"]);

const failures = [];
const ok = (message) => console.log(`OK    ${message}`);
const fail = (message) => { failures.push(message); console.log(`FAIL  ${message}`); };
const check = (pass, name, detail = "") => (pass ? ok(name) : fail(`${name}${detail ? ` (${detail})` : ""}`));

/** Opens the home page in a fresh context and waits for the load event. */
async function openHome(browser, BASE, { viewport = DESKTOP, init, ...options } = {}) {
  const context = await browser.newContext({ viewport, ...options });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  return { context, page };
}

async function homeChecks(BASE, browser) {
  // The home page loads no picture at all (only fonts, styles, scripts and SVG), whatever the user settings.
  for (const [label, options] of [["default", {}], ["reduced motion", { reducedMotion: "reduce" }], ["no JavaScript", { javaScriptEnabled: false }]]) {
    const context = await browser.newContext({ viewport: DESKTOP, ...options });
    const page = await context.newPage();
    const pictures = [];
    page.on("response", (r) => { const t = r.headers()["content-type"] || ""; if (t.startsWith("image/") && !t.includes("svg")) pictures.push(r.url()); });
    await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
    if (options.javaScriptEnabled !== false) {            // page.evaluate cannot run when JavaScript is off
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } });
    } else {
      for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 600);
    }
    await page.waitForTimeout(400);
    check(pictures.length === 0, `home, ${label}: no picture is loaded`, pictures.join(", "));
    check(!(await page.locator("canvas, figure.hero-panel").count()), `home, ${label}: no canvas and no hero picture in the page`);
    await context.close();
  }
  // The theme is drawn: each band has height and a mask, the wire frame and the roundel are visible.
  {
    const { context, page } = await openHome(browser, BASE);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const bands = await page.evaluate(() => [...document.querySelectorAll(".rule")].map((el) => {
      const cs = getComputedStyle(el), m = cs.maskImage || cs.webkitMaskImage || "none", mb = getComputedStyle(el, "::before").maskImage || "none";
      return { cls: el.className, height: el.getBoundingClientRect().height, masked: m !== "none" || mb !== "none" };
    }));
    check(bands.length >= 3 && bands.every((b) => b.height >= 16 && b.masked), "home: the bands are drawn by CSS (height and mask)", JSON.stringify(bands));
    check((await page.locator(".hero-nuit .cadre-filet--fil").isVisible()) && (await page.locator("footer .roundel").isVisible()), "home: the wire frame and the footer roundel are visible");
    await context.close();
  }
  // Layout shift stays at 0 (no late picture can push the page).
  {
    const init = () => { window.__cls = 0; new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); };
    const { context, page } = await openHome(browser, BASE, { init });
    await page.waitForTimeout(3000);
    const cls = await page.evaluate(() => window.__cls);
    check(cls < 0.001, "home: layout shift is 0", `CLS ${cls}`);
    await context.close();
  }
}

/** The two doors in the home hero: above the fold, equal, stacked in order, reachable by keyboard. */
async function doorChecks(BASE, browser) {
  const rects = (page) => page.evaluate(() => [...document.querySelectorAll(".door--dark")].map((d) => {
    const r = d.getBoundingClientRect(), a = d.querySelector(".door-action a").getBoundingClientRect(), n = d.querySelector(".door-name a").getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, bottom: r.bottom, nameTop: n.top, nameBottom: n.bottom, actionBottom: a.bottom };
  }));
  {
    const { context, page } = await openHome(browser, BASE, { viewport: { width: 1440, height: 900 } });
    const [a, b] = await rects(page);
    check(a.top >= 0 && a.bottom <= 900 && b.top >= 0 && b.bottom <= 900, "home, 1440×900: both doors are fully visible without scrolling", JSON.stringify([a.bottom, b.bottom]));
    await context.close();
  }
  {
    const { context, page } = await openHome(browser, BASE, { viewport: { width: 390, height: 844 } });
    const [a, b] = await rects(page);
    check(a.nameTop >= 0 && a.actionBottom <= 844 && b.top <= 2 * 844, "home, 390×844: the first door's name and action are visible, the second starts within one scroll", JSON.stringify({ actionBottom: a.actionBottom, door2Top: b.top }));
    check(b.top > a.bottom - 1 && Math.abs(a.left - b.left) < 1, "home, 390: the doors stack in order 01 then 02");
    await context.close();
  }
  for (const width of [768, 1024, 1440]) {
    const { context, page } = await openHome(browser, BASE, { viewport: { width, height: 900 } });
    const [a, b] = await rects(page);
    check(Math.abs(a.width - b.width) <= 1 && b.left > a.left && Math.abs(a.top - b.top) < 1, `home, ${width}: the two doors are side by side and differ in width by at most 1 px`, JSON.stringify([a.width, b.width]));
    await context.close();
  }
  {
    const { context, page } = await openHome(browser, BASE, { viewport: { width: 1440, height: 900 } });
    const reached = new Set(); let ringOk = true;
    for (let i = 0; i < 40 && reached.size < 2; i++) {
      await page.keyboard.press("Tab");
      const st = await page.evaluate(() => {
        const d = document.activeElement?.closest?.(".door--dark");
        if (!d) return null;
        const cs = getComputedStyle(d);
        return { index: [...document.querySelectorAll(".door--dark")].indexOf(d), width: parseFloat(cs.outlineWidth), style: cs.outlineStyle };
      });
      if (st) { reached.add(st.index); if (!(st.width >= 2 && st.style !== "none")) ringOk = false; }
    }
    check(reached.size === 2 && ringOk, "home: both doors are reachable by keyboard and the focus ring is visible", `reached ${[...reached]}, ring ${ringOk}`);
    await context.close();
  }
}

async function run(BASE, browser) {
  mkdirSync(SHOTS, { recursive: true });
  const names = readdirSync(ROOT).filter((f) => f.endsWith(".html")).map((f) => f.replace(/\.html$/, "")).sort();
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
      for (const v of violations) fail(`${name} @${viewport.width}: axe ${v.id} (${v.nodes.length} nodes) ${v.helpUrl}`);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 0) { overflows += 1; fail(`${name} @${viewport.width}: horizontal overflow ${over}px`); }
      if (!violations.length && over <= 0) ok(`${name} @${viewport.width}: axe 0, overflow 0`);
    }
    await context.close();
  }
  check(axeViolations === 0 && overflows === 0, "every page: axe 0 violations, no overflow at 320, 375, 768, 1024 and 1440 px");

  // Screenshots, from the final state (reduced motion shows the poster, which is the last frame).
  // Scroll through each page first so lazy images are in.
  for (const width of SHOT_WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : width === 768 ? 1024 : 812 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    for (const name of names) {
      if (width === 768 && !WIDE_GRID_PAGES.has(name)) continue;
      await page.goto(`${BASE}/${name}.html`, { waitUntil: "load" });
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(250);
      await page.screenshot({ path: join(SHOTS, `${name}-${width}.jpg`), type: "jpeg", quality: 70, fullPage: true });
    }
    await context.close();
  }

  await homeChecks(BASE, browser);
  await doorChecks(BASE, browser);

  // Mobile menu: toggle, Escape closes, focus returns to the button.
  {
    const context = await browser.newContext({ viewport: PHONE });
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
      const context = await browser.newContext({ viewport: PHONE, ...options });
      const page = await context.newPage();
      await page.goto(`${BASE}/${name}.html`, { waitUntil: "load" });
      if (await page.locator("h1").first().isVisible()) ok(`${name} with ${label}: h1 visible`);
      else fail(`${name} with ${label}: h1 not visible`);
      await context.close();
    }
  }
  return { axeViolations, overflows };
}

let server;
let browser;
try {
  server = await serveStatic(ROOT);
  browser = await chromium.launch();
  const { axeViolations, overflows } = await run(server.url, browser);
  console.log(failures.length
    ? `\n${failures.length} failure(s)`
    : `\n${axeViolations} violations, ${overflows} overflow, menu OK`);
  process.exitCode = failures.length ? 1 : 0;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  // Let the event loop drain (no process.exit) so every line above is flushed.
  await browser?.close();
  await server?.close();
}
