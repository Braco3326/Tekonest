/**
 * T6.4 (spec 3, « Entrepreneur, after the first sound »): the gating of the own-gear line and the three generic venue cards, and what is remembered.
 * Pure: no DOM. The DOM of the card is proven in tests/e2e/onboarding-entrepreneur.spec.ts and tests/creation/ownGearCard.test.ts.
 *
 * The card is due for a profile whose `afterFirstSound` DATA is `own-gear-and-venues` (never the profile's name), once a sound has started in this session, on an address
 * where the onboarding is on (a valid `?design` on a practice address), and until the learner dismissed it (remembered in the existing onboarding record).
 */
import { describe, expect, it } from 'vitest'
import { COPY } from '../../src/creation/copy'
import { VENUE_KEYS, ownGearDue, ownGearView, type OwnGearInput } from '../../src/creation/onboarding/ownGear'
import { PROFILES } from '../../src/creation/onboarding/profiles'
import { PROFILE_IDS, parseRecord, reduce, type OnboardingRecord } from '../../src/creation/onboarding/state'

const base: OwnGearInput = { onboarding: true, profile: 'projet', soundStarted: true, dismissed: false }

describe('ownGearDue (the gate)', () => {
  it('triggers: the entrepreneur profile, a sound started, not dismissed, onboarding on', () => {
    expect(ownGearDue(base)).toBe(true)
  })
  it('does not trigger before the first sound', () => {
    expect(ownGearDue({ ...base, soundStarted: false })).toBe(false)
  })
  it('does not trigger once dismissed', () => {
    expect(ownGearDue({ ...base, dismissed: true })).toBe(false)
  })
  it('does not trigger without the onboarding (the plain address, an exam address)', () => {
    expect(ownGearDue({ ...base, onboarding: false })).toBe(false)
  })
  it('does not trigger with no profile stored (« Tous les lieux », a chip left unanswered)', () => {
    expect(ownGearDue({ ...base, profile: null })).toBe(false)
  })
  it('does not trigger for any other profile (1, 2 and 4)', () => {
    for (const id of PROFILE_IDS) if (id !== 'projet') expect(ownGearDue({ ...base, profile: id }), id).toBe(false)
  })
  it('reads the profile’s DATA (afterFirstSound), so exactly one profile of the four triggers', () => {
    const due = PROFILES.filter((p) => ownGearDue({ ...base, profile: p.id }))
    expect(due.map((p) => p.afterFirstSound)).toEqual(['own-gear-and-venues'])
    expect(due.map((p) => p.key)).toEqual(['3'])
  })
})

describe('the record remembers the dismissal (audio-sim/creation-onboarding.v1, nothing else bumped)', () => {
  const old = JSON.stringify({ v: 1, profile: 'projet', offer: 'skipped', request: 0, shown: [] })
  it('an old record (no field) reads as not dismissed and keeps its shape exactly', () => {
    const r = parseRecord(old)!
    expect(r).toEqual({ v: 1, profile: 'projet', offer: 'skipped', request: 0, shown: [] })
    expect('ownGear' in r).toBe(false)
  })
  it('the dismissal is written, survives an answer and a request, and parses back', () => {
    let r: OnboardingRecord = reduce(parseRecord(old), { type: 'ownGear', value: 'dismissed' })
    expect(r.ownGear).toBe('dismissed')
    r = reduce(r, { type: 'request' })
    r = reduce(r, { type: 'answer', profile: 'etudie', offer: 'skipped' })
    expect(r.ownGear).toBe('dismissed')
    expect(parseRecord(JSON.stringify(r))!.ownGear).toBe('dismissed')
  })
  it('does not break on an unknown value: the record is still read, the field is ignored (a future value never loses the profile)', () => {
    const r = parseRecord(JSON.stringify({ v: 1, profile: 'projet', offer: null, request: 2, shown: [], ownGear: 'later' }))
    expect(r).toEqual({ v: 1, profile: 'projet', offer: null, request: 2, shown: [] })
  })
})

describe('the card’s words (COPY.ownGear): one line, three generic venue types, a label on each, no figure, no named venue', () => {
  const G = COPY.ownGear!
  it('the line is the spec’s sentence and the label is « salle d’exemple, non vérifiée »', () => {
    expect(G.line).toBe('Votre matériel n’est peut-être pas dans l’inventaire : seuls les appareils listés sont dans le simulateur.')
    expect(G.venueLabel).toBe('salle d’exemple, non vérifiée')
  })
  it('three venue types, in the spec’s words', () => {
    expect(VENUE_KEYS.map((k) => G[k])).toEqual(['Salle des fêtes', 'Bar-concert', 'Petite salle'])
  })
  it('no digit anywhere in the section (no capacity, size, price, date or count)', () => {
    for (const [k, t] of Object.entries(G)) expect(t, `ownGear.${k}`).not.toMatch(/\d/)
  })
})

describe('ownGearView (what the DOM shows): three venue types, EACH with the label; nothing else', () => {
  const v = ownGearView()
  it('three venues in order, every one carrying « salle d’exemple, non vérifiée »', () => {
    expect(v.venues.map((x) => x.title)).toEqual(['Salle des fêtes', 'Bar-concert', 'Petite salle'])
    for (const x of v.venues) expect(x.label).toBe('salle d’exemple, non vérifiée')
  })
  it('the line, the region name and the dismiss word are the COPY ones, and no text of the view has a digit', () => {
    expect(v.line).toBe(COPY.ownGear!.line)
    expect(v.dismiss).toBe('Fermer')
    for (const t of [v.region, v.line, v.dismiss, ...v.venues.flatMap((x) => [x.title, x.label])]) expect(t).not.toMatch(/\d/)
  })
})
