import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Task 37 (CA-23, CA-24, CA-25): Écoute › Couverture. The powered reference rig + playback on; the dots, the legend and the statistics, the
 * recompute rules (change only, one debounced job), the honest states (no audience, nothing audible), the pin, the draw call, the .glb front check.
 */
test.use({ viewport: { width: 1366, height: 768 } })

const cov = (page: Page) => page.evaluate(() => window.__creation!.coverage())
const jobs = (page: Page) => page.evaluate(() => window.__creation!.coverageJobs())
const waitReady = (page: Page) => page.waitForFunction(() => window.__creation!.coverage().status === 'ready' && !window.__creation!.coverage().pending, null, { timeout: 20_000 })

/** The reference template with its two signal cables, playback on, everything fed (the powered reference rig). */
const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 5)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  const ok = await page.evaluate(() => {
    const c = window.__creation!
    return [
      c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } }).ok,
      c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-r' }, b: { instance: 'k12-d', port: 'in-line-a' } }).ok,
      c.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }).ok,
    ]
  })
  expect(ok).toEqual([true, true, true])
}
const coverageItem = (page: Page) => page.getByRole('menuitemcheckbox', { name: 'Couverture' })
const toggleCoverage = async (page: Page): Promise<void> => {
  await page.getByRole('menuitem', { name: 'Écoute' }).click()
  await coverageItem(page).click()
}
const panel = (page: Page) => page.getByTestId('coverage-panel')

test('(a) Écoute › Couverture: off by default, then the dots, ≤ 20 000 points, maximum exactly 0 dB, the legend and the statistics as text', async ({ page }) => {
  await boot(page)
  expect((await cov(page)).on).toBe(false)
  expect(await jobs(page)).toBe(0) // nothing loaded, nothing posted
  await expect(panel(page)).toHaveCount(0) // the lazy chunk is not even fetched
  await page.getByRole('menuitem', { name: 'Écoute' }).click()
  await expect(coverageItem(page)).toHaveAttribute('aria-checked', 'false')
  await coverageItem(page).click()
  await waitReady(page)
  const c = await cov(page)
  expect(c.on).toBe(true)
  expect(c.points).toBeGreaterThan(1000)
  expect(c.points).toBeLessThanOrEqual(20_000)
  expect(c.step).toBe(0.5)
  expect(c.stats!.max).toBe(0) // the loudest point is exactly 0 dB (relative)
  expect(c.stats!.count).toBe(c.points)
  expect(c.sources).toEqual(['k12-d', 'k12-g'])
  expect(c.plain + c.hatched).toBe(c.points)
  expect(c.bins.reduce((a, b) => a + b, 0)).toBe(c.points)
  expect(Number.isFinite(c.stats!.min) && Number.isFinite(c.stats!.mean) && Number.isFinite(c.stats!.sd)).toBe(true)
  await page.getByRole('menuitem', { name: 'Écoute' }).click()
  await expect(coverageItem(page)).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Escape')

  // the panel (Propriétés side, not over the viewport) says what the dots are
  await expect(panel(page)).toBeVisible()
  const p = (await panel(page).boundingBox())!
  const v = (await page.getByTestId('viewport').boundingBox())!
  expect(p.x).toBeGreaterThanOrEqual(v.x + v.width - 1) // right of the viewport: it never overlays the 3D view
  await expect(page.getByTestId('coverage-unit')).toHaveText('dB relatif (0 = point le plus fort)')
  await expect(page.getByTestId('coverage-method')).toHaveText('somme énergétique, champ direct')
  await expect(page.getByTestId('coverage-source')).toHaveText('Couverture : données KB (V déduit)')
  await expect(page.getByTestId('coverage-hatched')).toContainText('Hachuré : interférences non modélisées')
  await expect(page.getByTestId('coverage-legend').locator('li')).toHaveCount(8)
  await expect(page.getByTestId('coverage-legend').locator('li').first()).toContainText('0 à −3 dB')
  await expect(page.getByTestId('coverage-legend').locator('li').last()).toContainText('−21 dB et moins')
  await expect(page.getByTestId('coverage-stats').locator('dd[data-stat="count"]')).toHaveText(String(c.points))
  await expect(page.getByTestId('coverage-stats').locator('dd[data-stat="max"]')).toHaveText('0,0 dB')
  await expect(page.getByTestId('coverage-stats').locator('dd[data-stat="step"]')).toHaveText('0,5 m')
  await expect(page.getByTestId('coverage-speakers')).toContainText('k12-g : 75° × 75°')
  await expect(page.getByTestId('coverage-caveat')).toContainText('La direction de chaque enceinte est indiquée par le trait')
  await expect(page.getByTestId('coverage-caveat')).toContainText('modèles en cours de refonte')
  await expect(page.getByTestId('coverage-spl')).toBeHidden() // no sourced sensitivity anywhere: the SPL estimate does not exist
  await expect(page.getByTestId('coverage-ready')).not.toContainText(/NaN|Infinity|undefined/)
  // the legend counts add up to the points (each colour's dots are text too)
  const counts = await page.getByTestId('coverage-legend').locator('.cr-cov-count').allTextContents()
  expect(counts.map((t) => parseInt(t, 10)).reduce((a, b) => a + b, 0)).toBe(c.points)
  // said once, politely, through the status line
  await expect(page.getByRole('status')).toContainText('Couverture calculée')
  expect((await cov(page)).message).toContain(`${c.points} points`)
  // never the words the honesty rule forbids, never an SPL label
  const text = (await panel(page).innerText()).toLowerCase()
  for (const bad of ['sti', 'limite légale', 'décret', '102 db', 'réglementaire']) expect(text).not.toMatch(new RegExp(`\\b${bad}\\b`))
  expect(text).not.toContain('spl')
})

