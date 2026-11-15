/**
 * Mission 2, stage 1 (spec docs/superpowers/specs/2026-11-15-plan2d-schema-design.md §5): the 2D schema page in the real app, on the all-on build
 * (`npm run build:e2e`, the default server) and on the product build when E2E_PRODUCT_URL serves one (`npx vite build --outDir dist-product`).
 *  - Vue › « Schéma 2D » opens a blank plan over the 3D view; a console and a speaker are placed (a click, a drag); a cable is held from the console's
 *    rear panel, the speaker flips to its rear panel with its ports lit or dimmed, the lit input ends the cable; the general view shows the line in its
 *    type's colour and the legend; the 3D rig and its history are untouched.
 *  - The same path with the keyboard only.
 *  - Close and reopen (and a reload) keep the plan.
 *  - An exam address has no entry.
 *  - No console error anywhere.
 * Stage 2 (« Envoyer dans la scène 3D ») is not here.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'

const PRODUCT = process.env.E2E_PRODUCT_URL
const BUILDS: { name: string; base?: string; product: boolean }[] = [{ name: 'all-on build', product: false }, ...(PRODUCT ? [{ name: 'product build', base: PRODUCT, product: true }] : [])]

interface Hook {
  place(): string | null
  choosePlace(key: string): Promise<unknown>
  design(): unknown
  historySize(): number
}

function watchErrors(page: Page): () => string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return () => errors
}

/** A practice address with the blank room open: the plain address on the all-on build; on the product build `?design=1` and its profile key 2. */
async function openRoom(page: Page, product: boolean): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(product ? '/?design=1' : '/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!(window as unknown as { __creation?: unknown }).__creation)
  if (product) await page.keyboard.press('2')
  else await page.evaluate(() => (window as unknown as { __creation: Hook }).__creation.choosePlace('blank'))
  await page.waitForFunction(() => (window as unknown as { __creation: Hook }).__creation.place() === 'blank')
}

const rig = (page: Page) => page.evaluate(() => {
  const c = (window as unknown as { __creation: Hook }).__creation
  return { design: c.design(), history: c.historySize() }
})

async function openFromMenu(page: Page): Promise<Locator> {
  await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Schéma 2D' }).click()
  const dialog = page.getByTestId('plan2d')
  await expect(dialog).toBeVisible()
  return dialog
}

/** Tab (or Maj+Tab) until the focused element matches `selector` (a keyboard-only path). */
async function tabTo(page: Page, selector: string, back = false, max = 400): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector)) return
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab')
  }
  throw new Error(`never reached ${selector}`)
}

