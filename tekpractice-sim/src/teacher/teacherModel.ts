/**
 * Teacher page view model (Task 15). Pure: no DOM, no Babylon, no storage.
 * Turns imported Trials into plain cards the DOM layer prints. Phase 1:
 * setups and rule outcomes only, NO acoustic numbers.
 *
 * Copy: docs/copy/designer-nav-essais.md section 10 (teacher.*); the strings
 * the deck lacks are marked "a valider" below and in the task report.
 */
import { compareTrials } from '../trials/compare'
import type { Trial } from '../trials/trial'

export const TEACHER_COPY = {
  title: "Parcours d'essais : lecture enseignant", // teacher.title
  subtitle: 'Page en lecture seule, ouverte à partir d\'un fichier .essai.json. Rien n\'est envoyé sur un serveur.', // teacher.subtitle
  drop: 'Déposez un fichier .essai.json ici, ou choisissez-le.', // teacher.drop
  choose: 'Choisir un fichier', // teacher.choose.button
  empty: 'Aucun fichier ouvert.', // teacher.empty
  errorRead: "Ce fichier n'a pas pu être lu. Vérifiez qu'il vient bien de TekPractice.", // teacher.error.read
  trail: 'Parcours', // teacher.trail
  prediction: 'Prédiction', // teacher.trial.prediction
  rules: 'Règles', // teacher.trial.rules
  levelState: 'État du niveau', // teacher.trial.levelState
  note: 'Note et compléments', // teacher.trial.note
  map: 'Plan 2D', // teacher.trial.map
  rubricTitle: 'Grille de lecture', // teacher.rubric.title
  rubricDraft: "Brouillon : formulation à valider par Oscar.", // a valider (tekuxwriter), N8
  rubric: [
    'La prédiction a-t-elle été écrite avant de figer ?', // teacher.rubric.1
    'Un seul changement entre deux essais ?', // teacher.rubric.2
    'Les règles de câblage sont-elles respectées dans l\'essai final ?', // teacher.rubric.3
    'La note explique-t-elle ce qui a été observé ?', // teacher.rubric.4
    "L'élève a-t-il relu sa prédiction après comparaison ?", // teacher.rubric.5
  ],
  disclaimer:
    "Les essais sont déclaratifs : ils montrent ce que l'élève a saisi et figé. Le fichier n'est pas signé et peut être modifié.", // teacher.disclaimer
  print: 'Imprimer ou enregistrer en PDF', // teacher.print.button
  // a valider (tekuxwriter): not in the deck
  noRoom: 'Sans salle',
  quarantine:
    "Ce fichier contient des données mises de côté (quarantaine), pas un parcours d'essais. Rouvrez TekPractice pour exporter les essais.",
  version: "Ce fichier vient d'une version plus récente de TekPractice et ne peut pas être lu ici.",
  crypto: "Ce navigateur ne permet pas de vérifier le fichier. Ouvrez la page dans un navigateur récent.",
  noTrials: "Ce fichier ne contient aucun essai.",
  noParent: 'Premier essai',
  noChange: 'Aucun changement',
  noRules: 'Aucune règle signalée',
  noNote: 'Aucune note',
  // à valider (tekuxwriter): per-trial wording moved out of main.ts
  changes: 'Changements depuis le parent',
  fixed: 'Corrigées depuis le parent : ',
  broken: 'Nouvelles depuis le parent : ',
  frozenAt: (t: string): string => `figé à ${t}`,
  writtenAt: (t: string): string => `(écrite à ${t})`,
  amendedAt: (t: string): string => `(à ${t})`,
  parentOf: (name: string): string => `parent : Essai ${name}`,
  tooBig: (maxMb: number): string => `Ce fichier dépasse ${maxMb} Mo : un fichier d'essais TekPractice est bien plus petit. Vérifiez qu'il vient bien de TekPractice.`,
  tooMany: (max: number): string => `Ce fichier contient plus de ${max} essais : il n'est pas lu.`,
  oneFileOnly: 'Plusieurs fichiers ont été déposés : seul le premier est lu.',
} as const