test('(b) the fidelity chip « relatif » opens an explanation; Échap closes it and gives the focus back', async ({ page }) => {
  await boot(page)
  await toggleCoverage(page)
  await waitReady(page)
  const chip = page.getByTestId('coverage-chip')
  await expect(chip).toHaveText('relatif')
  await expect(chip).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByTestId('coverage-popover')).toBeHidden()
  await chip.focus()
  await page.keyboard.press('Enter')
  await expect(chip).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByTestId('coverage-popover')).toBeVisible()
  await expect(page.getByTestId('coverage-popover')).toContainText('Estimation pédagogique')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('coverage-popover')).toBeHidden()
  await expect(chip).toBeFocused()
  // no transition on the pop-over (the 0.01 ms reduced-motion rule and `button { transition: all }` must not animate its visibility)
  expect(await page.getByTestId('coverage-popover').evaluate((e) => getComputedStyle(e).transitionProperty)).toBe('none')
  expect(await chip.evaluate((e) => getComputedStyle(e).transitionProperty)).toBe('none')
})

test('(c) idle: 2 s with the coverage on renders no frame and posts no job; one draw call for the plain dots', async ({ page }) => {
  await boot(page)
  await toggleCoverage(page)
  await waitReady(page)
  // let the last frame after the result be drawn, then watch
  await page.waitForFunction(() => window.__creation!.drawCalls('coverage') > 0)
  await page.waitForTimeout(500)
  const before = { r: await page.evaluate(() => window.__creation!.renders()), j: await jobs(page) }
  await page.waitForTimeout(2000)
  expect(await page.evaluate(() => window.__creation!.renders())).toBe(before.r) // 0 renders at idle
  expect(await jobs(page)).toBe(before.j) // 0 worker jobs at idle
  expect(before.j).toBe(1) // the one job of the toggle
  // one thin-instanced mesh = one draw call for ALL the plain dots, however many there are
  const c = await cov(page)
  expect(c.plain).toBeGreaterThan(100)
  expect(await page.evaluate(() => window.__creation!.drawCalls('coverage'))).toBe(1)
  expect(c.hatched).toBeGreaterThan(0)
  expect(await page.evaluate(() => window.__creation!.drawCalls('coverage:hatch'))).toBe(1) // the hatched variant is its own single draw
})

