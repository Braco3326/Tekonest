// Mounts Oscar in the page: brain, flows, controller and widget, fed by the bridge. One call, one widget, one destroy.
//
// Rules this file keeps:
// - Exam, `?oscar=0` or the flag off: it returns null before it creates, reads or listens to anything (no controller, no widget, no bridge call).
// - Failure isolation: every call into the guide or the bridge is wrapped. A throw while mounting is one console.warn, everything built so far is torn down and
//   the result is null; a throw later (a change, a click) is one console.warn for the whole mount, and the page goes on untouched.
// - The widget asks for rects often (scroll, resize, every refresh of a step). A rect is cached per anchor for RECT_CACHE_MS, because
//   `deviceScreen` is a heavy test seam (a grid pick) and the bridge rebuilds its table on a miss.
// - The flows name RESERVED anchors for what depends on the live bench (the cable to draw, the phantom switch): they are resolved here, from the
//   current state, never by the bridge's reverse table (see flows.creation.ts).
import type { Registry } from '../engine/CatalogLoader'
import { FEATURES, type Features } from '../features'
import type { RuleRow } from '../creation/shell/statusModel'
import { createTekPracticeBrain } from './brain'
import { tpString } from './strings'
import type { TpBridge, TpState } from './bridge/types'
import { NAV_SELECTORS } from './bridge/creationBridge'
import { isAnchor } from './anchors'
import {
  ACKNOWLEDGE,
  CREATION_STRINGS,
  NAV_STATUS,
  SUGGEST_FROM,
  SUGGEST_PHANTOM,
  SUGGEST_TO,
  benchStage,
  firstPhantom,
  flowsFor,
  keywordsFor,
  nextConnectionStep,
} from './flows.creation'
import { guideEnabled, guideMode, type GuideRoute } from './mode'
import { createController } from './vendor/core/controller'
import type { HostEvent, Rect } from './vendor/core/types'
import type { Setup } from './vendor/hostTypes'
import { mountGuide } from './vendor/ui/widget'

/** How long a resolved rect (or "not on screen") is reused. */
export const RECT_CACHE_MS = 250
/** The page's own bars: the menu bar across the top, the status bar across the bottom. The guide's icon and bubble rest clear of them. */
const MENU_BAR = '[data-testid="menubar"]'
const STATUS_BAR = '[data-testid="status-bar"]'
export interface HostInsets {
  top: number
  right: number
  bottom: number
  left: number
}
/** Where the bars are now, from the DOM (read at each placement, so a bar that changes height is followed). Any failure, or a bar that is not on screen, is no bar. */
export function hostInsets(doc: Document): HostInsets {
  const none: HostInsets = { top: 0, right: 0, bottom: 0, left: 0 }
  try {
    const height = doc.documentElement.clientHeight
    const menu = doc.querySelector(MENU_BAR)?.getBoundingClientRect()
    const status = doc.querySelector(STATUS_BAR)?.getBoundingClientRect()
    const top = menu !== undefined && menu.height > 0 && Number.isFinite(menu.bottom) ? Math.max(0, menu.bottom) : 0
    const bottom = status !== undefined && status.height > 0 && Number.isFinite(status.top) && height > 0 ? Math.max(0, height - status.top) : 0
    return { ...none, top, bottom }
  } catch {
    return none
  }
}

/** More `deviceAdded` than this in one poll is a project being restored, not a learner adding devices. */
export const RESTORE_BURST = 3
/** The widget's layer: above the shell, below its dialogs. */
export const GUIDE_Z_INDEX = 35

export interface MountDeps {
  win: Window
  doc: Document
  route: GuideRoute
  search: string
  bridge: TpBridge
  registry: Registry
  storage: Storage | null
  /** The feature flags (default: the app's). */
  features?: Features
  /** The clock of the controller and of the rect cache (default: performance.now). */
  now?: () => number
}
/** The two vendored entry points, injectable so that the mount logic is tested without a DOM. */
export interface MountImpl {
  createController: typeof createController
  mountGuide: typeof mountGuide
}
export interface OscarHandle {
  destroy(): void
}

// ── pure pieces ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * What the controller is told about the bench: a new revision for every change, whatever the stage. The planner then follows its own order: an
 * error to fix (the app's rule text), a place or a device still missing (the verdict sentence), no cable yet (the signal path's first reason,
 * verbatim), a chain that plays (good, with the next flow offered). Null only while the bridge has no state at all.
 */
