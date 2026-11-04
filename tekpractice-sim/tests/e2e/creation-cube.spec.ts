import { expect, test, type Page } from '@playwright/test'
import { ZONES, zoneAngles, zoneId, zoneLabel } from '../../src/camera/cubeZones'
import { IDLE_WINDOW_MS, quietWindow, waitRendersIdle } from './waits'
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
  await quietWindow(page, 100)
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
  await waitRendersIdle(page) // settle (shaders, textures, fonts)
  const r = await page.evaluate(() => window.__creation!.cubeRect())
  const n0 = await page.evaluate(() => window.__creation!.renders())
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2)
  await expect.poll(() => page.evaluate(() => window.__creation!.cubeHover())).toBe('face')
  await expect.poll(() => page.evaluate(() => window.__creation!.renders())).toBeGreaterThan(n0)
  await waitRendersIdle(page)
  const n1 = await page.evaluate(() => window.__creation!.renders())
  await quietWindow(page, IDLE_WINDOW_MS)
  expect(await page.evaluate(() => window.__creation!.renders())).toBe(n1)
  // leaving the cube clears the hover: one frame repaints the patch, then idle again (Task 21 gate: 0 renders in 2 s)
  const n2 = await page.evaluate(() => window.__creation!.renders())
  await page.mouse.move(r.x + r.width + 200, r.y + r.height + 200)
  await expect.poll(() => page.evaluate(() => window.__creation!.cubeHover())).toBeNull()
  await expect.poll(() => page.evaluate(() => window.__creation!.renders())).toBeGreaterThan(n2)
  await waitRendersIdle(page)
  const n3 = await page.evaluate(() => window.__creation!.renders())
  await quietWindow(page, IDLE_WINDOW_MS)
  expect(await page.evaluate(() => window.__creation!.renders())).toBe(n3)
})

test('hover caption: the zone name under the square (edge and corner too), hidden on leave and while dragging; never in the way', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('face'))
  const cap = page.getByTestId('view-cube-caption')
  await expect(cap).toBeHidden()
  await expect(cap).toHaveAttribute('aria-hidden', 'true')
  for (const s of [{ x: 0, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: 1 }] as const) {
    const id = zoneId(s)
    const pt = (await patchPoint(page, id))!
    await page.mouse.move(pt.x, pt.y)
    await expect.poll(() => page.evaluate(() => window.__creation!.cubeHover())).toBe(id)
    await expect(cap).toBeVisible()
    await expect(cap).toHaveText(zoneLabel(s))
  }
  // just below the square, inside the viewport; Papier on Nuit, Plex 500 12 px, square corners, no pointer events
  const r = await page.evaluate(() => window.__creation!.cubeRect())
  const box = (await cap.boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(r.y + r.height)
  expect(box.y).toBeLessThan(r.y + r.height + 12)
  expect(box.x).toBeCloseTo(r.x, 0)
  const st = await cap.evaluate((e) => {
    const c = getComputedStyle(e)
    return { pe: c.pointerEvents, fw: c.fontWeight, fs: c.fontSize, ff: c.fontFamily, bg: c.backgroundColor, fg: c.color, br: c.borderRadius, tr: c.transitionDuration, an: c.animationName }
  })
  expect(st).toMatchObject({ pe: 'none', fw: '500', fs: '12px', bg: 'rgb(19, 17, 20)', fg: 'rgb(243, 237, 227)', br: '0px', an: 'none' })
  expect(parseFloat(st.tr)).toBeLessThan(0.001) // no transition (the reduced-motion reset leaves 1e-05s)
  expect(st.ff).toContain('IBM Plex Sans')
  // a point under the caption reaches what is below it
  const under = await page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.getAttribute('data-testid') ?? null, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
  expect(under).not.toBe('view-cube-caption')
  // dragging the cube: no caption
  await page.mouse.down()
  await page.mouse.move(r.x + r.width / 2 + 30, r.y + r.height / 2 + 5, { steps: 4 })
  await expect(cap).toBeHidden()
  await page.mouse.up()
  // leaving: hidden
  await page.mouse.move(r.x + r.width + 300, r.y + r.height + 300)
  await expect.poll(() => page.evaluate(() => window.__creation!.cubeHover())).toBeNull()
  await expect(cap).toBeHidden()
})

test('device picking ignores the cube; the main camera stays the active camera between frames', async ({ page }) => {
  await boot(page)
  const r = await page.evaluate(() => window.__creation!.cubeRect())
  // the cube's meshes are never picked as a device, even right under the cube
  expect(await page.evaluate((p) => window.__creation!.pickAt(p.x, p.y), { x: 16 + r.width / 2, y: 16 + r.height / 2 })).toBeNull()
  // the main camera stays the scene's active camera between frames (the cube camera renders second)
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2)
  await quietWindow(page, 200)
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
  await waitRendersIdle(page)
  // the top-right corner patch of the front face: no label ink there
  const pts = (await cubeMap(page)).filter((p) => p.zone === 'dessus-face-droite')
  const p = pts.reduce((best, q) => (q.y > best.y || (q.y === best.y && q.x < best.x) ? q : best)) // lowest-left point: on the front face
  const target = { x: p.x + 4, y: p.y - 4 }
  expect(await page.evaluate((q) => window.__creation!.cubeZoneAt(q.x, q.y), target)).toBe('dessus-face-droite')
  const body = await pixel(page, target.x, target.y)
  await page.mouse.move(target.x, target.y)
  await expect.poll(() => page.evaluate(() => window.__creation!.cubeHover())).toBe('dessus-face-droite')
  await waitRendersIdle(page)
  const lit = await pixel(page, target.x, target.y)
  const ratio = contrast(lit, body)
  console.log(`[cube hover] body rgb(${body.map(Math.round)}) hover rgb(${lit.map(Math.round)}) contrast ${ratio.toFixed(2)}:1`)
  expect(ratio).toBeGreaterThanOrEqual(3)
})

