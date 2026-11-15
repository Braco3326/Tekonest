/**
 * The plain tutorial's coach card, DOM (mission 1, spec 4; the steps are plainTutorial.ts, the wiring firstVisit.ts). It sits in the tutorial's reserved row of the shell grid
 * (src/design/tutorialSlot.ts, the row the first-sound framing keeps free: `TUTORIAL_ROW_PX`), under the menu bar, so it never covers the 3D view, its view cube, the drawer or the
 * panels. No assistant: no avatar, no name, no icon, never the first person (the copy section `plainTutorial` is read as product voice by tests/creation/assistantWording.test.ts).
 *
 * A labelled region (no dialog role, no `aria-modal`, nothing inert, no focus trap, no animation). While a step runs: « Étape k sur 4 », what to do, the step's hint (shown once
 * the step has been the current one for 30 s), « Étape suivante » and « Passer le tutoriel », both always there. After the last step: « Fin des étapes », one line, « Fermer ».
 * Its buttons are native buttons in the tab order after the status bar (the slot is the last child of the shell root); Escape is not read here. The owner announces the steps
 * on the shell's status line (the same polite region the checklist's changes use).
 */
import { COPY } from '../copy'
import { closeTutorialSlot, openTutorialSlot } from '../../design/tutorialSlot'
import { PLAIN_HINT_MS } from './plainTutorial'
import './plainTutorial.css'

export const PLAIN_CARD_TESTID = 'plain-tutorial'

export type PlainCardView = { kind: 'step'; k: number; n: number; text: string; hint: string } | { kind: 'done' }

export interface PlainCardDeps {
  doc: Document
  onNext(): void
  onSkip(): void
  /** « Fermer » on the closing card. */
  onClose(): void
  /** The hint of the current step was just shown (the owner says it on the status line). */
  onHint?(hint: string): void
  /** The place picker's `covers` array: the slot is in it while shown, so the picker makes it inert while it covers the page. */
  covers?: HTMLElement[]
  covered?(): boolean
  /** Timers (tests pass fakes). */
  setTimer?(fn: () => void, ms: number): unknown
  clearTimer?(handle: unknown): void
}

export interface PlainCard {
  /** Shows (or redraws) the card. A new step restarts the hint's 30 s; the same step drawn again keeps it. */
  show(v: PlainCardView): void
  /** The card and its slot leave the page at once; the row is freed. Idempotent. */
  hide(): void
  /** The focus goes to the card (its region), e.g. when Aide resumes it. */
  focus(): void
  readonly shown: boolean
}

/** The slot opened or closed: the rows moved, so the page is told what a window resize tells it (the render loop and the view cube re-measure), as the step card does. */
function relayout(doc: Document): void {
  try {
    const win = doc.defaultView
    if (win !== null && typeof win.dispatchEvent === 'function' && typeof Event === 'function') queueMicrotask(() => win.dispatchEvent(new Event('resize')))
  } catch {
    // nothing to tell
  }
}

export function mountPlainTutorialCard(d: PlainCardDeps): PlainCard {
  const setTimer = d.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
  const clearTimer = d.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>))
  const PT = (): Readonly<Record<string, string>> => COPY.plainTutorial!
  const TC = (): Readonly<Record<string, string>> => COPY.tutorialCard!
  let slot: HTMLElement | null = null
  let card: HTMLElement | null = null
  let parts: { count: HTMLElement; text: HTMLElement; hint: HTMLElement; next: HTMLButtonElement; skip: HTMLButtonElement; close: HTMLButtonElement } | null = null
  let shownStep: number | null = null
  let timer: unknown = null
  const stopTimer = (): void => {
    if (timer !== null) clearTimer(timer)
    timer = null
  }

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, testid?: string): HTMLElementTagNameMap[K] => {
    const e = d.doc.createElement(tag)
    e.className = cls
    if (testid) e.dataset.testid = testid
    return e
  }
  const button = (cls: string, testid: string, label: string, run: () => void): HTMLButtonElement => {
    const b = el('button', `tp-coach-btn ${cls}`, testid)
    b.type = 'button'
    b.textContent = label
    b.addEventListener('click', run)
    return b
  }

  function build(): void {
    const s = openTutorialSlot(d.doc)
    if (s === null) return
    slot = s
    slot.inert = d.covered?.() === true
    d.covers?.push(slot)
    card = el('section', 'tp-coach', PLAIN_CARD_TESTID)
    card.setAttribute('aria-label', PT().region!)
    card.tabIndex = -1
    const count = el('p', 'tp-coach-count', 'plain-tutorial-count')
    const text = el('p', 'tp-coach-text', 'plain-tutorial-text')
    const hint = el('p', 'tp-coach-hint', 'plain-tutorial-hint')
    hint.hidden = true
    const actions = el('div', 'tp-coach-actions')
    const next = button('tp-coach-next', 'plain-tutorial-next', PT().next!, () => d.onNext())
    const skip = button('tp-coach-skip', 'plain-tutorial-skip', COPY.tutorialUi!.skip!, () => d.onSkip())
    const close = button('tp-coach-close', 'plain-tutorial-close', TC().close!, () => d.onClose())
    actions.append(next, skip, close)
    card.append(count, text, hint, actions)
    slot.append(card)
    parts = { count, text, hint, next, skip, close }
    relayout(d.doc)
  }

  return {
    show(v) {
      if (slot === null) build()
      if (parts === null || card === null) return
      if (v.kind === 'done') {
        stopTimer()
        shownStep = null
        const hadFocus = card.contains(d.doc.activeElement) // « Étape suivante » pressed on the last step: the focus follows to « Fermer », never to the page
        card.dataset.state = 'done'
        parts.count.textContent = TC().closingTitle!
        parts.text.textContent = PT().closingLine!
        parts.hint.hidden = true
        parts.next.hidden = true
        parts.skip.hidden = true
        parts.close.hidden = false
        if (hadFocus) parts.close.focus()
        return
      }
      card.dataset.state = 'step'
      card.dataset.step = String(v.k)
      parts.count.textContent = TC().step!.replace('{k}', String(v.k)).replace('{n}', String(v.n))
      parts.text.textContent = v.text
      parts.next.hidden = false
      parts.skip.hidden = false
      parts.close.hidden = true
      if (shownStep === v.k) return // the same step drawn again: its hint and its timer stay as they are
      shownStep = v.k
      stopTimer()
      parts.hint.hidden = true
      parts.hint.textContent = PT().hint!.replace('{hint}', v.hint)
      timer = setTimer(() => {
        timer = null
        if (parts === null || shownStep !== v.k) return
        parts.hint.hidden = false
        d.onHint?.(v.hint)
      }, PLAIN_HINT_MS)
    },
    hide() {
      stopTimer()
      shownStep = null
      if (slot === null) return
      const gone = slot
      closeTutorialSlot(d.doc)
      gone.remove()
      if (d.covers) {
        const at = d.covers.indexOf(gone)
        if (at >= 0) d.covers.splice(at, 1)
      }
      slot = null
      card = null
      parts = null
      relayout(d.doc)
    },
    focus() {
      card?.focus()
    },
    get shown() {
      return slot !== null
    },
  }
}
