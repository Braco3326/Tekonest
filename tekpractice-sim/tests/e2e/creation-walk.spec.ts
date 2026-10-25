/**
 * Task 19 (C11, S6): walking in Mode Création. Vue › Marcher / Maj+V (3D view focused),
 * Esc or Maj+V back to Orbit; ear height 1.2 m seated (default) / 1.7 m standing (Écoute),
 * kept across reloads; render on demand: a `walk` lease only while the walker moves, 0 renders
 * at idle in walk view and in Orbit after it; a place change while walking goes back to Orbit
 * and leaks nothing. Movement keys are HELD and polled (a tap can fall inside one frame).
 */
import { expect, test, type Page } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })

const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
}
const view = (page: Page) => page.evaluate(() => window.__creation!.view())
const walkCam = (page: Page) => page.evaluate(() => window.__creation!.walkCamera())
const leases = (page: Page) => page.evaluate(() => window.__creation!.leases())
const renders = (page: Page) => page.evaluate(() => window.__creation!.renders())
/** Renders during `ms` with nothing touched (after a short settle). */
const idleRenders = async (page: Page, ms = 2000): Promise<number> => {
  await page.waitForTimeout(300)
  const r0 = await renders(page)
  await page.waitForTimeout(ms)
  return (await renders(page)) - r0
}

