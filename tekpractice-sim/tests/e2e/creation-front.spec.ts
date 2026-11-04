import { expect, test, type Page } from '@playwright/test'
import catalog from '../../content/catalog.json'

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

// ── Task 43c fix round ──────────────────────────────────────────────────────

/** Spawned already turned, so the model loads under a ROTATED parent (reload, undo of a removal, duplicate, rig change all do this). */
test('(f) a corrected device LOADED at yaw 90 / 200 (not turned afterwards): its front equals the placement direction, and for a fed K12.2 the aim line', async ({ page }) => {
  await boot(page)
  for (const yaw of [90, 200]) {
    const rad = (yaw * Math.PI) / 180
    // fed K12.2: turn it, remove it, undo the removal: the respawn runs the model load under the turned parent
    await page.evaluate((y) => window.__creation!.dispatch({ type: 'SET_POSE', instanceId: 'k12-g', position: [6, 2.7, -7.5], yawDeg: y, tiltDeg: 0, mount: 'stand' }), yaw)
    expect(await page.evaluate(() => window.__creation!.dispatch({ type: 'REMOVE', instanceId: 'k12-g' }).ok)).toBe(true)
    expect(await page.evaluate(() => window.__creation!.undo())).toBe(true)
    await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
    await page.waitForFunction((y) => {
      const a = window.__creation!.coverage().aim.find((x) => x.id === 'k12-g')
      return !!a && Math.abs(Math.atan2(a.to[0] - a.from[0], a.to[2] - a.from[2]) - ((((y + 180) % 360) - 180) * Math.PI) / 180) < 1e-6
    }, yaw)
    const f = await page.evaluate(() => window.__creation!.modelFront('k12-g'))
    expect(f, `k12-g respawned at yaw ${yaw}`).not.toBeNull()
    close(f!, await aimDir(page, 'k12-g'))
    close(f!, [Math.sin(rad), 0, Math.cos(rad)])
    // spawned directly at that yaw: a K12.2 and the 8030C
    await page.evaluate(
      ([y]) => {
        const c = window.__creation!
        c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', position: [0, 0, 0], rotationY: y, instanceId: `k-${y}` })
        c.dispatch({ type: 'SPAWN', deviceId: 'genelec-8030c', position: [3, 0, 0], rotationY: y, instanceId: `g-${y}` })
      },
      [yaw]
    )
    await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
    for (const id of [`k-${yaw}`, `g-${yaw}`]) {
      const v = await page.evaluate((i) => window.__creation!.modelFront(i), id)
      expect(v, id).not.toBeNull()
      close(v!, [Math.sin(rad), 0, Math.cos(rad)])
    }
  }
})

