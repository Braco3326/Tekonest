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
import type { OwnGearCard, OwnGearCardDeps } from '../../src/creation/onboarding/ownGearCard'
import { ONBOARDING_KEY, type StorageLike } from '../../src/creation/onboarding/state'
import { findGoal, loadGoalTree } from '../../src/creation/onboarding/goalTree'
import { SMALL } from './goalTreeFixture'
import type { RoomFilter } from '../../src/creation/shell/placePicker'

function memoryStorage(initial?: unknown): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set(ONBOARDING_KEY, JSON.stringify(initial))
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}
const rec = (profile: string | null, offer: string | null = null, request = 0) => ({ v: 1, profile, offer, request, shown: [] })

function harness(over: Partial<OnboardingWiring> = {}, opts: { storage?: ReturnType<typeof memoryStorage>; roomFails?: boolean } = {}) {
  const log: string[] = []
  /** What the wiring said on the status line. */
  const said: string[] = []
  const storage = opts.storage ?? memoryStorage()
  let place = false
  let startOpts!: PickerStartOpts
  let showStartCalls = 0
  let startShowing = false
  let chipDeps!: ProfileChipDeps
  let chipRenders = 0
  let roomFails = opts.roomFails === true
  /** The entrepreneur's card (T6.4): a fake that records what it was asked, and the dismiss handler the page's button would call. */
  let gearShown = false
  let gearDeps!: OwnGearCardDeps
  const gearLog: string[] = []
  const mountGear = (d: OwnGearCardDeps): OwnGearCard => {
    gearDeps = d
    return {
      show: () => {
        if (!gearShown) gearLog.push('show')
        gearShown = true
      },
      hide: () => {
        if (gearShown) gearLog.push('hide')
        gearShown = false
      },
      get shown() {
        return gearShown
      },
    }
  }
  /** What the stored record looked like when the room opened: the record must be written AFTER the room is there. */
  const recordWhenRoomOpened: unknown[] = []
  /** What the wiring handed the picker's goal filter, in order (mission 1). */
  const filters: (RoomFilter | null)[] = []
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
    announce: (m) => void said.push(m),
    shellRoot: {} as HTMLElement,
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
      setRoomFilter: (f) => void filters.push(f),
    },
    placeOpen: () => place,
    openFirstRoom: async () => {
      log.push('room')
      await Promise.resolve()
      recordWhenRoomOpened.push(storage.data.get(ONBOARDING_KEY) ?? null)
      if (!roomFails) {
        place = true
        startShowing = false
      }
      return !roomFails
    },
    frameFirstRoom: () => void log.push('frame'),
    setPanel: (p, open) => void log.push(`panel:${p}:${open}`),
    openInventory: (tab) => void log.push(`drawer:${tab}`),
    returnFocus: () => void log.push('focus'),
    ...over,
  }
  const ob = wireOnboarding(w, mountChip, mountGear)
  return {
    ob,
    said,
    gearShown: () => gearShown,
    gearLog,
    dismissGear: () => gearDeps.onDismiss(),
    log,
    storage,
    startOpts: () => startOpts,
    showStartCalls: () => showStartCalls,
    chip: () => chipDeps,
    chipRenders: () => chipRenders,
    setPlace: (p: boolean) => (place = p),
    setRoomFails: (f: boolean) => (roomFails = f),
    recordWhenRoomOpened,
    filters,
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
      const h = harness({ frameFirstRoom: (o?: { tutorialRow?: boolean }) => void frames.push(o?.tutorialRow) })
      h.ob.startFirstVisit()
      h.startOpts().onResult({ kind: 'chosen', profile: 'decouvre', offer })
      await settle()
      expect(frames, offer).toEqual([row])
    }
  })
  it('T6.1: Aide › Premiers pas with no place open frames for the canvas minus the tutorial’s row (the tutorial follows)', async () => {
    const frames: unknown[] = []
    const h = harness({ frameFirstRoom: (o?: { tutorialRow?: boolean }) => void frames.push(o?.tutorialRow) })
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

describe('the entrepreneur’s card (T6.4): due after the first sound, for the profile whose data says so, until dismissed', () => {
  const answer = async (h: ReturnType<typeof harness>, profile: string): Promise<void> => {
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'chosen', profile: profile as never, offer: 'skipped' })
    await settle()
  }
  it('triggers: profile 3, then the first sound shows the card; not before the sound', async () => {
    const h = harness()
    await answer(h, 'projet')
    expect(h.gearShown(), 'a profile alone shows nothing').toBe(false)
    h.ob.soundStarted()
    expect(h.gearShown()).toBe(true)
    h.ob.soundStarted() // idempotent
    expect(h.gearLog).toEqual(['show'])
  })
  it('does not trigger for the other three profiles', async () => {
    for (const profile of ['decouvre', 'etudie', 'metier']) {
      const h = harness()
      await answer(h, profile)
      h.ob.soundStarted()
      expect(h.gearShown(), profile).toBe(false)
      expect(h.gearLog, profile).toEqual([])
    }
  })
  it('does not trigger without the onboarding (no store: the plain address, an exam address)', () => {
    const h = harness({ design: false })
    h.ob.soundStarted()
    expect(h.gearShown()).toBe(false)
    expect(h.gearLog).toEqual([])
    expect(h.storage.data.size).toBe(0)
  })
  it('dismissing hides it, remembers it in the onboarding record (every other field kept), gives the focus back, and a later sound does not bring it back', async () => {
    const h = harness()
    await answer(h, 'projet')
    h.ob.soundStarted()
    h.log.length = 0
    h.dismissGear()
    expect(h.gearShown()).toBe(false)
    expect(h.log).toEqual(['focus'])
    expect(h.record()).toEqual({ v: 1, profile: 'projet', offer: 'skipped', request: 0, shown: [], ownGear: 'dismissed' })
    h.ob.soundStarted()
    expect(h.gearShown()).toBe(false)
  })
  it('a new page on a record that says dismissed never shows it; one without the field shows it after the first sound', () => {
    const dismissed = harness({}, { storage: memoryStorage({ ...rec('projet', 'skipped'), ownGear: 'dismissed' }) })
    dismissed.ob.soundStarted()
    expect(dismissed.gearShown()).toBe(false)
    const fresh = harness({}, { storage: memoryStorage(rec('projet', 'skipped')) })
    fresh.ob.soundStarted()
    expect(fresh.gearShown()).toBe(true)
  })
  it('a profile changed after the sound: to 3 shows it, away from 3 takes it away', async () => {
    const h = harness()
    await answer(h, 'etudie')
    h.ob.soundStarted()
    expect(h.gearShown()).toBe(false)
    h.setPlace(true)
    h.chip().onClick() // « Profil : … · changer » reopens the start stage over the project
    h.startOpts().onResult({ kind: 'chosen', profile: 'projet', offer: 'skipped' })
    await settle()
    expect(h.gearShown()).toBe(true)
    h.chip().onClick()
    h.startOpts().onResult({ kind: 'chosen', profile: 'metier', offer: 'skipped' })
    await settle()
    expect(h.gearShown()).toBe(false)
  })
})

