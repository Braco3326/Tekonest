/**
 * Output pins of the scripted builder: the raw GLB of every committed scripted spec (93 plans, taken from the tree at the end of Wave 1, 2026-11-12)
 * must stay byte-identical when the builder grows new shapes or params (Wave 2 families: rack-box v3b, moulded-box, revolve oval,
 * round-base stand). The plans in the fixture are what runBuilder wrote for each spec, so this test does not depend on the spec files, which later
 * waves may edit.
 *
 * Two old builds are NOT byte-stable between Blender sessions (found while pinning, 5 runs each): axia-iq (console-wedge) and antelope-ocx-hd
 * (rack-box with ear slots). Their vertex positions are identical every time; only the triangulation and the triangle order of the flat faces
 * filled round holes (bmesh triangle_fill with use_beauty) vary. For those two the pin is a fingerprint (triangle count + hash of the sorted vertex positions).
 * The Wave 2 features avoid that call (use_beauty off), so they are byte-stable.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findBlender } from '../../../tools/assets3d/env'
import { BUILD_SHAPES } from '../../../tools/assets3d/shapes'
import { buildPlanRaw, fingerprint } from './rawBuild'

const BLENDER = findBlender()
interface Pin { sha256?: string; fingerprint?: string; plan: { shape: string } }
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

  it('covers 24 of the 25 shapes that existed at the end of Wave 1 (speaker-cabinet has no committed spec)', () => {
    const covered = new Set(IDS.map((id) => PINS[id].plan.shape))
    expect(covered.size).toBe(24)
    expect(covered.has('speaker-cabinet')).toBe(false)
    for (const s of covered) expect(BUILD_SHAPES as readonly string[]).toContain(s)
    expect(IDS.filter((id) => PINS[id].fingerprint !== undefined)).toEqual(['antelope-ocx-hd', 'axia-iq'])
  })

  it.skipIf(!BLENDER)('every pinned plan builds byte-identical to its recorded sha256 (the two unstable ones to their fingerprint)', async () => {
    const bad: string[] = []
    let next = 0
    const worker = async (): Promise<void> => {
      for (;;) {
        const id = IDS[next++]
        if (id === undefined) return
        try {
          const r = await buildPlanRaw(BLENDER as string, dir, id, PINS[id].plan)
          const pin = PINS[id]
          if (pin.sha256 !== undefined && r.sha256 !== pin.sha256) bad.push(`${id} (${pin.plan.shape}): ${r.sha256.slice(0, 12)} is not ${pin.sha256.slice(0, 12)}`)
          if (pin.fingerprint !== undefined) {
            const fp = await fingerprint(r.bytes)
            if (fp !== pin.fingerprint) bad.push(`${id} (${pin.plan.shape}): fingerprint ${fp} is not ${pin.fingerprint}`)
          }
        } catch (err) {
          bad.push(`${id}: ${(err as Error).message}`)
        }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()])
    expect(bad).toEqual([])
  }, 600_000)
})
