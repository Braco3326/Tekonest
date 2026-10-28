#!/usr/bin/env node
// Browser checks for the built pages: axe (WCAG 2.2 AA), horizontal overflow, mobile menu, reduced motion,
// Save-Data and no-JS rendering, and the home hero panel (LCP, layout shift, start, keyboard pause, end).
// Saves screenshots for review.
// Run (from website-prototype/): node tools/verify-browser.mjs
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { serveStatic } from "./static-server.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SHOTS = join(ROOT, "..", "design", "07-review", "screens-2026-10-28-b");
const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 375, height: 812 };
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
// Screenshots: 375 and 1440 for every page, 768 for the pages whose grid changed.
const SHOT_WIDTHS = [375, 768, 1440];
const WIDE_GRID_PAGES = new Set(["index", "creer", "apprendre"]);
const PAUSE = "Mettre en pause l'animation";
const RESUME = "Reprendre l'animation";

const failures = [];
const ok = (message) => console.log(`OK    ${message}`);
const fail = (message) => { failures.push(message); console.log(`FAIL  ${message}`); };
const check = (pass, name, detail = "") => (pass ? ok(name) : fail(`${name}${detail ? ` (${detail})` : ""}`));

/** The hero's three parts. */
const hero = (page) => ({
  poster: page.locator("figure.hero-panel img.hero-panel__poster"),
  canvas: page.locator("figure.hero-panel canvas.hero-panel__canvas"),
  button: page.locator("figure.hero-panel button.hero-panel__pause"),
});

/** Opens the home page in a fresh context and waits for the load event. */
async function openHome(browser, BASE, { viewport = DESKTOP, init, ...options } = {}) {
  const context = await browser.newContext({ viewport, ...options });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  return { context, page };
}

async function homeChecks(BASE, browser) {
  // Reduced motion: no canvas, the poster stays.
  {
    const { context, page } = await openHome(browser, BASE, { reducedMotion: "reduce" });
    await page.waitForTimeout(2000);
    const { poster, canvas } = hero(page);
    check((await poster.isVisible()) && !(await canvas.isVisible()), "home, reduced motion: the canvas stays hidden and the poster stays visible after 2 s");
    await context.close();
  }
  // No JavaScript: the markup alone shows the poster.
  {
    const { context, page } = await openHome(browser, BASE, { javaScriptEnabled: false });
    const { poster, canvas } = hero(page);
    check((await poster.isVisible()) && !(await canvas.isVisible()), "home, no JavaScript: the poster is visible and no canvas is");
    await context.close();
  }
  // Save-Data: the script declines to start.
  {
    const init = () => Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true });
    const { context, page } = await openHome(browser, BASE, { init });
    await page.waitForTimeout(2500);
    const { poster, canvas, button } = hero(page);
    check((await poster.isVisible()) && !(await canvas.isVisible()) && !(await button.isVisible()), "home, Save-Data: the canvas stays hidden");
    await context.close();
  }
  // LCP element and layout shift, measured in one load.
  {
    const init = () => {
      window.__lcp = null;
      window.__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__lcp = { tag: entry.element?.tagName ?? "", cls: String(entry.element?.className ?? "") };
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
    };
    const { context, page } = await openHome(browser, BASE, { init });
    await page.waitForTimeout(3000);
    const { lcp, cls } = await page.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls }));
    check(lcp?.tag === "IMG" && lcp.cls.includes("hero-panel__poster"), "home: the poster is the LCP element", JSON.stringify(lcp));
    check(cls < 0.001, "home: layout shift is 0", `CLS ${cls}`);
    await context.close();
  }
  // Start, keyboard pause and resume, end: one load, in that order.
  {
    const { context, page } = await openHome(browser, BASE);
    const { canvas, button } = hero(page);
    await page.waitForTimeout(2500);
    check((await canvas.isVisible()) && (await button.isVisible()), "home: the animation starts");

    await button.focus();
    await page.keyboard.press("Enter");
    const paused = [await button.getAttribute("aria-pressed"), (await button.textContent()).trim()];
    await page.keyboard.press("Enter");
    const resumed = [await button.getAttribute("aria-pressed"), (await button.textContent()).trim()];
    check(paused[0] === "true" && paused[1] === RESUME && resumed[0] === "false" && resumed[1] === PAUSE,
      "home: the pause button works by keyboard", `paused ${paused}, resumed ${resumed}`);

    // 10 s of animation plus the little time spent paused above.
    await button.waitFor({ state: "hidden", timeout: 13000 }).catch(() => {});
    check(!(await button.isVisible()) && (await canvas.isVisible()), "home: the pause button goes away when the animation ends");
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
  check(axeViolations === 0 && overflows === 0, "every page: axe 0 violations, no overflow at 320, 375, 768 and 1440 px");

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
