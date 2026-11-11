/**
 * Task 23: the inventory drawer (CA-09). Space (3D view focused) opens it, Space or Esc closes it
 * and gives the canvas back; ≤ 200 ms slide (0 under reduced motion); tabs are a tablist with
 * arrow keys; an item (Entrée or click) chooses the device (Task 24: it then follows the pointer); the module is a lazy chunk requested on the first open only.
 * Screenshot on demand: $env:DRAWER_SCREENS = 'commit' → docs/creative/screens/task-23-drawer-1366.png
 */
import { readFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { IDLE_WINDOW_MS, quietWindow, waitRendersIdle } from './waits'
test.use({ viewport: { width: 1366, height: 768 } })

/** The catalogue as the shell lists it: content/catalog.json is the source of truth (25 devices with the power strip, Task 32). */
const CATALOG_IDS = (JSON.parse(readFileSync('content/catalog.json', 'utf8')) as { devices: { id: string }[] }).devices.map((d) => d.id)
const PLACE = 'room:concert-hall-medium'
const boot = async (page: Page): Promise<void> => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate((p) => window.__creation!.choosePlace(p), PLACE)
  await page.waitForFunction((p) => window.__creation!.place() === p, PLACE)
}
const drawer = (page: Page) => page.getByTestId('inventory-drawer')
const open = async (page: Page): Promise<void> => {
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Space')
  await expect(drawer(page)).toBeVisible()
}
const seconds = (css: string): number => Math.max(...css.split(',').map((s) => parseFloat(s)))

test('the drawer chunk is not requested before the first open, then is', async ({ page }) => {
  const urls: string[] = []
  page.on('request', (r) => urls.push(r.url()))
  await boot(page)
  await page.locator('#renderCanvas').focus()
  await quietWindow(page, 300)
  expect(urls.filter((u) => /inventoryDrawer/i.test(u))).toEqual([])
  await expect(drawer(page)).toHaveCount(0)
  await page.keyboard.press('Space')
  await expect(drawer(page)).toBeVisible()
  expect(urls.some((u) => /inventoryDrawer.*\.js/i.test(u))).toBe(true)
})

test('Space opens a non-modal dialog « Inventaire » ; Space or Esc closes it and returns focus to the canvas', async ({ page }) => {
  await boot(page)
  await open(page)
  const d = drawer(page)
  await expect(d).toHaveAttribute('role', 'dialog')
  await expect(d).toHaveAttribute('aria-modal', 'false')
  await expect(page.getByRole('dialog', { name: 'Inventaire' })).toBeVisible()
  // focus moves in, on the selected tab
  await expect(page.getByRole('tab', { selected: true })).toBeFocused()
  await page.keyboard.press('Space')
  await expect(d).toBeHidden()
  await expect(page.locator('#renderCanvas')).toBeFocused()
  // Esc, from a tab and from an item
  await page.keyboard.press('Space')
  await expect(d).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(d).toBeHidden()
  await expect(page.locator('#renderCanvas')).toBeFocused()
  await page.keyboard.press('Space')
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('inventory-item').first()).toBeFocused()
  await page.keyboard.press('Space')
  await expect(d).toBeHidden()
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(0) // Space closed, it did not add
  await expect(page.locator('#renderCanvas')).toBeFocused()
  // closed: out of the tab order and the accessibility tree
  await expect(page.getByRole('dialog', { name: 'Inventaire' })).toHaveCount(0)
})

test('Space opens it only while the 3D view has focus', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press('Space')
  await page.getByTestId('tree-collapse').focus()
  await page.keyboard.press('Space') // the button's own activation
  await quietWindow(page, 300)
  await expect(drawer(page)).toHaveCount(0)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Space')
  await expect(drawer(page)).toBeVisible()
})