/** Limits applied before parsing: a real export is a few kB per trial. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MAX_TRIALS = 500

/** Number of entries in `trials` when the text is a JSON object with a trials array, else null. */
export const trialCountOf = (text: string): number | null => {
  try {
    const t = (JSON.parse(text) as { trials?: unknown } | null)?.trials
    return Array.isArray(t) ? t.length : null
  } catch {
    return null
  }
}

export type ImportFailureReason = 'corrupt' | 'format' | 'version' | 'crypto-unavailable'

/** Message for a failed import (a quarantine file is told apart by the caller). */
export function failureMessage(reason: ImportFailureReason | 'quarantine'): string {
  switch (reason) {
    case 'quarantine':
      return TEACHER_COPY.quarantine
    case 'version':
      return TEACHER_COPY.version
    case 'crypto-unavailable':
      return TEACHER_COPY.crypto
    default:
      return TEACHER_COPY.errorRead
  }
}

export const isQuarantineFile = (text: string): boolean => {
  try {
    return (JSON.parse(text) as { kind?: unknown } | null)?.kind === 'quarantine'
  } catch {
    return false
  }
}

export const rejectedNotice = (n: number): string | null =>
  n > 0 ? `${n} essai${n > 1 ? 's' : ''} du fichier ${n > 1 ? "n'ont" : "n'a"} pas passé la vérification et ${n > 1 ? 'sont ignorés' : 'est ignoré'}.` : null // a valider