describe('the entrepreneur’s card follows the address live (T6 review C1): an address that turns to an exam one takes it away and never shows it', () => {
  it('shown on a practice address, then the reader flips: the next refresh hides it (a bench change calls it)', async () => {
    let practice = true
    const h = harness({ practiceNow: () => practice })
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'chosen', profile: 'projet', offer: 'skipped' })
    await settle()
    h.ob.soundStarted()
    expect(h.gearShown(), 'positive control: the practice address shows it').toBe(true)
    practice = false
    h.ob.refresh()
    expect(h.gearShown()).toBe(false)
    expect(h.record(), 'hiding it is not a dismissal').not.toHaveProperty('ownGear')
  })
  it('the switch happens BEFORE the first sound: the sound on the exam address shows nothing', async () => {
    let practice = true
    const h = harness({ practiceNow: () => practice })
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'chosen', profile: 'projet', offer: 'skipped' })
    await settle()
    practice = false
    h.ob.soundStarted()
    expect(h.gearShown()).toBe(false)
    expect(h.gearLog).toEqual([])
  })
  it('does not trigger: no reader given (a unit with no address) follows the onboarding alone', async () => {
    const h = harness()
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'chosen', profile: 'projet', offer: 'skipped' })
    await settle()
    h.ob.soundStarted()
    h.ob.refresh()
    expect(h.gearShown()).toBe(true)
  })
})

