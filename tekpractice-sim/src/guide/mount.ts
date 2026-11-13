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
// - The tutorial « Premiers pas » exists only under `?design=1..5` (src/guide/tutorial.ts): its flow is added LAST to the controller's list (never offered
//   first, never started here: plan T3.2 starts it on the start screen's request), its events get their role / pair / playback data, its anchors are
//   resolved from the page. Without `?design` nothing of it is there and the events reach the controller exactly as before.
// - The step card (plan T6.1) is that tutorial's progress presenter, in the shell's reserved slot (src/design/tutorialSlot.ts): it follows the runtime's record, exists only while a
//   tutorial runs and leaves with it. The page's top inset counts the slot, so Oscar rests clear of it.
import type { Registry } from '../engine/CatalogLoader'
import { FEATURES, type Features } from '../features'
import { ruleRowsFor } from '../creation/ruleTexts'
import type { RuleRow } from '../creation/shell/statusModel'
import { createTekPracticeBrain } from './brain'
import { tpString } from './strings'
import type { TpBridge, TpState } from './bridge/types'
import { NAV_SELECTORS, firstRect, type BridgeDoc } from './bridge/shared'
import { createRevealer, type RevealDoc } from './reveal'
import { PLAY_STARTED, TUTORIAL_REQUEST, annotateTutorialEvent, closingLines, createTutorialRuntime, isTutorialAnchor, resolveTutorialAnchor, type TutorialDetail } from './tutorial'
import { mountStepCard, type StepCard } from './stepCard'
import type { StepId } from '../design/packages'
import { TUTORIAL_EVENT, TUTORIAL_FOCUS_EVENT } from '../design/events'
import { activePackage } from '../design/packages'
import { COPY } from '../creation/copy'
import { isAnchor } from './anchors'
import { chooseClearance } from './clearance'
import { RESTORE_BURST } from './restore'
import { APP_CHANGE, CONNECT_REFUSED, GUIDE_MUTE_KEY, PROFILE_CHOSEN, attachSkin, hostEventFor, muteDefaultStorage, quietByDefault, skinAllowed, stepAdvanced, type Celebrations, type Skin } from './skin'
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
  tutorialFlowFor,
} from './flows.creation'
import { LEGACY_ACK_SELECTOR, LEGACY_NAV_OBJECTIVES, LEGACY_STRINGS, legacyFlowsFor, legacyKeywords, legacyStorageKey, nextLegacyLink } from './flows.legacy'
import { guideMode, guideRouteAllowed, type GuideRoute } from './mode'
import { createController } from './vendor/core/controller'
import type { ControllerInput, HostEvent, Rect } from './vendor/core/types'
import type { Setup } from './vendor/hostTypes'
import { UI_STORAGE_KEY, mountGuide } from './vendor/ui/widget'
import { DEFAULT_CORNER, cleanInsets, loadCorner, type Corner } from './vendor/ui/layout'

/** How long a resolved rect (or "not on screen") is reused. */
export const RECT_CACHE_MS = 250
/** The page's own bars: the menu bar across the top, the status bar across the bottom. The guide's icon and bubble rest clear of them. */
const MENU_BAR = '[data-testid="menubar"]'
const STATUS_BAR = '[data-testid="status-bar"]'
/** The tutorial's reserved row (src/design/tutorialSlot.ts), under the menu bar, only while a tutorial runs. */
const TUTORIAL_SLOT = '[data-testid="tutorial-slot"]'
/** The entrepreneur's card's reserved row (src/creation/onboarding/ownGearCard.ts), just above the status bar, only while that card is shown (T6.4). */
const GEAR_SLOT = '[data-testid="gear-slot"]'
/** The bench events the bridge derives from a change of the design (not Écoute's `playStarted`, not the page's own events). */
const BENCH_EVENTS: ReadonlySet<string> = new Set(['placeChosen', 'place', 'deviceAdded', 'connect', 'disconnect', 'toggle'])
export interface HostInsets {
  top: number
  right: number
  bottom: number
  left: number
}
/** The two side panels (Projet on the left, Propriétés on the right: open at their width, folded to their rail) and the inventory drawer (only while it is open). */
const PROPS_PANEL = '[data-testid="properties"]'
const TREE_PANEL = '[data-testid="project-tree"]'
const INVENTORY_DRAWER = '[data-testid="inventory-drawer"][data-open="true"]'
/**
 * Where the page's own chrome is now, from the DOM (read at each placement, so a bar or a panel that folds is followed): the menu bar on top, the
 * status bar at the bottom, the Projet panel on the left, Propriétés on the right (its width when open, its rail when folded). Any failure, or a part that is not on
 * screen, is no inset (a throw is zero for everything).
 */
