/**
 * Propriétés model (Task 10, C5, P6): the selected device's fields, controls
 * and ports, and the parsing of a field edit into the intent to dispatch.
 * Pure: no DOM, no Babylon.
 */
import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { fieldIntent, poseChanged, propsView, stepIntent, type PropsView } from '../../src/creation/shell/propertiesModel'
import type { DesignState } from '../../src/trials/trial'

const registry = makeRegistry()

function design(): DesignState {
  const s = new CreationStore(registry, creationEvaluator(registry))
  const ok = (r: { ok: boolean }) => expect(r.ok).toBe(true)
  ok(s.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [1, 0, 2], rotationY: 30 }))
  ok(s.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [3, 1.2, -3], rotationY: 0, tiltDeg: -5, mount: 'stand' }))
  ok(s.dispatch({ type: 'SPAWN', deviceId: 'focusrite-isa-one', instanceId: 'isa', position: [0, 0, 0] }))
  ok(s.dispatch({ type: 'SPAWN', deviceId: 'avid-hd-io', instanceId: 'hdio', position: [0, 0, 1] }))
  ok(s.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } }))
  return s.design()
}

const view = (d: DesignState, id: string): PropsView => propsView(d, registry, id)!
const field = (v: PropsView, id: string) => v.fields.find((f) => f.id === id)!

describe('propsView', () => {
  it('a placed QL1: title, name, x/y/z in metres with 2 decimals (French comma), yaw / tilt in degrees', () => {
    const v = view(design(), 'ql1')
    expect(v.title).toBe('Yamaha QL1')
    expect(v.deviceId).toBe('yamaha-ql1')
    expect(v.fields.map((f) => f.id)).toEqual(['name', 'x', 'y', 'z', 'yaw', 'tilt', 'mount'])
    expect(field(v, 'name')).toMatchObject({ value: 'ql1', readOnly: true })
    expect(field(v, 'x')).toMatchObject({ value: '1,00', unit: 'm' })
    expect(field(v, 'z')).toMatchObject({ value: '2,00', unit: 'm' })
    expect(field(v, 'yaw')).toMatchObject({ value: '30', unit: '°' })
    expect(field(v, 'tilt')).toMatchObject({ value: '0', unit: '°', min: -90, max: 90 })
    // a floor device stands on the floor: its height is not editable
    expect(field(v, 'y')).toMatchObject({ value: '0,00', unit: 'm', readOnly: true })
    for (const id of ['x', 'y', 'z', 'yaw', 'tilt']) expect(field(v, id).step).toBeGreaterThan(0)
  })

  it('mount reads « Sol / Pied / Accroché »; a stand device has an editable height and its tilt', () => {
    const v = view(design(), 'k12-g')
    const mount = field(v, 'mount')
    expect(mount.value).toBe('stand')
    expect(mount.options).toEqual([
      { value: 'floor', label: 'Sol' },
      { value: 'stand', label: 'Pied' },
      { value: 'flown', label: 'Accroché' },
    ])
    expect(field(v, 'y')).toMatchObject({ value: '1,20' })
    expect(field(v, 'y').readOnly).toBeFalsy()
    expect(field(v, 'tilt').value).toBe('-5')
  })

  it('controls come from the catalog (toggle and enum, with the live value)', () => {
    const d = design()
    expect(view(d, 'ql1').controls).toEqual([])
    expect(view(d, 'isa').controls).toEqual([{ id: 'phantom-48v', label: '+48V phantom', kind: 'toggle', value: false }])
    expect(view(d, 'hdio').controls).toEqual([{ id: 'sample-rate', label: 'Sample rate', kind: 'enum', value: '48000', options: ['44100', '48000', '96000'] }])
  })

  it('ports are listed with their state: free, or connected to « K12.2 (k12-g) · in-line-a »', () => {
    const v = view(design(), 'ql1')
    expect(v.ports.map((p) => p.portId)).toEqual(['in-mic-1', 'in-mic-2', 'out-main-l', 'out-main-r', 'out-mix-1', 'dante-primary', 'power-in'])
    const main = v.ports.find((p) => p.portId === 'out-main-l')!
    expect(main).toMatchObject({ connector: 'xlr3-m', signal: 'line-level-pro', dir: 'out' })
    expect(main.state).toEqual({ kind: 'connected', to: { instance: 'k12-g', port: 'in-line-a' }, toLabel: 'K12.2 (k12-g) · in-line-a' })
    expect(main.signalLabel).toBe('Niveau ligne pro (+4 dBu)')
    expect(v.ports.find((p) => p.portId === 'in-mic-1')!.state).toEqual({ kind: 'free' })
    // the other end sees it too
    const back = view(design(), 'k12-g').ports.find((p) => p.portId === 'in-line-a')!
    expect(back.state).toMatchObject({ kind: 'connected', toLabel: 'QL1 (ql1) · out-main-l' })
  })

  it('a placement with no mount above the floor reads as « Pied » with an editable height (review fix 4); on the floor, « Sol »', () => {
    const d = design()
    d.placements = d.placements.map((p) => (p.instanceId === 'isa' ? { instanceId: 'isa', deviceId: p.deviceId, position_m: [0, 1.2, 0], yawDeg: 0 } : p))
    const v = view(d, 'isa')
    expect(field(v, 'mount').value).toBe('stand')
    expect(field(v, 'y').readOnly).toBeFalsy()
    expect(field(v, 'y').value).toBe('1,20')
    // an edit keeps the device where it is (no silent drop to the floor)
    expect(fieldIntent(v, d, 'x', '2')).toMatchObject({ position: [2, 1.2, 0], mount: 'stand' })
    // the place's floor is at 1.2 m there: it stands on the floor
    const raised = { floorAt: () => 1.2 }
    const onFloor = propsView(d, registry, 'isa', raised)!
    expect(field(onFloor, 'mount').value).toBe('floor')
    expect(field(onFloor, 'y').readOnly).toBe(true)
    expect(fieldIntent(onFloor, d, 'x', '2', raised)).toMatchObject({ position: [2, 1.2, 0], mount: 'floor' })
  })

  it('an unplaced device stands at the origin; an unknown instance has no view', () => {
    const d = design()
    d.placements = d.placements.filter((p) => p.instanceId !== 'isa')
    expect(field(view(d, 'isa'), 'x').value).toBe('0,00')
    expect(propsView(d, registry, 'nope')).toBeNull()
  })
})