export function setupFor(state: TpState | null, revision: number): Setup | null {
  if (state === null) return null
  return { coveredFamilies: [], instances: [], connections: [], ctx: { revision } }
}

/**
 * A toggle of the control the flow points at (the first phantom switch) is marked `suggested`, so that the phantom flow ends on that switch and not on
 * any other. The data of every other event is untouched.
 */
export function annotateToggle(event: HostEvent, state: TpState | null, bridge: Pick<TpBridge, 'anchorOfControl'>): HostEvent {
  if (event.type !== 'toggle' || state === null || event.data === undefined) return event
  const target = firstPhantom(state)
  if (target === null) return event
  const anchor = bridge.anchorOfControl(target.instance, target.control)
  return anchor !== '' && event.data.anchor === anchor ? { ...event, data: { ...event.data, suggested: true } } : event
}

/** One poll that brings a burst of devices is a restore: a single `restore` event replaces the whole burst. */
export function collapseRestore(events: readonly HostEvent[]): HostEvent[] {
  const added = events.filter((e) => e.type === 'deviceAdded').length
  if (added <= RESTORE_BURST) return [...events]
  return [{ type: 'restore', at: events[0]?.at ?? 0 }]
}

type Suggestion = { step: ReturnType<typeof nextConnectionStep>; phantom: ReturnType<typeof firstPhantom> }

/** `getRect` for the widget: the bridge's rects, the reserved suggestion anchors, and the per-anchor cache. */
export function createRectResolver(deps: { bridge: TpBridge; registry: Registry; now: () => number }): { getRect(anchor: string): Rect | null; clear(): void } {
  const { bridge, registry, now } = deps
  const cache = new Map<string, { at: number; rect: Rect | null }>()
  let live: { at: number; value: Suggestion } | null = null

  /** One snapshot serves every reserved anchor asked for within the same window. */
  function suggestion(t: number): Suggestion {
    if (live !== null && t - live.at < RECT_CACHE_MS) return live.value
    const state = bridge.snapshot()
    const value: Suggestion = state === null ? { step: null, phantom: null } : { step: nextConnectionStep(state, registry), phantom: firstPhantom(state) }
    live = { at: t, value }
    return value
  }
  const rectOfAnchor = (a: string): Rect | null => (a === '' ? null : bridge.rectOf(a))

  function resolve(anchor: string, t: number): Rect | null {
    if (anchor === SUGGEST_FROM || anchor === SUGGEST_TO) {
      const s = suggestion(t).step
      if (s === null) return null
      return rectOfAnchor(bridge.anchorOfPort(anchor === SUGGEST_FROM ? s.from : s.to))
    }
    if (anchor === SUGGEST_PHANTOM) {
      const p = suggestion(t).phantom
      if (p === null) return null
      // The switch itself when the scene has a pad for it, else the device that holds it (its Propriétés list the switch).
      return rectOfAnchor(bridge.anchorOfControl(p.instance, p.control)) ?? rectOfAnchor(bridge.anchorOfDevice(p.instance))
    }
    return isAnchor(anchor) ? bridge.rectOf(anchor) : null
  }

  return {
    getRect(anchor) {
      const t = now()
      const hit = cache.get(anchor)
      if (hit !== undefined && t - hit.at < RECT_CACHE_MS) return hit.rect === null ? null : { ...hit.rect }
      let rect: Rect | null = null
      try {
        rect = resolve(anchor, t)
      } catch {
        rect = null
      }
      if (cache.size > 64) cache.clear()
      cache.set(anchor, { at: t, rect })
      return rect === null ? null : { ...rect }
    },
    clear() {
      cache.clear()
      live = null
    },
  }
}

// ── the mount ───────────────────────────────────────────────────────────────────────────────────────────────────────

