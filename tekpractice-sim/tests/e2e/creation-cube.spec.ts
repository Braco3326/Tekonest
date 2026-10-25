import { expect, test, type Page } from '@playwright/test'
import { ZONES, zoneAngles, zoneId } from '../../src/camera/cubeZones'
test.use({ viewport: { width: 1366, height: 768 } })

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

/** The point of a zone's patch closest to the patch's centroid (well inside it), or null when not on screen. */
const patchPoint = async (page: Page, id: string): Promise<{ x: number; y: number } | null> => {
  const pts = (await cubeMap(page)).filter((p) => p.zone === id)
  if (!pts.length) return null
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
  return pts.reduce((best, p) => (Math.hypot(p.x - cx, p.y - cy) < Math.hypot(best.x - cx, best.y - cy) ? p : best))
}

/** Angular gap between a camera pose and a zone's pose (alpha modulo 2π). */
const gap = (cam: { alpha: number; beta: number }, want: { alpha: number; beta: number }) => ({
  alpha: Math.abs(((cam.alpha - want.alpha + 3 * Math.PI) % (2 * Math.PI)) - Math.PI),
  beta: Math.abs(cam.beta - want.beta),
})

// Fix 1 (review): the brief's version clicked each zone from that zone's own pose, so a click that did
// nothing still "landed". Here every zone is clicked from an iso corner pose OTHER than its own, where its
// patch is visible (it shares a face with that corner), found on screen with cubeZoneAt: the camera must move.
// Verified to fail with the click handler disabled (Task 17 report, Fix 1).
test('all 26 cube zones are clickable and land on their view', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/'); await page.waitForFunction(() => !!window.__creation); await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  const corners = ZONES.filter((c) => c.x && c.y && c.z)
  for (const s of ZONES) {
    const id = zoneId(s)
    const from = corners.find(
      (c) => zoneId(c) !== id && ((s.x !== 0 && c.x === s.x) || (s.y !== 0 && c.y === s.y) || (s.z !== 0 && c.z === s.z))
    )!
    expect(await page.evaluate((z) => window.__creation!.cubeZoneScreenPoint(z), zoneId(from)), id).not.toBeNull()
    const want = zoneAngles(s)
    const start = gap((await page.evaluate(() => window.__creation!.camera()))!, want)
    expect(Math.max(start.alpha, start.beta), `${id}: the start pose is not already the target`).toBeGreaterThan(0.1)
    const pt = await patchPoint(page, id)
    expect(pt, `${id} visible from ${zoneId(from)}`).not.toBeNull()
    await page.mouse.click(pt!.x, pt!.y)
    const end = gap((await page.evaluate(() => window.__creation!.camera()))!, want)
    expect(end.alpha, id).toBeLessThan(0.02)
    expect(end.beta, id).toBeLessThan(0.02)
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
  // Deviation from the brief: the place opens 30° above the horizon (beta 1.05), where the cube centre
  // is honestly on the Dessus · Face edge band (threshold 0.5: the face patch holds the centre only
  // below atan(0.5) = 26.6°). Checked at the opening pose, then the brief's check from the Face view.
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  const r = await page.evaluate(() => window.__creation!.cubeRect())
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2)
  await expect.poll(() => page.evaluate(() => window.__creation!.cubeHover())).toBe('dessus-face')
  await page.mouse.move(r.x + r.width + 100, r.y + r.height + 100)
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('face'))
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

test('device picking ignores the cube; the main camera stays the active camera between frames', async ({ page }) => {
  await boot(page)
  const r = await page.evaluate(() => window.__creation!.cubeRect())
  // the cube's meshes are never picked as a device, even right under the cube
  expect(await page.evaluate((p) => window.__creation!.pickAt(p.x, p.y), { x: 16 + r.width / 2, y: 16 + r.height / 2 })).toBeNull()
  // the main camera stays the scene's active camera between frames (the cube camera renders second)
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2)
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => window.__creation!.activeCameraIsMain())).toBe(true)
})

test('the wheel over the cube zooms the room as anywhere else; the page never scrolls', async ({ page }) => {
  await boot(page)
  const r = await page.evaluate(() => window.__creation!.cubeRect())
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2)
  const r0 = (await page.evaluate(() => window.__creation!.camera()))!.radius
  await page.mouse.wheel(0, -400)
  await expect.poll(async () => (await page.evaluate(() => window.__creation!.camera()))!.radius).toBeLessThan(r0 - 0.01)
  expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0])
})

/** Mean colour of a 3×3 block of the rendered page at (x, y), read back from a screenshot. */
const pixel = async (page: Page, x: number, y: number): Promise<[number, number, number]> => {
  const png = await page.screenshot({ clip: { x: Math.round(x) - 1, y: Math.round(y) - 1, width: 3, height: 3 } })
  return page.evaluate(async (b64) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const c = new OffscreenCanvas(img.width, img.height)
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, img.width, img.height).data
    const n = d.length / 4
    const sum = [0, 0, 0]
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) sum[k] += d[i + k]
    return sum.map((v) => v / n) as [number, number, number]
  }, png.toString('base64'))
}
const contrast = (a: number[], b: number[]): number => {
  const lum = (c: number[]) =>
    c.map((v) => v / 255).map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4)).reduce((t, v, i) => t + v * [0.2126, 0.7152, 0.0722][i], 0)
  const [l1, l2] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (l1 + 0.05) / (l2 + 0.05)
}

test('the Ambre hover patch reads ≥ 3:1 against the cube body on the rendered pixels', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('face'))
  await page.waitForTimeout(500)
  // the top-right corner patch of the front face: no label ink there
  const pts = (await cubeMap(page)).filter((p) => p.zone === 'dessus-face-droite')
  const p = pts.reduce((best, q) => (q.y > best.y || (q.y === best.y && q.x < best.x) ? q : best)) // lowest-left point: on the front face
  const target = { x: p.x + 4, y: p.y - 4 }
  expect(await page.evaluate((q) => window.__creation!.cubeZoneAt(q.x, q.y), target)).toBe('dessus-face-droite')
  const body = await pixel(page, target.x, target.y)
  await page.mouse.move(target.x, target.y)
  await expect.poll(() => page.evaluate(() => window.__creation!.cubeHover())).toBe('dessus-face-droite')
  await page.waitForTimeout(200)
  const lit = await pixel(page, target.x, target.y)
  const ratio = contrast(lit, body)
  console.log(`[cube hover] body rgb(${body.map(Math.round)}) hover rgb(${lit.map(Math.round)}) contrast ${ratio.toFixed(2)}:1`)
  expect(ratio).toBeGreaterThanOrEqual(3)
})
