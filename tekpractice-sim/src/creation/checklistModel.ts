/**
 * The checklist « Pourquoi je n’entends rien ? » as data (T1.3a). Pure: no DOM, no store. A read-only view over the engine's own playback
 * reasons (`PathResult.reasons`, src/flow/signalPath.ts): the text of a blocked row is that reason's `text_fr` verbatim (`COPY.playback.*`),
 * never reworded here.
 *
 * The engine decides in order and returns early: NO_SOURCE, then SOURCE_OFF, then HOST_UNPOWERED; only after those three does it walk the
 * cables and look at the speakers' supply (NO_PATH, RULE_ERROR, SPEAKER_UNPOWERED). So:
 *  - a blocked row is blocked (its reason, verbatim);
 *  - a row AFTER the first blocked one is « not yet checked »: the engine never looked there, a tick would be false;
 *  - a row before it is ticked only when the engine's own early return proves it (the source exists, Lecture console is on). The power and
 *    cable rows hold gates the engine evaluates together with the speakers, so they are ticked only when the rig can play;
 *  - when the rig can play every row is ticked and the checklist is hidden.
 */
import { COPY } from './copy'
import type { PathResult, Reason, ReasonCode } from '../flow/signalPath'

export type RowId = 'source' | 'console' | 'power' | 'cable'
/** The gate order of the engine; the rows are listed in this order. */
export const ROW_ORDER: readonly RowId[] = ['source', 'console', 'power', 'cable']
export type RowState = 'blocked' | 'unchecked' | 'ok'

/** Every ReasonCode is placed in a row (or the separate mic line): a new code fails to compile until it is. */
export const REASON_ROW: Readonly<Record<ReasonCode, RowId | 'mic'>> = {
  NO_SOURCE: 'source',
  SOURCE_OFF: 'console',
  HOST_UNPOWERED: 'power',
  SPEAKER_UNPOWERED: 'power',
  NO_PATH: 'cable',
  RULE_ERROR: 'cable',
  NO_MIC: 'mic',
}

/** Rows whose gate the engine settles BEFORE it walks the cables (early returns): safe to tick when a later row is the blocked one. */
const EARLY: ReadonlySet<RowId> = new Set<RowId>(['source', 'console'])

const LABEL_KEY: Readonly<Record<RowId, string>> = { source: 'rowSource', console: 'rowConsole', power: 'rowPower', cable: 'rowCable' }
const labelOf = (id: RowId): string => COPY.checklist![LABEL_KEY[id]]!

/** What « Aller à » does: it selects or opens, it never changes the design. */
export type GoTo = { kind: 'inventory'; tab: 'consoles' } | { kind: 'select'; instance: string }

export interface ChecklistRow {
  id: RowId
  state: RowState
  label: string
  /** The engine's reason text(s), verbatim, for a blocked row; '' otherwise. */
  detail: string
  /** Only a blocked row has a target. */
  goTo: GoTo | null
}

export interface ChecklistView {
  /** A place is open and the rig cannot play. */
  visible: boolean
  rows: ChecklistRow[]
  /** Separate from the rows: no tick, no state. `cabled` = a verified mic reaches a console mic input. */
  mic: { cabled: boolean; text: string }
}

export interface ChecklistInput {
  /** A place is open (the design has a room). */
  placeOpen: boolean
}

/** Where « Aller à » leads for a blocked row: the inventory for a missing console, else the device of the reason's first port. */
function targetOf(id: RowId, reasons: readonly Reason[]): GoTo | null {
  if (id === 'source') return { kind: 'inventory', tab: 'consoles' }
  const instance = reasons.flatMap((r) => r.subjects)[0]?.instance
  return instance === undefined ? null : { kind: 'select', instance }
}

export function checklistView(path: Pick<PathResult, 'playbackReady' | 'reasons' | 'micReasons'>, input: ChecklistInput): ChecklistView {
  const ready = path.playbackReady
  const byRow = new Map<RowId, Reason[]>()
  if (!ready)
    for (const r of path.reasons) {
      const row = REASON_ROW[r.code]
      if (row === 'mic') continue // a mic reason is not a playback reason
      byRow.set(row, [...(byRow.get(row) ?? []), r])
    }
  const firstBlocked = ROW_ORDER.findIndex((id) => byRow.has(id))
  const rows = ROW_ORDER.map((id, at): ChecklistRow => {
    const reasons = byRow.get(id)
    if (reasons) {
      const texts = [...new Set(reasons.map((r) => r.text_fr))] // two unpowered speakers say it once
      return { id, state: 'blocked', label: labelOf(id), detail: texts.join(' '), goTo: targetOf(id, reasons) }
    }
    const state: RowState = ready ? 'ok' : firstBlocked >= 0 && at < firstBlocked && EARLY.has(id) ? 'ok' : 'unchecked'
    return { id, state, label: labelOf(id), detail: '', goTo: null }
  })
  const noMic = path.micReasons.find((r) => r.code === 'NO_MIC')
  // A cabled mic that has its own reason (an error on its port, a console that is off): the engine's words, verbatim, after the fixed line (T1 close review 11).
  const ownReasons = noMic ? [] : [...new Set(path.micReasons.map((r) => r.text_fr))]
  return {
    visible: input.placeOpen && !ready,
    rows,
    mic: noMic ? { cabled: false, text: noMic.text_fr } : { cabled: true, text: [COPY.checklist!.micCabled!, ...ownReasons].join(' ') },
  }
}
