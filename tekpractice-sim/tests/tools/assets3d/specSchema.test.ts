import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AssetSpec } from '../../../tools/assets3d/specSchema'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'
import { checkSpecParity, loadSpecs } from '../../../tools/assets3d/loadSpecs'
import { buildSkeleton, parseDimensionsMm, writeSkeleton } from '../../../tools/assets3d/spec-skeleton'
import type { CatalogT } from '../../../tools/schemas'
import { makeRegistry } from '../../helpers'

const catalog = makeRegistry().catalog
const fresh = (): CatalogT => structuredClone(catalog)

/** A valid spec whose ports and controls are exactly the catalog's ids for `deviceId`. */
function specFor(c: CatalogT, deviceId: string): AssetSpecT {
  const d = c.devices.find((x) => x.id === deviceId)!
  return {
    id: deviceId,
    kind: 'device',
    tier: 'standard',
    realSizeMm: { w: 468, h: 272, d: 562 },
    ports: d.ports.map((p) => ({ portId: p.portId, face: 'io' as const, xMm: 10, yMm: 10, confidence: 'photo' as const })),
    controls: (d.controls ?? []).map((k) => ({
      controlId: k.id, kind: 'switch' as const, face: 'top' as const, xMm: 5, yMm: 5, axis: 'y' as const, sizeMm: { w: 5, h: 5, d: 5 },
    })),
    sources: [],
  }
}

describe('AssetSpec schema', () => {
  it('accepts a complete spec', () => {
    expect(AssetSpec.safeParse(specFor(catalog, 'yamaha-ql1')).success).toBe(true)
  })

  it('rejects a non-positive size', () => {
    const spec = specFor(catalog, 'yamaha-ql1')
    for (const bad of [0, -3]) {
      const r = AssetSpec.safeParse({ ...spec, realSizeMm: { ...spec.realSizeMm, h: bad } })
      expect(r.success).toBe(false)
    }
  })

  it('rejects an unknown face', () => {
    const spec = specFor(catalog, 'yamaha-ql1')
    const r = AssetSpec.safeParse({ ...spec, ports: [{ ...spec.ports[0], face: 'front' }] })
    expect(r.success).toBe(false)
  })

  it('accepts an optional circular opening on a port (R3)', () => {
    const spec = specFor(catalog, 'yamaha-ql1')
    expect(AssetSpec.safeParse({ ...spec, ports: [{ ...spec.ports[0], openingMm: 19 }, ...spec.ports.slice(1)] }).success).toBe(true)
    expect(AssetSpec.safeParse({ ...spec, ports: [{ ...spec.ports[0], openingMm: 0 }, ...spec.ports.slice(1)] }).success).toBe(false)
  })
})

describe('AssetSpec build block', () => {
  it('still parses a spec without build', () => {
    expect(AssetSpec.safeParse(specFor(catalog, 'yamaha-ql1')).success).toBe(true)
  })

  it('parses a build block with only a shape, and one with params', () => {
    const spec = specFor(catalog, 'yamaha-ql1')
    expect(AssetSpec.safeParse({ ...spec, build: { shape: 'rack-box' } }).success).toBe(true)
    expect(AssetSpec.safeParse({ ...spec, build: { shape: 'rack-box', params: { chamferMm: 1 } } }).success).toBe(true)
  })

  it('rejects an unknown key in build (strict)', () => {
    const spec = specFor(catalog, 'yamaha-ql1')
    expect(AssetSpec.safeParse({ ...spec, build: { shape: 'rack-box', extra: 1 } }).success).toBe(false)
  })

  it('rejects an unknown shape and a NaN param', () => {
    const spec = specFor(catalog, 'yamaha-ql1')
    expect(AssetSpec.safeParse({ ...spec, build: { shape: 'cube' } }).success).toBe(false)
    expect(AssetSpec.safeParse({ ...spec, build: { shape: 'rack-box', params: { chamferMm: Number.NaN } } }).success).toBe(false)
  })
})

