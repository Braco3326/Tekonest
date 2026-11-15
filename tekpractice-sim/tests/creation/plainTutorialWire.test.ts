/**
 * The plain tutorial's wiring in the first visit (mission 1, spec 4; firstVisit.ts `plainTutorial`): the offer after the goal screens counts four steps and opens the FIRST room
 * (decision: not the goal's filtered picker), « Faire le tutoriel » starts the card at step 1 (or further when the bench already has gear), each change of the store and the first
 * sound move it on, Aide « Premiers pas » / « Reprendre » / « Recommencer » / « Passer » act on it, the record keeps `{ step, done }`, and nothing of the guide's request is needed.
 * Pure wiring over fakes (node): the card is a fake that records what it was asked; the real card is tests/creation/plainTutorialCard.test.ts, the browser
 * tests/e2e/onboarding-plain-tutorial.spec.ts.
 */
import { describe, expect, it } from 'vitest'
import { wireOnboarding, type OnboardingWiring, type PlainTutorialWiring } from '../../src/creation/onboarding/firstVisit'
import type { PickerStartOpts } from '../../src/creation/shell/placePicker'
import type { PlainCard, PlainCardDeps, PlainCardView } from '../../src/creation/onboarding/plainTutorialCard'
import type { PlainFacts } from '../../src/creation/onboarding/plainTutorial'
import { ONBOARDING_KEY, type StorageLike } from '../../src/creation/onboarding/state'
import { SMALL } from './goalTreeFixture'

const NONE: PlainFacts = { console: false, enceinte: false, cable: false, ecoute: false }

function memoryStorage(initial?: unknown): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set(ONBOARDING_KEY, JSON.stringify(initial))
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}
const settle = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

function harness(o: { storage?: ReturnType<typeof memoryStorage>; place?: boolean; practice?: boolean; plain?: boolean } = {}) {
  const storage = o.storage ?? memoryStorage()
  const log: string[] = []
  const said: string[] = []
  let place = o.place === true
  let practice = o.practice !== false
  let facts: PlainFacts = { ...NONE }
  let startOpts!: PickerStartOpts
  const views: (PlainCardView | 'hide')[] = []
  let cardDeps!: PlainCardDeps
  let shown = false
  let overs = 0
  const mountCard = (d: PlainCardDeps): PlainCard => {
    cardDeps = d
    return {
      show: (v) => {
        shown = true
        views.push(v)
      },
      hide: () => {
        if (shown) views.push('hide')
        shown = false
      },
      focus: () => void log.push('card-focus'),
      get shown() {
        return shown
      },
    }
  }
  const plain: PlainTutorialWiring = {
    facts: (sounded) => ({ ...facts, ecoute: sounded }),
    labels: { console: 'Yamaha QL1', enceinte: 'K12.2' },
    onOver: () => void overs++,
    mountCard,
  }
  const w: OnboardingWiring = {
    design: true,
    storage,
    stepCount: 10,
    tutorialAllowed: false,
    panels: { tree: true, props: true },
    doc: {} as Document,
    announce: (m) => void said.push(m),
    practiceNow: () => practice,
    chipSlot: {} as HTMLElement,
    picker: {
      showStart: (opts) => {
        startOpts = opts
        log.push('showStart')
      },
      hide: () => void log.push('hide'),
      show: (opts) => void log.push(`show:${opts.closable}`),
      startShowing: false,
      setRoomFilter: () => undefined,
    },
    goals: true,
    goalTree: SMALL,
    placeOpen: () => place,
    openFirstRoom: async () => {
      log.push('room')
      await Promise.resolve()
      place = true
      return true
    },
    frameFirstRoom: (f) => void log.push(`frame:${f?.tutorialRow === true}`),
    setPanel: () => undefined,
    openInventory: () => undefined,
    returnFocus: () => void log.push('focus'),
    ...(o.plain === false ? {} : { plainTutorial: plain }),
  }
  const ob = wireOnboarding(w, () => ({ render: () => undefined }), () => ({ show: () => undefined, hide: () => undefined, shown: false }))
  return {
    ob,
    log,
    said,
    views,
    card: () => cardDeps,
    overs: () => overs,
    startOpts: () => startOpts,
    setFacts: (f: Partial<PlainFacts>) => (facts = { ...NONE, ...f }),
    setPractice: (p: boolean) => (practice = p),
    record: () => (storage.data.has(ONBOARDING_KEY) ? JSON.parse(storage.data.get(ONBOARDING_KEY)!) : null),
  }
}
const lastView = (h: ReturnType<typeof harness>) => h.views[h.views.length - 1]
const firstGoalLeaf = { id: SMALL.goals[0]!.children[0]!.id }

