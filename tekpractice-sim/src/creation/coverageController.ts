/**
 * The coverage feature, the entry of its LAZY chunk (Task 37, C13, CA-23 / CA-24 / CA-25): Écoute › Couverture. Everything coverage-specific
 * (this file, the layer, the panel and its CSS, the client and the worker) loads on the first toggle, never with the creation start chunk.
 *
 * It recomputes ONLY when something it reads changed: a store change (a speaker moved, muted, cabled…), the ear height, the place, the pin,
 * the toggle. Requests go through the debounced `CoverageClient` (150 ms, one job for a burst, stale answers dropped), so an idle page posts no
 * job and renders no frame. No per-frame work, no timer of its own.
 *
 * What it asks the worker: the grid of the room's audience + régie zones at the ear height (coverageModel.listenerGrid, cached per place and ear
 * height), the speakers that make sound (coverageSources: fed, powered, unmuted, verified, sourced coverage), and a few probes (the named
 * listening points and the pinned dot). Nothing audible (no audience zone, or no speaker that makes sound) is NOT sent to the worker: the panel
 * says why, honestly, and no number is shown.
 *
 * Everything it puts in the scene is disposed on a place change (the layer sits in the place's bag), on toggle off and on dispose, the worker
 * included. The panel is the screen-reader equivalent of the dots; each result is announced once through the shell's status line.
 */
import type { ArcRotateCamera, Scene } from '@babylonjs/core'
import type { Registry } from '../engine/CatalogLoader'
import type { RoomLayout } from '../explore/roomLayout'
import type { PathResult } from '../flow/signalPath'
import type { DesignState } from '../trials/trial'
import { CoverageClient, type MessagePortLike } from '../acoustics/client'
import type { CoverageReply } from '../acoustics/job'
import type { AcSource } from '../acoustics/field'
import type { DisposableBag } from '../util/disposable'
import { COPY } from './copy'
import { coverageSourcesDetail, splEstimateEligible, type CoverageSourcesResult } from './coverageSources'
import {
  binCounts,
  coverageGrid,
  doneMessage,
  EMPTY_VIEW,
  legendRows,
  noSourceMessage,
  pinnedText,
  pointText,
  sourceLine,
  speakerLines,
  statRows,
  type CoverageStatus,
  type CoverageView,
  type PointRow,
} from './coverageModel'
import { CoverageLayer } from './coverageLayer'
import { mountCoveragePanel, type CoveragePanel } from './shell/coveragePanel'
import { isClick } from './selection'

/** What the controller needs of the scene layer (CoverageLayer satisfies it; a unit test fakes it). */
export type LayerPort = Pick<CoverageLayer, 'scene' | 'show' | 'clearDots' | 'setAim' | 'setPin' | 'setVisible' | 'pickDot' | 'counts' | 'aimLines' | 'drawCalls' | 'dispose' | 'enabledMeshes'>
/** What the controller needs of the panel. */
export type PanelPort = Pick<CoveragePanel, 'render'>

export interface CoverageHost {
  readonly scene: Scene | null
  readonly camera: ArcRotateCamera | null
  readonly layout: RoomLayout | null
  /** A key for the place on screen (null = none): the grid is cached by it. */
  readonly placeId: string | null
  readonly canvasElement: HTMLElement
  /** The place's bag: disposed first when the place goes (the layer and the worker go with it). */
  readonly placeBag: DisposableBag | null
}

export interface CoverageDeps {
  host: CoverageHost
  registry: Registry
  design(): DesignState
  /** The signal path of the live design (recomputed by the shell on each store change, before this controller is told). */
  path(): PathResult
  earHeight(): number
  /** The place's named listening points (Régie first) at the current ear height. */
  listeningPoints(): { id: string; label: string; position: [number, number, number] }[]
  /** A device body is under a canvas point (a click there selects, it never pins). */
  deviceAt(x: number, y: number): boolean
  /** One more frame (the render scheduler's invalidate): the scene changed. */
  invalidate(): void
  /** Said politely through the shell's status line, once per result. */
  announce(message: string): void
  /** Notified after every rig change; returns the remover. */
  subscribe(fn: () => void): () => void
  bag: DisposableBag
  /** Where the panel goes (the Propriétés panel) and what it goes before (the cable legend). */
  container: HTMLElement
  before: HTMLElement | null
  /** Propriétés is open (the legend, the unit and the caveat are in it: with it folded the dots are hidden). */
  propsOpen(): boolean
  /** Propriétés was folded or unfolded; returns the remover. */
  onPropsChange(fn: () => void): () => void
  /**
   * May a click at this canvas point pin a dot? The shell's one « this click is free » predicate (the same the « missed click » uses): false while a
   * device follows the pointer or is dragged, in the walk view, under the picker, over a port, over a hovered cable.
   */
  canPin(x: number, y: number): boolean
  /** Tests inject a fake worker; the app builds the module worker. */
  makeWorker?: () => MessagePortLike
  /** Tests inject a fake layer / panel; the app builds the real ones. */
  createLayer?: (scene: Scene, invalidate: () => void) => LayerPort
  createPanel?: (handlers: { pin(id: string | null): void }) => PanelPort
}

