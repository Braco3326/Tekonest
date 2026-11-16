/**
 * Hand-drawn cables, the controller (mission 3 B stage 2, spec docs/superpowers/specs/2026-11-15-hand-drawn-cables-design.md §1, §2). Only with the `cableTrace` switch
 * (boot.ts builds it then, on a mounted creation shell). It owns the view state of a cable route and sends every change through `history.do` (C6):
 *
 * - SELECTION: a click on a cable (the hover's own screen-space hit test; wider for a finger) or its row in « Câbles » selects it; it keeps the hover's Papier stroke
 *   (SceneHost.setSelectedCable) and Propriétés shows its panel (shell/cablePanel.ts) instead of the device panel. A device selected, a click on the empty floor or
 *   Échap (not tracing) deselects. View state only: never in the store, never undoable.
 * - TRACING: « Tracer le câble » or a double-click on the cable. The drawing bar shows under the menu bar; the floor shows the grid, the dots, the dashed preview
 *   (cableTracer.ts, a lazy chunk). A plain click (or a tap) places a point on the nearest crossing (a drag still orbits the camera); a double-click on the last point,
 *   « Terminer » or Maj+Entrée finishes: the whole tracing is ONE SET_ROUTE (one undo step); « Annuler » or Échap cancels (nothing dispatched). Keyboard, in the
 *   capture phase ahead of the shell's key map and Babylon's arrow orbit, only while tracing: arrows (as seen from the camera; Maj = four steps), Entrée, Maj+Entrée,
 *   Retour arrière, Échap (input/traceKeys.ts). Ctrl+Z while tracing removes the last point (boot.ts), never something under the tracing.
 * - EDITING: a selected routed cable shows its points as handles: drag one to another crossing, click the selected cable to add a point on the nearest segment,
 *   « Supprimer le point » / Suppr; « Points du tracé » in the panel does the same by keyboard. Every completed change is ONE SET_ROUTE; a change that changes
 *   nothing sends nothing (cableTraceModel.ts returns null).
 * - The live length is the length the cable WILL have drawn (SceneHost.previewCableLengthM: the renderer's own gravity path), so the bar, the panel and the hover
 *   agree once it is committed; the plan length (cableTraceModel.liveLengthM) stands in only before a scene is up.
 * Event-driven only: no per-frame work; the marks are redrawn on a pointer move, a key, a store change or a camera change.
 */
import type { ArcRotateCamera, Scene } from '@babylonjs/core'
import type { Registry } from '../engine/CatalogLoader'
import type { PortRef } from '../engine/types'
import type { DesignState } from '../trials/trial'
import type { DispatchResult } from './store'
import type { Intent } from '../ui/intents'
import type { DisposableBag } from '../util/disposable'
import type { XZ } from '../scene/cableGravity'
import { DEFAULT_SNAP_M, MAX_ROUTE_POINTS, snapToGrid, toXZ, type FloorBounds, type SnapStepM } from '../scene/cableRoute'
import { isTextTarget } from '../scene/cameraTween'
import { COPY } from './copy'
import { fillUndo } from './undoWording'
import { CABLE_HIT_PX, type Pt } from './cablePick'
import {
  candidateOf,
  canFinish,
  deletePoint,
  finishTrace,
  insertOnSegment,
  liveLengthM,
  movePoint,
  nearestSegment,
  placePoint,
  pointerAt,
  removeLastPoint,
  setRightAngles,
  setStep,
  startTrace,
  stepCursor,
  stepPoint,
  type TraceState,
} from './cableTraceModel'
import { arrowToGrid, traceKeyOf, type Arrow } from './input/traceKeys'
import { isClick } from './selection'
import { cablePanelView, formatMetres, mountCablePanel, mountDrawingBar, STEP_LABEL, type CablePanel, type DrawingBar } from './shell/cablePanel'
import type { CableTracer } from './cableTracer'

type P3 = { x: number; y: number; z: number }

/** What the controller needs of the SceneHost (structural: SceneHost satisfies it). */
export interface RouteHost {
  readonly canvasElement: HTMLCanvasElement
  readonly scene: Scene | null
  readonly camera: ArcRotateCamera | null
  readonly walking: boolean
  cableAtPoint(x: number, y: number, tolPx?: number): string | null
  portAtPoint(x: number, y: number, inHand?: boolean): PortRef | null
  projectToCanvas(p: P3): Pt | null
  cableEnds(key: string): { a: P3; b: P3 } | null
  previewCableLengthM(key: string, route: readonly XZ[]): number | null
  cableLengthM(key: string): number | null
  setSelectedCable(key: string | null): void
  roomBounds(): FloorBounds
  floorHeight(x: number, z: number, fallback: number): number
  listenView(fn: () => void): () => void
}

