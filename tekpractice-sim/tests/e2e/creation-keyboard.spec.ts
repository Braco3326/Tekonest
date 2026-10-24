import { expect, test } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })
test('from a fresh load, Tab walks skip link → menubar → tree → canvas → properties → status, each with a visible ring', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/'); await page.waitForFunction(() => !!window.__creation); await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.evaluate(() => document.body.focus())
  const seen: string[] = []
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement
      // The region, not a control's own test id (the collapse buttons carry `tree-collapse` / `props-collapse`).
      const regions = ['skip-link', 'menubar', 'project-tree', 'viewport', 'properties', 'status-bar']
      const zone = el.closest(regions.map((r) => `[data-testid="${r}"]`).join(','))?.getAttribute('data-testid') ?? el.id
      // A tree row's ring is drawn on its own row box (a treeitem wraps its children, Task 9).
      const cs = getComputedStyle(el.getAttribute('role') === 'treeitem' ? (el.querySelector(':scope > .cr-tree-item') as HTMLElement) : el)
      return { zone, out: !el || el === document.body, ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 }
    })
    // Past the last stop the browser takes focus out of the page (to its own UI): the walk is over.
    if (info.out) break
    expect(info.ring, `focus ring on ${info.zone}`).toBe(true)
    if (seen[seen.length - 1] !== info.zone) seen.push(info.zone)
  }
  const order = ['skip-link', 'menubar', 'project-tree', 'viewport', 'properties', 'status-bar']
  expect(seen.filter((z) => order.includes(z)).slice(0, 6)).toEqual(order)
})
test('[ and ] cycle devices only while the canvas has focus; Ctrl+Z undoes', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => !!window.__creation); await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.evaluate(() => { window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1' }); window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58' }) })
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press(']')
  const first = await page.evaluate(() => window.__creation!.selection())
  await page.keyboard.press(']')
  expect(await page.evaluate(() => window.__creation!.selection())).not.toBe(first)
  await page.keyboard.press('Control+z')
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(1)
})

test('the canvas keys work as its label says: arrows orbit, ] selects (announced), Entrée frames; one h1; menus show shortcuts', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/'); await page.waitForFunction(() => !!window.__creation); await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.locator('h1')).toHaveText('TekPractice, Mode Création')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 4] }))
  const canvas = page.locator('#renderCanvas')
  await expect(canvas).toHaveAttribute('aria-label', /flèches = orbiter, \[ \] = appareil suivant\/précédent, Entrée = cadrer/)

  // ] off the canvas does nothing
  await page.getByTestId('tree-collapse').focus()
  await page.keyboard.press(']')
  expect(await page.evaluate(() => window.__creation!.selection())).toBeNull()

  // arrows orbit
  await canvas.focus()
  const a0 = (await page.evaluate(() => window.__creation!.camera()))!.alpha
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft')
  await expect.poll(async () => (await page.evaluate(() => window.__creation!.camera()))!.alpha).not.toBeCloseTo(a0, 3)

  // ] selects and the status bar announces it
  await page.keyboard.press(']')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  await expect(page.getByRole('status')).toHaveText('Sélectionné : Yamaha QL1')

  // Entrée frames the selection (reduced motion = a cut)
  await page.keyboard.press('Enter')
  await expect.poll(async () => {
    const t = (await page.evaluate(() => window.__creation!.camera()))!.target
    return Math.hypot(t[0] - 0, t[2] - 4)
  }).toBeLessThan(0.6)
  await expect(canvas).toBeFocused()

  // Échap clears the selection
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => window.__creation!.selection())).toBeNull()

  // Projet menu shows the live key map
  await page.getByRole('menuitem', { name: 'Projet' }).click()
  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitem', { name: /Annuler/ })).toContainText('Ctrl+Z')
  await expect(menu.getByRole('menuitem', { name: /Rétablir/ })).toContainText('Ctrl+Y')
  // focus leaving the open menu closes it, without the focus key being taken
  await page.keyboard.press('Tab')
  await expect(page.getByRole('menu')).toHaveCount(0)
})
