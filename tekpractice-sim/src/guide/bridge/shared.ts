// What the two bridges (Mode Création and the legacy level page) have in common: the poll period, the document the bridge listens to, the state hash and
// the shell selectors of Mode Création. It imports nothing of the app, so a page that mounts one bridge does not load the other.
import type { TpPortRef, TpState } from './types'

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
export const POLL_MS = 500

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

export const SEP = '\u0000'
export const refKey = (r: TpPortRef): string => `${r.instance}${SEP}${r.port}`
export const cableKey = (a: TpPortRef, b: TpPortRef): string => [refKey(a), refKey(b)].sort().join('\u0001')

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