test('(d) moving k12-g by 1 m posts exactly ONE job after the debounce, and the field changes', async ({ page }) => {
  await boot(page)
  await toggleCoverage(page)
  await waitReady(page)
  const base = await jobs(page)
  const probes0 = (await cov(page)).probes
  const mean0 = (await cov(page)).stats!.mean
  await page.evaluate(() => {
    const c = window.__creation!
    const p = c.design().placements.find((x) => x.instanceId === 'k12-g')!
    c.dispatch({ type: 'SET_POSE', instanceId: 'k12-g', position: [p.position_m[0] - 1, p.position_m[1], p.position_m[2]], yawDeg: p.yawDeg, tiltDeg: p.tiltDeg ?? 0, mount: p.mount ?? 'stand' })
  })
  expect(await jobs(page)).toBe(base) // debounced: nothing is posted at once
  await page.waitForFunction((n) => window.__creation!.coverageJobs() === n + 1, base, { timeout: 5000 })
  await waitReady(page)
  await page.waitForTimeout(600) // and no second job follows
  expect(await jobs(page)).toBe(base + 1)
  const after = await cov(page)
  expect(after.stats!.mean).not.toBe(mean0)
  expect(after.probes).not.toEqual(probes0)
  // the aim line followed the speaker (it starts where the speaker now is)
  expect(after.aim.find((a) => a.id === 'k12-g')!.from[0]).toBeCloseTo(5, 5)
  // a burst of 5 moves inside the window is ONE job
  const b2 = await jobs(page)
  await page.evaluate(() => {
    const c = window.__creation!
    for (let i = 1; i <= 5; i++) c.dispatch({ type: 'SET_POSE', instanceId: 'k12-g', position: [5 - i * 0.25, 2.7, -7.5], yawDeg: 0, tiltDeg: 0, mount: 'stand' })
  })
  await page.waitForFunction((n) => window.__creation!.coverageJobs() === n + 1, b2, { timeout: 5000 })
  await waitReady(page)
  await page.waitForTimeout(500)
  expect(await jobs(page)).toBe(b2 + 1)
  // a rig change that does not touch the speakers (the microphone) posts nothing
  const b3 = await jobs(page)
  await page.evaluate(() => {
    const c = window.__creation!
    const p = c.design().placements.find((x) => x.instanceId === 'sm58')!
    c.dispatch({ type: 'SET_POSE', instanceId: 'sm58', position: [p.position_m[0] + 0.5, p.position_m[1], p.position_m[2]], yawDeg: p.yawDeg, tiltDeg: 0, mount: p.mount ?? 'stand' })
  })
  await page.waitForTimeout(600)
  expect(await jobs(page)).toBe(b3)
})

test('(e) muting the master: the dots go (no audible speaker), the panel says why, and the status line says it once; unmuting brings them back', async ({ page }) => {
  await boot(page)
  await toggleCoverage(page)
  await waitReady(page)
  expect((await cov(page)).plain).toBeGreaterThan(0)
  const base = await jobs(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'mute-master', value: true }))
  await page.waitForFunction(() => window.__creation!.coverage().status === 'no-source')
  const c = await cov(page)
  expect(c).toMatchObject({ points: 0, plain: 0, hatched: 0, stats: null, sources: [], aim: [] })
  await page.waitForFunction(() => window.__creation!.coverage().plain === 0)
  expect(await jobs(page)).toBe(base) // nothing was posted: there is nothing audible to compute
  await expect(page.getByTestId('coverage-status')).toHaveText('Aucune enceinte audible : la console est en mute.')
  await expect(page.getByTestId('coverage-ready')).toBeHidden() // no number, no legend counts, no stats
  await expect(page.getByRole('status')).toHaveText('Aucune enceinte audible : la console est en mute.')
  // mute never gates playback (Task 34): the status bar still says the rig can play
  await expect(page.getByTestId('status-bar')).toContainText('Lecture possible')
  // unmute: the field is back
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'mute-master', value: false }))
  await waitReady(page)
  expect((await cov(page)).plain).toBeGreaterThan(0)
  // the fader at -inf is silence too, with its own reason
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'fader-master', value: '-inf' }))
  await page.waitForFunction(() => window.__creation!.coverage().status === 'no-source')
  await expect(page.getByTestId('coverage-status')).toHaveText('Aucune enceinte audible : le fader master est à −inf.')
  // a fader below unity moves no relative level but the loudest point's own level (the scale is L_ref)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'fader-master', value: '-10' }))
  await waitReady(page)
  expect((await cov(page)).stats!.max).toBe(0)
})

