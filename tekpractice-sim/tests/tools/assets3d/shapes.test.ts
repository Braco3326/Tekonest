/**
 * Tests for assets3d/shapes: the shape table of the scripted builder and validateBuild, which checks a spec's `build`
 * block (shape on the right kind, param names, positive params, the mating diameter the plug shapes need).
 */
import { describe, expect, it } from 'vitest'
import { BUILD_SHAPES, SHAPE_SPECS, validateBuild } from '../../../tools/assets3d/shapes'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'

/** A valid connector spec (XLR3-F like) with `build` and any overrides. */
function specWith(build: AssetSpecT['build'], over: Partial<AssetSpecT> = {}): AssetSpecT {
  return {
    id: 'test-plug',
    kind: 'connector',
    tier: 'connector',
    realSizeMm: { w: 19.2, h: 19.2, d: 72.5 },
    ports: [],
    controls: [],
    mating: { role: 'plug', outerMm: 15.75 },
    sources: [],
    build,
    ...over,
  }
}

describe('SHAPE_SPECS', () => {
  it('has one entry per build shape', () => {
    expect(Object.keys(SHAPE_SPECS).sort()).toEqual([...BUILD_SHAPES].sort())
  })
})

describe('validateBuild', () => {
  it('returns no error when there is no build block', () => {
    expect(validateBuild(specWith(undefined))).toEqual([])
  })

  it('accepts a valid cylinder-plug', () => {
    expect(validateBuild(specWith({ shape: 'cylinder-plug', params: { frontLenMm: 12 } }))).toEqual([])
  })

  it('refuses cylinder-plug on a device, naming the shape and the kind', () => {
    const errors = validateBuild(specWith({ shape: 'cylinder-plug' }, { kind: 'device', tier: 'standard', mating: undefined }))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('cylinder-plug')
    expect(errors[0]).toContain('device')
    expect(errors[0]).toContain('test-plug')
  })

  it('refuses rack-box on a connector, naming the shape and the kind', () => {
    const errors = validateBuild(specWith({ shape: 'rack-box' }))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('rack-box')
    expect(errors[0]).toContain('connector')
  })

  it('rejects a misspelled param by name and lists the allowed ones', () => {
    const errors = validateBuild(specWith({ shape: 'cylinder-plug', params: { frontLenmm: 12 } }))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('frontLenmm')
    expect(errors[0]).toContain('frontLenMm')
  })

  it('rejects zero and negative params with the param name and "positive"', () => {
    for (const bad of [0, -1]) {
      const errors = validateBuild(specWith({ shape: 'cylinder-plug', params: { frontLenMm: bad } }))
      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('frontLenMm')
      expect(errors[0]).toContain('positive')
    }
  })

  it('rejects a non-finite param even when it bypasses the schema', () => {
    const errors = validateBuild(specWith({ shape: 'cylinder-plug', params: { frontLenMm: Number.NaN } }))
    expect(errors[0]).toContain('frontLenMm')
    expect(errors[0]).toContain('positive')
  })

  it('requires mating.outerMm for the plug shapes that need it', () => {
    for (const shape of ['cylinder-plug', 'trs-plug'] as const) {
      const errors = validateBuild(specWith({ shape }, { mating: { role: 'plug' } }))
      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('mating.outerMm')
    }
    expect(validateBuild(specWith({ shape: 'cylinder-plug' }, { mating: undefined }))[0]).toContain('mating.outerMm')
  })

  it('does not need a mating diameter for rj45-plug', () => {
    expect(validateBuild(specWith({ shape: 'rj45-plug' }, { mating: undefined }))).toEqual([])
  })

  it('accepts the Rio stage box with its datasheet params on a device, and rejects a misspelled one', () => {
    const device = { kind: 'device', tier: 'hero', mating: undefined } as const
    expect(validateBuild(specWith({ shape: 'stagebox-rio3224', params: { earMm: 27, flangeDepthMm: 190, frontStepMm: 11.5, rearStepMm: 6 } }, device))).toEqual([])
    const errors = validateBuild(specWith({ shape: 'stagebox-rio3224', params: { earmm: 27 } }, device))
    expect(errors[0]).toContain('earmm')
    expect(errors[0]).toContain('earMm')
  })

  describe('revolve (lathe profile)', () => {
    const device = { kind: 'device', tier: 'hero', mating: undefined, realSizeMm: { w: 51, h: 162, d: 51 } } as const
    const profile: [number, number][] = [[0, 23.4], [20, 26], [117, 33], [140, 51], [162, 5]]
    const revolve = (over: Partial<NonNullable<AssetSpecT['build']>> = {}, spec: Partial<AssetSpecT> = {}): AssetSpecT =>
      specWith({ shape: 'revolve', profile, ...over }, { ...device, ...spec })

    it('accepts a profile that spans the height, peaks at the width and sits on a round footprint', () => {
      expect(validateBuild(revolve())).toEqual([])
      expect(validateBuild(revolve({ params: { segments: 24 } }))).toEqual([])
    })

    it('needs a profile, and refuses a profile on any other shape, naming both', () => {
      expect(validateBuild(revolve({ profile: undefined }))[0]).toMatch(/revolve.*profile/)
      const e = validateBuild(specWith({ shape: 'rack-box', profile }, { ...device }))
      expect(e).toHaveLength(1)
      expect(e[0]).toMatch(/rack-box.*no profile|profile.*rack-box/)
    })

    it('refuses a profile that does not start at the base, does not end at the height or does not reach the width', () => {
      expect(validateBuild(revolve({ profile: [[1, 23.4], [20, 26], [117, 33], [140, 51], [162, 5]] }))[0]).toMatch(/first station.*0/)
      expect(validateBuild(revolve({ profile: [[0, 23.4], [20, 26], [117, 33], [140, 51], [160, 5]] }))[0]).toMatch(/last station.*162/)
      expect(validateBuild(revolve({ profile: [[0, 23.4], [20, 26], [117, 33], [140, 45], [162, 5]] }))[0]).toMatch(/widest station.*51/)
      expect(validateBuild(revolve({ profile: [[0, 23.4], [20, 26], [117, 33], [140, 55], [162, 5]] }))[0]).toMatch(/widest station.*51/)
    })

    it('refuses a footprint that is not round (w differs from d) and a bad segment count', () => {
      expect(validateBuild(revolve({}, { realSizeMm: { w: 51, h: 162, d: 60 } }))[0]).toMatch(/round|w.*d/)
      for (const segments of [10, 14, 66, 30.5]) {
        expect(validateBuild(revolve({ params: { segments } }))[0], String(segments)).toMatch(/segments/)
      }
    })

    it('refuses colours with a station before 0 or beyond the height', () => {
      expect(validateBuild(revolve({ colours: [{ fromMm: 0, colour: '#111111' }, { fromMm: 170, colour: '#222222' }] }))[0]).toMatch(/colour.*170/)
    })
  })

  it('accepts a rack-box with a chamfer on a device', () => {
    const spec = specWith({ shape: 'rack-box', params: { chamferMm: 1 } }, { kind: 'device', tier: 'standard', mating: undefined })
    expect(validateBuild(spec)).toEqual([])
  })
})

