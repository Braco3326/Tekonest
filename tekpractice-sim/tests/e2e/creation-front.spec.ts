import { expect, test, type Page } from '@playwright/test'

/**
 * Task 43c (L34, decision L30 viii): the glb front ship gate. Mode Création's convention is yaw 0 = the front faces +z, and the acoustics aim
 * along it. The shipped K12.2 and 8030C files were drawn with another front; the spawner turns a model whose catalog device declares
 * `modelFront` until it faces +z. The DBR12 declares none (its front could not be established): nothing is turned and the coverage block says so.
 *
 * Oracles: the world forward vector of the model's declared front (`modelFront`, read from the live model root) equals the direction of the
 * coverage aim line (computed by the acoustic code from the placement alone); and for the K12.2 an INDEPENDENT oracle, the cabinet's plan is
 * wider at its baffle end than at its amplifier end, read from the live meshes' vertices (`bodyEnds`), tells which end the baffle is on.
 */
test.use({ viewport: { width: 1366, height: 768 } })

const cov = (page: Page) => page.evaluate(() => window.__creation!.coverage())
const waitReady = (page: Page) => page.waitForFunction(() => window.__creation!.coverage().status === 'ready' && !window.__creation!.coverage().pending, null, { timeout: 20_000 })

/** The reference rig (two K12.2 at yaw 0), playback on, coverage on: the aim lines are drawn. */
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
  await page.getByRole('menuitem', { name: 'Écoute' }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Couverture' }).click()
  await waitReady(page)
}

const unit = (v: [number, number, number]): [number, number, number] => {
  const n = Math.hypot(...v)
  return [v[0] / n, v[1] / n, v[2] / n]
}
const aimDir = async (page: Page, id: string): Promise<[number, number, number]> => {
  const a = (await cov(page)).aim.find((x) => x.id === id)!
  return unit([a.to[0] - a.from[0], a.to[1] - a.from[1], a.to[2] - a.from[2]])
}
const close = (a: number[], b: number[], digits = 3): void => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits))

test('(a) a K12.2 at yaw 0: its front faces +z, the way the aim line points; the baffle (the wide end of the cabinet) is at +z', async ({ page }) => {
  await boot(page)
  const r = await page.evaluate(() => {
    const c = window.__creation!
    return { front: c.modelFront('k12-g'), ends: c.bodyEnds('k12-g'), yaw: c.design().placements.find((p) => p.instanceId === 'k12-g')!.yawDeg, tilt: c.design().placements.find((p) => p.instanceId === 'k12-g')!.tiltDeg ?? 0 }
  })
  expect(r.yaw).toBe(0)
  expect(r.front, 'the model front is read from the live model').not.toBeNull()
  close(r.front!, [0, 0, 1])
  close(r.front!, await aimDir(page, 'k12-g')) // the same direction as the acoustic axis (tilt 0 here)
  // independent oracle: the plan is wider at +z than at -z (14 in baffle vs 6.6 in amplifier end), at yaw 0
  expect(r.tilt).toBe(0)
  expect(r.ends, 'body meshes found').not.toBeNull()
  expect(r.ends!.plusZ, 'plan width at +z (baffle) over the width at -z (amplifier end)').toBeGreaterThan(1.5 * r.ends!.minusZ)
})

test('(b) the model front follows the placement: yaw 90 and 200 on a K12.2 still equal the aim line', async ({ page }) => {
  await boot(page)
  for (const yaw of [90, 200]) {
    await page.evaluate((y) => window.__creation!.dispatch({ type: 'SET_POSE', instanceId: 'k12-g', position: [6, 2.7, -7.5], yawDeg: y, tiltDeg: 0, mount: 'stand' }), yaw)
    await page.waitForFunction((y) => {
      const a = window.__creation!.coverage().aim.find((x) => x.id === 'k12-g')
      return !!a && Math.abs(Math.atan2(a.to[0] - a.from[0], a.to[2] - a.from[2]) - ((((y + 180) % 360) - 180) * Math.PI) / 180) < 1e-6
    }, yaw)
    const f = await page.evaluate(() => window.__creation!.modelFront('k12-g'))
    close(f!, await aimDir(page, 'k12-g'))
    const rad = (yaw * Math.PI) / 180
    close(f!, [Math.sin(rad), 0, Math.cos(rad)])
  }
})

test('(c) the connector markers of a corrected K12.2 stay behind it (-z at yaw 0): they sit on the amplifier end, not on the baffle', async ({ page }) => {
  await boot(page)
  const r = await page.evaluate(() => {
    const c = window.__creation!
    return { centre: c.deviceBodyCenter('k12-g')!, ports: ['in-line-a', 'thru-out-a', 'power-in'].map((p) => c.portWorld({ instance: 'k12-g', port: p })!) }
  })
  for (const p of r.ports) expect(p[2]).toBeLessThan(r.centre[2] - 0.1)
})

test('(d) the 8030C faces +z at yaw 0 (declared front turned onto +z); the DBR12 declares none: nothing is turned and no front is claimed', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'genelec-8030c', position: [0, 0, 0], rotationY: 0, instanceId: 'gen' })
    c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-dbr12', position: [3, 0, 0], rotationY: 0, instanceId: 'dbr' })
  })
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  const r = await page.evaluate(() => ({ gen: window.__creation!.modelFront('gen'), dbr: window.__creation!.modelFront('dbr'), dbrCentre: window.__creation!.deviceBodyCenter('dbr') }))
  close(r.gen!, [0, 0, 1])
  expect(r.dbr, 'DBR12: no declared front, so none is reported').toBeNull()
  expect(r.dbrCentre, 'the DBR12 model is still there').not.toBeNull()
})

test('(e) the model-front note: hidden while every contributing speaker has a declared front (K12.2 rig); shown, naming the instance, for a DBR12 (none declared)', async ({ page }) => {
  await boot(page)
  await expect(page.getByTestId('coverage-caveat')).toBeHidden()
  // swap the left K12.2 for a DBR12 at the same place, powered and fed like it
  const ok = await page.evaluate(() => {
    const c = window.__creation!
    return [
      c.dispatch({ type: 'REMOVE', instanceId: 'k12-g' }).ok,
      c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-dbr12', position: [6, 2.7, -7.5], rotationY: 0, instanceId: 'dbr-g', mount: 'stand' }).ok,
      c.dispatch({ type: 'CONNECT', a: { instance: 'mains', port: 'out-2' }, b: { instance: 'dbr-g', port: 'power-in' } }).ok,
      c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'dbr-g', port: 'in-line' } }).ok,
    ]
  })
  expect(ok).toEqual([true, true, true, true])
  await page.waitForFunction(() => window.__creation!.coverage().sources.includes('dbr-g'), null, { timeout: 20_000 })
  await waitReady(page)
  const note = page.getByTestId('coverage-caveat')
  await expect(note).toBeVisible()
  await expect(note).toHaveText('Face avant du modèle 3D non vérifiée pour dbr-g : le trait indique l’axe acoustique, pas forcément la face du modèle.')
  expect(await page.evaluate(() => window.__creation!.modelFront('dbr-g'))).toBeNull() // nothing was turned, nothing is claimed
})
