/**
 * The new Oscar (onboarding spec 10.2, plan T5.1): a host-side character, not the vendored mascot (src/guide/vendor/ui/mascot.ts, read-only).
 * THE HEADPHONES ARE THE CHARACTER: an Ambre headband (stroke 5, square caps) over a Papier head disc (r 15), two Ambre cups 14 x 22 (rx 3),
 * a Nuit outline 3 on head and cups, all on a Prune coin that the band and the cups break out of by 4 units. One arm with a square hand, a
 * standby LED, upright pill eyes, a mouth only to shrug (flat) and to celebrate (short open smile). Colours: the brand tokens
 * (src/design/creationTokens.ts); Ambre sits on Prune (4.24, a UI boundary) or on Nuit, never on Papier: the band has a Nuit casing, so on a
 * Papier ground it is still edged in Nuit.
 *
 * Three parts:
 *  - construction: DOM calls only (createElementNS + setAttribute + appendChild), through the document it is given; no markup string, no
 *    raster, no data URI. The svg is decorative (aria-hidden): the vendored icon button keeps its accessible name.
 *  - the pure mapping `stateFor(vendorState, hostEvent)` and the pure timer plan `step(model, action)` (tested in node).
 *  - the live object `createCharacter(doc, opts)`: `{ svg, state, setState, play, setDir, destroy }`. The host (plan T5.3) appends `svg` to
 *    `.oscar-icon`, mirrors the vendored `data-state` of `svg.oscar-mascot` into `setState`, sets `data-dir` from the ring bearing with `setDir`,
 *    calls `play(...)` for the host states (src/guide/skin.ts and mount.ts do all this), puts HOST_CLASS on the `.oscar-guide` root (character.css stops the vendored
 *    loops under it) and calls `destroy()` on unmount.
 *
 * The motion is in character.css (every animation finite); this file only says which pose is drawn.
 */
import type { MascotState } from './vendor/core/types'
import { CREATION_TOKENS } from '../design/creationTokens'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** The svg's class; every selector of character.css starts from it. Not `oscar-mascot` (the vendored rules and the T5.3 hide rule target that one). */
export const CHARACTER_CLASS = 'tpo'
/** The class the host puts on the vendored `.oscar-guide` root: under it character.css makes the vendored ring pulse finite and stops the vendored mascot's loops. */
export const HOST_CLASS = 'tp-oscar-host'

/** The seven states the vendored controller emits (MASCOT_STATES of vendor/ui/mascot.ts; a test pins the two lists equal). */
export const VENDOR_STATES = ['idle', 'walk', 'point', 'think', 'celebrate', 'no', 'sleep'] as const satisfies readonly MascotState[]
export type VendorState = (typeof VENDOR_STATES)[number]

/**
 * Host states: a step done or a later accepted connection (nod), the first open in a session (wave), the first accepted connection and the first
 * sound of a session (celebrate, spec 10.2 « celebrate sparingly »), a refused connection (shrug: the vendored controller has no state for it, plan
 * T5.3). They last at most HOST_EVENT_MS (the timing sheet's durations), then the controller's state comes back.
 */
export const HOST_EVENTS = ['nod', 'wave', 'celebrate', 'shrug'] as const
export type HostEvent = (typeof HOST_EVENTS)[number]
export const HOST_EVENT_MS: Readonly<Record<HostEvent, number>> = Object.freeze({ nod: 600, wave: 1200, celebrate: 1000, shrug: 700 })
/** A running host state is replaced only by one of the same or a higher rank: a nod that lands a moment after a celebration does not cut it. */
const HOST_RANK: Readonly<Record<HostEvent, number>> = Object.freeze({ wave: 0, nod: 1, shrug: 2, celebrate: 3 })

/** The nine drawn states of the timing sheet (spec 10.2). The vendored `no` is drawn as `shrug`. */
export const CHARACTER_STATES = ['idle', 'walk', 'point', 'think', 'celebrate', 'shrug', 'nod', 'wave', 'sleep'] as const
export type CharacterState = (typeof CHARACTER_STATES)[number]

/** Where the ring is, seen from the icon (the host computes it, T5.3). West mirrors the arm. */
export const DIRS = ['east', 'west', 'north', 'south'] as const
export type Dir = (typeof DIRS)[number]
/** The mirror about the vertical axis x = 32 of the 64-unit viewBox, written as the arm group's `transform` attribute (CSS only rotates the inner pose group). */
export const ARM_MIRROR = 'matrix(-1 0 0 1 64 0)'

