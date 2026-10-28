/**
 * The « Connecter à… » model (Task 28, CA-02): which ports a cable from one port can go to, the type-ahead filter, and
 * the dialog's state. Pure: no DOM, no Babylon. The dialog (connectDialog.ts) renders it; every cable is an intent sent
 * through `history.do` (the shell never mutates the graph, C6).
 *
 * - `candidates` lists every FREE port of every OTHER device, split by `store.canConnect` (a dry run): the compatible ones
 *   are choosable, the others are shown in an « Incompatibles » group with the rule that refuses them (teaching value).
 *   The reason text comes from the same function as the status bar's and the mouse path's (`rejectionTitle`), so one
 *   change (Task 29: the catalog's `title_fr`) updates all three.
 * - `ConnectSession` is the dialog without the DOM: the filter, the active option, and the one action. Its guards are
 *   the lessons of Tasks 23-27: a held key never repeats the action, a spent or stale session dispatches nothing, a
 *   target whose device left the rig is never sent, and a refusal is a message, never an exception.
 */
import type { Registry } from '../../engine/CatalogLoader'
import type { PortRef } from '../../engine/types'
import { COPY } from '../copy'
import type { History } from '../history'
import type { CreationStore, DispatchFail } from '../store'
import { connectorName, shortName, signalName } from './propertiesModel'
import { rejectionOf, ruleTextFor, type RuleRow } from './statusModel'

export interface Candidate {
  ref: PortRef
  /** « K12.2 (k12-g) · in-line-a · XLR3 femelle · Niveau ligne pro (+4 dBu) »: the option's full name and what the filter searches. */
  label: string
  /** The group heading: « K12.2 (k12-g) ». */
  device: string
  /** The option's visible text under its group: « in-line-a · XLR3 femelle · Niveau ligne pro (+4 dBu) ». */
  port: string
}
export interface RejectedCandidate extends Candidate {
  /** Why this cable cannot go there: the refusing rule's title. */
  reason: string
}
export interface Candidates {
  ok: Candidate[]
  rejected: RejectedCandidate[]
}

/** The text of a refusal (the status bar's and the mouse path's function). */
export type RejectionTitle = (error: DispatchFail['error'], subjects: readonly PortRef[]) => string

const fill = (s: string, vars: Record<string, string>): string => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)

export function candidates(
  store: Pick<CreationStore, 'canConnect' | 'connectionAt' | 'design'>,
  registry: Registry,
  from: PortRef,
  rejectionTitle?: RejectionTitle
): Candidates {
  const out: Candidates = { ok: [], rejected: [] }
  const design = store.design()
  const origin = design.rig.instances.find((i) => i.instanceId === from.instance)
  const originPort = origin && registry.deviceById.get(origin.deviceId)?.ports.find((p) => p.portId === from.port)
  if (!originPort || store.connectionAt(from) !== undefined) return out
  const title: RejectionTitle =
    rejectionTitle ?? ((error, subjects) => rejectionOf(error, subjects, ruleTextFor(registry.catalog.rules as readonly RuleRow[])).title)
  for (const inst of design.rig.instances) {
    if (inst.instanceId === from.instance) continue
    const device = registry.deviceById.get(inst.deviceId)
    if (!device) continue
    const heading = `${shortName(registry, inst.deviceId)} (${inst.instanceId})`
    for (const p of device.ports) {
      const ref: PortRef = { instance: inst.instanceId, port: p.portId }
      if (store.connectionAt(ref) !== undefined) continue // a taken port is not a candidate (UNPLUG first)
      const port = `${p.portId} · ${connectorName(registry, p.connector)} · ${signalName(registry, p.signal)}`
      const entry: Candidate = { ref, label: `${heading} · ${port}`, device: heading, port }
      const r = store.canConnect(from, ref)
      if (r.ok) out.ok.push(entry)
      else out.rejected.push({ ...entry, reason: title({ code: r.code, message: r.message, ...(r.ruleId ? { ruleId: r.ruleId } : {}) }, [from, ref]) })
    }
  }
  return out
}

const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** The entries whose label holds EVERY word of the query (case and accents ignored). An empty query keeps all. */
export function filterCandidates<T extends Candidate>(list: readonly T[], query: string): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return [...list]
  return list.filter((e) => {
    const hay = fold(e.label)
    return words.every((w) => hay.includes(w))
  })
}

export interface DeviceGroup<T extends Candidate> {
  instance: string
  device: string
  items: T[]
}

/** Entries grouped by device, in order of first appearance. */
export function groupByDevice<T extends Candidate>(list: readonly T[]): DeviceGroup<T>[] {
  const groups: DeviceGroup<T>[] = []
  for (const e of list) {
    let g = groups.find((x) => x.instance === e.ref.instance)
    if (!g) groups.push((g = { instance: e.ref.instance, device: e.device, items: [] }))
    g.items.push(e)
  }
  return groups
}

