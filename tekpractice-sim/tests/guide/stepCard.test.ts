// The step card (onboarding packs, plan T6.1, spec 6.6): progress only. The pure view (which mark each step wears, « Étape k sur n », the legend, the closing lines)
// and the gate that decides when the card is shown. The DOM is proven in the browser (tests/e2e/onboarding-stepcard.spec.ts): unit tests run in node.
import { describe, expect, it } from 'vitest'
import { COPY } from '../../src/creation/copy'
import { packageById, tutorialSteps, type StepId } from '../../src/design/packages'
import { EMPTY_TUTORIAL_RECORD, type TutorialRecord } from '../../src/design/tutorialRecord'
import { cardView, createCardGate, legendOf, type CardView } from '../../src/guide/stepCard'
import { closingLines } from '../../src/guide/tutorial'
import { offends } from '../creation/honestyLists'

const TEN = packageById(1).pacing.steps
const rec = (o: Partial<TutorialRecord>): TutorialRecord => ({ ...EMPTY_TUTORIAL_RECORD, early: [], shown: [], passed: [], ...o })
const running = (k: number, o: Partial<TutorialRecord> = {}): TutorialRecord => rec({ status: 'running', k, n: TEN.length, step: TEN[k - 1], ...o })
const states = (v: CardView): string[] => v.dots.map((d) => d.state)
const view = (r: TutorialRecord, steps: readonly StepId[] = TEN, closing: readonly string[] = [], finishedHere = false): CardView | null => cardView({ steps, record: r, closing, finishedHere })