export function mountOscar(deps: MountDeps, impl: MountImpl = { createController, mountGuide }): OscarHandle | null {
  // The gates come first and touch nothing.
  if (!guideEnabled(deps.search, deps.features ?? FEATURES)) return null
  if (guideMode(deps.search, deps.route) !== 'practice') return null

  let warned = false
  const warn = (e: unknown): void => {
    if (warned) return
    warned = true
    try {
      console.warn('guide: stopped, the page is untouched', e)
    } catch {
      // nothing left to say it to
    }
  }
  const cleanups: (() => void)[] = []
  const teardown = (): void => {
    for (const f of cleanups.splice(0).reverse()) {
      try {
        f()
      } catch (e) {
        warn(e)
      }
    }
  }
  const guard = (f: () => void): void => {
    try {
      f()
    } catch (e) {
      warn(e)
    }
  }

  try {
    const { win, doc, bridge, registry } = deps
    const now = deps.now ?? ((): number => performance.now())
    // The bridge is the mount's from here on: whatever happens next, it is stopped with the mount.
    cleanups.push(() => bridge.destroy())

    /** The mode is read live: an exam URL appearing later withholds the guide (the controller's own gate does the rest). */
    const liveSearch = (): string => {
      try {
        const s = win.location?.search
        return typeof s === 'string' ? s : deps.search
      } catch {
        return deps.search
      }
    }
    const mode = (): 'practice' | 'exam' => guideMode(liveSearch(), deps.route)

    const brain = createTekPracticeBrain({ bridge, rules: registry.catalog.rules as unknown as readonly RuleRow[], mode })
    // The controller reads these two lists by reference at every call: the mount keeps them in the order of the bench's stage (see flows.creation.ts).
    const flows = flowsFor('no-place')
    const keywords = keywordsFor('no-place')
    const follow = (state: TpState | null): void => {
      const stage = benchStage(state, registry)
      flows.splice(0, flows.length, ...flowsFor(stage))
      keywords.splice(0, keywords.length, ...keywordsFor(stage))
    }
    const controller = impl.createController({
      brain,
      flows,
      clock: now,
      ...(deps.storage ? { storage: deps.storage } : {}),
      strings: CREATION_STRINGS,
      flowKeywords: keywords,
    })
    const rects = createRectResolver({ bridge, registry, now })
    cleanups.push(() => rects.clear())
    // The widget holds text (the keyboard hint, the bubble) that must sit inside a landmark; it gets one of its own, a child of <body> so that a modal's
    // `inert` on the body's other children still covers it. The landmark has no box of its own (the widget is fixed-positioned).
    const landmark = doc.createElement('aside')
    landmark.setAttribute('aria-label', tpString('landmark'))
    doc.body.appendChild(landmark)
    cleanups.push(() => landmark.remove())
    const handle = impl.mountGuide({
      controller,
      getRect: rects.getRect,
      root: landmark,
      insets: () => hostInsets(doc),
      zIndex: GUIDE_Z_INDEX,
      context: { page: 'workbench', mode: 'practice' },
      storage: deps.storage,
    })
    cleanups.push(() => handle.destroy())

    const send = (input: Parameters<typeof handle.send>[0]): void =>
      guard(() => {
        const p = handle.send(input)
        if (p !== undefined && typeof p.catch === 'function') p.catch(warn)
      })
    const hostEvent = (e: HostEvent): void => send({ type: 'hostEvent', event: e })

    let revision = 0
    const tell = (state: TpState | null): void => send({ type: 'setContext', context: { mode: mode(), setup: setupFor(state, revision) } })

    // A cable, a device, a place or a switch changed: the context first, then the events of the change.
    const unsubscribe = bridge.onChange((state, events) =>
      guard(() => {
        revision++
        rects.clear()
        follow(state)
        tell(state)
        for (const e of collapseRestore(events)) hostEvent(annotateToggle(e, state, bridge))
      }),
    )
    cleanups.push(unsubscribe)

    // The bench as it is now (a restored project is already there when the guide arrives).
    guard(() => {
      const state = bridge.snapshot()
      follow(state)
      tell(state)
    })

    // « Lire la barre d’état »: a `read` step has no change of the bench to wait for, so a click inside the status bar is the learner reading it.
    const statusSelector = NAV_SELECTORS[NAV_STATUS][0]
    const onClick = (e: Event): void =>
      guard(() => {
        const target = e.target as { closest?: (selector: string) => unknown } | null
        if (target && typeof target.closest === 'function' && target.closest(statusSelector)) hostEvent({ type: ACKNOWLEDGE, at: now(), data: { anchor: NAV_STATUS } })
      })
    doc.addEventListener('click', onClick, true)
    cleanups.push(() => doc.removeEventListener('click', onClick, true))

    let destroyed = false
    return {
      destroy(): void {
        if (destroyed) return
        destroyed = true
        teardown()
      },
    }
  } catch (e) {
    warn(e)
    teardown()
    return null
  }
}