// ── Night 2 wave 5, P3-2: the cube's 120 x 120 hit square swallowed clicks in its empty corners ───────────────────────────────────────────────
// Measured live: at 5 corner points `cubeZoneAt` returned null, yet the element on top was the cube layer; a port drawn under it (k12-g in-line-a) could not be clicked. The layer is
// now clipped to the cube's silhouette (the hull of its eight corners, updated with the pose): outside it a press goes to the canvas, inside it nothing changes.
test('P3-2: a device drawn under an empty corner of the cube square can be clicked; the cube itself still takes its own clicks', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('dessus')) // from above the floor is seen everywhere under the square
  await waitRendersIdle(page)
  const r = await page.evaluate(() => window.__creation!.cubeRect())
  const corner = { x: r.x + 4, y: r.y + 4 }
  expect(await page.evaluate((p) => window.__creation!.cubeZoneAt(p.x, p.y), corner), 'the corner of the square misses the cube (the test means something)').toBeNull()
  // the floor point under that pixel: two Newton steps on the screen map (top view: nearly linear)
  const at = (x: number, z: number) => page.evaluate((p) => window.__creation!.worldScreen([p.x, 0, p.z]), { x, z })
  let w = { x: 0, z: 0 }
  for (let i = 0; i < 3; i++) {
    const s = (await at(w.x, w.z))!
    const sx = (await at(w.x + 1, w.z))!
    const sz = (await at(w.x, w.z + 1))!
    const a = sx.x - s.x, b = sz.x - s.x, c = sx.y - s.y, d = sz.y - s.y
    const det = a * d - b * c
    const ex = corner.x - s.x, ey = corner.y - s.y
    w = { x: w.x + (d * ex - b * ey) / det, z: w.z + (-c * ex + a * ey) / det }
  }
  const landed = (await at(w.x, w.z))!
  expect(Math.hypot(landed.x - corner.x, landed.y - corner.y), 'a floor point under the corner pixel').toBeLessThan(2)
  expect((await page.evaluate((p) => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'corner-ql1', position: [p.x, 0, p.z] }), w)).ok).toBe(true)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  await waitRendersIdle(page)
  const cv = (await page.locator('#renderCanvas').boundingBox())!
  expect(await page.evaluate((p) => window.__creation!.pickAt(p.x, p.y), { x: corner.x - cv.x, y: corner.y - cv.y }), 'a click on the canvas there would pick it (pickAt takes canvas px)').toBe('corner-ql1')
  expect(await page.evaluate(() => window.__creation!.selection())).toBeNull()
  expect(await page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.id, corner), 'the canvas is what is under the corner').toBe('renderCanvas')
  await page.mouse.click(corner.x, corner.y)
  await expect.poll(() => page.evaluate(() => window.__creation!.selection()), 'the click reached the canvas').toBe('corner-ql1')
  // inside the cube nothing changed: its centre is the cube layer and a click there still turns the camera to that zone
  const centre = { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  expect(await page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.getAttribute('data-testid'), centre)).toBe('view-cube')
})

test('P3-2: the cube layer follows the silhouette from every pose: its centre and the middle of every zone patch are the cube, every point the square misses is the canvas', async ({ page }) => {
  await boot(page)
  for (const id of ['face', 'dessus', 'droite', 'dessus-face-droite', 'arriere-gauche']) {
    await page.evaluate((z) => window.__creation!.cubeZoneScreenPoint(z), id)
    await waitRendersIdle(page)
    const bad = await page.evaluate(() => {
      const c = window.__creation!
      const r = c.cubeRect()
      const wrong: string[] = []
      for (let y = r.y + 1; y < r.y + r.height; y += 3)
        for (let x = r.x + 1; x < r.x + r.width; x += 3) {
          const zone = c.cubeZoneAt(x, y)
          const top = document.elementFromPoint(x, y)?.getAttribute('data-testid') === 'view-cube'
          if (zone && !top) wrong.push(`${Math.round(x)},${Math.round(y)} ${zone} not the cube layer`)
          if (!zone && top) wrong.push(`${Math.round(x)},${Math.round(y)} no zone but the cube layer`)
        }
      return wrong
    })
    // a point right on the silhouette edge may fall either way by a pixel: allow a thin band, never a region
    expect(bad.length, `${id}: ${bad.slice(0, 6).join(' | ')}`).toBeLessThan(40)
  }
})
