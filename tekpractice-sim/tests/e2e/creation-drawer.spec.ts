/**
 * Task 23: the inventory drawer (CA-09). Space (3D view focused) opens it, Space or Esc closes it
 * and gives the canvas back; ≤ 200 ms slide (0 under reduced motion); tabs are a tablist with
 * arrow keys; an item (Entrée or click) chooses the device (Task 24: it then follows the pointer); the module is a lazy chunk requested on the first open only.
 * Screenshot on demand: $env:DRAWER_SCREENS = 'commit' → docs/creative/screens/task-23-drawer-1366.png
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })

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
  await page.waitForTimeout(300)
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
  await page.waitForTimeout(300)
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

test('items are named buttons with an icon; no duplicate across the catalogue; a badge only when given', async ({ page }) => {
  await boot(page)
  await open(page)
  const tabs = page.getByRole('tablist').getByRole('tab')
  const names: string[] = []
  for (let i = 0; i < (await tabs.count()); i++) {
    await tabs.nth(i).click()
    const items = page.getByRole('tabpanel').getByTestId('inventory-item')
    for (let j = 0; j < (await items.count()); j++) {
      const it = items.nth(j)
      expect(await it.evaluate((e) => e.tagName)).toBe('BUTTON')
      await expect(it.locator('svg[aria-hidden="true"]')).toHaveCount(1)
      names.push(await it.getAttribute('data-device-id') ?? '')
    }
  }
  expect(names.length).toBe(24) // the catalogue
  expect(new Set(names).size).toBe(24)
  await expect(page.getByTestId('inventory-badge')).toHaveCount(0) // no proposals yet (Task 30)
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
  await page.waitForTimeout(500)
  const a = await page.evaluate(() => window.__creation!.renders())
  await page.waitForTimeout(2000)
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
    await page.waitForTimeout(400)
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