export interface CableRouteDeps {
  host: RouteHost
  bag: DisposableBag
  doc: Document
  registry: Registry
  store: { design(): DesignState; subscribe(fn: () => void): () => void }
  history: { do(intent: Intent, label?: string): DispatchResult }
  /** Propriétés' body (the cable panel is added to it) and the device panel's own element (hidden while a cable is selected). */
  propsBody: HTMLElement
  propsContent: HTMLElement
  /** The shell root and its menu bar (the drawing bar goes right after it). */
  shellRoot: HTMLElement
  menubar: HTMLElement
  announce(message: string): void
  undoLabel(): string
  /** « Yamaha QL1 (ql1) » (with « non vérifié » for a Bêta device). */
  deviceName(instanceId: string): string
  /** The cable as the hover says it; null when it is not in the design. */
  describe(key: string): string | null
  /** « Câble ql1 out-main-l → k12-g in-line-a »: the drawing bar's title (no length: the bar shows the live one). */
  cableName(key: string): string
  /** The 3D view is locked (no place, the place picker, no camera) or walked: nothing of this feature acts. */
  locked(): boolean
  /** A placement, a drag or a dialog owns the pointer. */
  busy(): boolean
  /** Clear the device selection without a word (selecting a cable is the new selection). */
  clearDeviceSelection(): void
  /** The cable selection changed (the tree marks its row). */
  onSelectionChange(): void
  /** The floor point under a canvas point (world m), or null. */
  floorPoint(x: number, y: number): [number, number, number] | null
  /** A coarse pointer (touch): wider hit tests, 44 px targets. */
  coarse(): boolean
  invalidate(): void
  /** Before a dispatch (a stepper burst of Propriétés closes first). */
  beforeDispatch?(): void
  /** A tracing starts (true) or ends (false): the page may make room for the 3D view (boot.ts folds a side panel on a narrow screen, then gives it back). */
  onTracing?(on: boolean): void
  /** Tests: the scene chunk. */
  loadTracer?(): Promise<typeof import('./cableTracer')>
}

export interface CableRouteDebug {
  selected: string | null
  selectedPoint: number | null
  step: SnapStepM
  rightAngles: boolean
  tracing: { key: string; points: [number, number][]; cursor: [number, number]; candidate: [number, number]; lengthM: number } | null
  /** Page px of the handles (a routed selected cable, not tracing). */
  handles: { x: number; y: number }[]
  tracerLoaded: boolean
  tracerMeshes: number
}

const C = (): Readonly<Record<string, string>> => COPY.cableRoute!
const fill = (s: string, vars: Record<string, string>): string => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k]! : m))
const xz = (p: XZ): [number, number] => [p.x, p.z]
/** A second click this close in time and space is the second of a double-click (as selection.ts). */
const DOUBLE_CLICK_MS = 500
const DOUBLE_CLICK_PX = 5
/** A click on the selected routed cable adds its point after this delay, so the two clicks of a double-click (which starts a tracing) add nothing. */
export const ADD_DELAY_MS = 300
/** Handle hit radius (CSS px): mouse, finger (a 44 px target). */
const HANDLE_HIT_PX = 12
const HANDLE_HIT_TOUCH_PX = 22
/** A finger hits a cable within this many px (the mouse: CABLE_HIT_PX). */
const CABLE_HIT_TOUCH_PX = 16

type Press = { x: number; y: number; t: number }

export class CableRouteController {
  private selectedKey: string | null = null
  private selectedPoint: number | null = null
  private trace: TraceState | null = null
  private traceKey: string | null = null
  private step: SnapStepM = DEFAULT_SNAP_M
  private rightAngles = false
  private press: Press | null = null
  private lastClick: Press | null = null
  private lastPointerType = 'mouse'
  private drag: { index: number; pointerId: number; at: XZ; release: () => void } | null = null
  private pendingAdd: { timer: number; run: () => void } | null = null
  private tracer: CableTracer | null = null
  private tracerScene: Scene | null = null
  private tracerLoad: Promise<typeof import('./cableTracer')> | null = null
  private canvasLabel: string | null = null
  private readonly panel: CablePanel
  private readonly panelBox: HTMLElement
  private readonly bar: DrawingBar
  private lengthCache: { sig: string; m: number | null } | null = null

