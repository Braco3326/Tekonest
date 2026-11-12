import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { quietWindow } from './waits'

const boot = async (page: Page): Promise<void> => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation) // the shell boots from a lazy chunk, after `load`
  await expect(page.getByTestId('place-picker')).toBeVisible()
}
const places = (page: Page) => page.getByTestId('place-grid').getByRole('option')

test('« Choisir un lieu »: 36 place cards and the two template cards (T1.6: « Concert simple (référence) » then « Premier son (déjà câblé et alimenté) »), each with its note', async ({ page }) => {
  await boot(page)
  await expect(page.getByRole('heading', { name: 'Choisir un lieu' })).toBeVisible()
  await expect(places(page)).toHaveCount(36)
  const templates = page.getByTestId('template-grid').getByRole('option')
  // T1.6: the count moves from 1 to 2 (the new playable template); the reference card stays first (file order) and now says what is left to do.
  await expect(templates).toHaveCount(2)
  await expect(templates.first()).toContainText('Concert simple (référence)')
  await expect(templates.first()).toContainText('À compléter : sorties de la console vers les enceintes, Lecture console.')
  await expect(templates.nth(1)).toContainText('Premier son (déjà câblé et alimenté)')
  await expect(templates.nth(1)).toContainText('Prêt à écouter dès l’ouverture : déjà câblé et alimenté.')
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
  expect(await hi.getAttribute('data-place')).not.toBe(await first.getAttribute('data-place'))
  // A pinned target without the L2 badge (deterministic: no mode dialog): Home → blank, → « Plateau live ».
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowRight')
  await expect(hi).toHaveAttribute('data-place', 'set:plateau')
  await expect(hi.locator('.cr-card-badge')).toHaveCount(0)
  expect(await page.evaluate(() => window.__creation!.place())).toBeNull()
  const key = 'set:plateau'
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('place-mode-dialog')).toBeHidden()
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
  // KB display names (brand + model), not ids (review fix 4)
  await expect(note.getByRole('listitem').first()).toHaveText('Behringer MicroAMP HA400')
  await expect(note.getByRole('listitem').nth(2)).toHaveText('DHD audio RX2 (Series 52)')
  // announced, not only shown
  await expect(page.locator('.cr-status-msg')).toContainText('Appareils installés : 9. Matériel non disponible dans le jeu : Behringer MicroAMP HA400')
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

test('« Concert simple (référence) » loads 5 devices (4 + the power strip) in concert-hall-medium; « G » is on screen-left (P14, ADR-0011)', async ({ page }) => {
  await boot(page)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(5)
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
  await expect(page.getByTestId('status-bar')).toContainText('Appareils installés : 5.')
})

test('T1.6: « Premier son (déjà câblé et alimenté) » opens in the neutral room and is ready to play at once: 5 devices, 6 cables, « Lecture possible », « Signal OK », no action taken', async ({ page }) => {
  await boot(page)
  await page.getByTestId('template-grid').getByRole('option', { name: /Premier son/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank' && window.__creation!.design().rig.instances.length === 5)
  const d = await page.evaluate(() => window.__creation!.design())
  expect(d.rig.connections).toHaveLength(6)
  expect(d.rig.controls.ql1['playback-usb']).toBe(true) // applied from the template's controls (the design also lists every default)
  await expect(page.getByTestId('status-playback')).toHaveText('Lecture possible')
  await expect(page.getByTestId('status-playback')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('signal-status')).toHaveAttribute('data-kind', 'ok')
  await expect(page.getByTestId('status-mic')).toHaveText('Micro OK')
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

test('a model over installed gear asks « Remplacer le matériel » first: Annuler keeps the rig, Remplacer replaces (undoable)', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 0] }))
  const openTemplate = async () => {
    await page.getByRole('menuitem', { name: 'Lieu' }).click()
    await page.getByRole('menuitem', { name: 'Choisir un lieu…' }).click()
    await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  }
  await openTemplate()
  const dialog = page.getByRole('dialog', { name: 'Remplacer le matériel ?' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Ctrl+Z permet de revenir en arrière')
  await dialog.getByRole('button', { name: 'Annuler' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByTestId('place-picker')).toBeVisible() // still choosing
  expect(await page.evaluate(() => window.__creation!.place())).toBe('blank')
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.map((i) => i.instanceId))).toEqual(['ql1'])

  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.getByRole('dialog', { name: 'Remplacer le matériel ?' }).getByRole('button', { name: 'Remplacer le matériel' }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(5)
  await expect(page.locator('.cr-status-msg')).toContainText('Matériel remplacé. Appareils installés : 5. Ctrl+Z pour revenir en arrière.')
  await page.evaluate(() => window.__creation!.undo())
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.map((i) => i.instanceId))).toEqual(['ql1'])
})

