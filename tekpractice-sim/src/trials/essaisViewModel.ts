/**
 * Essais panel view model (ADR-0012, Task 14). Pure: no DOM, no Babylon, no
 * storage. The panel (src/ui/essaisPanel.ts) is a thin adapter over these
 * functions. Phase 1: setups only, NO acoustic numbers anywhere.
 *
 * Every learner-facing string comes from the copy deck
 * docs/copy/designer-nav-essais.md (key in the comment); strings the deck did
 * not have are added there under « à valider (tekuxwriter) ».
 */
import { ORBIT_FEEL } from '../camera/orbitFeel'
import type { CameraPoseJSON } from '../camera/presets'
import { compareTrials } from './compare'
import type { StoreWarning, WriteFailure } from './store'
import type { Trial, TrialView } from './trial'

/** 1st year: flat list, at most 3 Essais (deck §6). */
export const YEAR1_MAX = 3
export type Year = 1 | 2

export const COPY = {
  panelTitle: 'Essais', // essais.panel.title
  openAria: 'Ouvrir le panneau des essais', // essais.panel.open.aria
  closeAria: 'Fermer le panneau des essais', // essais.panel.close.aria
  empty: 'Aucun essai. Placez le matériel, écrivez votre prédiction, puis figez.', // essais.empty
  listAria: 'Liste des essais', // essais.list.aria
  displayedBadge: 'affiché', // essais.item.displayed
  currentTitle: 'Montage actuel', // essais.current.title
  currentHelp: "Votre montage en cours. Il n'est un essai que lorsque vous le figez.", // essais.current.help
  freeze: "Figer l'essai", // essais.freeze.label
  freezeAria: 'Figer le montage actuel en un nouvel essai', // essais.freeze.aria
  compare: 'Comparer', // essais.compare.label
  compareTooltip: 'Comparer (B : alterner A et B)', // essais.compare.tooltip
  compareDisabled: 'Il faut deux essais pour comparer.', // essais.compare.disabled
  restore: 'Repartir de cet essai', // essais.restore.label
  restoreConfirm: (n: string) => `Votre montage actuel sera remplacé par celui de l'essai ${n}. Il reste figé dans la liste.`, // essais.restore.confirm
  restoreConfirmOk: (n: string) => `Repartir de l'essai ${n}`, // essais.restore.confirm.ok
  cancel: 'Annuler', // essais.restore.confirm.cancel
  frozenToast: (n: string) => `Essai ${n} figé.`, // essais.frozen.toast
  restoredToast: (n: string) => `Vous repartez de l'essai ${n}.`, // essais.restored.toast
  noChange: (n: string) => `Rien n'a changé depuis l'essai ${n}.`, // essais.noChange.toast
  noChangeHint: 'Modifiez un élément (placement, câblage ou salle), puis figez à nouveau.', // essais.noChange.hint
  predictionLabel: 'Prédiction', // essais.prediction.label
  predictionPlaceholder: "Je change…, je m'attends à…", // essais.prediction.placeholder
  predictionHelp: "Écrivez-la avant de figer : c'est ce qui compte quand on compare.", // essais.prediction.help
  predictionRequired: 'Écrivez votre prédiction avant de figer.', // essais.prediction.required (à valider)
  noteLabel: 'Note', // essais.note.label
  notePlaceholder: "Ce que j'ai observé, ce que je ferais ensuite.", // essais.note.placeholder
  multiChange: 'plusieurs changements à la fois', // essais.flag.multiChange
  multiChangeHelp: 'Cet essai change plusieurs choses : difficile de savoir laquelle a eu un effet.', // essais.flag.multiChange.help
  staleHelp: 'Le montage a changé depuis cet essai. Le résultat affiché n\'est plus à jour.', // stale.help
  // compare (deck §5)
  compareTitle: 'Comparer les essais', // compare.title
  pickA: 'Essai A', // compare.pick.a
  pickB: 'Essai B', // compare.pick.b
  flip: 'Alterner A / B', // compare.flip.label
  flipAria: "Afficher l'autre essai à la même place de caméra", // compare.flip.aria
  closeCompare: 'Fermer la comparaison', // compare.close.label
  readOnly: 'Comparaison en lecture seule : rien n\'est modifié.', // compare.readonly
  diffRules: 'Règles', // compare.diff.rules
  // export / import (deck §8.1)
  exportTeacher: "Exporter pour l'enseignant (.essai.json)", // export.button.teacher (à valider; brief Task 14)
  exportAria: 'Exporter les essais dans un fichier', // export.button.aria
  exportDone: (f: string) => `Fichier enregistré : ${f}`, // export.done.toast
  exportDeclaratif: "Les essais sont déclaratifs : ce fichier est ce que vous avez saisi et figé, il n'est pas signé.", // export.declaratif
  import: 'Importer', // import.button
  importAria: 'Importer des essais depuis un fichier', // import.button.aria
  importChoose: 'Choisir un fichier .essai.json', // import.choose.aria
  importFormat: "Ce fichier n'est pas un fichier d'essais TekPractice.", // import.error.format
  importVersion: "Ce fichier vient d'une version plus récente de TekPractice. Mettez la page à jour, puis réessayez.", // import.error.version
  importCorrupt: 'Ce fichier est abîmé ou incomplet. Rien n\'a été importé.', // import.error.corrupt
  importLimit: "L'import dépasserait la limite de 3 essais. Rien n'a été importé.", // import.error.limit
  importRead: "Le fichier n'a pas pu être lu par le navigateur.", // import.error.read
  // quarantine / storage (deck §8.2, §8.3)
  quarantineExport: 'Exporter les données mises de côté', // quarantine.export
  quarantineContinue: 'Continuer sans elles', // quarantine.continue
  quarantineDone: (f: string) => `Données mises de côté exportées : ${f}`, // quarantine.export.done
  quarantineNothing: "Aucune donnée mise de côté n'a pu être lue dans ce navigateur.", // quarantine.export.empty (à valider)
  nearButton: 'Exporter puis archiver', // storage.near.button
  later: 'Plus tard', // storage.near.dismiss
  archiveConfirm: 'Les essais exportés seront retirés de ce navigateur. Le fichier reste chez vous.', // storage.archive.confirm
  archiveOk: 'Archiver', // storage.archive.confirm.ok (à valider)
  archived: (n: number) => `${n} essai${n > 1 ? 's' : ''} archivé${n > 1 ? 's' : ''}.`, // storage.archive.done.toast
  // 1st-year limit (deck §6)
  limitTitle: 'Vous avez 3 essais.', // limit.reached.title
  limitBody: 'En première année, on garde 3 essais au maximum. Supprimez-en un ou exportez-les, puis figez à nouveau.', // limit.reached.body
  limitExport: 'Exporter mes essais', // limit.reached.export
  delete: 'Supprimer un essai', // limit.reached.delete
  deleteConfirm: (n: string) => `Supprimer l'essai ${n} ? Cette action est définitive.`, // limit.delete.confirm
  deleteHint: "Exportez d'abord si vous voulez le garder.", // limit.delete.confirm.hint
  deleteOk: 'Supprimer', // limit.delete.confirm.ok
  deleteHasChild: "Cet essai a des essais enfants : supprimez-les d'abord.", // limit.delete.hasChild
  deleted: (n: string) => `Essai ${n} supprimé.`, // limit.deleted.toast (à valider)
  // misc (à valider)
  otherRoom: "Cet essai a été figé dans une autre salle : le matériel est replacé ici, sans changer de salle.", // essais.restore.otherRoom (à valider)
  locked: "Comparaison en lecture seule : rien n'est modifié.", // compare.readonly, reused as the blocked-edit toast
} as const

