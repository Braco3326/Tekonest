/**
 * Flat zones (Wave 2, Task 2.3): the rectangles of a device's control layout that modelled detail must keep clear of. flatZonesFor is pure
 * (reads content/control-layouts); the builder refusals run the real Blender builder and are skipped without it.
 */
import { execFile } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findBlender } from '../../../tools/assets3d/env'
import { DEFAULT_LAYOUT_DIR, FLAT_ZONE_MARGIN_MM, flatZonesFor } from '../../../tools/assets3d/flatZones'
import { loadSpecs } from '../../../tools/assets3d/loadSpecs'
import { BUILD_SCRIPT, runBuilder } from '../../../tools/assets3d/runBuilder'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'

const BLENDER = findBlender()

describe('flatZonesFor', () => {
  it('gives the ISA One at least 8 zones: a rectangle per control, grown by 3 mm', () => {
    const zones = flatZonesFor('focusrite-isa-one')
    expect(zones.length).toBeGreaterThanOrEqual(8)
    expect(FLAT_ZONE_MARGIN_MM).toBe(3)
    // the input-gain knob: centre (28.5, 77.8), 14.5 x 14.5 mm -> 21.25 .. 35.75 x 70.55 .. 85.05, plus 3 mm
    const knob = zones.find((z) => Math.abs(z.x0 - (28.5 - 7.25 - 3)) < 1e-9 && Math.abs(z.y0 - (77.8 - 7.25 - 3)) < 1e-9)
    expect(knob).toEqual({ face: 'opposite', x0: 18.25, y0: 67.55, x1: 38.75, y1: 88.05 })
    for (const z of zones) {
      expect(z.x1).toBeGreaterThan(z.x0)
      expect(z.y1).toBeGreaterThan(z.y0)
    }
  })

  it('a device with no layout gets no zones', () => {
    expect(flatZonesFor('shure-sm58')).toEqual([])
    expect(flatZonesFor('no-such-device')).toEqual([])
  })

  it('keeps the faces of the layout (the console has top and io controls) and covers a fader along its travel', () => {
    const zones = flatZonesFor('yamaha-ql1')
    expect(new Set(zones.map((z) => z.face))).toEqual(new Set(['top', 'io']))
    expect(zones.length).toBeGreaterThan(100)
  })

  it('reads a layout from another folder: a fader covers its cap travel toward + along its axis, reverse toward the other side', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tekpractice-layout-'))
    try {
      await writeFile(join(dir, 'x.json'), JSON.stringify({ controls: [
        { face: 'top', xMm: 100, yMm: 50, sizeMm: { w: 10, h: 20 }, axis: 'y', travelMm: 60 },
        { face: 'top', xMm: 200, yMm: 50, sizeMm: { w: 10, h: 20 }, axis: 'y', travelMm: 60, reverse: true },
        { face: 'io', xMm: 10, yMm: 10, sizeMm: { w: 4, h: 4 }, axis: 'z' },
      ] }))
      const zones = flatZonesFor('x', dir)
      expect(zones[0]).toEqual({ face: 'top', x0: 92, y0: 37, x1: 108, y1: 123 })
      expect(zones[1]).toEqual({ face: 'top', x0: 192, y0: -23, x1: 208, y1: 63 })
      expect(zones[2]).toEqual({ face: 'io', x0: 5, y0: 5, x1: 15, y1: 15 })
      await writeFile(join(dir, 'bad.json'), JSON.stringify({ controls: [{ face: 'top', xMm: 1 }] }))
      expect(() => flatZonesFor('bad', dir)).toThrow(/control 0 has no face, position or size/)
      await writeFile(join(dir, 'broken.json'), '{ nope')
      expect(() => flatZonesFor('broken', dir)).toThrow(/not valid JSON/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe(`the builder keeps modelled detail out of the flat zones (${BLENDER ? `using ${BLENDER}` : 'SKIPPED, Blender not found'})`, () => {
  let dir = ''
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tekpractice-zones-'))
  })
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  let n = 0
  /** Runs the builder script on a plan (zones given directly): resolves with stderr, or 'built'. */
  async function planFails(params: Record<string, number>, flatZones: unknown[], extra: Record<string, unknown> = {}): Promise<string> {
    const plan = { id: 'zone-test', kind: 'device', shape: 'rack-box', sizeMm: { w: 482.6, h: 44.45, d: 300 }, params, flatZones, ...extra }
    const planPath = join(dir, `plan-${n++}.json`)
    await writeFile(planPath, JSON.stringify(plan))
    return new Promise((resolve) => {
      execFile(BLENDER as string, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', BUILD_SCRIPT, '--', '--plan', planPath, '--out', join(dir, 'never.glb')], (err, _out, stderr) => resolve(err ? stderr : 'built'))
    })
  }

  const EARS = { bodyWidthMm: 440, earThicknessMm: 4, earHoleMm: 6.35 } // slots at u 8.75 +- 7.95 and 473.85 +- 7.95, v 6.35 and 38.1
  const VENTS = { bodyWidthMm: 440, ventSlots: 4, ventColumns: 2, ventSlotLenMm: 40, ventColPitchMm: 60, ventPitchMm: 8 } // a block centred on the top

  it.skipIf(!BLENDER)('an ear slot over a zone of the front face raises a BuildError naming the zone; one beside it builds', async () => {
    const over = await planFails(EARS, [{ face: 'opposite', x0: 0, y0: 30, x1: 20, y1: 44 }])
    expect(over).toMatch(/BUILD_FAIL an ear slot .* overlaps a flat zone of a control/)
    const beside = await planFails(EARS, [{ face: 'opposite', x0: 40, y0: 30, x1: 80, y1: 44 }])
    expect(beside).toBe('built')
    // the zone is on the other face: no clash
    expect(await planFails(EARS, [{ face: 'io', x0: 0, y0: 30, x1: 20, y1: 44 }])).toBe('built')
  }, 180_000)

  it.skipIf(!BLENDER)('a zone on the right-hand end of the front face is mirrored correctly: the slot at 473.85 mm from the left, seen from the front', async () => {
    expect(await planFails(EARS, [{ face: 'opposite', x0: 460, y0: 0, x1: 482, y1: 12 }])).toMatch(/overlaps a flat zone/)
    expect(await planFails(EARS, [{ face: 'opposite', x0: 30, y0: 0, x1: 60, y1: 12 }])).toBe('built')
  }, 180_000)

  it.skipIf(!BLENDER)('with frontOnIo the front face is io: a zone on io is hit, a zone on opposite is not', async () => {
    const params = { ...EARS, frontOnIo: 1 }
    expect(await planFails(params, [{ face: 'io', x0: 0, y0: 0, x1: 20, y1: 12 }])).toMatch(/on the io face\) overlaps/)
    expect(await planFails(params, [{ face: 'opposite', x0: 0, y0: 0, x1: 20, y1: 12 }])).toBe('built')
  }, 180_000)

  it.skipIf(!BLENDER)('a vent over a zone of the top face raises; a vent outside builds', async () => {
    // top face: x from the left, y from the io edge; the block of 4 slots is centred in x (u 227.8 .. 254.8) and its 2 columns lie mid-depth
    const over = await planFails(VENTS, [{ face: 'top', x0: 230, y0: 50, x1: 260, y1: 250 }])
    expect(over).toMatch(/BUILD_FAIL a vent slot .* overlaps a flat zone/)
    expect(await planFails(VENTS, [{ face: 'top', x0: 0, y0: 0, x1: 60, y1: 300 }])).toBe('built')
  }, 180_000)

  it.skipIf(!BLENDER)('a handle over a zone raises', async () => {
    const params = { bodyWidthMm: 440, handleCount: 2, handleProjectionMm: 20 }
    expect(await planFails(params, [{ face: 'opposite', x0: 5, y0: 10, x1: 25, y1: 30 }])).toMatch(/BUILD_FAIL a handle .* overlaps a flat zone/)
    expect(await planFails(params, [{ face: 'opposite', x0: 100, y0: 10, x1: 125, y1: 30 }])).toBe('built')
  }, 180_000)

  it.skipIf(!BLENDER)('runBuilder passes the layout of the device: the ISA One rejects a slot over its input-gain knob and builds with one clear of every control', async () => {
    const isa = loadSpecs().find((s) => s.id === 'focusrite-isa-one') as AssetSpecT
    // recess slots (the chassis is as wide as the plate) at u = 21 .. 36 mm, v = 74.6 .. 81 mm: right over the input-gain knob (28.5, 77.8)
    const clash: AssetSpecT = { ...isa, build: { shape: 'rack-box', params: { earThicknessMm: 4, earHoleMm: 6.35, earHoleEdgeMm: 28.5, earHoleRowMm: 77.8 } } }
    await expect(runBuilder(clash, join(dir, 'clash.glb'))).rejects.toThrow(/an ear slot .* overlaps a flat zone/)
    // slots in the bottom-left corner, clear of the knobs (zones start above 22 mm on the left) and of the buttons
    const fine: AssetSpecT = { ...isa, build: { shape: 'rack-box', params: { earThicknessMm: 4, earHoleMm: 5, earHoleEdgeMm: 9, earHoleRowMm: 6.5, filletMm: 1.5, ventSlots: 3, ventColumns: 2, ventSlotLenMm: 40 } } }
    await expect(runBuilder(fine, join(dir, 'fine.glb'))).resolves.toBeTruthy()
  }, 240_000)
})

describe('flatZonesFor expands `repeat` exactly like the layout parser (Wave 5c finding A)', () => {
  it('has one zone per expanded control for every shipped layout', async () => {
    const { parseControlLayout } = await import('../../../src/controls/controlTypes')
    const files = readdirSync(DEFAULT_LAYOUT_DIR).filter((f) => f.endsWith('.json'))
    expect(files.length).toBeGreaterThan(3)
    for (const f of files) {
      const id = f.replace(/\.json$/, '')
      const { layout, errors } = parseControlLayout(JSON.parse(readFileSync(join(DEFAULT_LAYOUT_DIR, f), 'utf8')))
      expect(errors, id).toEqual([])
      expect(flatZonesFor(id).length, id).toBe(layout?.controls.length)
    }
  })

  it('axia-iq: 8 strips of 9 repeated controls are all zones, strip 8 included', () => {
    const zones = flatZonesFor('axia-iq')
    expect(zones.length).toBe(80)
    // fader of strip 8 = base x + 7 * dxMm (-42.5): a zone must sit there
    const layout = JSON.parse(readFileSync(join(DEFAULT_LAYOUT_DIR, 'axia-iq.json'), 'utf8')) as { controls: { id?: string; xMm: number; face: string; repeat?: { dxMm: number } }[] }
    const f = layout.controls.find((c) => c.repeat && c.id === 'fader-1') ?? layout.controls.find((c) => c.repeat)
    const x8 = (f?.xMm ?? 0) + 7 * (f?.repeat?.dxMm ?? 0)
    expect(zones.some((z) => z.x0 < x8 && z.x1 > x8 && z.face === f?.face)).toBe(true)
  })

  it('a layout in another folder: repeat count 3 with a step gives 3 shifted zones; a bad repeat throws', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tekpractice-layout-rep-'))
    try {
      await writeFile(join(dir, 'r.json'), JSON.stringify({ controls: [{ id: 'f-{n}', face: 'top', xMm: 100, yMm: 50, sizeMm: { w: 10, h: 20 }, repeat: { count: 3, dxMm: -40, dyMm: 0, idFormat: 'f-{n}' } }] }))
      const z = flatZonesFor('r', dir)
      expect(z.map((q) => q.x0)).toEqual([92, 52, 12])
      await writeFile(join(dir, 'rb.json'), JSON.stringify({ controls: [{ face: 'top', xMm: 1, yMm: 1, sizeMm: { w: 1, h: 1 }, repeat: { count: 0 } }] }))
      expect(() => flatZonesFor('rb', dir)).toThrow(/repeat/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
