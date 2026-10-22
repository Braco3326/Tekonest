/**
 * qa-web crawl (standalone, 2026-10-22) — evidence for docs/verify/2026-10-22-web-tekpractice/.
 * Pages × viewports: screenshot, console errors, page errors, unnamed buttons, dialog Esc + Tab trap.
 */
import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs'

// Evidence crawl, not a gate: opt-in with QA_CRAWL=1 (npx playwright test zz-qa-crawl).
test.skip(!process.env.QA_CRAWL, 'qa-web evidence crawl — set QA_CRAWL=1 to run')

const OUT = 'docs/verify/2026-10-22-web-tekpractice'
mkdirSync(`${OUT}/screens`, { recursive: true })

const PAGES = [
  { id: 'dashboard', path: '/' },
  { id: 'a1-orbit', path: '/?level=a1' },
  { id: 'a1-explore', path: '/?level=a1&view=explore' },
  { id: 'exam', path: '/?level=a1&mode=exam' },
  { id: 'sandbox', path: '/?level=sandbox' },
  { id: 'room-concert-hall', path: '/?level=sandbox&room=concert-hall-medium' },
  { id: 'room-radio', path: '/?level=sandbox&room=radio-studio-self-op-small' },
  { id: 'board-2d', path: '/?level=a1&render=2d' },
]
const VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'phone', width: 390, height: 844 },
]

for (const vp of VIEWPORTS) {
  for (const p of PAGES) {
    test(`crawl ${p.id} @${vp.id}`, async ({ page }) => {
      const findings: { page: string; viewport: string; kind: string; detail: string }[] = []
      page.on('pageerror', (e) => findings.push({ page: p.id, viewport: vp.id, kind: 'pageerror', detail: e.message }))
      page.on('console', (m) => {
        if (m.type() === 'error') findings.push({ page: p.id, viewport: vp.id, kind: 'console-error', detail: m.text() })
      })
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto(p.path)
      await page.waitForTimeout(1500)
      await page.screenshot({ path: `${OUT}/screens/${p.id}-${vp.id}.png` })
      const unnamed = await page.evaluate(() =>
        [...document.querySelectorAll('button, a[href]')]
          .filter((b) => (b as HTMLElement).offsetParent !== null)
          .filter((b) => !(b.textContent?.trim() || b.getAttribute('aria-label') || b.getAttribute('title')))
          .map((b) => b.outerHTML.slice(0, 80)),
      )
      for (const u of unnamed) findings.push({ page: p.id, viewport: vp.id, kind: 'unnamed-control', detail: u })
      // Toolbar overflow on small screens
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      if (overflow) findings.push({ page: p.id, viewport: vp.id, kind: 'horizontal-overflow', detail: 'page wider than viewport' })

      if (await page.locator('#explore-toolbar').count()) {
        for (const panel of ['inventory', 'help', 'settings']) {
          const btn = page.locator(`#explore-toolbar [data-act="${panel}"]`)
          if (!(await btn.count())) continue // e.g. no inventory in the exam (by design)
          await btn.click()
          const dlg = page.locator(`.ex-panel[data-panel="${panel}"]`)
          await expect(dlg).toBeVisible()
          await page.screenshot({ path: `${OUT}/screens/${p.id}-${vp.id}-${panel}.png` })
          const box = await dlg.boundingBox()
          if (box && (box.x < 0 || box.y < 0 || box.x + box.width > vp.width + 1 || box.y + box.height > vp.height + 1))
            findings.push({ page: p.id, viewport: vp.id, kind: 'dialog-offscreen', detail: `${panel} ${JSON.stringify(box)}` })
          // Tab 12× (more than any dialog's focusables before wrapping) must stay inside the dialog
          for (let i = 0; i < 12; i++) await page.keyboard.press('Tab')
          const inside = await page.evaluate((id) => !!document.activeElement?.closest(`.ex-panel[data-panel="${id}"]`), panel)
          if (!inside) findings.push({ page: p.id, viewport: vp.id, kind: 'focus-escapes-dialog', detail: panel })
          await page.keyboard.press('Escape')
          if ((await dlg.count()) > 0) findings.push({ page: p.id, viewport: vp.id, kind: 'esc-does-not-close', detail: panel })
        }
      }
      appendFileSync(`${OUT}/findings.jsonl`, findings.map((f) => JSON.stringify(f)).join('\n') + (findings.length ? '\n' : ''))
    })
  }
}

test.afterAll(() => {
  writeFileSync(
    `${OUT}/manifest.json`,
    JSON.stringify({ base_url: 'http://localhost:4173 (vite preview of the production build)', driver: 'playwright chromium headless', pages: PAGES.length, viewports: VIEWPORTS }, null, 1),
  )
})