for (const build of BUILDS) {
  test.describe(build.name, () => {
    if (build.base) test.use({ baseURL: build.base })
    test.use({ viewport: { width: 1366, height: 768 } })
    test.describe.configure({ timeout: 120_000 })

    test('open blank, place a console and a speaker, hold a cable, flip to the rear panel, connect, back to the coloured line and the legend; the 3D rig is untouched', async ({ page }) => {
      const errors = watchErrors(page)
      await openRoom(page, build.product)
      const before = await rig(page)
      const dialog = await openFromMenu(page)
      await expect(dialog).toHaveAttribute('role', 'dialog')
      await expect(dialog.getByRole('heading', { name: 'Schéma 2D : Salle vide neutre' })).toBeVisible()
      await expect(dialog.locator('[data-dev]')).toHaveCount(0)
      await expect(dialog.locator('.p2d-empty-plan')).toBeVisible()
      // the console by a click (the centre of the view), the speaker by a drag onto the plan
      await dialog.getByRole('button', { name: 'Poser Midas M32 sur le plan' }).click()
      await expect(dialog.locator('[data-dev="midas-m32-1"]')).toHaveCount(1)
      const plan = dialog.getByTestId('plan2d-plan')
      const box = (await plan.boundingBox())!
      await dialog.getByRole('searchbox', { name: 'Rechercher un appareil' }).fill('k12')
      await dialog.getByRole('button', { name: 'Poser QSC K12.2 sur le plan' }).dragTo(plan, { targetPosition: { x: box.width * 0.3, y: box.height * 0.75 } })
      await expect(dialog.locator('[data-dev="qsc-k12-2-1"]')).toHaveCount(1)
      // the console: select, then a second click flips it to its rear panel; a free output starts the cable
      const m32 = dialog.locator('[data-dev="midas-m32-1"] .p2d-hit')
      await m32.click()
      await m32.click()
      const rear = dialog.getByTestId('plan2d-rear')
      await expect(rear).toBeVisible()
      await expect(rear.getByRole('heading', { name: 'Panneau arrière : M32 (midas-m32-1)' })).toBeVisible()
      await rear.locator('[data-port="out-main-l"]').click()
      await expect(rear).toBeHidden()
      await expect(dialog.getByTestId('plan2d-live')).toContainText('Câble tenu depuis M32 (midas-m32-1) · out-main-l')
      await expect(dialog.locator('[data-dev="qsc-k12-2-1"]')).toHaveClass(/p2d-lit/)
      // the speaker flips with the cable held: its input lit, its mains inlet dimmed with the reason
      await dialog.locator('[data-dev="qsc-k12-2-1"] .p2d-hit').click()
      await expect(rear).toBeVisible()
      await expect(rear.locator('[data-port="in-line-a"]')).toHaveAttribute('data-state', 'lit')
      const dim = rear.locator('[data-port="power-in"]')
      await expect(dim).toHaveAttribute('data-state', 'dim')
      await expect(dim.locator('.p2d-port-why')).not.toBeEmpty()
      await rear.locator('[data-port="in-line-a"]').click()
      // the general view: the line in the analogue blue, an arrow, a tag; the legend
      await expect(rear).toBeHidden()
      const line = dialog.locator('[data-cable="c1"] .p2d-cable-line')
      await expect(line).toHaveAttribute('stroke', '#2B7BC2')
      await expect(line).toHaveAttribute('marker-end', 'url(#p2d-arrow-analog-bal)')
      await expect(dialog.locator('[data-cable="c1"] .p2d-tag')).toHaveText('sym.')
      await expect(dialog.getByTestId('plan2d-legend')).toBeVisible()
      await expect(dialog.locator('.p2d-legend-item')).toHaveCount(9)
      await dialog.getByRole('button', { name: 'Légende et sources' }).click()
      await expect(dialog.getByTestId('plan2d-sources')).toContainText('Conventions courantes')
      // the 3D side never moved
      expect(await rig(page)).toEqual(before)
      // close and reopen: kept
      await dialog.getByRole('button', { name: 'Fermer' }).click()
      await expect(dialog).toHaveCount(0)
      await expect(page.locator('#renderCanvas')).toBeFocused()
      expect(await rig(page)).toEqual(before)
      const again = await openFromMenu(page)
      await expect(again.locator('[data-dev]')).toHaveCount(2)
      await expect(again.locator('[data-cable="c1"]')).toHaveCount(1)
      await page.keyboard.press('Escape')
      await expect(again).toHaveCount(0)
      expect(errors(), 'console errors').toEqual([])
    })

    test('the keyboard-only path: open, place two devices, hold a cable from the rear panel, connect, Échap closes; a reload keeps the plan', async ({ page }) => {
      const errors = watchErrors(page)
      await openRoom(page, build.product)
      // Vue › Schéma 2D from the keyboard
      await page.getByRole('menuitem', { name: 'Vue', exact: true }).focus()
      await page.keyboard.press('Enter')
      for (let i = 0; i < 40 && !(await page.evaluate(() => document.activeElement?.textContent?.startsWith('Schéma 2D') ?? false)); i++) await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      const dialog = page.getByTestId('plan2d')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('searchbox', { name: 'Rechercher un appareil' })).toBeFocused()
      // place the console, then the speaker (search, Tab to the item, Entrée)
      await page.keyboard.type('m32')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Enter')
      await expect(dialog.locator('[data-dev="midas-m32-1"]')).toHaveCount(1)
      await tabTo(page, '.p2d-search', true)
      await page.keyboard.press('Control+a')
      await page.keyboard.type('k12')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Enter')
      await expect(dialog.locator('[data-dev="qsc-k12-2-1"]')).toHaveCount(1)
      // move the speaker away with the arrows (one undoable step each)
      await tabTo(page, '[data-dev="qsc-k12-2-1"]')
      for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown')
      // the console's rear panel: Entrée, Tab to its main left output, Entrée holds the cable
      await tabTo(page, '[data-dev="midas-m32-1"]', true)
      await page.keyboard.press('Enter')
      await expect(dialog.getByTestId('plan2d-rear')).toBeVisible()
      await tabTo(page, '[data-port="out-main-l"]')
      await page.keyboard.press('Enter')
      await expect(dialog.getByTestId('plan2d-rear')).toBeHidden()
      await expect(page.locator('[data-dev="midas-m32-1"]')).toBeFocused()
      // the speaker: Entrée flips it with its ports lit or dimmed; Tab to the lit input, Entrée ends the cable
      await tabTo(page, '[data-dev="qsc-k12-2-1"]')
      await page.keyboard.press('Enter')
      await expect(dialog.locator('[data-port="in-line-a"]')).toHaveAttribute('data-state', 'lit')
      await tabTo(page, '[data-port="in-line-a"]')
      await page.keyboard.press('Enter')
      await expect(dialog.locator('[data-cable="c1"] .p2d-cable-line')).toHaveAttribute('stroke', '#2B7BC2')
      // Échap: the selected cable first, then the page; the focus goes back to the 3D view
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(page.locator('#renderCanvas')).toBeFocused()
      // a reload: the place comes back from the autosave (or is chosen again), the plan from its own key
      await page.reload()
      await page.waitForFunction(() => !!(window as unknown as { __creation?: unknown }).__creation)
      if (!(await page.evaluate(() => (window as unknown as { __creation: Hook }).__creation.place() === 'blank'))) {
        if (build.product && (await page.getByTestId('start-screen').count())) await page.keyboard.press('2')
        else await page.evaluate(() => (window as unknown as { __creation: Hook }).__creation.choosePlace('blank'))
        await page.waitForFunction(() => (window as unknown as { __creation: Hook }).__creation.place() === 'blank')
      }
      const kept = await openFromMenu(page)
      await expect(kept.locator('[data-dev]')).toHaveCount(2)
      await expect(kept.locator('[data-cable="c1"]')).toHaveCount(1)
      expect(await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith('audio-sim/plan2d.v1.')))).toEqual(['audio-sim/plan2d.v1.@blank'])
      expect(errors(), 'console errors').toEqual([])
    })

    test('an exam address has no « Schéma 2D » and fetches nothing of it', async ({ page }) => {
      const errors = watchErrors(page)
      const chunks: string[] = []
      page.on('request', (r) => {
        if (/\/assets\/view-[^/]*\.js/.test(r.url())) chunks.push(r.url())
      })
      await page.goto('/?mode=exam')
      await page.waitForFunction(() => !!(window as unknown as { __creation?: unknown }).__creation)
      await page.evaluate(() => (window as unknown as { __creation: Hook }).__creation.choosePlace('blank'))
      await page.waitForFunction(() => (window as unknown as { __creation: Hook }).__creation.place() === 'blank')
      await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
      await expect(page.getByRole('menuitemcheckbox', { name: /^Marcher/ })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: 'Schéma 2D' })).toHaveCount(0)
      await expect(page.getByTestId('plan2d')).toHaveCount(0)
      expect(chunks).toEqual([])
      expect(errors(), 'console errors').toEqual([])
    })
  })
}