export function hostInsets(doc: Document): HostInsets {
  const none: HostInsets = { top: 0, right: 0, bottom: 0, left: 0 }
  try {
    const width = doc.documentElement.clientWidth
    const height = doc.documentElement.clientHeight
    const menu = doc.querySelector(MENU_BAR)?.getBoundingClientRect()
    const slot = doc.querySelector(TUTORIAL_SLOT)?.getBoundingClientRect()
    const status = doc.querySelector(STATUS_BAR)?.getBoundingClientRect()
    const gear = doc.querySelector(GEAR_SLOT)?.getBoundingClientRect()
    const tree = doc.querySelector(TREE_PANEL)?.getBoundingClientRect()
    const props = doc.querySelector(PROPS_PANEL)?.getBoundingClientRect()
    const menuBottom = menu !== undefined && menu.height > 0 && Number.isFinite(menu.bottom) ? Math.max(0, menu.bottom) : 0
    // the step card's row sits right under the menu bar: Oscar rests below it (T6.1)
    const top = slot !== undefined && slot.height > 0 && Number.isFinite(slot.bottom) ? Math.max(menuBottom, slot.bottom) : menuBottom
    // the entrepreneur's row sits right above the status bar: Oscar rests above it (T6.4)
    const barTop = status !== undefined && status.height > 0 && Number.isFinite(status.top) ? status.top : null
    const gearTop = gear !== undefined && gear.height > 0 && Number.isFinite(gear.top) ? gear.top : null
    const lowest = barTop === null ? gearTop : gearTop === null ? barTop : Math.min(barTop, gearTop)
    const bottom = lowest !== null && height > 0 ? Math.max(0, height - lowest) : 0
    const left = tree !== undefined && tree.width > 0 && Number.isFinite(tree.right) && width > 0 ? Math.max(0, tree.right) : 0
    const right = props !== undefined && props.width > 0 && Number.isFinite(props.left) && width > 0 ? Math.max(0, width - props.left) : 0
    return { top, right, bottom, left }
  } catch {
    return none
  }
}

// ── the page's controls ─────────────────────────────────────────────────────────────────────────────────────────────────
// The icon and the bubble also rest clear of the controls of the shell (buttons, menu items, fields, tabs): what the widget cannot know, the page tells it.

/** The root of the Mode Création shell: the controls looked for are inside it (the level page has none, so it has no obstacle). */
const SHELL_ROOT = '[data-testid="creation-root"]'
const OBSTACLE_CONTROLS =
  'button, a[href], input, select, textarea, summary, [role="button"], [role="menuitem"], [role="tab"], [role="option"], [role="combobox"], [tabindex]:not([tabindex="-1"])'
/** A control smaller than this (a speck, a hidden handle) is not worth steering around. */
const MIN_OBSTACLE_PX = 4
/** A box larger than this share of the viewport is a container, not a control (the guide could never rest anywhere). */
const MAX_OBSTACLE_SHARE = 0.4
/** The most controls kept (a page with thousands of rows is not steered around row by row). */
const MAX_OBSTACLES = 400

/** What a scan remembers: the clip that an element's scroll-area ancestors put on everything inside it (null = nothing shows; the infinite box = no clip). */
type ClipMemo = Map<Element, Rect | null>
const NO_CLIP: Rect = { x: -1e9, y: -1e9, w: 2e9, h: 2e9 }
const meet = (a: Rect, b: Rect): Rect | null => {
  const x0 = Math.max(a.x, b.x)
  const y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.w, b.x + b.w)
  const y1 = Math.min(a.y + a.h, b.y + b.h)
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null
}
/**
 * The clip that `el` and the ancestors above it (up to `root`) put on what they hold: their own box when their overflow is not visible, met with the clip of
 * their parent. Remembered per element for the scan, so a scroll area that holds forty controls is read once (one style, one box), not forty times.
 * A `position: fixed` descendant of a scroll area is not really clipped by it; the shell has none (its fixed parts are the root and the dialogs, outside), and
 * if one appears this would hide it behind a clip that does not apply, which only makes the icon avoid less, never more.
 */
function clipAbove(el: Element | null, view: Window, root: Element, memo: ClipMemo): Rect | null {
  if (el === null || el === root) return NO_CLIP
  const known = memo.get(el)
  if (known !== undefined) return known
  const above = clipAbove(el.parentElement, view, root, memo)
  let clip = above
  if (above !== null) {
    const s = view.getComputedStyle(el)
    if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
      const b = el.getBoundingClientRect()
      clip = meet(above, { x: b.left, y: b.top, w: b.width, h: b.height })
    }
  }
  memo.set(el, clip)
  return clip
}
/** The part of `el` that shows: its box cut to the viewport and to every scroll area (up to `root`) that holds it; null when nothing shows. */
function shownBox(el: Element, view: Window, root: Element, vw: number, vh: number, memo: ClipMemo, own?: Rect): Rect | null {
  const b = el.getBoundingClientRect()
  const box: Rect = { x: own?.x ?? b.left, y: own?.y ?? b.top, w: own?.w ?? b.width, h: own?.h ?? b.height }
  const inView = meet(box, { x: 0, y: 0, w: vw, h: vh })
  if (inView === null) return null
  const clip = clipAbove(el.parentElement, view, root, memo)
  return clip === null ? null : meet(inView, clip)
}
const usable = (el: Element, view: Window): boolean => {
  if (el.tagName === 'CANVAS' || el.closest('[inert]') !== null) return false
  const style = view.getComputedStyle(el)
  return style.visibility === 'visible' && style.display !== 'none'
}