describe('cardView: « Étape k sur n » and one mark per step', () => {
  it('step 3 of 10: two done, the third current, seven to come; the count says k and n and nothing else', () => {
    const v = view(running(3))!
    expect(v.mode).toBe('running')
    expect(v.count).toBe('Étape 3 sur 10')
    expect(states(v)).toEqual(['done', 'done', 'current', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo'])
    expect(v.dots.map((d) => d.k)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(v.dots.map((d) => d.id)).toEqual([...TEN])
    expect(v.closing).toEqual([])
  })

  it('step 1: nothing is done yet; the last step: nine done and the tenth current', () => {
    expect(states(view(running(1))!)[0]).toBe('current')
    expect(states(view(running(1))!).filter((s) => s !== 'todo' && s !== 'current')).toEqual([])
    expect(states(view(running(10))!)).toEqual([...Array(9).fill('done'), 'current'])
    expect(view(running(10))!.count).toBe('Étape 10 sur 10')
  })

  it('a step passed with « Passer cette étape » reads « passée »; the power helper’s steps read « montré »; steps whose result was on the bench read « déjà en place »', () => {
    const v = view(running(10, { passed: ['micro'], shown: ['courant-console', 'courant-enceinte'], early: ['enceinte', 'lecture-console'] }))!
    expect(states(v)).toEqual(['done', 'passed', 'early', 'done', 'done', 'early', 'done', 'shown', 'shown', 'current'])
  })

  it('does not trigger: a list entry for a step that is not behind the current one marks nothing (a step ahead stays « à venir »)', () => {
    const v = view(running(2, { early: ['multiprise'], shown: ['courant-console'], passed: ['ecoute'] }))!
    expect(states(v)).toEqual(['done', 'current', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo'])
  })

  it('shown outranks early outranks passed when a record names a step twice (never the stronger claim)', () => {
    const v = view(running(4, { passed: ['console', 'micro', 'enceinte'], early: ['console', 'micro'], shown: ['console'] }))!
    expect(states(v).slice(0, 3)).toEqual(['shown', 'early', 'passed'])
  })

  it('n follows the steps of the run: a three-step pacing says « Étape 2 sur 3 »', () => {
    const three: StepId[] = ['ecoute', 'debrancher', 'rebrancher']
    const v = view(rec({ status: 'running', k: 2, n: 3, step: 'debrancher' }), three)!
    expect(v.count).toBe('Étape 2 sur 3')
    expect(states(v)).toEqual(['done', 'current', 'todo'])
  })

  it('package 5 runs the ten standard steps until its playable model exists (T6.3): the card says 10 for every package today', () => {
    for (const id of [1, 2, 3, 4, 5] as const) expect(view(running(1), tutorialSteps(packageById(id)))!.count).toBe('Étape 1 sur 10')
  })

  it('a current step id that the list does not hold, or a k beyond n, never throws and never invents a step', () => {
    expect(view(rec({ status: 'running', k: 99, n: 10, step: 'console' }))!.dots).toHaveLength(10)
    expect(view(rec({ status: 'running', k: 0, n: 10, step: null }))!.dots).toHaveLength(10)
    expect(view(running(3), [])).toBeNull()
  })
})

describe('cardView: when there is nothing to show', () => {
  it('idle, skipped and a finished run seen on a reload (not finished on this page) show no card', () => {
    expect(view(rec({ status: 'idle' }))).toBeNull()
    expect(view(rec({ status: 'skipped' }))).toBeNull()
    expect(view(rec({ status: 'done' }), TEN, ['a'], false)).toBeNull()
  })
})

describe('the closing card: after the last step it shows closingLines() (G8 review S2 / C2)', () => {
  const done = (o: Partial<TutorialRecord> = {}): TutorialRecord => rec({ status: 'done', k: 0, n: TEN.length, ...o })
  it('a mic cabled: listen.simple, then the checklist’s own mic line', () => {
    const lines = closingLines({ micOk: true, micReasons: [] })
    const v = view(done(), TEN, lines, true)!
    expect(v.mode).toBe('closing')
    expect(v.closing).toEqual([COPY.listen!.simple, COPY.checklist!.micCabled])
    expect(v.count).toBe('')
    expect(v.title).toBe(COPY.tutorialCard!.closingTitle)
  })
  it('no mic cabled (the step was passed): listen.simple, then the engine’s own NO_MIC text, verbatim', () => {
    const noMic = { code: 'NO_MIC', text_fr: COPY.playback!.noMic }
    const v = view(done({ passed: ['micro', 'micro-console'] }), TEN, closingLines({ micOk: false, micReasons: [noMic] }), true)!
    expect(v.closing).toEqual([COPY.listen!.simple, COPY.playback!.noMic])
    expect(v.dots.filter((d) => d.state === 'passed').map((d) => d.id)).toEqual(['micro', 'micro-console'])
  })
  it('every step wears its mark in the closing card and none is current', () => {
    const v = view(done({ early: ['console'] }), TEN, ['x'], true)!
    expect(states(v)).toEqual(['early', ...Array(9).fill('done')])
  })
})

describe('legendOf: the key to the marks, only when a mark needs one', () => {
  it('all plain (done, current, to come): no legend', () => {
    expect(legendOf(view(running(4))!)).toEqual([])
  })
  it('a passed, shown or early step: the legend names « faite » and every mark in use, in a fixed order', () => {
    expect(legendOf(view(running(5, { passed: ['micro'] }))!)).toEqual(['done', 'passed'])
    expect(legendOf(view(running(10, { early: ['console'], shown: ['courant-console'], passed: ['micro'] }))!)).toEqual(['done', 'passed', 'shown', 'early'])
  })
})

describe('createCardGate: the card follows the run and leaves with it', () => {
  it('shows while running; a run that ends done on this page shows its closing card until dismissed', () => {
    const g = createCardGate()
    expect(g.next('idle')).toBeNull()
    expect(g.next('running')).toBe('running')
    expect(g.next('done')).toBe('closing')
    expect(g.next('done')).toBe('closing')
    g.dismiss()
    expect(g.next('done')).toBeNull()
  })
  it('a finished run found on a reload (never running on this page) shows no card', () => {
    const g = createCardGate()
    expect(g.next('done')).toBeNull()
  })
  it('skipped or interrupted: the card goes at once, and a later « done » without a new run shows nothing', () => {
    const g = createCardGate()
    expect(g.next('running')).toBe('running')
    expect(g.next('skipped')).toBeNull()
    expect(g.next('done')).toBeNull()
    expect(g.next('running')).toBe('running')
    expect(g.next('idle')).toBeNull()
  })
  it('a new run after a dismissed closing card shows the card again (dismissal belongs to one run)', () => {
    const g = createCardGate()
    g.next('running')
    g.next('done')
    g.dismiss()
    expect(g.next('running')).toBe('running')
    expect(g.next('done')).toBe('closing')
  })
})

describe('what the card says (spec 9): progress only', () => {
  const T = (): Record<string, string> => COPY.tutorialCard as Record<string, string>
  const cardTexts = (): string[] => Object.values(T())
  it('never the bubble’s sentence, never « réussi », no figure but the placeholders k and n; the banned list finds nothing', () => {
    const bubble = Object.values(COPY.tutorial!)
    for (const t of cardTexts()) {
      expect(bubble, t).not.toContain(t)
      for (const b of bubble) expect(t.includes(b) || b.includes(t), `${t} / ${b}`).toBe(false)
      expect(t, t).not.toMatch(/réussi/i)
      expect(offends(t, 'learner'), t).toEqual([])
    }
    expect(T().step).toBe('Étape {k} sur {n}')
  })
  it('the words of the marks are the spec’s: « passée », « montré », « déjà en place »', () => {
    expect(T().statePassed).toBe('passée')
    expect(T().stateShown).toBe('montré')
    expect(T().stateEarly).toBe('déjà en place')
  })
  it('the card’s one control reuses Aide’s wording (one source): « Passer le tutoriel »', () => {
    expect(COPY.tutorialUi!.skip).toBe('Passer le tutoriel')
  })
  it('the view carries no string of the bubble: count, title, closing lines and nothing else', () => {
    const v = view(running(3))!
    const all = JSON.stringify(v)
    for (const b of Object.values(COPY.tutorial!)) expect(all).not.toContain(b)
  })
})