test('Maj+V walks (3D view focused), the cube hides, Maj+V and Échap go back to Orbit', async ({ page }) => {
  await boot(page)
  const canvas = page.locator('#renderCanvas')
  await canvas.focus()
  expect(await view(page)).toBe('orbit')
  await page.keyboard.press('Shift+V')
  await expect.poll(() => view(page)).toBe('explore')
  await expect(page.getByTestId('view-cube')).toBeHidden()
  await expect(page.getByRole('status')).toContainText('Marche')
  await expect(canvas).toHaveAttribute('aria-label', /en marche/)
  expect(await page.evaluate(() => window.__creation!.activeCameraIsMain())).toBe(false)
  // V (the view picker) is off while walking
  await page.keyboard.press('v')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.keyboard.press('Shift+V')
  await expect.poll(() => view(page)).toBe('orbit')
  await expect(page.getByTestId('view-cube')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('orbite')
  expect(await page.evaluate(() => window.__creation!.activeCameraIsMain())).toBe(true)
  // Échap: walk → Orbit
  await page.keyboard.press('Shift+V')
  await expect.poll(() => view(page)).toBe('explore')
  await page.keyboard.press('Escape')
  await expect.poll(() => view(page)).toBe('orbit')
  await expect(canvas).toBeFocused()
})

test('Maj+V acts only on the 3D view (WCAG 2.1.4), never on a button or under the place picker', async ({ page }) => {
  await boot(page)
  await page.getByTestId('tree-collapse').focus()
  await page.keyboard.press('Shift+V')
  await page.waitForTimeout(200)
  expect(await view(page)).toBe('orbit')
  await page.getByRole('menuitem', { name: 'Lieu' }).click()
  await page.getByRole('menuitem', { name: 'Choisir un lieu…' }).click()
  await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
  await expect(page.getByRole('menuitemcheckbox', { name: /Marcher/ })).toHaveAttribute('aria-disabled', 'true')
})

test('Vue › Marcher (menu, checkbox) walks and hands focus to the 3D view; « Vue d’ensemble » goes back to Orbit', async ({ page }) => {
  await boot(page)
  const canvas = page.locator('#renderCanvas')
  const open = await page.evaluate(() => window.__creation!.camera()!)
  await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
  const marcher = page.getByRole('menuitemcheckbox', { name: /Marcher/ })
  await expect(marcher).toContainText('Maj+V')
  await expect(marcher).toHaveAttribute('aria-checked', 'false')
  await marcher.click()
  await expect.poll(() => view(page)).toBe('explore')
  await expect(canvas).toBeFocused()
  await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
  await expect(page.getByRole('menuitemcheckbox', { name: /Marcher/ })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('menuitem', { name: /Choisir une vue…/ })).toHaveAttribute('aria-disabled', 'true')
  await page.getByRole('menuitem', { name: /Vue d’ensemble/ }).click()
  await expect.poll(() => view(page)).toBe('orbit')
  const c = await page.evaluate(() => window.__creation!.camera()!)
  expect(Math.abs(c.alpha - open.alpha)).toBeLessThan(0.02)
  expect(Math.abs(c.beta - open.beta)).toBeLessThan(0.02)
})

test('keyboard only: arrows and WASD (by code) walk and turn; a `walk` lease only while a key is held; 0 renders at idle', async ({ page }) => {
  await boot(page)
  const canvas = page.locator('#renderCanvas')
  await canvas.focus()
  await page.keyboard.press('Shift+V')
  await expect.poll(() => view(page)).toBe('explore')
  expect(await idleRenders(page)).toBe(0) // walk view, no key held
  expect(await leases(page)).not.toContain('walk')

  for (const code of ['ArrowUp', 'KeyW', 'KeyS', 'KeyA', 'KeyD']) {
    const p0 = (await walkCam(page))!
    await page.keyboard.down(code)
    await expect.poll(() => leases(page)).toContain('walk')
    await expect
      .poll(async () => {
        const p = (await walkCam(page))!
        return Math.hypot(p.x - p0.x, p.z - p0.z)
      }, { message: code })
      .toBeGreaterThan(0.05)
    await page.keyboard.up(code)
    await expect.poll(() => leases(page), { message: code }).not.toContain('walk')
  }
  const y0 = (await walkCam(page))!.yaw
  await page.keyboard.down('ArrowLeft')
  await expect.poll(async () => Math.abs((await walkCam(page))!.yaw - y0)).toBeGreaterThan(0.05)
  await page.keyboard.up('ArrowLeft')
  await expect.poll(() => leases(page)).not.toContain('walk')
  expect(await idleRenders(page)).toBe(0) // walked, then at rest
  // back to Orbit: idle there too (the walker's tick is gone)
  await page.keyboard.press('Escape')
  await expect.poll(() => view(page)).toBe('orbit')
  expect(await idleRenders(page)).toBe(0)
})

test('ear height: seated 1.2 m by default; Écoute › debout puts the walk camera at floor + 1.7 m; kept after a reload', async ({ page }) => {
  await boot(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Shift+V')
  await expect.poll(() => view(page)).toBe('explore')
  let w = (await walkCam(page))!
  expect(w.y - w.floor).toBeCloseTo(1.2, 3)
  await page.getByRole('menuitem', { name: 'Écoute' }).click()
  await expect(page.getByRole('menuitemradio', { name: /assis 1,2 m/ })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('menuitemradio', { name: /debout 1,7 m/ }).click()
  await expect.poll(async () => {
    const c = (await walkCam(page))!
    return c.y - c.floor
  }).toBeCloseTo(1.7, 3)
  await expect(page.getByRole('status')).toContainText('debout 1,7 m')
  expect(await view(page)).toBe('explore') // the setting does not leave the walk
  // not undoable: nothing in the history
  expect(await page.evaluate(() => window.__creation!.historySize())).toBe(0)

  await page.reload()
  await page.waitForFunction(() => !!window.__creation && window.__creation.place() !== null)
  expect(await page.evaluate(() => window.__creation!.earHeight())).toBe(1.7)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Shift+V')
  await expect.poll(() => view(page)).toBe('explore')
  w = (await walkCam(page))!
  expect(w.y - w.floor).toBeCloseTo(1.7, 3)
  await page.getByRole('menuitem', { name: 'Écoute' }).click()
  await expect(page.getByRole('menuitemradio', { name: /debout 1,7 m/ })).toHaveAttribute('aria-checked', 'true')
})

test('a place change while walking goes back to Orbit and leaks nothing (listeners, scenes, lease)', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await page.waitForTimeout(200)
  const orbitListeners = await page.evaluate(() => window.__creation!.liveListeners())
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Shift+V')
  await expect.poll(() => view(page)).toBe('explore')
  expect(await page.evaluate(() => window.__creation!.liveListeners())).toBeGreaterThan(orbitListeners)
  // a key held while the place goes
  await page.keyboard.down('ArrowUp')
  await expect.poll(() => leases(page)).toContain('walk')
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await page.keyboard.up('ArrowUp')
  expect(await view(page)).toBe('orbit')
  expect(await leases(page)).not.toContain('walk')
  expect(await page.evaluate(() => window.__creation!.liveListeners())).toBe(orbitListeners)
  expect(await page.evaluate(() => window.__creation!.scenes())).toBe(1)
  await expect(page.getByTestId('view-cube')).toBeVisible()
  expect(await idleRenders(page)).toBe(0)
  // and the walk works again in the new place
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Shift+V')
  await expect.poll(() => view(page)).toBe('explore')
  const w = (await walkCam(page))!
  expect(w.y - w.floor).toBeCloseTo(1.2, 3)
})