/**
 * What the icon and the bubble rest clear of, as rects in viewport pixels: the two side panels whole (open or folded to their rail: the widget's inset for them
 * is capped at a quarter of the viewport, so on a narrow window the panel itself is the obstacle), the inventory drawer while it is open (at its resting place:
 * its box is mid-slide for 180 ms), the tutorial's step-card row while it exists (plan T6.1), then every control of the shell. Not an obstacle: anything hidden, `display: none` or inert (itself or an ancestor), the 3D
 * canvas, a control that is a speck or fills the screen, and what a scroll area has scrolled out of sight (a control it clips is cut to the part that shows).
 * Any failure, a page without the shell, or a document without a size: no obstacle.
 */
export function hostObstacles(doc: Document): Rect[] {
  try {
    const root = doc.querySelector(SHELL_ROOT)
    const view = doc.defaultView
    const vw = doc.documentElement.clientWidth
    const vh = doc.documentElement.clientHeight
    if (root === null || view === null || !(vw > 0) || !(vh > 0)) return []
    const out: Rect[] = []
    const memo: ClipMemo = new Map()
    for (const sel of [PROPS_PANEL, TREE_PANEL]) {
      const panel = root.querySelector(sel)
      const box = panel !== null && usable(panel, view) ? shownBox(panel, view, root, vw, vh, memo) : null
      if (box !== null) out.push(box)
    }
    const drawer = root.querySelector(INVENTORY_DRAWER)
    if (drawer !== null && usable(drawer, view)) {
      // Resting place: the bottom of the view that holds it, as high as its layout height (the box itself is translated while it slides).
      const b = drawer.getBoundingClientRect()
      const holder = drawer.parentElement?.getBoundingClientRect()
      const h = (drawer as HTMLElement).offsetHeight || b.height
      const box = shownBox(drawer, view, root, vw, vh, memo, holder !== undefined ? { x: b.left, y: holder.bottom - h, w: b.width, h } : undefined)
      if (box !== null) out.push(box)
    }
    // the tutorial's row (the step card): the icon and the bubble never rest on the card, whatever it holds
    const slotEl = root.querySelector(TUTORIAL_SLOT)
    if (slotEl !== null && usable(slotEl, view)) {
      const box = shownBox(slotEl, view, root, vw, vh, memo)
      if (box !== null && box.w * box.h <= MAX_OBSTACLE_SHARE * vw * vh) out.push(box)
    }
    // the entrepreneur's row (T6.4): the icon and the bubble never rest on the card either
    const gearEl = root.querySelector(GEAR_SLOT)
    if (gearEl !== null && usable(gearEl, view)) {
      const box = shownBox(gearEl, view, root, vw, vh, memo)
      if (box !== null && box.w * box.h <= MAX_OBSTACLE_SHARE * vw * vh) out.push(box)
    }
    const wholes = out.length
    for (const el of Array.from(root.querySelectorAll(OBSTACLE_CONTROLS))) {
      if (out.length >= MAX_OBSTACLES) break
      if (!usable(el, view)) continue
      const box = shownBox(el, view, root, vw, vh, memo)
      if (box === null || box.w < MIN_OBSTACLE_PX || box.h < MIN_OBSTACLE_PX || box.w * box.h > MAX_OBSTACLE_SHARE * vw * vh) continue
      // already inside a panel or the drawer, which are obstacles whole: listing it again only makes the icon's search longer
      if (out.slice(0, wholes).some((w) => box.x >= w.x && box.y >= w.y && box.x + box.w <= w.x + w.w && box.y + box.h <= w.y + w.h)) continue
      out.push(box)
    }
    return out
  } catch {
    return []
  }
}

/**
 * The widget's `obstacles`: the controls of the page, read again at most every RECT_CACHE_MS, or at once when the widget says the page just changed (a panel
 * folded, a drawer opened, a scroll).
 */
export function createObstacleSource(deps: { doc: Document; now: () => number }): (fresh?: boolean) => Rect[] {
  let at = Number.NEGATIVE_INFINITY
  let cached: Rect[] = []
  return (fresh) => {
    const t = deps.now()
    if (fresh === true || t - at >= RECT_CACHE_MS) {
      cached = hostObstacles(deps.doc)
      at = t
    }
    return cached
  }
}

/** The 3D view of the shell (its centre is kept free: src/guide/clearance.ts). */
const VIEWPORT = '.cr-viewport'
/** The widget's bubble and icon (vendored class names, read only: the skin observes the same nodes). */
const GUIDE_BUBBLE = '.oscar-bubble'
const GUIDE_ICON = '.oscar-icon'
const shown = (el: Element | null | undefined): el is HTMLElement => el !== null && el !== undefined && !(el as HTMLElement).hidden
/**
 * G14b: what the guide keeps clear of besides the controls, read live (the target moves with every step): the body of the device a step points at, a margin
 * around it and the centre of the 3D view (src/guide/clearance.ts), given up when the open bubble would find no place clear of the controls with them
 * (`chooseClearance`). Only in the Mode Création shell (the level page keeps the widget's own placement). Any failure: nothing.
 */
