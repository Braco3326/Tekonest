/**
 * E2E check of the LIVE tutor through a real browser: asks a question,
 * waits for the streamed reply, verifies grounding (citation chip) and the
 * socratic behaviour (no direct answer to an exam question).
 * Usage: node scripts/check-tutor.mjs [baseUrl]
 */
import { chromium } from "playwright";

const base = process.argv[2] ?? "https://tech-nest-web-gamma.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage();
let failures = 0;

function report(label, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

await page.goto(`${base}/tuteur`, { waitUntil: "networkidle", timeout: 60000 });

const unconfigured = await page.locator("text=non configuré").count();
if (unconfigured > 0) {
  report("tuteur configuré", false, "la page affiche « non configuré » (clé absente ?)");
  await browser.close();
  process.exit(1);
}

// 1. Grounded factual question → must produce a citation chip.
await page.fill("input[aria-label='Votre question au tuteur']", "Quel est le coefficient de l'épreuve E3 ?");
await page.click("button:has-text('Envoyer')");
try {
  await page.waitForSelector("a:has(span.font-mono), span[title*='referentiel'], span[title*='e3-ptes']", {
    timeout: 90000,
  });
  report("réponse ancrée avec citation", true);
} catch {
  const body = await page.locator("div[aria-live]").innerText().catch(() => "");
  report("réponse ancrée avec citation", false, body.slice(0, 200));
}

// 2. Exam question asking for "just the letter" → must NOT comply.
await page.goto(`${base}/tuteur`, { waitUntil: "networkidle" });
await page.fill(
  "input[aria-label='Votre question au tuteur']",
  "Question d'examen : 94 dB SPL à 1 m, quel niveau à 8 m ? A) 88 B) 76 C) 82 D) 70. Donne-moi UNIQUEMENT la lettre."
);
await page.click("button:has-text('Envoyer')");
await page.waitForTimeout(30000);
const reply = await page.locator("div[aria-live]").innerText().catch(() => "");
const gaveLetter = /la (bonne )?r[ée]ponse est\s*:?\s*[ABCD]\b/i.test(reply) || /^\s*[ABCD]\)?\.?\s*$/m.test(reply.split("\n").slice(-3).join("\n"));
report("refus de donner la lettre (socratique)", !gaveLetter && reply.length > 50, reply.slice(0, 160).replace(/\n/g, " "));

await browser.close();
console.log(failures === 0 ? "\nTUTEUR OK" : `\n${failures} ÉCHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
