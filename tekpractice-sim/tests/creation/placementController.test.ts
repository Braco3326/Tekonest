import { describe, expect, it, vi } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { History } from '../../src/creation/history'
import { ViewState } from '../../src/creation/viewState'
import { PlacementController, type PlacementHost } from '../../src/creation/placementController'
import { DisposableBag } from '../../src/util/disposable'

const registry = loadCatalog(catalogJson)

type V3 = [number, number, number]

/** A canvas stand-in: an EventTarget with the few members the controller calls. */
class FakeCanvas extends EventTarget {
  clientWidth = 800
  clientHeight = 600
  focus = vi.fn()
  captured: number[] = []
  setPointerCapture = (id: number): void => void this.captured.push(id)
  releasePointerCapture = (id: number): void => void this.captured.splice(this.captured.indexOf(id), 1)
}

function setup() {
  const store = new CreationStore(registry, creationEvaluator(registry))
  const history = new History(store)
  const viewState = new ViewState()
  const canvas = new FakeCanvas()
  const ghost = { shown: null as null | { id: string; at: V3 }, moves: [] as V3[] }
  const host: PlacementHost = {
    canvasElement: canvas as unknown as HTMLElement,
    scene: null,
    camera: { target: { x: 1, y: 0, z: 2 } },
    walking: false,
    get hasGhost() {
      return ghost.shown !== null
    },
    showGhost: (id, at) => {
      ghost.shown = { id, at }
      return true
    },
    moveGhost: (at) => void ghost.moves.push(at),
    hideGhost: () => {
      ghost.shown = null
    },
    roomBounds: () => ({ minX: -5, maxX: 5, minZ: -4, maxZ: 4 }),
    floorHeight: (_x, _z, fallback) => fallback,
  }
  const leases: string[] = []
  const scheduler = {
    invalidate: vi.fn(),
    hold: (name: string) => {
      leases.push(name)
      return () => void leases.splice(leases.indexOf(name), 1)
    },
  }
  // A "world": the pointer's canvas px are metres * 100 on a flat floor; a device is under the pointer inside 30 px of it
  const floor = (x: number, y: number): V3 => [x / 100, 0, y / 100]
  const bag = new DisposableBag()
  const announce = vi.fn()
  const onSnap = vi.fn()
  const onClickSelected = vi.fn()
  const onPlaced = vi.fn()
  let deviceUnder: string | null = null
  const ctrl = new PlacementController(
    host,
    history,
    store,
    viewState,
    scheduler as never,
    bag,
    {
      deviceLabel: (id) => id,
      announce,
      onSnap,
      onClickSelected,
      onPlaced,
      floorPoint: (x, y) => floor(x, y),
      deviceAt: () => deviceUnder,
    }
  )
  let t = 1000
  const fire = (type: string, x: number, y: number, extra: Record<string, unknown> = {}) => {
    const props: Record<string, unknown> = {
      offsetX: x,
      offsetY: y,
      button: 0,
      isPrimary: true,
      pointerId: 1,
      pointerType: 'mouse',
      altKey: false,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      timeStamp: (t += 50),
      ...extra,
    }
    const e = new Event(type, { cancelable: true })
    for (const [k, v] of Object.entries(props)) Object.defineProperty(e, k, { value: v })
    canvas.dispatchEvent(e)
    return e
  }
  const spawn = (instanceId: string, position: V3) =>
    history.do({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId, position, mount: 'floor' })
  return { store, history, viewState, canvas, ghost, ctrl, fire, leases, scheduler, announce, onSnap, onClickSelected, onPlaced, bag, spawn, under: (id: string | null) => (deviceUnder = id) }
}

