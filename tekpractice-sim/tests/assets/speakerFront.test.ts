/**
 * Task 37, the « glb front check » that ADR-0013 (addendum) and ADR-0015 handed to this task: which way do the shipped speaker models face?
 *
 * The acoustic axis is the placement's local +z (yaw 0 = the speaker faces +z). The scene puts a model's connector side (its `port_*` empties)
 * at −z (DeviceSpawner.normalizeModel: « I/O toward −Z »), so a model whose FRONT is on its connector side would face −z at yaw 0, the field
 * would be turned 180° and still look plausible. This test reads the real files (glTF space, y up) and pins what they say: it is evidence and a
 * tripwire, not an assertion that the models are right. DECIDED (L30 viii): the convention is kept and the models are being rebuilt; these tests document
 * TODAY's assets and are expected to fail, with an explanatory message, when the rebuilt models land. See docs/CREATIVE-MODE-LOG.md L30 and the Task 37 report.
 *
 * The findings pinned here (K12.2: the connector end is the wide end of its plan; DBR12: not a speaker-shaped box) and their figures are written
 * once, in ADR-0015 « Addendum (Task 37) »; the thresholds below are those figures.
 *
 * Task 43c (L34) acted on them: the catalog now carries `modelFront` for the K12.2 and the 8030C and the spawner turns those models onto +z (see
 * tests/assets/modelFront.test.ts, the measured table). These tests still describe the FILES, which are unchanged: when a rebuilt model lands and
 * they fail, also delete that device's `modelFront` from the catalog (the rebuilt model already faces +z).
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { createRequire } from 'node:module'

// draco3dgltf ships no types
const draco3d = createRequire(import.meta.url)('draco3dgltf') as { createDecoderModule(): Promise<unknown> }

const assets = resolve(__dirname, '../../public/assets')

async function read(name: string) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() })
  const doc = await io.read(resolve(assets, `${name}.glb`))
  const pts: [number, number, number][] = []
  const ports: Record<string, [number, number, number]> = {}
  for (const n of doc.getRoot().listNodes()) {
    if (n.getName().startsWith('port_')) {
      ports[n.getName().slice(5)] = n.getWorldTranslation() as [number, number, number]
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

/**
 * These are EVIDENCE of today's assets, not requirements (decision L30 viii, 2026-10-29: the convention is kept, the 3D models are being rebuilt with
 * the I/O face toward −Z, pivot bottom-centre). When a rebuilt model lands, a failure here is EXPECTED: it means the facts below changed. Then (1) re-check
 * which way the new model's FRONT faces at yaw 0 (it must face +z, connectors at −z), (2) update or delete these tests, (3) update L30 / ADR-0015 and
 * remove the device's `modelFront` from the catalog (L34: a rebuilt model already faces +z; the coverage note then never shows for it). The failure message says so: it is not a mystery.
 */
const evidence = (name: string, fn: () => Promise<void> | void) =>
  it(`EVIDENCE of the current assets: ${name}`, async () => {
    try {
      await fn()
    } catch (e) {
      throw new Error(
        `The facts about the shipped speaker .glb changed (a rebuilt model?): ${e instanceof Error ? e.message : String(e)}\n` +
          'Not a regression by itself: see docs/CREATIVE-MODE-LOG.md L30 (viii) and ADR-0015 « Addendum (Task 37) ». Re-verify that the new model faces +z at yaw 0 with its connectors at −z, then update these evidence tests.'
      )
    }
  })

describe('the shipped speaker models: where do the connectors sit, and what is there? (evidence, L30)', () => {
  it('the files are there (the test cannot pass vacuously)', () => {
    for (const f of ['qsc-k12-2', 'yamaha-dbr12']) expect(existsSync(resolve(assets, `${f}.glb`)), f).toBe(true)
  })

  // REBUILT (2026-11-04, Meshy fixed up to the spec, tekpractice extras): the K12.2 and the DBR12 are speaker-shaped boxes at their real size with the I/O
  // face at +z (their baffle is the opposite face, which faces +z in the scene at yaw 0 by the convention). These two replace the legacy-scan evidence.
  evidence('K12.2: a box at its real size (356 x 602 x 350 mm) whose three port empties sit on or just behind the +z I/O face (the amp plate is recessed up to 39 mm)', async () => {
    const { ports, lo, hi } = await read('qsc-k12-2')
    expect(Object.keys(ports).sort()).toEqual(['in-line-a', 'power-in', 'thru-out-a'])
    expect([0, 1, 2].map((k) => +(hi[k] - lo[k]).toFixed(3))).toEqual([0.356, 0.602, 0.35])
    for (const [id, p] of Object.entries(ports)) {
      expect(p[2], id).toBeLessThanOrEqual(hi[2] + 1e-4)
      expect(p[2], id).toBeGreaterThanOrEqual(hi[2] - 0.04)
    }
  })

  evidence('DBR12: a speaker-shaped box (taller than deep) at its real size (376 x 601 x 348 mm); its three port empties sit behind the +z I/O face (recess about 26 mm)', async () => {
    const { lo, hi, ports } = await read('yamaha-dbr12')
    const ext = [0, 1, 2].map((k) => hi[k] - lo[k])
    expect(ext[1], 'taller than deep').toBeGreaterThan(ext[2])
    expect(ext.map((v) => +v.toFixed(3))).toEqual([0.376, 0.601, 0.348])
    expect(Object.keys(ports).sort()).toEqual(['in-line', 'link-out', 'power-in'])
    for (const [id, p] of Object.entries(ports)) {
      expect(p[2], id).toBeLessThanOrEqual(hi[2] + 1e-4)
      expect(p[2], id).toBeGreaterThanOrEqual(hi[2] - 0.03)
    }
  })
})
