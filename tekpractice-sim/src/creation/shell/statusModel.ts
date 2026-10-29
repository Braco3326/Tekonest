/**
 * The status bar's model (Task 14, CA-15, C17): pure, no DOM. What the bar
 * says about the selection, the snapping, the autosave and the signal, and
 * the persistent error list (the last refused connection first, then the rule
 * errors, then the warnings). The count is the RuleEvaluator's error count:
 * a refused connection changed nothing in the rig, so it is listed, not counted.
 */
import type { PortRef, TeachingEvent } from '../../engine/types'
import type { PathResult } from '../../flow/signalPath'
import { COPY } from '../copy'

export type ErrorSeverity = 'rejection' | 'error' | 'warning'

export interface StatusError {
  id: string
  severity: ErrorSeverity
  title: string
  detail: string
  ports: PortRef[]
}

export interface StatusView {
  selection: string
  snapping: string
  /**
   * « Signal OK » (ok) only when the signal path is truly playable (`playbackReady`, L5);
   * otherwise neutral: « Rien de branché » (no cable) or « Aucune erreur détectée ». Errors win.
   */
  signal: { kind: 'ok' | 'neutral' | 'errors'; label: string; count: number }
  /**
   * The « Lecture » line (Task 34, C9): « Lecture possible » when the signal path reaches a powered speaker, else the FIRST
   * reason ('' before the first signal path). Apart from `signal`: a rig can be playable and carry an error elsewhere.
   */
  playback: { ready: boolean; text: string }
  /** « Micro OK » when a mic reaches a powered console input with no error on it ('' = not shown). Separate from playback. */
  mic: string
  /** Shown next to the signal label: the refused connection / the warnings ('' = nothing). */
  extra: string
  errors: StatusError[]
}

export interface Rejection {
  title: string
  detail: string
  ports: PortRef[]
}

/**
 * A rule as Mode Création shows it: `title` = the catalog's `title_fr`, `detail` = its `teach_fr`.
 * `ruleTextFor` is the ONE place that picks them; the status list, the pinned refusal and the « Connecter à… » reasons all read through it.
 */
export type RuleText = (ruleId: string) => { title: string; detail: string }

const S = (): Readonly<Record<string, string>> => COPY.status!
const P = (): Readonly<Record<string, string>> => COPY.playback!
const fill = (s: string, k: string, v: string): string => s.replace(`{${k}}`, v)
const portKey = (p: PortRef): string => `${p.instance}.${p.port}`

export function statusView(input: {
  selectionLabel: string | null
  /** undefined = placement snapping does not exist yet: no snapping text. */
  snapFree?: boolean
  events: TeachingEvent[]
  lastRejection: Rejection | null
  ruleText: RuleText
  /**
   * The signal path of the live design (src/flow/signalPath.ts), recomputed by the owner on every store change.
   * `playbackReady` alone gates « Signal OK » (L5). Absent = not ready, no reason, no mic.
   */
  path?: Pick<PathResult, 'playbackReady' | 'reasons' | 'micOk'>
  /** Cables in the rig (0 → « Rien de branché »). Default 0. */
  connections?: number
  /** Devices in the rig that are Bêta proposals (Task 30): « no error » is weaker evidence with them, and it says so. Default 0. */
  unverified?: number
}): StatusView {
  const errors = input.events.filter((e) => e.severity === 'error')
  const warnings = input.events.filter((e) => e.severity !== 'error')
  const count = errors.length
  // Unique ids (the same rule may fire twice on the same ports): the row's index is part of it.
  const row = (e: TeachingEvent, i: number): StatusError => {
    const t = input.ruleText(e.ruleId)
    return {
      id: `${i}-${e.ruleId}-${e.subjects.map(portKey).join('_')}`,
      severity: e.severity === 'error' ? 'error' : 'warning',
      title: t.title,
      detail: t.detail,
      ports: e.subjects.map((p) => ({ instance: p.instance, port: p.port })),
    }
  }
  const list: StatusError[] = []
  if (input.lastRejection) list.push({ id: 'rejection', severity: 'rejection', ...input.lastRejection, ports: [...input.lastRejection.ports] })
  list.push(...[...errors, ...warnings].map(row))
  const extra = [
    input.lastRejection ? S().refusedMark! : '',
    warnings.length === 0 ? '' : warnings.length === 1 ? S().warningsOne! : fill(S().warningsMany!, 'n', String(warnings.length)),
    (input.unverified ?? 0) <= 0 ? '' : input.unverified === 1 ? S().unverifiedOne! : fill(S().unverifiedMany!, 'n', String(input.unverified)),
  ].filter(Boolean)
  const ready = input.path?.playbackReady === true
  return {
    selection: input.selectionLabel === null ? S().selectionNone! : fill(S().selection!, 'device', input.selectionLabel),
    snapping: input.snapFree === undefined ? '' : input.snapFree ? S().snappingFree! : S().snapping!,
    signal:
      count > 0
        ? { kind: 'errors', label: count === 1 ? S().errorsOne! : fill(S().errorsMany!, 'n', String(count)), count }
        : (input.connections ?? 0) === 0
          ? { kind: 'neutral', label: S().signalNothing!, count: 0 }
          : input.path?.playbackReady === true
            ? { kind: 'ok', label: S().signalOk!, count: 0 }
            : { kind: 'neutral', label: S().signalNoError!, count: 0 },
    playback: { ready, text: ready ? P().ready! : (input.path?.reasons[0]?.text_fr ?? '') },
    mic: input.path?.micOk === true ? P().micOk! : '',
    extra: extra.join(' · '),
    errors: list,
  }
}

