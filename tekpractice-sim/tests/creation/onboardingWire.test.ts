/**
 * The first-visit wiring (plan T2.4a / T2.4b and the T2 review fixes, spec 4, rulings R-A to R-E): what a start-screen answer does to the page (the neutral
 * room, the profile's panels and drawer tab, the framing), when the record is written (WITH the answer, after the room is open), when the tutorial may be
 * offered (`tutorialAllowed`), Aide « Premiers pas », the profile chip, and the double-answer guard.
 * Pure wiring over fakes (vitest runs in node, no DOM): the DOM of the screen and the chip is proven in tests/e2e/onboarding-start.spec.ts.
 */
import { describe, expect, it } from 'vitest'
import { wireOnboarding, type OnboardingWiring } from '../../src/creation/onboarding/firstVisit'
import type { PickerStartOpts } from '../../src/creation/shell/placePicker'
import type { ProfileChip, ProfileChipDeps } from '../../src/creation/onboarding/profileChip'
import { ONBOARDING_KEY, type StorageLike } from '../../src/creation/onboarding/state'

function memoryStorage(initial?: unknown): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set(ONBOARDING_KEY, JSON.stringify(initial))
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}
const rec = (profile: string | null, offer: string | null = null, request = 0) => ({ v: 1, profile, offer, request, shown: [] })