const plural = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`

// ── names, time ───────────────────────────────────────────────────────────────

const letters = (i: number): string => {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** A, B, C… (then AA): the first name not already used. */
export function nextTrialName(trials: readonly { name: string }[]): string {
  const used = new Set(trials.map((t) => t.name))
  for (let i = 0; ; i++) if (!used.has(letters(i))) return letters(i)
}

export const trialLabel = (t: { name: string }): string => `Essai ${t.name}` // essais.item.name

/** essais.item.time: "figé à {time}", local HH:MM. */
export function frozenTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `figé à ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ── list ──────────────────────────────────────────────────────────────────────

export interface EssaisRow {
  id: string
  name: string
  label: string
  time: string
  depth: number
  displayed: boolean
  selected: boolean
  hasChildren: boolean
  multiChange: boolean
}

/**
 * How many learner changes `changedSinceParent` stands for. Moving a device in
 * the sandbox is "pick up + put down": a new instance of the SAME device
 * (instance:-x + instance:+y), and its cables leave and come back with it.
 * That is one change (a move), not several.
 */
export function changeCount(t: Trial, parent: Trial | null): number {
  const keys = t.evidence.changedSinceParent
  if (!parent) return keys.length
  const ids = (prefix: string): string[] => keys.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length))
  const devOf = (d: Trial['design'], id: string): string | undefined => d.rig.instances.find((i) => i.instanceId === id)?.deviceId
  const removed = ids('instance:-')
  const added = ids('instance:+')
  const movedOut = new Set<string>()
  const movedIn = new Set<string>()
  for (const r of removed) {
    const dev = devOf(parent.design, r)
    const match = added.find((x) => !movedIn.has(x) && devOf(t.design, x) === dev)
    if (dev !== undefined && match) {
      movedOut.add(r)
      movedIn.add(match)
    }
  }
  let n = keys.length - movedOut.size
  const touches = (set: Set<string>) => (c: { a: { instance: string }; b: { instance: string } }) => set.has(c.a.instance) || set.has(c.b.instance)
  const count = (prefix: string): number => Number(ids(prefix)[0] ?? 0)
  const outCables = parent.design.rig.connections.filter(touches(movedOut)).length
  const inCables = t.design.rig.connections.filter(touches(movedIn)).length
  if (count('connection:-') > 0 && count('connection:-') <= outCables) n--
  if (count('connection:+') > 0 && count('connection:+') <= inCables) n--
  return n
}