test('(f) playback off: nothing is fed, the panel quotes the reason; a room with no audience zone says « pas de public » with no number', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: false }))
  await toggleCoverage(page)
  await page.waitForFunction(() => window.__creation!.coverage().status === 'no-source')
  await expect(page.getByTestId('coverage-status')).toHaveText('Aucune enceinte audible : aucune enceinte ne reçoit de signal (la lecture console est coupée).')
  expect(await jobs(page)).toBe(0)
  // a studio: no audience, no régie zone: 16 of the 32 shipped rooms
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }))
  await waitReady(page)
  await page.evaluate(() => window.__creation!.choosePlace('room:podcast-room-small'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:podcast-room-small' && window.__creation!.coverage().status === 'no-audience')
  const c = await cov(page)
  expect(c).toMatchObject({ on: true, points: 0, plain: 0, hatched: 0, stats: null, step: null, bins: [] })
  await expect(page.getByTestId('coverage-status')).toHaveText('Pas de public dans ce lieu : aucune zone public ni régie à couvrir. Rien à calculer.')
  await expect(page.getByTestId('coverage-ready')).toBeHidden()
  await expect(panel(page)).not.toContainText(/NaN|Infinity|undefined|−∞/)
  await expect(page.getByRole('status')).toHaveText('Pas de public dans ce lieu : aucune zone public ni régie à couvrir. Rien à calculer.')
  // the blank place has no zone either
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await page.waitForFunction(() => window.__creation!.coverage().status === 'no-audience')
})

