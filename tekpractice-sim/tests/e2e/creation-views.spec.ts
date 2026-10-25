/**
 * Task 18 (C11, CA-05): the 26 named views from the keyboard, the `V` picker and Vue › Vues.
 * Release blocker: the cube's edge / corner targets (~15–17 px) meet WCAG 2.5.8 only through
 * this keyboard / menu equivalent.
 */
import { expect, test, type Page } from '@playwright/test'
import { ZONES, zoneAngles, zoneId, zoneLabel, type ZoneSigns } from '../../src/camera/cubeZones'
import { DEFAULT_FRONT_ALPHA, DESSUS_BETA } from '../../src/camera/viewCube'
import { viewMenuOrder } from '../../src/creation/shell/menuModel'
test.use({ viewport: { width: 1366, height: 768 } })

const boot = async (page: Page, reduced = true): Promise<void> => {
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
}

const camera = (page: Page) => page.evaluate(() => window.__creation!.camera()!)
/** Angular gap between the camera and a zone's pose (alpha modulo 2π). */
const gap = async (page: Page, s: ZoneSigns | { alpha: number; beta: number }) => {
  const want = 'alpha' in s ? s : zoneAngles(s)
  const c = await camera(page)
  return {
    alpha: Math.abs(((c.alpha - want.alpha + 3 * Math.PI) % (2 * Math.PI)) - Math.PI),
    beta: Math.abs(c.beta - want.beta),
  }
}
const zone = (id: string): ZoneSigns => ZONES.find((z) => zoneId(z) === id)!
/** The focused control's text, no-break spaces read as spaces (the picker keeps « · » off a line start). */
const focusedName = (page: Page) =>
  page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent?.replace(/ /g, ' ') ?? null)

test('V opens « Choisir une vue » (5 rows, focus on the nearest view); arrows + Entrée land, Échap never moves', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('face'))
  const canvas = page.locator('#renderCanvas')
  await canvas.focus()
  await page.keyboard.press('v')
  const dialog = page.getByRole('dialog', { name: 'Choisir une vue' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('row')).toHaveCount(5)
  const grid = dialog.getByRole('grid')
  await expect(grid.getByRole('button')).toHaveCount(26)
  for (const z of ZONES) await expect(grid.getByRole('button', { name: zoneLabel(z), exact: true })).toHaveCount(1)
  // focus starts on the view the camera is closest to, marked current
  const face = grid.getByRole('button', { name: 'Face', exact: true })
  await expect(face).toBeFocused()
  await expect(face).toHaveAttribute('aria-current', 'true')
  // one tab stop in the grid (roving), Tab never intercepted: it reaches « Annuler »
  expect(await grid.locator('button[tabindex="0"]').count()).toBe(1)
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(face).toBeFocused()

  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(grid.getByRole('button', { name: 'Droite', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(dialog).toHaveCount(0)
  await expect(canvas).toBeFocused()
  const g1 = await gap(page, zone('droite'))
  expect(Math.max(g1.alpha, g1.beta)).toBeLessThan(0.02)
  await expect(page.getByRole('status')).toHaveText('Vue : Droite')

  // Échap closes without moving the camera; focus back on the canvas
  await page.keyboard.press('v')
  await expect(dialog).toBeVisible()
  await expect(grid.getByRole('button', { name: 'Droite', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  const before = await camera(page)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(canvas).toBeFocused()
  await page.waitForTimeout(100)
  expect(await camera(page)).toEqual(before)
  // « Annuler » does the same
  await page.keyboard.press('v')
  await dialog.getByRole('button', { name: 'Annuler' }).click()
  await expect(dialog).toHaveCount(0)
  expect(await camera(page)).toEqual(before)

  // ArrowUp ×2 → Dessus; leaving the pole comes back to the side you came from (prevAz)
  await canvas.focus()
  await page.keyboard.press('v')
  await page.keyboard.press('ArrowUp')
  expect(await focusedName(page)).toBe('Dessus · Droite')
  await page.keyboard.press('ArrowUp')
  expect(await focusedName(page)).toBe('Dessus')
  await page.keyboard.press('ArrowDown')
  expect(await focusedName(page)).toBe('Dessus · Droite')
  await page.keyboard.press('ArrowDown')
  expect(await focusedName(page)).toBe('Droite')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  expect(await focusedName(page)).toBe('Dessus')
  await page.keyboard.press('Enter')
  await expect(dialog).toHaveCount(0)
  // Dessus, north-up: Face at the bottom of the screen (alpha = the front heading)
  const g2 = await gap(page, { alpha: DEFAULT_FRONT_ALPHA, beta: DESSUS_BETA })
  expect(Math.max(g2.alpha, g2.beta)).toBeLessThan(0.02)
})

test('V acts only on the 3D canvas (WCAG 2.1.4), never in a text field, and is off under the place picker', async ({ page }) => {
  await boot(page)
  await page.getByTestId('tree-collapse').focus()
  await page.keyboard.press('v')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // the place picker covers the view: Vue › Choisir une vue… and the views are off
  await page.getByRole('menuitem', { name: 'Lieu' }).click()
  await page.getByRole('menuitem', { name: 'Choisir un lieu…' }).click()
  await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: /Choisir une vue…/ })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByRole('menuitem', { name: 'Vues', exact: true })).toHaveAttribute('aria-disabled', 'true')
})

test('the Vue menu shows Vues, F, Alt+H, V; « Vue d’ensemble » (Alt+H) goes back to the opening pose', async ({ page }) => {
  await boot(page)
  const open = await camera(page)
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('arriere-gauche'))
  await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
  const menu = page.getByRole('menu', { name: 'Vue', exact: true })
  await expect(menu.getByRole('menuitem', { name: /Cadrer la sélection/ })).toContainText('F')
  await expect(menu.getByRole('menuitem', { name: /Vue d’ensemble/ })).toContainText('Alt+H')
  await expect(menu.getByRole('menuitem', { name: /Choisir une vue…/ })).toContainText('V')
  await expect(menu.getByRole('menuitem', { name: 'Marcher' })).toHaveCount(0) // Task 19
  await menu.getByRole('menuitem', { name: /Vue d’ensemble/ }).click()
  const g = await gap(page, open)
  expect(Math.max(g.alpha, g.beta)).toBeLessThan(0.02)
  // Alt+H from the canvas
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('droite'))
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Alt+h')
  const g2 = await gap(page, open)
  expect(Math.max(g2.alpha, g2.beta)).toBeLessThan(0.02)
})

