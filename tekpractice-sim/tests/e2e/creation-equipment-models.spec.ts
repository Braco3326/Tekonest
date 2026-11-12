import { readFileSync } from 'node:fs'
import { expect, test, type Response } from '@playwright/test'

/**
 * Build-all-equipment (Wave 1 gate): every device the equipment plan marks `staged`, `promoted` or `betaModelled` is placed in Mode Création, in ONE scene
 * and ONE batch, and checked from what the page really did, not from the app's own counters:
 *   - its glb was requested and answered 200, not as text/html (a SPA fallback), and the body is a glTF binary ("glTF" magic): no 404, no console error;
 *   - the model is REALLY there (Wave 1b finding 2): the instance's asset status is 'glb' (the spawner falls back to a placeholder box silently when the
 *     glb cannot be decoded: a 200 and a glTF magic do not prove the model loaded), and its body box matches the size in its asset spec within 1 mm;
 *     the device can be selected by a real click on it;
 *   - every port of the device (catalogue ports for a promoted device, the Bêta proposal's ports for a beta-modelled one) has its pick proxy
 *     (the pick sphere: >= 12 px at any distance) and a screen position.
 * The expected devices are read from the plan, the catalogue and the proposals files, never listed here. A staged row that is neither in the
 * catalogue nor in the proposals is a stage 2 that did not run: it fails here, by name.
 * Scales to the whole plan (about 190 devices): the devices are placed in BATCHES of 20, each batch in a fresh page (a reset between batches keeps the
 * scene, the model memory and the pick checks inside the e2e budgets); one test per batch, so a failure names its batch and its devices.
 * Cheap on purpose: one room, devices dropped with SPAWN on a staggered grid, no audio, no screenshots.
 */
test.use({ viewport: { width: 1366, height: 768 } })
test.setTimeout(240_000)

/** Devices per scene. 20 keeps one batch near a minute with the pick checks and well inside the scene budget. */
const BATCH_SIZE = 20

interface PlanRow {
  id: string
  staged?: boolean
  promoted?: boolean
  betaModelled?: boolean
}
interface Dev {
  id: string
  label: string
  ports: { portId: string }[]
}
const plan = (JSON.parse(readFileSync('content/proposals/equipment-plan.json', 'utf8')) as { rows: PlanRow[] }).rows
const catalogue = new Map((JSON.parse(readFileSync('content/catalog.json', 'utf8')) as { devices: Dev[] }).devices.map((d) => [d.id, d]))
const proposals = new Map((JSON.parse(readFileSync('content/proposals/catalog-proposals.json', 'utf8')) as { devices: Dev[] }).devices.map((d) => [d.id, d]))
const rows = plan.filter((r) => r.staged === true || r.promoted === true || r.betaModelled === true)
const spawnable = rows.filter((r) => catalogue.has(r.id) || proposals.has(r.id))

/** The size of the model's body, w x h x d in mm, from the asset spec (the size the glb is built and gated to). */
const specSizeMm = (id: string): { w: number; h: number; d: number } | null => {
  try {
    return (JSON.parse(readFileSync(`content/asset-specs/${id}.json`, 'utf8')) as { realSizeMm: { w: number; h: number; d: number } }).realSizeMm
  } catch {
    return null
  }
}
const SIZE_TOLERANCE_MM = 1