test('(g) a click on a dot pins its level, a named point is a keyboard button, « Retirer l’épingle » clears it, a device is never pinned', async ({ page }) => {
  await boot(page)
  await toggleCoverage(page)
  await waitReady(page)
  // the named points (Régie first) are real text with their level
  const rows = page.getByTestId('coverage-points').locator('li')
  await expect(rows.first()).toContainText('Régie : ')
  await expect(rows.first()).toContainText(' dB')
  const regie = (await cov(page)).probes.find((p) => p.id === 'regie')!
  expect(regie.db).not.toBeNull()
  // keyboard: Tab to the button of the Régie row, Enter pins it
  await page.getByRole('button', { name: 'Épingler Régie' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('coverage-pinned')).toContainText('Point épinglé (0,0 m ; 8,0 m)')
  await expect(page.getByTestId('coverage-pinned')).toContainText(`${regie.db!.toFixed(1).replace('-', '−').replace('.', ',')} dB`)
  await expect(page.getByRole('button', { name: 'Retirer l’épingle' })).toBeVisible()
  await page.getByRole('button', { name: 'Retirer l’épingle' }).click()
  await expect(page.getByTestId('coverage-pinned')).toBeHidden()
  expect((await cov(page)).pinned).toBeNull()
  // mouse: a click on a dot far from every device
  const at = await page.evaluate(() => window.__creation!.worldScreen([-3.25, 1.2, 0.25]))
  expect(at).not.toBeNull()
  await page.mouse.click(at!.x, at!.y)
  await expect(page.getByTestId('coverage-pinned')).toContainText('Point épinglé (−3,3 m ; 0,3 m) : ') // grid cell centre (−3.25, 0.25)
  expect((await cov(page)).pinned).toMatch(/dB$/)
  await expect(page.getByTestId('toast')).toBeHidden() // the click was the coverage's: not a « missed click »
  // the ear height moves the plane: the dot pin goes (another plane), a named point follows
  await page.getByRole('menuitem', { name: 'Écoute' }).click()
  await page.getByRole('menuitemradio', { name: /debout/ }).click()
  await page.waitForFunction(() => window.__creation!.earHeight() === 1.7)
  await waitReady(page)
  expect((await cov(page)).pinned).toBeNull()
  // a click on a DEVICE is never a pin (the dots plane crosses that pixel's ray in front of the console): pin a dot, then click the console
  const dot = await page.evaluate(() => window.__creation!.worldScreen([-3.25, 1.7, 0.25]))
  await page.mouse.click(dot!.x, dot!.y)
  await expect(page.getByTestId('coverage-pinned')).toBeVisible()
  await page.getByRole('button', { name: 'Retirer l’épingle' }).click()
  // a pixel where a device body AND a dot cell are both under the pointer (searched around the console: the test fails if there is none)
  const both = await page.evaluate(() => {
    const c = window.__creation!
    const r = document.getElementById('renderCanvas')!.getBoundingClientRect()
    const d = c.deviceScreen('ql1')!
    for (let dy = -30; dy <= 30; dy += 4)
      for (let dx = -60; dx <= 60; dx += 4) {
        const x = d.x + dx - r.left
        const y = d.y + dy - r.top
        if (c.pickAt(x, y) === 'ql1' && c.coverageDotAt(x, y) !== null) return { x: d.x + dx, y: d.y + dy }
      }
    return null
  })
  expect(both, 'a pixel with both a device and a dot under it').not.toBeNull()
  await page.mouse.click(both!.x, both!.y)
  await page.waitForTimeout(300)
  expect((await cov(page)).pinned).toBeNull()
})

test('(h) ear height change recomputes once; toggling off removes the dots, the panel and the worker; toggling on again recomputes; no error', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await boot(page)
  const meshesOff = await page.evaluate(() => window.__creation!.meshCount())
  await toggleCoverage(page)
  await waitReady(page)
  expect(await page.evaluate(() => window.__creation!.meshCount())).toBeGreaterThan(meshesOff) // plain + hatched + aim lines
  const base = await jobs(page)
  await page.getByRole('menuitem', { name: 'Écoute' }).click()
  await page.getByRole('menuitemradio', { name: /debout/ }).click()
  await page.waitForFunction((n) => window.__creation!.coverageJobs() === n + 1, base)
  await waitReady(page)
  await page.waitForTimeout(500)
  expect(await jobs(page)).toBe(base + 1)
  // off: everything it made is gone
  await toggleCoverage(page)
  await expect(panel(page)).toBeHidden()
  expect((await cov(page)).on).toBe(false)
  expect((await cov(page)).worker).toBe(false)
  expect(await page.evaluate(() => window.__creation!.meshCount())).toBe(meshesOff)
  await expect(page.getByRole('status')).toHaveText('Couverture masquée.')
  // a rig change while off posts nothing and renders no dots
  const j = await jobs(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'mute-master', value: true }))
  await page.waitForTimeout(500)
  expect(await jobs(page)).toBe(j)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'mute-master', value: false }))
  // on again: the same controller, no listener leak, a fresh computation
  const listeners = await page.evaluate(() => window.__creation!.liveListeners())
  await toggleCoverage(page)
  await waitReady(page)
  expect(await page.evaluate(() => window.__creation!.liveListeners())).toBe(listeners)
  // a place change while on: the old place's dots are gone with its scene, the new place is computed
  const meshesOn = await page.evaluate(() => window.__creation!.meshCount())
  expect(meshesOn).toBeGreaterThan(meshesOff)
  await page.evaluate(() => window.__creation!.choosePlace('room:theatre-italian-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:theatre-italian-medium')
  await page.waitForFunction(() => ['no-source', 'no-audience', 'ready'].includes(window.__creation!.coverage().status))
  expect((await cov(page)).on).toBe(true)
  expect(errors).toEqual([])
})