  constructor(private readonly d: CableRouteDeps) {
    const doc = d.doc
    this.panelBox = doc.createElement('div')
    this.panelBox.className = 'cr-cable-box'
    this.panelBox.hidden = true
    d.propsBody.appendChild(this.panelBox)
    this.panel = mountCablePanel({
      doc,
      container: this.panelBox,
      onTrace: () => this.startTracing(),
      onReset: () => this.resetRoute(),
      onSelectPoint: (dir) => this.choosePoint(dir),
      onArrow: (key, big) => this.arrowPoint(key, big),
      onDeletePoint: () => this.deleteChosen(),
      onStep: (s) => this.setEditStep(s),
    })
    this.bar = mountDrawingBar({
      doc,
      root: d.shellRoot,
      after: d.menubar,
      onStep: (s) => this.chooseStep(s),
      onRightAngles: (on) => this.chooseRightAngles(on),
      onPlace: () => this.placeAtCursor(),
      onRemoveLast: () => this.removeLast(),
      onFinish: () => this.finish(),
      onCancel: () => this.cancel(),
    })
    const canvas = d.host.canvasElement
    d.bag.listen(canvas, 'pointerdown', (e: PointerEvent) => this.onDown(e), { capture: true })
    d.bag.listen(canvas, 'pointermove', (e: PointerEvent) => this.onMove(e))
    d.bag.listen(canvas, 'pointerup', (e: PointerEvent) => this.onUp(e))
    d.bag.listen(canvas, 'pointercancel', (e: PointerEvent) => this.onPointerCancel(e))
    d.bag.listen(canvas, 'lostpointercapture', (e: PointerEvent) => this.onPointerCancel(e))
    d.bag.listen(doc.defaultView ?? window, 'keydown', (e: KeyboardEvent) => this.onKey(e), { capture: true })
    d.bag.add(d.host.listenView(() => this.redraw()))
    d.bag.add(d.store.subscribe(() => this.onStore()))
    d.bag.add(() => {
      this.clearPendingAdd()
      this.endTrace()
      this.tracer?.dispose()
      this.tracer = null
      this.bar.hide()
      this.panelBox.remove()
    })
  }

  // ── reading ────────────────────────────────────────────────────────────────

  get selected(): string | null {
    return this.selectedKey
  }
  get tracing(): boolean {
    return this.trace !== null
  }
  /** A drag of a handle is open (its release is ours). */
  get dragging(): boolean {
    return this.drag !== null
  }

  private routeOf(key: string | null): XZ[] {
    const r = key ? this.d.store.design().routes?.[key] : undefined
    return r?.length ? toXZ(r) : []
  }

  private exists(key: string): boolean {
    return this.d.describe(key) !== null
  }

  private bounds(): FloorBounds | null {
    return this.d.host.scene ? this.d.host.roomBounds() : null
  }

  private plan(p: P3): XZ {
    return { x: p.x, z: p.z }
  }

  /** The tracing's length as it will be drawn (memoised per route: a cursor move does not re-lay the cable). */
  private liveLength(): number {
    const t = this.trace
    if (!t || !this.traceKey) return 0
    const sig = `${this.traceKey}|${t.points.map((p) => `${p.x},${p.z}`).join(';')}`
    if (this.lengthCache?.sig !== sig) this.lengthCache = { sig, m: this.d.host.previewCableLengthM(this.traceKey, t.points) }
    return this.lengthCache.m ?? liveLengthM(t)
  }

  debug(): CableRouteDebug {
    const t = this.trace
    return {
      selected: this.selectedKey,
      selectedPoint: this.selectedPoint,
      step: this.step,
      rightAngles: this.rightAngles,
      tracing:
        t && this.traceKey
          ? { key: this.traceKey, points: t.points.map(xz), cursor: xz(t.cursor), candidate: xz(candidateOf(t)), lengthM: this.liveLength() }
          : null,
      handles: this.handleScreens().map((p) => {
        const r = this.d.host.canvasElement.getBoundingClientRect()
        return p ? { x: r.left + p.x, y: r.top + p.y } : { x: NaN, y: NaN }
      }),
      tracerLoaded: this.tracer !== null,
      tracerMeshes: this.tracer?.meshCount ?? 0,
    }
  }

  // ── selection ──────────────────────────────────────────────────────────────

