/**
 * The goal tree (mission 1, spec 3): the bundled trimmed copy content/onboarding/goal-tree.json (marketing's DRAFT, made by tools/trim-goal-tree.mjs), its pure
 * validator, the loader, `goalPath`, `profileForGoal` and `roomsForGoal`. A bad file fails here, never in front of the learner (the loader then returns null and the
 * start screen keeps the four profiles). The empty state and the end of the way on screen 2 are also proven on a tiny synthetic tree (`SMALL`), so they do not
 * depend on what the draft happens to hold.
 */
import { describe, expect, it } from 'vitest'
import treeJson from '../../content/onboarding/goal-tree.json'
import schoolsJson from '../../content/onboarding/schools.json'
import roomIndex from '../../content/rooms/index.json'
import { PROFILE_IDS } from '../../src/creation/onboarding/state'
import { SMALL } from './goalTreeFixture'
import { GOAL_PROFILES, ROOM_IDS, findGoal, goalPath, loadGoalTree, profileForGoal, roomsForGoal, validateGoalTree, type GoalNode, type GoalTree } from '../../src/creation/onboarding/goalTree'

const rooms = new Set((roomIndex as { rooms: { id: string }[] }).rooms.map((r) => r.id))
const clone = (): GoalTree => JSON.parse(JSON.stringify(treeJson)) as GoalTree
const all = (ns: readonly GoalNode[]): GoalNode[] => ns.flatMap((n) => [n, ...all(n.children)])

describe('content/onboarding/goal-tree.json (the trimmed draft)', () => {
  const r = validateGoalTree(treeJson, rooms)

  it('is valid against content/rooms/index.json', () => {
    expect(r.ok ? [] : r.errors).toEqual([])
  })

  it('has the five goals, each mapped to a profile, and an « autre » child under each', () => {
    const t = treeJson as GoalTree
    expect(t.goals.map((g) => g.id)).toEqual(['etudie', 'travaille', 'reconversion', 'passion', 'decouvre'])
    for (const g of t.goals) {
      expect(PROFILE_IDS).toContain(profileForGoal(g.id))
      expect(g.children.map((c) => c.id)).toContain(`${g.id}.autre`)
    }
    expect(t.version).toMatch(/\S/)
    expect(t.status).toMatch(/\S/)
  })

  it('keeps only the fields the app uses (the review-only fields, seat counts, fees and dates are not in the copy)', () => {
    const t = treeJson as unknown as Record<string, unknown>
    expect(Object.keys(t).sort()).toEqual(['goals', 'status', 'version'])
    for (const n of all((treeJson as GoalTree).goals)) {
      for (const k of Object.keys(n)) expect(['id', 'label', 'level', 'rooms', 'children', 'school_field'], `${n.id}.${k}`).toContain(k)
    }
    expect(all((treeJson as GoalTree).goals).filter((n) => n.school_field).map((n) => n.id)).toEqual(['etudie'])
  })

  it('every room it names exists, and every end of the way has rooms of its own or from its parent', () => {
    const t = treeJson as GoalTree
    for (const n of all(t.goals)) for (const id of n.rooms) expect(rooms.has(id), `${n.id}: ${id}`).toBe(true)
    for (const n of all(t.goals).filter((x) => x.level > 1 && x.children.length === 0)) expect(roomsForGoal(t, { id: n.id }).length, n.id).toBeGreaterThan(0)
  })

  it('schools.json is the school list trimmed to id, name, cities and kind', () => {
    const s = schoolsJson as { schools: Record<string, unknown>[] }
    expect(s.schools.length).toBeGreaterThan(0)
    for (const x of s.schools) expect(Object.keys(x).sort()).toEqual(['cities', 'id', 'kind', 'name'])
  })
})

