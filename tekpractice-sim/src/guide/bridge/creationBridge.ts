// The Mode Création data bridge: `window.__creation` (read only) to the guide's plain state, derived host events, rects and anchors.
//
// Rules this file keeps:
// - It READS the debug hook and nothing else. The deps are typed with `CreationReader`, a Pick of the reader methods of `CreationDebug`,
//   so a call to dispatch, undo, setControlValue, choosePlace and the like is a compile error here, and a removed reader breaks tsc.
// - It never throws into the page and never writes to the console for a missing or half-built hook: the snapshot is null and the next poll retries.
// - It does not touch the renderer: the hook's own readers are used, the poll is paused while the document is hidden.
import type { CreationDebug } from '../../creation/debug'
import type { Registry } from '../../engine/CatalogLoader'
import type { PortRef } from '../../engine/types'
import { signalPath } from '../../flow/signalPath'
import { anchorOf, isAnchor, rectFromPoint } from '../anchors'
import type { HostEvent, Rect } from '../vendor/core/types'
import type { TpBridge, TpPortRef, TpState } from './types'

/** What the bridge may call on `window.__creation`: readers only. */
export type CreationReader = Pick<CreationDebug, 'design' | 'events' | 'place' | 'devicePorts' | 'portScreen' | 'deviceScreen' | 'controlScreen'>

export interface BridgeElement {
  getBoundingClientRect(): { x: number; y: number; width: number; height: number }
}
/** The part of `Document` the bridge uses. */
export interface BridgeDoc {
  readonly hidden: boolean
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
  querySelector(selector: string): BridgeElement | null
}
export interface CreationBridgeDeps {
  win: { __creation?: CreationReader; innerWidth?: number; innerHeight?: number }
  registry: Registry
  doc: BridgeDoc
  now: () => number
  setInterval?: (fn: () => void, ms: number) => unknown
  clearInterval?: (handle: never) => void
}

export const POLL_MS = 500

const SIZE = { device: 56, port: 24, control: 28 } as const

/**
 * Where the shell pieces are, tried in order (the first element with a real size wins; none = null = "not on screen").
 * Every choice is an id or a data-testid the shell sets itself (read only, nothing in src/creation is changed):
 *   nav:inventory  the open inventory drawer (inventoryDrawer.ts:138 data-testid, :139 data-open), else the « Matériel » menu button that opens it
 *                  (menuBar.ts:44 id `cr-menu-<menu id>`, menu id `materiel` in menuModel.ts:231)
 *   nav:place      the place picker while open (placePicker.ts:71 data-testid; hidden = display none, so it has no size), else the « Lieu » menu button
 *                  (menuBar.ts:44, menu id `lieu` in menuModel.ts:227)
 *   nav:status     the status bar (layout.ts:141 data-testid `status-bar`, role contentinfo)
 */
export const NAV_SELECTORS: Readonly<Record<string, readonly string[]>> = {
  'nav:inventory': ['[data-testid="inventory-drawer"][data-open="true"]', '#cr-menu-materiel'],
  'nav:place': ['[data-testid="place-picker"]', '#cr-menu-lieu'],
  'nav:status': ['[data-testid="status-bar"]'],
}

// ── state hash ──────────────────────────────────────────────────────────────────────────────────────────────────────

const SEP = '\u0000'
const refKey = (r: TpPortRef): string => `${r.instance}${SEP}${r.port}`
const cableKey = (a: TpPortRef, b: TpPortRef): string => [refKey(a), refKey(b)].sort().join('\u0001')

/**
 * A stable string of what matters in a state: devices (id and model), cables (a cable has no direction), controls, events, place,
 * playbackReady and the first reason. Not the labels (they come from the model) and not the order of the lists.
 */
