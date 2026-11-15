/** A tiny synthetic goal tree for the unit tests (mission 1): valid, and independent of what the draft tree happens to hold. */
import type { GoalNode, GoalTree } from '../../src/creation/onboarding/goalTree'

/** A tiny valid tree: `decouvre.vide` has no room and its parent none (the empty state); `etudie.a` has no children (screen 2 is the end). */
const leaf = (id: string, level: 2 | 3, r: string[] = []): GoalNode => ({ id, label: id, level, rooms: r, children: [] })
export const SMALL: GoalTree = {
  version: 'test',
  status: 'test',
  goals: [
    { id: 'etudie', label: 'Étudier', level: 1, rooms: [], children: [leaf('etudie.a', 2, ['classroom-lab-small']), leaf('etudie.autre', 2)], school_field: true },
    { id: 'travaille', label: 'Travailler', level: 1, rooms: [], children: [{ ...leaf('travaille.live', 2, ['arena-large', 'concert-hall-medium']), children: [leaf('travaille.live.hf', 3), leaf('travaille.live.club', 3, ['bar-club-stage-small'])] }, leaf('travaille.autre', 2)] },
    { id: 'reconversion', label: 'Changer', level: 1, rooms: [], children: [leaf('reconversion.autre', 2, ['podcast-room-small'])] },
    { id: 'passion', label: 'Passion', level: 1, rooms: [], children: [leaf('passion.autre', 2, ['dj-booth-small'])] },
    { id: 'decouvre', label: 'Découvrir', level: 1, rooms: [], children: [leaf('decouvre.vide', 2), leaf('decouvre.autre', 2, ['arena-large'])] },
  ],
}