describe('AssetSpec build.budget and build.minFilletMm', () => {
  const base = (): ReturnType<typeof specFor> => specFor(catalog, 'yamaha-ql1')
  const parse = (build: unknown): boolean => AssetSpec.safeParse({ ...base(), build }).success

  it('parses a triangle budget with min <= max, and a minimum fillet', () => {
    expect(parse({ shape: 'curved-cabinet', budget: { min: 1500, max: 3500 } })).toBe(true)
    expect(parse({ shape: 'curved-cabinet', budget: { min: 1500, max: 1500 } })).toBe(true)
    expect(parse({ shape: 'curved-cabinet', minFilletMm: 25 })).toBe(true)
  })

  it('rejects a budget whose min is above its max, a non-integer, zero, negative or an unknown key', () => {
    expect(parse({ shape: 'curved-cabinet', budget: { min: 5, max: 1 } })).toBe(false)
    expect(parse({ shape: 'curved-cabinet', budget: { min: 10.5, max: 20 } })).toBe(false)
    expect(parse({ shape: 'curved-cabinet', budget: { min: 0, max: 20 } })).toBe(false)
    expect(parse({ shape: 'curved-cabinet', budget: { min: -1, max: 20 } })).toBe(false)
    expect(parse({ shape: 'curved-cabinet', budget: { min: 1, max: 2, floor: 3 } })).toBe(false)
    expect(parse({ shape: 'curved-cabinet', budget: { min: 1 } })).toBe(false)
  })

  it('rejects a zero, negative or NaN minimum fillet', () => {
    for (const v of [0, -3, Number.NaN]) expect(parse({ shape: 'curved-cabinet', minFilletMm: v })).toBe(false)
  })
})

describe('AssetSpec build profile (revolve)', () => {
  const profile = [[0, 20], [40, 30], [100, 30], [162, 10]]
  const base = (): AssetSpecT => specFor(catalog, 'yamaha-ql1')
  const parse = (build: unknown): boolean => AssetSpec.safeParse({ ...base(), build }).success

  it('accepts a lathe profile of at least four stations with strictly increasing positions, and zone colours', () => {
    expect(parse({ shape: 'revolve', profile })).toBe(true)
    expect(parse({ shape: 'revolve', profile, colours: [{ fromMm: 0, colour: '#3b3b3e' }, { fromMm: 117, colour: '#9a9a9e' }] })).toBe(true)
    expect(parse({ shape: 'revolve', profile: [[0, 0], [10, 20], [20, 20], [30, 0]], params: { segments: 24 } })).toBe(true)
  })

  it('rejects fewer than four stations, a non-increasing or repeated position, non-finite numbers and a negative diameter', () => {
    expect(parse({ shape: 'revolve', profile: profile.slice(0, 3) })).toBe(false)
    expect(parse({ shape: 'revolve', profile: [[0, 20], [40, 30], [40, 30], [162, 10]] })).toBe(false)
    expect(parse({ shape: 'revolve', profile: [[0, 20], [40, 30], [30, 30], [162, 10]] })).toBe(false)
    expect(parse({ shape: 'revolve', profile: [[0, 20], [40, Number.NaN], [100, 30], [162, 10]] })).toBe(false)
    expect(parse({ shape: 'revolve', profile: [[0, 20], [Number.POSITIVE_INFINITY, 30], [100, 30], [162, 10]] })).toBe(false)
    expect(parse({ shape: 'revolve', profile: [[0, 20], [40, -1], [100, 30], [162, 10]] })).toBe(false)
    expect(parse({ shape: 'revolve', profile: [[0, 20, 5, 1], [40, 30], [100, 30], [162, 10]] })).toBe(false) // four numbers: never a station
    expect(parse({ shape: 'revolve-oval', profile: [[0, 20, 5], [40, 30, 20], [100, 30, 20], [162, 10, 5]] })).toBe(true) // [position, width, depth]: the schema allows it, validateBuild says which shape takes which
  })

  it('rejects colours that do not start at 0, are not increasing, or are not #rrggbb', () => {
    expect(parse({ shape: 'revolve', profile, colours: [{ fromMm: 5, colour: '#3b3b3e' }] })).toBe(false)
    expect(parse({ shape: 'revolve', profile, colours: [{ fromMm: 0, colour: '#3b3b3e' }, { fromMm: 0, colour: '#9a9a9e' }] })).toBe(false)
    expect(parse({ shape: 'revolve', profile, colours: [{ fromMm: 0, colour: 'grey' }] })).toBe(false)
    expect(parse({ shape: 'revolve', profile, colours: [] })).toBe(false)
  })
})

