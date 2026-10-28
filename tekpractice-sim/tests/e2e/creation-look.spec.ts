/**
 * Task 14b « Look 3D Mode Création »: the viewport in the chrome's palette.
 * Screenshots (blank room, the « Concert simple (référence) » template, a
 * selected device) at 1366×768 and 1920×1080 are written to the git-ignored
 * test-results/screens/ (as Task 14): a run never rewrites the reviewed copies
 * committed under docs/creative/screens/task-14b-*.png; refresh those by hand.
 * Plus: hover is Papier and never the selection, and costs no idle frame.
 */
import { expect, test, type Page } from '@playwright/test'

const SHOTS = 'test-results/screens'

const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' }) // camera flights are cuts: stable shots
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await expect(page.getByTestId('place-picker')).toBeVisible()
}

/** Pointer off the canvas, .glb loads done, render loop idle. */
const settle = async (page: Page): Promise<void> => {
  await page.mouse.move(2, 2)
  await page.evaluate(() => document.fonts.ready)
  await expect
    .poll(
      async () => {
        const a = await page.evaluate(() => window.__creation!.renders())
        await page.waitForTimeout(400)
        return (await page.evaluate(() => window.__creation!.renders())) - a
      },
      { timeout: 15000 }
    )
    .toBe(0)
}

/** RGB of page pixels (CSS px) in a screenshot, decoded in the page (no PNG dependency). */
const pixels = async (
  page: Page,
  png: Buffer,
  at: { x: number; y: number }[]
): Promise<number[][]> =>
  page.evaluate(
    async ({ b64, pts }) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const cv = document.createElement('canvas')
      cv.width = img.width
      cv.height = img.height
      const ctx = cv.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const k = img.width / window.innerWidth
      return pts.map((p) => [
        ...ctx.getImageData(Math.round(p.x * k), Math.round(p.y * k), 1, 1).data.slice(0, 3),
      ])
    },
    { b64: png.toString('base64'), pts: at }
  )

const template = async (page: Page): Promise<void> => {
  await page
    .getByTestId('template-grid')
    .getByRole('option', { name: /Concert simple/ })
    .click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await page.waitForFunction(() => !!window.__creation!.deviceScreen('k12-g'))
}

for (const [w, h] of [
  [1366, 768],
  [1920, 1080],
] as const) {
  test(`screenshots ${w}×${h}: blank room, template, selected device`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await boot(page)
    await page.evaluate(() => window.__creation!.choosePlace('blank'))
    await page.waitForFunction(() => window.__creation!.place() === 'blank')
    await settle(page)
    await page.screenshot({ path: `${SHOTS}/task-14b-blank-${w}x${h}.png` })

    await page.getByRole('menuitem', { name: 'Lieu' }).click()
    await page.getByRole('menuitem', { name: 'Choisir un lieu…' }).click()
    await template(page)
    await settle(page)
    await page.screenshot({ path: `${SHOTS}/task-14b-template-${w}x${h}.png` })

    // select a device with a click in the 3D view (the pick path), the camera cuts to it
    const first = await page.evaluate(() => window.__creation!.design().rig.instances[0].instanceId)
    // A port's hit area is >= 12 px (Task 26): click a body point outside every port's hit area, so the click is the body's.
    const p = (await page.evaluate((id) => window.__creation!.bodyPointAway(id, 14), first))!
    expect(p, 'a body point outside every port hit area').not.toBeNull()
    await page.mouse.click(p.x, p.y)
    await expect.poll(() => page.evaluate(() => window.__creation!.selection())).toBe(first)
    expect(await page.evaluate(() => window.__creation!.outlined())).toEqual([first])
    await settle(page) // idle reached with the HighlightLayer stroke active
    const r0 = await page.evaluate(() => window.__creation!.renders())
    await page.waitForTimeout(1500)
    expect(
      await page.evaluate(() => window.__creation!.renders()),
      'idle = 0 renders with a .glb selected'
    ).toBe(r0)
    await page.screenshot({ path: `${SHOTS}/task-14b-selected-${w}x${h}.png` })
  })
}

