/**
 * The goal tree (mission 1, spec 3): the bundled data file content/onboarding/goal-tree.json, its pure validator, the loader and `roomsForGoal`. A bad file fails here,
 * never in front of the learner (the loader then returns null and the start screen keeps the four profiles).
 */
import { describe, expect, it } from 'vitest'
import treeJson from '../../content/onboarding/goal-tree.json'
import roomIndex from '../../content/rooms/index.json'
import { PROFILE_IDS } from '../../src/creation/onboarding/state'
import { ROOM_IDS, findGoal, loadGoalTree, roomsForGoal, validateGoalTree, type GoalTree } from '../../src/creation/onboarding/goalTree'

const rooms = new Set((roomIndex as { rooms: { id: string }[] }).rooms.map((r) => r.id))
const clone = (): GoalTree => JSON.parse(JSON.stringify(treeJson)) as GoalTree

describe('content/onboarding/goal-tree.json', () => {
  const r = validateGoalTree(treeJson, rooms)

  it('is valid', () => {
    expect(r.ok ? [] : r.errors).toEqual([])
  })

  it('is the placeholder until the research file arrives, with exactly five goals mapped to a profile', () => {
    const t = treeJson as GoalTree
    expect(t.version).toBe(1)
    expect(t.status).toBe('placeholder')
    expect(t.goals).toHaveLength(5)
    for (const g of t.goals) expect(PROFILE_IDS).toContain(g.profile)
    expect(t.goals.map((g) => g.label_fr)).toEqual([
      'Découvrir le son',
      'Étudier le son',
      'Faire de la musique (live et studio)',
      'Monter un événement ou un projet',
      'Travailler dans le son',
    ])
  })

  it('every room it names exists in content/rooms/index.json, and one speciality has no room (the empty state is real)', () => {
    const t = treeJson as GoalTree
    const named = t.goals.flatMap((g) => g.subgoals.flatMap((s) => s.specialities.flatMap((p) => p.rooms)))
    expect(named.length).toBeGreaterThan(0)
    for (const id of named) expect(rooms.has(id), id).toBe(true)
    const empty = t.goals.flatMap((g) => g.subgoals.flatMap((s) => s.specialities.filter((p) => p.rooms.length === 0)))
    expect(empty.length).toBeGreaterThanOrEqual(1)
  })

  it('every room of the index is reachable from some goal (no place is lost by choosing a goal path)', () => {
    const t = treeJson as GoalTree
    const named = new Set(t.goals.flatMap((g) => g.subgoals.flatMap((s) => s.specialities.flatMap((p) => p.rooms))))
    expect([...rooms].filter((id) => !named.has(id))).toEqual([])
  })

  it('the hints address the learner as « vous »', () => {
    for (const g of (treeJson as GoalTree).goals) expect(g.hint_fr, g.id).toMatch(/\b[Vv]ous\b/)
  })
})

describe('validateGoalTree', () => {
  const errs = (raw: unknown): string[] => {
    const r = validateGoalTree(raw, rooms)
    return r.ok ? [] : r.errors
  }

  it('refuses what is not a tree', () => {
    for (const raw of [null, 3, 'x', [], {}]) expect(errs(raw).length, JSON.stringify(raw)).toBeGreaterThan(0)
  })

  it('refuses a wrong version, an unknown status, a missing source', () => {
    expect(errs({ ...clone(), version: 2 })).not.toEqual([])
    expect(errs({ ...clone(), status: 'draft' })).not.toEqual([])
    expect(errs({ ...clone(), source: '' })).not.toEqual([])
    expect(errs({ ...clone(), status: 'researched' })).toEqual([])
  })

  it('refuses four or six goals', () => {
    const t = clone()
    expect(errs({ ...t, goals: t.goals.slice(0, 4) })).not.toEqual([])
    expect(errs({ ...t, goals: [...t.goals, { ...t.goals[0]!, id: 'sixieme' }] })).not.toEqual([])
  })

  it('refuses an unknown room, a duplicate id, an empty label, an unknown profile, no sub-choice, no speciality', () => {
    const cases: [string, (t: GoalTree) => void][] = [
      ['unknown room', (t) => t.goals[0]!.subgoals[0]!.specialities[0]!.rooms.push('no-such-room')],
      ['duplicate room in a speciality', (t) => t.goals[0]!.subgoals[0]!.specialities[0]!.rooms.push(t.goals[0]!.subgoals[0]!.specialities[0]!.rooms[0]!)],
      ['duplicate goal id', (t) => void (t.goals[1]!.id = t.goals[0]!.id)],
      ['duplicate sub id', (t) => void (t.goals[1]!.subgoals[0]!.id = t.goals[0]!.subgoals[0]!.id)],
      ['duplicate speciality id', (t) => void (t.goals[1]!.subgoals[0]!.specialities[0]!.id = t.goals[0]!.subgoals[0]!.specialities[0]!.id)],
      ['bad id', (t) => void (t.goals[0]!.id = 'Avec Espace')],
      ['empty goal label', (t) => void (t.goals[0]!.label_fr = ' ')],
      ['empty hint', (t) => void (t.goals[0]!.hint_fr = '')],
      ['empty sub label', (t) => void (t.goals[0]!.subgoals[0]!.label_fr = '')],
      ['empty speciality label', (t) => void (t.goals[0]!.subgoals[0]!.specialities[0]!.label_fr = '')],
      ['unknown profile', (t) => void ((t.goals[0] as { profile: string }).profile = 'pro')],
      ['no sub-choice', (t) => void (t.goals[0]!.subgoals = [])],
      ['no speciality', (t) => void (t.goals[0]!.subgoals[0]!.specialities = [])],
      ['rooms not a list', (t) => void ((t.goals[0]!.subgoals[0]!.specialities[0] as { rooms: unknown }).rooms = 'arena-large')],
      ['ten sub-choices (keys 1 to 9 only)', (t) => void (t.goals[0]!.subgoals = Array.from({ length: 10 }, (_, i) => ({ ...t.goals[0]!.subgoals[0]!, id: `s${i}`, specialities: [{ id: `p${i}`, label_fr: 'X', rooms: [] }] })))],
      ['first person in a label', (t) => void (t.goals[0]!.label_fr = 'Je découvre')],
      ['first person in a hint', (t) => void (t.goals[0]!.hint_fr = 'Mon projet à moi')],
    ]
    for (const [what, mutate] of cases) {
      const t = clone()
      mutate(t)
      expect(errs(t).length, what).toBeGreaterThan(0)
    }
  })

  it('accepts an empty room list (the empty state)', () => {
    const t = clone()
    t.goals[0]!.subgoals[0]!.specialities[0]!.rooms = []
    expect(errs(t)).toEqual([])
  })
})