/** Vendored states that outrank a host state: the controller's feedback (celebrate, no) and a sleeping guide are never covered by a nod or a wave. */
const OUTRANKS: readonly VendorState[] = ['celebrate', 'no', 'sleep']

const isVendorState = (v: unknown): v is VendorState => typeof v === 'string' && (VENDOR_STATES as readonly string[]).includes(v)
const isHostEvent = (v: unknown): v is HostEvent => typeof v === 'string' && (HOST_EVENTS as readonly string[]).includes(v)
const isDir = (v: unknown): v is Dir => typeof v === 'string' && (DIRS as readonly string[]).includes(v)

/** Any value the vendored attribute could hold -> a vendored state; anything unknown is idle (like the vendored `setState`). */
export function toVendorState(v: unknown): VendorState {
  return isVendorState(v) ? v : 'idle'
}

/** The drawn state for the controller's state and the running host event (null = none). Pure. */
export function stateFor(vendorState: unknown, hostEvent: HostEvent | null): CharacterState {
  const v = toVendorState(vendorState)
  if (hostEvent !== null && isHostEvent(hostEvent) && !OUTRANKS.includes(v)) return hostEvent
  return v === 'no' ? 'shrug' : v
}

export interface CharacterModel {
  /** The controller's last state (kept while a host state runs, shown again when it ends). */
  vendor: VendorState
  host: HostEvent | null
}
export type CharacterAction = { type: 'vendor'; state: unknown } | { type: 'host'; event: HostEvent } | { type: 'hostEnd' }
/** What the live object must do with its single timer: start one of `ms` (replacing any running one), clear it, or nothing. */
export type TimerOp = { kind: 'start'; ms: number } | { kind: 'clear' } | null

export const initialModel = (): CharacterModel => ({ vendor: 'idle', host: null })

/** The timer plan, pure: the next model and the timer operation an action needs. */
export function step(model: CharacterModel, action: CharacterAction): { model: CharacterModel; timer: TimerOp } {
  switch (action.type) {
    case 'vendor': {
      const vendor = toVendorState(action.state)
      if (model.host !== null && OUTRANKS.includes(vendor)) return { model: { vendor, host: null }, timer: { kind: 'clear' } }
      return { model: { vendor, host: model.host }, timer: null }
    }
    case 'host': {
      if (!isHostEvent(action.event) || OUTRANKS.includes(model.vendor)) return { model, timer: null }
      if (model.host !== null && HOST_RANK[action.event] < HOST_RANK[model.host]) return { model, timer: null }
      return { model: { vendor: model.vendor, host: action.event }, timer: { kind: 'start', ms: HOST_EVENT_MS[action.event] } }
    }
    case 'hostEnd':
      return { model: { vendor: model.vendor, host: null }, timer: null }
  }
}

/** The arm group's `transform` attribute for a direction: the mirror for west, none otherwise. */
export function armTransformFor(dir: Dir): string | null {
  return dir === 'west' ? ARM_MIRROR : null
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Construction. Every number is in the 64 x 64 viewBox; the geometry is pinned by tests/guide/character.test.ts against the brief.

const C = CREATION_TOKENS.color
/**
 * The coin sits 2 units lower than the head, so it shows as a Prune plinth under the chin; the band and the cups break out of it by 4.
 * Coin r 22: the cups (14 wide, outer edges 4 past the coin) cover only 3 units of each side of the head, the face keeps 24 of its 30 units.
 */
const COIN = { cx: 32, cy: 38, r: 22 }
const HEAD = { cx: 32, cy: 36, r: 15 }
/** The band's centre line: an elliptic arch from the top of one cup to the other, apex 14.5 (outer edge 12 = coin top 16 - 4 = head top 21 - 9). */
const BAND_APEX_Y = 14.5
const BAND_D = 'M13 29 V26.5 A19 12 0 0 1 51 26.5 V29'
const CUP = { w: 14, h: 22, rx: 3, y: 26, left: 6, right: 44 }
/** Shoulder on the plinth just under the right cup (the arm comes out from under it); the pose group turns about it (character.css). Hand centre ARM_LEN east of it. */
const SHOULDER = { x: 50, y: 50 }
const ARM_LEN = 11
const HAND = 8
/** On the coin's plinth under the chin, clear of the head disc and its outline. */
const LED = { cx: 32, cy: 55.6, r: 2 }

export interface CharacterTimers {
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(id: unknown): void
}
export interface CharacterOptions {
  /** Injected timers (tests); the default reads globalThis at call time. */
  timers?: CharacterTimers
}
export interface Character {
  readonly svg: SVGSVGElement
  /** The drawn state now. */
  state(): CharacterState
  /** The controller's state (the vendored `data-state` value): `no` is drawn as shrug. */
  setState(vendorState: unknown): void
  /** A host state for at most its duration (nod 600 ms, wave 1 200 ms, celebrate 1 000 ms, shrug 700 ms). */
  play(event: HostEvent): void
  setDir(dir: unknown): void
  /** Clears the timer and takes the svg out of its parent; later calls do nothing. */
  destroy(): void
}

const defaultTimers: CharacterTimers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
}