describe('the offer after the goal screens (the guide is off: tutorialAllowed false)', () => {
  it('is made, with the four steps of the plain tutorial; Aide has « Premiers pas »', () => {
    const h = harness()
    expect(h.ob.startFirstVisit()).toBe(true)
    expect(h.startOpts()).toMatchObject({ offerAllowed: true, stepCount: 4 })
    expect(h.ob.premiersPas).toBe(true)
    expect(h.ob.snapshot()).toMatchObject({ plainTutorial: true, premiersPas: true })
  })
  it('without the plain tutorial (and the guide off) no offer is made and Aide has nothing: part A’s product behaviour', () => {
    const h = harness({ plain: false })
    h.ob.startFirstVisit()
    expect(h.startOpts()).toMatchObject({ offerAllowed: false })
    expect(h.ob.premiersPas).toBe(false)
  })
  it('« Faire le tutoriel »: the FIRST room opens (not the goal’s picker), framed for the tutorial row, then the card shows step 1 and says it', async () => {
    const h = harness()
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'chosen', profile: 'decouvre', offer: 'taken', goal: firstGoalLeaf })
    await settle()
    expect(h.log).toEqual(['showStart', 'room', 'frame:true'])
    expect(lastView(h)).toMatchObject({ kind: 'step', k: 1, n: 4, text: 'Ouvrez Matériel, puis Inventaire, onglet Consoles, et posez la Yamaha QL1 dans la salle.' })
    expect((lastView(h) as { hint: string }).hint).toContain('Yamaha QL1')
    // said in the card's own polite region (the status line is overwritten by the drawer's « Prêt » once its chunk is in)
    expect((lastView(h) as { say?: string }).say).toBe('Tutoriel, étape 1 sur 4 : Ouvrez Matériel, puis Inventaire, onglet Consoles, et posez la Yamaha QL1 dans la salle.')
    expect(h.record()).toMatchObject({ goal: firstGoalLeaf, offer: 'taken', plainTutorial: { step: 1, done: false } })
  })
  it('« Passer, je connais »: the first room opens too, and no card', async () => {
    const h = harness()
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'chosen', profile: 'decouvre', offer: 'skipped', goal: firstGoalLeaf })
    await settle()
    expect(h.log).toEqual(['showStart', 'room', 'frame:false'])
    expect(h.views).toEqual([])
    expect(h.record()).toMatchObject({ offer: 'skipped' })
    expect(h.record().plainTutorial).toBeUndefined()
  })
})

