/**
 * scene/assetExtras (3D rebuild, Task 10): the runtime reader of the `tekpractice` extras the pipeline writes on the
 * GLB root node. parseAssetExtras validates (never throws), findExtras looks for them on a loaded hierarchy.
 */
import { describe, expect, it } from 'vitest'
import type { AbstractMesh } from '@babylonjs/core'
import { findExtras, parseAssetExtras, type AssetExtrasV1 } from '../../src/scene/assetExtras'

const valid = (): AssetExtrasV1 => ({
  schema: 1,
  realSizeMm: { w: 356, h: 602, d: 350 },
  ports: [{ portId: 'in-line-a', pos: [0.1, 0.3, 0.175] }],
  controls: [{ controlId: 'power', pos: [0, 0.5, 0.175], axis: 'z', kind: 'toggle' }],
})

/** A copy of the valid extras with one field replaced (or removed, with `undefined`). */
function withField(path: string[], value: unknown): unknown {
  const v = JSON.parse(JSON.stringify(valid())) as Record<string, unknown>
  let o = v as Record<string, unknown>
  for (const k of path.slice(0, -1)) o = o[k] as Record<string, unknown>
  const last = path[path.length - 1]!
  if (value === undefined) delete o[last]
  else o[last] = value
  return v
}

describe('parseAssetExtras', () => {
  it('accepts a valid object and returns the same values', () => {
    expect(parseAssetExtras(valid())).toEqual(valid())
  })

  it('accepts the value as a JSON string (exporters that stringify custom properties)', () => {
    expect(parseAssetExtras(JSON.stringify(valid()))).toEqual(valid())
  })

  it('accepts empty ports and controls arrays', () => {
    expect(parseAssetExtras({ ...valid(), ports: [], controls: [] })).toEqual({ ...valid(), ports: [], controls: [] })
  })

  it('returns null for a wrong schema number', () => {
    expect(parseAssetExtras({ ...valid(), schema: 2 })).toBeNull()
    expect(parseAssetExtras({ ...valid(), schema: '1' })).toBeNull()
    expect(parseAssetExtras(withField(['schema'], undefined))).toBeNull()
  })

  it('returns null for a missing realSizeMm', () => {
    expect(parseAssetExtras(withField(['realSizeMm'], undefined))).toBeNull()
  })

  it('returns null for a non-finite or non-positive real size', () => {
    expect(parseAssetExtras(withField(['realSizeMm', 'h'], 0))).toBeNull()
    expect(parseAssetExtras(withField(['realSizeMm', 'w'], -5))).toBeNull()
    expect(parseAssetExtras(withField(['realSizeMm', 'd'], undefined))).toBeNull()
    expect(parseAssetExtras(withField(['realSizeMm', 'd'], '350'))).toBeNull()
    expect(parseAssetExtras({ ...valid(), realSizeMm: { w: NaN, h: 1, d: 1 } })).toBeNull()
    expect(parseAssetExtras({ ...valid(), realSizeMm: { w: 1, h: Infinity, d: 1 } })).toBeNull()
  })

  it('returns null when ports or controls are not arrays of well-shaped entries', () => {
    expect(parseAssetExtras(withField(['ports'], undefined))).toBeNull()
    expect(parseAssetExtras(withField(['controls'], undefined))).toBeNull()
    expect(parseAssetExtras({ ...valid(), ports: {} })).toBeNull()
    expect(parseAssetExtras({ ...valid(), ports: [{ pos: [0, 0, 0] }] })).toBeNull()
    expect(parseAssetExtras({ ...valid(), ports: [{ portId: '', pos: [0, 0, 0] }] })).toBeNull()
    expect(parseAssetExtras({ ...valid(), ports: [{ portId: 'a', pos: [0, 0] }] })).toBeNull()
    expect(parseAssetExtras({ ...valid(), ports: [{ portId: 'a', pos: [0, NaN, 0] }] })).toBeNull()
    expect(parseAssetExtras({ ...valid(), ports: [null] })).toBeNull()
    expect(parseAssetExtras({ ...valid(), controls: [{ controlId: 'p', pos: [0, 0, 0], axis: 'w', kind: 'knob' }] })).toBeNull()
    expect(parseAssetExtras({ ...valid(), controls: [{ controlId: 'p', pos: [0, 0, 0], axis: 'x' }] })).toBeNull()
    expect(parseAssetExtras({ ...valid(), controls: [{ controlId: 'p', pos: [0, 0, Infinity], axis: 'x', kind: 'knob' }] })).toBeNull()
  })

  it('returns null for anything that is not an extras object, and never throws', () => {
    for (const raw of [null, undefined, 42, true, [], 'not json', '{"schema":1', '[]', '"x"', () => 1]) {
      expect(() => parseAssetExtras(raw)).not.toThrow()
      expect(parseAssetExtras(raw)).toBeNull()
    }
    const hostile = { ...valid() }
    Object.defineProperty(hostile, 'ports', { get: () => { throw new Error('boom') }, enumerable: true })
    expect(() => parseAssetExtras(hostile)).not.toThrow()
    expect(parseAssetExtras(hostile)).toBeNull()
  })

  it('keeps only the known fields (no alias to the input arrays)', () => {
    const raw = { ...valid(), extra: 'ignored' }
    const out = parseAssetExtras(raw)!
    expect(out).toEqual(valid())
    expect('extra' in out).toBe(false)
    expect(out.ports).not.toBe(raw.ports)
    expect(out.ports[0]!.pos).not.toBe(raw.ports[0]!.pos)
  })
})

describe('findExtras', () => {
  /** A minimal stand-in for a loaded hierarchy: metadata + getDescendants is all findExtras reads. */
  const node = (metadata: unknown, descendants: unknown[] = []) =>
    ({ metadata, getDescendants: () => descendants }) as unknown as AbstractMesh
  const tagged = (raw: unknown) => ({ gltf: { extras: { tekpractice: raw } } })

  it('reads metadata.gltf.extras.tekpractice on the root node', () => {
    expect(findExtras(node(tagged(valid())))).toEqual(valid())
  })

  it('looks at the descendants when the root has none; the first valid one wins', () => {
    const second = { ...valid(), realSizeMm: { w: 1, h: 2, d: 3 } }
    const root = node({ isDeviceBody: true }, [node(null), node(tagged({ schema: 9 })), node(tagged(JSON.stringify(valid()))), node(tagged(second))])
    expect(findExtras(root)).toEqual(valid())
  })

  it('returns null when nothing in the hierarchy carries valid extras', () => {
    expect(findExtras(node(undefined, [node({ gltf: {} }), node(tagged('nope'))]))).toBeNull()
  })
})
