import { describe, expect, it } from 'vitest'
import { PlanHistory } from '../../src/plan2d/history'
import { emptyPlan } from '../../src/plan2d/model'

describe('plan history: undo / redo of pure intents', () => {
  it('each successful intent is one step; undo and redo walk them; a new step clears redo', () => {
    const h = new PlanHistory(emptyPlan('blank'))
    expect(h.canUndo).toBe(false)
    h.do({ type: 'place', deviceId: 'a', x: 0, z: 0 }, 'Poser a')
    h.do({ type: 'move', ids: ['a-1'], dx: 1, dz: 0 }, 'Déplacer a')
    expect(h.plan.devices[0]!.x).toBe(1)
    expect(h.undoLabel).toBe('Déplacer a')
    expect(h.undo()).toBe('Déplacer a')
    expect(h.plan.devices[0]!.x).toBe(0)
    expect(h.redo()).toBe('Déplacer a')
    expect(h.plan.devices[0]!.x).toBe(1)
    h.undo()
    h.do({ type: 'rotate', ids: ['a-1'], by: 90 }, 'Pivoter a')
    expect(h.canRedo).toBe(false)
    expect(h.undo()).toBe('Pivoter a')
    expect(h.undo()).toBe('Poser a')
    expect(h.plan.devices).toEqual([])
    expect(h.undo()).toBeNull()
  })

  it('a refused intent is no step and changes nothing', () => {
    const h = new PlanHistory(emptyPlan('blank'))
    const r = h.do({ type: 'remove', ids: ['x'] }, 'Supprimer')
    expect(r.ok).toBe(false)
    expect(h.canUndo).toBe(false)
  })

  it('ids stay stable across undo / redo (a redone place gets the same id back)', () => {
    const h = new PlanHistory(emptyPlan('blank'))
    h.do({ type: 'place', deviceId: 'a', x: 0, z: 0 }, 'p')
    h.undo()
    h.redo()
    expect(h.plan.devices.map((d) => d.id)).toEqual(['a-1'])
  })

  it('subscribers hear every change of the plan (do, undo, redo, reset); the limit drops the oldest steps', () => {
    const h = new PlanHistory(emptyPlan('blank'), 2)
    const seen: number[] = []
    const off = h.subscribe((p) => seen.push(p.devices.length))
    h.do({ type: 'place', deviceId: 'a', x: 0, z: 0 }, '1')
    h.do({ type: 'place', deviceId: 'a', x: 0, z: 0 }, '2')
    h.do({ type: 'place', deviceId: 'a', x: 0, z: 0 }, '3')
    h.undo()
    h.undo()
    expect(h.undo()).toBeNull() // only two steps are kept
    expect(h.plan.devices).toHaveLength(1)
    h.reset(emptyPlan('blank'))
    expect(h.canRedo).toBe(false)
    off()
    h.do({ type: 'place', deviceId: 'a', x: 0, z: 0 }, '4')
    expect(seen).toEqual([1, 2, 3, 2, 1, 0])
  })
})