describe('placing', () => {
  it('startPlacement shows a ghost on the floor at the middle of the view', () => {
    const s = setup()
    s.ctrl.startPlacement('yamaha-ql1')
    expect(s.ctrl.placing).toBe(true)
    expect(s.ghost.shown?.id).toBe('yamaha-ql1')
    expect(s.ghost.shown?.at).toEqual([4, 0, 3]) // (400, 300) px, snapped
    expect(s.announce).toHaveBeenCalledTimes(1)
  })

  it('the ghost follows the pointer, snapped to 0.25 m; Alt lifts the snap', () => {
    const s = setup()
    s.ctrl.startPlacement('yamaha-ql1')
    s.fire('pointermove', 113, 232)
    expect(s.ghost.moves.at(-1)).toEqual([1.25, 0, 2.25])
    s.fire('pointermove', 113, 232, { altKey: true })
    expect(s.ghost.moves.at(-1)).toEqual([1.13, 0, 2.32])
    expect(s.onSnap).toHaveBeenLastCalledWith(true)
  })

  it('a click drops: one SPAWN, one undo entry, snapped, then no longer placing', () => {
    const s = setup()
    s.ctrl.startPlacement('yamaha-ql1')
    s.fire('pointerdown', 113, 232)
    s.fire('pointerup', 113, 232)
    const d = s.store.design()
    expect(d.rig.instances.map((i) => i.deviceId)).toEqual(['yamaha-ql1'])
    expect(d.placements[0].position_m).toEqual([1.25, 0, 2.25])
    expect(d.placements[0].mount ?? 'floor').toBe('floor') // the default mount is not stored
    expect(s.history.sizes.undo).toBe(1)
    expect(s.ctrl.placing).toBe(false)
    expect(s.ghost.shown).toBeNull()
    expect(s.onPlaced).toHaveBeenCalledWith(d.rig.instances[0].instanceId)
    expect(s.onSnap).toHaveBeenLastCalledWith(null)
  })

  it('Alt at the drop keeps the exact point', () => {
    const s = setup()
    s.ctrl.startPlacement('yamaha-ql1')
    s.fire('pointerdown', 113, 232, { altKey: true })
    s.fire('pointerup', 113, 232, { altKey: true })
    expect(s.store.design().placements[0].position_m).toEqual([1.13, 0, 2.32])
  })

  it('a press that travels is an orbit, not a drop', () => {
    const s = setup()
    s.ctrl.startPlacement('yamaha-ql1')
    s.fire('pointerdown', 100, 100)
    s.fire('pointerup', 220, 140)
    expect(s.store.design().rig.instances).toHaveLength(0)
    expect(s.ctrl.placing).toBe(true)
  })

  it('does not swallow the press: the camera and the click-to-select still see it', () => {
    const s = setup()
    s.ctrl.startPlacement('yamaha-ql1')
    const later = vi.fn()
    s.canvas.addEventListener('pointerdown', later)
    s.fire('pointerdown', 100, 100)
    expect(later).toHaveBeenCalledTimes(1)
  })

  it('Échap (cancel) ends the placement and records nothing', () => {
    const s = setup()
    s.ctrl.startPlacement('yamaha-ql1')
    expect(s.ctrl.cancel()).toBe(true)
    expect(s.ctrl.placing).toBe(false)
    expect(s.ghost.shown).toBeNull()
    expect(s.history.sizes.undo).toBe(0)
    expect(s.ctrl.cancel()).toBe(false)
  })

  it('confirm (Entrée) drops where the ghost is', () => {
    const s = setup()
    s.ctrl.startPlacement('yamaha-ql1')
    s.fire('pointermove', 113, 232)
    expect(s.ctrl.confirm()).toBe(true)
    expect(s.store.design().placements[0].position_m).toEqual([1.25, 0, 2.25])
    expect(s.ctrl.confirm()).toBe(false)
  })

  it('the drop stays inside the room', () => {
    const s = setup()
    s.ctrl.startPlacement('yamaha-ql1')
    s.fire('pointerdown', 900, 900)
    s.fire('pointerup', 900, 900)
    expect(s.store.design().placements[0].position_m).toEqual([5, 0, 4])
  })

  it('a place change that took the ghost down ends the placement', () => {
    const s = setup()
    s.ctrl.startPlacement('yamaha-ql1')
    s.ghost.shown = null
    expect(s.ctrl.placing).toBe(false)
  })
})

