import { describe, expect, it } from 'vitest'
import { placeBubble } from '../../src/creation/shell/portLabel'

const box = { w: 800, h: 500 }
const size = { w: 200, h: 24 }

describe('placeBubble (a port label stays inside the 3D view)', () => {
  it('sits centred above the port', () => {
    const p = placeBubble({ x: 400, y: 250 }, size, box)
    expect(p.left).toBe(300)
    expect(p.top).toBeLessThan(250 - 24)
    expect(p.top + size.h).toBeLessThanOrEqual(250)
  })

  it('flips below the port when there is no room above', () => {
    const p = placeBubble({ x: 400, y: 10 }, size, box)
    expect(p.top).toBeGreaterThan(10)
  })

  it('is kept inside the box on every side', () => {
    for (const at of [{ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 0, y: 500 }, { x: 800, y: 500 }, { x: 5, y: 250 }, { x: 795, y: 250 }]) {
      const p = placeBubble(at, size, box)
      expect(p.left).toBeGreaterThanOrEqual(0)
      expect(p.top).toBeGreaterThanOrEqual(0)
      expect(p.left + size.w).toBeLessThanOrEqual(box.w)
      expect(p.top + size.h).toBeLessThanOrEqual(box.h)
    }
  })

  it('a bubble wider than the box starts at the left edge instead of going negative', () => {
    expect(placeBubble({ x: 100, y: 200 }, { w: 900, h: 24 }, box).left).toBeGreaterThanOrEqual(0)
  })
})
