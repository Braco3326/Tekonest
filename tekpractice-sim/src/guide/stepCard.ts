// The step card (onboarding packs, plan T6.1, spec 6.6): a small, calm, NON-MODAL progress presenter in the tutorial's reserved slot (src/design/tutorialSlot.ts, a row of the shell
// grid that exists only while a tutorial runs). Progress only: « Étape k sur n », one mark per step (done, current, to come, « passée », « montré », « déjà en place »), the one control
// « Passer le tutoriel ». It never repeats the bubble's sentence (Oscar keeps the instruction), never says « réussi », and shows no figure but k and n. After the last step it shows
// the closing lines (`closingLines()`, src/guide/tutorial.ts: `listen.simple`, then the mic line) with a « Fermer » button.
//
// No dialog role, no focus trap, no animation: a labelled region (`tabindex="-1"`, so Aide « Reprendre à l’étape » can move the focus onto it), buttons after the status bar in the tab
// order. The look follows the package's role tokens (src/guide/stepCard.css): `secondary` / `secondaryInk` for the card, `accent` for the current step.
//
// Pure pieces (`cardView`, `legendOf`, `createCardGate`) are tested in node; the DOM is proven in the browser (tests/e2e/onboarding-stepcard.spec.ts).
import { COPY } from '../creation/copy'
import type { StepId } from '../design/packages'
import type { TutorialRecord, TutorialStatus } from '../design/tutorialRecord'
import { closeTutorialSlot, openTutorialSlot } from '../design/tutorialSlot'

/** What a step's mark says. `done`: the step ended on its own event; `passed`: passed with « Passer cette étape »; `shown`: the power helper did it; `early`: its result was already on the bench. */
export type DotState = 'done' | 'current' | 'todo' | 'passed' | 'shown' | 'early'
export interface Dot {
  /** The step's number, 1-based. */
  k: number
  id: StepId
  state: DotState
}
export interface CardView {
  mode: 'running' | 'closing'
  /** « Étape k sur n » while running; empty in the closing card (it has a title instead). */
  count: string
  /** The closing card's heading; undefined while running. */
  title?: string
  dots: Dot[]
  /** The closing lines (`closingLines()`), closing mode only. */
  closing: string[]
}

const T = (): Readonly<Record<string, string>> => COPY.tutorialCard as Readonly<Record<string, string>>

/** The mark of a step the run has left: the strongest claim the record does NOT make is never made (shown, then early, then passed, else done). */
function markOf(id: StepId, rec: TutorialRecord): DotState {
  if (rec.shown.includes(id)) return 'shown'
  if (rec.early.includes(id)) return 'early'
  if (rec.passed.includes(id)) return 'passed'
  return 'done'
}

/**
 * What the card shows, from the run's step list and the guide's record. Null when there is nothing to show: no steps, a record that is not running, or a finished run that was not
 * finished on this page (`finishedHere` false: a reload after the end shows no card).
 */
export function cardView(i: { steps: readonly StepId[]; record: TutorialRecord; closing: readonly string[]; finishedHere: boolean }): CardView | null {
  const { steps, record: rec } = i
  const n = steps.length
  if (n === 0) return null
  if (rec.status === 'running') {
    const at = rec.step === null ? -1 : steps.indexOf(rec.step)
    const k = at >= 0 ? at + 1 : Math.min(n, Math.max(1, rec.k))
    const dots: Dot[] = steps.map((id, idx) => ({ k: idx + 1, id, state: idx + 1 < k ? markOf(id, rec) : idx + 1 === k ? 'current' : 'todo' }))
    return { mode: 'running', count: T().step.replace('{k}', String(k)).replace('{n}', String(n)), dots, closing: [] }
  }
  if (rec.status === 'done' && i.finishedHere) {
    return { mode: 'closing', count: '', title: T().closingTitle, dots: steps.map((id, idx) => ({ k: idx + 1, id, state: markOf(id, rec) })), closing: [...i.closing] }
  }
  return null
}

const LEGEND_ORDER: readonly DotState[] = ['done', 'passed', 'shown', 'early']
/** The key to the marks: empty while every mark is plain (done, current, to come); else « faite » and every mark in use, in a fixed order. */
export function legendOf(view: CardView): DotState[] {
  const used = new Set(view.dots.map((d) => d.state))
  if (!(used.has('passed') || used.has('shown') || used.has('early'))) return []
  return LEGEND_ORDER.filter((s) => s === 'done' || used.has(s))
}

