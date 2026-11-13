/**
 * The new Oscar on the vendored widget (plan T5.3 to T5.5, spec 10.1 to 10.3): a host-side skin, no vendor edit.
 *
 * Scope (controller ruling 4): only in Mode Création under `?design=1..5` (the same address that applies a package's look); the plain address, the
 * legacy route, exams and `?oscar=0` keep what they had (the vendored mascot, or no Oscar at all). Whether the plain address adopts the new Oscar once
 * a package is chosen is the founder's call.
 *
 * The seam (verified against the vendored files; tests/guide/mount.test.ts pins every name):
 *  - the HOST CLASS goes on the `.oscar-guide` root (controller ruling 1): the vendored ring is a sibling of the icon, under the root;
 *  - the character svg is appended to `.oscar-icon`; theme.css hides `svg.oscar-mascot` under the host class and makes the icon's round background
 *    transparent (the character's own Prune coin is the visual, controller ruling 3);
 *  - ONE MutationObserver, attributes only (controller ruling 2, no event listener): `data-state` on `svg.oscar-mascot` (where the vendored
 *    `setState` writes it), `style` / `hidden` on the main ring and `style` on the icon wrap (the bearing, ruling 5), `aria-expanded` on the icon
 *    (the first open waves);
 *  - the « Oscar · Assistant » badge is a host span inserted right after `.oscar-title` in `.oscar-header` (ruling 6); the icon's accessible name is
 *    the vendored one, untouched.
 * If any vendored part is missing (a re-vendor renamed it), nothing is attached and the vendored mascot stays as it is.
 *
 * Pure pieces (node-tested): `skinAllowed`, `dirFor`, `hostEventFor`, `stepAdvanced`, `quietByDefault`, `muteDefaultStorage`.
 */
import { activePackage, type DesignPackage } from '../design/packages'
import { PROFILE_IDS } from '../creation/onboarding/state'
import { profileById } from '../creation/onboarding/profiles'
import { HOST_CLASS, createCharacter, type Character, type CharacterTimers, type Dir, type HostEvent } from './character'
import type { GuideRoute } from './mode'
import { DEFAULT_STORAGE_KEY } from './vendor/core/controller'
import type { Rect } from './vendor/core/types'

/** The vendored names the skin reads (pinned in tests/guide/mount.test.ts against the vendored sources). */
export const SKIN = Object.freeze({
  root: '.oscar-guide',
  iconWrap: '.oscar-icon-wrap',
  icon: '.oscar-icon',
  mascot: 'svg.oscar-mascot',
  ring: '.oscar-ring:not(.oscar-ring-drop)',
  header: '.oscar-header',
  title: '.oscar-title',
})
/** The attribute the vendored mascot writes its state to. */
export const VENDOR_STATE_ATTR = 'data-state'
export const BADGE_CLASS = 'tp-oscar-badge'

/** Host events of the bridge that are the skin's only: never forwarded to the vendored controller. */
export const CONNECT_REFUSED = 'connectRefused'
export const PROFILE_CHOSEN = 'profileChosen'

/** Controller ruling 4: Mode Création under a valid `?design` (the exam, `?oscar=0` and flag gates are mountOscar's, before this). */
export function skinAllowed(search: string, route: GuideRoute): boolean {
  return route === 'creation' && activePackage(search) !== null
}

/** Where the ring is seen from the icon, on four axes (the larger component wins, a tie goes horizontal); null when there is no bearing. */
export function dirFor(icon: Rect, ring: Rect): Dir | null {
  const dx = ring.x + ring.w / 2 - (icon.x + icon.w / 2)
  const dy = ring.y + ring.h / 2 - (icon.y + icon.h / 2)
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return null
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'east' : 'west'
  return dy > 0 ? 'south' : 'north'
}

/** What has been celebrated in this session (one page: a mount). */
export interface Celebrations {
  connected: boolean
  sounded: boolean
}
/** More `deviceAdded` than this in one change is a restore (mount.ts RESTORE_BURST): its cables are not the learner's. */
const RESTORE_BURST = 3

/**
 * The host state one change of the bench plays (spec 10.2, celebrate sparingly): the first accepted connection and the first sound of the session
 * celebrate, a refused connection shrugs, a later accepted connection nods. One state per change, in that order of precedence.
 */
export function hostEventFor(events: readonly { type: string }[], seen: Celebrations): { event: HostEvent | null; seen: Celebrations } {
  if (events.filter((e) => e.type === 'deviceAdded').length > RESTORE_BURST) return { event: null, seen }
  const connected = events.some((e) => e.type === 'connect')
  const sounded = events.some((e) => e.type === 'playStarted')
  const refused = events.some((e) => e.type === CONNECT_REFUSED)
  const next: Celebrations = { connected: seen.connected || connected, sounded: seen.sounded || sounded }
  if ((connected && !seen.connected) || (sounded && !seen.sounded)) return { event: 'celebrate', seen: next }
  if (refused) return { event: 'shrug', seen: next }
  if (connected) return { event: 'nod', seen: next }
  return { event: null, seen: next }
}