describe('AssetSpec insetMm and driftLimit', () => {
  const base = (): AssetSpecT => specFor(fresh(), 'qsc-k12-2')
  it('accepts a port inset and a drift limit, rejects a negative inset and a limit outside (0, 0.35]', () => {
    const withPortInset = (insetMm: number) => AssetSpec.safeParse({ ...base(), ports: base().ports.map((p, i) => (i === 0 ? { ...p, insetMm } : p)) }).success
    expect(withPortInset(35)).toBe(true)
    expect(withPortInset(0)).toBe(true)
    expect(withPortInset(-1)).toBe(false)
    expect(withPortInset(250)).toBe(false)
    const lim = (driftLimit: number) => AssetSpec.safeParse({ ...base(), driftLimit }).success
    expect(lim(0.25)).toBe(true)
    expect(lim(0.35)).toBe(true)
    expect(lim(0.4)).toBe(false)
    expect(lim(0)).toBe(false)
  })
})

describe('AssetSpec build.projection', () => {
  const base = (): AssetSpecT => specFor(fresh(), 'qsc-k12-2')
  const parse = (projection: unknown): boolean => AssetSpec.safeParse({ ...base(), build: { shape: 'rack-box', projection } }).success
  it('accepts one face or a list of one to four faces', () => {
    expect(parse('io')).toBe(true)
    expect(parse(['top', 'io'])).toBe(true)
    expect(parse(['top', 'io', 'opposite', 'left'])).toBe(true)
    expect(parse('wrap')).toBe(true) // a lathe's unrolled surface
  })
  it('rejects an empty list, an unknown face and more than four faces', () => {
    expect(parse([])).toBe(false)
    expect(parse('bottom')).toBe(false)
    expect(parse(['io', 'top', 'left', 'opposite', 'io'])).toBe(false)
  })
})

describe('PortSpec confidence', () => {
  const parse = (confidence: unknown): boolean => {
    const base = specFor(fresh(), 'qsc-k12-2')
    return AssetSpec.safeParse({ ...base, ports: [{ ...base.ports[0], confidence }] }).success
  }
  it('accepts manual, photo and guess (a position invented for a stand-in device that has no manual and no photo), and nothing else', () => {
    expect(parse('manual')).toBe(true)
    expect(parse('photo')).toBe(true)
    expect(parse('guess')).toBe(true)
    expect(parse('estimate')).toBe(false)
  })
})

describe('AssetSpec build.projectionShiftMm', () => {
  const base = (): AssetSpecT => specFor(fresh(), 'qsc-k12-2')
  const parse = (projectionShiftMm: unknown): boolean => AssetSpec.safeParse({ ...base(), build: { shape: 'rack-box', projection: ['io', 'opposite'], projectionShiftMm } }).success
  it('accepts a millimetre shift per face, negative or positive, for the four faces', () => {
    expect(parse({ io: 68 })).toBe(true)
    expect(parse({ io: -12.5, opposite: 3, top: 0, left: 1 })).toBe(true)
  })
  it('rejects an unknown face, a non-number and a non-finite shift', () => {
    expect(parse({ bottom: 5 })).toBe(false)
    expect(parse({ io: '68' })).toBe(false)
    expect(parse({ io: Infinity })).toBe(false)
  })
})

describe('AssetSpec texture block (blank bands)', () => {
  const base = (): AssetSpecT => specFor(fresh(), 'qsc-k12-2')
  it('accepts blank bands with and without a fill', () => {
    const s = AssetSpec.safeParse({ ...base(), texture: { blankBandsMm: [{ fromMm: 110, toMm: 124 }, { fromMm: 10, toMm: 20, fill: '#3b3b3e' }] } })
    expect(s.success).toBe(true)
  })

  it('accepts rectangles on a face, alone or with bands, and rejects a texture block with neither', () => {
    const rect = { face: 'io', xMm: 10, yMm: 20, wMm: 30, hMm: 15 }
    expect(AssetSpec.safeParse({ ...base(), texture: { blankRects: [rect, { ...rect, face: 'opposite', depthMm: 60, marginMm: 12, fill: '#202020' }] } }).success).toBe(true)
    expect(AssetSpec.safeParse({ ...base(), texture: { blankBandsMm: [{ fromMm: 1, toMm: 5 }], blankRects: [rect] } }).success).toBe(true)
    expect(AssetSpec.safeParse({ ...base(), texture: {} }).success).toBe(false)
    expect(AssetSpec.safeParse({ ...base(), texture: { blankRects: [{ ...rect, wMm: 0 }] } }).success).toBe(false)
    expect(AssetSpec.safeParse({ ...base(), texture: { blankRects: [{ ...rect, face: 'front' }] } }).success).toBe(false)
  })

  it('rejects an empty list, an inverted or negative band, a bad fill and an unknown key', () => {
    const bad = (texture: unknown) => AssetSpec.safeParse({ ...base(), texture }).success
    expect(bad({ blankBandsMm: [] })).toBe(false)
    expect(bad({ blankBandsMm: [{ fromMm: 20, toMm: 10 }] })).toBe(false)
    expect(bad({ blankBandsMm: [{ fromMm: -1, toMm: 10 }] })).toBe(false)
    expect(bad({ blankBandsMm: [{ fromMm: 1, toMm: 10, fill: 'red' }] })).toBe(false)
    expect(bad({ blankBandsMm: [{ fromMm: 1, toMm: 10 }], extra: 1 })).toBe(false)
  })
})