describe('console-wedge (side profile)', () => {
  const device: Partial<AssetSpecT> = { kind: 'device', realSizeMm: { w: 468, h: 272, d: 562 } }
  const profile: [number, number][] = [[0, 272], [40, 257], [161, 178], [281, 132], [562, 95]]
  const wedge = (over: Partial<NonNullable<AssetSpecT['build']>> = {}): AssetSpecT => specWith({ shape: 'console-wedge', profile, ...over }, device)

  it('accepts a side profile from the io face (depth 0) to the front edge (depth d), its tallest point being the height', () => {
    expect(validateBuild(wedge())).toEqual([])
    expect(validateBuild(wedge({ params: { chamferMm: 1 } }))).toEqual([])
  })

  it('needs a profile, and takes no colours', () => {
    expect(validateBuild(wedge({ profile: undefined }))[0]).toMatch(/console-wedge.*profile/)
    expect(validateBuild(wedge({ colours: [{ fromMm: 0, colour: '#222222' }] }))[0]).toMatch(/colours/)
  })

  it('checks the first depth (0), the last depth (d), and the tallest point (h), each named in the message', () => {
    expect(validateBuild(wedge({ profile: [[5, 272], [40, 257], [161, 178], [562, 95]] }))[0]).toMatch(/first station.*0/)
    expect(validateBuild(wedge({ profile: [[0, 272], [40, 257], [161, 178], [500, 95]] }))[0]).toMatch(/last station.*562/)
    expect(validateBuild(wedge({ profile: [[0, 250], [40, 240], [161, 178], [562, 95]] }))[0]).toMatch(/tallest.*272/)
    expect(validateBuild(wedge({ profile: [[0, 300], [40, 257], [161, 178], [562, 95]] }))[0]).toMatch(/tallest.*272/)
  })

  it('refuses a height of 0 or less at a station (the casing would have no thickness there)', () => {
    expect(validateBuild(wedge({ profile: [[0, 272], [40, 0], [161, 178], [562, 95]] }))[0]).toMatch(/height/)
  })
})