type Attrs = Record<string, string | number>

function el(doc: Pick<Document, 'createElementNS'>, parent: Element | null, tag: string, attrs: Attrs): Element {
  const node = doc.createElementNS(SVG_NS, tag)
  for (const k of Object.keys(attrs)) node.setAttribute(k, String(attrs[k]))
  if (parent !== null) parent.appendChild(node)
  return node
}

/** The svg, built by DOM calls only. Drawing order: coin, head, headphones (band then cups over the head's sides), arm (in front of its cup), led, thought dots. */
export function buildCharacterSvg(doc: Pick<Document, 'createElementNS'>): { svg: SVGSVGElement; arm: Element } {
  const line = { stroke: C.nuit, 'stroke-width': 3 }
  const svg = el(doc, null, 'svg', {
    viewBox: '0 0 64 64',
    class: CHARACTER_CLASS,
    'aria-hidden': 'true',
    focusable: 'false',
    overflow: 'visible',
    'data-state': 'idle',
    'data-dir': 'east',
  })
  // The figure (coin + body) dims as ONE layer in sleep, so the coin never shows through the head; the LED stays outside it, at full strength.
  const figure = el(doc, svg, 'g', { class: 'tpo-figure' })
  el(doc, figure, 'circle', { 'data-part': 'coin', class: 'tpo-coin', cx: COIN.cx, cy: COIN.cy, r: COIN.r, fill: C.prune })

  const body = el(doc, figure, 'g', { class: 'tpo-body' })
  const tilt = el(doc, body, 'g', { class: 'tpo-tilt' })

  const head = el(doc, tilt, 'g', { 'data-part': 'head', class: 'tpo-head' })
  el(doc, head, 'circle', { class: 'tpo-disc', cx: HEAD.cx, cy: HEAD.cy, r: HEAD.r, fill: C.papier, ...line })
  const eyes = el(doc, head, 'g', { class: 'tpo-eyes' })
  // Upright pills, set a hair to the east of centre and low on the face: the gaze goes where the arm points.
  el(doc, eyes, 'rect', { 'data-part': 'eye', class: 'tpo-eye', x: 26, y: 34.5, width: 4, height: 7, rx: 2, fill: C.nuit })
  el(doc, eyes, 'rect', { 'data-part': 'eye', class: 'tpo-eye', x: 35, y: 34.5, width: 4, height: 7, rx: 2, fill: C.nuit })
  const lids = el(doc, head, 'g', { 'data-part': 'lids', class: 'tpo-lids' })
  const lid = { fill: 'none', stroke: C.nuit, 'stroke-width': 2, 'stroke-linecap': 'square' }
  el(doc, lids, 'path', { d: 'M25.5 39 q2.5 2 5 0', ...lid })
  el(doc, lids, 'path', { d: 'M34.5 39 q2.5 2 5 0', ...lid })
  el(doc, head, 'path', { 'data-part': 'mouth-flat', class: 'tpo-mouth-flat', d: 'M29.5 45 h5', ...lid })
  el(doc, head, 'path', { 'data-part': 'mouth-smile', class: 'tpo-mouth-smile', d: 'M29 44 h6 a3 3 0 0 1 -6 0 z', fill: C.nuit })

  const cups = el(doc, tilt, 'g', { 'data-part': 'cups', class: 'tpo-cups' })
  // The band: a Nuit casing (8 = 5 + an outline of 1.5 each side) under the Ambre stroke, so Ambre never touches a Papier ground.
  el(doc, cups, 'path', { class: 'tpo-band-casing', d: BAND_D, fill: 'none', stroke: C.nuit, 'stroke-width': 8, 'stroke-linecap': 'square' })
  el(doc, cups, 'path', {
    'data-part': 'band',
    class: 'tpo-band',
    d: BAND_D,
    'data-apex-y': BAND_APEX_Y,
    fill: 'none',
    stroke: C.ambre,
    'stroke-width': 5,
    'stroke-linecap': 'square',
  })
  for (const x of [CUP.left, CUP.right])
    el(doc, cups, 'rect', { class: 'tpo-cup', x, y: CUP.y, width: CUP.w, height: CUP.h, rx: CUP.rx, fill: C.ambre, ...line })

  // The arm sits in FRONT of the cup it comes out of: a Papier sleeve in a Nuit casing (it reads on Ambre, Prune, Nuit and Papier alike), a
  // square hand. Outer group = the west mirror (attribute, character.ts); inner group = the pose (a CSS rotation about the shoulder).
  const arm = el(doc, body, 'g', { 'data-part': 'arm', class: 'tpo-arm' })
  const pose = el(doc, arm, 'g', { class: 'tpo-arm-pose' })
  const reach = `M${SHOULDER.x} ${SHOULDER.y} h${ARM_LEN}`
  el(doc, pose, 'path', { class: 'tpo-arm-line', d: reach, fill: 'none', stroke: C.nuit, 'stroke-width': 6, 'stroke-linecap': 'square' })
  el(doc, pose, 'path', { class: 'tpo-arm-sleeve', d: reach, fill: 'none', stroke: C.papier, 'stroke-width': 3, 'stroke-linecap': 'square' })
  el(doc, pose, 'rect', {
    'data-part': 'hand',
    class: 'tpo-hand',
    x: SHOULDER.x + ARM_LEN - HAND / 2,
    y: SHOULDER.y - HAND / 2,
    width: HAND,
    height: HAND,
    fill: C.papier,
    stroke: C.nuit,
    'stroke-width': 2,
  })

  // Standby LED: on the coin under the chin, clear of the head; full brightness while the figure dims to 70 % in sleep.
  const led = el(doc, svg, 'g', { 'data-part': 'led', class: 'tpo-led' })
  el(doc, led, 'circle', { cx: LED.cx, cy: LED.cy, r: LED.r, fill: C.ambre })

  const think = el(doc, svg, 'g', { 'data-part': 'think', class: 'tpo-think' })
  const dot = { fill: C.papier, stroke: C.nuit, 'stroke-width': 1.2 }
  el(doc, think, 'circle', { class: 'tpo-dot tpo-dot-a', cx: 50.5, cy: 10, r: 1.7, ...dot })
  el(doc, think, 'circle', { class: 'tpo-dot tpo-dot-b', cx: 55.5, cy: 6.2, r: 2.1, ...dot })
  el(doc, think, 'circle', { class: 'tpo-dot tpo-dot-c', cx: 61, cy: 2.8, r: 2.5, ...dot })

  return { svg: svg as SVGSVGElement, arm }
}

