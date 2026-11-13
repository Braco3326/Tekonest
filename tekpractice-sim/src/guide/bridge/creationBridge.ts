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
import { NAV_SELECTORS, POLL_MS, SEP, cableKey, firstRect, refKey, stateHash, type BridgeDoc, type BridgeElement } from './shared'
import type { TpBridge, TpPortRef, TpState } from './types'
import type { TutorialRequest } from '../tutorial'
import { readPowerHelper } from '../../design/powerHelperUse'

export { NAV_SELECTORS, POLL_MS, stateHash }
export type { BridgeDoc, BridgeElement }

/**
 * What the bridge may call on `window.__creation`: readers only. `audioState` (the `playStarted` event) and `selection` (the tutorial's anchors) are
 * optional: a hook without them is still a hook, the bridge then emits no `playStarted` and knows no selection.
 */
export type CreationReader = Pick<CreationDebug, 'design' | 'events' | 'place' | 'devicePorts' | 'portScreen' | 'deviceScreen' | 'controlScreen'> &
  Partial<Pick<CreationDebug, 'audioState' | 'selection' | 'onboarding' | 'helperOffered' | 'helperUses' | 'connectRefusals' | 'appChanges'>>

export interface CreationBridgeDeps {
  win: { __creation?: CreationReader; innerWidth?: number; innerHeight?: number }
  registry: Registry
  doc: BridgeDoc
  now: () => number
  setInterval?: (fn: () => void, ms: number) => unknown
  clearInterval?: (handle: never) => void
}