describe('fieldIntent', () => {
  it('x « 1,5 » (French decimal comma) → SET_POSE with x = 1.5, the rest of the pose kept', () => {
    const d = design()
    expect(fieldIntent(view(d, 'ql1'), d, 'x', '1,5')).toEqual({ type: 'SET_POSE', instanceId: 'ql1', position: [1.5, 0, 2], yawDeg: 30, tiltDeg: 0, mount: 'floor' })
  })

  it('accepts a dot, spaces, the unit and the typographic minus; rejects anything else', () => {
    const d = design()
    const v = view(d, 'ql1')
    const x = (raw: string) => {
      const i = fieldIntent(v, d, 'x', raw)
      return i && i.type === 'SET_POSE' ? i.position[0] : null
    }
    expect(x('2.25')).toBe(2.25)
    expect(x(' 2,5 m ')).toBe(2.5)
    expect(x('−1,5')).toBe(-1.5)
    expect(x(',5')).toBe(0.5)
    for (const bad of ['abc', '', ' ', '1,2,3', '1e3', '--1', '2 °', 'Infinity', 'NaN']) expect(x(bad), bad).toBeNull()
  })

  it('yaw wraps into [0, 360): 370 → 10, −30 → 330', () => {
    const d = design()
    const yaw = (raw: string) => {
      const i = fieldIntent(view(d, 'ql1'), d, 'yaw', raw)
      return i && i.type === 'SET_POSE' ? i.yawDeg : null
    }
    expect(yaw('370')).toBe(10)
    expect(yaw('-30')).toBe(330)
    expect(yaw('45 °')).toBe(45)
    expect(yaw('360')).toBe(0)
  })

  it('tilt clamps to [−90, 90]', () => {
    const d = design()
    const tilt = (raw: string) => {
      const i = fieldIntent(view(d, 'k12-g'), d, 'tilt', raw)
      return i && i.type === 'SET_POSE' ? i.tiltDeg : null
    }
    expect(tilt('120')).toBe(90)
    expect(tilt('-95')).toBe(-90)
    expect(tilt('7,5')).toBe(7.5)
  })

  it('mount floor forces y = floor height (0 by default, or the place floor); a bad mount is refused', () => {
    const d = design()
    const v = view(d, 'k12-g')
    expect(fieldIntent(v, d, 'mount', 'floor')).toEqual({ type: 'SET_POSE', instanceId: 'k12-g', position: [3, 0, -3], yawDeg: 0, tiltDeg: -5, mount: 'floor' })
    const raised = fieldIntent(v, d, 'mount', 'floor', { floorAt: (x, z) => (x === 3 && z === -3 ? 0.4 : 9) })
    expect(raised && raised.type === 'SET_POSE' && raised.position[1]).toBe(0.4)
    expect(fieldIntent(v, d, 'mount', 'flown')).toMatchObject({ mount: 'flown', position: [3, 1.2, -3] })
    expect(fieldIntent(v, d, 'mount', 'ceiling')).toBeNull()
  })

  it('height: read-only on the floor; never below the floor for a stand or flown device', () => {
    const d = design()
    expect(fieldIntent(view(d, 'ql1'), d, 'y', '1')).toBeNull()
    expect(fieldIntent(view(d, 'k12-g'), d, 'y', '2,4')).toMatchObject({ position: [3, 2.4, -3] })
    expect(fieldIntent(view(d, 'k12-g'), d, 'y', '-1')).toMatchObject({ position: [3, 0, -3] })
  })

  it('the name is read-only (no intent)', () => {
    const d = design()
    expect(fieldIntent(view(d, 'ql1'), d, 'name', 'console')).toBeNull()
  })
})