export function stateHash(s: TpState): string {
  const controls = Object.keys(s.controls)
    .sort()
    .map((id) =>
      Object.keys(s.controls[id])
        .sort()
        .map((c) => [id, c, typeof s.controls[id][c], String(s.controls[id][c])]),
    )
  return JSON.stringify([
    s.route,
    s.placeKnown,
    s.playbackReady,
    s.instances.map((i) => `${i.id}\u0001${i.deviceId}`).sort(),
    s.connections.map((c) => cableKey(c.a, c.b)).sort(),
    controls,
    s.events.map((e) => JSON.stringify([e.ruleId, e.severity, e.subjects.map(refKey).sort()])).sort(),
    s.firstReason ? [s.firstReason.code, s.firstReason.text_fr, s.firstReason.subjects.map(refKey).sort()] : null,
  ])
}

// ── anchor table ────────────────────────────────────────────────────────────────────────────────────────────────────

type Target = { kind: 'device'; id: string } | { kind: 'port'; ref: TpPortRef } | { kind: 'control'; instance: string; control: string }

/** One snapshot, its anchors (one `seen` set, so injective) and the reverse table. */
interface Table {
  state: TpState
  seen: Set<string>
  devices: Map<string, string>
  ports: Map<string, string>
  controls: Map<string, string>
  rev: Map<string, Target>
}

const emptyTable = (): Table => ({
  state: { route: 'creation', placeKnown: false, instances: [], connections: [], controls: {}, events: [], playbackReady: false, firstReason: null },
  seen: new Set(),
  devices: new Map(),
  ports: new Map(),
  controls: new Map(),
  rev: new Map(),
})

const bodyOf = (anchor: string): string => anchor.slice(anchor.indexOf(':') + 1)

function deviceAnchor(t: Table, id: string): string {
  let a = t.devices.get(id)
  if (a === undefined) {
    a = anchorOf('device', [id], t.seen)
    t.devices.set(id, a)
    t.rev.set(a, { kind: 'device', id })
  }
  return a
}
function portAnchor(t: Table, ref: TpPortRef): string {
  const k = refKey(ref)
  let a = t.ports.get(k)
  if (a === undefined) {
    a = anchorOf('port', [bodyOf(deviceAnchor(t, ref.instance)), ref.port], t.seen)
    t.ports.set(k, a)
    t.rev.set(a, { kind: 'port', ref: { instance: ref.instance, port: ref.port } })
  }
  return a
}
function controlAnchor(t: Table, instance: string, control: string): string {
  const k = `${instance}${SEP}${control}`
  let a = t.controls.get(k)
  if (a === undefined) {
    a = anchorOf('control', [bodyOf(deviceAnchor(t, instance)), control], t.seen)
    t.controls.set(k, a)
    t.rev.set(a, { kind: 'control', instance, control })
  }
  return a
}

// ── the bridge ──────────────────────────────────────────────────────────────────────────────────────────────────────

const copyRef = (r: PortRef): TpPortRef => {
  if (!r || typeof r.instance !== 'string' || typeof r.port !== 'string') throw new TypeError('port ref')
  return { instance: r.instance, port: r.port }
}