describe('xlr-male-plug and the pins param of cylinder-plug', () => {
  it('xlr-male-plug is a connector shape with a pins param; cylinder-plug takes pins too, and neither needs a profile', () => {
    expect(SHAPE_SPECS['xlr-male-plug']).toMatchObject({ kind: 'connector', needsMatingOuter: false })
    expect([...SHAPE_SPECS['xlr-male-plug'].params]).toEqual(['pins'])
    expect([...SHAPE_SPECS['cylinder-plug'].params].sort()).toEqual(['frontLenMm', 'pins'])
  })
})

describe('usb-plug', () => {
  it('is a connector shape with a type param (1 A, 2 B, 3 C)', () => {
    expect(SHAPE_SPECS['usb-plug']).toMatchObject({ kind: 'connector', needsMatingOuter: false })
    expect([...SHAPE_SPECS['usb-plug'].params]).toEqual(['type'])
  })
})

describe('trs-plug params for the TS plug and the miniature plugs', () => {
  it('takes barrelMm, zScale and poles (2 = TS, 3 = TRS)', () => {
    expect([...SHAPE_SPECS['trs-plug'].params].sort()).toEqual(['barrelMm', 'poles', 'zScale'])
  })
})

describe('mains and twist-lock connector shapes', () => {
  const connector: Partial<AssetSpecT> = { kind: 'connector', tier: 'connector', mating: undefined, realSizeMm: { w: 26.83, h: 30.34, d: 79.25 }, ports: [] }
  it('iec-inlet, iec-cable, schuko-plug and schuko-socket are connector shapes without params', () => {
    for (const id of ['iec-inlet', 'iec-cable', 'schuko-plug', 'schuko-socket'] as const) {
      expect(SHAPE_SPECS[id], id).toMatchObject({ kind: 'connector', needsMatingOuter: false })
      expect([...SHAPE_SPECS[id].params], id).toEqual([])
    }
  })
  it('locking-plug takes contacts and colour, and refuses a param it does not know', () => {
    expect([...SHAPE_SPECS['locking-plug'].params].sort()).toEqual(['colour', 'contacts'])
    expect(validateBuild(specWith({ shape: 'locking-plug', params: { contacts: 4, colour: 1 } }, connector))).toEqual([])
    expect(validateBuild(specWith({ shape: 'locking-plug', params: { poles: 4 } }, connector))[0]).toMatch(/poles/)
  })
})

describe('boom-arm (articulated mic arm in a posed side view)', () => {
  const device: Partial<AssetSpecT> = { kind: 'device', tier: 'standard', mating: undefined, realSizeMm: { w: 525, h: 543, d: 51 }, ports: [] }
  it('is a device shape that takes the pose and the tube sizes as params, and needs no profile', () => {
    expect(SHAPE_SPECS['boom-arm']).toMatchObject({ kind: 'device', needsMatingOuter: false })
    expect([...SHAPE_SPECS['boom-arm'].params].sort()).toEqual(['columnHeightMm', 'elbowDxMm', 'elbowDyMm', 'headDropMm', 'headDxMm', 'headDyMm', 'jointDiaMm', 'rodLenMm', 'tubeDiaMm'])
    expect(validateBuild(specWith({ shape: 'boom-arm', params: { elbowDxMm: 157, elbowDyMm: 370 } }, device))).toEqual([])
    expect(validateBuild(specWith({ shape: 'boom-arm', params: { tubeDiaMm: 0 } }, device))[0]).toMatch(/tubeDiaMm/)
  })
})

describe('cable-assembly (a D-sub hood, a trunk and a fan-out of XLR plugs)', () => {
  const device: Partial<AssetSpecT> = { kind: 'device', tier: 'standard', mating: undefined, realSizeMm: { w: 96, h: 48, d: 500 }, ports: [] }
  it('is a device shape with the hood, plug and cable sizes as params, and needs no profile', () => {
    expect(SHAPE_SPECS['cable-assembly']).toMatchObject({ kind: 'device', needsMatingOuter: false })
    expect([...SHAPE_SPECS['cable-assembly'].params].sort()).toEqual(['columns', 'hoodHeightMm', 'hoodLenMm', 'hoodWidthMm', 'pitchMm', 'plugDiaMm', 'plugLenMm', 'rows', 'tailLenMm', 'trunkDiaMm'])
    expect(validateBuild(specWith({ shape: 'cable-assembly', params: { plugDiaMm: 22, columns: 4, rows: 2 } }, device))).toEqual([])
    expect(validateBuild(specWith({ shape: 'cable-assembly', params: { columns: 0 } }, device))[0]).toMatch(/columns/)
  })
})

