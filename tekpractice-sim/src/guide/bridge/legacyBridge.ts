// The legacy level-play data bridge: `window.__audioSim` (read only) to the guide's plain state, derived host events, rects and anchors.
//
// Rules this file keeps:
// - It READS the debug hook and nothing else. The deps are typed with `LegacyReader`, a Pick of the reader members of the hook (`state`, `assets`,
//   `portScreen`, `deviceScreen` and the level data `level`), so a call to dispatch, canConnect, view, hints and the like is a compile error here, and a
//   removed reader breaks tsc. `hints()` is never asked: the mode of the guide comes from the address alone (mode.ts).
// - What the hook does not expose is not invented. The rig itself is not readable (there is no snapshot accessor), so the cables the guide knows of are the
//   REQUIRED links of the level that are made (the level's required chain minus `state().missing`); a cable outside the chain is not seen, only the rule
//   events it causes are. The controls are not readable either: `controls` is empty and the bridge names no control anchor.
// - It never throws into the page and never writes to the console for a missing or half-built hook: the snapshot is null and the next poll retries.
// - It does not touch the renderer: the hook's own readers are used, the poll is paused while the document is hidden. The 2D board answers null for
//   every projection: that is "not on screen", never a rect at 0,0.
import type { Registry } from '../../engine/CatalogLoader'
import type { PortRef } from '../../engine/types'
import { chainLabel } from '../../ui/format'
import { anchorOf, isAnchor, rectFromPoint } from '../anchors'
import type { HostEvent, Rect } from '../vendor/core/types'
import { POLL_MS, cableKey, refKey, stateHash, type BridgeDoc } from './shared'
import { MISSING_LINK, type TpBridge, type TpPortRef, type TpState } from './types'

/** What the bridge may call on `window.__audioSim`: readers only (plus the level's own data). */
export type LegacyReader = Pick<NonNullable<Window['__audioSim']>, 'state' | 'assets' | 'portScreen' | 'deviceScreen' | 'level'>

export interface LegacyBridgeDeps {
  win: { __audioSim?: LegacyReader; innerWidth?: number; innerHeight?: number }
  registry: Registry
  doc: BridgeDoc
  now: () => number
  setInterval?: (fn: () => void, ms: number) => unknown
  clearInterval?: (handle: never) => void
}

const SIZE = { device: 56, port: 24 } as const

/**
 * Where the shell pieces of the legacy page are (the first element with a real size wins; none = null = "not on screen"). The id is the page's own
 * (src/ui/hud.ts: the objectives card holds the title, the brief, the checklist of required connections and the counter).
 */
export const LEGACY_NAV_SELECTORS: Readonly<Record<string, readonly string[]>> = {
  'nav:objectif': ['#hud-objectives'],
}

// ── anchor table ────────────────────────────────────────────────────────────────────────────────────────────────────

type Target = { kind: 'device'; id: string } | { kind: 'port'; ref: TpPortRef }

interface Table {
  state: TpState
  seen: Set<string>
  devices: Map<string, string>
  ports: Map<string, string>
  rev: Map<string, Target>
}
const emptyTable = (): Table => ({
  state: { route: 'legacy', placeKnown: true, instances: [], connections: [], controls: {}, events: [], playbackReady: false, firstReason: null },
  seen: new Set(),
  devices: new Map(),
  ports: new Map(),
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

const copyRef = (r: PortRef): TpPortRef => {
  if (!r || typeof r.instance !== 'string' || typeof r.port !== 'string') throw new TypeError('port ref')
  return { instance: r.instance, port: r.port }
}

export function createLegacyBridge(deps: LegacyBridgeDeps): TpBridge {
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
      const sim = win.__audioSim
      if (!sim) return null
      const level = sim.level
      const ls = sim.state()
      if (!level || !Array.isArray(level.requiredChain) || !Array.isArray(level.devices)) return null
      if (!ls || !Array.isArray(ls.violations) || !Array.isArray(ls.missing)) return null

      // The devices the hook lists now; the level's own list when it lists none.
      let listed: { instanceId: string; deviceId: string }[] = level.devices
      try {
        const a = sim.assets()
        if (Array.isArray(a)) listed = a
      } catch {
        listed = level.devices
      }
      const instances = listed.map((i) => {
        if (typeof i.instanceId !== 'string' || typeof i.deviceId !== 'string') throw new TypeError('instance')
        return { id: i.instanceId, deviceId: i.deviceId, label: registry.deviceById.get(i.deviceId)?.label ?? i.deviceId }
      })

      // The made required links: the chain minus what the level still misses (the cable has no direction).
      const missing = new Set(ls.missing.map((m) => cableKey(copyRef(m.from), copyRef(m.to))))
      const connections = level.requiredChain
        .filter((rc) => !missing.has(cableKey(copyRef(rc.from), copyRef(rc.to))))
        .map((rc) => ({ a: copyRef(rc.from), b: copyRef(rc.to) }))
      // The first unmet link, as the app's own checklist words it (the level keeps the chain in the order the checklist shows).
      const next = ls.missing[0]

      const state: TpState = {
        route: 'legacy',
        placeKnown: true,
        instances,
        connections,
        controls: {},
        events: ls.violations.map((e) => ({ ruleId: String(e.ruleId), severity: e.severity === 'warning' ? 'warning' : 'error', subjects: (e.subjects ?? []).map(copyRef) })),
        playbackReady: ls.won === true,
        firstReason: next ? { code: MISSING_LINK, text_fr: chainLabel(registry, level, next), subjects: [copyRef(next.from), copyRef(next.to)] } : null,
      }

      // Anchors: every device first (a collision between devices is settled before any port), then each device's catalog ports, then whatever a cable,
      // an event or the first reason names that the catalog did not list.
      const t = emptyTable()
      t.state = state
      for (const i of state.instances) deviceAnchor(t, i.id)
      const named: TpPortRef[] = []
      for (const cx of state.connections) named.push(cx.a, cx.b)
      for (const e of state.events) named.push(...e.subjects)
      if (state.firstReason) named.push(...state.firstReason.subjects)
      for (const i of state.instances) for (const p of registry.deviceById.get(i.deviceId)?.ports ?? []) portAnchor(t, { instance: i.id, port: p.portId })
      for (const r of named) portAnchor(t, r)

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
    const selectors = Object.prototype.hasOwnProperty.call(LEGACY_NAV_SELECTORS, anchor) ? LEGACY_NAV_SELECTORS[anchor] : undefined
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
      const sim = win.__audioSim
      if (!sim) return null
      let target = current.rev.get(anchor)
      if (!target) {
        build() // a device or a cable added since the last poll: refresh the table once
        target = current.rev.get(anchor)
      }
      if (!target) return null
      switch (target.kind) {
        case 'device':
          return onScreen(rectFromPoint(sim.deviceScreen(target.id), SIZE.device))
        case 'port':
          return onScreen(rectFromPoint(sim.portScreen({ instance: target.ref.instance, port: target.ref.port }), SIZE.port))
      }
    } catch {
      return null
    }
  }

  return {
    snapshot: () => build()?.state ?? null,
    rectOf,
    anchorOfPort: (ref) => {
      try {
        if (!ref || typeof ref.instance !== 'string' || typeof ref.port !== 'string') return ''
        return portAnchor(current, ref)
      } catch {
        return ''
      }
    },
    anchorOfDevice: (id) => {
      try {
        return typeof id === 'string' ? deviceAnchor(current, id) : ''
      } catch {
        return ''
      }
    },
    // The legacy hook exposes no control: nothing to name.
    anchorOfControl: () => '',
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