test('Matériel › Inventaire opens it (menu shows « Espace »), and again closes it', async ({ page }) => {
  await boot(page)
  await page.getByRole('menuitem', { name: 'Matériel' }).click()
  const item = page.getByRole('menuitem', { name: /^Inventaire/ })
  await expect(item).toContainText('Espace')
  await item.click()
  await expect(drawer(page)).toBeVisible()
  await expect(page.getByRole('tab', { selected: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(drawer(page)).toBeHidden()
})

test('tabs: a tablist with arrow keys (roving, wrapping, Home / End); the panel follows', async ({ page }) => {
  await boot(page)
  await open(page)
  const list = page.getByRole('tablist', { name: 'Catégories d’appareils' })
  await expect(list).toBeVisible()
  const tabs = list.getByRole('tab')
  const n = await tabs.count()
  expect(n).toBeGreaterThanOrEqual(5)
  await expect(tabs.first()).toHaveText('Micros')
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
  const panel = page.getByRole('tabpanel')
  await expect(panel).toHaveAccessibleName('Micros')
  const micros = await panel.getByTestId('inventory-item').allInnerTexts()
  expect(micros.length).toBeGreaterThan(0)
  await page.keyboard.press('ArrowRight')
  await expect(tabs.nth(1)).toBeFocused()
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(tabs.first()).toHaveAttribute('tabindex', '-1')
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'false')
  await expect(panel).toHaveAccessibleName(await tabs.nth(1).innerText())
  expect(await panel.getByTestId('inventory-item').allInnerTexts()).not.toEqual(micros)
  await page.keyboard.press('End')
  await expect(tabs.nth(n - 1)).toBeFocused()
  await page.keyboard.press('ArrowRight') // wraps
  await expect(tabs.first()).toBeFocused()
  await page.keyboard.press('ArrowLeft') // wraps back
  await expect(tabs.nth(n - 1)).toBeFocused()
  await page.keyboard.press('Home')
  await expect(tabs.first()).toBeFocused()
  // Tab is never ours: from the tab it goes to the first item, then on to « Fermer »
  await page.keyboard.press('Tab')
  await expect(panel.getByTestId('inventory-item').first()).toBeFocused()
  const last = await panel.getByTestId('inventory-item').count()
  for (let i = 0; i < last; i++) await page.keyboard.press('Tab')
  await expect(page.getByTestId('inventory-close')).toBeFocused()
})

test('the « Secteur » tab exists (the power strip is in the catalogue) and holds only « Multiprise secteur », without a picture of its own', async ({ page }) => {
  await boot(page)
  await open(page)
  const tabs = page.getByRole('tablist').getByRole('tab')
  const labels = await tabs.allInnerTexts()
  expect(labels).toEqual(['Micros', 'Consoles', 'Enceintes', 'Sources', 'Réseau', 'Câbles et DI', 'Pieds et accroches', 'Secteur', 'Bêta', 'Autres'])
  await page.getByRole('tab', { name: 'Secteur' }).click()
  const items = page.getByRole('tabpanel').getByTestId('inventory-item')
  await expect(items).toHaveCount(1)
  await expect(items.first()).toHaveAttribute('data-device-id', 'multiprise-secteur')
  await expect(items.first()).toContainText('Multiprise secteur')
  await expect(items.first().locator('svg')).toHaveCount(1) // no thumbnail yet: the silhouette (ASSET_LOG.md)
})

test('items are named buttons with a decorative picture (the silhouette when a device has none); no duplicate across the catalogue; a badge on the Bêta items only', async ({ page }) => {
  await boot(page)
  await open(page)
  const tabs = page.getByRole('tablist').getByRole('tab')
  const names: string[] = []
  for (let i = 0; i < (await tabs.count()); i++) {
    await tabs.nth(i).click()
    if ((await tabs.nth(i).getAttribute('data-tab')) === 'beta') continue // the proposals: tests/e2e/creation-beta.spec.ts
    await expect(page.getByTestId('inventory-badge')).toHaveCount(0) // a verified tab has no badge
    const items = page.getByRole('tabpanel').getByTestId('inventory-item')
    for (let j = 0; j < (await items.count()); j++) {
      const it = items.nth(j)
      expect(await it.evaluate((e) => e.tagName)).toBe('BUTTON')
      // every catalog device has a thumbnail (final review 4): a decorative <img>, no silhouette next to it
      await expect(it.locator('img[alt=""][aria-hidden="true"], svg[aria-hidden="true"]')).toHaveCount(1)
      names.push(await it.getAttribute('data-device-id') ?? '')
    }
  }
  expect(names.length).toBe(CATALOG_IDS.length) // the catalogue
  expect(new Set(names).size).toBe(CATALOG_IDS.length)
  expect([...names].sort()).toEqual([...CATALOG_IDS].sort())
})

test('Enter or click on an item chooses the device (it then follows the pointer, Task 24), and the drawer closes', async ({ page }) => {
  await boot(page)
  await open(page)
  const first = page.getByRole('tabpanel').getByTestId('inventory-item').first()
  const id = (await first.getAttribute('data-device-id'))!
  const name = (await first.innerText()).trim()
  await page.keyboard.press('Tab')
  await expect(first).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(drawer(page)).toBeHidden()
  await expect(page.locator('#renderCanvas')).toBeFocused()
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(true)
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(0) // chosen, not placed yet
  await expect(page.getByRole('status')).toContainText(name)
  // a click in the 3D view drops it: one undoable entry
  const box = (await page.locator('#renderCanvas').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect.poll(() => page.evaluate(() => window.__creation!.design().rig.instances.map((i) => i.deviceId))).toEqual([id])
  expect(await page.evaluate(() => window.__creation!.historySize())).toBe(1)
  // click path (Entrée drops where the ghost stands)
  await page.keyboard.press('Space')
  await expect(drawer(page)).toBeVisible()
  await page.getByRole('tabpanel').getByTestId('inventory-item').first().click()
  await expect(drawer(page)).toBeHidden()
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(2)
  await page.keyboard.press('Control+z')
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(1)
})

test('the drawer covers only the bottom of the viewport (≤ 40 %), over the canvas, below the cube', async ({ page }) => {
  await boot(page)
  await open(page)
  const v = (await page.getByTestId('viewport').boundingBox())!
  const d = (await drawer(page).boundingBox())!
  expect(d.height / v.height).toBeLessThanOrEqual(0.4)
  expect(d.height).toBeGreaterThan(120)
  expect(Math.abs(d.y + d.height - (v.y + v.height))).toBeLessThanOrEqual(1) // docked to the bottom
  expect(d.width).toBeLessThanOrEqual(v.width + 1)
  // the 3D view stays ≥ 60 % of the window (the drawer is inside it)
  expect((v.width * v.height) / (1366 * 768)).toBeGreaterThanOrEqual(0.6)
  // every item is inside the drawer (a long tab scrolls, nothing spills)
  const items = page.getByRole('tabpanel').getByTestId('inventory-item')
  for (let i = 0; i < (await items.count()); i++) {
    const r = (await items.nth(i).boundingBox())!
    expect(r.x).toBeGreaterThanOrEqual(d.x - 1)
    expect(r.x + r.width).toBeLessThanOrEqual(d.x + d.width + 1)
  }
})

test('slide ≤ 200 ms; 0 s under reduced motion; the drawer buttons and tabs never transition', async ({ page }) => {
  await boot(page)
  await open(page)
  const dur = await drawer(page).evaluate((e) => getComputedStyle(e).transitionDuration)
  expect(seconds(dur)).toBeGreaterThan(0)
  expect(seconds(dur)).toBeLessThanOrEqual(0.2)
  for (const sel of ['[role="tab"]', '[data-testid="inventory-item"]', '[data-testid="inventory-close"]']) {
    const t = await drawer(page).locator(sel).first().evaluate((e) => getComputedStyle(e).transitionDuration)
    expect(seconds(t), sel).toBe(0)
  }
  await page.keyboard.press('Escape')
  await expect(drawer(page)).toBeHidden()

  const reduced = await page.context().newPage()
  await reduced.setViewportSize({ width: 1366, height: 768 })
  await reduced.emulateMedia({ reducedMotion: 'reduce' })
  await boot(reduced)
  await open(reduced)
  const r = await drawer(reduced).evaluate((e) => getComputedStyle(e).transitionDuration)
  expect(seconds(r)).toBeLessThanOrEqual(0.0001) // the legacy reduced-motion rule makes « none » read 0.01 ms
  // That 0.01 ms comes from index.html's `transition-duration: 0.01ms !important` and would read the same with the drawer's own
  // slide still declared: the property is what proves the drawer's media query took (the slide itself is gone, not just shortened).
  expect(await drawer(reduced).evaluate((e) => getComputedStyle(e).transitionProperty)).toBe('none')
  await reduced.close()
})

test('a named « Fermer » button closes it and gives the canvas back; the hint names the live key', async ({ page }) => {
  await boot(page)
  await open(page)
  await expect(drawer(page)).toContainText('Espace ou Échap')
  await expect(page.getByTestId('inventory-close')).toHaveAccessibleName('Fermer l’inventaire')
  await page.getByTestId('inventory-close').click()
  await expect(drawer(page)).toBeHidden()
  await expect(page.locator('#renderCanvas')).toBeFocused()
})

test('idle with the drawer open: no render in 2 s (no per-frame work)', async ({ page }) => {
  await boot(page)
  await open(page)
  await waitRendersIdle(page)
  const a = await page.evaluate(() => window.__creation!.renders())
  await quietWindow(page, IDLE_WINDOW_MS)
  expect(await page.evaluate(() => window.__creation!.renders())).toBe(a)
})

test('the place picker (Nouveau) closes the drawer; focus is the picker\'s', async ({ page }) => {
  await boot(page)
  await open(page)
  await page.getByRole('menuitem', { name: 'Lieu' }).click()
  await page.getByRole('menuitem', { name: 'Choisir un lieu…' }).click()
  await expect(page.getByTestId('place-picker')).toBeVisible()
  await expect(drawer(page)).toBeHidden()
})

test('accessibility: no axe violation with the drawer open', async ({ page }) => {
  await boot(page)
  await open(page)
  const r = await new AxeBuilder({ page }).include('[data-testid="inventory-drawer"]').analyze()
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
})

test('focus ring on tabs and items is the shell ring (2 px Ambre)', async ({ page }) => {
  await boot(page)
  await open(page)
  const ring = async (): Promise<{ w: number; c: string }> =>
    page.evaluate(() => {
      const cs = getComputedStyle(document.activeElement as HTMLElement)
      return { w: parseFloat(cs.outlineWidth), c: cs.outlineColor }
    })
  const tab = await ring()
  expect(tab.w).toBeGreaterThanOrEqual(2)
  expect(tab.c).toBe('rgb(221, 147, 73)')
  await page.keyboard.press('Tab')
  const item = await ring()
  expect(item.w).toBeGreaterThanOrEqual(2)
  expect(item.c).toBe('rgb(221, 147, 73)')
})

test('screenshot (on demand)', async ({ page }) => {
  test.skip(process.env.DRAWER_SCREENS !== 'commit', 'set DRAWER_SCREENS=commit to write docs/creative/screens')
  await boot(page)
  await open(page)
  await page.getByRole('tab', { name: 'Consoles' }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'docs/creative/screens/task-23-drawer-1366.png' })
})

test('a held Space toggles the drawer exactly once (auto-repeat never flickers it): open stays open, then closed stays closed', async ({ page }) => {
  await boot(page)
  // Count the drawer's open / close transitions page-side (it is created lazily, so watch the viewport's subtree).
  await page.evaluate(() => {
    const log: string[] = []
    ;(window as unknown as { __drawerLog: string[] }).__drawerLog = log
    new MutationObserver((records) => {
      for (const r of records) {
        const v = (r.target as HTMLElement).dataset.open
        if (v !== undefined && v !== r.oldValue) log.push(v)
      }
    }).observe(document.querySelector('[data-testid="viewport"]')!, { subtree: true, attributes: true, attributeFilter: ['data-open'], attributeOldValue: true })
  })
  const transitions = (): Promise<string[]> => page.evaluate(() => [...(window as unknown as { __drawerLog: string[] }).__drawerLog])
  // An EVEN number of keydowns (1 press + 3 auto-repeats, Playwright sets repeat on a key already down):
  // code that toggled on every keydown would end in the wrong state, so the end state proves the guard.
  const hold = async (): Promise<void> => {
    await page.keyboard.down('Space')
    for (let i = 0; i < 3; i++) await page.keyboard.down('Space')
    await page.keyboard.up('Space')
    await quietWindow(page, 400)
  }
  await page.locator('#renderCanvas').focus()
  await hold()
  await expect(drawer(page)).toBeVisible()
  await expect(page.getByRole('tab', { selected: true })).toBeFocused()
  expect(await transitions()).toEqual(['true']) // opened once, never closed and re-opened
  await hold() // from inside the drawer: the first keydown closes it, the repeats land on the canvas
  await expect(drawer(page)).toBeHidden()
  await expect(page.locator('#renderCanvas')).toBeFocused()
  expect(await transitions()).toEqual(['true', 'false'])
})

// ── Final review 4: the drawer search and the device thumbnails ─────────────────────────────────────
const filterField = (page: Page) => drawer(page).getByRole('textbox', { name: 'Filtrer' })
const shown = (page: Page) => drawer(page).getByTestId('inventory-item')

test('a labelled « Filtrer » field sits above the tabs, with the shell focus ring and no transition', async ({ page }) => {
  await boot(page)
  await open(page)
  const f = filterField(page)
  await expect(f).toBeVisible()
  await expect(drawer(page).locator('label', { hasText: 'Filtrer' })).toBeVisible()
  // above the tabs in the reading and Tab order
  const before = await page.evaluate(() => {
    const field = document.querySelector('[data-testid="inventory-filter"]')!
    const tabs = document.querySelector('[role="tablist"]')!
    return !!(field.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING)
  })
  expect(before).toBe(true)
  const tp = await f.evaluate((e) => getComputedStyle(e).transitionProperty)
  expect(tp).toBe('none') // the legacy `transition: all` and the reduced-motion 0.01 ms rule do not decide it
  await f.focus()
  const ring = await f.evaluate((e) => {
    const cs = getComputedStyle(e)
    return { w: parseFloat(cs.outlineWidth), c: cs.outlineColor, shadow: cs.boxShadow }
  })
  expect(ring.w).toBeGreaterThanOrEqual(2)
  expect(ring.c).toBe('rgb(221, 147, 73)')
  expect(ring.shadow).not.toBe('none') // the 1 px Nuit edge
})

test('keyboard only: Space, type, Enter -> the first match follows the pointer (a ghost)', async ({ page }) => {
  await boot(page)
  await open(page)
  await page.keyboard.type('sm58') // typed on the focused tab: it lands in the field
  await expect(filterField(page)).toBeFocused()
  await expect(filterField(page)).toHaveValue('sm58')
  await expect(shown(page)).toHaveCount(1)
  await expect(shown(page).first()).toHaveAttribute('data-device-id', 'shure-sm58')
  await page.keyboard.press('Enter')
  await expect(drawer(page)).toBeHidden()
  await expect(page.locator('#renderCanvas')).toBeFocused()
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(true)
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(0) // chosen, not placed
})

test('under prefers-reduced-motion the drawer still takes focus on open (L24, WCAG 2.4.3), and Space, type, Enter starts a placement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await boot(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Space')
  await expect(drawer(page)).toBeVisible()
  // No sleep: the assertion auto-waits. With the legacy 0.01 ms transition on the wrapper divs, `visibility` was still `hidden`
  // when focus() ran, and focus stayed on the 3D view.
  await expect(page.getByRole('tab', { selected: true })).toBeFocused()
  await page.keyboard.type('sm58') // typed on the focused tab: it lands in the field
  await expect(filterField(page)).toBeFocused()
  await expect(filterField(page)).toHaveValue('sm58')
  await page.keyboard.press('Enter')
  await expect(drawer(page)).toBeHidden()
  await expect(page.locator('#renderCanvas')).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.__creation!.placing())).toBe(true)
})