/** The live character: one svg, one model, at most one timer. */
export function createCharacter(doc: Pick<Document, 'createElementNS'>, opts: CharacterOptions = {}): Character {
  const timers = opts.timers ?? defaultTimers
  const { svg, arm } = buildCharacterSvg(doc)
  let model = initialModel()
  let timer: unknown = null
  let destroyed = false
  let dir: Dir = 'east'

  const draw = (): void => {
    const next = stateFor(model.vendor, model.host)
    if (svg.getAttribute('data-state') !== next) svg.setAttribute('data-state', next)
  }
  const clear = (): void => {
    if (timer !== null) timers.clearTimeout(timer)
    timer = null
  }
  const apply = (action: CharacterAction): void => {
    if (destroyed) return
    const r = step(model, action)
    model = r.model
    if (r.timer !== null) {
      clear()
      if (r.timer.kind === 'start')
        timer = timers.setTimeout(() => {
          timer = null
          apply({ type: 'hostEnd' })
        }, r.timer.ms)
    }
    draw()
  }

  return {
    svg,
    state: () => stateFor(model.vendor, model.host),
    setState: (vendorState) => apply({ type: 'vendor', state: vendorState }),
    play: (event) => apply({ type: 'host', event }),
    setDir: (next) => {
      if (destroyed || !isDir(next) || next === dir) return
      dir = next
      svg.setAttribute('data-dir', dir)
      const t = armTransformFor(dir)
      if (t === null) arm.removeAttribute('transform')
      else arm.setAttribute('transform', t)
    },
    destroy: () => {
      if (destroyed) return
      destroyed = true
      clear()
      svg.parentNode?.removeChild(svg)
    },
  }
}