/** What `window.__creation.coverage()` returns: the e2e oracle (plain data). */
export interface CoverageDebug {
  on: boolean
  status: CoverageStatus
  /** A request is waiting for its debounce or its answer. */
  pending: boolean
  /** The worker exists (false after toggle off, a place change, or while nothing is audible). */
  worker: boolean
  /** Grid points of the shown result, 0 without one. */
  points: number
  step: number | null
  /** The statistics of the shown result (relative dB, unclamped), or null. */
  stats: { min: number; max: number; mean: number; sd: number; count: number } | null
  plain: number
  hatched: number
  /** Names of the coverage meshes that are enabled right now (dots, hatched dots, aim lines, pin ring): empty while Propriétés is folded. */
  meshes: string[]
  /** Propriétés is folded: the layer is hidden (the toggle stays on). */
  hidden: boolean
  /** Dots per colour bin. */
  bins: number[]
  sources: string[]
  aim: { id: string; from: [number, number, number]; to: [number, number, number] }[]
  message: string
  pinned: string | null
  /** The named points' levels (dB relative to the loudest dot, null = silent). */
  probes: { id: string; db: number | null }[]
  /** The loudest dot on the feeds' L_ref scale (0 = unity feed). NOT a sound pressure level. */
  maxLevelDb: number | null
  spl: boolean
}

const OFF_DEBUG: CoverageDebug = { on: false, status: 'off', pending: false, worker: false, points: 0, step: null, stats: null, plain: 0, hatched: 0, meshes: [], hidden: false, bins: [], sources: [], aim: [], message: '', pinned: null, probes: [], maxLevelDb: null, spl: false }

interface Shown {
  reply: CoverageReply
  stepM: number
  n: number
  detail: CoverageSourcesResult
  /** Named probes in the order sent, then the pinned dot when there is one. */
  probes: { id: string; name: string }[]
  hasDotProbe: boolean
  counts: number[]
  hatched: number
}

interface Pin {
  /** A named point's id, or 'dot' for a clicked dot (then `position` is where it was). */
  id: string
  position: [number, number, number]
  /** The ear height of a clicked dot: another height is another plane, the pin goes. */
  ear?: number
}

const C = (): Readonly<Record<string, string>> => COPY.coverage!
const sourcesKey = (s: readonly AcSource[]): string => JSON.stringify(s)

export class CoverageController {
  private isOn = false
  private status: CoverageStatus = 'off'
  private message = ''
  private client: CoverageClient | null = null
  private layer: LayerPort | null = null
  private panel: PanelPort
  private pinAnnounced = ''
  private shown: Shown | null = null
  private req: { id: number; scene: Scene; stepM: number; n: number; detail: CoverageSourcesResult; probes: { id: string; name: string }[]; hasDotProbe: boolean } | null = null
  private lastSig = ''
  private aimSig = ''
  private pin: Pin | null = null
  private lastAnnounced = ''
  private gridCache: { key: string; grid: ReturnType<typeof coverageGrid> } | null = null
  /** Jobs posted by clients that were disposed (a place change, a toggle off): the e2e counts jobs over the page's life. */
  private retiredPosted = 0
  private removeSubscribe: (() => void) | null = null
  private down: { x: number; y: number; t: number } | null = null

  constructor(private readonly deps: CoverageDeps) {
    const handlers = { pin: (id: string | null) => this.pinNamed(id) }
    this.panel = deps.createPanel ? deps.createPanel(handlers) : mountCoveragePanel(deps.host.canvasElement.ownerDocument, deps.container, deps.before, deps.bag, handlers)
    // A click on a dot pins its level. Listeners live as long as the controller (the canvas outlives the places); they act only while it is on.
    const canvas = deps.host.canvasElement
    // Capture, so both run BEFORE the placement controller's drop (its pointerup) and the others: a click that drops a device, patches a port or
    // lands in the walk view is theirs (`canPin` is the shell's shared gate, checked at the press and at the release).
    deps.bag.listen(
      canvas,
      'pointerdown',
      (e: PointerEvent) => {
        this.down = e.button === 0 && e.isPrimary && this.isOn && deps.canPin(e.offsetX, e.offsetY) ? { x: e.offsetX, y: e.offsetY, t: e.timeStamp } : null
      },
      { capture: true }
    )
    deps.bag.listen(canvas, 'pointerup', (e: PointerEvent) => this.onPointerUp(e), { capture: true })
    // `lostpointercapture` / blur: a press that never ended is not a click
    deps.bag.listen(canvas, 'lostpointercapture', () => (this.down = null))
    deps.bag.listen(canvas, 'pointercancel', () => (this.down = null))
    this.removeSubscribe = deps.subscribe(() => this.refresh())
    deps.bag.add(deps.onPropsChange(() => this.onPropsChange()))
    deps.bag.add(() => this.dispose())
  }

