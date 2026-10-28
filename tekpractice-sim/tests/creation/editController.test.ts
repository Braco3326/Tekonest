import { describe, expect, it, vi } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { History } from '../../src/creation/history'
import { EditController } from '../../src/creation/editController'
import { designFingerprint, isDirty } from '../../src/creation/persistence'

const registry = loadCatalog(catalogJson)

function setup(over: { blocked?: () => boolean; bounds?: boolean } = {}) {
  const store = new CreationStore(registry, creationEvaluator(registry))
  const history = new History(store)
  let selected: string | null = null
  const announce = vi.fn()
  const onDuplicated = vi.fn((id: string) => void (selected = id))
  const edits = new EditController({
    history,
    store,
    selection: () => selected,
    blocked: over.blocked ?? (() => false),
    roomBounds: over.bounds ? () => ({ minX: -5, maxX: 5, minZ: -4, maxZ: 4 }) : undefined,
    deviceLabel: (id) => id,
    announce,
    undoLabel: () => 'Ctrl+Z',
    onDuplicated,
  })
  const spawn = (instanceId: string, deviceId: string, extra: Record<string, unknown> = {}) =>
    history.do({ type: 'SPAWN', deviceId, instanceId, position: [2, 0, 3], ...extra } as never)
  const pose = (id: string) => store.design().placements.find((p) => p.instanceId === id)
  return { store, history, edits, announce, onDuplicated, select: (id: string | null) => (selected = id), spawn, pose, selected: () => selected }
}

describe('rotate', () => {
  it('R: +15 deg as ONE undo entry (SET_POSE), position / tilt / mount kept', () => {
    const s = setup()
    s.spawn('q', 'yamaha-ql1', { rotationY: 30, tiltDeg: 5, mount: 'stand' })
    s.select('q')
    const before = s.history.sizes.undo
    expect(s.edits.rotate(1, false)).toBe(true)
    expect(s.pose('q')).toEqual({ instanceId: 'q', deviceId: 'yamaha-ql1', position_m: [2, 0, 3], yawDeg: 45, tiltDeg: 5, mount: 'stand' })
    expect(s.history.sizes.undo).toBe(before + 1)
    expect(s.history.undoLabel).toBe('Pivoter yamaha-ql1')
    s.history.undo()
    expect(s.pose('q')!.yawDeg).toBe(30)
  })

  it('Shift+R: -15; Alt+R / Alt+Shift+R: +1 / -1; wraps in [0, 360)', () => {
    const s = setup()
    s.spawn('q', 'yamaha-ql1')
    s.select('q')
    s.edits.rotate(-1, false)
    expect(s.pose('q')!.yawDeg).toBe(345)
    s.edits.rotate(1, false)
    expect(s.pose('q')!.yawDeg).toBe(0)
    s.edits.rotate(1, true)
    expect(s.pose('q')!.yawDeg).toBe(1)
    s.edits.rotate(-1, true)
    s.edits.rotate(-1, true)
    expect(s.pose('q')!.yawDeg).toBe(359)
  })

  it('each press is its own undo entry', () => {
    const s = setup()
    s.spawn('q', 'yamaha-ql1')
    s.select('q')
    const base = s.history.sizes.undo
    s.edits.rotate(1, false)
    s.edits.rotate(1, false)
    s.edits.rotate(1, false)
    expect(s.history.sizes.undo).toBe(base + 3)
    s.history.undo()
    expect(s.pose('q')!.yawDeg).toBe(30)
  })

  it('announces the new yaw and the undo key', () => {
    const s = setup()
    s.spawn('q', 'yamaha-ql1')
    s.select('q')
    s.edits.rotate(1, false)
    expect(s.announce).toHaveBeenLastCalledWith('Pivoté : yamaha-ql1, 15°. Ctrl+Z pour annuler.')
  })

  it('nothing selected: nothing recorded, said, not an edit', () => {
    const s = setup()
    s.spawn('q', 'yamaha-ql1')
    const base = s.history.sizes.undo
    expect(s.edits.rotate(1, false)).toBe(false)
    expect(s.history.sizes.undo).toBe(base)
    expect(s.announce).toHaveBeenLastCalledWith('Aucun appareil sélectionné')
  })

  it('a selection that is not in the rig (stale id) changes nothing', () => {
    const s = setup()
    s.spawn('q', 'yamaha-ql1')
    s.select('ghost')
    const base = s.history.sizes.undo
    expect(s.edits.rotate(1, false)).toBe(false)
    expect(s.history.sizes.undo).toBe(base)
  })
})