/** A step of the tutorial was done: the next step of the same run, or its end. A start, a restart, a whole skip or an interruption is not. */
export function stepAdvanced(prev: { status: string; k: number } | null, next: { status: string; k: number }): boolean {
  if (prev === null || prev.status !== 'running') return false
  return (next.status === 'running' && next.k === prev.k + 1) || next.status === 'done'
}

/** T5.5: Oscar starts muted on the package's word (`oscar.proactive: false`, package 4) or for the sound engineer (profile `oscarProactive: false`). */
export function quietByDefault(pkg: DesignPackage | null, profile: unknown): boolean {
  if (pkg === null) return false
  if (!pkg.oscar.proactive) return true
  return typeof profile === 'string' && (PROFILE_IDS as readonly string[]).includes(profile) && !profileById(profile as (typeof PROFILE_IDS)[number]).oscarProactive
}

/** The key the vendored controller reads its mute from: `storageKey + ".muted"` (vendor core/controller.ts, MUTE_SUFFIX; pinned). */
export const GUIDE_MUTE_KEY = `${DEFAULT_STORAGE_KEY}.muted`

type StorageLike = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem?(k: string): void }
/**
 * The controller's storage with the mute DEFAULT (T5.5): while nothing is stored under the mute key, a read says « 1 » when `quiet()` says so. The
 * controller reads it once (at its creation) and writes the key only when the learner changes it, so the default is never stored by itself, and a
 * stored choice (« 0 » after an unmute) always wins.
 */
export function muteDefaultStorage(base: StorageLike, quiet: () => boolean): Required<StorageLike> {
  return {
    getItem(k) {
      const v = base.getItem(k)
      return v === null && k === GUIDE_MUTE_KEY && quiet() ? '1' : v
    },
    setItem: (k, v) => base.setItem(k, v),
    removeItem: (k) => base.removeItem?.(k),
  }
}

// ── the live skin ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Skin {
  readonly character: Character
  /** A host state (nod, wave, celebrate, shrug), drawn for its duration over the controller's state. */
  play(event: HostEvent): void
  destroy(): void
}
export interface SkinDeps {
  doc: Document
  /** The page's MutationObserver (absent: no skin). */
  Observer: typeof MutationObserver | undefined
  /** The badge text (COPY oscar.badge). */
  badge: string
  timers?: CharacterTimers
}

const rectOf = (el: Element): Rect | null => {
  const b = el.getBoundingClientRect()
  return { x: b.left, y: b.top, w: b.width, h: b.height }
}

/** Attaches the character to the vendored widget under `landmark`, or returns null (nothing touched) when a vendored part is missing. */
export function attachSkin(landmark: ParentNode, deps: SkinDeps): Skin | null {
  const Observer = deps.Observer
  if (typeof Observer !== 'function') return null
  const root = landmark.querySelector(SKIN.root)
  const iconWrap = root?.querySelector(SKIN.iconWrap) ?? null
  const icon = root?.querySelector(SKIN.icon) ?? null
  const mascot = root?.querySelector(SKIN.mascot) ?? null
  const ring = root?.querySelector(SKIN.ring) ?? null
  const header = root?.querySelector(SKIN.header) ?? null
  const title = header?.querySelector(SKIN.title) ?? null
  if (!root || !iconWrap || !icon || !mascot || !ring || !header || !title) return null

  const character = createCharacter(deps.doc, deps.timers ? { timers: deps.timers } : {})
  const badge = deps.doc.createElement('span')
  badge.classList.add(BADGE_CLASS)
  badge.textContent = deps.badge
  root.classList.add(HOST_CLASS)
  icon.appendChild(character.svg)
  header.insertBefore(badge, title.nextSibling)

  let waved = false
  const point = (): void => {
    if ((ring as HTMLElement).hidden) return
    const a = rectOf(icon)
    const b = rectOf(ring)
    const d = a === null || b === null ? null : dirFor(a, b)
    if (d !== null) character.setDir(d)
  }
  const opened = (): void => {
    if (waved || icon.getAttribute('aria-expanded') !== 'true') return
    waved = true
    character.play('wave')
  }
  const observer = new Observer((records) => {
    try {
      let state = false
      let open = false
      for (const r of records) {
        if (r.attributeName === VENDOR_STATE_ATTR) state = true
        else if (r.attributeName === 'aria-expanded') open = true
      }
      if (state) character.setState(mascot.getAttribute(VENDOR_STATE_ATTR))
      point()
      if (open) opened()
    } catch {
      // the page goes on; the character keeps its last pose
    }
  })
  observer.observe(mascot, { attributes: true, attributeFilter: [VENDOR_STATE_ATTR] })
  observer.observe(ring, { attributes: true, attributeFilter: ['style', 'hidden'] })
  observer.observe(iconWrap, { attributes: true, attributeFilter: ['style'] })
  observer.observe(icon, { attributes: true, attributeFilter: ['aria-expanded'] })
  character.setState(mascot.getAttribute(VENDOR_STATE_ATTR))
  point()
  opened()

  let destroyed = false
  return {
    character,
    play: (event) => {
      if (!destroyed) character.play(event)
    },
    destroy: () => {
      if (destroyed) return
      destroyed = true
      observer.disconnect()
      character.destroy()
      badge.remove()
      root.classList.remove(HOST_CLASS)
    },
  }
}
