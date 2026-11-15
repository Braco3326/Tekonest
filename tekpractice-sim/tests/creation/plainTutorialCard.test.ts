// @vitest-environment jsdom
/**
 * The plain tutorial's coach card in a DOM (mission 1, spec 4): it lives in the tutorial's reserved slot at the end of the shell root (never over the 3D view), it is a
 * labelled region with native buttons (« Étape suivante » and « Passer le tutoriel » always there while a step runs), the hint shows 30 s after the step became current
 * (once), the closing card has « Fermer » only, and hiding frees the row. No avatar, no name: the card holds text and three buttons.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mountPlainTutorialCard, type PlainCard } from '../../src/creation/onboarding/plainTutorialCard'

let root: HTMLElement
let log: string[]
let timers: { fn: () => void; ms: number; live: boolean }[]
let covers: HTMLElement[]
let card: PlainCard

const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`)
const fire = (): void => {
  for (const t of timers.filter((x) => x.live)) {
    t.live = false
    t.fn()
  }
}

beforeEach(() => {
  document.body.innerHTML = ''
  root = document.createElement('div')
  root.dataset.testid = 'creation-root'
  root.className = 'cr'
  root.append(Object.assign(document.createElement('canvas'), { id: 'renderCanvas' }))
  document.body.append(root)
  log = []
  timers = []
  covers = []
  card = mountPlainTutorialCard({
    doc: document,
    onNext: () => void log.push('next'),
    onSkip: () => void log.push('skip'),
    onClose: () => void log.push('close'),
    onHint: (h) => void log.push(`hint:${h}`),
    covers,
    covered: () => false,
    setTimer: (fn, ms) => {
      const t = { fn, ms, live: true }
      timers.push(t)
      return t
    },
    clearTimer: (h) => void ((h as { live: boolean }).live = false),
  })
})
afterEach(() => card.hide())

describe('the coach card', () => {
  it('opens the reserved tutorial row at the end of the shell root, as a labelled region, and is in the picker’s covers while shown', () => {
    card.show({ kind: 'step', k: 1, n: 4, text: 'Posez la console.', hint: 'Une astuce.' })
    const slot = q('tutorial-slot')!
    expect(slot).not.toBeNull()
    expect(root.lastElementChild).toBe(slot)
    expect(root.dataset.tutorial).toBe('on')
    const region = q('plain-tutorial')!
    expect(region.tagName).toBe('SECTION')
    expect(region.getAttribute('aria-label')).toBe('Tutoriel Premiers pas')
    expect(region.getAttribute('role')).toBeNull()
    expect(covers).toEqual([slot])
    expect(q('plain-tutorial-count')!.textContent).toBe('Étape 1 sur 4')
    expect(q('plain-tutorial-text')!.textContent).toBe('Posez la console.')
    // no picture, no name: text and buttons only
    expect(region.querySelectorAll('img, svg, picture')).toHaveLength(0)
    expect(region.textContent).not.toMatch(/Oscar/)
  })
  it('« Étape suivante » and « Passer le tutoriel » are native buttons, always there while a step runs; « Fermer » is not', () => {
    card.show({ kind: 'step', k: 2, n: 4, text: 'Posez une enceinte.', hint: 'h' })
    const next = q('plain-tutorial-next') as HTMLButtonElement
    const skip = q('plain-tutorial-skip') as HTMLButtonElement
    expect(next.tagName).toBe('BUTTON')
    expect(next.type).toBe('button')
    expect(next.textContent).toBe('Étape suivante')
    expect(skip.textContent).toBe('Passer le tutoriel')
    expect(next.hidden || skip.hidden).toBe(false)
    expect((q('plain-tutorial-close') as HTMLButtonElement).hidden).toBe(true)
    next.click()
    skip.click()
    expect(log).toEqual(['next', 'skip'])
  })
  it('the hint shows once, 30 s after the step became current, and is said once; the same step drawn again keeps its timer, a new step restarts it', () => {
    card.show({ kind: 'step', k: 1, n: 4, text: 't1', hint: 'h1' })
    expect(timers).toHaveLength(1)
    expect(timers[0].ms).toBe(30_000)
    expect(q('plain-tutorial-hint')!.hidden).toBe(true)
    card.show({ kind: 'step', k: 1, n: 4, text: 't1', hint: 'h1' })
    expect(timers.filter((t) => t.live)).toHaveLength(1)
    fire()
    expect(q('plain-tutorial-hint')!.hidden).toBe(false)
    expect(q('plain-tutorial-hint')!.textContent).toBe('Astuce : h1')
    expect(log).toEqual(['hint:h1'])
    card.show({ kind: 'step', k: 2, n: 4, text: 't2', hint: 'h2' })
    expect(q('plain-tutorial-hint')!.hidden).toBe(true)
    expect(timers.filter((t) => t.live)).toHaveLength(1)
  })
  it('the closing card: « Fin des étapes », one line, « Fermer » only; the focus follows to « Fermer » when it was on the card', () => {
    card.show({ kind: 'step', k: 4, n: 4, text: 't4', hint: 'h4' })
    ;(q('plain-tutorial-next') as HTMLButtonElement).focus()
    card.show({ kind: 'done' })
    expect(q('plain-tutorial-count')!.textContent).toBe('Fin des étapes')
    expect((q('plain-tutorial-next') as HTMLButtonElement).hidden).toBe(true)
    expect((q('plain-tutorial-skip') as HTMLButtonElement).hidden).toBe(true)
    const close = q('plain-tutorial-close') as HTMLButtonElement
    expect(close.hidden).toBe(false)
    expect(close.textContent).toBe('Fermer')
    expect(document.activeElement).toBe(close)
    expect(timers.filter((t) => t.live)).toHaveLength(0) // no hint after the end
    close.click()
    expect(log).toEqual(['close'])
  })
  it('hide frees the row and the covers at once, and is idempotent', () => {
    card.show({ kind: 'step', k: 1, n: 4, text: 't', hint: 'h' })
    card.hide()
    card.hide()
    expect(q('tutorial-slot')).toBeNull()
    expect(root.dataset.tutorial).toBeUndefined()
    expect(covers).toEqual([])
    expect(card.shown).toBe(false)
    expect(timers.filter((t) => t.live)).toHaveLength(0)
  })
  it('no shell root (a page with no Mode Création shell): nothing is created', () => {
    root.remove()
    card.show({ kind: 'step', k: 1, n: 4, text: 't', hint: 'h' })
    expect(card.shown).toBe(false)
    expect(q('plain-tutorial')).toBeNull()
  })
})