describe('duplicate', () => {
  const wire = (s: ReturnType<typeof setup>) => {
    s.spawn('m', 'shure-sm58', { position: [1, 0, 2] })
    s.history.do({ type: 'CONNECT', a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'x', port: 'in-mic-1' } })
  }

  it('Ctrl+D: a new id, the same device and controls, +0.5 m on x, same yaw / tilt / mount, ONE undo entry, the copy is selected', () => {
    const s = setup()
    s.spawn('x', 'axia-iq', { position: [3, 1, -2], rotationY: 40, tiltDeg: -5, mount: 'stand' })
    s.history.do({ type: 'SET_CONTROL', instance: 'x', control: 'monitor-mute', value: true })
    s.select('x')
    const base = s.history.sizes.undo
    expect(s.edits.duplicate()).toBe(true)
    const d = s.store.design()
    expect(d.rig.instances).toHaveLength(2)
    const copy = d.rig.instances.find((i) => i.instanceId !== 'x')!
    expect(copy.deviceId).toBe('axia-iq')
    expect(copy.instanceId).not.toBe('x')
    expect(d.rig.controls[copy.instanceId]).toEqual(d.rig.controls.x)
    expect(d.rig.controls[copy.instanceId]['monitor-mute']).toBe(true)
    expect(s.pose(copy.instanceId)).toEqual({ instanceId: copy.instanceId, deviceId: 'axia-iq', position_m: [3.5, 1, -2], yawDeg: 40, tiltDeg: -5, mount: 'stand' })
    expect(s.history.sizes.undo).toBe(base + 1)
    expect(s.history.undoLabel).toBe('Dupliquer axia-iq')
    expect(s.onDuplicated).toHaveBeenCalledWith(copy.instanceId)
    expect(s.selected()).toBe(copy.instanceId)
    // the original did not move
    expect(s.pose('x')!.position_m).toEqual([3, 1, -2])
    // one Ctrl+Z takes the copy away, only
    s.history.undo()
    expect(s.store.design().rig.instances.map((i) => i.instanceId)).toEqual(['x'])
  })

  it('the cables stay with the original', () => {
    const s = setup()
    s.spawn('x', 'axia-iq')
    wire(s)
    s.select('x')
    s.edits.duplicate()
    expect(s.store.design().rig.connections).toHaveLength(1)
  })

  it('a second Ctrl+D copies the copy (new ids each time)', () => {
    const s = setup()
    s.spawn('x', 'axia-iq')
    s.select('x')
    s.edits.duplicate()
    s.edits.duplicate()
    const ids = s.store.design().rig.instances.map((i) => i.instanceId)
    expect(new Set(ids).size).toBe(3)
  })

  it('past the far wall the copy goes the other way', () => {
    const s = setup({ bounds: true })
    s.spawn('x', 'axia-iq', { position: [5, 0, 0] })
    s.select('x')
    s.edits.duplicate()
    const copy = s.store.design().placements.find((p) => p.instanceId !== 'x')!
    expect(copy.position_m).toEqual([4.5, 0, 0])
  })

  it('nothing selected: nothing recorded', () => {
    const s = setup()
    s.spawn('x', 'axia-iq')
    const base = s.history.sizes.undo
    expect(s.edits.duplicate()).toBe(false)
    expect(s.history.sizes.undo).toBe(base)
    expect(s.store.design().rig.instances).toHaveLength(1)
  })
})

describe('delete', () => {
  it('Suppr removes the device AND its cables as ONE entry; Ctrl+Z brings back the device and its cables, Ctrl+Y removes again', () => {
    const s = setup()
    s.spawn('m', 'shure-sm58', { position: [1, 0, 2] })
    s.spawn('x', 'axia-iq', { position: [3, 1, -2], rotationY: 40, tiltDeg: -5, mount: 'stand' })
    s.history.do({ type: 'SET_CONTROL', instance: 'x', control: 'monitor-mute', value: true })
    s.history.do({ type: 'CONNECT', a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'x', port: 'in-mic-1' } })
    const before = s.store.design()
    s.select('x')
    const base = s.history.sizes.undo
    expect(s.edits.remove()).toBe(true)
    expect(s.store.design().rig.instances.map((i) => i.instanceId)).toEqual(['m'])
    expect(s.store.design().rig.connections).toHaveLength(0)
    expect(s.history.sizes.undo).toBe(base + 1)
    expect(s.history.undoLabel).toBe('Supprimer axia-iq')
    expect(s.announce).toHaveBeenLastCalledWith('Supprimé : axia-iq, avec ses câbles. Ctrl+Z pour annuler.')

    expect(s.history.undo()).toBe(true)
    const after = s.store.design()
    expect(after.rig.instances.map((i) => i.instanceId).sort()).toEqual(['m', 'x'])
    expect(after.rig.connections).toEqual(before.rig.connections)
    expect(after.rig.controls.x).toEqual(before.rig.controls.x)
    expect(after.placements.find((p) => p.instanceId === 'x')).toEqual(before.placements.find((p) => p.instanceId === 'x'))

    expect(s.history.redo()).toBe(true)
    expect(s.store.design().rig.instances.map((i) => i.instanceId)).toEqual(['m'])
    expect(s.store.design().rig.connections).toHaveLength(0)
  })

  it('nothing selected: nothing recorded', () => {
    const s = setup()
    s.spawn('x', 'axia-iq')
    const base = s.history.sizes.undo
    expect(s.edits.remove()).toBe(false)
    expect(s.history.sizes.undo).toBe(base)
  })
})

