import { afterEach, describe, expect, it, vi } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { History } from '../../src/creation/history'
import { ViewState } from '../../src/creation/viewState'
import { PlacementController, type PlacementHost } from '../../src/creation/placementController'
import { EditController } from '../../src/creation/editController'
import { DisposableBag } from '../../src/util/disposable'

const registry = loadCatalog(catalogJson)

// The controller listens for the window losing focus: a stand-in window per test.
const g = globalThis as Record<string, unknown>
const realWindow = g.window
afterEach(() => {
  g.window = realWindow
})

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
  const win = new EventTarget()
  g.window = win
  const store = new CreationStore(registry, creationEvaluator(registry))
  const history = new History(store)
  const viewState = new ViewState()
  const canvas = new FakeCanvas()
  const ghost = { shown: null as null | { id: string; at: V3; yaw: number }, moves: [] as V3[], yaws: [] as number[] }
  const host: PlacementHost = {
    canvasElement: canvas as unknown as HTMLElement,
    scene: null,
    camera: { target: { x: 1, y: 0, z: 2 } },
    walking: false,
    onGhostLost: null,
    showGhost: (id, at, yaw) => {
      ghost.shown = { id, at, yaw }
      return true
    },
    moveGhost: (at, yaw) => {
      ghost.moves.push(at)
      ghost.yaws.push(yaw)
    },
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
      buttons: 1,
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
  return { win, store, history, viewState, canvas, host, ghost, ctrl, fire, leases, scheduler, announce, onSnap, onClickSelected, onPlaced, bag, spawn, under: (id: string | null) => (deviceUnder = id) }
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

  it('a place change (the host lost its ghost) ends the placement, announces it and clears the snapping text', async () => {
    const s = setup()
    s.ctrl.startPlacement('yamaha-ql1')
    s.announce.mockClear()
    s.ghost.shown = null // what SceneHost.teardown does ...
    s.host.onGhostLost?.() // ... before it calls back
    expect(s.ctrl.placing).toBe(false)
    expect(s.onSnap).toHaveBeenLastCalledWith(null)
    expect(s.announce).not.toHaveBeenCalled() // said a microtask later, after the shell's own status line of the change
    await Promise.resolve()
    expect(s.announce).toHaveBeenCalledWith('Pose annulée.')
    s.announce.mockClear()
    s.host.onGhostLost?.() // a second call (nothing placed) says nothing
    await Promise.resolve()
    expect(s.announce).not.toHaveBeenCalled()
  })

  it('reading `placing` changes nothing (a pure read)', () => {
    const s = setup()
    s.ctrl.startPlacement('yamaha-ql1')
    s.ghost.shown = null // the ghost is gone but nobody told the controller yet
    s.announce.mockClear()
    s.onSnap.mockClear()
    expect(s.ctrl.placing).toBe(true)
    expect(s.announce).not.toHaveBeenCalled()
    expect(s.onSnap).not.toHaveBeenCalled()
  })

  it('a drop 0.1 m inside a wall lands within one grid half-step of the hit (snap only, no wall margin)', () => {
    for (const [px, py, want] of [
      [490, 100, [5, 0, 1]], // x: 4.90 m, wall at 5
      [-490, 100, [-5, 0, 1]],
      [100, 390, [1, 0, 4]], // z: 3.90 m, wall at 4
      [100, -390, [1, 0, -4]],
    ] as [number, number, V3][]) {
      const s = setup()
      s.ctrl.startPlacement('yamaha-ql1')
      s.fire('pointerdown', px, py)
      s.fire('pointerup', px, py)
      const got = s.store.design().placements[0].position_m
      expect(got).toEqual(want)
      expect(Math.abs(got[0] - px / 100)).toBeLessThanOrEqual(0.125)
      expect(Math.abs(got[2] - py / 100)).toBeLessThanOrEqual(0.125)
    }
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
    expect(s.onClickSelected).toHaveBeenCalledWith('ql1', 202, 301) // the release point: a click on a port of the device is the cabling's
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

  it('a move with no button down is a release: what moved is committed, the rest of the gesture does nothing', () => {
    const s = ready()
    s.fire('pointerdown', 200, 300)
    s.fire('pointermove', 400, 300)
    s.fire('pointermove', 500, 300, { buttons: 0 }) // the pointerup never came
    expect(pose(s)).toEqual([4, 0, 3]) // not moved by the buttonless move
    expect(s.history.inTransaction).toBe(false)
    expect(s.history.sizes.undo).toBe(2)
    expect(s.leases).toEqual([])
    s.fire('pointermove', 600, 300)
    expect(pose(s)).toEqual([4, 0, 3])
  })

  it('losing the pointer capture is a release (commit), like a pointerup', () => {
    const s = ready()
    s.fire('pointerdown', 200, 300)
    s.fire('pointermove', 400, 300)
    s.fire('lostpointercapture', 400, 300)
    expect(s.history.inTransaction).toBe(false)
    expect(s.history.sizes.undo).toBe(2)
    expect(pose(s)).toEqual([4, 0, 3])
    expect(s.leases).toEqual([])
    s.fire('pointermove', 600, 300)
    expect(pose(s)).toEqual([4, 0, 3])
  })

  it('the window losing focus mid-drag ends it as a release (commit); a lost capture of another pointer is ignored', () => {
    const s = ready()
    s.fire('pointerdown', 200, 300)
    s.fire('pointermove', 400, 300)
    s.fire('lostpointercapture', 400, 300, { pointerId: 7 })
    expect(s.history.inTransaction).toBe(true)
    s.win.dispatchEvent(new Event('blur'))
    expect(s.history.inTransaction).toBe(false)
    expect(s.history.sizes.undo).toBe(2)
    expect(s.leases).toEqual([])
  })

  it('pointer moves with nothing placed or dragged do nothing (no frame asked)', () => {
    const s = ready()
    s.scheduler.invalidate.mockClear()
    s.fire('pointermove', 300, 300)
    expect(s.scheduler.invalidate).not.toHaveBeenCalled()
    expect(pose(s)).toEqual([2, 0, 3])
  })
})

describe('rotating the ghost (Task 25)', () => {
  it('R / Shift+R turn the ghost by 15 deg, Alt by 1 deg; the drop uses that yaw', () => {
    const s = setup()
    s.ctrl.startPlacement('yamaha-ql1')
    expect(s.ghost.shown?.yaw).toBe(0)
    expect(s.ctrl.rotateGhost(1, false)).toBe(true)
    expect(s.ghost.yaws.at(-1)).toBe(15)
    s.ctrl.rotateGhost(1, false)
    s.ctrl.rotateGhost(-1, false)
    s.ctrl.rotateGhost(1, true)
    expect(s.ghost.yaws.at(-1)).toBe(16)
    expect(s.announce).toHaveBeenLastCalledWith('Orientation : 16°.')
    s.fire('pointerdown', 113, 232)
    s.fire('pointerup', 113, 232)
    expect(s.store.design().placements[0].yawDeg).toBe(16)
    expect(s.history.sizes.undo).toBe(1) // the turns before the drop are not history entries
  })

  it('the ghost moves with its yaw when the pointer moves, and Entrée drops with it', () => {
    const s = setup()
    s.ctrl.startPlacement('yamaha-ql1')
    s.ctrl.rotateGhost(-1, false)
    s.fire('pointermove', 113, 232)
    expect(s.ghost.yaws.at(-1)).toBe(345)
    s.ctrl.confirm()
    expect(s.store.design().placements[0].yawDeg).toBe(345)
  })

  it('does nothing when no device follows the pointer (the edit controller turns the selected device then)', () => {
    const s = setup()
    expect(s.ctrl.rotateGhost(1, false)).toBe(false)
    expect(s.ghost.yaws).toEqual([])
  })

  it('a new placement starts at 0 again', () => {
    const s = setup()
    s.ctrl.startPlacement('yamaha-ql1')
    s.ctrl.rotateGhost(1, false)
    s.ctrl.cancel()
    s.ctrl.startPlacement('yamaha-ql1')
    expect(s.ghost.shown?.yaw).toBe(0)
  })

  it('asks for a frame (the ghost turned)', () => {
    const s = setup()
    s.ctrl.startPlacement('yamaha-ql1')
    s.scheduler.invalidate.mockClear()
    s.ctrl.rotateGhost(1, false)
    expect(s.scheduler.invalidate).toHaveBeenCalled()
  })
})

describe('edit actions while a drag is open (Task 24 deferred finding)', () => {
  it('Delete / Ctrl+D / R during a drag are ignored: the drag stays ONE « Déplacer » entry holding only SET_POSE', () => {
    const s = setup()
    s.spawn('ql1', [2, 0, 3])
    s.viewState.set({ selection: 'ql1' })
    s.under('ql1')
    const edits = new EditController({
      history: s.history,
      store: s.store,
      selection: () => s.viewState.get().selection,
      blocked: () => s.ctrl.dragging,
      deviceLabel: (id) => id,
    })
    s.fire('pointerdown', 200, 300)
    s.fire('pointermove', 400, 300)
    expect(s.ctrl.dragging).toBe(true)
    expect(edits.remove()).toBe(false)
    expect(edits.duplicate()).toBe(false)
    expect(edits.rotate(1, false)).toBe(false)
    expect(s.store.design().rig.instances).toHaveLength(1)
    s.fire('pointerup', 400, 300)
    expect(s.history.sizes.undo).toBe(2)
    expect(s.history.undoLabel).toBe('Déplacer yamaha-ql1')
    expect(s.history.peekUndo()!.forward.map((i) => i.type)).toEqual(['SET_POSE'])
    // once the drag is over, the same edits work
    expect(edits.rotate(1, false)).toBe(true)
    expect(s.history.sizes.undo).toBe(3)
  })

  it('without the guard a delete would merge into the open drag (why the guard exists)', () => {
    const s = setup()
    s.spawn('ql1', [2, 0, 3])
    s.viewState.set({ selection: 'ql1' })
    s.under('ql1')
    s.fire('pointerdown', 200, 300)
    s.fire('pointermove', 400, 300)
    s.history.do({ type: 'REMOVE', instanceId: 'ql1' }) // an unguarded delete
    s.fire('pointerup', 400, 300)
    expect(s.history.peekUndo()!.forward.map((i) => i.type)).toEqual(['SET_POSE', 'REMOVE'])
  })
})

describe('the Alt tap (final review 8): its keyup is claimed while a device is placed or dragged', () => {
  /** A keyup on the stand-in window: `defaultPrevented` tells whether the controller claimed it. */
  const keyup = (s: ReturnType<typeof setup>, key: string, code: string) => {
    const e = new Event('keyup', { cancelable: true })
    Object.defineProperty(e, 'key', { value: key })
    Object.defineProperty(e, 'code', { value: code })
    s.win.dispatchEvent(e)
    return e.defaultPrevented
  }

  it('placing: Alt (either side) is preventDefault-ed, so Firefox on Windows does not open its menu bar; any other key is not touched', () => {
    const s = setup()
    s.ctrl.startPlacement('yamaha-ql1')
    expect(keyup(s, 'Alt', 'AltLeft')).toBe(true)
    expect(keyup(s, 'Alt', 'AltRight')).toBe(true)
    expect(keyup(s, 'r', 'KeyR')).toBe(false)
    expect(keyup(s, 'Shift', 'ShiftLeft')).toBe(false)
  })

  it('dragging: claimed as well', () => {
    const s = setup()
    s.spawn('ql1', [2, 0, 3])
    s.viewState.set({ selection: 'ql1' })
    s.under('ql1')
    s.fire('pointerdown', 200, 300)
    expect(s.ctrl.dragging).toBe(true)
    expect(keyup(s, 'Alt', 'AltLeft')).toBe(true)
    s.fire('pointerup', 200, 300, { buttons: 0 })
    expect(keyup(s, 'Alt', 'AltLeft')).toBe(false)
  })

  it('neither placing nor dragging, after the placement ends, or once the bag is disposed: the browser keeps its Alt', () => {
    const s = setup()
    expect(keyup(s, 'Alt', 'AltLeft')).toBe(false)
    s.ctrl.startPlacement('yamaha-ql1')
    expect(keyup(s, 'Alt', 'AltLeft')).toBe(true)
    s.ctrl.cancel()
    expect(keyup(s, 'Alt', 'AltLeft')).toBe(false)
    s.ctrl.startPlacement('yamaha-ql1')
    s.bag.dispose()
    expect(keyup(s, 'Alt', 'AltLeft')).toBe(false)
  })
})
