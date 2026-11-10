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
 *   yamaha-dbr12   --  ORIENTATION NOT ESTABLISHED. The model lies horizontally (65.5 x 57.6 x 158.4 units, long axis on z, not a 376 x 601 x 348 mm
 *                      cabinet) and looks rolled or pitched by about 90 degrees: the grille, the logo and the woofer ring are on one long face, only the
 *                      port_* empties sit on an end face (z = 79.29). It appears to lie on its side, so it needs a pitch or roll fix, which a yaw-only
 *                      `modelFront` cannot give. The catalog carries no `modelFront` for it; the coverage block keeps its note for it.
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

const MEASURED: Record<string, FrontAxis | null> = { 'qsc-k12-2': '-z', 'genelec-8030c': '-z', 'yamaha-dbr12': null }

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
  const pipeline = doc.getRoot().listNodes().some((n) => (n.getExtras() as { tekpractice?: unknown } | null)?.tekpractice !== undefined)
  return { pts, ports, lo, hi, pipeline }
}

/** The root of a scaled import once DeviceSpawner has set its uniform scale: the loader's 180 degree turn about y, positive scale (see DeviceSpawner). */
const scaledImport = Matrix.Compose(new Vector3(0.025, 0.025, 0.025), new Quaternion(0, 1, 0, 0), new Vector3(0.3, 0.2, -0.4)) // translated, as the spawner leaves it after grounding / centring

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

  // K12.2 and 8030C were REBUILT (Meshy, fixed up to the spec, tekpractice extras): the facts below replace the legacy-scan evidence that used to be here
  // (the K12.2 plan was read as wide / narrow ends, the 8030C by eye). A pipeline model has its I/O face at glTF +z with the port empties on or just behind it,
  // so its baffle is the opposite face (-z in the file), which the scene turns onto +z at yaw 0 by convention; DeviceSpawner applies NO catalog front turn to it.
  // The catalog's modelFront for these two devices describes the legacy files and is inert for a pipeline model (content/catalog.json is not edited by the 3D
  // pipeline: remove modelFront there when the catalog is next revised).
  it.each([
    ['qsc-k12-2', 0.04, { w: 0.356, h: 0.602, d: 0.35 }],
    ['genelec-8030c', 0.02, { w: 0.189, h: 0.299, d: 0.178 }],
  ] as const)('%s is a pipeline model: its spec size in metres, and its port empties on the I/O face (glTF +z) within the jack depth', async (id, maxInset, size) => {
    const { ports, lo, hi, pipeline } = await read(id)
    expect(pipeline, `${id}: the tekpractice extras (the spawner trusts the file's own empties)`).toBe(true)
    expect(hi[0] - lo[0], `${id} width`).toBeCloseTo(size.w, 3)
    expect(hi[1] - lo[1], `${id} height`).toBeCloseTo(size.h, 3)
    expect(hi[2] - lo[2], `${id} depth`).toBeCloseTo(size.d, 3)
    expect(Object.keys(ports).length, `${id}: has its ports`).toBeGreaterThan(1)
    for (const [pid, p] of Object.entries(ports)) {
      expect(p[2], `${id} ${pid}: on or behind the +z face`).toBeLessThanOrEqual(hi[2] + 1e-4)
      expect(p[2], `${id} ${pid}: no deeper than the jack recess`).toBeGreaterThanOrEqual(hi[2] - maxInset)
    }
  })
})
