/**
 * Tests for the 'detail' and 'fillet' gates (tools/assets3d/gates.ts): a spec declares a triangle floor and ceiling
 * (build.budget) and a minimum edge fillet (build.minFilletMm); the builder measures the fillet it built and writes it into
 * the GLB extras. Both gates fail closed and pass when nothing is declared.
 */
import { describe, expect, it } from 'vitest'
import { checkDetail, checkFillet, declaredGates, filletFromExtras } from '../../../tools/assets3d/gates'
import type { GlbReport } from '../../../tools/assets3d/inspect'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'

function spec(build?: AssetSpecT['build']): AssetSpecT {
  return {
    id: 'test-speaker',
    kind: 'device',
    tier: 'hero',
    realSizeMm: { w: 189, h: 299, d: 178 },
    ports: [],
    controls: [],
    sources: [],
    ...(build ? { build } : {}),
  }
}

/** Only the fields the gates read. */
function report(triangles: number, extras: unknown = null): GlbReport {
  return { triangles, extras } as GlbReport
}

describe('checkDetail (triangle floor and ceiling)', () => {
  const withBudget = spec({ shape: 'curved-cabinet', budget: { min: 1500, max: 3500 } })

  it('fails a 44-triangle box against a 1500 to 3500 budget, naming the numbers', () => {
    const r = checkDetail(report(44), withBudget)
    expect(r.gate).toBe('detail')
    expect(r.ok).toBe(false)
    expect(r.detail).toContain('44')
    expect(r.detail).toContain('1500')
    expect(r.detail).toContain('3500')
  })

  it('passes 2000 triangles, and both ends of the range', () => {
    expect(checkDetail(report(2000), withBudget).ok).toBe(true)
    expect(checkDetail(report(1500), withBudget).ok).toBe(true)
    expect(checkDetail(report(3500), withBudget).ok).toBe(true)
  })

  it('fails one triangle over the ceiling and one under the floor', () => {
    expect(checkDetail(report(3501), withBudget).ok).toBe(false)
    expect(checkDetail(report(1499), withBudget).ok).toBe(false)
  })

  it('passes when the spec declares no budget (and says so)', () => {
    const r = checkDetail(report(44), spec({ shape: 'curved-cabinet' }))
    expect(r.ok).toBe(true)
    expect(r.detail).toMatch(/no budget/)
    expect(checkDetail(report(44), spec()).ok).toBe(true)
  })

  it('fails closed on a triangle count that is not a finite number', () => {
    expect(checkDetail(report(Number.NaN), withBudget).ok).toBe(false)
    expect(checkDetail(report(Number.POSITIVE_INFINITY), withBudget).ok).toBe(false)
  })
})

describe('checkFillet (measured edge fillet against the declared minimum)', () => {
  const withMin = spec({ shape: 'curved-cabinet', minFilletMm: 30 })

  it('fails a measured 12 mm against a 30 mm minimum, naming both', () => {
    const r = checkFillet(12, withMin)
    expect(r.gate).toBe('fillet')
    expect(r.ok).toBe(false)
    expect(r.detail).toContain('12')
    expect(r.detail).toContain('30')
  })

  it('passes at and above the minimum', () => {
    expect(checkFillet(30, withMin).ok).toBe(true)
    expect(checkFillet(41.5, withMin).ok).toBe(true)
  })

  it('fails closed: NaN, Infinity, and no measurement at all when a minimum is declared', () => {
    expect(checkFillet(Number.NaN, withMin).ok).toBe(false)
    expect(checkFillet(Number.POSITIVE_INFINITY, withMin).ok).toBe(false)
    const missing = checkFillet(null, withMin)
    expect(missing.ok).toBe(false)
    expect(missing.detail).toMatch(/not written|no measured|extras/i)
  })

  it('passes when no minimum is declared, whatever was measured', () => {
    const none = spec({ shape: 'curved-cabinet' })
    expect(checkFillet(null, none).ok).toBe(true)
    expect(checkFillet(0, none).ok).toBe(true)
    expect(checkFillet(null, spec()).ok).toBe(true)
  })
})

describe('filletFromExtras and declaredGates', () => {
  it('reads tekpractice.filletMm from the root extras, null when absent or not a number', () => {
    expect(filletFromExtras({ tekpractice: { schema: 1, filletMm: 21.5 } })).toBe(21.5)
    expect(filletFromExtras({ tekpractice: { schema: 1 } })).toBeNull()
    expect(filletFromExtras(null)).toBeNull()
    expect(filletFromExtras({ tekpractice: { filletMm: '21' } })).toBeNull()
    expect(filletFromExtras({ tekpractice: { filletMm: Number.NaN } })).toBeNull()
  })

  it('returns no gate for a spec that declares nothing, so the old gate lists stay as they were', () => {
    expect(declaredGates(report(44), spec())).toEqual([])
    expect(declaredGates(report(44), spec({ shape: 'curved-cabinet' }))).toEqual([])
  })

  it('returns detail for a declared budget and fillet for a declared minimum, in that order', () => {
    const both = spec({ shape: 'curved-cabinet', budget: { min: 10, max: 5000 }, minFilletMm: 10 })
    const gates = declaredGates(report(2000, { tekpractice: { filletMm: 12 } }), both)
    expect(gates.map((g) => g.gate)).toEqual(['detail', 'fillet'])
    expect(gates.every((g) => g.ok)).toBe(true)
    expect(declaredGates(report(2000), spec({ shape: 'curved-cabinet', minFilletMm: 10 })).map((g) => g.gate)).toEqual(['fillet'])
    expect(declaredGates(report(2000), spec({ shape: 'curved-cabinet', budget: { min: 10, max: 5000 } })).map((g) => g.gate)).toEqual(['detail'])
  })
})