describe('checkSpecParity (device)', () => {
  it('parity passes when ids match exactly', () => {
    expect(checkSpecParity(specFor(catalog, 'yamaha-ql1'), catalog)).toEqual([])
  })

  it('parity flags a spec port the catalog lacks, naming the device and port', () => {
    const spec = specFor(catalog, 'yamaha-ql1')
    spec.ports.push({ portId: 'ghost-port', face: 'io', xMm: 1, yMm: 1, confidence: 'photo' })
    const errs = checkSpecParity(spec, catalog)
    expect(errs).toHaveLength(1)
    expect(errs[0]).toContain('yamaha-ql1')
    expect(errs[0]).toContain('ghost-port')
  })

  it('parity flags a catalog port the spec lacks', () => {
    const spec = specFor(catalog, 'yamaha-ql1')
    const dropped = spec.ports.pop()!
    const errs = checkSpecParity(spec, catalog)
    expect(errs).toHaveLength(1)
    expect(errs[0]).toContain('yamaha-ql1')
    expect(errs[0]).toContain(dropped.portId)
  })

  it('parity flags control ids missing on either side', () => {
    const spec = specFor(catalog, 'yamaha-ql1')
    const dropped = spec.controls.pop()!
    spec.controls.push({ controlId: 'ghost-knob', kind: 'knob', face: 'top', xMm: 1, yMm: 1, axis: 'z', sizeMm: { w: 1, h: 1, d: 1 } })
    const errs = checkSpecParity(spec, catalog)
    expect(errs).toHaveLength(2)
    expect(errs.some((e) => e.includes('ghost-knob'))).toBe(true)
    expect(errs.some((e) => e.includes(dropped.controlId))).toBe(true)
  })

  it('parity flags a spec for a device that is not in the catalog', () => {
    const spec = { ...specFor(catalog, 'yamaha-ql1'), id: 'no-such-device' }
    const errs = checkSpecParity(spec, catalog)
    expect(errs).toHaveLength(1)
    expect(errs[0]).toContain('no-such-device')
  })

  it('parity flags a port id used twice in the spec', () => {
    const spec = specFor(catalog, 'yamaha-ql1')
    spec.ports.push({ ...spec.ports[0] })
    const errs = checkSpecParity(spec, catalog)
    expect(errs).toHaveLength(1)
    expect(errs[0]).toContain(spec.ports[0].portId)
  })
})

describe('checkSpecParity (connector, R7)', () => {
  const connector = (id: string): AssetSpecT => ({
    id, kind: 'connector', tier: 'connector', realSizeMm: { w: 25, h: 25, d: 60 }, ports: [], controls: [],
    mating: { role: 'plug', outerMm: 24 }, sources: [],
  })

  it('passes for a connector id in catalog.connectorTypes', () => {
    expect(checkSpecParity(connector('xlr3-m'), catalog)).toEqual([])
  })

  it('does not look in catalog.devices: a device id is not a connector', () => {
    const errs = checkSpecParity(connector('yamaha-ql1'), catalog)
    expect(errs).toHaveLength(1)
    expect(errs[0]).toContain('yamaha-ql1')
    expect(errs[0]).toContain('connectorTypes')
  })

  it('flags a connector spec that carries ports or controls', () => {
    const spec = connector('xlr3-m')
    spec.ports.push({ portId: 'p', face: 'io', xMm: 0, yMm: 0, confidence: 'photo' })
    spec.controls.push({ controlId: 'c', kind: 'knob', face: 'top', xMm: 0, yMm: 0, axis: 'z', sizeMm: { w: 1, h: 1, d: 1 } })
    expect(checkSpecParity(spec, catalog)).toHaveLength(2)
  })
})