  /** Select a cable (null deselects). `silent`: no announcement (another selection took its place). False for an unknown cable or a locked view. */
  select(key: string | null, opts: { silent?: boolean } = {}): boolean {
    if (key !== null && (this.d.locked() || !this.exists(key))) return false
    if (key === this.selectedKey) return true
    if (this.trace) this.cancel({ silent: true })
    this.clearPendingAdd()
    const had = this.selectedKey !== null
    this.selectedKey = key
    this.selectedPoint = null
    this.d.host.setSelectedCable(key)
    if (key !== null) this.d.clearDeviceSelection()
    this.render()
    this.d.onSelectionChange()
    if (!opts.silent) {
      if (key !== null) this.d.announce(fill(C().statusSelected!, { cable: this.d.describe(key) ?? key }))
      else if (had) this.d.announce(C().statusDeselected!)
    }
    if (key !== null && this.routeOf(key).length) this.ensureTracer()
    return true
  }

  /** A place change: nothing of the old scene survives. */
  reset(): void {
    this.clearPendingAdd()
    this.endTrace()
    this.drag?.release()
    this.drag = null
    this.tracer = null // its meshes and materials went with the old scene
    this.tracerScene = null
    this.select(null, { silent: true })
    this.render()
  }

  /**
   * A click on the canvas that nobody else took (boot.ts's miss path: no device, no port). A cable under it is selected; a click on the cable already selected adds
   * a point on its nearest segment (a routed cable only, after ADD_DELAY_MS). True when the click was the cable's.
   */
  clickAt(x: number, y: number): boolean {
    if (this.trace || this.d.locked() || this.d.busy()) return false
    const key = this.d.host.cableAtPoint(x, y, this.touchy() ? CABLE_HIT_TOUCH_PX : CABLE_HIT_PX)
    if (!key) return false
    if (key !== this.selectedKey) return this.select(key)
    const route = this.routeOf(key)
    if (!route.length) return true
    const p = this.d.floorPoint(x, y)
    if (!p) return true
    const now = performance.now()
    const second = this.lastClick && now - this.lastClick.t <= DOUBLE_CLICK_MS && Math.hypot(x - this.lastClick.x, y - this.lastClick.y) <= DOUBLE_CLICK_PX
    this.lastClick = second ? null : { x, y, t: now }
    this.clearPendingAdd()
    if (second) return true // the second click of a double-click: the tracing starts (dblClickAt), nothing is added
    const run = (): void => {
      this.pendingAdd = null
      if (this.selectedKey !== key || this.trace) return
      const ends = this.d.host.cableEnds(key)
      const r = this.routeOf(key)
      if (!ends || !r.length) return
      const at = { x: p[0], z: p[2] }
      const seg = nearestSegment(this.plan(ends.a), r, this.plan(ends.b), at)
      const next = insertOnSegment(r, seg, at, this.step, this.bounds())
      if (!next) return
      if (this.commit(key, next, C().entryEdit!)) {
        this.selectedPoint = seg
        this.d.announce(fill(C().sayAdded!, { n: String(next.length) }))
        this.render()
      }
    }
    const win = this.d.doc.defaultView ?? window
    this.pendingAdd = { timer: win.setTimeout(run, ADD_DELAY_MS), run }
    return true
  }

  /**
   * The native `dblclick` belongs to the tracing: during one, and right after a double-click that finished one (the event comes after the second release,
   * once the tracing has ended). Never a re-pivot then. `t` = the event's timeStamp.
   */
  ownsDblClick(t: number): boolean {
    return this.trace !== null || t <= this.finishedByDblClickUntil
  }
  private finishedByDblClickUntil = -Infinity

  /** A double-click on a cable starts its tracing (and during a tracing it is the tracing's own: never a re-pivot). True when taken. */
  dblClickAt(x: number, y: number): boolean {
    if (this.trace) return true
    if (this.d.locked() || this.d.busy()) return false
    const key = this.d.host.cableAtPoint(x, y, this.touchy() ? CABLE_HIT_TOUCH_PX : CABLE_HIT_PX)
    if (!key) return false
    this.clearPendingAdd()
    if (!this.select(key)) return false
    this.startTracing()
    return true
  }

  private clearPendingAdd(): void {
    if (!this.pendingAdd) return
    ;(this.d.doc.defaultView ?? window).clearTimeout(this.pendingAdd.timer)
    this.pendingAdd = null
  }

  /** Tests: run a pending « add a point » now. */
  flushPendingAdd(): void {
    const p = this.pendingAdd
    if (!p) return
    ;(this.d.doc.defaultView ?? window).clearTimeout(p.timer)
    p.run()
  }