/**
 * When the card is on the page: while the run goes on; after a run that ended `done` ON THIS PAGE until the learner closes it; never for a run found finished on a reload, a skipped one
 * or an interrupted one. The dismissal belongs to one run (a new run shows the card again).
 */
export function createCardGate(): { next(status: TutorialStatus): 'running' | 'closing' | null; dismiss(): void } {
  let seenRunning = false
  let dismissed = false
  return {
    next(status) {
      if (status === 'running') {
        seenRunning = true
        dismissed = false
        return 'running'
      }
      if (status === 'done' && seenRunning) return dismissed ? null : 'closing'
      if (status !== 'done') seenRunning = false
      return null
    },
    dismiss() {
      dismissed = true
    },
  }
}

// ── the DOM ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg'
/** One path per glyph (16 x 16, stroke only, square caps): a tick, a dash, a diamond, an equals sign. Drawn, not typed: a font may lack the characters. */
const GLYPHS: Readonly<Partial<Record<DotState, string>>> = {
  done: 'M3.5 8.5 6.5 11.5 12.5 4.5',
  passed: 'M4 8h8',
  shown: 'M8 3 13 8 8 13 3 8z',
  early: 'M4 6h8M4 10h8',
}
const STATE_KEY: Readonly<Record<DotState, string>> = { done: 'stateDone', current: 'stateCurrent', todo: 'stateTodo', passed: 'statePassed', shown: 'stateShown', early: 'stateEarly' }

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

/** A mark: a glyph for done, passed, shown and early; the step's number for current and to come. Hidden from assistive tech (the item carries the words). */
function markEl(doc: Document, state: DotState, k: number): HTMLElement {
  const m = el(doc, 'span', 'tp-sc-mark')
  m.setAttribute('aria-hidden', 'true')
  const d = GLYPHS[state]
  if (d === undefined) {
    m.textContent = String(k)
    return m
  }
  const svg = doc.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('focusable', 'false')
  const path = doc.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', d)
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-linecap', 'square')
  svg.appendChild(path)
  m.appendChild(svg)
  return m
}

/**
 * The slot opened or closed: the shell's rows moved, so the page is told what a window resize tells it (the widget re-reads its insets and obstacles and puts Oscar back to rest clear of
 * the row; the view cube and the render loop re-measure). No new listener: the existing ones hear it. Never throws.
 */
function relayout(doc: Document): void {
  try {
    const win = doc.defaultView
    if (win !== null && typeof win.dispatchEvent === 'function' && typeof Event === 'function') win.dispatchEvent(new Event('resize'))
  } catch {
    // nothing to tell
  }
}

export interface StepCardDeps {
  doc: Document
  /** The step ids of the run, in order (the guide's flow). */
  steps: readonly StepId[]
  /** The package's presenter: the card is the main presenter (`step-card`) or the checklist is and the card is its quiet companion (`checklist`): a compact look (CSS). */
  presenter: 'step-card' | 'checklist'
  /** The guide's record, read at each update. */
  record(): TutorialRecord
  /** The closing lines now (`closingLines()` over the bench's mic verdict), read while the closing card shows. */
  closing(): string[]
  /** « Passer le tutoriel ». */
  skip(): void
}
export interface StepCard {
  /** Reads the record again: shows, updates or removes the card (and frees the slot). Never throws. */
  update(): void
  destroy(): void
}

/**
 * Mounts the card machinery. Nothing is created until the record says a run is on: the slot appears with the run and leaves with it (a skip, an interruption, the close button).
 * A page with no shell (the level page) or a document without the DOM calls gets null.
 */