test('every Vue › Vues item, reached by keyboard through the menubar, lands its view (26, reduced motion)', async ({ page }) => {
  await boot(page)
  const order = viewMenuOrder().map((v) => v.zone)
  expect(order).toHaveLength(26)
  // the menubar by keyboard: its first item, then → to Vue
  await page.locator('#cr-menu-projet').focus()
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
  await expect(page.locator('#cr-menu-vue')).toBeFocused()
  for (let k = 0; k < order.length; k++) {
    const s = order[k]
    const start = await gap(page, s)
    expect(Math.max(start.alpha, start.beta), `${zoneId(s)}: the start pose is not already the target`).toBeGreaterThan(0.1)
    if (k > 0) {
      // the previous view handed focus to the 3D view: back to the menubar by keyboard (Maj+Tab)
      await expect(page.locator('#renderCanvas')).toBeFocused()
      for (let i = 0; i < 12 && !(await page.locator('#cr-menu-vue').evaluate((e) => e === document.activeElement)); i++)
        await page.keyboard.press('Shift+Tab')
    }
    await expect(page.locator('#cr-menu-vue')).toBeFocused()
    await page.keyboard.press('Enter') // opens Vue on its first item, « Vues »
    await expect(page.getByRole('menuitem', { name: 'Vues', exact: true })).toBeFocused()
    await expect(page.getByRole('menuitem', { name: 'Vues', exact: true })).toHaveAttribute('aria-haspopup', 'menu')
    await page.keyboard.press('ArrowRight') // opens the submenu on its first view
    const sub = page.getByRole('menu', { name: 'Vues', exact: true })
    await expect(sub).toBeVisible()
    for (let i = 0; i < k; i++) await page.keyboard.press('ArrowDown')
    await expect(sub.getByRole('menuitem', { name: zoneLabel(s), exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(sub).toBeHidden()
    const end = await gap(page, s)
    expect(end.alpha, zoneId(s)).toBeLessThan(0.02)
    expect(end.beta, zoneId(s)).toBeLessThan(0.02)
  }
})

test('Vues submenu: groups Faces / Arêtes / Coins; ← and Échap close it back to « Vues »; Tab closes everything', async ({ page }) => {
  await boot(page)
  await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
  const vues = page.getByRole('menuitem', { name: 'Vues', exact: true })
  await expect(vues).toBeFocused()
  await expect(vues).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('ArrowRight')
  const sub = page.getByRole('menu', { name: 'Vues', exact: true })
  await expect(vues).toHaveAttribute('aria-expanded', 'true')
  await expect(sub.getByRole('group')).toHaveCount(3)
  for (const [name, n] of [['Faces', 6], ['Arêtes', 12], ['Coins', 8]] as const)
    await expect(sub.getByRole('group', { name }).getByRole('menuitem')).toHaveCount(n)
  await page.keyboard.press('ArrowLeft')
  await expect(sub).toBeHidden()
  await expect(vues).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(sub).toBeVisible()
  await page.keyboard.press('End')
  await expect(sub.getByRole('menuitem', { name: 'Dessous · Face · Gauche', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowDown') // wraps
  await expect(sub.getByRole('menuitem', { name: 'Face', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(sub).toBeHidden()
  await expect(vues).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('#cr-menu-vue')).toBeFocused()
  await expect(page.getByRole('menu')).toHaveCount(0)
  // the pointer: hovering « Vues » opens the submenu; a view click lands it
  await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
  await vues.hover()
  await expect(sub).toBeVisible()
  await sub.getByRole('menuitem', { name: 'Arrière', exact: true }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  const g = await gap(page, zone('arriere'))
  expect(Math.max(g.alpha, g.beta)).toBeLessThan(0.02)
  // Tab out of an open submenu closes the whole menu
  await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
  await page.keyboard.press('ArrowRight')
  await expect(sub).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('menu')).toHaveCount(0)
})

// ── Review Fix 1 ──

for (const size of [{ width: 1100, height: 768 }, { width: 1280, height: 720 }, { width: 1366, height: 768 }]) {
  test(`Vues submenu stays inside the window at ${size.width}×${size.height}; the last corner is reached visibly`, async ({ page }) => {
    await page.setViewportSize(size)
    await boot(page)
    await page.locator('#cr-menu-projet').focus()
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    await page.keyboard.press('ArrowRight')
    const sub = page.getByRole('menu', { name: 'Vues', exact: true })
    await expect(sub).toBeVisible()
    // opened as soon as the shell is up: the web fonts may still be on their way (they widen the menubar)
    await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(r))))
    const rects = await sub.getByRole('menuitem').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect))
    expect(rects).toHaveLength(26)
    for (const r of rects) {
      expect(r.left).toBeGreaterThanOrEqual(0)
      expect(r.top).toBeGreaterThanOrEqual(0)
      expect(r.right).toBeLessThanOrEqual(size.width)
      expect(r.bottom).toBeLessThanOrEqual(size.height)
    }
    await page.keyboard.press('End')
    const last = sub.getByRole('menuitem', { name: 'Dessous · Face · Gauche', exact: true })
    await expect(last).toBeFocused()
    await expect(last).toBeInViewport({ ratio: 1 })
    // the focused item is the one on top at its centre (not under another layer)
    const top = await last.evaluate((e) => {
      const r = e.getBoundingClientRect()
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[role="menuitem"]') === e
    })
    expect(top).toBe(true)
  })
}

test('a view, « Vue d’ensemble » or « Cadrer la sélection » chosen in the menu hands focus to the 3D view (arrows then orbit)', async ({ page }) => {
  await boot(page)
  const canvas = page.locator('#renderCanvas')
  await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter') // « Droite »
  await expect(canvas).toBeFocused()
  const a0 = (await camera(page)).alpha
  // held, not tapped: Babylon's keyboard orbit reads the keys down at each frame (a tap within one frame is lost under load)
  await page.keyboard.down('ArrowLeft')
  await expect.poll(async () => (await camera(page)).alpha).not.toBeCloseTo(a0, 3)
  await page.keyboard.up('ArrowLeft')
  for (const name of [/Vue d’ensemble/, /Cadrer la sélection/]) {
    await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
    await page.getByRole('menuitem', { name }).click()
    await expect(canvas).toBeFocused()
  }
  // other items keep the menubar return (APG)
  await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Panneau Propriétés' }).click()
  await expect(page.locator('#cr-menu-vue')).toBeFocused()
})

test('picker: Home / End go to the row ends, Ctrl+Home / Ctrl+End to the poles; names break after the dot; the current view has an Ambre bar', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('arriere'))
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('v')
  const grid = page.getByRole('dialog', { name: 'Choisir une vue' }).getByRole('grid')
  const norm = async () => (await focusedName(page))?.replace(/ /g, ' ')
  expect(await norm()).toBe('Arrière')
  await page.keyboard.press('Home')
  expect(await norm()).toBe('Face')
  await page.keyboard.press('End')
  expect(await norm()).toBe('Face · Gauche')
  await page.keyboard.press('Control+Home')
  expect(await norm()).toBe('Dessus')
  await page.keyboard.press('Home') // a pole is its own row
  expect(await norm()).toBe('Dessus')
  await page.keyboard.press('Control+End')
  expect(await norm()).toBe('Dessous')
  await page.keyboard.press('ArrowUp') // leaving the pole: back to the last azimuth (End → az 7)
  expect(await norm()).toBe('Dessous · Face · Gauche')
  // a no-break space before each « · »: a line never starts with the dot
  const t = await grid.getByRole('button', { name: 'Dessous · Face · Droite' }).textContent()
  expect(t).toBe('Dessous · Face · Droite')
  // the current view: a full-width Ambre bar ≥ 3 px at the bottom of its cell
  const cur = grid.locator('[aria-current="true"]')
  const bar = await cur.evaluate((e) => {
    const s = getComputedStyle(e, '::after')
    return { h: parseFloat(s.height), w: parseFloat(s.width), bg: s.backgroundColor, cell: e.getBoundingClientRect().width }
  })
  expect(bar.h).toBeGreaterThanOrEqual(3)
  expect(bar.w).toBeGreaterThan(bar.cell - 4)
  expect(bar.bg).toBe('rgb(221, 147, 73)')
})

test('Échap dismisses the cube hover caption (WCAG 1.4.13) without moving the camera; the Esc chain still clears the selection', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 4] }))
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('face'))
  const canvas = page.locator('#renderCanvas')
  await canvas.focus()
  await page.keyboard.press(']')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  const before = await camera(page)
  const r = await page.evaluate(() => window.__creation!.cubeRect())
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2)
  const cap = page.getByTestId('view-cube-caption')
  await expect(cap).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(cap).toBeHidden()
  expect(await camera(page)).toEqual(before)
  expect(await page.evaluate(() => window.__creation!.selection())).toBeNull()
  // the same zone stays dismissed while hovered; another zone brings the caption back
  await page.mouse.move(r.x + r.width / 2 + 1, r.y + r.height / 2)
  await expect(cap).toBeHidden()
  const other = await page.evaluate((rr) => {
    const c = window.__creation!
    for (let y = rr.y + 2; y < rr.y + rr.height; y += 2)
      for (let x = rr.x + 2; x < rr.x + rr.width; x += 2) if (c.cubeZoneAt(x, y) === 'dessus-face') return { x, y }
    return null
  }, r)
  await page.mouse.move(other!.x + 10, other!.y + 3)
  await expect.poll(() => page.evaluate(() => window.__creation!.cubeHover())).toBe('dessus-face')
  await expect(cap).toBeVisible()
  await expect(cap).toHaveText('Dessus · Face')
})

test('L7: a view picked while an orbit flick still coasts lands exactly (inertia stopped)', async ({ page }) => {
  await boot(page, false) // full motion: inertia only exists with motion on
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('face'))
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  const v = (await page.getByTestId('viewport').boundingBox())!
  const cx = v.x + v.width / 2
  const cy = v.y + v.height / 2
  // a fast flick on the canvas
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let i = 1; i <= 4; i++) await page.mouse.move(cx + i * 70, cy + i * 8)
  await page.mouse.up()
  expect(await page.evaluate(() => window.__creation!.cameraMoving())).toBe(true)
  await page.keyboard.press('v')
  await page.keyboard.press('ArrowUp')
  const target = await page.evaluate(() => (document.activeElement as HTMLElement).dataset.zone!)
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving()), { timeout: 5000 }).toBe(false)
  const g = await gap(page, zone(target))
  console.log(`[L7] residual drift alpha ${g.alpha.toFixed(4)} beta ${g.beta.toFixed(4)} rad`)
  expect(g.alpha).toBeLessThan(0.01)
  expect(g.beta).toBeLessThan(0.01)
})
