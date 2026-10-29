/**
 * Task 37, the « glb front check » that ADR-0013 (addendum) and ADR-0015 handed to this task: which way do the shipped speaker models face?
 *
 * The acoustic axis is the placement's local +z (yaw 0 = the speaker faces +z). The scene puts a model's connector side (its `port_*` empties)
 * at −z (DeviceSpawner.normalizeModel: « I/O toward −Z »), so a model whose FRONT is on its connector side would face −z at yaw 0, the field
 * would be turned 180° and still look plausible. This test reads the real files (glTF space, y up) and pins what they say: it is evidence and a
 * tripwire, not an assertion that the models are right. DECIDED (L30 viii): the convention is kept and the models are being rebuilt; these tests document
 * TODAY's assets and are expected to fail, with an explanatory message, when the rebuilt models land. See docs/CREATIVE-MODE-LOG.md L30 and the Task 37 report.
 *
 * Findings pinned here:
 *  - K12.2: the three port empties sit just outside ONE end face of the body, and that end is the WIDE end of its plan (14 in wide against 6.6 in
 *    at the other end, which carries the dense detail and the recessed panel). If the wide end is the baffle (as on a trapezoidal speaker), the
 *    model's front is on the connector side: at yaw 0 it faces −z in the scene.
 *  - DBR12: the model is a long box (158 × 57 × 65 units; the catalog box is 0.376 × 0.601 × 0.348 m) whose grille is on a long side; it is not a
 *    speaker-shaped box at all (REVIEW-ME §12 flags it « sur-échelle »), so no front can be read from it.
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
const span = (v: number[]): number => Math.max(...v) - Math.min(...v)

/**
 * These are EVIDENCE of today's assets, not requirements (decision L30 viii, 2026-10-29: the convention is kept, the 3D models are being rebuilt with
 * the I/O face toward −Z, pivot bottom-centre). When a rebuilt model lands, a failure here is EXPECTED: it means the facts below changed. Then (1) re-check
 * which way the new model's FRONT faces at yaw 0 (it must face +z, connectors at −z), (2) update or delete these tests, (3) update L30 / ADR-0015 and the
 * `coverage.frontCaveat` note (drop it when the models are right). The failure message says so: it is not a mystery.
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

  evidence('K12.2: its port empties are on one end face of the body (the +z end of the file), on the same side for all three', async () => {
    const { ports, hi } = await read('qsc-k12-2')
    expect(Object.keys(ports).sort()).toEqual(['in-line-a', 'power-in', 'thru-out-a'])
    for (const [id, p] of Object.entries(ports)) expect(p[2], id).toBeGreaterThanOrEqual(hi[2] - 0.05) // just outside the max-z face
  })

  evidence('K12.2: that connector end is the WIDE end of the plan; the opposite end is narrow and carries the dense detail (the amp side)', async () => {
    const { pts, ports, lo, hi } = await read('qsc-k12-2')
    const depth = hi[2] - lo[2]
    const near = pts.filter((p) => p[2] >= hi[2] - 0.08 * depth) // the 8 % of the depth next to the connectors
    const far = pts.filter((p) => p[2] <= lo[2] + 0.08 * depth) // and next to the other end
    expect(span(near.map((p) => p[0])), 'plan width at the connector end').toBeGreaterThan(13) // 14 in: the full width
    expect(span(far.map((p) => p[0])), 'plan width at the other end').toBeLessThan(8) // 6.6 in
    expect(far.length, 'the other end carries most of the geometry (panel, handles)').toBeGreaterThan(10 * near.length)
    expect(Object.values(ports).every((p) => p[2] > hi[2] - 0.05)).toBe(true)
  })

  evidence('DBR12: the model is not a speaker-shaped box (its long axis is z; the catalog box is taller than deep): no front can be read from it', async () => {
    const { lo, hi, ports } = await read('yamaha-dbr12')
    const ext = [0, 1, 2].map((k) => hi[k] - lo[k])
    expect(ext[2] / ext[1], 'the file is much longer than it is tall').toBeGreaterThan(2.5)
    // the catalog box (DeviceSpawner.REAL_SIZE_M): 0.376 wide, 0.601 high, 0.348 deep: taller than deep. The file normalised by height would be 1.67 m deep.
    expect((0.601 * ext[2]) / ext[1] / 0.348, 'depth the scene would give it, over the catalog depth').toBeGreaterThan(4)
    expect(Object.keys(ports).sort()).toEqual(['in-line', 'link-out', 'power-in'])
  })
})