export function createCreationBridge(deps: CreationBridgeDeps): TpBridge {
  const { win, registry, doc, now } = deps
  const setTimer = deps.setInterval ?? ((fn: () => void, ms: number): unknown => globalThis.setInterval(fn, ms))
  const clearTimer = deps.clearInterval ?? ((h: never): void => globalThis.clearInterval(h))

  let current: Table = emptyTable()
  let last: { table: Table; hash: string } | null = null
  const listeners = new Set<(state: TpState, events: HostEvent[]) => void>()
  let timer: { handle: unknown } | null = null
  let watching = false
  let destroyed = false

  /** A new table from the hook as it is now, or null while it is absent, half built or throwing. Replaces `current` on success. */
  function build(): Table | null {
    try {
      const c = win.__creation
      if (!c) return null
      const design = c.design()
      const events = c.events()
      const place = c.place()
      const rig = design?.rig
      if (!rig || !Array.isArray(rig.instances) || !Array.isArray(rig.connections) || !rig.controls || typeof rig.controls !== 'object') return null
      if (!Array.isArray(events) || (place !== null && typeof place !== 'string')) return null

      const path = signalPath(design, registry, events)
      const first = path.reasons[0]
      const state: TpState = {
        route: 'creation',
        placeKnown: place !== null,
        instances: rig.instances.map((i) => {
          if (typeof i.instanceId !== 'string' || typeof i.deviceId !== 'string') throw new TypeError('instance')
          return { id: i.instanceId, deviceId: i.deviceId, label: registry.deviceById.get(i.deviceId)?.label ?? i.deviceId }
        }),
        connections: rig.connections.map((cx) => ({ a: copyRef(cx.a), b: copyRef(cx.b) })),
        controls: {},
        events: events.map((e) => ({ ruleId: String(e.ruleId), severity: e.severity === 'warning' ? 'warning' : 'error', subjects: (e.subjects ?? []).map(copyRef) })),
        playbackReady: path.playbackReady === true,
        firstReason: first ? { code: first.code, text_fr: first.text_fr, subjects: first.subjects.map(copyRef) } : null,
      }
      for (const [id, values] of Object.entries(rig.controls)) {
        const copy: Record<string, boolean | string> = {}
        for (const [name, v] of Object.entries(values ?? {})) copy[name] = typeof v === 'boolean' ? v : String(v)
        state.controls[id] = copy
      }

      // Anchors: every device first (a collision between devices is settled before any port), then each device's ports and controls,
      // then whatever a cable or an event names that the hook did not list.
      const t = emptyTable()
      t.state = state
      for (const i of state.instances) deviceAnchor(t, i.id)
      const named = new Map<string, TpPortRef[]>()
      const note = (r: TpPortRef): void => {
        const list = named.get(r.instance)
        if (list) list.push(r)
        else named.set(r.instance, [r])
      }
      for (const cx of state.connections) {
        note(cx.a)
        note(cx.b)
      }
      for (const e of state.events) e.subjects.forEach(note)
      for (const i of state.instances) {
        const listed = c.devicePorts(i.id)
        for (const port of Array.isArray(listed) ? listed : []) portAnchor(t, { instance: i.id, port: String(port) })
        for (const r of named.get(i.id) ?? []) portAnchor(t, r)
        for (const name of Object.keys(state.controls[i.id] ?? {})) controlAnchor(t, i.id, name)
      }
      for (const list of named.values()) for (const r of list) portAnchor(t, r)
      for (const [id, values] of Object.entries(state.controls)) for (const name of Object.keys(values)) controlAnchor(t, id, name)

      current = t
      return t
    } catch {
      return null
    }
  }

  /** The host events a change from `prev` to `next` stands for. Disconnects use the anchors the guide already knew (`prev`). */
  function derive(prev: Table, next: Table): HostEvent[] {
    const at = now()
    const out: HostEvent[] = []
    const had = new Set(prev.state.instances.map((i) => i.id))
    const added = next.state.instances.filter((i) => !had.has(i.id))
    for (const i of added) out.push({ type: 'deviceAdded', at, data: { device: deviceAnchor(next, i.id) } })
    if (prev.state.instances.length === 0 && added.length > 0) out.push({ type: 'place', at, data: { device: deviceAnchor(next, added[0].id) } })

    const before = new Set(prev.state.connections.map((c) => cableKey(c.a, c.b)))
    const after = new Set(next.state.connections.map((c) => cableKey(c.a, c.b)))
    for (const c of next.state.connections) if (!before.has(cableKey(c.a, c.b))) out.push({ type: 'connect', at, data: { a: portAnchor(next, c.a), b: portAnchor(next, c.b) } })
    for (const c of prev.state.connections) if (!after.has(cableKey(c.a, c.b))) out.push({ type: 'disconnect', at, data: { a: portAnchor(prev, c.a), b: portAnchor(prev, c.b) } })

    // A toggle is a control that holds a boolean; a device that is new carries its starting values, which are not a change.
    for (const [id, values] of Object.entries(next.state.controls)) {
      if (!had.has(id)) continue
      const old = prev.state.controls[id]
      if (!old) continue
      for (const [name, v] of Object.entries(values)) {
        if (typeof v === 'boolean' && name in old && old[name] !== v) out.push({ type: 'toggle', at, data: { control: controlAnchor(next, id, name), value: v } })
      }
    }
    return out
  }

  function notify(state: TpState, events: HostEvent[]): void {
    for (const cb of [...listeners]) {
      try {
        cb(state, events)
      } catch (e) {
        console.warn('guide: a listener threw', e)
      }
    }
  }

  function poll(): void {
    try {
      if (destroyed || listeners.size === 0) return
      const next = build()
      if (!next) return
      const hash = stateHash(next.state)
      const prev = last
      last = { table: next, hash }
      if (!prev) return notify(next.state, [])
      if (prev.hash === hash) return
      notify(next.state, derive(prev.table, next))
    } catch {
      // never into the page
    }
  }

  function startTimer(): void {
    if (timer || destroyed || listeners.size === 0 || doc.hidden) return
    timer = { handle: setTimer(poll, POLL_MS) }
  }
  function stopTimer(): void {
    if (!timer) return
    clearTimer(timer.handle as never)
    timer = null
  }
  function onVisibility(): void {
    if (destroyed) return
    if (doc.hidden) {
      stopTimer()
      return
    }
    if (listeners.size === 0) return
    poll()
    startTimer()
  }
  function unwatch(): void {
    stopTimer()
    if (watching) {
      watching = false
      doc.removeEventListener('visibilitychange', onVisibility)
    }
  }

  function navRect(anchor: string): Rect | null {
    const selectors = Object.prototype.hasOwnProperty.call(NAV_SELECTORS, anchor) ? NAV_SELECTORS[anchor] : undefined
    if (!selectors) return null
    for (const sel of selectors) {
      try {
        const box = doc.querySelector(sel)?.getBoundingClientRect()
        if (!box) continue
        const { x, y, width, height } = box
        if ([x, y, width, height].every(Number.isFinite) && width > 0 && height > 0) return { x, y, w: width, h: height }
      } catch {
        // a selector the page cannot answer is the same as an element that is not there
      }
    }
    return null
  }

  /** A rect whose centre is inside the page window (when the window size is known); a scene point outside it is "not on screen". */
  function onScreen(r: Rect | null): Rect | null {
    if (!r) return null
    const { innerWidth: w, innerHeight: h } = win
    if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
      const cx = r.x + r.w / 2
      const cy = r.y + r.h / 2
      if (cx < 0 || cy < 0 || cx > w || cy > h) return null
    }
    return r
  }

  function rectOf(anchor: string): Rect | null {
    try {
      if (!isAnchor(anchor)) return null
      if (anchor.startsWith('nav:')) return navRect(anchor)
      const c = win.__creation
      if (!c) return null
      let target = current.rev.get(anchor)
      if (!target) {
        build() // a device or a cable added since the last poll: refresh the table once
        target = current.rev.get(anchor)
      }
      if (!target) return null
      switch (target.kind) {
        case 'device':
          return onScreen(rectFromPoint(c.deviceScreen(target.id), SIZE.device))
        case 'port':
          return onScreen(rectFromPoint(c.portScreen({ instance: target.ref.instance, port: target.ref.port }), SIZE.port))
        case 'control':
          return onScreen(rectFromPoint(c.controlScreen(target.instance, target.control), SIZE.control))
      }
    } catch {
      return null
    }
  }

  return {
    snapshot: () => build()?.state ?? null,
    rectOf,
    anchorOfPort: (ref) => portAnchor(current, ref),
    anchorOfDevice: (id) => deviceAnchor(current, id),
    onChange(cb) {
      if (destroyed) return () => {}
      listeners.add(cb)
      if (listeners.size === 1) {
        const base = build()
        last = base ? { table: base, hash: stateHash(base.state) } : null
        if (!watching) {
          watching = true
          doc.addEventListener('visibilitychange', onVisibility)
        }
        startTimer()
      }
      return () => {
        if (!listeners.delete(cb) || listeners.size > 0) return
        unwatch()
      }
    },
    destroy() {
      destroyed = true
      listeners.clear()
      unwatch()
    },
  }
}