  get on(): boolean {
    return this.isOn
  }

  /** The panel's view of the current state. */
  view(): CoverageView {
    if (!this.isOn) return EMPTY_VIEW
    const s = this.shown
    const base: CoverageView = { ...EMPTY_VIEW, on: true, status: this.status, message: this.message }
    if (!s || this.status === 'no-audience' || this.status === 'no-source' || this.status === 'error') return base
    const named: PointRow[] = []
    s.probes.forEach((p, i) => named.push({ id: p.id, name: p.name, text: pointText(p.name, s.reply.probeRelDb[i]), pinnable: true }))
    let pinned: CoverageView['pinned'] = null
    if (this.pin) {
      const idx = s.probes.findIndex((p) => p.id === this.pin!.id)
      const rel = idx >= 0 ? s.reply.probeRelDb[idx] : s.hasDotProbe ? s.reply.probeRelDb[s.probes.length] : undefined
      if (rel !== undefined) pinned = { text: pinnedText(this.pin.position[0], this.pin.position[2], rel) }
    }
    return {
      ...base,
      legend: legendRows(s.counts),
      hatchedCount: s.hatched,
      stats: statRows(s.reply.stats, s.stepM),
      speakers: speakerLines(s.detail.used),
      sourceLine: sourceLine(s.detail.used),
      points: named,
      pinned,
      probeAbove: s.reply.probeRelDb.some((v) => v > 0.05),
      spl: splEstimateEligible(s.detail.used),
    }
  }

  debug(): CoverageDebug {
    if (!this.isOn) return { ...OFF_DEBUG, aim: [], bins: [] }
    const s = this.shown
    const counts = this.layer?.counts ?? { plain: 0, hatched: 0 }
    const v = this.view()
    return {
      on: true,
      status: this.status,
      pending: this.client?.busy ?? false,
      worker: this.client !== null,
      points: s ? s.n : 0,
      step: s ? s.stepM : null,
      stats: s ? { ...s.reply.stats } : null,
      plain: counts.plain,
      hatched: counts.hatched,
      meshes: this.layer?.enabledMeshes ?? [],
      hidden: this.folded(),
      bins: s ? [...s.counts] : [],
      sources: s ? s.detail.used.map((u) => u.instanceId) : [],
      aim: (this.layer?.aimLines ?? []).map((a) => ({ id: a.id, from: [...a.from], to: [...a.to] })),
      message: this.message,
      pinned: v.pinned?.text ?? null,
      probes: s ? s.probes.map((p, i) => ({ id: p.id, db: Number.isFinite(s.reply.probeRelDb[i]) ? s.reply.probeRelDb[i] : null })) : [],
      maxLevelDb: s && Number.isFinite(s.reply.maxDb) ? s.reply.maxDb : null,
      spl: v.spl,
    }
  }

  /** Jobs posted to the worker since the page loaded (a moved speaker is +1, an idle page +0). */
  get jobs(): number {
    return this.retiredPosted + (this.client?.stats.posted ?? 0)
  }

  /** Draw calls of the mesh called `name` in its latest frame (0 when it never drew). */
  drawCalls(name: string): number {
    return this.layer?.drawCalls(name) ?? 0
  }

  setOn(on: boolean): void {
    if (on === this.isOn) return
    this.isOn = on
    this.lastAnnounced = ''
    if (on) {
      this.update()
      return
    }
    this.teardown()
    this.status = 'off'
    this.message = ''
    this.pin = null
    this.shown = null
    this.panel.render(this.view())
    this.deps.announce(C().announceOff!)
  }

  /** Something the field reads may have changed (a rig change, the ear height): recompute if it did. Nothing at all while off. */
  refresh(): void {
    if (this.isOn) this.update()
  }

