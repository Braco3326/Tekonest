/**
 * The status bar's model (Task 14, CA-15, C17): pure, no DOM. What the bar
 * says about the selection, the snapping, the autosave and the signal, and
 * the persistent error list (the last refused connection first, then the rule
 * errors, then the warnings). The count is the RuleEvaluator's error count:
 * a refused connection changed nothing in the rig, so it is listed, not counted.
 */
import type { PortRef, TeachingEvent } from '../../engine/types'
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
 * A rule as the status list shows it. `detail` (not `teach`): the catalog's `teach_fr` once Task 29 adds it,
 * until then a faithful French rendering of the catalog `check` (COPY.rule).
 */
export type RuleText = (ruleId: string) => { title: string; detail: string }

const S = (): Readonly<Record<string, string>> => COPY.status!
const fill = (s: string, k: string, v: string): string => s.replace(`{${k}}`, v)
const portKey = (p: PortRef): string => `${p.instance}.${p.port}`

export function statusView(input: {
  selectionLabel: string | null
  /** undefined = placement snapping does not exist yet: no snapping text. */
  snapFree?: boolean
  events: TeachingEvent[]
  lastRejection: Rejection | null
  ruleText: RuleText
  /** The signal path can play (src/flow/signalPath.ts, fed by Task 34). Default false. */
  playbackReady?: boolean
  /** Cables in the rig (0 → « Rien de branché »). Default 0. */
  connections?: number
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
  ].filter(Boolean)
  return {
    selection: input.selectionLabel === null ? S().selectionNone! : fill(S().selection!, 'device', input.selectionLabel),
    snapping: input.snapFree === undefined ? '' : input.snapFree ? S().snappingFree! : S().snapping!,
    signal:
      count > 0
        ? { kind: 'errors', label: count === 1 ? S().errorsOne! : fill(S().errorsMany!, 'n', String(count)), count }
        : (input.connections ?? 0) === 0
          ? { kind: 'neutral', label: S().signalNothing!, count: 0 }
          : input.playbackReady === true
            ? { kind: 'ok', label: S().signalOk!, count: 0 }
            : { kind: 'neutral', label: S().signalNoError!, count: 0 },
    extra: extra.join(' · '),
    errors: list,
  }
}

/** The catalog rule shape this reads (`title_fr` / `teach_fr` arrive in Task 29). */
export interface RuleRow {
  id: string
  title: string
  teach: string
  title_fr?: string
  teach_fr?: string
}

/**
 * A rule's French text: the catalog's `title_fr` / `teach_fr` when present,
 * else the French copy (`COPY.rule`), else (never for R1–R8) the rule id.
 * Mode Création never shows the English catalog text.
 */
export function ruleTextFor(rules: readonly RuleRow[]): RuleText {
  return (ruleId) => {
    const r = rules.find((x) => x.id === ruleId)
    const R = COPY.rule ?? {}
    const title = r?.title_fr || R[`${ruleId}Title`] || fill(S().unknownRule!, 'id', ruleId)
    const detail = r?.teach_fr || R[`${ruleId}Detail`] || ''
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