test('a card that cannot be opened says so in the picker (and the status bar); nothing changes', async ({ page }) => {
  // The radio talk studio's room chunk fails to load: « Avec le matériel du modèle » cannot be built.
  await page.route('**/assets/radio-talk-studio-medium-*.js', (r) => r.abort())
  await boot(page)
  await page.locator('[data-place="room:radio-talk-studio-medium"]').click()
  const dialog = page.getByTestId('place-mode-dialog')
  await dialog.getByRole('radio', { name: 'Avec le matériel du modèle' }).check()
  await dialog.getByRole('button', { name: 'Ouvrir' }).click()
  const err = page.getByTestId('place-picker-error')
  await expect(err).toBeVisible()
  await expect(err).toHaveText('Impossible d’ouvrir Studio radio de débat + régie (moyen). Rien n’a changé : réessayez ou choisissez un autre lieu.')
  await expect(err).toHaveAttribute('role', 'alert')
  await expect(page.locator('.cr-status-msg')).toContainText('Rien n’a changé')
  await expect(page.getByTestId('place-picker')).toBeVisible()
  expect(await page.evaluate(() => window.__creation!.place())).toBeNull()
  // a lazy chunk that fails AFTER the app started is the app's to handle (the line above): the entry guard of index.html must never cover the screen for it (review C1)
  await quietWindow(page, 400) // past the guard's 100 ms wait
  await expect(page.getByTestId('entry-failure')).toHaveCount(0)
  // the next choice clears it
  await page.locator('[data-place="blank"]').click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await expect(err).toBeHidden()
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
  await page.screenshot({ path: 'test-results/screens/task-12-picker-1366x768.png' })
  await places(page).first().focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await page.screenshot({ path: 'test-results/screens/task-12-picker-keyboard-1366x768.png' })
  await page.locator('[data-place="room:radio-talk-studio-medium"]').click()
  await expect(page.getByTestId('place-mode-dialog')).toBeVisible()
  // accented place names in the dialog title use Plex (Tektur's 18 px acute reads as a macron)
  expect(await page.locator('.cr-pick-confirm-title').evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/^'?"?IBM Plex Sans/)
  const axe2 = await new AxeBuilder({ page }).analyze()
  expect(axe2.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
  await page.screenshot({ path: 'test-results/screens/task-12-picker-dialog-1366x768.png' })
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
  await page.screenshot({ path: 'test-results/screens/task-12-picker-1920x1080.png' })
})

test('template card note (T1.6 follow-up): a quiet secondary line in the muted ink on the panel, never Ambre text, contrast of at least 4.5, axe clean on the template grid', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await boot(page)
  const cards = page.getByTestId('template-grid').getByRole('option')
  for (const i of [0, 1]) {
    const card = cards.nth(i)
    const note = card.locator('.cr-card-note')
    await expect(note).toHaveCount(1)
    const s = await card.evaluate((c) => {
      const px = (e: Element): { color: string; fontSize: number; marginTop: number; weight: string } => {
        const cs = getComputedStyle(e)
        return { color: cs.color, fontSize: parseFloat(cs.fontSize), marginTop: parseFloat(cs.marginTop), weight: cs.fontWeight }
      }
      const rgb = (css: string): number[] => (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
      const lum = (c: number[]): number => {
        const [r, g, b] = c.map((v) => ((v / 255) <= 0.03928 ? v / 255 / 12.92 : (((v / 255) + 0.055) / 1.055) ** 2.4))
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
      }
      const note = px(c.querySelector('.cr-card-note')!)
      const size = px(c.querySelector('.cr-card-size')!)
      const bg = rgb(getComputedStyle(c).backgroundColor)
      const fg = rgb(note.color)
      const [hi, lo] = [Math.max(lum(fg), lum(bg)), Math.min(lum(fg), lum(bg))]
      return { note, size, contrast: (hi + 0.05) / (lo + 0.05), bg: getComputedStyle(c).backgroundColor }
    })
    expect(s.note.color, `card ${i}: the same muted ink as the size line`).toBe(s.size.color)
    expect(s.note.fontSize, `card ${i}: a secondary size, not the card's 14 px body`).toBe(12)
    expect(s.note.marginTop, `card ${i}: set off from the badge or size above`).toBeGreaterThanOrEqual(4)
    expect(s.note.weight).toBe('400')
    expect(s.contrast, `card ${i}: contrast ${s.contrast.toFixed(2)} on ${s.bg}`).toBeGreaterThanOrEqual(4.5)
  }
  const axe = await new AxeBuilder({ page }).include('[data-testid="template-grid"]').withRules(['color-contrast']).analyze()
  expect(axe.violations).toEqual([])
})