describe('validateGoalTree', () => {
  const errs = (raw: unknown): string[] => {
    const r = validateGoalTree(raw, rooms)
    return r.ok ? [] : r.errors
  }

  it('the small synthetic tree is valid', () => {
    expect(errs(SMALL)).toEqual([])
  })

  it('refuses what is not a tree', () => {
    for (const raw of [null, 3, 'x', [], {}]) expect(errs(raw).length, JSON.stringify(raw)).toBeGreaterThan(0)
  })

  it('refuses four or six goals, and a goal that maps to no profile', () => {
    const t = clone()
    expect(errs({ ...t, goals: t.goals.slice(0, 4) })).not.toEqual([])
    expect(errs({ ...t, goals: [...t.goals, { ...t.goals[0]!, id: 'sixieme' }] })).not.toEqual([])
    const u = clone()
    u.goals[0]!.id = 'inconnu'
    expect(errs(u)).not.toEqual([])
  })

  it('reports a room id that is not in content/rooms/index.json, and the other faults', () => {
    const cases: [string, (t: GoalTree) => void][] = [
      ['unknown room', (t) => t.goals[0]!.children[0]!.rooms.push('no-such-room')],
      ['a set is not a room id', (t) => t.goals[0]!.children[0]!.rooms.push('set:plateau')],
      ['duplicate room', (t) => t.goals[0]!.children[0]!.rooms.push(t.goals[0]!.children[0]!.rooms[0]!)],
      ['duplicate id', (t) => void (t.goals[1]!.children[1]!.id = t.goals[1]!.children[0]!.id)],
      ['id not under its parent', (t) => void (t.goals[1]!.children[0]!.id = 'etudie.ailleurs')],
      ['bad word in an id', (t) => void (t.goals[1]!.children[0]!.id = 'travaille.Avec Espace')],
      ['wrong level', (t) => void ((t.goals[1]!.children[0] as { level: number }).level = 3)],
      ['empty label', (t) => void (t.goals[0]!.label = ' ')],
      ['no « autre » child', (t) => void (t.goals[2]!.children = t.goals[2]!.children.filter((c) => !c.id.endsWith('.autre')))],
      ['a goal with no children', (t) => void (t.goals[3]!.children = [])],
      ['a fourth level', (t) => void (findGoal(t, 'travaille.live')!.children[0]!.children = [{ id: 'travaille.live.sonorisateur.x', label: 'x', level: 3, rooms: [], children: [] }])],
      ['rooms not a list', (t) => void ((t.goals[0]!.children[0] as { rooms: unknown }).rooms = 'arena-large')],
      ['eleven children (keys 1 to 9 and 0 only)', (t) => void (t.goals[1]!.children = [...t.goals[1]!.children, { id: 'travaille.x', label: 'x', level: 2, rooms: [], children: [] }])],
      ['school_field not true', (t) => void ((t.goals[0] as { school_field: unknown }).school_field = 'oui')],
      ['no version', (t) => void ((t as { version: unknown }).version = '')],
    ]
    for (const [what, mutate] of cases) {
      const t = clone()
      mutate(t)
      expect(errs(t).length, what).toBeGreaterThan(0)
    }
  })
})

describe('loadGoalTree, goalPath, profileForGoal and roomsForGoal', () => {
  it('loadGoalTree returns the bundled tree; null (warned) for a bad file', () => {
    expect(loadGoalTree()?.goals).toHaveLength(5)
    const warns: unknown[] = []
    expect(loadGoalTree({ version: 1 }, (...a: unknown[]) => void warns.push(a))).toBeNull()
    expect(warns.length).toBe(1)
    expect(ROOM_IDS).toEqual((roomIndex as { rooms: { id: string }[] }).rooms.map((r) => r.id))
  })

  it('goalPath: the nodes from the goal down to a dotted id; null when any step is missing', () => {
    expect(goalPath(SMALL, 'travaille.live.club')?.map((n) => n.id)).toEqual(['travaille', 'travaille.live', 'travaille.live.club'])
    expect(goalPath(SMALL, 'travaille')?.map((n) => n.id)).toEqual(['travaille'])
    expect(goalPath(SMALL, 'travaille.gone.club')).toBeNull()
    expect(goalPath(SMALL, 'gone')).toBeNull()
  })

  it('profileForGoal: by the level-1 id, for every node of that goal', () => {
    expect(GOAL_PROFILES).toEqual({ etudie: 'etudie', travaille: 'metier', reconversion: 'projet', passion: 'projet', decouvre: 'decouvre' })
    expect(profileForGoal('travaille.live.club')).toBe('metier')
    expect(profileForGoal('reconversion.autre')).toBe('projet')
    expect(profileForGoal('gone.x')).toBeNull()
  })

  it('a null goal and an unknown id are every room', () => {
    expect(roomsForGoal(SMALL, null)).toEqual([...ROOM_IDS])
    expect(roomsForGoal(SMALL, { id: 'travaille.gone' })).toEqual([...ROOM_IDS])
  })

  it('a node with rooms gives its own; a node with none gives its parent\'s; with none there either, the empty state', () => {
    expect(roomsForGoal(SMALL, { id: 'travaille.live.club' })).toEqual(['bar-club-stage-small'])
    expect(roomsForGoal(SMALL, { id: 'travaille.live.hf' })).toEqual(['arena-large', 'concert-hall-medium'])
    expect(roomsForGoal(SMALL, { id: 'decouvre.vide' })).toEqual([])
  })
})