export function hostClearance(
  doc: Document,
  targets: readonly (Rect | null | undefined)[],
  controls: readonly Rect[] = [],
  guide: Pick<Element, 'querySelector'> | null = null,
  bodies: readonly Rect[] = [],
  home: Corner = DEFAULT_CORNER,
): Rect[] {
  try {
    const root = doc.querySelector(SHELL_ROOT)
    if (root === null) return []
    const v = root.querySelector(VIEWPORT)?.getBoundingClientRect()
    const view = v !== undefined && v.width > 0 && v.height > 0 ? { x: v.left, y: v.top, w: v.width, h: v.height } : null
    const window = { w: doc.documentElement.clientWidth, h: doc.documentElement.clientHeight }
    const bubbleEl = guide?.querySelector(GUIDE_BUBBLE)
    // the bubble's whole height: the widget may have capped it (an inline max-height) while it placed it beside a target
    const bubble = shown(bubbleEl) && bubbleEl.offsetWidth > 0 ? { w: bubbleEl.offsetWidth, h: Math.max(bubbleEl.offsetHeight, bubbleEl.scrollHeight) } : null
    const i = guide?.querySelector(GUIDE_ICON)?.getBoundingClientRect()
    const restIcon = i !== undefined && i.width > 0 ? { x: i.left, y: i.top, w: i.width, h: i.height } : null
    const insets = cleanInsets(hostInsets(doc), window)
    return chooseClearance({ view, targets, window, controls, bubble, restIcon, bodies, home, insets })
  } catch {
    return []
  }
}
/**
 * The widget's `obstacles` (G14b): the page's controls (read at most every RECT_CACHE_MS, `createObstacleSource`), then the soft clearance of the current target.
 * The clearance is worked out again only when what it depends on changed (the controls, the targets, the device bodies, the view, the window, the bubble's size, and
 * the icon at rest only): the widget asks for its obstacles several times per placement.
 */
export function createGuideObstacles(deps: {
  doc: Document
  now: () => number
  targets: () => Rect[]
  guide: Pick<Element, 'querySelector'> | null
  /** The bench devices' bodies on screen (the bridge's `bodyRects`); none by default. */
  bodies?: () => Rect[]
  /** The widget's home corner now (it starts the bubble there when no place beside the target holds it). */
  home?: () => Corner
  /** Whether the clearance applies now (default: always). The mount asks for it only while the « Premiers pas » tutorial runs: outside it the guide places as before. */
  active?: () => boolean
}): (fresh?: boolean) => Rect[] {
  const controls = createObstacleSource({ doc: deps.doc, now: deps.now })
  let memo: { key: string; out: Rect[] } | null = null
  return (fresh) => {
    const list = controls(fresh)
    let out: Rect[] = []
    try {
      if (deps.active !== undefined && !deps.active()) return list
      const targets = deps.targets()
      // a body is only read while a step points at something (the projection of every device is not free)
      const bodies = targets.length > 0 && deps.bodies !== undefined ? deps.bodies() : []
      const doc = deps.doc
      const v = doc.querySelector(SHELL_ROOT)?.querySelector(VIEWPORT)?.getBoundingClientRect()
      const b = deps.guide?.querySelector(GUIDE_BUBBLE) as HTMLElement | null | undefined
      const i = deps.guide?.querySelector(GUIDE_ICON)?.getBoundingClientRect()
      const r = (n: number | undefined): number => Math.round(n ?? 0)
      const home = deps.home?.() ?? DEFAULT_CORNER
      const key = JSON.stringify([
        home,
        list.map((t) => [r(t.x), r(t.y), r(t.w), r(t.h)]),
        targets.map((t) => [r(t.x), r(t.y), r(t.w), r(t.h)]),
        bodies.map((t) => [r(t.x), r(t.y), r(t.w), r(t.h)]),
        v === undefined ? null : [r(v.left), r(v.top), r(v.width), r(v.height)],
        [doc.documentElement.clientWidth, doc.documentElement.clientHeight],
        shown(b) ? [b.offsetWidth, Math.max(b.offsetHeight, b.scrollHeight)] : null,
        // the icon counts only at rest: while a step points at something it is placed FROM this choice, and reading it back would loop
        targets.length === 0 && i !== undefined ? [r(i.left), r(i.top)] : null,
      ])
      if (memo !== null && memo.key === key) out = memo.out
      else {
        out = hostClearance(doc, targets, list, deps.guide, bodies, home)
        memo = { key, out }
      }
    } catch {
      out = []
    }
    return out.length === 0 ? list : [...list, ...out]
  }
}
/** The rects the guide's current step points at (its target and, for a drag, where it goes), from the controller's view; none while it points at nothing. */
export function viewTargets(view: unknown): Rect[] {
  try {
    const v = view as { visible?: unknown; target?: { rect?: Rect | null; to?: Rect | null } | null } | null | undefined
    if (v === null || v === undefined || v.visible !== true || v.target === null || v.target === undefined) return []
    return [v.target.rect, v.target.to].filter((r): r is Rect => r !== null && r !== undefined && typeof r === 'object')
  } catch {
    return []
  }
}