describe('the steps follow the bench', () => {
  async function taken(h: ReturnType<typeof harness>): Promise<void> {
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'chosen', profile: 'decouvre', offer: 'taken', goal: firstGoalLeaf })
    await settle()
  }
  it('each change of the store completes the step whose fact is now true; the first sound completes the last; then the closing card, said once, and onOver', async () => {
    const h = harness()
    await taken(h)
    h.setFacts({ console: true })
    h.ob.refresh()
    expect(lastView(h)).toMatchObject({ kind: 'step', k: 2 })
    expect((lastView(h) as { say?: string }).say).toMatch(/^Tutoriel, étape 2 sur 4/)
    h.ob.refresh() // an unrelated change: nothing said again
    expect((lastView(h) as { say?: string }).say).toBeUndefined()
    const at = h.views.length
    h.setFacts({ console: true, enceinte: true, cable: true })
    h.ob.refresh()
    expect(lastView(h)).toMatchObject({ kind: 'step', k: 4 })
    expect(h.views.slice(at).map((v) => (v as { say?: string }).say).filter(Boolean)).toEqual([expect.stringMatching(/^Tutoriel, étape 4 sur 4/)]) // step 3 was jumped over at once: only step 4 is said
    expect(h.overs()).toBe(0)
    h.ob.soundStarted()
    expect(lastView(h)).toEqual({ kind: 'done', say: 'Tutoriel : fin des étapes.' })
    expect(h.record().plainTutorial).toEqual({ step: 4, done: true })
    expect(h.overs()).toBe(1)
    // « Fermer »: the card leaves, the focus goes back to the page, nothing else changes
    h.card().onClose()
    expect(lastView(h)).toBe('hide')
    expect(h.log.at(-1)).toBe('focus')
    h.ob.refresh()
    expect(lastView(h)).toBe('hide')
    expect(h.overs()).toBe(1)
  })
  it('a bench that already has the console and the speaker starts at step 3', async () => {
    const h = harness()
    h.setFacts({ console: true, enceinte: true })
    await taken(h)
    expect(lastView(h)).toMatchObject({ kind: 'step', k: 3 })
    expect(h.record().plainTutorial).toEqual({ step: 3, done: false })
  })
  it('« Étape suivante » passes the step; on the last step it ends the tutorial', async () => {
    const h = harness()
    await taken(h)
    h.card().onNext()
    expect(lastView(h)).toMatchObject({ kind: 'step', k: 2 })
    h.card().onNext()
    h.card().onNext()
    h.card().onNext()
    expect(lastView(h)).toMatchObject({ kind: 'done' })
    expect(h.overs()).toBe(1)
  })
  it('« Passer le tutoriel »: the card leaves at once, the record says done, it is said, onOver once, and nothing comes back on the next change', async () => {
    const h = harness()
    await taken(h)
    h.card().onSkip()
    expect(lastView(h)).toBe('hide')
    expect(h.record().plainTutorial).toEqual({ step: 1, done: true })
    expect(h.said.at(-1)).toBe('Tutoriel arrêté. Aide, puis Premiers pas, le relance.')
    expect(h.log.at(-1)).toBe('focus')
    h.setFacts({ console: true })
    h.ob.refresh()
    expect(lastView(h)).toBe('hide')
    expect(h.overs()).toBe(1)
  })
  it('the card hides while the address is no longer a practice one (an exam pushed in), and comes back after', async () => {
    const h = harness()
    await taken(h)
    h.setPractice(false)
    h.ob.refresh()
    expect(lastView(h)).toBe('hide')
    h.setPractice(true)
    h.ob.refresh()
    expect(lastView(h)).toMatchObject({ kind: 'step', k: 1 })
  })
})

describe('Aide « Premiers pas », « Reprendre », « Recommencer », « Passer »', () => {
  it('with no place open, « Premiers pas » opens the first room, frames for the row, and starts at step 1; no guide request goes up', async () => {
    const h = harness({ storage: memoryStorage({ v: 1, profile: null, offer: 'skipped', request: 0, shown: [], goal: null }) })
    await h.ob.requestTutorial()
    expect(h.log).toEqual(['room', 'frame:true'])
    expect(lastView(h)).toMatchObject({ kind: 'step', k: 1 })
    expect(h.record()).toMatchObject({ request: 0, plainTutorial: { step: 1, done: false } })
  })
  it('a run in progress: progress() says the step to resume at, « Reprendre » focuses the card, « Recommencer » goes back to step 1, « Passer » ends it', async () => {
    const h = harness({ place: true, storage: memoryStorage({ v: 1, profile: null, offer: 'taken', request: 1, shown: [], goal: null, plainTutorial: { step: 3, done: false } }) })
    expect(h.ob.progress()).toEqual({ k: 3, n: 4 })
    await h.ob.requestTutorial('start')
    expect(lastView(h)).toMatchObject({ kind: 'step', k: 3 })
    expect(h.log).toContain('card-focus')
    await h.ob.requestTutorial('restart')
    expect(lastView(h)).toMatchObject({ kind: 'step', k: 1 })
    await h.ob.requestTutorial('skip')
    expect(lastView(h)).toBe('hide')
    expect(h.record().plainTutorial).toEqual({ step: 1, done: true })
    expect(h.ob.progress()).toBeNull()
  })
  it('a finished tutorial: « Premiers pas » starts it again from step 1', async () => {
    const h = harness({ place: true, storage: memoryStorage({ v: 1, profile: null, offer: 'taken', request: 1, shown: [], goal: null, plainTutorial: { step: 4, done: true } }) })
    await h.ob.requestTutorial()
    expect(h.record().plainTutorial).toEqual({ step: 1, done: false })
  })
  it('a run left in progress on an earlier visit shows again as soon as a place is open (the first change of the store after the restore)', () => {
    const h = harness({ place: true, storage: memoryStorage({ v: 1, profile: null, offer: 'taken', request: 1, shown: [], goal: null, plainTutorial: { step: 2, done: false } }) })
    expect(h.views).toEqual([])
    h.ob.refresh()
    expect(lastView(h)).toMatchObject({ kind: 'step', k: 2 })
  })
})