describe('Aide « Premiers pas » on a package that starts on the playable model, with a place already open (T6 review S1)', () => {
  it('triggers: it opens the model through the first-room path (the replace dialog is the picker’s), frames it, THEN raises the request', async () => {
    const hold: { h?: ReturnType<typeof harness> } = {}
    const h = harness({ startsOnModel: true, openFirstRoom: async () => (hold.h!.log.push('room'), true) })
    hold.h = h
    h.setPlace(true)
    await h.ob.requestTutorial()
    expect(h.log).toEqual(['room', 'frame'])
    expect(h.record()).toMatchObject({ request: 1 })
    expect(h.said).toEqual([])
  })
  it('the replace was declined: no request (the three steps never run on the learner’s own bench), nothing framed, and it is said', async () => {
    const hold: { h?: ReturnType<typeof harness> } = {}
    const h = harness({ startsOnModel: true, openFirstRoom: async () => (hold.h!.log.push('room'), false) })
    hold.h = h
    h.setPlace(true)
    await h.ob.requestTutorial()
    expect(h.log).toEqual(['room'])
    expect(h.record()).toBeNull()
    expect(h.said).toEqual(['Le tutoriel de ce parcours se fait sur le modèle déjà câblé : il n’a pas été lancé, votre montage est inchangé.'])
  })
  it('does not trigger: a package that starts in the neutral room still only raises the request over an open place', async () => {
    const h = harness({ startsOnModel: false })
    h.setPlace(true)
    await h.ob.requestTutorial()
    expect(h.log).toEqual([])
    expect(h.record()).toMatchObject({ request: 1 })
  })
  it('does not trigger: a run already in progress is resumed, never replaced', async () => {
    const storage = memoryStorage(rec('decouvre', 'taken', 1))
    storage.data.set('oscar-guide.onboarding.v1', JSON.stringify({ v: 1, status: 'running', step: 'debrancher', k: 2, n: 3, handledRequest: 1, early: [], shown: [], passed: [], helper: false }))
    const h = harness({ startsOnModel: true, doc: { querySelector: () => null } as unknown as Document }, { storage })
    h.setPlace(true)
    await h.ob.requestTutorial()
    expect(h.log).toEqual([])
    expect(h.record()).toMatchObject({ request: 2 })
  })
})