const byFrozen = (a: Trial, b: Trial): number => (a.frozenAt < b.frozenAt ? -1 : a.frozenAt > b.frozenAt ? 1 : a.id < b.id ? -1 : 1)

/** 2nd year: a mini-tree (children under their parent); 1st year: flat, in freeze order. */
export function essaisRows(
  trials: readonly Trial[],
  o: { year: Year; displayedId: string | null; selectedId: string | null },
): EssaisRow[] {
  const ids = new Set(trials.map((t) => t.id))
  const byId = new Map(trials.map((t) => [t.id, t]))
  const children = new Map<string | null, Trial[]>()
  for (const t of trials) {
    const parent = t.parentId !== null && ids.has(t.parentId) && t.parentId !== t.id ? t.parentId : null
    children.set(parent, [...(children.get(parent) ?? []), t])
  }
  const row = (t: Trial, depth: number): EssaisRow => ({
    id: t.id,
    name: t.name,
    label: trialLabel(t),
    time: frozenTime(t.frozenAt),
    depth,
    displayed: t.id === o.displayedId,
    selected: t.id === o.selectedId,
    hasChildren: (children.get(t.id)?.length ?? 0) > 0,
    multiChange: changeCount(t, t.parentId ? (byId.get(t.parentId) ?? null) : null) > 1,
  })
  // 1st year: at most 3 rows, the most recent (more exist after a switch from 2nd year: see year1Overflow).
  if (o.year === 1) return [...trials].sort(byFrozen).slice(-YEAR1_MAX).map((t) => row(t, 0))
  const out: EssaisRow[] = []
  const seen = new Set<string>()
  const walk = (parent: string | null, depth: number): void => {
    for (const t of [...(children.get(parent) ?? [])].sort(byFrozen)) {
      if (seen.has(t.id)) continue // a cycle in imported data never loops
      seen.add(t.id)
      out.push(row(t, depth))
      walk(t.id, depth + 1)
    }
  }
  walk(null, 0)
  // Anything unreachable (a parent cycle) still shows, as a root.
  for (const t of [...trials].sort(byFrozen)) if (!seen.has(t.id)) out.push(row(t, 0))
  return out
}

