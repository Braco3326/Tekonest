import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const boot = async (page: Page): Promise<void> => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation) // the shell boots from a lazy chunk, after `load`
  await expect(page.getByTestId('place-picker')).toBeVisible()
}
const places = (page: Page) => page.getByTestId('place-grid').getByRole('option')

test('« Choisir un lieu »: 36 place cards and the « Concert simple (référence) » template card', async ({ page }) => {
  await boot(page)
  await expect(page.getByRole('heading', { name: 'Choisir un lieu' })).toBeVisible()
  await expect(places(page)).toHaveCount(36)
  const templates = page.getByTestId('template-grid').getByRole('option')
  await expect(templates).toHaveCount(1)
  await expect(templates.first()).toContainText('Concert simple (référence)')
  // each card: a thumbnail (decorative, lazy), a name, « L × l × h m », a type
  // the accessible name starts with the place name, then size, type (and badge)
  await expect(page.getByRole('option', { name: /^Salle vide neutre 24 × 14 m Salle neutre$/ })).toHaveCount(1)
  await expect(page.getByRole('option', { name: /^Studio radio de débat \+ régie \(moyen\) 10 × 6 × 3 m Radio \/ TV Avec le matériel$/ })).toHaveCount(1)
  const hall = page.locator('[data-place="room:concert-hall-medium"]')
  await expect(hall).toContainText('32 × 18,1 × 9 m')
  await expect(hall).toContainText('Concert / live')
  const img = hall.locator('img')
  await expect(img).toHaveAttribute('alt', '')
  await expect(img).toHaveAttribute('loading', 'lazy')
  // the L2 badge is on exactly 5 cards
  await expect(page.getByTestId('place-grid').locator('.cr-card-badge')).toHaveCount(5)
  await expect(page.locator('[data-place="room:radio-talk-studio-medium"] .cr-card-badge')).toHaveText('Avec le matériel')
})

test('arrows only move the highlight (CA-13); Enter commits the highlighted card', async ({ page }) => {
  await boot(page)
  const first = places(page).first()
  await first.focus()
  await expect(first).toHaveAttribute('aria-selected', 'true')
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  expect(await page.evaluate(() => window.__creation!.place())).toBeNull()
  const hi = page.getByTestId('place-grid').locator('[aria-selected="true"]')
  await expect(hi).toHaveCount(1)
  await expect(hi).toBeFocused()
  const key = (await hi.getAttribute('data-place'))!
  expect(key).not.toBe(await first.getAttribute('data-place'))
  await page.keyboard.press('Enter')
  // a card with the L2 badge asks first: Enter again keeps « Salle vide »
  if (await page.getByTestId('place-mode-dialog').isVisible()) await page.keyboard.press('Enter')
  await page.waitForFunction((k) => window.__creation!.place() === k, key)
  await expect(page.getByTestId('place-picker')).toBeHidden()
  await expect(page.locator('#renderCanvas')).toBeFocused()
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(0)
})

