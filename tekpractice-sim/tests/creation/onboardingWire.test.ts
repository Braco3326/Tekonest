/**
 * The first-visit wiring (plan T2.4a / T2.4b, spec 4): what a start-screen answer does to the page (the neutral room, the profile's panels and
 * drawer tab), when the tutorial may be offered (`tutorialAllowed`), Aide « Premiers pas », the profile chip, and the double-answer guard.
 * Pure wiring over fakes (vitest runs in node, no DOM): the DOM of the screen and the chip is proven in tests/e2e/onboarding-start.spec.ts.
 */
import { describe, expect, it } from 'vitest'
import { wireOnboarding, type OnboardingWiring } from '../../src/creation/onboarding/wire'
import type { PickerStartOpts } from '../../src/creation/shell/placePicker'
import type { ProfileChip, ProfileChipDeps } from '../../src/creation/onboarding/profileChip'
import { ONBOARDING_KEY, type StorageLike } from '../../src/creation/onboarding/state'

function memoryStorage(initial?: unknown): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set(ONBOARDING_KEY, JSON.stringify(initial))
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}

function harness(over: Partial<OnboardingWiring> = {}, opts: { storage?: ReturnType<typeof memoryStorage>; roomFails?: boolean } = {}) {
  const log: string[] = []
  const storage = opts.storage ?? memoryStorage()
  let place = false
  let startOpts!: PickerStartOpts
  let showStartCalls = 0
  let chipDeps!: ProfileChipDeps
  let chipRenders = 0
  const mountChip = (d: ProfileChipDeps): ProfileChip => {
    chipDeps = d
    return { render: () => void chipRenders++ }
  }
  const w: OnboardingWiring = {
    design: true,
    storage,
    stepCount: 10,
    tutorialAllowed: true,
    panels: { tree: false, props: false },
    doc: {} as Document,
    chipSlot: {} as HTMLElement,
    picker: {
      showStart: (o) => {
        startOpts = o
        showStartCalls++
        log.push('showStart')
      },
      hide: () => void log.push('hide'),
    },
    placeOpen: () => place,
    openNeutralRoom: async () => {
      log.push('room')
      await Promise.resolve()
      if (!opts.roomFails) place = true
    },
    frameNeutralRoom: () => void log.push('frame'),
    setPanel: (p, open) => void log.push(`panel:${p}:${open}`),
    openInventory: (tab) => void log.push(`drawer:${tab}`),
    returnFocus: () => void log.push('focus'),
    ...over,
  }
  const ob = wireOnboarding(w, mountChip)
  return {
    ob,
    log,
    storage,
    startOpts: () => startOpts,
    showStartCalls: () => showStartCalls,
    chip: () => chipDeps,
    chipRenders: () => chipRenders,
    setPlace: (p: boolean) => (place = p),
    record: () => (storage.data.has(ONBOARDING_KEY) ? JSON.parse(storage.data.get(ONBOARDING_KEY)!) : null),
  }
}
const settle = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('no ?design: nothing exists', () => {
  it('no store, no start screen, no chip, no « Premiers pas », no key written', async () => {
    const h = harness({ design: false })
    expect(h.ob.store).toBeNull()
    expect(h.ob.startFirstVisit()).toBe(false)
    expect(h.showStartCalls()).toBe(0)
    expect(h.chip()).toBeUndefined()
    expect(h.ob.premiersPas).toBe(false)
    await h.ob.requestTutorial()
    expect(h.log).toEqual([])
    expect(h.storage.data.size).toBe(0)
    expect(h.ob.snapshot()).toMatchObject({ design: false, record: null, tutorialAllowed: true })
  })
})

