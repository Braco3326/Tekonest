import { describe, expect, it } from 'vitest'
import { Vector3 } from '@babylonjs/core'
import { createSelection, isClick } from '../../src/creation/selection'
import { ViewState } from '../../src/creation/viewState'

function fakes() {
  const flights: { center: number[]; r: number }[] = []
  const selected: (string | null)[] = []
  const instances = new Set(['ql1'])
  const host = {
    instance: (id: string) =>
      instances.has(id)
        ? ({ root: { getChildMeshes: () => [], getHierarchyBoundingVectors: () => ({ min: new Vector3(-1, 0, 7), max: new Vector3(1, 1, 9) }) } } as never)
        : undefined,
    frameOfKey: (key: string) => (key === 'zone:scene' ? { center: new Vector3(0, 0, -5), boundingRadius: 3 } : null),
    rig: { flyToDevice: (f: { center: Vector3; boundingRadius: number }) => void flights.push({ center: f.center.asArray(), r: f.boundingRadius }) },
  }
  const viewState = new ViewState()
  const sel = createSelection({ viewState, host, invalidate: () => {}, onSelect: (id) => void selected.push(id) })
  return { flights, selected, viewState, sel }
}

describe('selection (Task 9): one selection state for tree, canvas and [ ]', () => {
  it('select(id) sets the view state, reports it and flies to the device frame', () => {
    const { flights, selected, viewState, sel } = fakes()
    expect(sel.select('ql1')).toBe(true)
    expect(viewState.get().selection).toBe('ql1')
    expect(selected).toEqual(['ql1'])
    expect(flights).toEqual([{ center: [0, 0.5, 8], r: Math.hypot(2, 1, 2) / 2 }])
  })
  it('select(id, { fly: false }) does not move the camera; an unknown device is refused', () => {
    const { flights, viewState, sel } = fakes()
    sel.select('ql1', { fly: false })
    expect(flights).toEqual([])
    expect(sel.select('nope')).toBe(false)
    expect(viewState.get().selection).toBe('ql1')
  })
  it('flyToKey frames a zone or a cable without selecting a device', () => {
    const { flights, viewState, sel } = fakes()
    sel.select('ql1', { fly: false })
    expect(sel.flyToKey('zone:scene')).toBe(true)
    expect(flights[0].center).toEqual([0, 0, -5])
    expect(viewState.get().selection).toBeNull()
    expect(sel.flyToKey('zone:none')).toBe(false)
  })
  it('a click is a short press that barely moved; a drag (orbit) is not', () => {
    expect(isClick({ x: 10, y: 10, t: 0 }, { x: 12, y: 11, t: 200 })).toBe(true)
    expect(isClick({ x: 10, y: 10, t: 0 }, { x: 30, y: 10, t: 200 })).toBe(false)
    expect(isClick({ x: 10, y: 10, t: 0 }, { x: 10, y: 10, t: 900 })).toBe(false)
  })
})