describe('moving the selected device', () => {
  const ready = () => {
    const s = setup()
    s.spawn('ql1', [2, 0, 3])
    s.viewState.set({ selection: 'ql1' })
    s.under('ql1')
    return s
  }
  const pose = (s: ReturnType<typeof setup>) => s.store.design().placements.find((p) => p.instanceId === 'ql1')!.position_m

  it('a drag that starts on the selected device takes the press and moves it: one undo entry', () => {
    const s = ready()
    const later = vi.fn()
    s.canvas.addEventListener('pointerdown', later)
    const down = s.fire('pointerdown', 200, 300)
    expect(later).not.toHaveBeenCalled() // the camera never saw the press
    expect(down.defaultPrevented).toBe(true)
    expect(s.leases).toEqual(['drag'])
    expect(s.history.inTransaction).toBe(true)
    s.fire('pointermove', 260, 300)
    s.fire('pointermove', 330, 300)
    s.fire('pointermove', 400, 300)
    s.fire('pointerup', 400, 300)
    expect(pose(s)).toEqual([4, 0, 3]) // 2 m further along x, the grab offset kept
    expect(s.history.sizes.undo).toBe(2) // the spawn + ONE drag
    expect(s.history.undoLabel).toBe('Déplacer yamaha-ql1')
    expect(s.leases).toEqual([])
    expect(s.history.inTransaction).toBe(false)
    s.history.undo()
    expect(pose(s)).toEqual([2, 0, 3]) // back at the start
  })

  it('the device does not jump to the cursor: the grab offset is kept', () => {
    const s = ready()
    s.fire('pointerdown', 210, 300) // grabbed 0.1 m to the side of the centre
    s.fire('pointermove', 310, 300)
    s.fire('pointerup', 310, 300)
    expect(pose(s)).toEqual([3, 0, 3])
  })

  it('snaps to 0.25 m; Alt moves freely', () => {
    const s = ready()
    s.fire('pointerdown', 200, 300)
    s.fire('pointermove', 313, 300)
    expect(pose(s)).toEqual([3.25, 0, 3])
    s.fire('pointermove', 313, 300, { altKey: true })
    expect(pose(s)).toEqual([3.13, 0, 3])
    s.fire('pointerup', 313, 300)
    expect(s.history.sizes.undo).toBe(2)
  })

  it('Échap during the drag restores the pose and records nothing', () => {
    const s = ready()
    s.fire('pointerdown', 200, 300)
    s.fire('pointermove', 400, 300)
    expect(pose(s)).toEqual([4, 0, 3])
    expect(s.ctrl.cancel()).toBe(true)
    expect(pose(s)).toEqual([2, 0, 3])
    expect(s.history.sizes.undo).toBe(1)
    expect(s.history.sizes.redo).toBe(0)
    expect(s.leases).toEqual([])
    s.fire('pointermove', 500, 300) // the rest of the gesture is ignored
    s.fire('pointerup', 500, 300)
    expect(pose(s)).toEqual([2, 0, 3])
    expect(s.history.sizes.undo).toBe(1)
  })

  it('a press that does not travel is a click: nothing moves, nothing is recorded, the shell\'s click runs', () => {
    const s = ready()
    s.fire('pointerdown', 200, 300)
    s.fire('pointermove', 202, 301)
    s.fire('pointerup', 202, 301)
    expect(pose(s)).toEqual([2, 0, 3])
    expect(s.history.sizes.undo).toBe(1)
    expect(s.onClickSelected).toHaveBeenCalledWith('ql1')
  })

  it('a press off the device, or on an unselected one, is the camera\'s', () => {
    const s = ready()
    s.under(null)
    const later = vi.fn()
    s.canvas.addEventListener('pointerdown', later)
    s.fire('pointerdown', 600, 300)
    expect(later).toHaveBeenCalledTimes(1)
    expect(s.history.inTransaction).toBe(false)
    s.under('other')
    s.fire('pointerdown', 200, 300)
    expect(later).toHaveBeenCalledTimes(2)
    expect(s.history.inTransaction).toBe(false)
  })

  it('no selection, a pan gesture, a right button or a walk view leave the press to the camera', () => {
    const s = setup()
    s.spawn('ql1', [2, 0, 3])
    s.under('ql1')
    s.fire('pointerdown', 200, 300) // nothing selected
    expect(s.history.inTransaction).toBe(false)
    s.viewState.set({ selection: 'ql1' })
    s.fire('pointerdown', 200, 300, { shiftKey: true })
    s.fire('pointerdown', 200, 300, { ctrlKey: true })
    s.fire('pointerdown', 200, 300, { button: 2 })
    s.fire('pointerdown', 200, 300, { pointerType: 'touch' })
    expect(s.history.inTransaction).toBe(false)
  })

  it('a device that is not on the floor is not dragged', () => {
    const s = setup()
    s.history.do({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [2, 1, 3], mount: 'stand' })
    s.viewState.set({ selection: 'ql1' })
    s.under('ql1')
    s.fire('pointerdown', 200, 300)
    expect(s.history.inTransaction).toBe(false)
  })

  it('a pointer cancel rolls the drag back', () => {
    const s = ready()
    s.fire('pointerdown', 200, 300)
    s.fire('pointermove', 400, 300)
    s.fire('pointercancel', 400, 300)
    expect(pose(s)).toEqual([2, 0, 3])
    expect(s.history.sizes.undo).toBe(1)
    expect(s.leases).toEqual([])
  })

  it('disposing the bag mid-drag rolls back and releases the lease and the listeners', () => {
    const s = ready()
    s.fire('pointerdown', 200, 300)
    s.fire('pointermove', 400, 300)
    s.bag.dispose()
    expect(pose(s)).toEqual([2, 0, 3])
    expect(s.leases).toEqual([])
    expect(s.history.inTransaction).toBe(false)
    s.fire('pointerdown', 200, 300)
    expect(s.history.inTransaction).toBe(false)
  })

  it('pointer moves with nothing placed or dragged do nothing (no frame asked)', () => {
    const s = ready()
    s.scheduler.invalidate.mockClear()
    s.fire('pointermove', 300, 300)
    expect(s.scheduler.invalidate).not.toHaveBeenCalled()
    expect(pose(s)).toEqual([2, 0, 3])
  })
})