test('« Avec le matériel du modèle » on the radio talk studio: 9 devices, and a note lists the 5 missing ones', async ({ page }) => {
  await boot(page)
  await page.locator('[data-place="room:radio-talk-studio-medium"]').click()
  const dialog = page.getByTestId('place-mode-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('radio', { name: 'Salle vide' })).toBeChecked()
  await expect(dialog.getByRole('radio', { name: 'Salle vide' })).toBeFocused()
  await dialog.getByRole('radio', { name: 'Avec le matériel du modèle' }).check()
  await dialog.getByRole('button', { name: 'Ouvrir' }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:radio-talk-studio-medium')
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(9)
  const note = page.getByTestId('note-unavailable')
  await expect(note).toBeVisible()
  await expect(note).toContainText('Matériel non disponible dans le jeu')
  await expect(note.getByRole('listitem')).toHaveCount(5)
  await expect(note.getByRole('listitem').first()).toHaveText('behringer-ha400')
  // announced, not only shown
  await expect(page.locator('.cr-status-msg')).toContainText('9 appareils installés. Matériel non disponible dans le jeu : behringer-ha400')
  // the first place of the session is not undoable into « no place »
  expect(await page.evaluate(() => window.__creation!.historySize())).toBe(0)
  await note.getByRole('button', { name: 'Fermer la note' }).click()
  await expect(note).toHaveCount(0)
})

test('the badge dialog: Esc cancels back to the card, nothing changes', async ({ page }) => {
  await boot(page)
  const card = page.locator('[data-place="room:radio-talk-studio-medium"]')
  await card.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('place-mode-dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('place-mode-dialog')).toBeHidden()
  await expect(card).toBeFocused()
  expect(await page.evaluate(() => window.__creation!.place())).toBeNull()
})

test('« Concert simple (référence) » loads 4 devices in concert-hall-medium; « G » is on screen-left (P14, ADR-0011)', async ({ page }) => {
  await boot(page)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(4)
  await page.waitForFunction(() => !!window.__creation!.deviceScreen('k12-g') && !!window.__creation!.deviceScreen('k12-d'))
  // deviceScreen is in page CSS px: compare with the canvas centre on the page
  const mid = await page.locator('#renderCanvas').evaluate((c) => {
    const r = c.getBoundingClientRect()
    return r.x + r.width / 2
  })
  const g = (await page.evaluate(() => window.__creation!.deviceScreen('k12-g')))!
  const dr = (await page.evaluate(() => window.__creation!.deviceScreen('k12-d')))!
  expect(g.x).toBeLessThan(mid)
  expect(dr.x).toBeGreaterThan(mid)
  await expect(page.getByTestId('status-bar')).toContainText('4 appareils installés.')
})

test('Lieu → « Choisir un lieu… » reopens the picker over the place; Fermer / Échap go back unchanged', async ({ page }) => {
  await boot(page)
  await expect(page.getByTestId('place-picker-close')).toBeHidden() // first visit: nothing to go back to
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await expect(page.getByTestId('place-picker')).toBeHidden()
  await page.getByRole('menuitem', { name: 'Lieu' }).click()
  await page.getByRole('menuitem', { name: 'Choisir un lieu…' }).click()
  await expect(page.getByTestId('place-picker')).toBeVisible()
  await expect(page.getByTestId('place-grid').locator('[aria-selected="true"]')).toBeFocused()
  // the covered panels are inert while it is open
  expect(await page.evaluate(() => !!document.querySelector('[data-testid="project-tree"]')!.closest('[inert]'))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('place-picker')).toBeHidden()
  expect(await page.evaluate(() => !!document.querySelector('[data-testid="project-tree"]')!.closest('[inert]'))).toBe(false)
  expect(await page.evaluate(() => window.__creation!.place())).toBe('blank')
  await page.getByRole('menuitem', { name: 'Lieu' }).click()
  await page.getByRole('menuitem', { name: 'Choisir un lieu…' }).click()
  await page.getByTestId('place-picker-close').click()
  await expect(page.getByTestId('place-picker')).toBeHidden()
})

test('the type filter narrows the grid; arrows walk only the shown cards', async ({ page }) => {
  await boot(page)
  await page.getByTestId('place-filter').selectOption('Décor 3D')
  await expect(places(page).filter({ visible: true })).toHaveCount(3)
  await expect(page.getByRole('heading', { name: 'Lieux (3)' })).toBeVisible()
  const shown = places(page).filter({ visible: true })
  await shown.first().focus()
  await page.keyboard.press('End')
  await expect(shown.last()).toBeFocused()
})

test('a place that cannot load shows the blank room and a visible notice; a request while busy says « busy »', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.choosePlace('room:nope'))
  const note = page.getByTestId('note-fallback')
  await expect(note).toBeVisible()
  await expect(note).toContainText('salle vide neutre')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 0] }))
  const results = await page.evaluate(async () => {
    const a = window.__creation!.requestPlace('blank') // opens « Changer de lieu »
    const b = await window.__creation!.requestPlace('room:concert-hall-medium')
    return { b, a: typeof a }
  })
  expect(results.b).toBe('busy')
  await page.getByRole('button', { name: 'Annuler' }).click()
})

test('1366×768: no horizontal scroll, axe clean, reduced motion = no transitions; screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await boot(page)
  const overflow = await page.evaluate(() => {
    const p = document.querySelector('[data-testid="place-picker"]')!
    const scroller = p.querySelector('.cr-pick-scroll')!
    return { doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, list: scroller.scrollWidth - scroller.clientWidth }
  })
  expect(overflow.doc).toBeLessThanOrEqual(0)
  expect(overflow.list).toBeLessThanOrEqual(0)
  // the picker sits between the menubar and the status bar
  const box = (await page.getByTestId('place-picker').boundingBox())!
  expect(box.y).toBe(32)
  expect(box.y + box.height).toBe(768 - 28)
  expect(box.width).toBe(1366)
  // no transition (the page's reduced-motion reset may report 0.01 ms)
  expect(await page.locator('.cr-card').first().evaluate((e) => parseFloat(getComputedStyle(e).transitionDuration))).toBeLessThan(0.001)
  const res = await new AxeBuilder({ page }).analyze()
  expect(res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: 'docs/creative/screens/task-12-picker-1366x768.png' })
  await places(page).first().focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await page.screenshot({ path: 'docs/creative/screens/task-12-picker-keyboard-1366x768.png' })
  await page.locator('[data-place="room:radio-talk-studio-medium"]').click()
  await expect(page.getByTestId('place-mode-dialog')).toBeVisible()
  const axe2 = await new AxeBuilder({ page }).analyze()
  expect(axe2.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
  await page.screenshot({ path: 'docs/creative/screens/task-12-picker-dialog-1366x768.png' })
})

test('200 % zoom (683×384): the picker reflows without horizontal scroll and the cards stay reachable', async ({ page }) => {
  await page.setViewportSize({ width: 683, height: 384 })
  await boot(page)
  const o = await page.evaluate(() => {
    const s = document.querySelector('.cr-pick-scroll')!
    return { doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, list: s.scrollWidth - s.clientWidth, h: s.clientHeight }
  })
  expect(o.doc).toBeLessThanOrEqual(0)
  expect(o.list).toBeLessThanOrEqual(0)
  expect(o.h).toBeGreaterThan(80) // the grid keeps a usable height under the header
  await places(page).last().focus()
  await expect(places(page).last()).toBeInViewport()
})

test('1920×1080 screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await boot(page)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: 'docs/creative/screens/task-12-picker-1920x1080.png' })
})
