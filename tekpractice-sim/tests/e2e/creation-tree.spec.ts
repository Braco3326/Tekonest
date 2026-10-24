import { expect, test, type Page } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })

const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
}
const distToBody = (page: Page, id: string) =>
  page.evaluate((id) => {
    const c = window.__creation!
    const t = c.camera()!.target
    const b = c.deviceBodyCenter(id)!
    return Math.hypot(t[0] - b[0], t[1] - b[1], t[2] - b[2])
  }, id)

test('keyboard: the tree selects QL1 and the camera cuts to it (reduced motion); the eye hides / shows it, no undo entry', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] }))
  const tree = page.getByRole('tree', { name: 'Projet' })
  await expect(tree.getByRole('treeitem')).toHaveCount(5)

  // one tab stop: the roving row
  await tree.locator('[role="treeitem"][tabindex="0"]').focus()
  await expect(tree.getByRole('treeitem', { name: /^Lieu/ })).toBeFocused()
  await page.keyboard.press('ArrowDown') // Zones
  await page.keyboard.press('ArrowDown') // Matériel
  const gear = tree.getByRole('treeitem', { name: /^Matériel/ })
  await expect(gear).toBeFocused()
  await expect(gear).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('ArrowRight')
  await expect(gear).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('ArrowDown')
  const row = tree.getByRole('treeitem', { name: 'Yamaha QL1 (ql1)' })
  await expect(row).toBeFocused()
  expect(await tree.locator('[role="treeitem"][tabindex="0"]').count()).toBe(1)

  await page.keyboard.press('Enter')
  // Reduced motion = a cut: asserted at once, no poll a 450 ms flight could also pass.
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  expect(await distToBody(page, 'ql1')).toBeLessThan(0.3)
  await expect(row).toHaveAttribute('aria-selected', 'true')
  expect(await page.evaluate(() => window.__creation!.outlined())).toEqual(['ql1'])
  await expect(page.getByRole('status')).toHaveText('Sélectionné : Yamaha QL1')
  await expect(row).toBeFocused()

  // the eye: → reaches it from the row, a real named button
  const undo0 = await page.evaluate(() => window.__creation!.historySize())
  await page.keyboard.press('ArrowRight')
  const hide = page.getByRole('button', { name: 'Masquer Yamaha QL1 (ql1)' })
  await expect(hide).toBeFocused()
  await page.keyboard.press('Enter')
  expect(await page.evaluate(() => window.__creation!.visible('ql1'))).toBe(false)
  expect(await page.evaluate(() => window.__creation!.historySize())).toBe(undo0)
  await expect(page.getByRole('status')).toHaveText('Masqué : Yamaha QL1 (ql1)')
  const show = page.getByRole('button', { name: 'Afficher Yamaha QL1 (ql1)' })
  await expect(show).toBeFocused()
  await show.click()
  expect(await page.evaluate(() => window.__creation!.visible('ql1'))).toBe(true)
  expect(await page.evaluate(() => window.__creation!.historySize())).toBe(undo0)
  // ← goes back to the row
  await page.getByRole('button', { name: 'Masquer Yamaha QL1 (ql1)' }).focus()
  await page.keyboard.press('ArrowLeft')
  await expect(row).toBeFocused()
})

test('one selection: ] in the 3D view and a click on the device both select in the tree, with the Ambre outline', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] })
    c.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58', position: [2, 0, 6] })
  })
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press(']')
  const first = await page.evaluate(() => window.__creation!.selection())
  expect(first).not.toBeNull()
  expect(await distToBody(page, first!)).toBeLessThan(0.3) // [ ] flies too (a cut here)
  const tree = page.getByRole('tree', { name: 'Projet' })
  await expect(tree.locator('[aria-selected="true"]')).toHaveAttribute('data-node-id', `device:${first}`)
  expect(await page.evaluate(() => window.__creation!.outlined())).toEqual([first])

  // the same ] answer again is re-announced (cleared, then set on the next frame)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'REMOVE', instanceId: 'sm58' }))
  await page.keyboard.press(']')
  await page.keyboard.press(']')
  await expect(page.getByRole('status')).toHaveText('Sélectionné : Yamaha QL1')

  // a click on the device body (the camera is framed on it: the canvas centre)
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => window.__creation!.selection())).toBeNull()
  expect(await page.evaluate(() => window.__creation!.outlined())).toEqual([])
  const p = await page.evaluate(() => window.__creation!.deviceScreen('ql1')) // page coordinates
  await page.mouse.click(p!.x, p!.y)
  await expect.poll(() => page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  await expect(tree.getByRole('treeitem', { name: 'Yamaha QL1 (ql1)' })).toHaveAttribute('aria-selected', 'true')
})

test('Home / End, Left to the parent; a zone row frames the zone; hidden zone and cable stay view state', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] })
    c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [3, 0, -3] })
    c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } })
  })
  const tree = page.getByRole('tree', { name: 'Projet' })
  await tree.locator('[role="treeitem"][tabindex="0"]').focus()
  await page.keyboard.press('End')
  await expect(tree.getByRole('treeitem', { name: /^Points d’écoute/ })).toBeFocused()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowDown') // Zones
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight') // first zone
  const zone = tree.getByRole('treeitem', { name: 'scene' })
  await expect(zone).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(zone).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('status')).toHaveText('Cadré : scene')
  await page.keyboard.press('ArrowLeft')
  await expect(tree.getByRole('treeitem', { name: /^Zones/ })).toBeFocused()

  const undo0 = await page.evaluate(() => window.__creation!.historySize())
  await tree.getByRole('treeitem', { name: /^Câbles/ }).click() // opens the group
  await tree.getByRole('button', { name: 'Masquer ql1 out-main-l → k12-g in-line-a' }).click()
  await tree.getByRole('button', { name: 'Masquer scene' }).click()
  expect(await page.evaluate(() => window.__creation!.hidden())).toEqual(['cable:k12-g in-line-a|ql1 out-main-l', 'zone:scene'])
  await expect(tree.getByRole('treeitem', { name: 'scene masqué' })).toHaveCount(1) // the hidden state is read, not only struck through
  expect(await page.evaluate(() => window.__creation!.historySize())).toBe(undo0)
  // undo of the CONNECT drops the cable: its hidden key goes with it
  await page.evaluate(() => window.__creation!.undo())
  expect(await page.evaluate(() => window.__creation!.hidden())).toEqual(['zone:scene'])
})