describe('the start screen answer (T2.4a)', () => {
  it('shows the start screen on a first visit, with the step count and the offer allowed', () => {
    const h = harness()
    expect(h.ob.startFirstVisit()).toBe(true)
    expect(h.startOpts()).toMatchObject({ stepCount: 10, offerAllowed: true })
  })
  it('does not show it when a record exists (a profile was chosen before): the learner was asked once', () => {
    const h = harness({}, { storage: memoryStorage({ v: 1, profile: 'etudie', offer: null, request: 0, shown: [] }) })
    expect(h.ob.startFirstVisit()).toBe(false)
    expect(h.showStartCalls()).toBe(0)
  })
  it('profile 2 + « Passer »: the neutral room opens FIRST, then the two panels, then the drawer on Consoles', async () => {
    const h = harness()
    h.ob.startFirstVisit()
    expect(h.startOpts().closable).toBe(false) // a first visit: no place to go back to
    h.startOpts().onProfile('etudie')
    h.startOpts().onResult({ kind: 'chosen', profile: 'etudie', offer: 'skipped' })
    await settle()
    expect(h.log).toEqual(['showStart', 'room', 'frame', 'panel:tree:true', 'panel:props:true', 'drawer:consoles'])
    expect(h.record()).toMatchObject({ profile: 'etudie', offer: 'skipped', request: 0 })
  })
  it('a profile that leaves the panels to the package takes the package\'s layout', async () => {
    const h = harness({ panels: { tree: false, props: true } })
    h.ob.startFirstVisit()
    h.startOpts().onProfile('decouvre')
    h.startOpts().onResult({ kind: 'chosen', profile: 'decouvre', offer: 'taken' })
    await settle()
    expect(h.log.slice(1)).toEqual(['room', 'frame', 'panel:tree:false', 'panel:props:true', 'drawer:consoles'])
    expect(h.record()).toMatchObject({ profile: 'decouvre', offer: 'taken', request: 1 })
  })
  it('a room that did not open applies nothing (the picker has the error)', async () => {
    const h = harness({}, { roomFails: true })
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'chosen', profile: 'etudie', offer: 'skipped' })
    await settle()
    expect(h.log).toEqual(['showStart', 'room'])
  })
  it('« Tous les lieux »: no room, no panels, no drawer; the record says no profile', async () => {
    const h = harness()
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'all-places' })
    await settle()
    expect(h.log).toEqual(['showStart'])
    expect(h.record()).toMatchObject({ profile: null, offer: null })
  })
  it('a double click on « Faire le tutoriel » raises the request once and opens the room once (G6 concern 5)', async () => {
    const h = harness()
    h.ob.startFirstVisit()
    h.startOpts().onProfile('decouvre')
    const r = { kind: 'chosen', profile: 'decouvre', offer: 'taken' } as const
    h.startOpts().onResult(r)
    h.startOpts().onResult(r)
    await settle()
    h.startOpts().onResult(r)
    await settle()
    expect(h.record().request).toBe(1)
    expect(h.log.filter((l) => l === 'room')).toHaveLength(1)
  })
})

describe('tutorialAllowed: false (?oscar=0, an exam address) (T2.4b)', () => {
  it('the screen is told no offer is made; a profile choice is final: the profile is stored, no request, the room opens and the profile is applied', async () => {
    const h = harness({ tutorialAllowed: false })
    h.ob.startFirstVisit()
    expect(h.startOpts().offerAllowed).toBe(false)
    h.startOpts().onProfile('projet')
    h.startOpts().onResult({ kind: 'chosen', profile: 'projet', offer: null })
    await settle()
    expect(h.record()).toEqual({ v: 1, profile: 'projet', offer: null, request: 0, shown: [] })
    expect(h.log).toEqual(['showStart', 'room', 'frame', 'panel:tree:false', 'panel:props:false', 'drawer:consoles'])
  })
  it('there is no « Premiers pas », and asking for it does nothing (no request, no room)', async () => {
    const h = harness({ tutorialAllowed: false })
    expect(h.ob.premiersPas).toBe(false)
    await h.ob.requestTutorial()
    expect(h.log).toEqual([])
    expect(h.record()).toBeNull()
  })
})