function harness(over: Partial<OnboardingWiring> = {}, opts: { storage?: ReturnType<typeof memoryStorage>; roomFails?: boolean } = {}) {
  const log: string[] = []
  const storage = opts.storage ?? memoryStorage()
  let place = false
  let startOpts!: PickerStartOpts
  let showStartCalls = 0
  let startShowing = false
  let chipDeps!: ProfileChipDeps
  let chipRenders = 0
  let roomFails = opts.roomFails === true
  /** What the stored record looked like when the room opened: the record must be written AFTER the room is there. */
  const recordWhenRoomOpened: unknown[] = []
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
        // the real picker leaves the start stage itself on « Tous les lieux » (before it tells the owner)
        startOpts = { ...o, onResult: (r) => { if (r.kind === 'all-places') startShowing = false; o.onResult(r) } }
        showStartCalls++
        startShowing = true
        log.push('showStart')
      },
      hide: () => {
        startShowing = false
        log.push('hide')
      },
      show: (o) => {
        startShowing = false
        log.push(`show:${o.closable}:${o.focus}`)
      },
      get startShowing() {
        return startShowing
      },
    },
    placeOpen: () => place,
    openNeutralRoom: async () => {
      log.push('room')
      await Promise.resolve()
      recordWhenRoomOpened.push(storage.data.get(ONBOARDING_KEY) ?? null)
      if (!roomFails) {
        place = true
        startShowing = false
      }
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
    setRoomFails: (f: boolean) => (roomFails = f),
    recordWhenRoomOpened,
    record: () => (storage.data.has(ONBOARDING_KEY) ? JSON.parse(storage.data.get(ONBOARDING_KEY)!) : null),
  }
}
const settle = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('no onboarding (no ?design, or an exam address: the boot passes design false): nothing exists', () => {
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

describe('the start screen answer (T2.4a, R-B: the record is written WITH the answer, after the room is open)', () => {
  it('shows the start screen on a first visit, with the step count and the offer allowed, and writes nothing until an answer', () => {
    const h = harness()
    expect(h.ob.startFirstVisit()).toBe(true)
    expect(h.startOpts()).toMatchObject({ stepCount: 10, offerAllowed: true, closable: false, offerEscape: 'skip' })
    expect(h.startOpts().offerFor).toBeUndefined()
    expect(h.storage.data.size).toBe(0)
  })
  it('does not show it when the learner was asked: a record with an answered offer, or with no profile', () => {
    for (const r of [rec('etudie', 'skipped'), rec('projet', 'taken', 1), rec(null, null, 1)]) {
      const h = harness({}, { storage: memoryStorage(r) })
      expect(h.ob.startFirstVisit()).toBe(false)
      expect(h.showStartCalls()).toBe(0)
    }
  })
  it('a profile with the offer not answered (a first visit on ?oscar=0), where the tutorial is now allowed: the OFFER for that profile, « Passer » on Échap', () => {
    const h = harness({}, { storage: memoryStorage(rec('etudie')) })
    expect(h.ob.startFirstVisit()).toBe(true)
    expect(h.startOpts()).toMatchObject({ offerFor: 'etudie', offerAllowed: true, offerEscape: 'skip', closable: false })
  })
  it('the same record where the tutorial is still not allowed: no start screen (the picker)', () => {
    const h = harness({ tutorialAllowed: false }, { storage: memoryStorage(rec('etudie')) })
    expect(h.ob.startFirstVisit()).toBe(false)
  })
  it('profile 2 + « Passer »: the neutral room opens FIRST, then the frame, the two panels, the drawer on Consoles; the record is written once the room is open', async () => {
    const h = harness()
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'chosen', profile: 'etudie', offer: 'skipped' })
    expect(h.record()).toBeNull() // not written at the click
    await settle()
    expect(h.log).toEqual(['showStart', 'room', 'frame', 'panel:tree:true', 'panel:props:true', 'drawer:consoles'])
    expect(h.recordWhenRoomOpened).toEqual([null]) // the room opened with nothing stored yet
    expect(h.record()).toMatchObject({ profile: 'etudie', offer: 'skipped', request: 0 })
  })
  it('T6.1: the first-sound framing reserves the tutorial’s row when the tutorial is taken (the SM58 keeps its pixels once the step card’s row is there), and not when it is skipped', async () => {
    for (const [offer, row] of [['taken', true], ['skipped', false]] as const) {
      const frames: unknown[] = []
      const h = harness({ frameNeutralRoom: (o?: { tutorialRow?: boolean }) => void frames.push(o?.tutorialRow) })
      h.ob.startFirstVisit()
      h.startOpts().onResult({ kind: 'chosen', profile: 'decouvre', offer })
      await settle()
      expect(frames, offer).toEqual([row])
    }
  })
  it('T6.1: Aide › Premiers pas with no place open frames for the canvas minus the tutorial’s row (the tutorial follows)', async () => {
    const frames: unknown[] = []
    const h = harness({ frameNeutralRoom: (o?: { tutorialRow?: boolean }) => void frames.push(o?.tutorialRow) })
    h.setPlace(false)
    await h.ob.requestTutorial()
    expect(frames).toEqual([true])
  })
  it('a profile that leaves the panels to the package takes the package\'s layout', async () => {
    const h = harness({ panels: { tree: false, props: true } })
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'chosen', profile: 'decouvre', offer: 'taken' })
    await settle()
    expect(h.log.slice(1)).toEqual(['room', 'frame', 'panel:tree:false', 'panel:props:true', 'drawer:consoles'])
    expect(h.record()).toMatchObject({ profile: 'decouvre', offer: 'taken', request: 1 })
  })
  it('« Faire le tutoriel » with a room that did not open writes NOTHING: no request, no profile (T3.2 would start a tutorial on the grids)', async () => {
    const h = harness({}, { roomFails: true })
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'chosen', profile: 'decouvre', offer: 'taken' })
    await settle()
    expect(h.log).toEqual(['showStart', 'room'])
    expect(h.record()).toBeNull()
    expect(h.ob.snapshot().record).toBeNull()
  })
  it('a pick that returned busy or cancelled (no room, no error) does not leave the screen dead: the next answer is taken, and then it counts once', async () => {
    const h = harness({}, { roomFails: true })
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'chosen', profile: 'decouvre', offer: 'taken' })
    await settle()
    h.setRoomFails(false)
    h.startOpts().onResult({ kind: 'chosen', profile: 'decouvre', offer: 'taken' })
    await settle()
    expect(h.log.filter((l) => l === 'room')).toHaveLength(2)
    expect(h.record()).toMatchObject({ profile: 'decouvre', offer: 'taken', request: 1 })
  })
  it('« Tous les lieux » (or Échap on the profile stage) writes nothing and changes nothing: the next normal visit shows the start screen again', async () => {
    const h = harness()
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'all-places' })
    await settle()
    expect(h.log).toEqual(['showStart'])
    expect(h.storage.data.size).toBe(0)
  })
  it('a double click on « Faire le tutoriel » raises the request once and opens the room once (G6 concern 5)', async () => {
    const h = harness()
    h.ob.startFirstVisit()
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

describe('tutorialAllowed: false (?oscar=0) (T2.4b, R-A)', () => {
  it('the screen is told no offer is made; a profile choice is final: the profile is stored (after the room opened), no request, the room opens and the profile is applied', async () => {
    const h = harness({ tutorialAllowed: false })
    h.ob.startFirstVisit()
    expect(h.startOpts().offerAllowed).toBe(false)
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
  it('a final choice made again through the chip does not reset an offer answered on an earlier address', async () => {
    const h = harness({ tutorialAllowed: false }, { storage: memoryStorage(rec('etudie', 'skipped')) })
    h.setPlace(true)
    h.chip().onClick()
    h.startOpts().onResult({ kind: 'chosen', profile: 'metier', offer: null })
    await settle()
    expect(h.record()).toMatchObject({ profile: 'metier', offer: 'skipped' })
  })
})

describe('Aide « Premiers pas » (T2.4b)', () => {
  it('with no place open it opens the neutral room FIRST, frames it, then raises the request (the machine increments)', async () => {
    const h = harness()
    expect(h.ob.premiersPas).toBe(true)
    await h.ob.requestTutorial()
    expect(h.log).toEqual(['room', 'frame'])
    expect(h.record()).toMatchObject({ request: 1 })
    expect(h.ob.snapshot().record!.request).toBe(1)
  })
  it('with a place open it only raises the request: the room is the learner\'s, not replaced, its camera not moved', async () => {
    const h = harness()
    h.setPlace(true)
    await h.ob.requestTutorial()
    expect(h.log).toEqual([])
    expect(h.record()).toMatchObject({ request: 1 })
  })
  it('keeps the earlier answers and counts each ask', async () => {
    const h = harness({}, { storage: memoryStorage(rec('metier', 'skipped')) })
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
  it('while the start stage shows it must wait (it would open a room with no profile): it says why, and a direct ask does nothing', async () => {
    const h = harness()
    expect(h.ob.waiting()).toBeUndefined()
    h.ob.startFirstVisit()
    expect(h.ob.waiting()).toBe('Répondez d’abord à l’écran de départ.')
    await h.ob.requestTutorial()
    expect(h.log).toEqual(['showStart'])
    expect(h.record()).toBeNull()
  })
})

describe('the profile chip « Profil : X · changer » / « Choisir un profil » (T2.4b, review item 10)', () => {
  it('says « Choisir un profil » while no profile is stored, and « Profil : X · changer » after (and on the next visit)', async () => {
    const h = harness()
    expect(h.chip().label()).toBe('Choisir un profil')
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'chosen', profile: 'etudie', offer: 'skipped' })
    await settle()
    expect(h.chip().label()).toBe('Profil : J’étudie le son · changer')
    expect(h.chipRenders()).toBeGreaterThan(1) // rendered at wiring, then after the answer
    const again = harness({}, { storage: memoryStorage(rec('projet', 'skipped')) })
    expect(again.chip().label()).toBe('Profil : Je monte un projet · changer')
  })
  it('after « Tous les lieux » it is still there, and opens the profile stage (« Vous pourrez changer de profil à tout moment » is true)', () => {
    const h = harness()
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'all-places' })
    expect(h.chip().label()).toBe('Choisir un profil')
    h.chip().onClick()
    expect(h.showStartCalls()).toBe(2)
    expect(h.startOpts().offerEscape).toBe('leave')
  })
  it('a click reopens the start stage in chip mode (Échap on the offer leaves); over a project the grids are closable', () => {
    const h = harness({}, { storage: memoryStorage(rec('decouvre', 'skipped')) })
    h.setPlace(true)
    h.chip().onClick()
    expect(h.showStartCalls()).toBe(1)
    expect(h.startOpts()).toMatchObject({ closable: true, offerEscape: 'leave' })
    expect(h.startOpts().offerFor).toBeUndefined()
  })
  it('the stored profile is not touched by opening it, nor by anything short of an answer', async () => {
    const h = harness({}, { storage: memoryStorage(rec('decouvre', 'skipped')) })
    h.setPlace(true)
    h.chip().onClick()
    h.startOpts().onResult({ kind: 'all-places' })
    await settle()
    expect(h.record()).toEqual(rec('decouvre', 'skipped'))
  })
  it('a click while the start stage already shows does nothing (the profile is not asked twice, a pick in flight is not reset)', () => {
    const h = harness()
    h.ob.startFirstVisit()
    h.chip().onClick()
    expect(h.showStartCalls()).toBe(1)
  })
  it('a profile chosen with a place open is applied WITHOUT reopening the room: the picker closes, the focus returns, then the record is written and the profile applied; no framing', async () => {
    const h = harness({}, { storage: memoryStorage(rec('decouvre', 'skipped')) })
    h.setPlace(true)
    h.chip().onClick()
    h.startOpts().onResult({ kind: 'chosen', profile: 'etudie', offer: 'skipped' })
    await settle()
    expect(h.log).toEqual(['showStart', 'hide', 'focus', 'panel:tree:true', 'panel:props:true', 'drawer:consoles'])
    expect(h.record()).toMatchObject({ profile: 'etudie', offer: 'skipped' })
  })
  it('Échap on the offer in chip mode leaves with no change: over a project the picker closes and the focus returns; with no place the grids show; nothing is written', async () => {
    const over = harness({}, { storage: memoryStorage(rec('decouvre', 'skipped')) })
    over.setPlace(true)
    over.chip().onClick()
    over.startOpts().onResult({ kind: 'leave' })
    await settle()
    expect(over.log).toEqual(['showStart', 'hide', 'focus'])
    expect(over.record()).toEqual(rec('decouvre', 'skipped'))
    const none = harness({}, { storage: memoryStorage(rec('decouvre', 'skipped')) })
    none.chip().onClick()
    none.startOpts().onResult({ kind: 'leave' })
    await settle()
    expect(none.log).toEqual(['showStart', 'show:false:true'])
    expect(none.record()).toEqual(rec('decouvre', 'skipped'))
  })
  it('a click with no place open and a tutorial taken: the room opens, the request is raised, the new profile is stored', async () => {
    const h = harness({}, { storage: memoryStorage(rec('decouvre', 'skipped')) })
    h.chip().onClick()
    h.startOpts().onResult({ kind: 'chosen', profile: 'projet', offer: 'taken' })
    await settle()
    expect(h.log).toContain('room')
    expect(h.record()).toMatchObject({ profile: 'projet', offer: 'taken', request: 1 })
  })
  it('each opening of the start stage can be answered once (the double-click guard is per open)', async () => {
    const h = harness({}, { storage: memoryStorage(rec('decouvre', 'skipped')) })
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

describe('Aide while a tutorial runs: « Reprendre », « Recommencer », « Passer le tutoriel » (T3.2)', () => {
  const guide = (o: Record<string, unknown>) => JSON.stringify({ v: 1, handledRequest: 1, step: 'lecture-console', k: 6, n: 10, status: 'running', early: [], ...o })
  it('progress() is the guide record’s running step (oscar-guide.onboarding.v1), null when none runs or the record is missing / corrupt', () => {
    const storage = memoryStorage(rec('decouvre', 'taken', 1))
    const h = harness({}, { storage })
    expect(h.ob.progress()).toBeNull()
    storage.data.set('oscar-guide.onboarding.v1', guide({}))
    expect(h.ob.progress()).toEqual({ k: 6, n: 10 })
    storage.data.set('oscar-guide.onboarding.v1', guide({ status: 'skipped' }))
    expect(h.ob.progress()).toBeNull()
    storage.data.set('oscar-guide.onboarding.v1', '{x')
    expect(h.ob.progress()).toBeNull()
    expect(harness({ tutorialAllowed: false }, { storage }).ob.progress()).toBeNull()
  })
  it('each ask raises the request and says its kind (the guide acts on the kind once); restart and skip never open a room', async () => {
    const h = harness()
    await h.ob.requestTutorial('skip')
    expect(h.log).toEqual([])
    expect(h.record()).toMatchObject({ request: 1 })
    expect(h.ob.snapshot().requestKind).toBe('skip')
    await h.ob.requestTutorial('restart')
    expect(h.ob.snapshot().requestKind).toBe('restart')
    await h.ob.requestTutorial()
    expect(h.ob.snapshot().requestKind).toBe('start')
    expect(h.record()).toMatchObject({ request: 3 })
    expect(h.log).toEqual(['room', 'frame']) // only « Premiers pas » with no place opens the room
  })
  it('N3 (T3 close review): the kind is stored WITH the request, so a « Passer le tutoriel » reloaded before the guide’s poll is still a skip; a start leaves no field', async () => {
    const storage = memoryStorage(rec('decouvre', 'taken', 1))
    const h = harness({}, { storage })
    await h.ob.requestTutorial('skip')
    expect(JSON.parse(storage.data.get('audio-sim/creation-onboarding.v1')!)).toMatchObject({ request: 2, kind: 'skip' })
    // reload: a new page on the same storage reads the kind from the record
    const again = harness({}, { storage })
    expect(again.ob.snapshot()).toMatchObject({ requestKind: 'skip', requestAtLoad: 2 })
    await again.ob.requestTutorial()
    expect(JSON.parse(storage.data.get('audio-sim/creation-onboarding.v1')!)).toEqual({ v: 1, profile: 'decouvre', offer: 'taken', request: 3, shown: [] })
    expect(again.ob.snapshot()).toMatchObject({ requestKind: 'start', requestAtLoad: 2 })
  })
})