// ── live state, "Montage actuel", caption ─────────────────────────────────────

export type LiveState = 'none' | 'fresh' | 'modified'

/** `liveFp` null = not recomputed yet: keep the displayed state (fresh). */
export function liveState(displayed: Trial | null, liveFp: string | null): LiveState {
  if (!displayed) return 'none'
  if (liveFp === null) return 'fresh'
  return liveFp === displayed.fingerprint ? 'fresh' : 'modified'
}

export function currentRow(displayed: Trial | null, state: LiveState): { title: string; text: string } {
  const text =
    !displayed || state === 'none'
      ? 'pas encore figé' // essais.current.state.none
      : state === 'fresh'
        ? `identique à l'essai ${displayed.name}` // essais.current.state.fresh
        : `modifié depuis l'essai ${displayed.name}` // essais.current.state.modified
  return { title: COPY.currentTitle, text }
}

/** Caption bar: always starts with « Affiché : » (deck §4). */
export function caption(o: { displayed: Trial | null; state: LiveState; comparing: Trial | null }): string {
  const sep = ' · ' // caption.separator
  if (o.comparing) return `Affiché : Essai ${o.comparing.name}${sep}comparaison en lecture seule` // caption.compare (à valider)
  if (!o.displayed || o.state === 'none') return `Affiché : Montage actuel${sep}pas encore figé` // caption.none (à valider)
  if (o.state === 'fresh') return `Affiché : Essai ${o.displayed.name}${sep}Montage actuel : à jour` // caption.displayed + caption.current.fresh
  return `Affiché : Essai ${o.displayed.name}${sep}Résultat à refaire${sep}Montage actuel : modifié` // + stale.label + caption.current.modified
}

/** 1st year with more Essais than the limit (the learner switched from 2nd year): nothing is deleted, the list is capped. */
export function year1Overflow(n: number, year: Year): { title: string; body: string } | null {
  if (year !== 1 || n <= YEAR1_MAX) return null
  return {
    title: `Vous avez ${n} essais.`, // limit.over.title (à valider)
    body: `${COPY.limitBody} La liste montre les ${YEAR1_MAX} derniers.`, // limit.reached.body + limit.over.hidden (à valider)
  }
}

export function limitCounter(n: number, year: Year): string | null {
  return year === 1 ? `${plural(n, 'essai', 'essais')} sur ${YEAR1_MAX}` : null // limit.counter
}

// ── freeze ────────────────────────────────────────────────────────────────────

export interface ContentRefs {
  rulesRev: string
  room: { roomId: string | null; geometryRev: string | null }
}

export type FreezeDecision = { kind: 'noop'; name: string } | { kind: 'limit' } | { kind: 'ok'; name: string; parentId: string | null }

/**
 * No-op only when the fingerprint AND the content refs (catalog rules, room)
 * equal the displayed Essai's. The displayed Essai is the new one's parent.
 */
export function freezeDecision(o: {
  trials: readonly Trial[]
  displayed: Trial | null
  liveFp: string
  refs: ContentRefs
  year: Year
}): FreezeDecision {
  const d = o.displayed
  if (
    d &&
    d.fingerprint === o.liveFp &&
    d.evidence.rulesRev === o.refs.rulesRev &&
    d.consumed.room.roomId === o.refs.room.roomId &&
    d.consumed.room.geometryRev === o.refs.room.geometryRev
  )
    return { kind: 'noop', name: d.name }
  if (o.year === 1 && o.trials.length >= YEAR1_MAX) return { kind: 'limit' }
  return { kind: 'ok', name: nextTrialName(o.trials), parentId: d ? d.id : null }
}

// ── compare (deck §5): words only, no numbers but counts ─────────────────────

export interface CompareRow {
  label: string
  a: string
  b: string
  delta: 'Changé' | 'Identique'
}