describe('speaker-cabinet (plan hexagon, socket pockets)', () => {
  const port = (portId: string, xMm: number, over: Record<string, unknown> = {}): AssetSpecT['ports'][number] =>
    ({ portId, face: 'io', xMm, yMm: 300, confidence: 'photo', openingMm: 24, insetMm: 25, ...over }) as AssetSpecT['ports'][number]
  const device: Partial<AssetSpecT> = { kind: 'device', tier: 'hero', mating: undefined, realSizeMm: { w: 356, h: 602, d: 350 }, ports: [port('in-line-a', 180)] }
  const cabinet = (params: Record<string, number> = { rearWidthMm: 168, taperDepthMm: 120, chamferMm: 3 }, over: Partial<AssetSpecT> = {}): AssetSpecT =>
    specWith({ shape: 'speaker-cabinet', params }, { ...device, ...over })

  it('is a device shape with its own params, and its spec needs no profile or colours', () => {
    expect(SHAPE_SPECS['speaker-cabinet']).toMatchObject({ kind: 'device', needsMatingOuter: false })
    expect([...SHAPE_SPECS['speaker-cabinet'].params].sort()).toEqual(['bevelSegments', 'chamferMm', 'midWidthMm', 'rearWidthMm', 'taperDepthMm'])
    expect(validateBuild(cabinet())).toEqual([])
    expect(validateBuild(cabinet({}))).toEqual([]) // a plain box needs no param at all
  })

  it('refuses a rear wider than the front, and a rear too narrow for the bevel', () => {
    expect(validateBuild(cabinet({ rearWidthMm: 400, taperDepthMm: 100 }))[0]).toMatch(/rearWidthMm.*356/)
    expect(validateBuild(cabinet({ rearWidthMm: 5, taperDepthMm: 100, chamferMm: 3 }))[0]).toMatch(/rearWidthMm/)
  })

  it('needs a taper depth inside the casing when the rear is narrower, and refuses one when it is not', () => {
    expect(validateBuild(cabinet({ rearWidthMm: 168 }))[0]).toMatch(/taperDepthMm/) // narrower rear without a taper
    expect(validateBuild(cabinet({ rearWidthMm: 168, taperDepthMm: 350 }))[0]).toMatch(/taperDepthMm.*350/) // the whole depth
    expect(validateBuild(cabinet({ taperDepthMm: 100 }))[0]).toMatch(/taperDepthMm/) // a taper without a narrower rear
  })

  it('the mid width (where the rear taper starts) lies between the rear width and the front width', () => {
    expect(validateBuild(cabinet({ midWidthMm: 338, rearWidthMm: 168, taperDepthMm: 120, chamferMm: 3 }))).toEqual([])
    expect(validateBuild(cabinet({ midWidthMm: 400, rearWidthMm: 168, taperDepthMm: 120 }))[0]).toMatch(/midWidthMm.*356/)
    expect(validateBuild(cabinet({ midWidthMm: 150, rearWidthMm: 168, taperDepthMm: 120 }))[0]).toMatch(/rearWidthMm.*midWidthMm/)
    expect(validateBuild(cabinet({ midWidthMm: 338, taperDepthMm: 120 }))[0]).toMatch(/midWidthMm|taperDepthMm/) // a narrower middle without a narrower rear is a plain trapezoid: needs the rear width
  })

  it('takes a whole number of bevel segments from 1 to 4', () => {
    expect(validateBuild(cabinet({ chamferMm: 3, bevelSegments: 3 }))).toEqual([])
    expect(validateBuild(cabinet({ chamferMm: 3, bevelSegments: 5 }))[0]).toMatch(/bevelSegments/)
    expect(validateBuild(cabinet({ chamferMm: 3, bevelSegments: 2.5 }))[0]).toMatch(/bevelSegments/)
  })

  it('checks every socket pocket: only on the io face, inside the rear face, no deeper than half the depth', () => {
    const rear = { rearWidthMm: 168, taperDepthMm: 120, chamferMm: 3 } // the rear face spans x = 94 .. 262 mm
    expect(validateBuild(cabinet(rear, { ports: [port('a', 94 + 12 + 3), port('b', 262 - 12 - 3)] }))).toEqual([]) // just inside, pocket radius 12
    expect(validateBuild(cabinet(rear, { ports: [port('left-out', 74)] }))[0]).toMatch(/left-out.*rear face/)
    expect(validateBuild(cabinet(rear, { ports: [port('right-out', 270)] }))[0]).toMatch(/right-out.*rear face/)
    expect(validateBuild(cabinet(rear, { ports: [port('deep', 180, { insetMm: 200 })] }))[0]).toMatch(/deep.*inset/)
    expect(validateBuild(cabinet(rear, { ports: [port('side', 180, { face: 'left' })] }))[0]).toMatch(/side.*io face/)
    expect(validateBuild(cabinet(rear, { ports: [port('flush', 40, { insetMm: undefined })] }))).toEqual([]) // no inset, no pocket, no check
  })
})