describe('the goal screens (mission 1, spec 1.2 and 1.3): with `goals` on, the answer is a goal, the chip names it and the picker shows its rooms', () => {
  const tree = loadGoalTree()!
  const choice = { id: 'travaille.studio.mastering' }
  const node = findGoal(tree, choice.id)!

  it('the start screen gets the tree; the chip says « Choisir un but » until a goal is stored; no filter while there is none', () => {
    const h = harness({ goals: true })
    expect(h.chip().label()).toBe('Choisir un but')
    expect(h.ob.startFirstVisit()).toBe(true)
    expect(h.startOpts().goals?.goals).toHaveLength(5)
    expect(h.filters).toEqual([null])
  })

  it('without `goals` nothing changes: no tree handed to the start screen, the profile chip, no filter call', () => {
    const h = harness()
    h.ob.startFirstVisit()
    expect(h.startOpts().goals).toBeUndefined()
    expect(h.chip().label()).toBe('Choisir un profil')
    expect(h.filters).toEqual([])
  })

  it('a goal with the tutorial not taken: the record is written at once (goal and its profile), no room is opened, the picker shows the rooms of the goal', async () => {
    const h = harness({ goals: true, tutorialAllowed: false })
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'chosen', profile: 'metier', offer: null, goal: choice })
    await settle()
    expect(h.record()).toMatchObject({ profile: 'metier', offer: null, goal: choice })
    expect(h.log).toEqual(['showStart', 'show:false:true'])
    const last = h.filters.at(-1)!
    expect(last.rooms).toEqual(node.rooms)
    expect(last.label).toBe(node.label)
    expect(h.chip().label()).toBe(`But : ${node.label} · changer`)
  })

  it('a goal with the tutorial taken: the first room opens first, as with a profile, and the record keeps the goal', async () => {
    const h = harness({ goals: true })
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'chosen', profile: 'metier', offer: 'taken', goal: choice })
    await settle()
    expect(h.log.slice(0, 3)).toEqual(['showStart', 'room', 'frame'])
    expect(h.recordWhenRoomOpened).toEqual([null])
    expect(h.record()).toMatchObject({ profile: 'metier', offer: 'taken', request: 1, goal: choice })
    expect(h.filters.at(-1)?.rooms).toEqual(node.rooms)
  })

  it('« Passer »: no goal, no profile, the record exists (nothing asks again), every room shows (no filter)', async () => {
    const h = harness({ goals: true, tutorialAllowed: false })
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'chosen', profile: null, offer: null, goal: null })
    await settle()
    expect(h.record()).toMatchObject({ profile: null, goal: null })
    expect(h.filters.at(-1)).toBeNull()
    expect(h.chip().label()).toBe('Choisir un but')
    expect(h.log).toEqual(['showStart', 'show:false:true'])
    const again = harness({ goals: true, tutorialAllowed: false }, { storage: h.storage })
    expect(again.ob.startFirstVisit()).toBe(false)
  })

  it('a stored goal filters the picker from the start; a node with no room (nor its parent) is an empty filter; an unknown id is no filter', () => {
    const stored = harness({ goals: true }, { storage: memoryStorage({ ...rec('metier', 'skipped'), goal: choice }) })
    expect(stored.filters.map((x) => x?.rooms)).toEqual([node.rooms])
    const none = harness({ goals: true, goalTree: SMALL }, { storage: memoryStorage({ ...rec('decouvre', 'skipped'), goal: { id: 'decouvre.vide' } }) })
    expect(none.filters.map((x) => x?.rooms)).toEqual([[]])
    const stale = harness({ goals: true }, { storage: memoryStorage({ ...rec('metier', 'skipped'), goal: { id: 'travaille.gone' } }) })
    expect(stale.filters).toEqual([null])
    expect(stale.chip().label()).toBe('Choisir un but')
  })

  it('« Changer de but » (the filter\'s own button) and the chip reopen the goal screens; over a place the grids are closable', () => {
    const h = harness({ goals: true }, { storage: memoryStorage({ ...rec('metier', 'skipped'), goal: choice }) })
    h.filters.at(-1)!.changeGoal()
    expect(h.showStartCalls()).toBe(1)
    expect(h.startOpts()).toMatchObject({ closable: false, offerEscape: 'leave' })
    h.setPlace(true)
    h.chip().onClick()
    expect(h.showStartCalls()).toBe(1) // the start stage is already showing: the chip does not open it twice
    h.startOpts().onResult({ kind: 'all-places' })
    h.chip().onClick()
    expect(h.showStartCalls()).toBe(2)
    expect(h.startOpts()).toMatchObject({ closable: true, offerEscape: 'leave' })
  })

  it('a new goal through the chip over a place: the room stays, the profile applies, and the picker shows the new goal\'s rooms (closable back to the place)', async () => {
    const h = harness({ goals: true }, { storage: memoryStorage({ ...rec('metier', 'skipped'), goal: choice }) })
    h.setPlace(true)
    h.chip().onClick()
    const c2 = { id: 'etudie.bts-mav-son' }
    h.startOpts().onResult({ kind: 'chosen', profile: 'etudie', offer: 'skipped', goal: c2 })
    await settle()
    expect(h.log).not.toContain('room')
    expect(h.log).toContain('show:true:true')
    expect(h.log).toContain('drawer:consoles')
    expect(h.record()).toMatchObject({ profile: 'etudie', goal: c2 })
    expect(h.filters.at(-1)?.rooms).toEqual(findGoal(tree, c2.id)!.rooms)
  })

  it('the snapshot reports the goal chip text and the stored goal', async () => {
    const h = harness({ goals: true, tutorialAllowed: false })
    h.ob.startFirstVisit()
    h.startOpts().onResult({ kind: 'chosen', profile: 'metier', offer: null, goal: choice })
    await settle()
    expect(h.ob.snapshot()).toMatchObject({ chip: `But : ${node.label} · changer`, record: { goal: choice } })
  })
})