export interface CompareView {
  headers: [string, string, string, string]
  rows: CompareRow[]
  rules: { ruleId: string; title: string; verdict: string }[]
  predictionA: string
  predictionB: string
  manual: string
}

export function compareView(
  a: Trial,
  b: Trial,
  ruleTitle: (ruleId: string) => string,
  roomName: (roomId: string) => string = (id) => id,
): CompareView {
  const c = compareTrials(a, b)
  const has = (prefix: string): boolean => c.changed.some((k) => k.startsWith(prefix))
  const delta = (changed: boolean): CompareRow['delta'] => (changed ? 'Changé' : 'Identique') // compare.row.changed / .same
  const room = (t: Trial): string => (t.design.roomId === null ? 'sans salle' : roomName(t.design.roomId)) // compare.room.none (à valider)
  const devices = (t: Trial): string => plural(t.design.rig.instances.length, 'appareil', 'appareils') // (à valider)
  const cables = (t: Trial): string => plural(t.design.rig.connections.length, 'câble', 'câbles') // (à valider)
  const controls = (t: Trial): string =>
    plural(
      Object.values(t.design.rig.controls).reduce((n, m) => n + Object.keys(m).length, 0),
      'réglage',
      'réglages',
    ) // (à valider)
  return {
    headers: ['', 'A', 'B', 'Δ'], // compare.col.a / .b / .delta
    rows: [
      { label: 'Salle', a: room(a), b: room(b), delta: delta(has('room')) }, // compare.diff.room
      { label: 'Placements', a: devices(a), b: devices(b), delta: delta(has('instance:') || has('placement:')) }, // compare.diff.placements
      { label: 'Câblage', a: cables(a), b: cables(b), delta: delta(has('connection:')) }, // compare.diff.wiring
      { label: 'Réglages', a: controls(a), b: controls(b), delta: delta(has('control:')) }, // compare.diff.controls (à valider)
    ],
    rules: [
      ...c.rules.fixed.map((id) => ({ ruleId: id, title: ruleTitle(id), verdict: 'respectée maintenant' })), // compare.rule.nowPasses
      ...c.rules.broken.map((id) => ({ ruleId: id, title: ruleTitle(id), verdict: 'à revoir maintenant' })), // compare.rule.nowFails
    ],
    predictionA: c.predictionA.text,
    predictionB: c.predictionB.text,
    manual: "Relisez votre prédiction : s'est-elle vérifiée ?", // compare.prediction.manual
  }
}

// ── store notices ─────────────────────────────────────────────────────────────

export type NoticeAction = 'export-quarantine' | 'export-archive' | 'dismiss'
export interface Notice {
  kind: 'read-only' | 'quarantine' | 'near-budget'
  title: string
  body: string
  actions: NoticeAction[]
}

const READ_ONLY_BODY: Partial<Record<StoreWarning, string>> = {
  'quarantine-truncated': "Les essais sont en lecture seule tant que ces données n'ont pas été exportées.", // storage.readOnly.truncated (à valider)
  'quarantine-failed': "Les essais sont en lecture seule : la copie de côté n'a pas pu être enregistrée.", // storage.readOnly.failed (à valider)
  'storage-unavailable': 'Le navigateur est peut-être en navigation privée : vos essais ne seront pas gardés.', // storage.private.hint
  'crypto-unavailable': 'Ce navigateur ne peut pas vérifier les essais : ils sont en lecture seule.', // storage.readOnly.crypto (à valider)
}

