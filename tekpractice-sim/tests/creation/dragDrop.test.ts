import { describe, expect, it } from 'vitest'
import { DRAG_START_PX, pastDragThreshold, releaseAction, toCanvasPx } from '../../src/creation/dragDrop'

describe('drawer drag decisions (Task 43b)', () => {
  it('the threshold is 6 px: exactly 6 is still a press, past it starts a placement', () => {
    expect(DRAG_START_PX).toBe(6)
    expect(pastDragThreshold({ x: 10, y: 10 }, { x: 16, y: 10 })).toBe(false) // 6.0
    expect(pastDragThreshold({ x: 10, y: 10 }, { x: 16.01, y: 10 })).toBe(true)
    expect(pastDragThreshold({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(false) // 5
    expect(pastDragThreshold({ x: 0, y: 0 }, { x: 4, y: 5 })).toBe(true) // 6.4: the distance, not each axis
    expect(pastDragThreshold({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(false)
    expect(pastDragThreshold({ x: 0, y: 0 }, { x: -7, y: 0 })).toBe(true) // any direction
  })
  it('a client point becomes canvas px by the canvas corner', () => {
    expect(toCanvasPx({ x: 300, y: 200 }, { left: 220, top: 32 })).toEqual({ x: 80, y: 168 })
  })
  it('a release drops only over the 3D view and only when not cancelled', () => {
    expect(releaseAction({ overView: true })).toBe('drop')
    expect(releaseAction({ overView: true, cancelled: false })).toBe('drop')
    expect(releaseAction({ overView: false })).toBe('cancel')
    expect(releaseAction({ overView: true, cancelled: true })).toBe('cancel')
    expect(releaseAction({ overView: false, cancelled: true })).toBe('cancel')
  })
})
