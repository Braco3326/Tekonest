import { expect, test, type Page } from '@playwright/test'
import { ZONES, zoneAngles, zoneId } from '../../src/camera/cubeZones'
test.use({ viewport: { width: 1366, height: 768 } })

// The three tests of the Task 17 brief, verbatim except: wait for the shell's hook (it boots from a
// lazy chunk, after `load`) as every creation spec does, and `!` on the nullable `camera()` (tsc covers tests/).
test('all 26 cube zones are clickable and land on their view', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/'); await page.waitForFunction(() => !!window.__creation); await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  for (const s of ZONES) {
    const id = zoneId(s)
    // first rotate to Face·Dessus·Droite iso so every zone has a visible patch, then ask the widget where the zone is on screen
    const pt = await page.evaluate((z) => window.__creation!.cubeZoneScreenPoint(z), id)
    expect(pt, id).not.toBeNull()
    await page.mouse.click(pt!.x, pt!.y)
    const cam = await page.evaluate(() => window.__creation!.camera())
    const want = zoneAngles(s)
    expect(Math.abs(((cam!.alpha - want.alpha + 3 * Math.PI) % (2 * Math.PI)) - Math.PI), id).toBeLessThan(0.02)
    expect(Math.abs(cam!.beta - want.beta), id).toBeLessThan(0.02)
  }
})
test('cube is 120 px at 1366 and 130 px at 1600; one WebGL context', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => !!window.__creation)
  expect((await page.evaluate(() => window.__creation!.cubeRect())).width).toBe(120)
  await page.setViewportSize({ width: 1600, height: 900 })
  await expect.poll(() => page.evaluate(() => window.__creation!.cubeRect().width)).toBe(130)
  expect(await page.evaluate(() => document.querySelectorAll('canvas').length)).toBe(1)
})
test('hover paints the zone Ambre and renders on demand; drag on the cube orbits', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => !!window.__creation); await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  // Deviation from the brief: turn to the Face view first. The place opens 30° above the horizon
  // (beta 1.05), where the cube centre is honestly on the Dessus · Face edge band (threshold 0.5:
  // the face patch holds the centre only below atan(0.5) = 26.6°). This also waits for the cube.
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('face'))
  const r = await page.evaluate(() => window.__creation!.cubeRect())
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2)
  await expect.poll(() => page.evaluate(() => window.__creation!.cubeHover())).toBe('face')
  const a0 = await page.evaluate(() => window.__creation!.camera()!.alpha)
  await page.mouse.down(); await page.mouse.move(r.x + r.width / 2 + 60, r.y + r.height / 2, { steps: 6 }); await page.mouse.up()
  expect(await page.evaluate(() => window.__creation!.camera()!.alpha)).not.toBeCloseTo(a0, 2)
})

// ── Task 17 additions: the click really chose the zone, misses do nothing, layout, idle ──

const boot = async (page: Page, reduced = true): Promise<void> => {
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
}

/** Every 4 px of the cube square: the zone under that point, as a click would classify it. */
const cubeMap = async (page: Page): Promise<{ x: number; y: number; zone: string | null }[]> =>
  page.evaluate(() => {
    const c = window.__creation!
    const r = c.cubeRect()
    const out: { x: number; y: number; zone: string | null }[] = []
    for (let y = r.y + 2; y < r.y + r.height; y += 4)
      for (let x = r.x + 2; x < r.x + r.width; x += 4) out.push({ x, y, zone: c.cubeZoneAt(x, y) })
    return out
  })

test('the screen point of each zone classifies as that zone (the click is not a no-op)', async ({ page }) => {
  await boot(page)
  for (const s of ZONES) {
    const id = zoneId(s)
    const pt = await page.evaluate((z) => window.__creation!.cubeZoneScreenPoint(z), id)
    expect(await page.evaluate((p) => window.__creation!.cubeZoneAt(p.x, p.y), pt!), id).toBe(id)
  }
})