const SIZE = { device: 56, port: 24, control: 28 } as const

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
  /** The source Écoute was playing at the last look (null = not playing): a `playStarted` is a change to a playing source. */
  let playing: string | null = null

  /** The onboarding request (`onboarding()`): its counter, its kind, whether the tutorial may run; null without the onboarding (`?design`), a record or the reader. */
  function requestNow(): TutorialRequest | null {
    try {
      const o = win.__creation?.onboarding?.()
      if (!o || !o.design || !o.record || typeof o.record.request !== 'number') return null
      const kind = o.requestKind === 'restart' || o.requestKind === 'skip' ? o.requestKind : 'start'
      const atLoad = typeof o.requestAtLoad === 'number' && Number.isSafeInteger(o.requestAtLoad) && o.requestAtLoad >= 0 ? { atLoad: o.requestAtLoad } : {}
      return { n: o.record.request, kind, allowed: o.tutorialAllowed === true && o.premiersPas === true, ...atLoad }
    } catch {
      return null
    }
  }
  /** The request counter at the last look (a change is a `tutorialRequest` event: the guide acts on it, the bench did not change). */
  let requested: number | null = null

  /** The onboarding profile (plan T5.5): null without ?design, a record or the reader. */
  function profileNow(): string | null {
    try {
      const o = win.__creation?.onboarding?.()
      const p = o && o.design && o.record ? o.record.profile : null
      return typeof p === 'string' ? p : null
    } catch {
      return null
    }
  }
  /** The profile at the last look (a change is a `profileChosen` event: the guide may mute Oscar for the engineer; the bench did not change). */
  let profiled: string | null = null
  /** The connections Mode Création refused on this page (plan T5.3: Oscar shrugs), or null without the reader. */
  function refusalsNow(): number | null {
    try {
      const n = win.__creation?.connectRefusals?.()
      return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : null
    } catch {
      return null
    }
  }
  /** The refusal count at the last look (a count that goes up is a `connectRefused` event). */
  let refused: number | null = null
  /**
   * Changes the app made, not the learner (round 1, N2): Mode Création's counter of undos, redos and loads, plus the power helper's uses. A sum that goes up adds
   * an `appChange` event to that poll (the guide then celebrates and nods none of its cables). Null without the readers.
   */
  function appMadeNow(): number | null {
    try {
      const c = win.__creation
      const a = c?.appChanges?.()
      const ok = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0
      const h = c?.helperUses?.()
      const hn = h && ok(h.n) ? h.n : 0
      if (!ok(a) && !(h && ok(h.n))) return null
      return (ok(a) ? a : 0) + hn
    } catch {
      return null
    }
  }
  let appMade: number | null = null

  /** The source playing now (`state` 'playing' only: 'starting' is not a sound yet), or null; null when the hook has no reader or it throws. */
  function playingNow(): string | null {
    try {
      const a = win.__creation?.audioState?.()
      return a && a.state === 'playing' && typeof a.source === 'string' ? a.source : null
    } catch {
      return null
    }
  }

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
    // `placeChosen`: a place appears on screen (placeKnown false to true). `place` below keeps its own meaning (the first device).
    if (!prev.state.placeKnown && next.state.placeKnown) out.push({ type: 'placeChosen', at })
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
        if (typeof v === 'boolean' && name in old && old[name] !== v) {
          // `control` and `anchor` are the same anchor string: the flows contract reads `anchor`, the first bridge tests read `control`.
          const a = controlAnchor(next, id, name)
          out.push({ type: 'toggle', at, data: { control: a, anchor: a, value: v } })
        }
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
      // Écoute is not part of the bench (no hash change): a sound that starts is its own event, with the bench events of the same poll if any.
      const sound = playingNow()
      const started = prev !== null && sound !== null && sound !== playing
      playing = sound
      const req = requestNow()?.n ?? null
      const asked = prev !== null && req !== null && req !== requested
      requested = req
      const prof = profileNow()
      const chose = prev !== null && prof !== profiled
      profiled = prof
      const nRefused = refusalsNow()
      const refusedNow = prev !== null && nRefused !== null && refused !== null && nRefused > refused
      refused = nRefused
      const nApp = appMadeNow()
      const appNow = prev !== null && nApp !== null && appMade !== null && nApp > appMade
      appMade = nApp
      if (!prev) return notify(next.state, [])
      const extra: HostEvent[] = [
        ...(started ? [{ type: 'playStarted', at: now(), data: { source: sound } }] : []),
        ...(asked ? [{ type: 'tutorialRequest', at: now(), data: { n: req } }] : []),
        ...(refusedNow ? [{ type: 'connectRefused', at: now() }] : []),
        ...(chose ? [{ type: 'profileChosen', at: now() }] : []),
        ...(appNow ? [{ type: 'appChange', at: now() }] : []),
      ]
      if (prev.hash === hash && extra.length === 0) return
      notify(next.state, [...(prev.hash === hash ? [] : derive(prev.table, next)), ...extra])
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
    return selectors ? firstRect(doc, selectors) : null
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
    tutorialRequest: () => requestNow(),
    profile: () => profileNow(),
    playing: () => playingNow(),
    // T6.1 (the step card's closing lines): the signal path's mic verdict now, from the hook's own design and events; null while the hook has no design, or on a throw
    mic: () => {
      try {
        const c = win.__creation
        if (!c) return null
        const design = c.design()
        if (!design || !design.rig) return null
        const path = signalPath(design, registry, c.events())
        return { micOk: path.micOk === true, micReasons: path.micReasons.map((r) => ({ code: String(r.code), text_fr: String(r.text_fr) })) }
      } catch {
        return null
      }
    },
    // T3 close review S2 / S3: the power helper as Mode Création says it (offered now, uses on this page); null without the readers or on a malformed answer
    helper: () => {
      try {
        const c = win.__creation
        return c?.helperOffered && c.helperUses ? readPowerHelper(c.helperOffered(), c.helperUses()) : null
      } catch {
        return null
      }
    },
    selection: () => {
      try {
        const s = win.__creation?.selection?.()
        return typeof s === 'string' ? s : null
      } catch {
        return null
      }
    },
    anchorOfControl: (instance, control) => {
      try {
        return typeof instance === 'string' && typeof control === 'string' ? controlAnchor(current, instance, control) : ''
      } catch {
        return ''
      }
    },
    onChange(cb) {
      if (destroyed) return () => {}
      listeners.add(cb)
      if (listeners.size === 1) {
        const base = build()
        last = base ? { table: base, hash: stateHash(base.state) } : null
        playing = playingNow() // a sound already playing when the guide arrives is not a start
        requested = requestNow()?.n ?? null // the mount reads the request itself at its first look
        profiled = profileNow() // the mount reads the profile itself at its first look
        refused = refusalsNow() // a refusal before the guide arrived is not news
        appMade = appMadeNow()
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