test('nothing inside the drawer inherits a transition (the wrappers keep the legacy `transition: all`, which turns a `visibility` flip into a 0.01 ms one under reduced motion)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await boot(page)
  await open(page)
  const props = await drawer(page).evaluate((root) =>
    [...root.querySelectorAll('*')].filter((e) => getComputedStyle(e).transitionProperty !== 'none').map((e) => `${e.tagName.toLowerCase()}.${(e as HTMLElement).className}`)
  )
  expect(props).toEqual([])
})

test('the filter looks across all tabs by label, ignoring case and accents; a tab click clears it', async ({ page }) => {
  await boot(page)
  await open(page)
  await filterField(page).fill('YAMAHA')
  const ids = await shown(page).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.deviceId))
  expect(ids).toContain('yamaha-ql1') // a console
  expect(ids).toContain('yamaha-dbr12') // a loudspeaker: another tab
  await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Appareils qui correspondent')
  await drawer(page).getByRole('tab', { name: 'Enceintes' }).click()
  await expect(filterField(page)).toHaveValue('')
  await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Enceintes')
})

test('no match: « Aucun appareil ne correspond » is said politely and shown; Enter then chooses nothing; clearing brings the tab back', async ({ page }) => {
  await boot(page)
  await open(page)
  const f = filterField(page)
  await f.fill('zzzz')
  const say = drawer(page).getByTestId('inventory-filter-status')
  await expect(say).toHaveAttribute('role', 'status')
  await expect(say).toHaveAttribute('aria-live', 'polite')
  await expect(say).toHaveText('Aucun appareil ne correspond')
  await expect(shown(page)).toHaveCount(0)
  await expect(drawer(page).locator('.cr-drawer-empty')).toBeVisible()
  await expect(drawer(page).locator('.cr-drawer-empty')).toContainText('Aucun appareil ne correspond à « ')
  await page.keyboard.press('Enter')
  await expect(drawer(page)).toBeVisible()
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(false)
  await f.fill('')
  await expect(say).toHaveText('')
  expect(await shown(page).count()).toBeGreaterThan(0)
})