  private touchy(): boolean {
    return this.lastPointerType === 'touch' || this.d.coarse()
  }

  // ── tracing ────────────────────────────────────────────────────────────────

  startTracing(): boolean {
    const key = this.selectedKey
    if (!key || this.trace || this.d.locked() || this.d.busy()) return false
    const ends = this.d.host.cableEnds(key)
    if (!ends) return false
    this.clearPendingAdd()
    const previous = this.routeOf(key)
    this.trace = startTrace({
      from: this.plan(ends.a),
      to: this.plan(ends.b),
      bounds: this.bounds(),
      previous: previous.length ? previous : null,
      step: this.step,
      rightAngles: this.rightAngles,
    })
    this.traceKey = key
    this.lastClick = null
    const canvas = this.d.host.canvasElement
    this.canvasLabel = canvas.getAttribute('aria-label')
    canvas.setAttribute('aria-label', C().canvasTracing!)
    this.bar.show(this.barView())
    this.d.onTracing?.(true) // before the focus moves: a folded panel takes the « Tracer le câble » button away
    this.ensureTracer()
    this.render()
    canvas.focus() // the keys of a tracing act on the 3D view
    this.d.announce(fill(C().sayStart!, { step: STEP_LABEL(this.step) }))
    return true
  }

  private barView() {
    const t = this.trace!
    return {
      cable: this.d.cableName(this.traceKey!),
      step: t.step,
      rightAngles: t.rightAngles,
      lengthM: this.liveLength(),
      canFinish: canFinish(t),
      canRemove: t.points.length > 0,
    }
  }

  /** Close the tracing UI (no dispatch). */
  private endTrace(): void {
    if (!this.trace) return
    const hadFocus = this.bar.element.contains(this.d.doc.activeElement)
    this.trace = null
    this.traceKey = null
    this.press = null
    this.lengthCache = null
    this.bar.hide()
    this.d.onTracing?.(false)
    const canvas = this.d.host.canvasElement
    if (this.canvasLabel !== null) canvas.setAttribute('aria-label', this.canvasLabel)
    this.canvasLabel = null
    if (hadFocus) canvas.focus() // the bar went away under the focus: back to the 3D view
    this.render()
  }

  private afterTraceChange(): void {
    if (!this.trace) return
    this.bar.update(this.barView())
    this.redraw()
  }

  private placeAtCursor(): void {
    const t = this.trace
    if (!t) return
    if (t.points.length >= MAX_ROUTE_POINTS) return this.d.announce(C().sayFull!)
    const r = placePoint(t)
    if (!r.placed) return
    this.trace = r.state
    this.afterTraceChange()
    this.d.announce(fill(C().sayPlaced!, { n: String(r.state.points.length), m: formatMetres(this.liveLength()) }))
  }

  removeLast(): void {
    const t = this.trace
    if (!t) return
    const r = removeLastPoint(t)
    if (!r.removed) return this.d.announce(C().sayNothingToRemove!)
    this.trace = r.state
    this.afterTraceChange()
    this.d.announce(fill(C().sayRemoved!, { m: formatMetres(this.liveLength()) }))
  }

  finish(): void {
    const t = this.trace
    const key = this.traceKey
    if (!t || !key) return
    const out = finishTrace(t)
    if (out.kind === 'empty') return this.d.announce(C().sayEmpty!)
    if (out.kind === 'unchanged') {
      this.endTrace()
      return this.d.announce(C().sayUnchanged!)
    }
    const length = this.liveLength()
    this.d.beforeDispatch?.()
    const r = this.d.history.do({ type: 'SET_ROUTE', key, points: out.points }, C().entryTrace!)
    if (!r.ok) return this.d.announce(r.error.code === 'ROUTE_TOO_LONG' ? C().sayRefused! : C().sayRefusedOther!)
    this.endTrace()
    this.d.announce(fill(fillUndo(C().sayFinished!, this.d.undoLabel()), { m: formatMetres(length) }))
  }

  cancel(opts: { silent?: boolean } = {}): void {
    if (!this.trace) return
    this.endTrace() // nothing was dispatched: the cable keeps its shape
    if (!opts.silent) this.d.announce(C().sayCancelled!)
  }

  private chooseStep(s: SnapStepM): void {
    this.step = s
    if (this.trace) {
      this.trace = setStep(this.trace, s)
      this.afterTraceChange()
    }
    this.render()
    this.d.announce(fill(C().sayStep!, { step: STEP_LABEL(s) }))
  }

