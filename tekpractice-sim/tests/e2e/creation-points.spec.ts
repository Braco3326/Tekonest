/**
 * Task 20: named listening points. The tree (« Points d’écoute » › Régie + Entrée), Vue › Aller au
 * point d’écoute and the keys 1 / 2 / 3 (by code, 3D view focused) stand the orbit camera on the
 * point, at floor + ear height, looking at the stage; the point becomes `viewState.listenerPoint`.
 * Reduced motion = a cut, so positions are asserted at once (no poll a 450 ms flight could pass).
 */
import { expect, test, type Page } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })

const boot = async (page: Page, place = 'room:concert-hall-medium'): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate((p) => window.__creation!.choosePlace(p), place)
  await page.waitForFunction((p) => window.__creation!.place() === p, place)
}
/** Where the orbit camera stands (ArcRotateCamera: target + r·(cos α sin β, cos β, sin α sin β)). */
const camPos = (page: Page) =>
  page.evaluate(() => {
    const c = window.__creation!.camera()!
    return [
      c.target[0] + c.radius * Math.cos(c.alpha) * Math.sin(c.beta),
      c.target[1] + c.radius * Math.cos(c.beta),
      c.target[2] + c.radius * Math.sin(c.alpha) * Math.sin(c.beta),
    ]
  })
const point = async (page: Page, id: string): Promise<number[]> =>
  (await page.evaluate(() => window.__creation!.listeningPoints())).find((p) => p.id === id)!.position
const distTo = async (page: Page, id: string): Promise<number> => {
  const [c, p] = [await camPos(page), await point(page, id)]
  return Math.hypot(c[0] - p[0], c[1] - p[1], c[2] - p[2])
}
const listener = (page: Page) => page.evaluate(() => window.__creation!.listenerPoint())

test('tree › Points d’écoute › Régie + Entrée: the camera stands on the Régie point (floor + 1.2 m), looking at the stage', async ({ page }) => {
  await boot(page)
  const pts = await page.evaluate(() => window.__creation!.listeningPoints())
  expect(pts.map((p) => p.label)).toEqual(['Régie', 'Premier rang', 'Fond de salle'])
  expect(pts[0].position).toEqual([0, 1.2, 8]) // concert-hall-medium: the foh zone centre, flat floor
  const tree = page.getByRole('tree', { name: 'Projet' })
  await tree.locator('[role="treeitem"][tabindex="0"]').focus()
  await page.keyboard.press('End')
  const group = tree.getByRole('treeitem', { name: /^Points d’écoute/ })
  await expect(group).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(group).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('ArrowDown')
  const regie = tree.getByRole('treeitem', { name: 'Régie' })
  await expect(regie).toBeFocused()
  const undo0 = await page.evaluate(() => window.__creation!.historySize())
  await page.keyboard.press('Enter')
  expect(await distTo(page, 'regie')).toBeLessThan(0.5)
  // looking at the stage end (−z): the target is in front of the camera, toward the stage
  const cam = (await page.evaluate(() => window.__creation!.camera()))!
  expect(cam.target[2]).toBeLessThan(0)
  await expect(regie).toHaveAttribute('aria-selected', 'true')
  await expect(regie).toBeFocused()
  await expect(page.getByRole('status')).toHaveText('Point d’écoute : Régie')
  expect(await listener(page)).toBe('regie')
  expect(await page.evaluate(() => window.__creation!.historySize())).toBe(undo0) // view state, never undoable
})

test('keys 1 / 2 / 3 (by code, 3D view focused): Régie, Premier rang, Fond de salle; never from a button', async ({ page }) => {
  await boot(page)
  const canvas = page.locator('#renderCanvas')
  await canvas.focus()
  await page.keyboard.press('Digit2')
  expect(await distTo(page, 'premier-rang')).toBeLessThan(0.5)
  expect(await listener(page)).toBe('premier-rang')
  await expect(page.getByRole('status')).toHaveText('Point d’écoute : Premier rang')
  await page.keyboard.press('Digit3')
  expect(await distTo(page, 'fond-de-salle')).toBeLessThan(0.5)
  expect(await listener(page)).toBe('fond-de-salle')
  await page.keyboard.press('Digit1')
  expect(await distTo(page, 'regie')).toBeLessThan(0.5)
  expect(await listener(page)).toBe('regie')
  // WCAG 2.1.4: a digit typed with focus elsewhere does nothing
  await page.getByTestId('tree-collapse').focus()
  await page.keyboard.press('Digit2')
  await page.waitForTimeout(150)
  expect(await listener(page)).toBe('regie')
  expect(await distTo(page, 'regie')).toBeLessThan(0.5)
})