test('(g) a device lands ON its placement and on the floor at any yaw (centre within 2 cm of (x, z), lowest point within 1 cm of 0), and its port markers keep their place in the placement frame, yaw 0 / 90 / 180 / 200', async ({ page }) => {
  await boot(page)
  const devices = ['qsc-k12-2', 'yamaha-dbr12', 'genelec-8030c', 'yamaha-ql1', 'yamaha-rio3224-d2', 'shure-sm58']
  const yaws = [0, 90, 180, 200]
  const spawned = await page.evaluate(
    ([devs, ys]) => {
      const c = window.__creation!
      const out: { id: string; device: string; yaw: number; x: number; z: number }[] = []
      let i = 0
      for (const d of devs as string[])
        for (const y of ys as number[]) {
          const id = `p-${d}-${y}`
          const x = -9 + (i % 6) * 2.4
          const z = 4 + Math.floor(i / 6) * 2.4
          c.dispatch({ type: 'SPAWN', deviceId: d, position: [x, 0, z], rotationY: y, instanceId: id })
          out.push({ id, device: d, yaw: y, x, z })
          i++
        }
      return out
    },
    [devices, yaws]
  )
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  const rows = await page.evaluate(
    (s) =>
      s.map((p) => {
        const c = window.__creation!
        const rad = (p.yaw * Math.PI) / 180
        // every marker in the frame of the placement: the world offset turned back by the yaw (world = R(yaw) local: x = lx cos + lz sin, z = -lx sin + lz cos)
        const markers = c.devicePorts(p.id).map((port) => {
          const w = c.portWorld({ instance: p.id, port })!
          const dx = w[0] - p.x
          const dz = w[2] - p.z
          return [port, dx * Math.cos(rad) - dz * Math.sin(rad), w[1], dx * Math.sin(rad) + dz * Math.cos(rad)] as [string, number, number, number]
        })
        return { ...p, c: c.deviceBodyCenter(p.id), b: c.bodyBoundsInRoot(p.id), markers }
      }),
    spawned
  )
  for (const p of rows) {
    expect(p.c, p.id).not.toBeNull()
    expect(p.b, p.id).not.toBeNull()
    // the exact oracle: the vertices in the frame of the placement (no world-box blur from the yaw)
    expect(Math.hypot((p.b!.lo[0] + p.b!.hi[0]) / 2, (p.b!.lo[2] + p.b!.hi[2]) / 2), `${p.id}: body centre vs placement (x, z), in the placement's frame`).toBeLessThan(0.02)
    expect(Math.abs(p.b!.lo[1]), `${p.id}: the lowest point of the body is on the floor`).toBeLessThan(0.01)
    // and the world box centre the other tests use (a box of boxes: allowed 3 cm of its own blur at a turned yaw)
    expect(Math.hypot(p.c![0] - p.x, p.c![2] - p.z), `${p.id}: world body centre vs placement (x, z)`).toBeLessThan(0.03)
  }
  // the markers of the QL1 and the RIO (real port_* empties, no front correction) are where they are at yaw 0, in the placement frame, whatever the yaw
  for (const device of ['yamaha-ql1', 'yamaha-rio3224-d2']) {
    const at0 = rows.find((r) => r.device === device && r.yaw === 0)!
    expect(at0.markers.length, `${device}: has ports`).toBeGreaterThan(3)
    for (const r of rows.filter((q) => q.device === device && q.yaw !== 0))
      for (const [port, lx, ly, lz] of r.markers) {
        const ref = at0.markers.find((m) => m[0] === port)!
        expect(Math.hypot(lx - ref[1], lz - ref[3]), `${r.id} ${port}: marker (x, z) in the placement frame vs yaw 0`).toBeLessThan(0.01)
        expect(Math.abs(ly - ref[2]), `${r.id} ${port}: marker height`).toBeLessThan(0.01)
      }
  }
})

test('(h) the port markers of a corrected K12.2 sit on its rear face (x within the rear width, z behind the body), at yaw 0 and when loaded turned 180', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', position: [0, 0, 0], rotationY: 0, instanceId: 'r0' })
    c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', position: [4, 0, 0], rotationY: 180, instanceId: 'r180' })
  })
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  const r = await page.evaluate(() => {
    const c = window.__creation!
    const ports = (i: string) => ['in-line-a', 'thru-out-a', 'power-in'].map((p) => c.portWorld({ instance: i, port: p })!)
    return { ends: c.bodyEnds('r0')!, p0: ports('r0'), p180: ports('r180'), c0: c.deviceBodyCenter('r0')!, c180: c.deviceBodyCenter('r180')! }
  })
  const [lo, hi] = r.ends.rearX
  for (const p of r.p0) {
    expect(p[0], 'marker x within the rear width (+1 cm)').toBeGreaterThanOrEqual(lo - 0.01)
    expect(p[0]).toBeLessThanOrEqual(hi + 0.01)
    expect(p[2], 'behind the rear plane').toBeLessThan(r.ends.rearZ + 0.005)
    expect(p[2], 'but close to it (within 6 cm)').toBeGreaterThan(r.ends.rearZ - 0.06)
  }
  // turned 180: the same markers, mirrored about the placement (x, z) = (4, 0)
  r.p180.forEach((p, i) => {
    expect(p[0] - 4, `marker ${i} x mirrored`).toBeCloseTo(-(r.p0[i][0] - 0), 2)
    expect(p[2], `marker ${i} z mirrored`).toBeCloseTo(-r.p0[i][2], 2)
  })
})

