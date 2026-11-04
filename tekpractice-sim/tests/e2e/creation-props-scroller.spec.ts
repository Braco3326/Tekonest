/**
 * Night wave 2, item H: Propriétés is ONE calm scroller. The settings of the selection, the coverage, the listening and the cable legend follow each other and
 * the column scrolls as a whole (no block scrolls inside itself); its title row stays on top; the coverage block reads status, statistics, scale, points, and
 * folds the notes about the calculation under a closed « À propos du calcul ».
 */
import { expect, test, type Page } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })

const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 5)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  const ok = await page.evaluate(() => {
    const c = window.__creation!
    return [
      c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } }).ok,
      c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-r' }, b: { instance: 'k12-d', port: 'in-line-a' } }).ok,
      c.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }).ok,
    ]
  })
  expect(ok).toEqual([true, true, true])
}
const ecoute = (page: Page) => page.getByRole('menuitem', { name: 'Écoute', exact: true })
/** Coverage on and listening started: the two blocks and the cable legend are all in Propriétés. */
const everythingOn = async (page: Page): Promise<void> => {
  await ecoute(page).click()
  await page.getByRole('menuitemcheckbox', { name: 'Couverture' }).click()
  await page.waitForFunction(() => window.__creation!.coverage().status === 'ready' && !window.__creation!.coverage().pending, null, { timeout: 20_000 })
  await ecoute(page).click()
  await page.getByRole('menuitem', { name: 'Lecture', exact: true }).click()
  await page.waitForFunction(() => window.__creation!.audioState().state === 'playing', null, { timeout: 15_000 })
  await expect(page.getByTestId('listen-panel')).toBeVisible()
  await expect(page.getByTestId('coverage-panel')).toBeVisible()
}
const stop = async (page: Page): Promise<void> => {
  await ecoute(page).click()
  await page.getByRole('menuitem', { name: 'Stop', exact: true }).click()
}

test('H: Propriétés is the only scroller; no block inside it scrolls or caps its own height', async ({ page }) => {
  await boot(page)
  await everythingOn(page)
  const props = await page.locator('.cr-props').evaluate((e) => ({ overflowY: getComputedStyle(e).overflowY, scrolls: e.scrollHeight > e.clientHeight }))
  expect(props.overflowY).toBe('auto')
  expect(props.scrolls, 'with the coverage and the listening open the column is longer than the window').toBe(true)
  for (const sel of ['.cr-props .cr-panel-body', '.cr-cov', '.cr-listen', '.cr-legend-list']) {
    const c = await page.locator(sel).first().evaluate((e) => {
      const s = getComputedStyle(e)
      return { overflowY: s.overflowY, maxHeight: s.maxHeight }
    })
    expect(c, sel).toEqual({ overflowY: 'visible', maxHeight: 'none' })
  }
  // the settings floor of the selection is still there (Task 39), and nothing squeezes the body below its content
  await expect(page.locator('.cr-props .cr-panel-body')).toHaveCSS('min-height', '120px')
  const body = await page.locator('.cr-props .cr-panel-body').evaluate((e) => ({ scroll: e.scrollHeight, client: e.clientHeight }))
  expect(body.scroll).toBeLessThanOrEqual(body.client + 1)
  await stop(page)
})

test('H: the whole column is reachable by scrolling it, and its title row stays on top', async ({ page }) => {
  await boot(page)
  await everythingOn(page)
  const props = page.locator('.cr-props')
  const head = page.locator('.cr-props .cr-panel-head')
  await props.evaluate((e) => e.scrollTo(0, e.scrollHeight))
  const p = (await props.boundingBox())!
  const h = (await head.boundingBox())!
  expect(Math.abs(h.y - p.y), 'the title row is still at the top of the column').toBeLessThanOrEqual(1)
  const legend = (await page.getByTestId('cable-legend-toggle').boundingBox())!
  expect(legend.y + legend.height, 'the last block (the cable legend) is fully inside the column').toBeLessThanOrEqual(p.y + p.height + 1)
  // no horizontal scroll in the column
  expect(await props.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(0)
  // a control focused by keyboard is not left under the sticky row
  await props.evaluate((e) => e.scrollTo(0, 0))
  await page.getByTestId('coverage-toggle').focus()
  const f = (await page.getByTestId('coverage-toggle').boundingBox())!
  const h2 = (await head.boundingBox())!
  expect(f.y >= h2.y + h2.height - 1 || f.y + f.height <= h2.y + 1).toBe(true)
  await stop(page)
})

test('H: the coverage block reads status, unit, statistics, scale, points, then the folded notes', async ({ page }) => {
  await boot(page)
  await everythingOn(page)
  const y = async (id: string): Promise<number> => (await page.getByTestId(id).boundingBox())!.y
  const order = [await y('coverage-status'), await y('coverage-unit'), await y('coverage-stats'), await y('coverage-legend'), await y('coverage-points'), await y('coverage-about-title')]
  expect(order, 'status, unit, statistics, scale, points, notes').toEqual([...order].sort((a, b) => a - b))
  expect(new Set(order).size).toBe(order.length)
  // the notes are folded and one click away; nothing was removed
  const about = page.getByTestId('coverage-about')
  await expect(about).not.toHaveAttribute('open', '')
  await expect(page.getByTestId('coverage-about-title')).toHaveText('À propos du calcul')
  for (const id of ['coverage-method', 'coverage-speakers']) await expect(page.getByTestId(id)).toBeHidden()
  await page.getByTestId('coverage-about-title').click()
  await expect(about).toHaveAttribute('open', '')
  await expect(page.getByTestId('coverage-method')).toHaveText('somme énergétique, champ direct')
  await expect(page.getByTestId('coverage-method')).toBeVisible()
  await expect(page.getByTestId('coverage-speakers')).toContainText('k12-g')
  await expect(page.getByTestId('coverage-source')).toBeVisible()
  // the unit and the statistics are NOT folded (they are what the numbers mean)
  await page.getByTestId('coverage-about-title').click()
  await expect(page.getByTestId('coverage-unit')).toBeVisible()
  await expect(page.getByTestId('coverage-stats')).toBeVisible()
  await stop(page)
})

test('H: the notes stay folded or open as the learner left them while the coverage updates', async ({ page }) => {
  await boot(page)
  await everythingOn(page)
  await page.getByTestId('coverage-about-title').click()
  await expect(page.getByTestId('coverage-about')).toHaveAttribute('open', '')
  // a rig change recomputes the coverage and redraws the block
  await page.evaluate(() => {
    const c = window.__creation!
    const p = c.design().placements.find((x) => x.instanceId === 'k12-g')!
    c.dispatch({ type: 'SET_POSE', instanceId: 'k12-g', position: [1, 0, 0], yawDeg: p.yawDeg, tiltDeg: p.tiltDeg ?? 0, mount: p.mount ?? 'stand' })
  })
  await page.waitForFunction(() => !window.__creation!.coverage().pending, null, { timeout: 20_000 })
  await expect(page.getByTestId('coverage-about')).toHaveAttribute('open', '')
  await stop(page)
})
