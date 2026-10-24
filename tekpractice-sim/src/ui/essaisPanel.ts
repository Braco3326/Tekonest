/**
 * Essais side panel (Task 14, ADR-0012 phase 1) — a thin DOM adapter.
 * Lazy chunk: game.ts loads it at boot (never on the critical path).
 *
 * - Decisions (names, list, captions, no-op, 1st-year limit, compare table,
 *   notices) come from the pure view model src/trials/essaisViewModel.ts.
 * - The rig is never touched here: the host (game.ts) captures and applies
 *   designs and moves the camera. A compare preview is read-only and is never
 *   written to any store; closing it re-applies the live design kept in memory.
 * - Every store failure is shown (council NN2), in a polite live region.
 * Inspired by the freeze-and-compare behaviour of pro acoustic-design tools
 * (behaviour only: no names, wording or look).
 */
import type { LevelState, TeachingEvent } from '../engine/types'
import { exportQuarantine, exportTrails, importTrails } from '../trials/export'
import { fingerprint, rulesRevOf } from '../trials/fingerprint'
import { TRIALS_KEY, TrialStore, type LoadResult, type StoreWarning, type TrialStorage, type WriteFailure } from '../trials/store'
import { createTrial, newTrialId, TrialError, type DeepReadonly, type DesignState, type Trial, type TrialView } from '../trials/trial'
import {
  caption,
  COPY,
  compareView,
  currentRow,
  essaisRows,
  exportFileName,
  freezeDecision,
  importNotice,
  limitCounter,
  liveState,
  year1Overflow,
  loadNotice,
  nearBudget,
  orbitView,
  trialLabel,
  writeFailure,
  YEAR1_MAX,
  type ContentRefs,
  type Notice,
  type Year,
} from '../trials/essaisViewModel'
import type { CameraPoseJSON } from '../camera/presets'
import { dockBelow } from './viewCube'

export interface EssaisHost {
  /** #hud: the panel and the caption bar are appended here. */
  root: HTMLElement
  /** The objectives card the panel docks under (null: top of the screen). */
  anchor: HTMLElement | null
  storage: TrialStorage
  levelId: string
  year(): Year
  /** Graph snapshot + placements + room id of the LIVE setup. */
  captureDesign(): DesignState
  /** catalog.rules, hashed once into `rulesRev` (rulesRevOf). */
  rules: unknown
  /** The room the setup lives in (geometryRev: null until rooms carry a tool-generated one). */
  room: ContentRefs['room']
  evidence(): { ruleResults: TeachingEvent[]; levelState: LevelState }
  /** Current camera pose (Explore: the walker's eye as an orbit pose). */
  cameraPose(): CameraPoseJSON
  ruleTitle(ruleId: string): string
  /** Room display name (« Salle polyvalente »), never the raw id. */
  roomName(roomId: string): string
  /** 'preview' = compare (read-only, quiet, no live notification); 'live' = restore. */
  applyDesign(design: DeepReadonly<DesignState>, mode: 'preview' | 'live'): void
  flyTo(view: DeepReadonly<TrialView>): void
  /** Compare starts / ends: lock editing, orbit view, give the base view back. */
  enterCompare(): void
  exitCompare(): void
  toast(kind: 'info' | 'warning' | 'error', title: string, body?: string): void
  keyLabel(action: 'FREEZE_ESSAI' | 'COMPARE_FLIP'): string
  onOpenChange(open: boolean): void
}

