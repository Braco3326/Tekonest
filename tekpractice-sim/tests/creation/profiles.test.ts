/**
 * ProfilePreset table (plan T2.2, spec 3): four profiles, labelled by situation, keys 1 to 4, the offer button that takes the focus per profile,
 * every label a COPY key. Data only: the table never changes catalog, rules or engine.
 */
import { describe, expect, it } from 'vitest'
import { COPY } from '../../src/creation/copy'
import { TAB_LABELS } from '../../src/creation/inventory'
import { PROFILES, profileById, profileByKey } from '../../src/creation/onboarding/profiles'
import { PROFILE_IDS } from '../../src/creation/onboarding/state'

describe('PROFILES (spec 3)', () => {
  it('has four entries, one per profile id of the state machine, in key order', () => {
    expect(PROFILES.map((p) => p.id)).toEqual([...PROFILE_IDS])
    expect(PROFILES.map((p) => p.id)).toEqual(['decouvre', 'etudie', 'projet', 'metier'])
    expect(PROFILES).toHaveLength(4)
  })
  it('keys are 1 to 4, unique, in order', () => {
    expect(PROFILES.map((p) => p.key)).toEqual(['1', '2', '3', '4'])
    expect(new Set(PROFILES.map((p) => p.key)).size).toBe(4)
    expect(new Set(PROFILES.map((p) => p.labelKey)).size).toBe(4)
  })
  it('the offer focus per profile: beginner and entrepreneur on the tutorial, student and engineer on « Passer »', () => {
    expect(Object.fromEntries(PROFILES.map((p) => [p.id, p.offerFocus]))).toEqual({
      decouvre: 'tutorial',
      etudie: 'skip',
      projet: 'tutorial',
      metier: 'skip',
    })
  })
  it('every label key is in COPY.onboarding, with the founder\'s situation wording', () => {
    const labels = Object.fromEntries(PROFILES.map((p) => [p.id, COPY.onboarding![p.labelKey]]))
    expect(labels).toEqual({
      decouvre: 'Je découvre',
      etudie: 'J’étudie le son',
      projet: 'Je monte un projet',
      metier: 'Je travaille dans le son',
    })
  })
  it('the rest of the spec 3 table: tab, panels, Oscar, what follows the first sound', () => {
    expect(PROFILES.map((p) => [p.inventoryTab, p.panels, p.oscarProactive, p.afterFirstSound])).toEqual([
      ['consoles', 'package', true, 'none'],
      ['consoles', { tree: true, props: true }, true, 'none'],
      ['consoles', 'package', true, 'own-gear-and-venues'],
      ['consoles', { tree: true, props: true }, false, 'none'],
    ])
    for (const p of PROFILES) expect(Object.keys(TAB_LABELS), p.id).toContain(p.inventoryTab)
  })
  it('lookups by id and by key; an unknown key is undefined', () => {
    expect(profileById('projet').key).toBe('3')
    expect(profileByKey('4')?.id).toBe('metier')
    expect(profileByKey('5')).toBeUndefined()
    expect(profileByKey('')).toBeUndefined()
  })
  it('the table is frozen: no code can change a profile at run time', () => {
    expect(Object.isFrozen(PROFILES)).toBe(true)
    for (const p of PROFILES) expect(Object.isFrozen(p), p.id).toBe(true)
  })
})