export type ActivateResult =
  | { kind: 'ignored' }
  | { kind: 'connected'; from: PortRef; to: PortRef; a: string; b: string }
  | { kind: 'refused'; message: string }

export interface ConnectSessionDeps {
  store: Pick<CreationStore, 'canConnect' | 'connectionAt' | 'design'>
  history: Pick<History, 'do'>
  registry: Registry
  from: PortRef
  /** « Appareil (id) · prise », for the history entry and the announcement. */
  portName(ref: PortRef): string
  rejectionTitle: RejectionTitle
  /** Called just before the intent (the shell closes a stepper burst still open). */
  beforeDispatch?(): void
}

export class ConnectSession {
  readonly from: PortRef
  readonly ok: readonly Candidate[]
  readonly rejected: readonly RejectedCandidate[]
  private q = ''
  private idx = 0
  private _stale = false
  private spent = false
  private dispatching = false

  constructor(private readonly d: ConnectSessionDeps) {
    this.from = { instance: d.from.instance, port: d.from.port }
    const c = candidates(d.store, d.registry, d.from, d.rejectionTitle)
    this.ok = c.ok
    this.rejected = c.rejected
  }

  get query(): string {
    return this.q
  }
  /** The compatible entries the filter keeps. */
  get visible(): Candidate[] {
    return filterCandidates(this.ok, this.q)
  }
  /** The incompatible entries the filter keeps. */
  get rejectedVisible(): RejectedCandidate[] {
    return filterCandidates(this.rejected, this.q)
  }
  get activeIndex(): number {
    return this.visible.length ? Math.min(this.idx, this.visible.length - 1) : -1
  }
  get active(): Candidate | null {
    return this.visible[this.activeIndex] ?? null
  }
  /** The rig changed under the dialog (not by this session): its list may be wrong. */
  get stale(): boolean {
    return this._stale
  }

  setQuery(q: string): void {
    this.q = q
    this.idx = 0
  }

  move(delta: number): void {
    const n = this.visible.length
    if (!n) return
    this.idx = Math.max(0, Math.min(n - 1, this.activeIndex + delta))
  }

  setActive(ref: PortRef): void {
    const i = this.visible.findIndex((e) => e.ref.instance === ref.instance && e.ref.port === ref.port)
    if (i >= 0) this.idx = i
  }

  /**
   * The store changed. False while this session is dispatching its own CONNECT (the store notifies during `history.do`);
   * otherwise the session is stale and the dialog must close (true).
   */
  onStoreChange(): boolean {
    if (this.dispatching) return false
    this._stale = true
    return true
  }

  /**
   * Connect to the active option. `repeat`: the key is held (auto-repeat) or its first keydown was the press that
   * opened the dialog: never an action. Ignored too when spent (one cable per session), stale, or the target's device
   * is gone.
   */
  activate(key: { repeat: boolean }): ActivateResult {
    const ignored: ActivateResult = { kind: 'ignored' }
    if (key.repeat || this._stale || this.spent) return ignored
    const to = this.active?.ref
    if (!to) return ignored
    const present = new Set(this.d.store.design().rig.instances.map((i) => i.instanceId))
    if (!present.has(this.from.instance) || !present.has(to.instance)) return ignored
    const a = this.d.portName(this.from)
    const b = this.d.portName(to)
    this.d.beforeDispatch?.()
    this.dispatching = true
    let r: ReturnType<History['do']>
    try {
      r = this.d.history.do({ type: 'CONNECT', a: this.from, b: { instance: to.instance, port: to.port } }, fill(COPY.patch!.entryConnect!, { a, b }))
    } finally {
      this.dispatching = false
    }
    if (r.ok) {
      this.spent = true
      return { kind: 'connected', from: this.from, to: { instance: to.instance, port: to.port }, a, b }
    }
    return { kind: 'refused', message: this.d.rejectionTitle(r.error, r.subjects) }
  }
}

/** Why the dialog closed: its cable was made, the learner left, the rig changed under it, or the place (the whole design) did. */
export type CloseReason = 'connected' | 'cancelled' | 'stale' | 'place'
/** Where focus may go when the dialog closes, tried in order until one takes it. Never `<body>`, never a row of another device. */
export type FocusTarget = 'opener' | 'row' | 'title' | 'canvas'

/**
 * The ordered focus targets after the dialog closed (controller ruling, Task 28 fix round 1):
 * - place changed: the 3D canvas (the shell's one tab stop; the rig the dialog referred to is gone);
 * - the cable was made: the row it cabled (same device), then the panel title, then the canvas;
 * - cancelled / rig changed under it: the opener if it is still connected and still denotes the same device and port,
 *   else the Propriétés title (focusable), else the canvas.
 */
export function focusPlan(reason: CloseReason, openerSame: boolean): FocusTarget[] {
  if (reason === 'place') return ['canvas']
  if (reason === 'connected') return ['row', 'title', 'canvas']
  return openerSame ? ['opener', 'title', 'canvas'] : ['title', 'canvas']
}
