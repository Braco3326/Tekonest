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
 * Cheap on purpose: one page, one room, devices dropped with SPAWN on a 1.5 m grid, no audio, no screenshots.
 */
test.use({ viewport: { width: 1366, height: 768 } })
test.setTimeout(240_000)

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

test('the plan has devices to check, each is in the catalogue (promoted) or the proposals (beta-modelled), and no row is stuck between the stages', () => {
  expect(rows.length).toBeGreaterThan(0)
  const stuck = rows.filter((r) => !catalogue.has(r.id) && !proposals.has(r.id)).map((r) => r.id)
  expect(stuck, 'staged rows with neither a catalogue entry nor a proposal: run `npm run promote -- <id> --commit`').toEqual([])
  for (const r of rows.filter((x) => x.promoted)) expect(catalogue.has(r.id), `${r.id} promoted: in the catalogue`).toBe(true)
  for (const r of rows.filter((x) => x.betaModelled)) expect(proposals.has(r.id) && !catalogue.has(r.id), `${r.id} beta-modelled: a proposal, not a catalogue device`).toBe(true)
})

test(`every staged, promoted or beta-modelled device loads its model and has its ports, in one scene (${spawnable.length} devices)`, async ({ page }) => {
  // never a green run over an empty list: a plan, catalogue or proposals read that found nothing would otherwise check nothing
  expect(spawnable.length, 'devices to check').toBeGreaterThan(0)
  expect(spawnable.length, 'every staged / promoted / beta-modelled row is spawnable').toBe(rows.length)
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

  // one batch on a 1.5 m grid on the floor of the hall. A catalogue device is dropped with SPAWN; a Bêta proposal is registered only when it is chosen
  // (src/creation/boot.ts registerBeta), so a beta-modelled device is chosen from the drawer's Bêta tab like a user does, then moved to its slot.
  const placed = spawnable.map((r, i) => ({ id: r.id, inst: `eq-${i}`, at: [((i % 7) - 3) * 1.5, 0, 6 + Math.floor(i / 7) * 1.5] as [number, number, number], beta: !catalogue.has(r.id) }))
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
    await page.waitForFunction(() => !window.__creation!.cameraMoving()) // the camera is on the device
    await page.evaluate(() => window.__creation!.frameDevice(null)) // clear the selection, the camera stays
    // a point of the body that is the device's own (not under a port marker, a ring or a cable): a click there is what a user does to select it
    const at = await page.evaluate((i) => {
      const c = window.__creation!
      const body = c.deviceScreen(i)
      if (!body) return null
      const r = document.getElementById('renderCanvas')!.getBoundingClientRect()
      for (let k = 0; k <= 60; k += 3)
        for (let a = 0; a < (k === 0 ? 1 : 12); a++) {
          const x = body.x + k * Math.cos((a * Math.PI) / 6)
          const y = body.y + k * Math.sin((a * Math.PI) / 6)
          if (c.pickAt(x - r.left, y - r.top) === i && c.portAtPoint(x - r.left, y - r.top) === null && c.cableAtPage(x, y) === null) return { x, y }
        }
      return { x: body.x, y: body.y, covered: true }
    }, d.inst)
    if (!at) {
      problems.push(`${d.id}: no click point on screen`)
      continue
    }
    if ('covered' in at) problems.push(`${d.id}: every point of its body near the centre is under a port marker or another object`)
    await page.mouse.click(at.x, at.y)
    const selected = await page.evaluate(() => window.__creation!.selection())
    if (selected !== d.inst) problems.push(`${d.id}: a click on it selected ${String(selected)}`)

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
