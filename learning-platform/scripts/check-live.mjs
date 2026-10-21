/** Quick live check through a real browser (passes Vercel's bot checkpoint). */
import { chromium } from "playwright";

const base = process.argv[2] ?? "https://tech-nest-web-gamma.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
const title = await page.title();
console.log("title:", title);

const faintColor = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue("--tn-ink-faint").trim()
);
console.log("--tn-ink-faint:", faintColor);

await page.goto(`${base}/tuteur?unite=acoustique`, { waitUntil: "networkidle", timeout: 60000 });
const chip = await page.locator("text=contexte :").count();
console.log("context chip present:", chip > 0);

await browser.close();