test('(i) the port markers of a corrected 8030C sit on its rear face (x and z), at yaw 0', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'genelec-8030c', position: [0, 0, 0], rotationY: 0, instanceId: 'g0' }))
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  const r = await page.evaluate(() => {
    const c = window.__creation!
    return { ends: c.bodyEnds('g0')!, b: c.bodyBoundsInRoot('g0')!, ports: ['in-analog', 'power-in'].map((p) => c.portWorld({ instance: 'g0', port: p })!) }
  })
  // night wave 1 review finding 6: the markers are on the CABINET's rear face, not on the stand neck (the model's lowest baseFraction is stand)
  const stand = (catalog.devices.find((d) => d.id === 'genelec-8030c') as { modelBody: { baseFraction: number } }).modelBody.baseFraction
  const cabinetBottom = r.b.lo[1] + stand * (r.b.hi[1] - r.b.lo[1])
  for (const p of r.ports) {
    expect(p[1], 'marker height above the stand').toBeGreaterThanOrEqual(cabinetBottom - 0.005)
    expect(p[1], 'and under the top of the cabinet').toBeLessThanOrEqual(r.b.hi[1] + 0.005)
  }
  const [lo, hi] = r.ends.rearX
  for (const p of r.ports) {
    expect(p[0], '8030C marker x within the rear width (+1 cm)').toBeGreaterThanOrEqual(lo - 0.01)
    expect(p[0]).toBeLessThanOrEqual(hi + 0.01)
    expect(p[2], 'behind the rear plane').toBeLessThan(r.ends.rearZ + 0.005)
    expect(p[2], 'but close to it (within 6 cm)').toBeGreaterThan(r.ends.rearZ - 0.06)
  }
})

// ── Night wave 1, item 8: the 8030C file includes its floor stand; the cabinet, not the whole model, has the real height ───────────────────────
test('(j) the 8030C cabinet is the catalog cabinet height (0,285 m, within 5 mm): the stand under it is not counted in the normalisation; the K12.2 is unchanged', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'genelec-8030c', position: [0, 0, 0], rotationY: 0, instanceId: 'g0' })
  })
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  const r = await page.evaluate(() => ({ g: window.__creation!.bodyBoundsInRoot('g0'), k: window.__creation!.bodyBoundsInRoot('k12-g') }))
  expect(r.g, 'the 8030C model is loaded').not.toBeNull()
  const body = (catalog.devices.find((d) => d.id === 'genelec-8030c') as { modelBody?: { baseFraction: number; cabinetHeightM: number } }).modelBody!
  const total = r.g!.hi[1] - r.g!.lo[1]
  expect(Math.abs(r.g!.lo[1]), 'the stand stands on the floor').toBeLessThan(0.01)
  // the cabinet is what is above the stand (baseFraction is re-measured on the file by tests/assets/modelBody.test.ts); cabinetHeightM is the datasheet's
  const cabinet = total * (1 - body.baseFraction)
  expect(Math.abs(cabinet - body.cabinetHeightM), `cabinet = ${cabinet.toFixed(4)} m (whole model ${total.toFixed(4)} m)`).toBeLessThan(0.005)
  // the old normalisation (the whole model 0,299 m, cabinet 0,214 m) is far away
  expect(total).toBeGreaterThan(0.38)
  // a single-body model keeps its whole height: the K12.2 is 0,602 m
  expect(r.k!.hi[1] - r.k!.lo[1]).toBeCloseTo(0.602, 1)
})