  private setEditStep(s: SnapStepM): void {
    this.step = s
    this.render()
    this.d.announce(fill(C().sayStep!, { step: STEP_LABEL(s) }))
  }

  private chooseRightAngles(on: boolean): void {
    this.rightAngles = on
    if (this.trace) {
      this.trace = setRightAngles(this.trace, on)
      this.afterTraceChange()
    }
    this.d.announce(on ? C().sayRightOn! : C().sayRightOff!)
  }

  // ── editing ────────────────────────────────────────────────────────────────

  /** One SET_ROUTE (one undo step); [] = the automatic shape. False when refused (said). */
  private commit(key: string, route: XZ[], label: string): boolean {
    this.d.beforeDispatch?.()
    const r = this.d.history.do({ type: 'SET_ROUTE', key, points: route.length ? route.map(xz) : null }, label)
    if (!r.ok) this.d.announce(r.error.code === 'ROUTE_TOO_LONG' ? C().sayRefused! : C().sayRefusedOther!)
    return r.ok
  }

  private resetRoute(): void {
    const key = this.selectedKey
    if (!key || this.trace || !this.routeOf(key).length) return
    if (this.commit(key, [], C().entryReset!)) {
      this.selectedPoint = null
      this.render()
      this.d.announce(fillUndo(C().sayReset!, this.d.undoLabel()))
    }
  }

  private choosePoint(dir: 1 | -1): void {
    const n = this.routeOf(this.selectedKey).length
    if (!n || this.trace) return
    const now = this.selectedPoint
    this.selectedPoint = now === null ? (dir > 0 ? 0 : n - 1) : (now + dir + n) % n
    this.render()
    this.panel.focusPoints()
  }

  private arrowPoint(key: Arrow, big: boolean): void {
    const k = this.selectedKey
    const route = this.routeOf(k)
    if (!k || !route.length || this.trace) return
    if (this.selectedPoint === null) return this.choosePoint(1)
    const g = arrowToGrid(key, this.d.host.camera?.alpha ?? -Math.PI / 2)
    const next = stepPoint(route, this.selectedPoint, g.dx, g.dz, big, this.step, this.bounds())
    if (!next) return
    const i = this.selectedPoint
    if (this.commit(k, next, C().entryEdit!)) this.d.announce(fill(C().sayMoved!, { i: String(i + 1), x: formatMetres(next[i]!.x), z: formatMetres(next[i]!.z) }))
  }

  /** Suppr in the 3D view: deletes the chosen point of the selected cable. False (the key is not ours) when no point is chosen or a tracing runs. */
  deleteSelectedPoint(): boolean {
    if (!this.selectedKey || this.selectedPoint === null || this.trace) return false
    this.deleteChosen()
    return true
  }

  private deleteChosen(): void {
    const k = this.selectedKey
    const i = this.selectedPoint
    if (!k || i === null || this.trace) return
    const next = deletePoint(this.routeOf(k), i)
    if (!next) return
    if (!this.commit(k, next, C().entryEdit!)) return
    this.selectedPoint = next.length ? Math.min(i, next.length - 1) : null
    this.render()
    this.d.announce(next.length ? fill(C().sayDeleted!, { n: String(next.length) }) : C().sayDeletedLast!)
  }

  // ── pointer ────────────────────────────────────────────────────────────────

  private handleScreens(): (Pt | null)[] {
    if (!this.selectedKey || this.trace) return []
    return this.routeOf(this.selectedKey).map((p) => this.d.host.projectToCanvas(this.markWorld(p)))
  }

  private markWorld(p: XZ): P3 {
    return this.tracer?.markWorld(p) ?? { x: p.x, y: this.d.host.floorHeight(p.x, p.z, 0) + 0.012, z: p.z }
  }

  private handleAt(x: number, y: number): number | null {
    const tol = this.touchy() ? HANDLE_HIT_TOUCH_PX : HANDLE_HIT_PX
    let best: number | null = null
    let bestD = tol
    this.handleScreens().forEach((s, i) => {
      if (!s) return
      const dd = Math.hypot(s.x - x, s.y - y)
      if (dd <= bestD) {
        bestD = dd
        best = i
      }
    })
    return best
  }