describe('stepIntent (± steppers) and poseChanged', () => {
  it('steps from the store value: X ± 0,1 m, yaw ± 15° wrapping, tilt ± 1° clamped', () => {
    const d = design()
    expect(stepIntent(view(d, 'ql1'), d, 'x', 1)).toMatchObject({ position: [1.1, 0, 2] })
    expect(stepIntent(view(d, 'ql1'), d, 'z', -1)).toMatchObject({ position: [1, 0, 1.9] })
    expect(stepIntent(view(d, 'ql1'), d, 'yaw', -1)).toMatchObject({ yawDeg: 15 })
    const at350 = { ...d, placements: d.placements.map((p) => (p.instanceId === 'ql1' ? { ...p, yawDeg: 350 } : p)) }
    expect(stepIntent(view(at350, 'ql1'), at350, 'yaw', 1)).toMatchObject({ yawDeg: 5 })
    expect(stepIntent(view(d, 'k12-g'), d, 'tilt', 1)).toMatchObject({ tiltDeg: -4 })
    const at90 = { ...d, placements: d.placements.map((p) => (p.instanceId === 'k12-g' ? { ...p, tiltDeg: 90 } : p)) }
    expect(stepIntent(view(at90, 'k12-g'), at90, 'tilt', 1)).toMatchObject({ tiltDeg: 90 })
    expect(stepIntent(view(d, 'ql1'), d, 'y', 1)).toBeNull() // read-only on the floor
  })

  it('poseChanged: false for the same pose (nothing to record), true otherwise', () => {
    const d = design()
    expect(poseChanged(d, fieldIntent(view(d, 'ql1'), d, 'x', '1')!)).toBe(false)
    expect(poseChanged(d, fieldIntent(view(d, 'ql1'), d, 'x', '1,001')!)).toBe(true)
    expect(poseChanged(d, fieldIntent(view(d, 'k12-g'), d, 'mount', 'stand')!)).toBe(false)
  })
})