test("accented panel titles use Plex, not Tektur (« PROPRIÉTÉS », « Aucune sélection »: Tektur's acute reads as a macron)", async ({
  page,
}) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  for (const sel of ['.cr-panel-title', '.cr-props-title'])
    expect(
      await page
        .locator(sel)
        .first()
        .evaluate((e) => getComputedStyle(e).fontFamily),
      sel
    ).toMatch(/^'?"?IBM Plex Sans/)
  await expect(page.locator('.cr-props .cr-panel-title')).toHaveText(/Propriétés/i)
})

test('placeholder look (a .glb that fails): token body, family top tint, port markers, Plex labels', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.route('**/assets/yamaha-ql1.glb', (r) => r.abort())
  await boot(page)
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await page.evaluate(() =>
    window.__creation!.dispatch({
      type: 'SPAWN',
      deviceId: 'yamaha-ql1',
      instanceId: 'ql1',
      position: [0, 0, 0],
    })
  )
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press(']') // select + frame it
  await expect.poll(() => page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  await settle(page)
  const shot = await page.screenshot({
    path: `${SHOTS}/task-14b-placeholder-selected-1366x768.png`,
  })
  // Fix 1 (critical): the selected body is washed, never painted solid Ambre. Sample the front face
  // at its centre height, left of the port grid (markers / labels are coloured on purpose).
  const c = (await page.evaluate(() => window.__creation!.deviceBodyCenter('ql1')))!
  const at = (await page.evaluate((p) => window.__creation!.worldScreen(p), [
    c[0] - 0.45,
    c[1],
    c[2],
  ] as [number, number, number]))!
  const centre = (await page.evaluate((p) => window.__creation!.worldScreen(p), c))!
  const [body, mid] = await pixels(page, shot, [at, centre])
  const AMBRE = [0xdd, 0x93, 0x49]
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  expect(dist(body, AMBRE), `body pixel ${body}`).toBeGreaterThan(80)
  expect(dist(mid, AMBRE), `centre pixel ${mid}`).toBeGreaterThan(40)
  // the selection stroke (HighlightLayer) costs no idle frame
  const r0 = await page.evaluate(() => window.__creation!.renders())
  await page.waitForTimeout(1500)
  expect(await page.evaluate(() => window.__creation!.renders())).toBe(r0)
  expect(await page.evaluate(() => window.__creation!.outlined())).toEqual(['ql1'])
  await page.keyboard.press('Escape')
  await expect.poll(() => page.evaluate(() => window.__creation!.selection())).toBeNull()
  await settle(page)
  await page.screenshot({ path: `${SHOTS}/task-14b-placeholder-1366x768.png` })
})

test('hover: Papier outline on the device under the pointer, never the selection; idle after = 0 renders', async ({
  page,
}) => {
  await boot(page)
  await template(page)
  await settle(page)
  const p = (await page.evaluate(() => window.__creation!.deviceScreen('k12-g')))!
  await page.mouse.move(p.x, p.y)
  await expect.poll(() => page.evaluate(() => window.__creation!.hovered())).toBe('k12-g')
  expect(await page.evaluate(() => window.__creation!.outlined())).toEqual([]) // hover is not a selection
  expect(await page.evaluate(() => window.__creation!.selection())).toBeNull()
  // the pointer rests on the device: no frame while nothing moves
  await expect
    .poll(
      async () => {
        const a = await page.evaluate(() => window.__creation!.renders())
        await page.waitForTimeout(400)
        return (await page.evaluate(() => window.__creation!.renders())) - a
      },
      { timeout: 15000 }
    )
    .toBe(0)
  const r0 = await page.evaluate(() => window.__creation!.renders())
  await page.waitForTimeout(1500)
  expect(await page.evaluate(() => window.__creation!.renders())).toBe(r0)
  // leaving the canvas clears it
  await page.mouse.move(2, 2)
  await expect.poll(() => page.evaluate(() => window.__creation!.hovered())).toBeNull()
})