const glbId = (url: string): string | null => /\/assets\/([^/?#]+)\.glb(?:[?#]|$)/.exec(url)?.[1] ?? null
const PLACE = 'room:concert-hall-medium'
const batches: PlanRow[][] = Array.from({ length: Math.ceil(spawnable.length / BATCH_SIZE) }, (_, i) => spawnable.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE))

test('the plan has devices to check, each is in the catalogue (promoted) or the proposals (beta-modelled), and no row is stuck between the stages', () => {
  expect(rows.length).toBeGreaterThan(0)
  const stuck = rows.filter((r) => !catalogue.has(r.id) && !proposals.has(r.id)).map((r) => r.id)
  expect(stuck, 'staged rows with neither a catalogue entry nor a proposal: run `npm run promote -- <id> --commit`').toEqual([])
  for (const r of rows.filter((x) => x.promoted)) expect(catalogue.has(r.id), `${r.id} promoted: in the catalogue`).toBe(true)
  for (const r of rows.filter((x) => x.betaModelled)) expect(proposals.has(r.id) && !catalogue.has(r.id), `${r.id} beta-modelled: a proposal, not a catalogue device`).toBe(true)
})

test('the batches cover every staged, promoted or beta-modelled row exactly once (never a green run over an empty list)', () => {
  expect(spawnable.length, 'devices to check').toBeGreaterThan(0)
  expect(spawnable.length, 'every staged / promoted / beta-modelled row is spawnable').toBe(rows.length)
  expect(batches.length).toBeGreaterThan(0)
  expect(batches.flat().map((r) => r.id).sort()).toEqual(spawnable.map((r) => r.id).sort())
  for (const b of batches) expect(b.length).toBeLessThanOrEqual(BATCH_SIZE)
})

for (const [bi, batch] of batches.entries())
test(`batch ${bi + 1} of ${batches.length}: ${batch.length} devices (${batch[0]!.id} .. ${batch[batch.length - 1]!.id}) load their models and have their ports`, async ({ page }) => {
  const consoleErrors: string[] = []
  const responses = new Map<string, Response>()
  const notFound: string[] = []
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  page.on('response', (r) => {
    const id = glbId(r.url())
    if (id) responses.set(id, r)
    if (r.status() === 404) notFound.push(r.url())
  })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate((p) => window.__creation!.choosePlace(p), PLACE)
  await page.waitForFunction((p) => window.__creation!.place() === p, PLACE)

  // one batch on a staggered grid (2 m columns, 2.5 m rows, each row shifted by 0.5 m more than the one before) on the floor of the hall: no device stands straight behind another
  // along the camera's line of sight, because the pick sphere of a port is at least 12 px wide at any distance and the port picking does not test occlusion, so
  // the port of a device BEHIND the one being clicked would answer at its centre (found with the speaker yamaha-dxr12-mkii and the lavaliers).
  // A batch is dropped on the floor of the hall. A catalogue device is dropped with SPAWN; a Bêta proposal is registered only when it is chosen
  // (src/creation/boot.ts registerBeta), so a beta-modelled device is chosen from the drawer's Bêta tab like a user does, then moved to its slot.
  const placed = batch.map((r, i) => ({ id: r.id, inst: `eq-${i}`, at: [((i % 5) - 2) * 2 + Math.floor(i / 5) * 0.5, 0, 6 + Math.floor(i / 5) * 2.5] as [number, number, number], beta: !catalogue.has(r.id) }))
  const spawned = await page.evaluate(
    (list) => list.filter((d) => !d.beta).map((d) => [d.id, window.__creation!.dispatch({ type: 'SPAWN', deviceId: d.id, instanceId: d.inst, position: d.at }).ok] as const),
    placed,
  )
  expect(spawned.filter(([, ok]) => !ok).map(([id]) => id), 'catalogue devices the store refused').toEqual([])
  const drawer = page.getByTestId('inventory-drawer')
  for (const d of placed.filter((x) => x.beta)) {
    await page.locator('#renderCanvas').focus()
    await page.keyboard.press('Space')
    await expect(drawer).toBeVisible()
    await page.getByRole('tab', { name: 'Bêta' }).click()
    await page.locator(`[data-testid="inventory-item"][data-device-id="${d.id}"]`).click()
    await expect(drawer).toBeHidden()
    await page.keyboard.press('Enter') // dropped where the ghost stands
    await expect.poll(() => page.evaluate((id) => window.__creation!.design().rig.instances.some((i) => i.deviceId === id), d.id)).toBe(true)
    d.inst = await page.evaluate((id) => window.__creation!.design().rig.instances.find((i) => i.deviceId === id)!.instanceId, d.id)
    const moved = await page.evaluate((x) => window.__creation!.dispatch({ type: 'SET_POSE', instanceId: x.inst, position: x.at, yawDeg: 0, tiltDeg: 0, mount: 'floor' }).ok, d)
    expect(moved, `${d.id}: moved to its slot`).toBe(true)
  }
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0, null, { timeout: 90_000 })
  await page.waitForTimeout(400) // a late request or console line would show here

  const problems: string[] = []

  // 1. the glb: requested, 200, a glTF binary, not text/html
  for (const d of placed) {
    const res = responses.get(d.id)
    if (!res) {
      problems.push(`${d.id}: its glb was never requested`)
      continue
    }
    if (res.status() !== 200) problems.push(`${d.id}: glb answered ${res.status()}`)
    const type = res.headers()['content-type'] ?? ''
    if (/text\/html/i.test(type)) problems.push(`${d.id}: glb answered as ${type} (a fallback page, not a model)`)
    const body = await res.body()
    if (body.subarray(0, 4).toString('latin1') !== 'glTF') problems.push(`${d.id}: the response is not a glTF binary`)
  }

  // 2. the model is in the scene: really loaded (not the placeholder fallback), a body to pick and to frame, at the size of its spec within 1 mm
  for (const d of placed) {
    const status = await page.evaluate((i) => window.__creation!.assetStatus(i), d.inst)
    if (status !== 'glb') problems.push(`${d.id}: asset status is ${String(status)}, not glb (the model fell back to a placeholder box)`)
    const bounds = await page.evaluate((i) => window.__creation!.bodyBoundsInRoot(i), d.inst)
    if (bounds === null) {
      problems.push(`${d.id}: no body in the scene`)
      continue
    }
    const want = specSizeMm(d.id)
    if (!want) {
      problems.push(`${d.id}: no asset spec to compare the body size with`)
      continue
    }
    const got = { w: (bounds.hi[0] - bounds.lo[0]) * 1000, h: (bounds.hi[1] - bounds.lo[1]) * 1000, d: (bounds.hi[2] - bounds.lo[2]) * 1000 }
    for (const k of ['w', 'h', 'd'] as const) if (!(Math.abs(got[k] - want[k]) <= SIZE_TOLERANCE_MM)) problems.push(`${d.id}: body ${k} is ${got[k].toFixed(2)} mm, its spec says ${want[k]} mm (tolerance ${SIZE_TOLERANCE_MM} mm)`)
  }

  // 3. selectable by a real click, and every port has its pick proxy and a screen position
  for (const d of placed) {
    expect(await page.evaluate((i) => window.__creation!.frameDevice(i), d.inst), `${d.id}: frameDevice`).toBe(true)
    // the camera is on the device: the flight is over AND the body is on screen (a flight that has not started yet reads as « not moving » while the camera
    // still frames the previous device, so the flag alone is not enough)
    await page
      .waitForFunction(
        (i) => {
          const c = window.__creation!
          const b = c.deviceScreen(i)
          const r = document.getElementById('renderCanvas')!.getBoundingClientRect()
          return !c.cameraMoving() && b !== null && b.x > r.left && b.x < r.right && b.y > r.top && b.y < r.bottom
        },
        d.inst,
        { timeout: 10_000 },
      )
      .catch(() => problems.push(`${d.id}: the camera did not bring the device on screen`))
    await page.evaluate(() => window.__creation!.frameDevice(null)) // clear the selection, the camera stays
    // a point of the body that is the device's own (not under a port marker, a ring or a cable): a click there is what a user does to select it
    // (the search is repeated for up to 1.5 s: the picking of a frame that was just rendered can lag, and a lavalier of 4 mm is a few pixels wide, so the
    // first 15 px around its centre are scanned pixel by pixel before the wider rings are scanned every 3 px)
    const findPoint = (i: string) =>
      page.evaluate((i) => {
      const c = window.__creation!
      const body = c.deviceScreen(i)
      if (!body) return null
      const r = document.getElementById('renderCanvas')!.getBoundingClientRect()
      for (let k = 0; k <= 220; k += k < 15 ? 1 : 3)
        for (let a = 0; a < (k === 0 ? 1 : 12); a++) {
          const x = body.x + k * Math.cos((a * Math.PI) / 6)
          const y = body.y + k * Math.sin((a * Math.PI) / 6)
          if (c.pickAt(x - r.left, y - r.top) === i && c.portAtPoint(x - r.left, y - r.top) === null && c.cableAtPage(x, y) === null) return { x, y }
        }
      return { x: body.x, y: body.y, covered: true }
    }, i)
    // the pointer rests where the previous click was, which is the centre of the screen, where this device now stands: a device under the pointer shows its
    // ports at full size (hover), so the pointer is parked in a corner before the search
    await page.mouse.move(3, 3)
    await page.waitForTimeout(100)
    let at = await findPoint(d.inst)
    for (let tries = 0; tries < 6 && at && 'covered' in at; tries++) {
      await page.waitForTimeout(250)
      at = await findPoint(d.inst)
    }
    if (!at) {
      problems.push(`${d.id}: no click point on screen`)
      continue
    }
    // A device whose whole body (within 220 px of its centre) is under pick spheres of ITS OWN ports (a lavalier a few millimetres wide, where the sphere is at
    // least 12 px; or a small recorder whose four 40 px spheres tile it at this camera distance): a click there starts a cable, it does not select, so no
    // body click is made. The check is that the point answers with one of ITS OWN ports, and the device is listed in the test's annotations. A body covered by
    // anything else still fails.
    if ('covered' in at) {
      const own = await page.evaluate((x) => window.__creation!.portAtPoint(x.x - document.getElementById('renderCanvas')!.getBoundingClientRect().left, x.y - document.getElementById('renderCanvas')!.getBoundingClientRect().top), at)
      if (!own || own.instance !== d.inst) problems.push(`${d.id}: every point of its body (within 220 px of its centre) is covered, and not by its own ports (${JSON.stringify(own)})`)
      // Review fix 17: the device is NOT excused. It is selected through its project-tree row (the keyboard / screen-reader way to select a device), and the test
      // fails when that selection is impossible.
      const row = page.getByRole('tree', { name: 'Projet' }).getByRole('treeitem', { name: new RegExp('\\(' + d.inst + '\\)$') })
      if ((await row.count()) !== 1) problems.push(`${d.id}: its body is covered by its own ports and it has no project-tree row to select it by`)
      else {
        await row.click()
        const viaTree = await page.evaluate(() => window.__creation!.selection())
        if (viaTree !== d.inst) problems.push(`${d.id}: its body is covered by its own ports and the project-tree row selected ${String(viaTree)}`)
      }
    } else {
      await page.mouse.click(at.x, at.y)
      const selected = await page.evaluate(() => window.__creation!.selection())
      if (selected !== d.inst) problems.push(`${d.id}: a click on it selected ${String(selected)}`)
    }

    const expected = (catalogue.get(d.id) ?? proposals.get(d.id))!.ports.map((p) => p.portId)
    const got = await page.evaluate((i) => window.__creation!.devicePorts(i), d.inst)
    if (JSON.stringify([...got].sort()) !== JSON.stringify([...expected].sort())) problems.push(`${d.id}: ports on the scene ${got.join(',')} differ from the declared ${expected.join(',')}`)
    for (const portId of expected) {
      const radius = await page.evaluate((r) => window.__creation!.portProxyRadiusPx(r), { instance: d.inst, port: portId })
      if (!(radius >= 12)) problems.push(`${d.id}.${portId}: no pick sphere (radius ${radius})`)
    }
  }

  // 4. the page stayed clean
  expect(problems, problems.join('\n')).toEqual([])
  expect(notFound).toEqual([])
  expect(consoleErrors).toEqual([])
  expect(await page.evaluate(() => window.__creation!.modelsPending())).toBe(0)
})
