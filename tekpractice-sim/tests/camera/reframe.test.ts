import { describe, expect, it } from 'vitest'
import { needsReframe, REFRAME_MIN_SHIFT_M } from '../../src/camera/tween'

describe('needsReframe (Task 4: a model landing re-centres the pivot, no jump under 2 cm)', () => {
  it('the threshold is 2 cm', () => {
    expect(REFRAME_MIN_SHIFT_M).toBe(0.02)
  })
  it('ignores a shift under 2 cm', () => {
    expect(needsReframe([0, 0, 0], [0.01, 0.01, 0])).toBe(false)
    expect(needsReframe([1, 2, 3], [1, 2, 3])).toBe(false)
  })
  it('re-frames from 2 cm on', () => {
    expect(needsReframe([0, 0, 0], [0.02, 0, 0])).toBe(true)
    expect(needsReframe([0, 0, 0], [0, 0.3, 0])).toBe(true)
  })
})
