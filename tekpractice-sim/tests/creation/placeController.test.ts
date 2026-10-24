import { describe, expect, it, vi } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { History } from '../../src/creation/history'
import { createPlaceController } from '../../src/creation/placeController'
import type { PlaceChoice } from '../../src/creation/shell/placeDialog'

const registry = loadCatalog(catalogJson)

function setup(choice: PlaceChoice = 'keep') {
  const store = new CreationStore(registry, creationEvaluator(registry))
  const history = new History(store)
  const applies = vi.fn()
  store.subscribe((c) => c.intents.some((i) => i.type === 'APPLY_DESIGN') && applies())
  let release: () => void = () => {}
  let gate: Promise<void> = Promise.resolve()
  const hold = () => {
    gate = new Promise<void>((r) => (release = r))
  }
  const confirm = vi.fn(async () => choice)
  const ctrl = createPlaceController({
    store,
    history,
    bounds: async () => {
      await gate
      return { width: 10, length: 8, floorAt: () => 0 }
    },
    confirm,
    label: 'Changer de lieu',
  })
  return { store, history, ctrl, applies, confirm, hold, release: () => release() }
}

describe('place controller (Task 6 review)', () => {
  it('the first place is not undoable into a "no place" state', async () => {
    const { store, history, ctrl } = setup()
    await ctrl.choosePlace('room:concert-hall-medium')
    expect(store.design().roomId).toBe('room:concert-hall-medium')
    expect(history.sizes.undo).toBe(0)
    expect(history.undo()).toBe(false)
    expect(store.design().roomId).toBe('room:concert-hall-medium')
  })
  it('a later place change is undoable back to the previous place', async () => {
    const { store, history, ctrl } = setup()
    await ctrl.choosePlace('room:concert-hall-medium')
    await ctrl.choosePlace('blank')
    expect(history.sizes.undo).toBe(1)
    expect(history.undo()).toBe(true)
    expect(store.design().roomId).toBe('room:concert-hall-medium')
  })
  it('two fast « Garder » commits during the bounds load dispatch APPLY_DESIGN once', async () => {
    const { store, history, ctrl, applies, hold, release } = setup('keep')
    await ctrl.choosePlace('room:concert-hall-medium')
    history.do({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [30, 0, 0] })
    applies.mockClear()
    hold()
    const a = ctrl.requestPlace('blank')
    const b = ctrl.requestPlace('blank')
    const c = ctrl.requestPlace('room:bar-club-stage-small')
    release()
    await Promise.all([a, b, c])
    expect(applies).toHaveBeenCalledTimes(1)
    expect(store.design().roomId).toBe('blank')
    expect(store.design().placements[0].position_m[0]).toBe(4.5) // fitted into the 10 × 8 bounds
    // and it is not stuck: the next request works
    await ctrl.requestPlace('room:bar-club-stage-small')
    expect(store.design().roomId).toBe('room:bar-club-stage-small')
  })
  it('requestPlace asks only when there is gear; cancel changes nothing', async () => {
    const { store, history, ctrl, confirm } = setup('cancel')
    await ctrl.requestPlace('room:concert-hall-medium')
    expect(confirm).not.toHaveBeenCalled()
    history.do({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 0] })
    await ctrl.requestPlace('blank')
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(store.design().roomId).toBe('room:concert-hall-medium')
    expect(store.design().rig.instances).toHaveLength(1)
  })
  it('a request made while another is in flight gets a distinct « busy » result (Task 12)', async () => {
    const { ctrl, hold, release, history } = setup('keep')
    await ctrl.choosePlace('room:concert-hall-medium')
    history.do({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 0] })
    hold()
    const a = ctrl.requestPlace('blank')
    expect(await ctrl.requestPlace('room:bar-club-stage-small')).toBe('busy')
    expect(await ctrl.choosePlace('blank')).toBe('busy')
    expect(await ctrl.loadDesign('room:bar-club-stage-small', async () => ({ roomId: 'room:bar-club-stage-small', rig: { instances: [], connections: [], controls: {} }, placements: [] }))).toBe('busy')
    release()
    expect(await a).toBe('done')
  })
  it('results: done, same, cancelled', async () => {
    const { ctrl, history } = setup('cancel')
    expect(await ctrl.requestPlace('blank')).toBe('done')
    expect(await ctrl.requestPlace('blank')).toBe('same')
    history.do({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 0] })
    expect(await ctrl.requestPlace('room:concert-hall-medium')).toBe('cancelled')
  })
  it('loadDesign applies a whole design (template / room gear): first place not undoable, later ones undoable', async () => {
    const { store, history, ctrl, confirm } = setup()
    const design = (roomId: string, n: number) => ({
      roomId,
      rig: { instances: Array.from({ length: n }, (_, i) => ({ instanceId: `q${i}`, deviceId: 'yamaha-ql1' })), connections: [], controls: {} },
      placements: Array.from({ length: n }, (_, i) => ({ instanceId: `q${i}`, deviceId: 'yamaha-ql1', position_m: [i, 0, 0] as [number, number, number], yawDeg: 0 })),
    })
    expect(await ctrl.loadDesign('room:concert-hall-medium', async () => design('room:concert-hall-medium', 2))).toBe('done')
    expect(store.design().rig.instances).toHaveLength(2)
    expect(history.sizes.undo).toBe(0)
    expect(await ctrl.loadDesign('blank', async () => design('blank', 1))).toBe('done')
    expect(confirm).not.toHaveBeenCalled() // an explicit model choice replaces the rig (undoable)
    expect(history.sizes.undo).toBe(1)
    history.undo()
    expect(store.design().rig.instances).toHaveLength(2)
  })
  it('loadDesign: a failing build changes nothing and reports « failed »', async () => {
    const { store, ctrl } = setup()
    await ctrl.choosePlace('blank')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      await ctrl.loadDesign('room:concert-hall-medium', async () => {
        throw new Error('boom')
      }),
    ).toBe('failed')
    warn.mockRestore()
    expect(store.design().roomId).toBe('blank')
    // and the guard is released
    expect(await ctrl.choosePlace('room:concert-hall-medium')).toBe('done')
  })
  it('the same place again is a no-op', async () => {
    const { history, ctrl, applies } = setup()
    await ctrl.choosePlace('blank')
    applies.mockClear()
    await ctrl.choosePlace('blank')
    await ctrl.requestPlace('blank')
    expect(applies).not.toHaveBeenCalled()
    expect(history.sizes.undo).toBe(0)
  })
})