  /** A place change: nothing of the old place survives; if still on, the new place is computed. */
  reset(): void {
    this.pin = null
    this.shown = null
    this.gridCache = null
    this.teardown()
    if (this.isOn) this.update()
    else this.panel.render(this.view())
  }

  /** The dot under a canvas point (px), ignoring devices: the e2e oracle for the pin. Null while off or with no dots. */
  dotAt(x: number, y: number): [number, number, number] | null {
    return this.isOn ? (this.layer?.pickDot(x, y)?.position ?? null) : null
  }

  /** Propriétés is folded. */
  private folded(): boolean {
    return !this.deps.propsOpen()
  }

  /**
   * Propriétés folded: the legend, the unit and the front caveat are out of sight, and nothing may overlay the viewport, so the dots, the hatched
   * dots and the aim lines are HIDDEN (the toggle stays on; no job, the buffers are kept). Unfolded: they come back. Said once, politely.
   */
  private onPropsChange(): void {
    if (!this.isOn) return
    const folded = this.folded()
    this.layer?.setVisible(!folded)
    if (folded) this.deps.announce(C().hiddenFolded!)
  }

  /** A click that the coverage would take (a dot under the pointer, no device): the shell's « missed click » must not fire. */
  wouldTake(x: number, y: number): boolean {
    return this.isOn && this.layer !== null && this.deps.canPin(x, y) && !this.deps.deviceAt(x, y) && this.layer.pickDot(x, y) !== null
  }

  dispose(): void {
    this.removeSubscribe?.()
    this.removeSubscribe = null
    this.isOn = false
    this.teardown()
  }

  // ── internals ───────────────────────────────────────────────────────────────

  private teardown(): void {
    if (this.client) {
      this.retiredPosted += this.client.stats.posted
      this.client.dispose()
      this.client = null
    }
    this.layer?.dispose()
    this.layer = null
    this.req = null
    this.lastSig = ''
    this.aimSig = ''
  }

  private ensureLayer(scene: Scene): LayerPort {
    if (this.layer && this.layer.scene === scene) return this.layer
    this.layer?.dispose()
    const layer = this.deps.createLayer ? this.deps.createLayer(scene, () => this.deps.invalidate()) : new CoverageLayer(scene, () => this.deps.invalidate())
    layer.setVisible(!this.folded())
    this.layer = layer
    // The place's bag disposes it (and the worker) before the scene goes.
    this.deps.host.placeBag?.add(() => {
      if (this.layer === layer) this.teardown()
      else layer.dispose()
    })
    return layer
  }

  private ensureClient(): CoverageClient {
    if (this.client) return this.client
    const make = this.deps.makeWorker ?? ((): MessagePortLike => new Worker(new URL('../acoustics/worker.ts', import.meta.url), { type: 'module' }) as unknown as MessagePortLike)
    const client = new CoverageClient(make)
    client.onResult((r) => this.onResult(r))
    client.onError((m) => this.onError(m))
    this.client = client
    return client
  }

  private set(status: CoverageStatus, message: string, announce: boolean): void {
    this.status = status
    this.message = message
    this.panel.render(this.view())
    if (announce && message !== this.lastAnnounced) {
      this.lastAnnounced = message
      this.deps.announce(message)
    }
  }

  private grid(): ReturnType<typeof coverageGrid> {
    const h = this.deps.host
    const key = `${h.placeId}|${this.deps.earHeight()}`
    if (this.gridCache?.key !== key) this.gridCache = { key, grid: coverageGrid(h.layout, this.deps.earHeight()) }
    return this.gridCache.grid
  }