/** What the panel says after `TrialStore.load()`; `usedRatio` = bytesUsed / budget. */
export function loadNotice(r: { quarantined: boolean; warnings: readonly StoreWarning[] }, usedRatio: number): Notice | null {
  const ro = (['quarantine-truncated', 'quarantine-failed', 'storage-unavailable', 'crypto-unavailable'] as const).find((w) =>
    r.warnings.includes(w),
  )
  if (ro) {
    return {
      kind: 'read-only',
      title: r.quarantined
        ? "Données d'essais illisibles — mises de côté (quarantaine), exportables." // quarantine.notice
        : "L'enregistrement dans ce navigateur a échoué. Exportez vos essais pour ne rien perdre.", // storage.writeFailed
      body: READ_ONLY_BODY[ro]!,
      actions: ['export-quarantine'],
    }
  }
  if (r.quarantined)
    return {
      kind: 'quarantine',
      title: "Données d'essais illisibles — mises de côté (quarantaine), exportables.", // quarantine.notice
      body: "Rien n'est effacé. Votre progression n'est pas touchée.", // quarantine.reassure
      actions: ['export-quarantine', 'dismiss'],
    }
  if (r.warnings.includes('near-budget')) return nearBudget(usedRatio)
  return null
}

export function nearBudget(usedRatio: number): Notice {
  return {
    kind: 'near-budget',
    title: `La mémoire des essais est presque pleine (${Math.round(usedRatio * 100)} %).`, // storage.near.title
    body: 'Exporter puis archiver les anciens essais.', // storage.near.body
    actions: ['export-archive', 'dismiss'],
  }
}

/** Every write failure is shown (council NN2). */
export function writeFailure(reason: WriteFailure): { title: string; body: string } {
  switch (reason) {
    case 'budget':
      return {
        title: 'La mémoire des essais est pleine.', // storage.over.title
        body: 'Exportez puis archivez des essais pour continuer. Votre montage actuel n\'est pas perdu.', // storage.over.body
      }
    case 'quota':
    case 'storage':
      return {
        title: "L'enregistrement dans ce navigateur a échoué. Exportez vos essais pour ne rien perdre.", // storage.writeFailed
        body: 'Le navigateur est peut-être en navigation privée : vos essais ne seront pas gardés.', // storage.private.hint
      }
    case 'read-only':
      return { title: 'Les essais sont en lecture seule dans ce navigateur.', body: COPY.quarantineExport } // storage.readOnly (à valider)
    case 'not-found':
      return { title: "Cet essai n'est plus dans ce navigateur.", body: '' } // storage.notFound (à valider)
    case 'duplicate-id':
    case 'invalid':
    case 'empty':
      return { title: "Cet essai n'a pas pu être enregistré.", body: 'Votre montage est conservé.' } // storage.invalid (à valider) + eval.failed.kept
  }
}

export function importNotice(n: { imported: number; duplicates: number; rejected: number }): string {
  const s = n.imported > 1
  let out = `${n.imported} essai${s ? 's' : ''} importé${s ? 's' : ''}` // import.done.toast
  if (n.duplicates > 0) {
    const d = n.duplicates > 1
    out += `, ${n.duplicates} ignoré${d ? 's' : ''} car déjà présent${d ? 's' : ''}` // import.done.partial
  }
  out += '.'
  if (n.rejected > 0) {
    const r = n.rejected > 1
    out += ` ${n.rejected} essai${r ? 's' : ''} illisible${r ? 's' : ''} ignoré${r ? 's' : ''}.` // import.done.rejected (à valider)
  }
  return out
}

// ── view, file name ───────────────────────────────────────────────────────────

const MIN_VIEW_RADIUS = 0.3

/**
 * The view stored in an Essai, kept inside the orbit camera's guard so that a
 * compare flip lands on it exactly (an Explore eye looking level sits outside it).
 */
export function orbitView(pose: CameraPoseJSON): TrialView {
  const beta = Math.min(ORBIT_FEEL.upperBetaLimit, Math.max(ORBIT_FEEL.lowerBetaLimit, pose.beta))
  const radius = Math.min(ORBIT_FEEL.upperRadiusLimit, Math.max(MIN_VIEW_RADIUS, pose.radius))
  const target: [number, number, number] = [pose.target[0], pose.target[1], pose.target[2]]
  return { pose: { alpha: pose.alpha, beta, radius, target }, pivot: [...target] }
}

export function exportFileName(levelId: string, d: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  const safe = levelId.replace(/[^a-z0-9-]/gi, '-')
  return `essais-${safe}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.essai.json`
}