type Kind = 'info' | 'warning' | 'error'
interface Message {
  kind: Kind
  title: string
  body?: string
  actions?: { id: string; label: string; primary?: boolean }[]
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const LIVE_DEBOUNCE_MS = 200

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.hidden = true
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export class EssaisPanel {
  private el: HTMLElement
  private cap: HTMLElement
  private store: TrialStore
  private ready: Promise<void>
  private trials: readonly Trial[] = []
  private displayedId: string | null = null
  private selectedId: string | null = null
  private liveFp: string | null = null
  private notice: Notice | null = null
  private message: Message | null = null
  private readOnly = false
  private busy = false
  private predictionAt: string | null = null
  private compare: { aId: string; bId: string; shown: 'a' | 'b'; live: DesignState } | null = null
  private liveTimer: ReturnType<typeof setTimeout> | null = null
  private liveSeq = 0
  private confirmFor: { kind: 'restore' | 'delete' | 'archive'; id?: string; ids?: string[] } | null = null
  private rulesRev: Promise<string> | null = null
  /** openCompare() is awaiting the store: a second open must not start. */
  private opening = false

  constructor(private host: EssaisHost) {
    this.store = new TrialStore(host.storage)
    this.el = document.createElement('aside')
    this.el.id = 'essais-panel'
    this.el.className = 'essais-panel'
    this.el.hidden = true
    this.el.setAttribute('aria-labelledby', 'essais-title')
    this.el.innerHTML = this.skeleton()
    this.cap = document.createElement('div')
    this.cap.id = 'essais-caption'
    this.cap.className = 'essais-caption'
    this.cap.hidden = true
    this.cap.setAttribute('role', 'status')
    host.root.append(this.el, this.cap)
    dockBelow(this.el, host.anchor)
    this.wire()
    this.ready = this.store.load().then((r) => this.loaded(r))
    // Another tab wrote the Essais (final review #2): re-read, so this tab's
    // list is current and its next write merges instead of overwriting.
    window.addEventListener('storage', (e) => {
      if (e.key !== TRIALS_KEY && e.key !== null) return
      this.ready = this.ready.then(() => this.store.reload()).then((r) => this.loaded(r))
    })
  }

  private loaded(r: LoadResult): void {
    this.trials = r.trials
    this.notice = loadNotice(r, this.store.bytesUsed() / this.store.budget) ?? this.notice
    this.readOnly = r.warnings.some((w: StoreWarning) =>
      ['quarantine-truncated', 'quarantine-failed', 'storage-unavailable', 'crypto-unavailable'].includes(w),
    )
    this.render()
  }

  // ── public surface (toolbar, keys, game) ─────────────────────────────────────
  isOpen(): boolean {
    return !this.el.hidden
  }
  comparing(): boolean {
    return this.compare !== null
  }
  open(focus = true): void {
    if (this.isOpen()) return
    this.el.hidden = false
    this.cap.hidden = false
    this.host.onOpenChange(true)
    this.render()
    if (focus) this.q<HTMLElement>('#es-prediction').focus()
  }
  close(): void {
    if (!this.isOpen()) return
    if (this.compare) this.closeCompare(false)
    const hadFocus = this.el.contains(document.activeElement)
    this.confirmFor = null
    this.el.hidden = true
    this.cap.hidden = true
    this.host.onOpenChange(false)
    if (hadFocus) document.getElementById('essais-toggle')?.focus()
  }

  /** The live setup changed (graph or placement): recompute its fingerprint, debounced. */
  liveChanged(): void {
    if (this.compare) return
    if (this.liveTimer) clearTimeout(this.liveTimer)
    this.liveTimer = setTimeout(() => {
      this.liveTimer = null
      const seq = ++this.liveSeq
      void fingerprint(this.host.captureDesign())
        .then((fp) => {
          if (seq !== this.liveSeq || this.compare) return
          this.liveFp = fp
          this.render()
        })
        .catch(() => undefined) // crypto missing: the load notice already says read-only
    }, LIVE_DEBOUNCE_MS)
  }

  /** KeyB / « Comparer »: opens the compare, then flips A ⇄ B. */
  compareKey(): void {
    if (this.compare) this.flip()
    else void this.openCompare()
  }

  // ── freeze ───────────────────────────────────────────────────────────────────
  async freeze(): Promise<void> {
    if (this.compare) {
      this.host.toast('info', COPY.locked)
      return
    }
    if (this.busy || this.opening) return
    this.busy = true
    // Everything the Essai freezes is read NOW, before any await: a key pressed
    // right after G (B opens a preview) must never leak into this Essai.
    const design = this.host.captureDesign()
    const evidence = this.host.evidence()
    const view = orbitView(this.host.cameraPose())
    const text = this.q<HTMLTextAreaElement>('#es-prediction').value
    const note = this.q<HTMLTextAreaElement>('#es-note').value
    const typedAt = this.predictionAt
    try {
      await this.ready
      this.open(false)
      this.confirmFor = null
      if (this.readOnly) {
        this.say({ kind: 'error', title: writeFailure('read-only').title, actions: [{ id: 'export-quarantine', label: COPY.quarantineExport }] })
        return
      }
      let liveFp: string
      try {
        liveFp = await fingerprint(design)
      } catch {
        this.say({ kind: 'error', title: writeFailure('read-only').title })
        return
      }
      this.liveFp = liveFp
      let refs: ContentRefs
      try {
        this.rulesRev ??= rulesRevOf(this.host.rules)
        refs = { rulesRev: await this.rulesRev, room: this.host.room }
      } catch {
        this.rulesRev = null
        this.say({ kind: 'error', title: writeFailure('read-only').title })
        return
      }
      const year = this.host.year()
      const decision = freezeDecision({ trials: this.trials, displayed: this.displayed(), liveFp, refs, year })
      if (decision.kind === 'noop') {
        this.host.toast('info', COPY.noChange(decision.name), COPY.noChangeHint)
        this.say({ kind: 'info', title: COPY.noChange(decision.name), body: COPY.noChangeHint })
        return
      }
      if (decision.kind === 'limit') {
        this.say({
          kind: 'warning',
          title: COPY.limitTitle,
          body: COPY.limitBody,
          actions: [
            { id: 'export', label: COPY.limitExport, primary: true },
            { id: 'delete', label: COPY.delete },
          ],
        })
        return
      }
      if (text.trim() === '') {
        this.say({ kind: 'warning', title: COPY.predictionRequired, body: COPY.predictionHelp })
        this.q<HTMLElement>('#es-prediction').focus()
        return
      }
      const now = new Date()
      const writtenAt = typedAt && Date.parse(typedAt) <= now.getTime() ? typedAt : now.toISOString()
      const parent = decision.parentId ? (this.trials.find((t) => t.id === decision.parentId) ?? null) : null
      const { ruleResults, levelState } = evidence
      let trial: Trial
      try {
        trial = await createTrial(
          {
            name: decision.name,
            design,
            consumed: { room: refs.room },
            view,
            evidence: {
              prediction: { text, writtenAt },
              ruleResults,
              levelState,
              rulesRev: refs.rulesRev,
              note,
            },
            parent,
            levelId: this.host.levelId,
          },
          now,
          newTrialId(now.getTime()),
        )
      } catch (err) {
        const code = err instanceof TrialError ? err.code : 'invalid-design'
        this.say({
          kind: 'error',
          title: code === 'prediction-required' ? COPY.predictionRequired : code === 'crypto-unavailable' ? writeFailure('read-only').title : writeFailure('invalid').title,
          body: writeFailure('invalid').body,
        })
        return
      }
      const r = await this.store.append(trial)
      if (!r.ok) {
        this.failed(r.reason)
        return
      }
      this.trials = this.store.list()
      this.displayedId = trial.id
      this.selectedId = trial.id
      this.liveFp = trial.fingerprint
      this.q<HTMLTextAreaElement>('#es-prediction').value = ''
      this.q<HTMLTextAreaElement>('#es-note').value = ''
      this.predictionAt = null
      this.message = null
      if (r.warnings.includes('near-budget')) this.notice = nearBudget(this.store.bytesUsed() / this.store.budget)
      this.wrote(r.warnings)
      this.host.toast('info', COPY.frozenToast(trial.name))
      this.render()
    } finally {
      this.busy = false
    }
  }

  // ── compare (read-only preview) ──────────────────────────────────────────────
  private async openCompare(): Promise<void> {
    // One compare at a time; never while a freeze or another open is in flight
    // (a second open would capture the PREVIEW as the "live" design).
    if (this.compare || this.opening || this.busy) return
    this.opening = true
    try {
      await this.ready
    } finally {
      this.opening = false
    }
    if (this.compare || this.busy) return
    if (this.trials.length < 2) {
      this.open(false)
      this.say({ kind: 'info', title: COPY.compareDisabled })
      return
    }
    this.open(false)
    this.confirmFor = null
    this.message = null
    const ordered = [...this.trials].sort((x, y) => (x.frozenAt < y.frozenAt ? -1 : x.frozenAt > y.frozenAt ? 1 : 0))
    const b = this.find(this.selectedId) ?? this.displayed() ?? ordered[ordered.length - 1]
    const parent = b.parentId ? this.find(b.parentId) : null
    const others = ordered.filter((t) => t.id !== b.id)
    const a = parent ?? others[others.length - 1]
    // Keep the live design in memory: it is re-applied, exactly, on close.
    this.compare = { aId: a.id, bId: b.id, shown: 'b', live: this.host.captureDesign() }
    this.host.enterCompare()
    this.show()
    this.q<HTMLElement>('#es-flip').focus()
  }

  private flip(): void {
    if (!this.compare) return
    this.compare.shown = this.compare.shown === 'a' ? 'b' : 'a'
    this.show()
  }

  private show(): void {
    if (!this.compare) return
    const t = this.find(this.compare.shown === 'a' ? this.compare.aId : this.compare.bId)
    if (!t) return
    this.host.applyDesign(t.design, 'preview')
    this.host.flyTo(t.view)
    this.render()
  }

  /** Esc step 3b / « Fermer la comparaison »: the live setup comes back exactly. */
  closeCompare(focusButton = true): void {
    const c = this.compare
    if (!c) return
    this.compare = null
    this.host.applyDesign(c.live, 'live')
    this.host.exitCompare()
    this.render()
    if (focusButton && this.isOpen()) this.q<HTMLElement>('#es-compare').focus()
  }

  // ── restore, delete, export, import ──────────────────────────────────────────
  private restore(id: string, confirmed: boolean): void {
    const t = this.find(id)
    if (!t || this.compare || this.busy || this.opening) return
    const unsaved = this.liveFp !== null && !this.trials.some((x) => x.fingerprint === this.liveFp)
    if (unsaved && !confirmed) {
      this.confirmFor = { kind: 'restore', id }
      this.render()
      this.q<HTMLElement>('#es-confirm-ok').focus()
      return
    }
    this.confirmFor = null
    this.displayedId = t.id
    this.liveFp = t.fingerprint
    this.host.applyDesign(t.design, 'live')
    if (t.design.roomId !== this.host.captureDesign().roomId) this.host.toast('warning', COPY.otherRoom)
    this.host.toast('info', COPY.restoredToast(t.name))
    this.message = null
    this.render()
  }

  private async remove(id: string): Promise<void> {
    const t = this.find(id)
    if (!t) return
    this.confirmFor = null
    const r = await this.store.remove(id)
    if (!r.ok) {
      this.failed(r.reason)
      return
    }
    this.wrote(r.warnings)
    this.trials = this.store.list()
    if (this.displayedId === id) this.displayedId = null
    if (this.selectedId === id) this.selectedId = null
    this.message = null
    this.host.toast('info', COPY.deleted(t.name))
    this.render()
  }

  /** Returns the exported ids (for « Exporter puis archiver »). */
  private exportAll(): string[] {
    const name = exportFileName(this.host.levelId)
    download(name, exportTrails(this.trials))
    this.host.toast('info', COPY.exportDone(name), COPY.exportDeclaratif)
    return this.trials.map((t) => t.id)
  }

  private exportQuarantined(): void {
    const r = exportQuarantine(this.host.storage)
    if (!r.ok) {
      this.say({ kind: 'warning', title: COPY.quarantineNothing })
      return
    }
    const name = exportFileName(`${this.host.levelId}-quarantaine`).replace(/\.essai\.json$/, '.json')
    download(name, r.json)
    this.host.toast('info', COPY.quarantineDone(name))
  }

  private async archive(ids: string[]): Promise<void> {
    this.confirmFor = null
    let n = 0
    const warned: StoreWarning[] = []
    for (const id of ids) {
      const r = await this.store.remove(id)
      if (!r.ok) {
        this.failed(r.reason)
        break
      }
      warned.push(...r.warnings)
      n++
    }
    this.trials = this.store.list()
    if (this.displayedId && !this.find(this.displayedId)) this.displayedId = null
    if (this.selectedId && !this.find(this.selectedId)) this.selectedId = null
    if (n > 0) {
      this.notice = null
      this.wrote(warned)
      this.host.toast('info', COPY.archived(n))
    }
    this.render()
  }

  private async importFile(file: File): Promise<void> {
    let text: string
    try {
      text = await file.text()
    } catch {
      this.say({ kind: 'error', title: COPY.importRead })
      return
    }
    const r = await importTrails(text)
    if (!r.ok) {
      const title = r.reason === 'version' ? COPY.importVersion : r.reason === 'corrupt' ? COPY.importCorrupt : r.reason === 'format' ? COPY.importFormat : writeFailure('read-only').title
      this.say({ kind: 'error', title })
      return
    }
    await this.ready
    const have = new Set(this.trials.map((t) => t.id))
    const fresh = r.trials.filter((t) => !have.has(t.id))
    if (this.host.year() === 1 && this.trials.length + fresh.length > YEAR1_MAX) {
      this.say({ kind: 'warning', title: COPY.importLimit })
      return
    }
    let imported = 0
    for (const t of fresh) {
      const w = await this.store.append(t)
      if (!w.ok) {
        this.trials = this.store.list()
        this.failed(w.reason)
        return
      }
      this.wrote(w.warnings)
      imported++
    }
    this.trials = this.store.list()
    this.say({ kind: 'info', title: importNotice({ imported, duplicates: r.trials.length - fresh.length, rejected: r.rejected }) })
  }

  /**
   * A successful write may have merged another tab's list and set a copy aside
   * (re-review 2a): 'quarantine-evicted' shows the quarantine notice, like on load.
   */
  private wrote(warnings: readonly StoreWarning[]): void {
    if (warnings.includes('quarantine-evicted'))
      this.notice = loadNotice({ quarantined: true, warnings }, this.store.bytesUsed() / this.store.budget)
  }

  private failed(reason: WriteFailure): void {
    const f = writeFailure(reason)
    const actions =
      reason === 'budget'
        ? [{ id: 'export-archive', label: COPY.nearButton, primary: true }]
        : reason === 'read-only'
          ? [{ id: 'export-quarantine', label: COPY.quarantineExport }]
          : [{ id: 'export', label: COPY.limitExport }]
    this.say({ kind: 'error', title: f.title, body: f.body || undefined, actions })
  }

  // ── DOM ──────────────────────────────────────────────────────────────────────
  private q<T extends HTMLElement>(sel: string): T {
    return this.el.querySelector<T>(sel)!
  }
  private find(id: string | null): Trial | null {
    return id ? (this.trials.find((t) => t.id === id) ?? null) : null
  }
  private displayed(): Trial | null {
    return this.find(this.displayedId)
  }
  private say(m: Message): void {
    this.message = m
    this.render()
  }

  private skeleton(): string {
    return `<header class="ex-head"><h2 id="essais-title">${esc(COPY.panelTitle)}</h2>
        <button type="button" class="ex-close" id="es-close" aria-label="${esc(COPY.closeAria)}">×</button></header>
      <div class="es-notice" role="status" aria-live="polite"></div>
      <div class="es-normal">
        <section class="es-current" aria-labelledby="es-current-title" title="${esc(COPY.currentHelp)}">
          <strong id="es-current-title">${esc(COPY.currentTitle)}</strong><span class="es-current-state"></span>
        </section>
        <p class="es-empty es-help"></p>
        <ul class="es-list" aria-label="${esc(COPY.listAria)}"></ul>
        <p class="es-counter"></p>
        <div class="es-field">
          <label for="es-prediction">${esc(COPY.predictionLabel)}</label>
          <textarea id="es-prediction" rows="2" placeholder="${esc(COPY.predictionPlaceholder)}" aria-describedby="es-prediction-help"></textarea>
          <p class="es-help" id="es-prediction-help">${esc(COPY.predictionHelp)}</p>
        </div>
        <div class="es-field">
          <label for="es-note">${esc(COPY.noteLabel)}</label>
          <textarea id="es-note" rows="2" placeholder="${esc(COPY.notePlaceholder)}"></textarea>
        </div>
        <div class="es-actions">
          <button type="button" id="es-freeze" class="ex-primary" title="${esc(COPY.freezeAria)}"></button>
          <button type="button" id="es-compare" title="${esc(COPY.compareTooltip)}" aria-describedby="es-compare-why"></button>
          <p class="es-why es-wide" id="es-compare-why"></p>
          <button type="button" id="es-restore" class="es-wide">${esc(COPY.restore)}</button>
          <button type="button" id="es-delete" class="es-wide" aria-describedby="es-delete-why">${esc(COPY.delete)}</button>
          <p class="es-why es-wide" id="es-delete-why"></p>
          <button type="button" id="es-export" class="es-wide" title="${esc(COPY.exportAria)}">${esc(COPY.exportTeacher)}</button>
          <button type="button" id="es-import" class="es-wide" aria-label="${esc(COPY.importAria)}">${esc(COPY.import)}</button>
          <input type="file" id="es-file" accept=".json,application/json" hidden aria-label="${esc(COPY.importChoose)}" />
        </div>
        <div class="es-confirm" role="alertdialog" aria-labelledby="es-confirm-text" hidden></div>
        <p class="es-declaratif">${esc(COPY.exportDeclaratif)}</p>
      </div>
      <section class="es-compare" aria-labelledby="es-compare-title" hidden>
        <h3 id="es-compare-title">${esc(COPY.compareTitle)}</h3>
        <p class="es-readonly">${esc(COPY.readOnly)}</p>
        <div class="es-picks">
          <label>${esc(COPY.pickA)}<select id="es-pick-a"></select></label>
          <label>${esc(COPY.pickB)}<select id="es-pick-b"></select></label>
        </div>
        <div class="es-compare-actions">
          <button type="button" id="es-flip" class="ex-primary" title="${esc(COPY.flipAria)}"></button>
          <button type="button" id="es-close-compare"></button>
        </div>
        <table class="es-table es-showing"><caption class="sr-only">${esc(COPY.compareTitle)}</caption><thead></thead><tbody></tbody></table>
        <ul class="es-rules" aria-label="${esc(COPY.diffRules)}"></ul>
        <dl class="es-predictions"></dl>
        <p class="es-help es-manual"></p>
      </section>`
  }

  private wire(): void {
    const on = (sel: string, fn: () => void): void => this.q(sel).addEventListener('click', fn)
    on('#es-close', () => this.close())
    on('#es-freeze', () => void this.freeze())
    on('#es-compare', () => void this.openCompare())
    on('#es-flip', () => this.flip())
    on('#es-close-compare', () => this.closeCompare())
    on('#es-restore', () => this.selectedId && this.restore(this.selectedId, false))
    on('#es-delete', () => {
      if (!this.selectedId) return
      this.confirmFor = { kind: 'delete', id: this.selectedId }
      this.render()
      this.q<HTMLElement>('#es-confirm-ok').focus()
    })
    on('#es-export', () => void this.exportAll())
    on('#es-import', () => this.q<HTMLInputElement>('#es-file').click())
    const file = this.q<HTMLInputElement>('#es-file')
    file.addEventListener('change', () => {
      const f = file.files?.[0]
      file.value = ''
      if (f) void this.importFile(f)
    })
    this.q('#es-prediction').addEventListener('input', () => (this.predictionAt = new Date().toISOString()))
    // Rows: click selects; Arrow Up / Down move through the list (deck help.action.essais.list).
    const list = this.q('.es-list')
    list.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('.es-row')
      if (b?.dataset.id) this.select(b.dataset.id, true)
    })
    list.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const rows = [...list.querySelectorAll<HTMLElement>('.es-row')]
      const i = rows.indexOf(document.activeElement as HTMLElement)
      const next = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (next?.dataset.id) {
        e.preventDefault()
        this.select(next.dataset.id, true)
      }
    })
    const pick = (side: 'a' | 'b') => (e: Event) => {
      if (!this.compare) return
      const id = (e.target as HTMLSelectElement).value
      if (side === 'a') this.compare.aId = id
      else this.compare.bId = id
      this.compare.shown = side
      this.show()
    }
    this.q('#es-pick-a').addEventListener('change', pick('a'))
    this.q('#es-pick-b').addEventListener('change', pick('b'))
    // Notice / confirm buttons are re-rendered: one delegated listener.
    this.el.addEventListener('click', (e) => {
      const act = (e.target as Element).closest<HTMLElement>('[data-act]')?.dataset.act
      if (act) void this.act(act)
    })
  }

  private select(id: string, focus: boolean): void {
    this.selectedId = id
    this.confirmFor = null
    this.render()
    if (focus) this.el.querySelector<HTMLElement>(`.es-row[data-id="${CSS.escape(id)}"]`)?.focus()
  }

  private async act(act: string): Promise<void> {
    switch (act) {
      case 'export':
        this.exportAll()
        break
      case 'export-quarantine':
        this.exportQuarantined()
        break
      case 'export-archive': {
        const ids = this.exportAll()
        if (ids.length === 0) return
        this.confirmFor = { kind: 'archive', ids }
        this.render()
        this.q<HTMLElement>('#es-confirm-ok').focus()
        break
      }
      case 'delete':
        if (!this.selectedId) this.selectedId = this.trials[this.trials.length - 1]?.id ?? null
        if (this.selectedId) {
          this.confirmFor = { kind: 'delete', id: this.selectedId }
          this.render()
          this.q<HTMLElement>('#es-confirm-ok').focus()
        }
        break
      case 'dismiss':
        this.notice = null
        this.render()
        break
      case 'dismiss-message':
        this.message = null
        this.render()
        break
      case 'confirm-ok': {
        const c = this.confirmFor
        if (!c) return
        if (c.kind === 'restore' && c.id) this.restore(c.id, true)
        else if (c.kind === 'delete' && c.id) await this.remove(c.id)
        else if (c.kind === 'archive' && c.ids) await this.archive(c.ids)
        break
      }
      case 'confirm-cancel':
        this.confirmFor = null
        this.render()
        this.q<HTMLElement>('#es-restore').focus()
        break
    }
  }

  private render(): void {
    if (this.el.hidden && this.cap.hidden) return
    const year = this.host.year()
    const displayed = this.displayed()
    const state = liveState(displayed, this.liveFp)
    const comparing = this.compare
    const shown = comparing ? this.find(comparing.shown === 'a' ? comparing.aId : comparing.bId) : null

    // caption bar: always « Affiché : … »
    this.cap.textContent = caption({ displayed, state, comparing: shown })
    this.cap.dataset.stale = String(!comparing && state === 'modified')

    // notice (store) + message (last action), one polite live region
    const box = this.q('.es-notice')
    const parts: string[] = []
    const kindOf = (n: Notice): Kind => (n.kind === 'read-only' ? 'error' : 'warning')
    const actLabel: Record<string, string> = {
      'export-quarantine': COPY.quarantineExport,
      'export-archive': COPY.nearButton,
      dismiss: this.notice?.kind === 'quarantine' ? COPY.quarantineContinue : COPY.later,
    }
    if (this.notice) {
      parts.push(
        `<p><strong>${esc(this.notice.title)}</strong></p>${this.notice.body ? `<p>${esc(this.notice.body)}</p>` : ''}
        <div class="es-notice-actions">${this.notice.actions.map((a) => `<button type="button" data-act="${a}">${esc(actLabel[a])}</button>`).join('')}</div>`,
      )
    }
    const over = year1Overflow(this.trials.length, year)
    if (over) parts.push(`<p><strong>${esc(over.title)}</strong></p><p>${esc(over.body)}</p>`)
    if (this.message) {
      const m = this.message
      parts.push(
        `<p><strong>${esc(m.title)}</strong></p>${m.body ? `<p>${esc(m.body)}</p>` : ''}${
          m.actions?.length
            ? `<div class="es-notice-actions">${m.actions.map((a) => `<button type="button" data-act="${a.id}"${a.primary ? ' class="ex-primary"' : ''}>${esc(a.label)}</button>`).join('')}</div>`
            : ''
        }`,
      )
    }
    const html = parts.join('')
    if (box.innerHTML !== html) box.innerHTML = html
    box.dataset.kind = this.message?.kind ?? (this.notice ? kindOf(this.notice) : 'info')

    this.q('.es-normal').hidden = comparing !== null
    this.q('.es-compare').hidden = comparing === null

    // Montage actuel
    const cur = currentRow(displayed, state)
    const curEl = this.q('.es-current')
    curEl.dataset.state = state
    this.q('.es-current-state').textContent = cur.text

    // list
    if (this.selectedId && !this.find(this.selectedId)) this.selectedId = null
    const rows = essaisRows(this.trials, { year, displayedId: this.displayedId, selectedId: this.selectedId })
    this.q('.es-empty').textContent = rows.length ? '' : COPY.empty
    this.q('.es-empty').hidden = rows.length > 0
    const focusedId = (document.activeElement as HTMLElement | null)?.closest?.('.es-row')?.getAttribute('data-id') ?? null
    const listHtml = rows
      .map(
        (r) => `<li><button type="button" class="es-row" data-id="${esc(r.id)}" aria-pressed="${r.selected}" style="margin-left:${r.depth * 14}px;width:calc(100% - ${r.depth * 14}px)">
          <span class="es-name">${esc(r.label)}</span>${r.displayed ? `<span class="es-badge">${esc(COPY.displayedBadge)}</span>` : ''}
          <span class="es-meta">${esc(r.time)}${r.multiChange ? ` · <span class="es-flag" title="${esc(COPY.multiChangeHelp)}">${esc(COPY.multiChange)}</span>` : ''}</span></button></li>`,
      )
      .join('')
    const list = this.q('.es-list')
    if (list.innerHTML !== listHtml) {
      list.innerHTML = listHtml
      if (focusedId) list.querySelector<HTMLElement>(`.es-row[data-id="${CSS.escape(focusedId)}"]`)?.focus()
    }
    const counter = limitCounter(this.trials.length, year)
    this.q('.es-counter').textContent = counter ?? ''
    this.q('.es-counter').hidden = counter === null

    // buttons
    const kbd = (a: 'FREEZE_ESSAI' | 'COMPARE_FLIP'): string => `<kbd>${esc(this.host.keyLabel(a))}</kbd>`
    const setHtml = (sel: string, html: string): void => {
      const b = this.q(sel)
      if (b.innerHTML !== html) b.innerHTML = html
    }
    setHtml('#es-freeze', `${esc(COPY.freeze)} ${kbd('FREEZE_ESSAI')}`)
    setHtml('#es-compare', `${esc(COPY.compare)} ${kbd('COMPARE_FLIP')}`)
    const canCompare = this.trials.length >= 2
    this.q<HTMLButtonElement>('#es-compare').disabled = !canCompare
    this.q('#es-compare-why').textContent = canCompare ? '' : COPY.compareDisabled
    this.q('#es-compare-why').hidden = canCompare
    const sel = this.find(this.selectedId)
    const selRow = rows.find((r) => r.id === this.selectedId)
    setHtml('#es-restore', esc(sel ? `${COPY.restore} (${trialLabel(sel)})` : COPY.restore))
    this.q<HTMLButtonElement>('#es-restore').disabled = !sel
    this.q<HTMLButtonElement>('#es-delete').disabled = !sel || !!selRow?.hasChildren
    this.q('#es-delete-why').textContent = selRow?.hasChildren ? COPY.deleteHasChild : ''
    this.q('#es-delete-why').hidden = !selRow?.hasChildren
    this.q<HTMLButtonElement>('#es-export').disabled = this.trials.length === 0
    this.q<HTMLButtonElement>('#es-freeze').disabled = this.readOnly
    this.q<HTMLButtonElement>('#es-import').disabled = this.readOnly

    // inline confirm (restore / delete / archive)
    const confirm = this.q('.es-confirm')
    const c = this.confirmFor
    const ct = c ? this.find(c.id ?? null) : null
    if (c && (ct || c.kind === 'archive')) {
      const text =
        c.kind === 'restore'
          ? COPY.restoreConfirm(ct!.name)
          : c.kind === 'delete'
            ? `${COPY.deleteConfirm(ct!.name)} ${COPY.deleteHint}`
            : COPY.archiveConfirm
      const ok = c.kind === 'restore' ? COPY.restoreConfirmOk(ct!.name) : c.kind === 'delete' ? COPY.deleteOk : COPY.archiveOk
      const html = `<p id="es-confirm-text">${esc(text)}</p><div class="es-notice-actions">
        <button type="button" id="es-confirm-ok" class="ex-primary" data-act="confirm-ok">${esc(ok)}</button>
        <button type="button" data-act="confirm-cancel">${esc(COPY.cancel)}</button></div>`
      if (confirm.innerHTML !== html) confirm.innerHTML = html
      confirm.hidden = false
    } else {
      confirm.hidden = true
      confirm.innerHTML = ''
    }

    // compare
    if (comparing) {
      const a = this.find(comparing.aId)
      const b = this.find(comparing.bId)
      const options = (selId: string): string =>
        [...this.trials].map((t) => `<option value="${esc(t.id)}"${t.id === selId ? ' selected' : ''}>${esc(trialLabel(t))}</option>`).join('')
      const pa = this.q<HTMLSelectElement>('#es-pick-a')
      const pb = this.q<HTMLSelectElement>('#es-pick-b')
      if (pa.innerHTML !== options(comparing.aId)) pa.innerHTML = options(comparing.aId)
      if (pb.innerHTML !== options(comparing.bId)) pb.innerHTML = options(comparing.bId)
      setHtml('#es-flip', `${esc(COPY.flip)} ${kbd('COMPARE_FLIP')}`)
      setHtml('#es-close-compare', `${esc(COPY.closeCompare)} <kbd>Échap</kbd>`)
      if (a && b) {
        const v = compareView(a, b, (id) => this.host.ruleTitle(id), (id) => this.host.roomName(id))
        const th = (col: 'a' | 'b', label: string): string =>
          `<th scope="col" data-col="${col}" class="${comparing.shown === col ? 'is-shown' : ''}">${esc(label)}${comparing.shown === col ? ` <span class="sr-only">(${esc(COPY.displayedBadge)})</span>` : ''}</th>`
        const head = `<tr><th scope="col"><span class="sr-only">Élément</span></th>${th('a', trialLabel(a))}${th('b', trialLabel(b))}<th scope="col">${esc(v.headers[3])}</th></tr>`
        const body = v.rows
          .map(
            (r) =>
              `<tr><th scope="row">${esc(r.label)}</th><td>${esc(r.a)}</td><td>${esc(r.b)}</td><td class="${r.delta === 'Changé' ? 'es-changed' : ''}">${esc(r.delta)}</td></tr>`,
          )
          .join('')
        const thead = this.q('.es-table thead')
        const tbody = this.q('.es-table tbody')
        if (thead.innerHTML !== head) thead.innerHTML = head
        if (tbody.innerHTML !== body) tbody.innerHTML = body
        this.q('.es-rules').innerHTML = v.rules.length
          ? v.rules.map((r) => `<li><strong>${esc(COPY.diffRules)} · ${esc(r.title)}</strong> : ${esc(r.verdict)}</li>`).join('')
          : ''
        this.q('.es-predictions').innerHTML = `<dt>${esc(COPY.predictionLabel)} ${esc(trialLabel(a))}</dt><dd>${esc(v.predictionA)}</dd>
          <dt>${esc(COPY.predictionLabel)} ${esc(trialLabel(b))}</dt><dd>${esc(v.predictionB)}</dd>`
        this.q('.es-manual').textContent = v.manual
      }
    }
  }
}