test('(i) the AIM line of each audible speaker starts at the speaker and runs along its acoustic axis (+z at yaw 0); it is drawn once, only while the coverage is on', async ({ page }) => {
  await boot(page)
  await toggleCoverage(page)
  await waitReady(page)
  const aim = (await cov(page)).aim
  expect(aim.map((a) => a.id)).toEqual(['k12-d', 'k12-g'])
  for (const a of aim) {
    expect(a.to[0]).toBeCloseTo(a.from[0], 6)
    expect(a.to[2] - a.from[2]).toBeCloseTo(4, 6) // along +z, 4 m
  }
  await page.waitForFunction(() => window.__creation!.drawCalls('coverage:aim') > 0)
  expect(await page.evaluate(() => window.__creation!.drawCalls('coverage:aim'))).toBe(1)
  // turned 90°: the axis follows (sin yaw, 0, cos yaw)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_POSE', instanceId: 'k12-g', position: [6, 2.7, -7.5], yawDeg: 90, tiltDeg: 0, mount: 'stand' }))
  await page.waitForFunction(() => window.__creation!.coverage().aim.find((a) => a.id === 'k12-g')!.to[0] > 9)
  const g = (await cov(page)).aim.find((a) => a.id === 'k12-g')!
  expect(g.to[0] - g.from[0]).toBeCloseTo(4, 5)
  expect(g.to[2] - g.from[2]).toBeCloseTo(0, 5)
  // tilted down 10°: the axis dips (tilt > 0 aims UP, so -10 is down)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_POSE', instanceId: 'k12-g', position: [6, 2.7, -7.5], yawDeg: 0, tiltDeg: -10, mount: 'stand' }))
  await page.waitForFunction(() => window.__creation!.coverage().aim.find((a) => a.id === 'k12-g')!.to[1] < 2.6)
  expect((await cov(page)).aim.find((a) => a.id === 'k12-g')!.to[1]).toBeCloseTo(2.7 - 4 * Math.sin((10 * Math.PI) / 180), 5)
})

test('(j) CONVENTION CHECK (L30 viii, kept by decision): at yaw 0 the connector markers of the K12.2 sit at −z of the body and the acoustic axis runs to +z (evidence of the current scene; the model SHAPE is documented in tests/assets/speakerFront.test.ts)', async ({ page }) => {
  // The convention (yaw 0 = +z, connectors toward −z) is what the rebuilt 3D models will follow too (decision L30 viii): if this fails, the scene's
  // convention changed. See docs/CREATIVE-MODE-LOG.md L30 and ADR-0015 « Addendum (Task 37) » before touching the test.
  await boot(page)
  const r = await page.evaluate(() => {
    const c = window.__creation!
    const centre = c.deviceBodyCenter('k12-g')!
    const ports = ['in-line-a', 'thru-out-a', 'power-in'].map((p) => ({ port: p, at: c.portWorld({ instance: 'k12-g', port: p }) }))
    return { centre, ports, yaw: c.design().placements.find((x) => x.instanceId === 'k12-g')!.yawDeg }
  })
  expect(r.yaw).toBe(0)
  for (const p of r.ports) {
    expect(p.at, p.port).not.toBeNull()
    // the markers are in front of the connector face by 1.5 cm: well behind the body centre (the cabinet is ~0.35 m deep)
    expect(p.at![2], `${p.port} z vs body centre z`).toBeLessThan(r.centre[2] - 0.1)
    expect(Math.abs(p.at![0] - r.centre[0]), `${p.port} x`).toBeLessThan(0.3)
  }
  // The acoustic axis (+z at yaw 0, ADR-0015) points the OTHER way: from the connectors through the body.
  await toggleCoverage(page)
  await waitReady(page)
  const aim = (await cov(page)).aim.find((a) => a.id === 'k12-g')!
  expect(aim.to[2]).toBeGreaterThan(aim.from[2])
  for (const p of r.ports) expect(p.at![2], p.port).toBeLessThan(aim.from[2]) // the connectors are behind the speaker's acoustic origin
})

test('(k) a11y: the coverage block has no axe violation (text contrast, names, structure)', async ({ page }) => {
  await boot(page)
  await toggleCoverage(page)
  await waitReady(page)
  await page.getByTestId('coverage-chip').click()
  const results = await new AxeBuilder({ page }).include('[data-testid="coverage-panel"]').analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
})