  private update(): void {
    const h = this.deps.host
    const scene = h.scene
    if (!scene || h.placeId === null) {
      // A place is being loaded (the old scene is gone, the new one not shown yet): the place's own `onPlaceShown` resets and computes. Not announced.
      this.shown = null
      this.set('computing', C().computing!, false)
      return
    }
    const layer = this.ensureLayer(scene)
    const detail = coverageSourcesDetail(this.deps.design(), this.deps.registry, this.deps.path())
    const grid = this.grid()
    const n = grid.points.length / 3
    if (n === 0) {
      this.nothingToShow(layer) // no audience: no dots and no aim lines either (the indicator is only for a coverage that is visible)
      this.set('no-audience', C().noAudience!, true)
      return
    }
    // The aim lines follow the rig at once (one small mesh, only rebuilt when a speaker's pose or feed changed).
    const aimSig = sourcesKey(detail.sources)
    if (aimSig !== this.aimSig) {
      this.aimSig = aimSig
      layer.setAim(detail.sources)
    }
    if (detail.sources.length === 0) {
      this.nothingToShow(layer)
      this.set('no-source', noSourceMessage(this.deps.path(), detail.excluded), true)
      return
    }
    // Probes: the named listening points, then the pinned dot.
    const named = this.deps.listeningPoints()
    if (this.pin?.id === 'dot' && this.pin.ear !== this.deps.earHeight()) this.pin = null
    if (this.pin && this.pin.id !== 'dot' && !named.some((p) => p.id === this.pin!.id)) this.pin = null
    const probes = named.map((p) => ({ id: p.id, name: p.label }))
    const probeXyz = named.flatMap((p) => p.position)
    const dot = this.pin && this.pin.id === 'dot' ? this.pin : null
    if (dot) probeXyz.push(...dot.position)
    if (this.pin && this.pin.id !== 'dot') {
      const p = named.find((q) => q.id === this.pin!.id)!
      this.pin = { id: p.id, position: p.position }
    }
    const sig = JSON.stringify([h.placeId, this.deps.earHeight(), aimSig, probeXyz])
    if (sig === this.lastSig) return
    this.lastSig = sig
    const client = this.ensureClient()
    const id = client.request({ sources: detail.sources, points: grid.points.slice(), probes: new Float32Array(probeXyz) })
    this.req = { id, scene, stepM: grid.stepM, n, detail, probes, hasDotProbe: dot !== null }
    // While the answer is awaited a previous result stays on screen (no flicker); without one the panel says it computes.
    if (!this.shown) this.set('computing', C().computing!, false)
    else this.panel.render(this.view())
  }

  private nothingToShow(layer: LayerPort): void {
    layer.clearDots()
    layer.setAim([])
    this.aimSig = ''
    layer.setPin(null, 0.5)
    this.shown = null
    this.req = null
    this.lastSig = ''
    if (this.client) {
      // an answer to an earlier request must not bring the dots back
      this.retiredPosted += this.client.stats.posted
      this.client.dispose()
      this.client = null
    }
  }

  private onResult(r: CoverageReply): void {
    const req = this.req
    const layer = this.layer
    if (!req || !layer || r.jobId !== req.id || req.scene !== this.deps.host.scene) return
    const grid = this.grid()
    if (grid.points.length / 3 !== req.n) return // the place or the ear height changed under this answer: the next one is on its way
    const { counts, hatched } = binCounts(r.relDb, r.overlap)
    this.shown = { reply: r, stepM: req.stepM, n: req.n, detail: req.detail, probes: req.probes, hasDotProbe: req.hasDotProbe, counts, hatched }
    if (r.stats.count === 0) {
      layer.clearDots()
      this.set('no-source', noSourceMessage(this.deps.path(), req.detail.excluded), true)
      return
    }
    layer.show(grid.points, r.relDb, r.overlap, req.stepM)
    layer.setPin(this.pin ? this.pin.position : null, req.stepM)
    this.set('ready', doneMessage(r.stats, req.stepM), true)
    // A pinned value is said once per pin (it is a non-live paragraph in the panel).
    const pinned = this.view().pinned
    const key = this.pin ? `${this.pin.id}|${this.pin.position.join(',')}` : ''
    if (pinned && key !== this.pinAnnounced) {
      this.pinAnnounced = key
      this.deps.announce(pinned.text)
    } else if (!pinned) this.pinAnnounced = ''
  }

  private onError(message: string): void {
    console.warn('[coverage]', message)
    this.layer?.clearDots()
    this.shown = null
    this.lastSig = ''
    this.set('error', C().failed!, true)
  }

  // ── pins ────────────────────────────────────────────────────────────────────

  private pinNamed(id: string | null): void {
    if (!this.isOn) return
    if (id === null) this.pin = null
    else {
      const p = this.deps.listeningPoints().find((q) => q.id === id)
      this.pin = p ? { id: p.id, position: p.position } : null
    }
    if (!this.pin) this.layer?.setPin(null, 0.5)
    this.lastSig = ''
    this.update()
  }

  private onPointerUp(e: PointerEvent): void {
    const from = this.down
    this.down = null
    if (!this.isOn || !this.layer || !from || e.button !== 0) return
    if (!isClick(from, { x: e.offsetX, y: e.offsetY, t: e.timeStamp })) return
    if (this.deps.deviceAt(e.offsetX, e.offsetY)) return // a click on a device selects it
    const hit = this.layer.pickDot(e.offsetX, e.offsetY)
    if (!hit) return
    this.pin = { id: 'dot', position: hit.position, ear: this.deps.earHeight() }
    this.lastSig = ''
    this.update()
  }
}

export function createCoverage(deps: CoverageDeps): CoverageController {
  return new CoverageController(deps)
}