describe('parseDimensionsMm', () => {
  it('reads prefix-labelled W/H/D', () => {
    expect(parseDimensionsMm('W 468mm(18.4in ) x H 272mm(10.7in) x D 562mm(22.1in)')).toEqual({ w: 468, h: 272, d: 562 })
  })

  it('reads a trailing label group, in its own order', () => {
    expect(parseDimensionsMm('602 × 356 × 350 mm (23.7 × 14 × 13.8 in) (H × W × D)')).toEqual({ w: 356, h: 602, d: 350 })
    expect(parseDimensionsMm('376 x 601 x 348 mm (14.8" x 23.7" x 13.7") (WxHxD, with rubber feet)')).toEqual({ w: 376, h: 601, d: 348 })
    expect(parseDimensionsMm('480 x 44 x 252 mm (L x H x P)')).toEqual({ w: 480, h: 44, d: 252 })
  })

  it('reads number-then-label and word labels', () => {
    expect(parseDimensionsMm('482.6 (W) x 230 (D) x 44 (H) mm (1U)')).toEqual({ w: 482.6, h: 44, d: 230 })
    expect(parseDimensionsMm('Height 104mm / 4.1", Width 220mm / 8.7", Depth 290mm / 11.4"')).toEqual({ w: 220, h: 104, d: 290 })
  })

  it('returns null when the axes are not labelled or are not metric', () => {
    expect(parseDimensionsMm('110 x 73 x 42 mm')).toBeNull()
    expect(parseDimensionsMm('Diameter 56 mm, length 200 mm')).toBeNull()
    expect(parseDimensionsMm('2U rack, 3.5" x 10.5" x 17"')).toBeNull()
    expect(parseDimensionsMm(undefined)).toBeNull()
  })
})

describe('buildSkeleton', () => {
  it('uses the catalog ids, the parsed size and zeroed photo-confidence coordinates', () => {
    const sk = buildSkeleton('yamaha-ql1', catalog, { w: 468, h: 272, d: 562 }, [])
    expect(sk.kind).toBe('device')
    expect(sk.realSizeMm).toEqual({ w: 468, h: 272, d: 562 })
    expect(sk.ports).toHaveLength(7)
    expect(sk.ports.every((p) => p.xMm === 0 && p.yMm === 0 && p.confidence === 'photo')).toBe(true)
    expect(checkSpecParity(sk, catalog)).toEqual([])
  })

  it('makes a connector skeleton with empty ports and controls and a mating role from the gender', () => {
    const sk = buildSkeleton('xlr3-f', catalog, null, [])
    expect(sk.kind).toBe('connector')
    expect(sk.tier).toBe('connector')
    expect(sk.ports).toEqual([])
    expect(sk.controls).toEqual([])
    expect(sk.mating?.role).toBe('socket')
  })

  it('throws for an id that is neither a device nor a connector type', () => {
    expect(() => buildSkeleton('nope', fresh(), null, [])).toThrow(/nope/)
  })
})

describe('writeSkeleton and loadSpecs', () => {
  const dirs: string[] = []
  const tmp = () => {
    const d = mkdtempSync(join(tmpdir(), 'asset-specs-'))
    dirs.push(d)
    return d
  }
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })

  it('refuses to overwrite an existing spec unless force is passed', () => {
    const specDir = tmp()
    const kbDir = tmp()
    writeSkeleton('xlr3-m', { catalog, specDir, kbDir })
    writeFileSync(join(specDir, 'xlr3-m.json'), '{"keep":"me"}')
    expect(() => writeSkeleton('xlr3-m', { catalog, specDir, kbDir })).toThrow(/--force/)
    expect(readFileSync(join(specDir, 'xlr3-m.json'), 'utf8')).toBe('{"keep":"me"}')
    writeSkeleton('xlr3-m', { catalog, specDir, kbDir }, true)
    expect(JSON.parse(readFileSync(join(specDir, 'xlr3-m.json'), 'utf8')).id).toBe('xlr3-m')
  })

  it('loadSpecs reads valid specs, returns [] for a missing folder and throws naming a bad file', () => {
    const dir = tmp()
    const spec = buildSkeleton('xlr3-m', catalog, { w: 25, h: 25, d: 60 }, [])
    writeFileSync(join(dir, 'xlr3-m.json'), JSON.stringify(spec))
    expect(loadSpecs(dir).map((s) => s.id)).toEqual(['xlr3-m'])
    expect(loadSpecs(join(dir, 'nope'))).toEqual([])
    writeFileSync(join(dir, 'xlr3-f.json'), JSON.stringify({ ...spec, id: 'xlr3-f', realSizeMm: { w: 0, h: 1, d: 1 } }))
    expect(() => loadSpecs(dir)).toThrow(/xlr3-f\.json/)
  })
})