test('Vue › Aller au point d’écoute: radio items with 1 / 2 / 3, the active point checked, focus to the 3D view', async ({ page }) => {
  await boot(page)
  await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
  await page.getByRole('menuitem', { name: /Aller au point d’écoute/ }).hover() // a submenu opens on hover (a click toggles it)
  const regie = page.getByRole('menuitemradio', { name: /Régie/ })
  const front = page.getByRole('menuitemradio', { name: /Premier rang/ })
  const back = page.getByRole('menuitemradio', { name: /Fond de salle/ })
  await expect(regie).toContainText('1')
  await expect(front).toContainText('2')
  await expect(back).toContainText('3')
  await expect(regie).toHaveAttribute('aria-checked', 'true') // default listening point
  await expect(back).toHaveAttribute('aria-checked', 'false')
  await back.click()
  await expect(page.locator('#renderCanvas')).toBeFocused()
  expect(await distTo(page, 'fond-de-salle')).toBeLessThan(0.5)
  await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
  await page.getByRole('menuitem', { name: /Aller au point d’écoute/ }).hover() // a submenu opens on hover (a click toggles it)
  await expect(page.getByRole('menuitemradio', { name: /Fond de salle/ })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('menuitemradio', { name: /Régie/ })).toHaveAttribute('aria-checked', 'false')
})

test('a point while walking goes back to Orbit first; the points follow the ear height (the camera on one moves up 0.5 m)', async ({ page }) => {
  await boot(page)
  const canvas = page.locator('#renderCanvas')
  await canvas.focus()
  await page.keyboard.press('Shift+V')
  await expect.poll(() => page.evaluate(() => window.__creation!.view())).toBe('explore')
  await page.keyboard.press('Digit1')
  await expect.poll(() => page.evaluate(() => window.__creation!.view())).toBe('orbit')
  expect(await distTo(page, 'regie')).toBeLessThan(0.5)
  const y12 = (await camPos(page))[1]
  await page.getByRole('menuitem', { name: 'Écoute' }).click()
  await page.getByRole('menuitemradio', { name: /debout 1,7 m/ }).click()
  expect((await point(page, 'regie'))[1]).toBeCloseTo(1.7, 6)
  await expect.poll(async () => (await camPos(page))[1] - y12).toBeCloseTo(0.5, 2)
  expect(await distTo(page, 'regie')).toBeLessThan(0.5)
})

test('review Fix 1: a place change resets the listening point to Régie; keys are fixed slots (a dropped point never renumbers)', async ({ page }) => {
  await boot(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Digit3')
  expect(await listener(page)).toBe('fond-de-salle')
  // tv-studio-plateau-large has no Premier rang (it would sit on the Régie): 2 is empty, 3 is still Fond de salle
  await page.evaluate(() => window.__creation!.choosePlace('room:tv-studio-plateau-large'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:tv-studio-plateau-large')
  expect(await listener(page)).toBe('regie')
  expect((await page.evaluate(() => window.__creation!.listeningPoints())).map((p) => p.id)).toEqual(['regie', 'fond-de-salle'])
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Digit2')
  await expect(page.getByRole('status')).toHaveText('Pas de point d’écoute 2 dans ce lieu.')
  expect(await listener(page)).toBe('regie')
  await page.keyboard.press('Digit3')
  expect(await listener(page)).toBe('fond-de-salle')
  expect(await distTo(page, 'fond-de-salle')).toBeLessThan(0.5)
  await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
  await page.getByRole('menuitem', { name: /Aller au point d’écoute/ }).hover()
  await expect(page.getByRole('menuitemradio', { name: /Fond de salle/ })).toContainText('3')
})

test('review Fix 1 (minor): a listening point is a room-level view: it clears the device selection, its tree row stays selected', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 4] }))
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press(']')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  const tree = page.getByRole('tree', { name: 'Projet' })
  await tree.getByRole('treeitem', { name: /^Points d’écoute/ }).click() // opens the group
  await page.keyboard.press('ArrowDown')
  const regie = tree.getByRole('treeitem', { name: 'Régie' })
  await expect(regie).toBeFocused()
  await page.keyboard.press('Enter')
  expect(await page.evaluate(() => window.__creation!.selection())).toBeNull()
  await expect(regie).toHaveAttribute('aria-selected', 'true')
  await expect(tree.locator('[aria-selected="true"]')).toHaveCount(1)
  await expect(page.getByRole('status')).toHaveText('Point d’écoute : Régie')
  expect(await distTo(page, 'regie')).toBeLessThan(0.5)
})

test('blank place: one « Centre » point (key 1); key 2 says there is none; off under the place picker', async ({ page }) => {
  await boot(page, 'blank')
  const pts = await page.evaluate(() => window.__creation!.listeningPoints())
  expect(pts.map((p) => [p.id, p.label])).toEqual([['centre', 'Centre']])
  const canvas = page.locator('#renderCanvas')
  await canvas.focus()
  await page.keyboard.press('Digit1')
  expect(await distTo(page, 'centre')).toBeLessThan(0.5)
  await expect(page.getByRole('status')).toHaveText('Point d’écoute : Centre')
  // the active point falls back to the place's first one (the default id is « regie »)
  await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
  await page.getByRole('menuitem', { name: /Aller au point d’écoute/ }).hover() // a submenu opens on hover (a click toggles it)
  await expect(page.getByRole('menuitemradio', { name: /Centre/ })).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await canvas.focus()
  await page.keyboard.press('Digit2')
  await expect(page.getByRole('status')).toHaveText('Pas de point d’écoute 2 dans ce lieu.')
  // under the place picker: the menu items are off
  await page.getByRole('menuitem', { name: 'Lieu' }).click()
  await page.getByRole('menuitem', { name: 'Choisir un lieu…' }).click()
  await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: /Aller au point d’écoute/ })).toHaveAttribute('aria-disabled', 'true')
})