  private onDown(e: PointerEvent): void {
    this.lastPointerType = e.pointerType || 'mouse'
    if (e.button !== 0 || !e.isPrimary || this.d.locked() || this.d.busy()) return
    if (this.trace) {
      this.press = { x: e.offsetX, y: e.offsetY, t: e.timeStamp } // a drag still orbits: only a click places
      return
    }
    if (!this.selectedKey || e.shiftKey || e.ctrlKey || e.metaKey) return
    const i = this.handleAt(e.offsetX, e.offsetY)
    if (i === null) return
    // Ours from here: not the orbit, not the click-to-select.
    e.stopImmediatePropagation()
    e.preventDefault()
    this.clearPendingAdd()
    const canvas = this.d.host.canvasElement
    try {
      canvas.setPointerCapture?.(e.pointerId)
    } catch {
      // a pointer already gone
    }
    const route = this.routeOf(this.selectedKey)
    this.drag = {
      index: i,
      pointerId: e.pointerId,
      at: route[i]!,
      release: () => {
        try {
          canvas.releasePointerCapture?.(e.pointerId)
        } catch {
          // already released
        }
      },
    }
    this.selectedPoint = i
    this.render()
  }

  private onMove(e: PointerEvent): void {
    const d = this.drag
    if (d && e.pointerId === d.pointerId) {
      const p = this.d.floorPoint(e.offsetX, e.offsetY)
      if (!p) return
      const at = snapToGrid({ x: p[0], z: p[2] }, this.step, this.bounds())
      if (at.x === d.at.x && at.z === d.at.z) return
      d.at = at
      this.redraw()
      return
    }
    if (!this.trace || e.buttons !== 0 || e.pointerType === 'touch') return
    const p = this.d.floorPoint(e.offsetX, e.offsetY)
    if (!p) return
    const next = pointerAt(this.trace, { x: p[0], z: p[2] })
    if (next === this.trace) return
    this.trace = next
    this.redraw()
  }

  private onUp(e: PointerEvent): void {
    const d = this.drag
    if (d && e.pointerId === d.pointerId) {
      this.drag = null
      d.release()
      const key = this.selectedKey
      const next = key ? movePoint(this.routeOf(key), d.index, d.at, this.step, this.bounds()) : null
      if (key && next && this.commit(key, next, C().entryEdit!))
        this.d.announce(fill(C().sayMoved!, { i: String(d.index + 1), x: formatMetres(next[d.index]!.x), z: formatMetres(next[d.index]!.z) }))
      this.render()
      return
    }
    const from = this.press
    this.press = null
    if (!this.trace || !from || e.button !== 0) return
    const up = { x: e.offsetX, y: e.offsetY, t: e.timeStamp }
    if (!isClick(from, up)) return
    const p = this.d.floorPoint(up.x, up.y)
    if (!p) return
    const prev = this.lastClick
    const second = !!prev && up.t - prev.t <= DOUBLE_CLICK_MS && Math.hypot(up.x - prev.x, up.y - prev.y) <= DOUBLE_CLICK_PX
    this.trace = pointerAt(this.trace, { x: p[0], z: p[2] })
    const before = this.trace.points.length
    this.placeAtCursor()
    const placed = this.trace !== null && this.trace.points.length > before
    if (!placed && second) {
      this.lastClick = null
      this.finishedByDblClickUntil = e.timeStamp + DOUBLE_CLICK_MS // its `dblclick` follows: still the tracing's
      return this.finish() // a double-click on the last point
    }
    this.lastClick = up
    if (!placed) this.redraw()
  }

  private onPointerCancel(e: PointerEvent): void {
    const d = this.drag
    if (d && e.pointerId === d.pointerId) {
      this.drag = null
      d.release()
      this.render() // the handle goes back: nothing was dispatched
    }
    this.press = null
  }

  // ── keyboard (capture phase, only while tracing) ─────────────────────────

  private onKey(e: KeyboardEvent): void {
    if (!this.trace || e.defaultPrevented || e.isComposing) return
    const t = e.target as Element | null
    if (t && typeof (t as Element).closest === 'function' && (t as Element).closest('[role="dialog"], [role="alertdialog"], dialog')) return
    const a = traceKeyOf(e)
    if (!a) return
    if (isTextTarget(e.target)) return
    const canvas = this.d.host.canvasElement
    const doc = this.d.doc
    const onView = e.target === canvas || e.target === doc.body || e.target === doc.documentElement || e.target === null
    const inBar = !!t && this.bar.element.contains(t as Node)
    switch (a.kind) {
      case 'arrow': {
        if (!onView) return
        const g = arrowToGrid(a.key, this.d.host.camera?.alpha ?? -Math.PI / 2)
        this.trace = stepCursor(this.trace, g.dx, g.dz, a.big)
        this.redraw()
        const c = candidateOf(this.trace)
        this.d.announce(fill(C().sayCursor!, { x: formatMetres(c.x), z: formatMetres(c.z) }))
        break
      }
      case 'place':
        if (!onView) return // a focused button keeps its own Entrée
        if (!e.repeat) this.placeAtCursor()
        break
      case 'remove':
        if (!onView && !inBar) return
        if (!e.repeat) this.removeLast()
        break
      case 'finish':
        if (!e.repeat) this.finish()
        break
      case 'cancel':
        if (!e.repeat) this.cancel()
        break
    }
    e.preventDefault()
    e.stopPropagation() // neither the shell's key map nor Babylon's arrow orbit sees it
  }