describe('Aide « Premiers pas » (T2.4b)', () => {
  it('with no place open it opens the neutral room FIRST, then raises the request (the machine increments)', async () => {
    const h = harness()
    expect(h.ob.premiersPas).toBe(true)
    await h.ob.requestTutorial()
    expect(h.log).toEqual(['room', 'frame'])
    expect(h.record()).toMatchObject({ request: 1 })
    expect(h.ob.snapshot().record!.request).toBe(1)
  })
  it('with a place open it only raises the request: the room is the learner\'s, not replaced', async () => {
    const h = harness()
    h.setPlace(true)
    await h.ob.requestTutorial()
    expect(h.log).toEqual([])
    expect(h.record()).toMatchObject({ request: 1 })
  })
  it('keeps the earlier answers and counts each ask', async () => {
    const h = harness({}, { storage: memoryStorage({ v: 1, profile: 'metier', offer: 'skipped', request: 0, shown: [] }) })
    h.setPlace(true)
    await h.ob.requestTutorial()
    await h.ob.requestTutorial()
    expect(h.record()).toMatchObject({ profile: 'metier', offer: 'skipped', request: 2 })
  })
  it('two asks while the room is still opening raise the request once', async () => {
    const h = harness()
    const a = h.ob.requestTutorial()
    const b = h.ob.requestTutorial()
    await Promise.all([a, b])
    expect(h.log.filter((l) => l === 'room')).toHaveLength(1)
    expect(h.record().request).toBe(1)
  })
  it('a room that did not open raises no request', async () => {
    const h = harness({}, { roomFails: true })
    await h.ob.requestTutorial()
    expect(h.record()).toBeNull()
  })
})

describe('the profile chip « Profil : X · changer » (T2.4b)', () => {
  it('has no label before a profile is chosen, the profile\'s label after (and on the next visit)', () => {
    const h = harness()
    expect(h.chip().label()).toBeNull()
    h.ob.startFirstVisit()
    h.startOpts().onProfile('etudie')
    expect(h.chip().label()).toBe('Profil : J’étudie le son · changer')
    expect(h.chipRenders()).toBeGreaterThan(1) // rendered at wiring, then after the answer
    const again = harness({}, { storage: memoryStorage({ v: 1, profile: 'projet', offer: 'skipped', request: 0, shown: [] }) })
    expect(again.chip().label()).toBe('Profil : Je monte un projet · changer')
  })
  it('a click reopens the start stage; a profile chosen with a place open is applied without reopening the room, and the picker closes', async () => {
    const h = harness({}, { storage: memoryStorage({ v: 1, profile: 'decouvre', offer: 'skipped', request: 0, shown: [] }) })
    h.setPlace(true)
    h.chip().onClick()
    expect(h.showStartCalls()).toBe(1)
    expect(h.startOpts().closable).toBe(true) // over a project: « Tous les lieux » can be closed back to it
    h.startOpts().onProfile('etudie')
    h.startOpts().onResult({ kind: 'chosen', profile: 'etudie', offer: 'skipped' })
    await settle()
    expect(h.log).toEqual(['showStart', 'hide', 'focus', 'panel:tree:true', 'panel:props:true', 'drawer:consoles'])
    expect(h.record()).toMatchObject({ profile: 'etudie', offer: 'skipped' })
  })
  it('a click with no place open and a tutorial taken: the room opens, the request is raised', async () => {
    const h = harness({}, { storage: memoryStorage({ v: 1, profile: 'decouvre', offer: 'skipped', request: 0, shown: [] }) })
    h.chip().onClick()
    h.startOpts().onProfile('decouvre')
    h.startOpts().onResult({ kind: 'chosen', profile: 'decouvre', offer: 'taken' })
    await settle()
    expect(h.log).toContain('room')
    expect(h.record()).toMatchObject({ offer: 'taken', request: 1 })
  })
  it('each opening of the start stage can be answered once (the double-click guard is per open)', async () => {
    const h = harness({}, { storage: memoryStorage({ v: 1, profile: 'decouvre', offer: 'skipped', request: 0, shown: [] }) })
    h.setPlace(true)
    for (let i = 0; i < 2; i++) {
      h.chip().onClick()
      h.startOpts().onResult({ kind: 'chosen', profile: 'decouvre', offer: 'taken' })
      h.startOpts().onResult({ kind: 'chosen', profile: 'decouvre', offer: 'taken' })
      await settle()
    }
    expect(h.record().request).toBe(2)
  })
})