/**
 * The catalog rule shape this reads. `title` / `teach` are the English fields the legacy UI shows: never read here.
 * The French fields are optional in the type only so a malformed rule degrades to its id (validate-catalog requires them).
 */
export interface RuleRow {
  id: string
  title: string
  teach: string
  title_fr?: string
  teach_fr?: string
}

/**
 * A rule's French text: the catalog's `title_fr` / `teach_fr`; a rule without them (never in a validated catalog)
 * shows « Règle R9 » with no detail. Mode Création never shows the English catalog text.
 */
export function ruleTextFor(rules: readonly RuleRow[]): RuleText {
  return (ruleId) => {
    const r = rules.find((x) => x.id === ruleId)
    const title = r?.title_fr || fill(S().unknownRule!, 'id', ruleId)
    const detail = r?.teach_fr || ''
    return { title, detail }
  }
}

/** A refused CONNECT as the list shows it: the engine rule (R1–R3) when there is one, else a French reason per code. */
export function rejectionOf(error: { code: string; message: string; ruleId?: string }, subjects: readonly PortRef[], ruleText: RuleText): Rejection {
  const ports = subjects.map((p) => ({ instance: p.instance, port: p.port }))
  if (error.ruleId) {
    const t = ruleText(error.ruleId)
    return { title: t.title, detail: t.detail, ports }
  }
  if (error.code === 'PORT_OCCUPIED') return { title: S().occupiedTitle!, detail: S().occupiedDetail!, ports }
  if (error.code === 'SELF_CONNECTION') return { title: S().selfTitle!, detail: S().selfDetail!, ports }
  return { title: S().otherTitle!, detail: S().otherDetail!, ports }
}

/** Why the autosave is not writing (null = it is). */
export type AutosavePause = 'kept' | 'kept-exported' | 'other-tab' | 'full' | 'blocked' | null

export interface AutosaveView {
  /** « Sauvegarde auto : Enregistré | Modifié | En pause » ('' before a place). */
  label: string
  state: 'saved' | 'modified' | 'paused' | 'none'
  /** The persistent line while paused ('' = none). */
  line: string
  /** The line's button: export the kept data, confirm the file, resume here. */
  action: 'export' | 'checked' | 'resume' | null
}

export function autosaveView(input: { place: boolean; pending: boolean; pause: AutosavePause }): AutosaveView {
  const lineOf: Record<Exclude<AutosavePause, null>, [string, AutosaveView['action']]> = {
    kept: [S().pausedKept!, 'export'],
    'kept-exported': [S().pausedKeptExported!, 'checked'],
    'other-tab': [S().pausedOtherTab!, 'resume'],
    full: [S().pausedFull!, null],
    blocked: [S().pausedBlocked!, null],
  }
  const [line, action] = input.pause ? lineOf[input.pause] : ['', null]
  if (!input.place) return { label: '', state: 'none', line, action }
  const state = input.pause ? 'paused' : input.pending ? 'modified' : 'saved'
  const word = state === 'paused' ? S().autosavePaused! : state === 'modified' ? S().autosaveModified! : S().autosaveSaved!
  return { label: `${S().autosave} ${word}`, state, line, action }
}

/**
 * What the screen reader is told when the playback or the mic changes (Task 34 review → Task 39). The status bar's « Lecture » and « Micro OK » spans are
 * plain text, not live: a change is announced ONCE, through the polite status line, when it flips, never per store change and never per frame.
 */
export interface PlaybackNoticeState {
  ready: boolean
  /** The first reason (`text_fr`), '' when ready. */
  reason: string
  micOk: boolean
  /** The first reason there is no « Micro OK », '' when it is OK. */
  micReason: string
}

export function playbackNoticeState(path: Pick<PathResult, 'playbackReady' | 'reasons' | 'micOk' | 'micReasons'>): PlaybackNoticeState {
  return {
    ready: path.playbackReady,
    reason: path.playbackReady ? '' : (path.reasons[0]?.text_fr ?? ''),
    micOk: path.micOk,
    micReason: path.micOk ? '' : (path.micReasons[0]?.text_fr ?? ''),
  }
}

/**
 * The words to announce for the change from `prev` to `next` ('' = nothing):
 *  - playback becomes possible → « Lecture possible »; it is lost → the first reason; still impossible but for another first reason → that reason;
 *  - the mic becomes OK → « Micro OK »; it is lost → « Plus de Micro OK. <reason> ».
 * `stopsPlayback`: the owner is playing and will itself say that the playback stopped (with the reason): the loss is then not said twice.
 */
export function playbackAnnouncement(prev: PlaybackNoticeState, next: PlaybackNoticeState, opts: { stopsPlayback?: boolean } = {}): string {
  const parts: string[] = []
  if (prev.ready !== next.ready) {
    if (next.ready) parts.push(P().ready!)
    else if (!opts.stopsPlayback && next.reason !== '') parts.push(next.reason)
  } else if (!next.ready && prev.reason !== next.reason && next.reason !== '') parts.push(next.reason)
  if (prev.micOk !== next.micOk) {
    if (next.micOk) parts.push(P().micOk!)
    else parts.push(P().micLost!.replace('{reason}', next.micReason).trim())
  }
  // Two sentences read as two: each ends with a full stop (a single one is said as the status bar shows it).
  return parts.length > 1 ? parts.map((x) => (/[.!?…]$/.test(x) ? x : `${x}.`)).join(' ') : (parts[0] ?? '')
}
