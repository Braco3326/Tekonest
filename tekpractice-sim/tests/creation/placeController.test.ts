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
