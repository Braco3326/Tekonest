/**
 * Output pins of the scripted builder: the raw GLB of every committed scripted spec (93 plans, taken from the tree at the end of Wave 1, 2026-11-12)
 * must not change when the builder grows new shapes or params (Wave 2 families: rack-box v3b, moulded-box, revolve oval, round-base stand).
 * The plans in the fixture are what runBuilder wrote for each spec, so this test does not depend on the spec files, which later waves may edit.
 *
 * Two levels, because of one finding made while pinning (2026-11-12):
 *  - `fingerprint` (every plan): the triangle count and a hash of the sorted vertex positions. It proves the geometry is the same.
 *  - `sha256` (the 53 plans that are `byteStable`): the bytes of the file.
 * The other 40 plans (rack-box with ear slots, console-wedge with recesses, the RJ45 plug, the Rio stage box: every build that fills a flat face round holes with
 * bmesh `triangle_fill(use_beauty=True)`) are NOT byte-stable: Blender's beauty fill breaks ties by memory address, so their triangulation (the same vertices, other
 * diagonals and another triangle order) depends on the heap layout. Measured: antelope-ocx-hd gives 3 different files in 10 runs of an unchanged script, and adding ONE
 * unused function to the script changes the bytes of 40 of the 93 plans (not a comment: the code size matters), the vertex set never. So for those the pin can only be
 * the fingerprint. The Wave 2 builders fill faces with our own triangulation (fill_with_holes_det, triangulate_det) and sort the faces (canonical_face_order): byte-stable.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findBlender } from '../../../tools/assets3d/env'
import { BUILD_SHAPES } from '../../../tools/assets3d/shapes'
import { buildPlanRaw, fingerprint } from './rawBuild'

const BLENDER = findBlender()
interface Pin { fingerprint: string; sha256?: string; plan: { shape: string } }
const PINS = JSON.parse(await readFile(new URL('./fixtures/builder-pins-wave2.json', import.meta.url), 'utf8')) as Record<string, Pin>
const IDS = Object.keys(PINS)

describe(`builder output pins (${IDS.length} plans${BLENDER ? '' : ', SKIPPED: Blender not found'})`, () => {
  let dir = ''
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tekpractice-pins-'))
  })
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('covers 24 of the 25 shapes that existed at the end of Wave 1 (speaker-cabinet has no committed spec), 53 plans byte-pinned', () => {
    const covered = new Set(IDS.map((id) => PINS[id].plan.shape))
    expect(covered.size).toBe(24)
    expect(covered.has('speaker-cabinet')).toBe(false)
    for (const s of covered) expect(BUILD_SHAPES as readonly string[]).toContain(s)
    expect(IDS.filter((id) => PINS[id].sha256 !== undefined)).toHaveLength(53)
    // every lathe (16 plans, the SM58 among them), every curved cabinet and the tripod stand are byte-stable: nothing that was pinned there may move
    for (const id of IDS.filter((i) => ['revolve', 'curved-cabinet', 'tripod-stand', 'power-strip', 'cable-assembly', 'boom-arm'].includes(PINS[i].plan.shape))) expect(PINS[id].sha256, id).toBeDefined()
  })

  it.skipIf(!BLENDER)('every pinned plan builds with the same geometry (fingerprint), and the byte-stable ones with the same bytes', async () => {
    const bad: string[] = []
    let next = 0
    const worker = async (): Promise<void> => {
      for (;;) {
        const id = IDS[next++]
        if (id === undefined) return
        try {
          const r = await buildPlanRaw(BLENDER as string, dir, id, PINS[id].plan)
          const pin = PINS[id]
          const fp = await fingerprint(r.bytes)
          if (fp !== pin.fingerprint) bad.push(`${id} (${pin.plan.shape}): geometry changed, fingerprint ${fp} is not ${pin.fingerprint}`)
          if (pin.sha256 !== undefined && r.sha256 !== pin.sha256) bad.push(`${id} (${pin.plan.shape}): ${r.sha256.slice(0, 12)} is not ${pin.sha256.slice(0, 12)}`)
        } catch (err) {
          bad.push(`${id}: ${(err as Error).message}`)
        }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()])
    expect(bad).toEqual([])
  }, 600_000)
})
