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
  // choosePlace resolves on dispatch; the scene (and so a selectable device) is there once place() reports it
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
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
  // held, not tapped: Babylon's keyboard orbit reads the keys down at each frame (a tap within one frame is lost under load)
  await page.keyboard.down('ArrowLeft')
  await expect.poll(async () => (await page.evaluate(() => window.__creation!.camera()))!.alpha).not.toBeCloseTo(a0, 3)
  await page.keyboard.up('ArrowLeft')

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

// ── Night 2 wave 5, P2-2: a single arrow tap must turn the camera on a slow PC ────────────────────────────────────────────────────────────────
// Measured live (SwiftShader, 15-20 fps): ONE ArrowLeft turned the camera by 0 rad, held 400 ms by 1.58 rad: Babylon reads the keys that are down when a frame renders.
// A fixed step per tap now (about 3.8 degrees = what one default frame gives), the hold is Babylon's own and unchanged, nothing is counted twice.
const STEP = 0.01 / (1 - 0.85)
const alpha = (page: import('@playwright/test').Page): Promise<number> => page.evaluate(() => window.__creation!.camera()!.alpha)
const settleCamera = async (page: import('@playwright/test').Page): Promise<void> => {
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
}
const bootCamera = async (page: import('@playwright/test').Page, reduced: boolean): Promise<void> => {
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await page.locator('#renderCanvas').focus()
  await settleCamera(page)
}
for (const reduced of [true, false]) {
  test.describe(reduced ? 'reduced motion' : 'normal motion', () => {
    test('a tap released before any frame (a slow PC, emulated: keydown and keyup in one task) still turns the camera by one step, both ways', async ({ page }) => {
      await bootCamera(page, reduced)
      const a0 = await alpha(page)
      const r0 = await page.evaluate(() => window.__creation!.renders())
      await page.evaluate(() => {
        const c = document.querySelector('#renderCanvas')!
        const key = (type: string, code: number, name: string) => c.dispatchEvent(new KeyboardEvent(type, { key: name, code: name, keyCode: code, bubbles: true, cancelable: true }))
        key('keydown', 37, 'ArrowLeft')
        key('keyup', 37, 'ArrowLeft') // no frame can run between the two: the old behaviour turned by 0
      })
      await settleCamera(page)
      const a1 = await alpha(page)
      expect(Math.abs(a1 - a0), `one tap = one step (${STEP.toFixed(4)} rad)`).toBeGreaterThan(STEP * 0.9)
      expect(Math.abs(a1 - a0)).toBeLessThan(STEP * 1.1)
      expect(a1 < a0, 'ArrowLeft turns alpha down').toBe(true)
      expect(await page.evaluate(() => window.__creation!.renders())).toBeGreaterThan(r0) // and the camera was drawn
      await page.evaluate(() => {
        const c = document.querySelector('#renderCanvas')!
        const key = (type: string) => c.dispatchEvent(new KeyboardEvent(type, { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, bubbles: true, cancelable: true }))
        key('keydown')
        key('keyup')
      })
      await settleCamera(page)
      expect(Math.abs((await alpha(page)) - a0), 'and back by one step the other way').toBeLessThan(STEP * 0.1)
    })

    test('a real 30 ms tap with the CPU throttled (6x) turns the camera by the step: one per frame the key was down, at least one, never a burst', async ({ page }) => {
      await bootCamera(page, reduced)
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 })
      const a0 = await alpha(page)
      const r0 = await page.evaluate(() => window.__creation!.renders())
      await page.keyboard.down('ArrowLeft')
      await page.waitForTimeout(30) // a 30 ms tap: the finger is up before a slow frame (or after one or two, on a loaded machine)
      const r1 = await page.evaluate(() => window.__creation!.renders())
      await page.keyboard.up('ArrowLeft')
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
      await settleCamera(page)
      const d = Math.abs((await alpha(page)) - a0)
      // frames seen while down: Babylon's step each; none seen: our one step. A frame may run between the read and the release (+1), never a tap step on top of the frames.
      const frames = Math.max(1, r1 - r0)
      expect(d, 'turned').toBeGreaterThan(STEP * 0.9)
      expect(d, `one step per frame the key was down (${frames}), at most one more`).toBeLessThan(STEP * (frames + 1.2))
    })
  })
}

test('holding an arrow still orbits continuously, one step per frame it is down (no double count), and stops on keyup', async ({ page }) => {
  await bootCamera(page, false)
  const a0 = await alpha(page)
  // keydown and keyup are dispatched from this task and the frames between are counted in the same task: the number of frames the key was down is exact
  const frames = await page.evaluate(async () => {
    const c = document.querySelector('#renderCanvas')!
    const key = (type: string) => c.dispatchEvent(new KeyboardEvent(type, { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, bubbles: true, cancelable: true }))
    const r0 = window.__creation!.renders()
    key('keydown')
    await new Promise((res) => setTimeout(res, 500))
    const during = window.__creation!.renders() - r0
    key('keyup')
    return during
  })
  await settleCamera(page)
  const a1 = await alpha(page)
  expect(frames, 'it rendered while held').toBeGreaterThan(3)
  expect(a1 - a0, 'turned by one step per frame held').toBeGreaterThan(STEP * (frames - 0.6))
  expect(a1 - a0, 'and not one step more (a tap step on top of the frames would be a double count)').toBeLessThan(STEP * (frames + 0.6))
  // stopped: nothing moves any more once released and settled
  const rest = await alpha(page)
  await page.waitForTimeout(400)
  expect(await alpha(page)).toBe(rest)
})

test('Ctrl + arrow (pan) and a tap in a text field do not turn the camera by a step', async ({ page }) => {
  await bootCamera(page, false)
  const a0 = await alpha(page)
  await page.evaluate(() => {
    const c = document.querySelector('#renderCanvas')!
    c.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, ctrlKey: true, bubbles: true }))
    c.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, ctrlKey: true, bubbles: true }))
  })
  await settleCamera(page)
  expect(Math.abs((await alpha(page)) - a0)).toBeLessThan(STEP * 0.1)
})