export function mountStepCard(d: StepCardDeps): StepCard | null {
  const { doc } = d
  if (typeof doc.querySelector !== 'function' || typeof doc.createElement !== 'function') return null
  const gate = createCardGate()
  let card: HTMLElement | null = null
  let built: { count: HTMLElement; steps: HTMLElement; action: HTMLButtonElement; legend: HTMLElement; closing: HTMLElement } | null = null
  let key = ''
  let mode: 'running' | 'closing' = 'running'

  const build = (slot: HTMLElement): void => {
    const root = el(doc, 'section', 'tp-stepcard')
    root.dataset.testid = 'tutorial-card'
    root.dataset.presenter = d.presenter
    root.setAttribute('aria-label', T().label)
    root.tabIndex = -1
    const count = el(doc, 'p', 'tp-sc-count')
    count.dataset.testid = 'tutorial-step-count'
    const steps = el(doc, 'ol', 'tp-sc-steps')
    steps.dataset.testid = 'tutorial-steps'
    steps.setAttribute('aria-label', T().stepsLabel)
    const legend = el(doc, 'ul', 'tp-sc-legend')
    legend.dataset.testid = 'tutorial-legend'
    const closing = el(doc, 'div', 'tp-sc-closing')
    closing.dataset.testid = 'tutorial-closing'
    const action = el(doc, 'button', 'tp-sc-action')
    action.type = 'button'
    action.dataset.testid = 'tutorial-skip'
    action.addEventListener('click', () => {
      if (mode === 'running') d.skip()
      else {
        gate.dismiss()
        update()
      }
    })
    root.append(count, steps, action, legend, closing)
    slot.appendChild(root)
    card = root
    built = { count, steps, action, legend, closing }
    key = ''
  }

  const leave = (): void => {
    const had = card !== null && card.contains(doc.activeElement)
    card = null
    built = null
    key = ''
    closeTutorialSlot(doc)
    relayout(doc)
    // the focus was on the card's button: it goes back to the 3D view, never to the page
    if (had) {
      const canvas = doc.getElementById('renderCanvas')
      if (canvas !== null && canvas.style.display !== 'none') canvas.focus()
    }
  }

  function update(): void {
    try {
      const rec = d.record()
      const m = gate.next(rec.status)
      if (m === null) {
        if (card !== null || doc.querySelector('[data-testid="tutorial-slot"]') !== null) leave()
        return
      }
      mode = m
      const view = cardView({ steps: d.steps, record: rec, closing: m === 'closing' ? d.closing() : [], finishedHere: m === 'closing' })
      if (view === null) {
        if (card !== null) leave()
        return
      }
      let opened = false
      if (card === null || !card.isConnected) {
        const slot = openTutorialSlot(doc)
        if (slot === null) return
        build(slot)
        opened = true
      }
      const b = built!
      const next = JSON.stringify(view)
      if (next === key) return
      key = next
      card!.dataset.mode = view.mode
      b.count.textContent = view.mode === 'running' ? view.count : (view.title ?? '')
      b.steps.replaceChildren(
        ...view.dots.map((dot) => {
          const li = el(doc, 'li', 'tp-sc-dot')
          li.dataset.state = dot.state
          li.dataset.step = dot.id
          li.dataset.k = String(dot.k)
          li.append(markEl(doc, dot.state, dot.k), el(doc, 'span', 'tp-sr', T().stepState.replace('{k}', String(dot.k)).replace('{state}', T()[STATE_KEY[dot.state]])))
          return li
        }),
      )
      const legend = legendOf(view)
      b.legend.hidden = legend.length === 0
      b.legend.replaceChildren(
        ...legend.map((s) => {
          const li = el(doc, 'li', 'tp-sc-key')
          li.dataset.state = s
          const swatch = el(doc, 'span', 'tp-sc-dot tp-sc-dot--key')
          swatch.dataset.state = s
          swatch.append(markEl(doc, s, 0))
          li.append(swatch, el(doc, 'span', undefined, T()[STATE_KEY[s]]))
          return li
        }),
      )
      b.closing.hidden = view.closing.length === 0
      b.closing.replaceChildren(...view.closing.map((line) => el(doc, 'p', undefined, line)))
      b.action.textContent = view.mode === 'running' ? COPY.tutorialUi!.skip : T().close
      if (opened) relayout(doc) // the row has its content now: the page measures it
    } catch (e) {
      try {
        console.warn('guide: the step card stopped', e)
      } catch {
        // nothing left to say it to
      }
    }
  }

  return {
    update,
    destroy() {
      if (card !== null || doc.querySelector('[data-testid="tutorial-slot"]') !== null) leave()
    },
  }
}