test('typing in the field triggers no shell key (letters, Space, brackets, digits, Delete, Backspace) and Esc still closes the drawer', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] })
  })
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press(']') // a selection a stray R / Delete / D would edit
  await expect.poll(() => page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  const cam = await page.evaluate(() => window.__creation!.camera())
  const design = await page.evaluate(() => window.__creation!.design())
  const hist = await page.evaluate(() => window.__creation!.historySize())
  await open(page)
  const f = filterField(page)
  await f.focus()
  await page.keyboard.type('r d f ] [ 1 2 3 v h')
  await page.keyboard.press('Delete')
  await page.keyboard.press('Backspace')
  await expect(f).toHaveValue('r d f ] [ 1 2 3 v ')
  await expect(drawer(page)).toBeVisible() // a typed Space did not close it
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  expect(await page.evaluate(() => window.__creation!.design())).toEqual(design)
  expect(await page.evaluate(() => window.__creation!.historySize())).toBe(hist)
  expect(await page.evaluate(() => window.__creation!.camera())).toEqual(cam)
  expect(await page.evaluate(() => window.__creation!.view())).toBe('orbit')
  await page.keyboard.press('Escape')
  await expect(drawer(page)).toBeHidden()
  await expect(page.locator('#renderCanvas')).toBeFocused()
})