/** Local HH:MM. */
export function clock(iso: string): string {
  const d = new Date(iso)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

/** A change key from diffDesign, in French. */
export function changeLabel(key: string): string {
  if (key === 'room') return 'Salle changée'
  const [kind, rest = ''] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
  switch (kind) {
    case 'instance':
      if (rest.startsWith('+')) return `Matériel ajouté : ${rest.slice(1)}`
      if (rest.startsWith('-')) return `Matériel retiré : ${rest.slice(1)}`
      return `Matériel remplacé : ${rest.slice(1)}`
    case 'placement':
      return `Matériel déplacé : ${rest}`
    case 'connection':
      return rest.startsWith('+') ? `Câbles ajoutés : ${rest.slice(1)}` : `Câbles retirés : ${rest.slice(1)}`
    case 'control':
      return `Réglage modifié : ${rest}`
    default:
      return key
  }
}

export interface RoomInfo {
  name: string
  /** Typical dimensions in metres (width along x, length along z), when known. */
  width?: number
  length?: number
}
export type RoomLookup = (roomId: string) => RoomInfo | null

export interface MapDot {
  id: string
  label: string
  x: number
  y: number
  yawDeg: number
}
export interface MapGeometry {
  viewBox: string
  room: { x: number; y: number; w: number; h: number } | null
  dots: MapDot[]
  title: string
}

const MARGIN_M = 0.6
const round = (v: number): number => Math.round(v * 1000) / 1000

/**
 * Top view: x = x, y = z (audience at the bottom, front = -z at the top).
 * The room rect is centred on the origin; the view always covers every
 * placement, so a device outside the typical room is still shown.
 */
export function mapGeometry(trial: Trial, room: RoomInfo | null, roomName: string): MapGeometry {
  const dots: MapDot[] = trial.design.placements.map((p) => ({
    id: p.instanceId,
    label: p.deviceId,
    x: round(p.position_m[0]),
    y: round(p.position_m[2]),
    yawDeg: p.yawDeg,
  }))
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const grow = (x0: number, y0: number, x1 = x0, y1 = y0): void => {
    minX = Math.min(minX, x0)
    maxX = Math.max(maxX, x1)
    minY = Math.min(minY, y0)
    maxY = Math.max(maxY, y1)
  }
  let rect: MapGeometry['room'] = null
  if (room?.width && room.length && room.width > 0 && room.length > 0) {
    rect = { x: -room.width / 2, y: -room.length / 2, w: room.width, h: room.length }
    grow(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)
  }
  // labels sit to the right of the dot: reserve their width (about 0.11 m per character at the map's font size)
  for (const d of dots) grow(d.x, d.y, d.x + 0.25 + d.label.length * 0.11, d.y)
  if (!Number.isFinite(minX)) grow(-1, -1, 1, 1) // no room, no placement
  const w = Math.max(maxX - minX, 1) + 2 * MARGIN_M
  const h = Math.max(maxY - minY, 1) + 2 * MARGIN_M
  const vx = round(minX - MARGIN_M - (w - (maxX - minX) - 2 * MARGIN_M) / 2)
  const vy = round(minY - MARGIN_M - (h - (maxY - minY) - 2 * MARGIN_M) / 2)
  return {
    viewBox: `${vx} ${vy} ${round(w)} ${round(h)}`,
    room: rect && { x: round(rect.x), y: round(rect.y), w: round(rect.w), h: round(rect.h) },
    dots,
    title: `Plan vu de dessus de l'essai ${trial.name} : placement du matériel dans la salle. ${roomName}.`, // teacher.map.alt
  }
}

export interface RuleLine {
  ruleId: string
  severity: 'error' | 'warning'
  severityLabel: string
}
export interface TrialCard {
  id: string
  name: string
  label: string
  time: string
  parentName: string | null
  prediction: { text: string; time: string }
  changes: string[]
  rules: RuleLine[]
  /** Rule ids fixed / broken against the parent; null when there is no parent in the file. */
  fixed: string[] | null
  broken: string[] | null
  levelState: string | null
  note: string
  amendments: { text: string; time: string }[]
  roomName: string
  map: MapGeometry
}

function levelStateText(t: Trial): string | null {
  const s = t.evidence.levelState
  if (!s) return null
  const chain = s.chainComplete ? 'chaîne complète' : 'chaîne incomplète'
  return `${chain}, ${s.connectedRequired} sur ${s.totalRequired} connexions requises${s.won ? ', niveau réussi' : ''}`
}

/** Trail in freeze order (A, B, B1 ...), one card per Trial. */
export function trailCards(trials: readonly Trial[], lookup: RoomLookup = () => null): TrialCard[] {
  const byId = new Map(trials.map((t) => [t.id, t]))
  const ordered = [...trials].sort((a, b) => Date.parse(a.frozenAt) - Date.parse(b.frozenAt))
  return ordered.map((t) => {
    const parent = t.parentId ? (byId.get(t.parentId) ?? null) : null
    const info = t.design.roomId ? lookup(t.design.roomId) : null
    const roomName = t.design.roomId ? (info?.name ?? t.design.roomId) : TEACHER_COPY.noRoom
    const cmp = parent ? compareTrials(parent, t) : null
    return {
      id: t.id,
      name: t.name,
      label: `Essai ${t.name}`,
      time: clock(t.frozenAt),
      parentName: parent ? parent.name : null,
      prediction: { text: t.evidence.prediction.text, time: clock(t.evidence.prediction.writtenAt) },
      changes: t.evidence.changedSinceParent.map(changeLabel),
      rules: t.evidence.ruleResults.map((r) => ({
        ruleId: r.ruleId,
        severity: r.severity,
        severityLabel: r.severity === 'error' ? 'erreur' : 'avertissement',
      })),
      fixed: cmp ? cmp.rules.fixed : null,
      broken: cmp ? cmp.rules.broken : null,
      levelState: levelStateText(t),
      note: t.evidence.note,
      amendments: t.evidence.noteAmendments.map((a) => ({ text: a.text, time: clock(a.at) })),
      roomName,
      map: mapGeometry(t, info, roomName),
    }
  })
}
