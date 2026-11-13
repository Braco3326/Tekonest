/**
 * The entrepreneur's card after the first sound (onboarding packs, plan T6.4, spec 3): « Votre matériel n’est peut-être pas dans l’inventaire … » and three GENERIC venue
 * types, each labelled « salle d’exemple, non vérifiée ». Pure: no DOM, no Babylon (the card's DOM is ownGearCard.ts).
 *
 * Due only for a profile whose `afterFirstSound` DATA says so (src/creation/onboarding/profiles.ts: today the entrepreneur, « Je monte un projet »), once a sound has started in
 * this session, where the onboarding is on (a valid `?design` on a practice address: never exam, never the plain address), and until the learner dismissed it. The dismissal
 * is remembered in the onboarding record (`audio-sim/creation-onboarding.v1`, field `ownGear`).
 *
 * Honesty: the venue cards are TYPES, not places. They carry no capacity, size, price or any figure and no real venue's name; they are informational (no button): the rooms the
 * app has are examples whose sizes and capacities are the picker's own, and no data maps a venue type to one of them, so a press would have to invent that mapping.
 */
import { COPY } from '../copy'
import { profileById } from './profiles'
import type { ProfileId } from './state'

export interface OwnGearInput {
  /** The onboarding is on (wireOnboarding built a store): a valid `?design` on a practice address. */
  onboarding: boolean
  /** The stored profile, or null (none chosen). */
  profile: ProfileId | null
  /** A sound has started in this session (Écoute played: the first `playStarted`). */
  soundStarted: boolean
  /** The learner dismissed the card (the record's `ownGear`). */
  dismissed: boolean
}

export function ownGearDue(i: OwnGearInput): boolean {
  return i.onboarding && i.soundStarted && !i.dismissed && i.profile !== null && profileById(i.profile).afterFirstSound === 'own-gear-and-venues'
}

/** COPY.ownGear keys of the three venue types, in order (Salle des fêtes, Bar-concert, Petite salle). */
export const VENUE_KEYS: readonly string[] = Object.freeze(['venueFetes', 'venueBar', 'venueSmall'])

export interface OwnGearView {
  /** The accessible name of the region. */
  region: string
  line: string
  venues: { title: string; label: string }[]
  dismiss: string
}

export function ownGearView(): OwnGearView {
  const G = COPY.ownGear!
  return { region: G.region!, line: G.line!, venues: VENUE_KEYS.map((k) => ({ title: G[k]!, label: G.venueLabel! })), dismiss: G.dismiss! }
}