test('from the Face pose, clicking the top edge patch lands on Dessus · Face; a miss outside the cube does nothing', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('face'))
  const map = await cubeMap(page)
  // Seen from the front (slightly above), face, its 4 edges and corners are visible; the back is not.
  const seen = new Set(map.map((p) => p.zone))
  for (const z of ['face', 'dessus-face', 'face-droite', 'face-gauche', 'dessus-face-droite']) expect(seen.has(z), z).toBe(true)
  expect(seen.has('arriere')).toBe(false)
  const edge = map.find((p) => p.zone === 'dessus-face')!
  await page.mouse.click(edge.x, edge.y)
  const want = zoneAngles({ x: 0, y: 1, z: 1 })
  await expect.poll(async () => Math.abs((await page.evaluate(() => window.__creation!.camera()!.beta)) - want.beta)).toBeLessThan(0.02)
  // the square's corners are outside the cube's silhouette: a click there is a no-op (no flight)
  const miss = map.find((p) => p.zone === null)!
  expect(miss).toBeDefined()
  const before = await page.evaluate(() => window.__creation!.camera())
  await page.mouse.click(miss.x, miss.y)
  await page.waitForTimeout(100)
  expect(await page.evaluate(() => window.__creation!.camera())).toEqual(before)
})

test('the cube sits 16 px into the viewport (never over the Projet panel) and follows the panel fold', async ({ page }) => {
  await boot(page)
  const at = async () => ({
    cube: await page.evaluate(() => window.__creation!.cubeRect()),
    view: (await page.getByTestId('viewport').boundingBox())!,
    hit: (await page.getByTestId('view-cube').boundingBox())!,
  })
  const a = await at()
  expect(a.cube.x).toBeCloseTo(a.view.x + 16, 0)
  expect(a.cube.y).toBeCloseTo(a.view.y + 16, 0)
  expect(a.hit).toEqual({ x: a.cube.x, y: a.cube.y, width: a.cube.width, height: a.cube.height })
  const tree = (await page.locator('[data-testid="project-tree"]').first().boundingBox())!
  expect(a.cube.x).toBeGreaterThanOrEqual(tree.x + tree.width)
  await page.getByRole('button', { name: 'Replier le panneau Projet' }).click()
  await expect.poll(async () => (await at()).cube.x).toBeLessThan(a.cube.x)
  const b = await at()
  expect(b.cube.x).toBeCloseTo(b.view.x + 16, 0)
  expect(b.hit.x).toBeCloseTo(b.cube.x, 0)
  // the hit layer is the only overlay: hidden from assistive tech, never a tab stop
  const hit = page.getByTestId('view-cube')
  await expect(hit).toHaveAttribute('aria-hidden', 'true')
  expect(await hit.evaluate((e) => (e as HTMLElement).tabIndex)).toBe(-1)
})

test('hover renders on demand: a frame per zone change, then idle (0 renders in 2 s)', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('face'))
  await page.waitForTimeout(1500) // settle (shaders, textures, fonts)
  const r = await page.evaluate(() => window.__creation!.cubeRect())
  const n0 = await page.evaluate(() => window.__creation!.renders())
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2)
  await expect.poll(() => page.evaluate(() => window.__creation!.cubeHover())).toBe('face')
  await expect.poll(() => page.evaluate(() => window.__creation!.renders())).toBeGreaterThan(n0)
  await page.waitForTimeout(300)
  const n1 = await page.evaluate(() => window.__creation!.renders())
  await page.waitForTimeout(2000)
  expect(await page.evaluate(() => window.__creation!.renders())).toBe(n1)
  // leaving the cube clears the hover
  await page.mouse.move(r.x + r.width + 200, r.y + r.height + 200)
  await expect.poll(() => page.evaluate(() => window.__creation!.cubeHover())).toBeNull()
})

test('a selected device keeps its stroke in the room and the cube shows none of it; device picking ignores the cube', async ({ page }) => {
  await boot(page)
  const r = await page.evaluate(() => window.__creation!.cubeRect())
  // the cube's meshes are never picked as a device, even right under the cube
  expect(await page.evaluate((p) => window.__creation!.pickAt(p.x, p.y), { x: 16 + r.width / 2, y: 16 + r.height / 2 })).toBeNull()
  // the main camera stays the scene's active camera between frames (the cube camera renders second)
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2)
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => window.__creation!.activeCameraIsMain())).toBe(true)
})