test('thumbnails: a catalog device shows its picture (decorative, lazy, loaded); a Bêta proposal and a failed picture keep the silhouette; none is fetched before the drawer opens, and only the open tab\'s', async ({ page }) => {
  const thumbs: string[] = []
  page.on('request', (r) => /\/assets\/thumbs\//.test(r.url()) && thumbs.push(r.url()))
  await boot(page)
  await quietWindow(page, 400)
  expect(thumbs).toEqual([]) // nothing before the first open
  await open(page)
  const ql = drawer(page).locator('[data-device-id="yamaha-ql1"]')
  await drawer(page).getByRole('tab', { name: 'Consoles' }).click()
  const img = ql.locator('img')
  await expect(img).toHaveCount(1)
  await expect(img).toHaveAttribute('alt', '')
  await expect(img).toHaveAttribute('aria-hidden', 'true')
  await expect(img).toHaveAttribute('loading', 'lazy')
  await expect(ql.locator('svg')).toHaveCount(0)
  await expect.poll(() => img.evaluate((e) => (e as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  // only pictures of what the learner opened (the Micros tab, then the Consoles tab): never the whole catalogue
  expect(thumbs.length).toBeGreaterThan(0)
  expect(thumbs.length).toBeLessThan(CATALOG_IDS.length - 1)
  // a Bêta proposal has no picture: the silhouette
  await drawer(page).getByRole('tab', { name: 'Bêta' }).click()
  const beta = drawer(page).getByTestId('inventory-item').first()
  await expect(beta.locator('svg')).toHaveCount(1)
  await expect(beta.locator('img')).toHaveCount(0)
})

test('a picture that fails to load falls back to the silhouette (the drawer never shows a broken image)', async ({ page }) => {
  await page.route('**/assets/thumbs/shure-sm58.png', (route) => route.abort())
  await boot(page)
  await open(page)
  const sm58 = drawer(page).locator('[data-device-id="shure-sm58"]')
  await expect(sm58).toBeVisible()
  await expect(sm58.locator('svg')).toHaveCount(1)
  await expect(sm58.locator('img')).toHaveCount(0)
  // its neighbour keeps its picture
  await expect(drawer(page).locator('[data-device-id="shure-sm57"] img')).toHaveCount(1)
})

// ── Night 2 wave 4, item 2: at 400 px the tab row shows ~2 tabs and nothing said it scrolls ─────────────────────────────────────────────
// Measured on 7d9d62f at 400 x 800: the row is wider than its box (scrollWidth > clientWidth) and the cut-off third tab was the only hint.
// Now an edge fade (a mask on the row, so no element and nothing for assistive tech) shows on the side that has more tabs, and goes at the end.
test.describe('drawer tab row at 400 x 800 (wave 4, item 2)', () => {
  test.use({ viewport: { width: 400, height: 800 } })
  const row = (page: Page) => drawer(page).getByRole('tablist')
  const mask = (page: Page) => row(page).evaluate((e) => getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage || 'none')
  const state = (page: Page) =>
    row(page).evaluate((e) => ({
      scrolls: e.scrollWidth > e.clientWidth + 1,
      start: (e as HTMLElement).dataset.fadeStart,
      end: (e as HTMLElement).dataset.fadeEnd,
      left: e.scrollLeft,
      atEnd: e.scrollLeft + e.clientWidth >= e.scrollWidth - 1,
      lastFullyVisible: (() => {
        const tabs = [...e.querySelectorAll('[role="tab"]')]
        const last = tabs[tabs.length - 1].getBoundingClientRect()
        return last.right <= e.getBoundingClientRect().right + 0.5
      })(),
    }))

  test('the row scrolls, shows a fade on the side with more tabs, the last tab is reached by a pointer scroll and the fade goes at the end', async ({ page }) => {
    await boot(page)
    await open(page)
    const s0 = await state(page)
    expect(s0.scrolls, 'at 400 px the tabs do not all fit (the test means something)').toBe(true)
    expect(s0.end, 'more tabs on the right: a fade says so').toBe('true')
    expect(s0.start).toBe('false')
    expect(await mask(page), 'and it is drawn').not.toBe('none')
    // decoration only: nothing was added to the tab list for it
    expect(await row(page).evaluate((e) => [...e.children].every((c) => c.getAttribute('role') === 'tab'))).toBe(true)
    const box = (await row(page).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(60, 0)
    await expect.poll(async () => (await state(page)).start, 'once scrolled the left side has more tabs too').toBe('true')
    await page.mouse.wheel(2000, 0)
    await expect.poll(async () => (await state(page)).atEnd).toBe(true)
    const s1 = await state(page)
    expect(s1.lastFullyVisible, 'the last tab is reached').toBe(true)
    expect(s1.end, 'at the end the right fade is gone').toBe('false')
    expect(s1.start).toBe('true')
    await page.mouse.wheel(-5000, 0)
    await expect.poll(async () => (await state(page)).left).toBe(0)
    expect((await state(page)).start).toBe('false')
  })

  test('S7: a tab reached with the arrows is scrolled in clear of the fade: fully inside the unmasked part of the row, so its focus ring is whole', async ({ page }) => {
    // Tolerance 1 px: a browser snaps scrollLeft to whole pixels, so a tab at a fractional offset (longer tab names since Wave 0) can end up to a pixel inside the fade.
    await boot(page)
    await open(page)
    const FADE = 28
    const read = () =>
      row(page).evaluate((e) => {
        const f = document.activeElement!.getBoundingClientRect()
        const b = e.getBoundingClientRect()
        return { wide: f.width > b.width - 2 * 28, left: f.left - b.left, right: b.right - f.right, start: (e as HTMLElement).dataset.fadeStart, end: (e as HTMLElement).dataset.fadeEnd }
      })
    const clear = async (label: string): Promise<void> => {
      // the flags follow the scroll (a scroll event): wait until they say the same as the geometry before reading the margins
      await expect
        .poll(() =>
          row(page).evaluate((e) => {
            const want = { start: String(e.scrollLeft > 1), end: String(e.scrollLeft + e.clientWidth < e.scrollWidth - 1) }
            return (e as HTMLElement).dataset.fadeStart === want.start && (e as HTMLElement).dataset.fadeEnd === want.end
          })
        )
        .toBe(true)
      const r = await read()
      // A tab too wide to be clear of both fades (the row is 152 px at 400 px wide) must at least be whole inside the row.
      if (r.wide) {
        expect(r.left, label + ': a wide tab is whole (start)').toBeGreaterThanOrEqual(-1)
        expect(r.right, label + ': a wide tab is whole (end)').toBeGreaterThanOrEqual(-1)
        return
      }
      if (r.start === 'true') expect(r.left, label + ': clear of the start fade').toBeGreaterThanOrEqual(FADE - 1)
      if (r.end === 'true') expect(r.right, label + ': clear of the end fade').toBeGreaterThanOrEqual(FADE - 1)
    }
    await row(page).getByRole('tab').first().focus()
    const n = await row(page).getByRole('tab').count()
    for (let i = 0; i < n - 1; i++) {
      await page.keyboard.press('ArrowRight')
      await expect(row(page).getByRole('tab').nth(i + 1)).toBeFocused()
      await clear('going right, tab ' + (i + 1))
    }
    for (let i = n - 1; i > 0; i--) {
      await page.keyboard.press('ArrowLeft')
      await expect(row(page).getByRole('tab').nth(i - 1)).toBeFocused()
      await clear('going back, tab ' + (i - 1))
    }
  })

  test('with all the tabs on screen (1700 px wide; at 1366 the row of 549 px already scrolls in 489) there is no fade at all', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 900 })
    await boot(page)
    await open(page)
    const s = await state(page)
    expect(s.scrolls).toBe(false)
    expect(s.start).toBe('false')
    expect(s.end).toBe('false')
    expect(await mask(page)).toBe('none')
  })

  test('a keyboard move to the last tab (End) updates the fade as well', async ({ page }) => {
    await boot(page)
    await open(page)
    await row(page).getByRole('tab').first().focus()
    await page.keyboard.press('End')
    await expect.poll(async () => (await state(page)).end).toBe('false')
    expect((await state(page)).lastFullyVisible).toBe(true)
    await page.keyboard.press('Home')
    await expect.poll(async () => (await state(page)).start).toBe('false')
    expect((await state(page)).end).toBe('true')
  })
})

// ── Fix round 2, item 1: the focusin handler of the fade scrolled the row on a MOUSE press too, so a click in the last 28 px (where the next tab peeks) was lost ───────────────────────
test.describe('drawer tab row at 400 x 800: a mouse click inside the fade (fix round 2)', () => {
  test.use({ viewport: { width: 400, height: 800 } })
  const row = (page: Page) => drawer(page).getByRole('tablist')
  test('a click 5 px inside the right edge of the peeking tab selects it (the press must not shift the row under the pointer)', async ({ page }) => {
    await boot(page)
    await open(page)
    const peek = await row(page).evaluate((e) => {
      const b = e.getBoundingClientRect()
      const tabs = [...e.querySelectorAll<HTMLElement>('[role="tab"]')]
      const i = tabs.findIndex((t) => t.getBoundingClientRect().left < b.right && t.getBoundingClientRect().right > b.right + 8)
      return { i, x: b.right - 5, y: b.top + b.height / 2, name: tabs[i]?.textContent }
    })
    expect(peek.i, 'a tab peeks over the right edge (the test means something)').toBeGreaterThan(0)
    await page.mouse.click(peek.x, peek.y)
    await expect(row(page).getByRole('tab').nth(peek.i), `the peeking tab « ${peek.name} » is selected by the click`).toHaveAttribute('aria-selected', 'true')
  })

  test('the same on the left edge once the row is scrolled: a click 5 px inside the peeking tab selects it', async ({ page }) => {
    await boot(page)
    await open(page)
    const box = (await row(page).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(2000, 0)
    await expect.poll(() => row(page).evaluate((e) => (e as HTMLElement).dataset.fadeEnd)).toBe('false')
    const peek = await row(page).evaluate((e) => {
      const b = e.getBoundingClientRect()
      const tabs = [...e.querySelectorAll<HTMLElement>('[role="tab"]')]
      const i = tabs.findIndex((t) => t.getBoundingClientRect().left < b.left - 8 && t.getBoundingClientRect().right > b.left)
      return { i, x: b.left + 5, y: b.top + b.height / 2, name: tabs[i]?.textContent }
    })
    expect(peek.i, 'a tab peeks over the left edge').toBeGreaterThanOrEqual(0)
    await page.mouse.click(peek.x, peek.y)
    await expect(row(page).getByRole('tab').nth(peek.i), `the peeking tab « ${peek.name} » is selected by the click`).toHaveAttribute('aria-selected', 'true')
  })
})
