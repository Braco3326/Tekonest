/**
 * The shipped product, end to end (founder, 2026-11-15: « remove Oscar for the moment », « remove the educative TekPractice for the moment »).
 *
 * It runs against a build made WITHOUT the all-on table: `npx vite build --outDir dist-product` (no TP_TEST_FEATURES), served on its own port, whose address is given in
 * E2E_PRODUCT_URL; the specs below skip without it (the normal specs run against `npm run build:e2e`, where the assistant and the learning pages are on).
 *  - On every address, Mode Création opens and there is no assistant icon, no assistant node, no level, exam, sandbox, dashboard or 2D board: `?level=…`, `?legacy=1`,
 *    an exam address, the sandbox and `?oscar=legacy` included.
 *  - Under `?design`, the start screen and the four profile buttons stay, the profile choice is final (no tutorial offer), Aide has no « Premiers pas », and the
 *    checklist « Pourquoi je n’entends rien ? » and the power helper stay.
 *  - The drawer still holds the whole catalogue (113 devices outside the Bêta tab) and the page logs no error.
 */
import { expect, test, type Page } from '@playwright/test'

const PRODUCT = process.env.E2E_PRODUCT_URL
test.skip(!PRODUCT, 'needs E2E_PRODUCT_URL: a preview of a build made without TP_TEST_FEATURES (npx vite build --outDir dist-product)')
test.use({ baseURL: PRODUCT, viewport: { width: 1366, height: 768 } })
test.describe.configure({ timeout: 90_000 })

const ADDRESSES = [
  '',
  '?design=1', '?design=2', '?design=3', '?design=4', '?design=5',
  '?level=a1', '?level=a1&oscar=legacy', '?level=b1&mode=exam', '?level=sandbox', '?level=a1&render=2d', '?legacy=1', '?mode=exam',
]
const assistantNodes = (page: Page): Promise<number> => page.locator('.oscar-icon, [data-oscar-root], .oscar-guide, .oscar-live, .oscar-bubble').count()

async function noErrors(page: Page): Promise<() => string[]> {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  return () => errors
}

for (const q of ADDRESSES) {
  test(`${q || 'the plain address'}: Mode Création, no assistant, no learning pages, no error`, async ({ page }) => {
    const errors = await noErrors(page)
    await page.goto('/' + q)
    await page.waitForFunction(() => !!(window as unknown as { __creation?: unknown }).__creation)
    await expect(page).toHaveTitle(/Mode Création/)
    // the assistant would have started by now (its entry is fetched right after the route has booted)
    await page.waitForTimeout(2500)
    expect(await assistantNodes(page), 'an assistant node is in the page').toBe(0)
    await expect(page.getByRole('button', { name: 'Oscar, assistant IA' })).toHaveCount(0)
    // the learning pages' own hook (src/legacyMain.ts) is not there: nothing of level play, exam, sandbox, dashboard or the 2D board was started
    expect(await page.evaluate(() => '__audioSim' in window), 'the learning pages started').toBe(false)
    await expect(page.locator('.hud-exam')).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Matériel', exact: true })).toBeVisible()
    // « Oscar » is nowhere in what a visitor reads: visible text, accessible names, titles, image text
    const names = await page.evaluate(() => ({
      text: document.body.innerText,
      attrs: [...document.querySelectorAll('[aria-label],[title],[alt]')].map((e) => `${e.getAttribute('aria-label') ?? ''} ${e.getAttribute('title') ?? ''} ${e.getAttribute('alt') ?? ''}`).join(' '),
      title: document.title,
    }))
    expect(names.text + names.attrs + names.title, 'the name of the assistant is in the page').not.toMatch(/Oscar/)
    expect(errors(), 'console errors').toEqual([])
  })
}

test('under ?design the start screen and the profiles stay, the choice is final, and nothing offers a tutorial', async ({ page }) => {
  await page.goto('/?design=1')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!(window as unknown as { __creation?: unknown }).__creation)
  const start = page.getByTestId('start-screen')
  for (const name of ['Je découvre', 'J’étudie le son', 'Je monte un projet', 'Je travaille dans le son']) await expect(start.getByRole('button', { name, exact: true })).toBeVisible()
  await page.keyboard.press('2')
  // no offer stage: the room opens at once
  await page.waitForFunction(() => (window as unknown as { __creation: { place: () => string } }).__creation.place() === 'blank')
  await expect(page.getByText('Un tutoriel pour votre premier son ?')).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Aide', exact: true }).click()
  const items = (await page.getByRole('menu').getByRole('menuitem').allInnerTexts()).map((n) => n.replace(/\s+/g, ' ').trim())
  await page.keyboard.press('Escape')
  expect(items).not.toContain('Premiers pas')
  expect(await page.evaluate(() => (window as unknown as { __creation: { onboarding: () => { tutorialAllowed: boolean } } }).__creation.onboarding().tutorialAllowed)).toBe(false)
  await expect(page.getByTestId('checklist-chip')).toBeVisible() // the profile chip stays
})

test('« Pourquoi je n’entends rien ? » stays and the drawer still holds the 113 devices of the catalogue', async ({ page }) => {
  await page.goto('/?design=1&cb=product')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!(window as unknown as { __creation?: unknown }).__creation)
  await page.keyboard.press('2') // the first visit's start screen: profile « J’étudie le son », final (no offer)
  await page.waitForFunction(() => (window as unknown as { __creation: { place: () => string } }).__creation.place() === 'blank')
  await expect(page.getByRole('button', { name: 'Pourquoi je n’entends rien ?' }).first()).toBeVisible()
  await page.getByRole('menuitem', { name: 'Matériel', exact: true }).click()
  await page.getByRole('menuitem', { name: /Inventaire/ }).click()
  const counts = await page.evaluate(async () => {
    const tabs = [...document.querySelectorAll<HTMLElement>('[role=tab], .cr-inv-tab, .cr-inv-tabs button')]
    const per: Record<string, number> = {}
    for (const t of tabs) {
      t.click()
      await new Promise((r) => setTimeout(r, 250))
      per[(t.textContent ?? '').trim()] = document.querySelectorAll('.cr-inv-list > *').length
    }
    return per
  })
  const verified = Object.entries(counts).filter(([name]) => name !== 'Bêta').reduce((n, [, c]) => n + c, 0)
  expect(Object.keys(counts).length).toBe(11)
  expect(verified).toBe(113)
})
