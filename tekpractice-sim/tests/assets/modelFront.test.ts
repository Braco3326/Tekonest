/**
 * Task 43c (L34, decision L30 viii): the measured front of each shipped loudspeaker .glb, against the catalog's `modelFront` data and the
 * correction the spawner applies. The MEASURED table below is the fixture: each entry says what was read on the file and how (the evidence is
 * also in the catalog, `modelFront.evidence`). A speaker with no entry here, or an entry the catalog disagrees with, fails: a new speaker model
 * must be measured, not assumed.
 *
 *   qsc-k12-2      +z  derived below from the file itself: the +z end is the wide one (14 in) with the flat grille plate; the -z end is the 6.6 in
 *                      amplifier end. Confirmed on screen (Playwright, Face and Arrière views at yaw 0, before and after the fix).
 *   genelec-8030c  -x  read by eye on a textured scan, confirmed on screen (woofer and tweeter on the -x face, the amplifier plate on +x). No
 *                      numeric oracle: a sphere-like scan has no wide / narrow end. The e2e and the screenshots are its evidence.
 *   yamaha-dbr12   --  NOT ESTABLISHED. The mesh is a 158 x 65 x 58 unit triangular prism (not a 376 x 601 x 348 mm cabinet), its grille texture sits
 *                      on a long side face and its connector empties on an end face: a speaker has its connectors opposite its grille, so the file
 *                      contradicts itself and no front can be named with evidence. The catalog carries no `modelFront` for it; the coverage block
 *                      keeps its note for it.
 *
 * When a REBUILT model of one of these devices lands (I/O toward -Z, front toward +Z): remove its `modelFront` from content/catalog.json and set its
 * entry in MEASURED to null; tests/assets/speakerFront.test.ts will have failed first, on purpose, to say the file changed.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { describe, expect, it } from 'vitest'
import { frontDirection, yawOntoPlusZ, type FrontAxis } from '../../src/scene/modelFront'

const draco3d = createRequire(import.meta.url)('draco3dgltf') as { createDecoderModule(): Promise<unknown> }
const root = resolve(__dirname, '../..')
const catalog = JSON.parse(readFileSync(resolve(root, 'content/catalog.json'), 'utf8')) as {
  devices: { id: string; acoustic?: unknown; modelFront?: { axis: FrontAxis; evidence: string } }[]
}

const MEASURED: Record<string, FrontAxis | null> = { 'qsc-k12-2': '+z', 'genelec-8030c': '-x', 'yamaha-dbr12': null }

async function read(id: string) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() })
  const doc = await io.read(resolve(root, `public/assets/${id}.glb`))
  const pts: number[][] = []
  const ports: Record<string, number[]> = {}
  for (const n of doc.getRoot().listNodes()) {
    if (n.getName().startsWith('port_')) {
      ports[n.getName().slice(5)] = n.getWorldTranslation() as number[]
      continue
    }
    const m = n.getMesh()
    if (!m) continue
    const w = n.getWorldMatrix()
    for (const prim of m.listPrimitives()) {
      const a = prim.getAttribute('POSITION')!
      const v = [0, 0, 0]
      for (let i = 0; i < a.getCount(); i++) {
        a.getElement(i, v)
        pts.push([w[0] * v[0] + w[4] * v[1] + w[8] * v[2] + w[12], w[1] * v[0] + w[5] * v[1] + w[9] * v[2] + w[13], w[2] * v[0] + w[6] * v[1] + w[10] * v[2] + w[14]])
      }
    }
  }
  const lo = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k])))
  const hi = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])))
  return { pts, ports, lo, hi }
}
const span = (v: number[]): number => Math.max(...v) - Math.min(...v)

/** The root of a scaled import once DeviceSpawner has set its uniform scale: the loader's 180 degree turn about y, positive scale (see DeviceSpawner). */
const scaledImport = Matrix.Compose(new Vector3(0.025, 0.025, 0.025), new Quaternion(0, 1, 0, 0), Vector3.Zero())

describe('the loudspeaker models: measured front vs catalog data (Task 43c, L34)', () => {
  const speakers = catalog.devices.filter((d) => d.acoustic !== undefined)

  it('every catalog loudspeaker has a measurement entry here, and no entry is for something that is not one', () => {
    expect(speakers.map((d) => d.id).sort()).toEqual(Object.keys(MEASURED).sort())
  })

  it('the catalog carries modelFront exactly where a front was established, with the measured axis and some evidence', () => {
    for (const d of speakers) {
      const want = MEASURED[d.id]
      if (want === null) expect(d.modelFront, `${d.id}: not established, so no field (the note stays)`).toBeUndefined()
      else {
        expect(d.modelFront?.axis, d.id).toBe(want)
        expect(d.modelFront!.evidence.length, `${d.id}: evidence`).toBeGreaterThan(40)
      }
    }
  })

  it('after the spawner correction, the front of every speaker that has one faces +z at yaw 0', () => {
    for (const d of speakers) {
      if (!d.modelFront) continue
      const dir = frontDirection(d.modelFront.axis, scaledImport)
      const turned = Vector3.TransformNormal(dir, Matrix.RotationY(yawOntoPlusZ(dir)))
      expect(Vector3.Distance(turned, new Vector3(0, 0, 1)), `${d.id}: effective front`).toBeLessThan(1e-6)
    }
  })

  it('K12.2, derived from the file: the declared axis is the wide end of the plan (the baffle), the opposite end is the narrow amplifier end', async () => {
    const axis = catalog.devices.find((d) => d.id === 'qsc-k12-2')!.modelFront!.axis
    expect(axis).toBe('+z') // the test below reads z; a changed axis must be re-derived, not silently followed
    const { pts, lo, hi } = await read('qsc-k12-2')
    const depth = hi[2] - lo[2]
    const plusEnd = pts.filter((p) => p[2] >= hi[2] - 0.08 * depth)
    const minusEnd = pts.filter((p) => p[2] <= lo[2] + 0.08 * depth)
    expect(span(plusEnd.map((p) => p[0])), 'plan width at the declared front').toBeGreaterThan(13) // 14 in
    expect(span(minusEnd.map((p) => p[0])), 'plan width at the opposite end').toBeLessThan(8) // 6.6 in
  })

  it('the port_* empties of a corrected model are NOT on its rear face (why the spawner re-anchors its ports on the grid): K12.2 on the front face, 8030C on a side face', async () => {
    const k = await read('qsc-k12-2')
    for (const [id, p] of Object.entries(k.ports)) expect(p[2], `k12 ${id}`).toBeGreaterThanOrEqual(k.hi[2] - 0.05) // the +z (front) face
    const g = await read('genelec-8030c')
    const centreX = (g.lo[0] + g.hi[0]) / 2
    const rearIsPlusX = g.hi[0] - 0.05
    for (const [id, p] of Object.entries(g.ports)) {
      expect(Math.abs(p[0] - centreX), `8030C ${id}: on the middle of the x extent, not on a rear face`).toBeLessThan(0.3 * (g.hi[0] - g.lo[0]))
      expect(p[0], `8030C ${id}: not on the +x (rear) face`).toBeLessThan(rearIsPlusX)
      expect(p[2], `8030C ${id}: past the +z side face`).toBeGreaterThan(g.hi[2] - 0.05)
    }
  })
})
