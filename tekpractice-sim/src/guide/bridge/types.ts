// The guide's view of the bench: one plain-data state, and the bridge that produces it. No Babylon, no DOM.
import type { Rect, HostEvent } from '../vendor/core/types'

/** The code of the first reason in level play: a required connection of the level that is not made yet. */
export const MISSING_LINK = 'missing-link'

export type TpPortRef = { instance: string; port: string }

export type TpState = {
  route: 'creation' | 'legacy'
  /** A place is on screen (the learner has chosen one). */
  placeKnown: boolean
  instances: { id: string; deviceId: string; label: string }[]
  connections: { a: TpPortRef; b: TpPortRef }[]
  controls: Record<string, Record<string, boolean | string>>
  /** The app's own rule events: id, severity and subjects only (the texts are looked up from the catalog when needed). */
  events: { ruleId: string; severity: 'error' | 'warning'; subjects: TpPortRef[] }[]
  playbackReady: boolean
  /** The first reason the signal path gives for not playing, verbatim, or null. */
  firstReason: { code: string; text_fr: string; subjects: TpPortRef[] } | null
  /** Legacy level play only: the level's own objective sentence, verbatim (absent in Mode Création). */
  objective?: string
}

export type TpBridge = {
  /** A fresh copy of the bench as it is now, or null while the app is not ready (never throws). */
  snapshot(): TpState | null
  /** Where an anchor is on the page now (CSS px), or null when it is unknown, hidden or off screen. */
  rectOf(anchor: string): Rect | null
  /** The anchor of a port; '' for a malformed ref (never throws). */
  anchorOfPort(ref: TpPortRef): string
  anchorOfDevice(id: string): string
  /** The anchor of a hands-on control (the one `toggle` events carry); '' for a malformed id. */
  anchorOfControl(instance: string, control: string): string
  /** Called on a change only (never on a poll that saw none). Returns the way to stop listening. */
  onChange(cb: (state: TpState, events: HostEvent[]) => void): () => void
  /** Stops the poll, drops every listener and the page listener. Safe to call twice. */
  destroy(): void
}