describe('blocked (a drag is open): every edit is ignored', () => {
  it('rotate, duplicate and delete do nothing and record nothing', () => {
    let blocked = true
    const s = setup({ blocked: () => blocked })
    s.spawn('x', 'axia-iq')
    s.select('x')
    const base = s.history.sizes.undo
    const before = s.store.design()
    expect(s.edits.rotate(1, false)).toBe(false)
    expect(s.edits.duplicate()).toBe(false)
    expect(s.edits.remove()).toBe(false)
    expect(s.history.sizes.undo).toBe(base)
    expect(s.store.design()).toEqual(before)
    expect(s.announce).not.toHaveBeenCalled()
    blocked = false
    expect(s.edits.rotate(1, false)).toBe(true)
  })
})

describe('devices with no stored position', () => {
  it('rotate and duplicate say so instead of inventing a position', () => {
    const s = setup()
    s.spawn('x', 'axia-iq')
    s.history.do({ type: 'CLEAR_POSE', instanceId: 'x' })
    s.select('x')
    const base = s.history.sizes.undo
    expect(s.edits.rotate(1, false)).toBe(false)
    expect(s.edits.duplicate()).toBe(false)
    expect(s.history.sizes.undo).toBe(base)
    expect(s.announce).toHaveBeenLastCalledWith('axia-iq n’a pas de position : impossible de le pivoter ou de le dupliquer.')
  })
})

describe('delete with several cables (connection ids are not stable across undo)', () => {
  // ConnectionGraph issues ids as c1, c2, ... and the snapshot drops them: an undone REMOVE re-plugs the device's cables
  // under NEW ids, after every cable that stayed. The cable SET is what undo guarantees, not the list order.
  const pairs = (s: ReturnType<typeof setup>): string[] =>
    s.store
      .design()
      .rig.connections.map((c) => [c.a, c.b].map((r) => `${r.instance}.${r.port}`).sort().join(' | '))
      .sort()

  it('a device wired on both sides plus an unrelated cable wired after: undo restores exactly its cables, redo removes exactly them', () => {
    const s = setup()
    s.spawn('m1', 'shure-sm58', { position: [1, 0, 2] })
    s.spawn('q', 'yamaha-ql1', { position: [2, 0, 3] })
    s.spawn('k', 'qsc-k12-2', { position: [4, 0, 3] })
    s.spawn('m2', 'shure-sm58', { position: [1, 0, 5] })
    s.spawn('x', 'axia-iq', { position: [5, 0, 5] })
    s.history.do({ type: 'CONNECT', a: { instance: 'm1', port: 'out-xlr' }, b: { instance: 'q', port: 'in-mic-1' } }) // into q
    s.history.do({ type: 'CONNECT', a: { instance: 'q', port: 'out-main-l' }, b: { instance: 'k', port: 'in-line-a' } }) // out of q
    s.history.do({ type: 'CONNECT', a: { instance: 'm2', port: 'out-xlr' }, b: { instance: 'x', port: 'in-mic-1' } }) // unrelated, wired last
    const all = pairs(s)
    expect(all).toHaveLength(3)
    const fp = designFingerprint(s.store.design())
    const kept = all.filter((p) => !p.includes('q.'))
    expect(kept).toHaveLength(1)

    s.select('q')
    const base = s.history.sizes.undo
    expect(s.edits.remove()).toBe(true)
    expect(pairs(s)).toEqual(kept)
    expect(s.history.sizes.undo).toBe(base + 1)

    expect(s.history.undo()).toBe(true)
    expect(pairs(s)).toEqual(all) // the same set of port pairs ...
    // ... and nothing that tells "saved" from "edited" sees the new ids or the new order (the fingerprint is order-free)
    expect(designFingerprint(s.store.design())).toBe(fp)
    expect(isDirty(s.store.design(), fp)).toBe(false)

    expect(s.history.redo()).toBe(true)
    expect(pairs(s)).toEqual(kept)
    expect(s.history.undo()).toBe(true)
    expect(pairs(s)).toEqual(all)
  })
})