  // ── store, render, draw ───────────────────────────────────────────────────

  private onStore(): void {
    if (this.traceKey && !this.exists(this.traceKey)) this.cancel()
    if (this.selectedKey && !this.exists(this.selectedKey)) this.select(null, { silent: true })
    if (this.trace && this.traceKey) {
      // a device moved under the tracing: the ends follow (the points stay)
      const ends = this.d.host.cableEnds(this.traceKey)
      if (ends) this.trace = { ...this.trace, from: this.plan(ends.a), to: this.plan(ends.b) }
      this.lengthCache = null
      this.bar.update(this.barView())
    }
    const n = this.routeOf(this.selectedKey).length
    if (this.selectedPoint !== null && this.selectedPoint >= n) this.selectedPoint = n ? n - 1 : null
    if (n) this.ensureTracer()
    this.render()
  }

  /** The panel (and the device panel hidden behind it) and the marks. */
  render(): void {
    if (this.selectedKey && this.d.locked()) return void this.select(null, { silent: true })
    const key = this.selectedKey
    const view = key
      ? cablePanelView(this.d.store.design(), this.d.registry, key, {
          lengthM: this.d.host.cableLengthM(key),
          selectedPoint: this.selectedPoint,
          deviceName: (id) => this.d.deviceName(id),
          canTrace: !this.trace && !this.d.locked(),
          step: this.step,
        })
      : null
    this.panel.render(view)
    this.panelBox.hidden = view === null
    this.d.propsContent.hidden = view !== null
    this.redraw()
  }

  /** Make sure the scene chunk is (being) loaded for the scene on screen. */
  private ensureTracer(): void {
    const scene = this.d.host.scene
    if (!scene) return
    if (this.tracer && this.tracerScene === scene) return
    this.tracerLoad ??= (this.d.loadTracer ?? (() => import('./cableTracer')))()
    this.tracerLoad.then(
      (m) => {
        const now = this.d.host.scene
        if (!now || (this.tracer && this.tracerScene === now)) return
        this.tracer = m.createCableTracer(now, {
          metresPerPx: (at) => this.metresPerPx(at),
          floorAt: (x, z) => this.d.host.floorHeight(x, z, 0),
          bounds: () => this.bounds(),
        })
        this.tracerScene = now
        this.redraw()
      },
      (err) => {
        this.tracerLoad = null // asked again next time
        console.warn('[creation] tracé des câbles indisponible', err instanceof Error ? err.message : err)
      }
    )
  }

  private metresPerPx(at: P3): number {
    const cam = this.d.host.camera
    const h = this.d.host.canvasElement.clientHeight || 600
    if (!cam) return 0.005
    const p = cam.position
    const dist = Math.hypot(p.x - at.x, p.y - at.y, p.z - at.z)
    return (2 * dist * Math.tan((cam.fov || 0.8) / 2)) / h
  }

  /** Redraw the marks (event-driven: a move, a key, a store or camera change). */
  private redraw(): void {
    const tr = this.tracer
    if (!tr || this.tracerScene !== this.d.host.scene) return
    const key = this.traceKey ?? this.selectedKey
    const ends = key ? this.d.host.cableEnds(key) : null
    if (this.trace && ends) {
      tr.drawTrace({ step: this.trace.step, cursor: this.trace.cursor, candidate: candidateOf(this.trace), points: this.trace.points, from: ends.a, to: ends.b })
    } else if (this.selectedKey && ends && this.routeOf(this.selectedKey).length) {
      tr.drawHandles({
        route: this.routeOf(this.selectedKey),
        selected: this.selectedPoint,
        from: ends.a,
        to: ends.b,
        drag: this.drag ? { index: this.drag.index, at: this.drag.at } : null,
      })
    } else tr.clear()
    this.d.invalidate()
  }
}