describe('loadGoalTree, findGoal and roomsForGoal', () => {
  it('loadGoalTree returns the bundled tree, validated against the room index', () => {
    const t = loadGoalTree()
    expect(t).not.toBeNull()
    expect(t!.goals).toHaveLength(5)
    expect(ROOM_IDS).toEqual((roomIndex as { rooms: { id: string }[] }).rooms.map((r) => r.id))
  })

  it('loadGoalTree returns null for a bad file (the start screen then keeps the profiles), and warns', () => {
    const warns: unknown[] = []
    expect(loadGoalTree({ version: 1 }, (...a: unknown[]) => void warns.push(a))).toBeNull()
    expect(warns.length).toBe(1)
  })

  it('a null goal is every room', () => {
    const t = loadGoalTree()!
    expect(roomsForGoal(t, null)).toEqual([...ROOM_IDS])
  })

  it('a stored speciality gives its own rooms, in the order of the data', () => {
    const t = loadGoalTree()!
    const g = t.goals[0]!
    const s = g.subgoals[0]!
    const p = s.specialities[1]!
    expect(roomsForGoal(t, { goal: g.id, sub: s.id, speciality: p.id })).toEqual(p.rooms)
  })

  it('a speciality with no room gives an empty list (the empty state)', () => {
    const t = loadGoalTree()!
    const hit = t.goals.flatMap((g) => g.subgoals.flatMap((s) => s.specialities.filter((p) => p.rooms.length === 0).map((p) => ({ goal: g.id, sub: s.id, speciality: p.id }))))[0]!
    expect(roomsForGoal(t, hit)).toEqual([])
    expect(findGoal(t, hit)).not.toBeNull()
  })

  it('a goal path the tree does not know (a stale record after the tree was swapped) is every room, and findGoal says null', () => {
    const t = loadGoalTree()!
    const g = t.goals[0]!
    for (const stale of [
      { goal: 'gone', sub: g.subgoals[0]!.id, speciality: g.subgoals[0]!.specialities[0]!.id },
      { goal: g.id, sub: 'gone', speciality: g.subgoals[0]!.specialities[0]!.id },
      { goal: g.id, sub: g.subgoals[0]!.id, speciality: 'gone' },
      { goal: g.id, sub: t.goals[1]!.subgoals[0]!.id, speciality: t.goals[1]!.subgoals[0]!.specialities[0]!.id },
    ]) {
      expect(roomsForGoal(t, stale)).toEqual([...ROOM_IDS])
      expect(findGoal(t, stale)).toBeNull()
    }
  })

  it('findGoal returns the three nodes of a stored path', () => {
    const t = loadGoalTree()!
    const g = t.goals[4]!
    const s = g.subgoals[1]!
    const p = s.specialities[0]!
    expect(findGoal(t, { goal: g.id, sub: s.id, speciality: p.id })).toEqual({ goal: g, sub: s, speciality: p })
  })
})
