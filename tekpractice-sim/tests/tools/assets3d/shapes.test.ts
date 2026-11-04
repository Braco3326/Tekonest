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