export { RESTORE_BURST }
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
  /** The new Oscar's skin (src/guide/skin.ts; default: the real one), injectable for the same reason. */
  attachSkin?: typeof attachSkin
  /** The step card (src/guide/stepCard.ts; default: the real one), injectable for the same reason. */
  mountStepCard?: typeof mountStepCard
}
/** The « Passer cette étape » chip of the bubble (vendored `data-chip`): the step it passes is not a step done, so it is not nodded. */
const SKIP_CHIP = '[data-chip="skip"]'
/**
 * The storage the widget reads its home corner from, with the active design package's corner as the DEFAULT (plan T4.3): while the widget has saved nothing under its UI key,
 * a read says `{ corner }`; whatever the learner moves Oscar to is written through (and read back) as before. Every other key, and a blocked or missing storage, behave as the plain
 * storage (a write the storage refuses is kept for the session). The vendored widget is untouched: it already loads and saves its corner through the storage it is handed.
 */
export function cornerDefaultStorage(storage: Storage | null, key: string, corner: 'br' | 'bl' | 'tr'): { getItem(k: string): string | null; setItem(k: string, v: string): void } {
  const session = new Map<string, string>()
  return {
    getItem(k) {
      let v: string | null = session.get(k) ?? null
      if (v === null && storage !== null) {
        try {
          v = storage.getItem(k)
        } catch {
          v = null
        }
      }
      return v === null && k === key ? JSON.stringify({ corner }) : v
    },
    setItem(k, v) {
      if (storage !== null) {
        try {
          storage.setItem(k, v)
          session.delete(k)
          return
        } catch {
          // blocked: kept for this session below
        }
      }
      session.set(k, v)
    },
  }
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

const legacyStep = (state: TpState): Suggestion['step'] => {
  const link = nextLegacyLink(state)
  return link === null ? null : { ...link, say: '' }
}

/** `getRect` for the widget: the bridge's rects, the reserved suggestion anchors, and the per-anchor cache. */
export function createRectResolver(deps: {
  bridge: TpBridge
  registry: Registry
  now: () => number
  route?: GuideRoute
  doc?: Pick<BridgeDoc, 'querySelector'>
  /** The tutorial unlocked the power helper (plan T3.4): its power steps then ring the helper button (or the checklist chip). */
  helperUnlocked?: () => boolean
  /** Mode Création offers the helper now (T3 close review S3): required too, so the ring never points at a button that is not there. */
  helperOffered?: () => boolean
}): { getRect(anchor: string): Rect | null; clear(): void } {
  const { bridge, registry, now } = deps
  const legacy = deps.route === 'legacy'
  const cache = new Map<string, { at: number; rect: Rect | null }>()
  let live: { at: number; value: Suggestion } | null = null

  /** One snapshot serves every reserved anchor asked for within the same window. */
  function suggestion(t: number): Suggestion {
    if (live !== null && t - live.at < RECT_CACHE_MS) return live.value
    const state = bridge.snapshot()
    // Level play: the cable to draw is the first required connection the level still misses; the page has no phantom switch to point at.
    const value: Suggestion =
      state === null
        ? { step: null, phantom: null }
        : legacy
          ? { step: legacyStep(state), phantom: null }
          : { step: nextConnectionStep(state, registry), phantom: firstPhantom(state) }
    live = { at: t, value }
    return value
  }
  const rectOfAnchor = (a: string): Rect | null => (a === '' ? null : bridge.rectOf(a))
  // G14c fix (a): a ringed Propriétés button below the panel's fold is scrolled into view, once per target (src/guide/reveal.ts)
  const reveal = createRevealer(deps.doc as RevealDoc | undefined, (e) => (typeof getComputedStyle === 'function' ? getComputedStyle(e as unknown as Element).overflowY : 'visible'))

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
    if (isTutorialAnchor(anchor)) {
      // The tutorial's anchors read the page (a drawer tab, a card, a Propriétés button) and the selection; no page = not on screen.
      const doc = deps.doc
      const r = resolveTutorialAnchor(anchor, {
        state: bridge.snapshot(),
        selection: bridge.selection?.() ?? null,
        registry,
        firstRect: (selectors) => (doc === undefined ? null : firstRect(doc, selectors)),
        rectOfAnchor: rectOfAnchor,
        anchorOfDevice: (id) => bridge.anchorOfDevice(id),
        anchorOfPort: (ref) => bridge.anchorOfPort(ref),
        anchorOfControl: (i, c) => bridge.anchorOfControl(i, c),
        helperUnlocked: deps.helperUnlocked?.() === true,
        helperOffered: deps.helperOffered?.() === true,
        reveal,
      })
      // undefined: not the tutorial's to answer here (nav:ecoute while the bench can play): the bridge's shell anchor, as before
      if (r !== undefined) return r
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
  if (!guideRouteAllowed(deps.search, deps.route, deps.features ?? FEATURES)) return null
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

    const legacy = deps.route === 'legacy'
    const brain = createTekPracticeBrain({ bridge, rules: ruleRowsFor(legacy ? 'legacy' : 'creation', registry.catalog.rules as unknown as readonly RuleRow[]), mode, route: legacy ? 'legacy' : 'creation' })
    // The controller reads these two lists by reference at every call: the mount keeps them in the order of the bench's stage (see flows.creation.ts).
    // Level play has its own two flows (the order follows the required connections made).
    // The tutorial (under `?design` only) is always the last flow: a running or restored tutorial is always found, the path keeps its order before it.
    const tutorial = legacy ? null : tutorialFlowFor(deps.search, registry)
    const own = tutorial === null ? [] : [tutorial]
    // Start / resume / skip on the onboarding request, the guide record, « déjà en place » (plan T3.2): it hands the controller the storage it observes.
    let late: (input: ControllerInput) => void = () => {}
    // The new Oscar (plan T5.3 to T5.5, controller ruling 4): only under `?design` in Mode Création. Its skin is attached once the widget is built.
    const pkg = legacy ? null : activePackage(deps.search)
    let skin: Skin | null = null
    // A step done nods: the tutorial's record goes to the next step of the same run (or ends). A step passed with the bubble's skip chip does not.
    let run: { status: string; k: number } | null = null
    let skipping = false
    let runtimeRef: { record(): { status: string; k: number } } | null = null
    const nodOnStep = (): void => {
      const now = runtimeRef?.record()
      if (now === undefined) return
      const done = stepAdvanced(run, now)
      run = { status: now.status, k: now.k }
      if (done && !skipping) skin?.play('nod')
      skipping = false // the flag covers the one tutorial change that follows the click, whatever it was (round 1, N1)
    }
    // `emit`: the power helper's gate in Mode Création (`tekpractice:tutorial`, plan T3.3); creation listens with and without the guide.
    const emit = (detail: TutorialDetail): void =>
      guard(() => {
        if (typeof win.dispatchEvent === 'function' && typeof CustomEvent === 'function') win.dispatchEvent(new CustomEvent(TUTORIAL_EVENT, { detail }))
        nodOnStep()
      })
    // The step card follows the record: the runtime tells it after every write (never throws into the tutorial).
    // set by `destroy`: after it nothing of the mount acts (an exam address turning live tears everything down; a later poll or record write must not rebuild the card, C1)
    let destroyed = false
    let card: StepCard | null = null
    // G14c fix (b): the device the step points at, for Mode Création to bring into view (`tekpractice:tutorial-focus`)
    const focus = (instance: string | null): void =>
      guard(() => {
        if (typeof win.dispatchEvent === 'function' && typeof CustomEvent === 'function') win.dispatchEvent(new CustomEvent(TUTORIAL_FOCUS_EVENT, { detail: { instance } }))
      })
    const runtime = tutorial === null ? null : createTutorialRuntime({ flow: tutorial, registry, storage: deps.storage, now, send: (i) => late(i), emit, focus, onRecord: () => guard(() => {
        if (!destroyed) card?.update()
      }) })
    runtimeRef = runtime
    if (runtime !== null && tutorial !== null && pkg !== null) {
      // The closing lines say what the bench is NOW: with the mic verdict unknown only the pinned simulation sentence is shown, never a claim about the mic.
      const closing = (): string[] => {
        const mic = bridge.mic?.() ?? null
        return mic === null ? [COPY.listen?.simple ?? ''].filter((x) => x !== '') : closingLines(mic)
      }
      guard(() => {
        card = (impl.mountStepCard ?? mountStepCard)({
          doc,
          steps: tutorial.steps.map((st) => st.id as StepId),
          presenter: pkg.presenter,
          record: () => runtime.record(),
          closing,
          skip: () => runtime.skip(),
        })
      })
      cleanups.push(() => card?.destroy())
    }
    if (runtime !== null) run = { status: runtime.record().status, k: runtime.record().k }
    // T5.5: Oscar starts muted for package 4 (`proactive: false`) and for the sound engineer, only while nothing is stored under the mute key: the
    // controller reads that key once, at its creation, through this storage; a stored choice (an unmute is « 0 ») always wins. No `?design`: untouched.
    const profileNow = (): string | null => {
      try {
        return bridge.profile?.() ?? null
      } catch {
        return null
      }
    }
    const controllerStorage = runtime === null ? null : pkg === null ? runtime.storage : muteDefaultStorage(runtime.storage, () => quietByDefault(pkg, profileNow()))
    const flows = legacy ? legacyFlowsFor(null).slice() : [...flowsFor('no-place'), ...own]
    const keywords = legacy ? legacyKeywords() : keywordsFor('no-place')
    const follow = (state: TpState | null): void => {
      if (legacy) {
        flows.splice(0, flows.length, ...legacyFlowsFor(state))
        return
      }
      const stage = benchStage(state, registry)
      flows.splice(0, flows.length, ...flowsFor(stage), ...own)
      keywords.splice(0, keywords.length, ...keywordsFor(stage))
    }
    const controller = impl.createController({
      brain,
      flows,
      clock: now,
      ...(controllerStorage ? { storage: controllerStorage } : deps.storage ? { storage: deps.storage } : {}),
      strings: legacy ? LEGACY_STRINGS : CREATION_STRINGS,
      flowKeywords: keywords,
      ...(legacy ? { storageKey: legacyStorageKey(deps.search) } : {}),
    })
    const helperUnlocked = (): boolean => {
      const r = runtime?.record()
      return r !== undefined && r.status === 'running' && r.helper
    }
    const designCorner = legacy ? null : (activePackage(deps.search)?.layout.oscarCorner ?? null)
    const rects = createRectResolver({ bridge, registry, now, route: deps.route, doc, helperUnlocked, helperOffered: () => bridge.helper?.()?.offered === true })
    cleanups.push(() => rects.clear())
    // The widget holds text (the keyboard hint, the bubble) that must sit inside a landmark; it gets one of its own, a child of <body> so that a modal's
    // `inert` on the body's other children still covers it. The landmark has no box of its own (the widget is fixed-positioned).
    const landmark = doc.createElement('aside')
    landmark.setAttribute('aria-label', tpString('landmark'))
    doc.body.appendChild(landmark)
    cleanups.push(() => landmark.remove())
    // A design package starts Oscar in its own corner (never top left: the view cube sits there); a corner the learner chose wins (plan T4.3).
    const uiStorage = designCorner === null ? deps.storage : cornerDefaultStorage(deps.storage, UI_STORAGE_KEY, designCorner)
    const handle = impl.mountGuide({
      controller,
      getRect: rects.getRect,
      root: landmark,
      insets: () => hostInsets(doc),
      // the page's controls (cached), then, while the tutorial runs, the body of the device the step points at, a margin around it and the view's centre (G14b, ADR 0021)
      obstacles: createGuideObstacles({
        doc,
        now,
        targets: () => viewTargets(controller.getView?.()),
        guide: landmark,
        bodies: () => bridge.bodyRects?.() ?? [],
        home: () => loadCorner(uiStorage, UI_STORAGE_KEY),
        // only while the tutorial runs (spec 11.3 is the tutorial's geometry): the guide's other flows, the plain address and the level page place as before
        active: () => runtime?.record().status === 'running',
      }),
      zIndex: GUIDE_Z_INDEX,
      context: { page: 'workbench', mode: mode() },
      storage: uiStorage,
    })
    cleanups.push(() => handle.destroy())
    if (skinAllowed(deps.search, deps.route)) {
      // The character on the vendored icon (T5.3), the badge in the bubble header (T5.4). A failure here leaves the vendored mascot (one warning).
      guard(() => {
        const Observer = (win as { MutationObserver?: typeof MutationObserver }).MutationObserver ?? (typeof MutationObserver === 'function' ? MutationObserver : undefined)
        skin = (impl.attachSkin ?? attachSkin)(landmark, { doc, Observer, badge: COPY.oscar?.badge ?? '' })
      })
      // pushed after the widget's: torn down before it, while the vendored nodes it observes are still there
      cleanups.push(() => skin?.destroy())
    }

    const destroy = (): void => {
      if (destroyed) return
      destroyed = true
      teardown()
    }
    const send = (input: Parameters<typeof handle.send>[0]): void =>
      guard(() => {
        if (destroyed) return
        const p = handle.send(input)
        if (p !== undefined && typeof p.catch === 'function') p.catch(warn)
      })
    const hostEvent = (e: HostEvent): void => send({ type: 'hostEvent', event: e })
    late = send
    const tutorialLook = (state: TpState | null): void =>
      guard(() => {
        if (destroyed) return
        runtime?.update({ state, audio: bridge.playing?.() ?? null, request: bridge.tutorialRequest?.() ?? null, helper: bridge.helper?.() ?? null })
        card?.update() // the closing lines follow the bench; a record that did not change is a no-op
      })

    let revision = 0
    // The mode is read live. When the address turns to an exam one the controller is told first (it withholds everything), then the whole mount is torn down:
    // the icon, the landmark, the bridge and the page listeners go, nothing of the guide is left on an exam page.
    const tell = (state: TpState | null): void => {
      const live = mode()
      send({ type: 'setContext', context: { mode: live, setup: setupFor(state, revision) } })
      if (live !== 'practice') destroy()
    }

    // A cable, a device, a place or a switch changed: the context first, then the events of the change. A sound starting in Écoute is not a change of
    // the bench: without the tutorial it is dropped (and a poll that brought only that tells the controller nothing, as before).
    let before: TpState | null = null
    // The new Oscar's host states (spec 10.2): the first accepted connection and the first sound of this page celebrate, a refused one shrugs, a later one nods.
    let seen: Celebrations = { connected: false, sounded: false }
    // T5.5, the profile chosen after the mount (the start screen is up when the guide arrives): the engineer's Oscar is muted then, once, if nothing is stored
    // and the bubble is closed (mute, then close: the vendored mute confirms in a bubble, closed again before it is painted). An open bubble (a tutorial taken
    // at the same moment) is left alone: the next mount applies the default.
    let lateQuietDone = false
    const lateQuiet = (): void => {
      if (lateQuietDone || runtime === null || pkg === null || !quietByDefault(pkg, profileNow())) return
      lateQuietDone = true
      if (runtime.storage.getItem(GUIDE_MUTE_KEY) !== null) return
      const v = controller.getView?.() as { muted?: unknown; bubble?: unknown } | undefined
      if (v === undefined || v === null || v.muted !== false || v.bubble !== null) return
      send({ type: 'chip', id: 'mute' })
      send({ type: 'chip', id: 'close' })
      // Round 1, S1: the vendored mute stored « 1 » under the one key every address reads (no package scope). It is taken back at once: this page stays muted
      // (the controller keeps it in memory, and a later unmute still stores « 0 »), and the next mount derives the default from the profile again, so the
      // plain address and a profile changed through the chip are not left muted.
      runtime.storage.removeItem(GUIDE_MUTE_KEY)
    }
    const unsubscribe = bridge.onChange((state, events) =>
      guard(() => {
        if (skin !== null) {
          const h = hostEventFor(events, seen)
          seen = h.seen
          if (h.event !== null) skin.play(h.event)
          if (seen.connected && seen.sounded) skin.setCelebrationsSpent(true)
        }
        if (events.some((e) => e.type === PROFILE_CHOSEN)) lateQuiet()
        const list = events.filter((e) => e.type !== TUTORIAL_REQUEST && e.type !== CONNECT_REFUSED && e.type !== PROFILE_CHOSEN && e.type !== APP_CHANGE && (tutorial !== null || e.type !== PLAY_STARTED))
        // T6 review S3: an app change that swaps devices (a template or model load, the undo of one, a project reopened: `appChange` with `deviceAdded`) is not the learner doing the steps. The
        // controller hears none of its bench events (the removal of a whole model would otherwise tick « debrancher »); the runtime still sees the new bench, and a step whose result is
        // on it completes as « déjà en place ». An app change of one cable (the undo of an unplug) is delivered as before.
        const swap = events.some((e) => e.type === APP_CHANGE) && events.some((e) => e.type === 'deviceAdded')
        const toSend = swap ? list.filter((e) => !BENCH_EVENTS.has(e.type)) : list
        if (list.length === 0 && events.length > 0) {
          tutorialLook(state) // only the request went up: no change of the bench to tell the controller
          return
        }
        const prev = before
        before = state
        revision++
        rects.clear()
        follow(state)
        tell(state)
        guard(() => runtime?.look({ state, audio: bridge.playing?.() ?? null })) // G14c W1: the step sentences read the new bench before its events move the controller
        for (const e of collapseRestore(toSend)) {
          const marked = annotateToggle(e, state, bridge)
          const out = tutorial === null ? marked : annotateTutorialEvent(marked, { state, prev, bridge, registry })
          runtime?.sawEvent(out) // T6.1: what tells a step done by its event from a step passed
          hostEvent(out)
        }
        tutorialLook(state)
      }),
    )
    cleanups.push(unsubscribe)

    // The bench as it is now (a restored project is already there when the guide arrives).
    guard(() => {
      const state = bridge.snapshot()
      before = state
      follow(state)
      tell(state)
      tutorialLook(state)
    })

    // « Lire la barre d’état »: a `read` step has no change of the bench to wait for, so a click inside the status bar is the learner reading it. On the level page it is
    // the objectives card.
    const statusSelector = legacy ? LEGACY_ACK_SELECTOR : NAV_SELECTORS[NAV_STATUS][0]
    const ackAnchor = legacy ? LEGACY_NAV_OBJECTIVES : NAV_STATUS
    const onClick = (e: Event): void =>
      guard(() => {
        const target = e.target as { closest?: (selector: string) => unknown } | null
        if (target && typeof target.closest === 'function' && target.closest(statusSelector)) hostEvent({ type: ACKNOWLEDGE, at: now(), data: { anchor: ackAnchor } })
        // the same capture listener (no new one): a step passed with the bubble's chip is not nodded (the chip's own click runs after this one)
        if (skin !== null && target && typeof target.closest === 'function' && target.closest(SKIP_CHIP) && runtime?.record().status === 'running') skipping = true
      })
    doc.addEventListener('click', onClick, true)
    cleanups.push(() => doc.removeEventListener('click', onClick, true))

    return { destroy }
  } catch (e) {
    warn(e)
    teardown()
    return null
  }
}
