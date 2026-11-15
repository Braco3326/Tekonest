/**
 * The goal tree (mission 1, spec 3): five goals, each with its sub-choices, each with its specialities, and the rooms a speciality lists. Data only: the tree is
 * content/onboarding/goal-tree.json, bundled (imported as JSON), so a bad file fails the unit tests (tests/creation/goalTree.test.ts), not the learner. Pure: no DOM,
 * no storage. The file is a placeholder (`status: "placeholder"`) until marketing's research file arrives; swapping it is replacing that one JSON.
 *
 * `roomsForGoal` is what the place picker shows for a stored goal: the speciality's rooms (possibly none: the empty state), or every room for no goal or a path the
 * tree does not know (a record written against an older tree is never a reason to hide places).
 */
import treeJson from '../../../content/onboarding/goal-tree.json'
import roomIndexJson from '../../../content/rooms/index.json'
import { PROFILE_IDS, type ProfileId } from './state'

export interface GoalSpeciality {
  id: string
  label_fr: string
  /** Room ids of content/rooms/index.json; `[]` is legal (the picker shows its empty state). */
  rooms: string[]
}

export interface GoalSub {
  id: string
  label_fr: string
  specialities: GoalSpeciality[]
}

export interface Goal {
  id: string
  label_fr: string
  hint_fr: string
  /** The profile the record keeps for the panels and the drawer tab (profiles.ts): the goal decides it. */
  profile: ProfileId
  subgoals: GoalSub[]
}

export interface GoalTree {
  version: 1
  status: 'placeholder' | 'researched'
  source: string
  goals: Goal[]
}

/** A stored goal path (the onboarding record's `goal`): the ids of the three screens' answers. */
export interface GoalChoice {
  goal: string
  sub: string
  speciality: string
}

/** Every room id of content/rooms/index.json, in its order. */
export const ROOM_IDS: readonly string[] = Object.freeze((roomIndexJson as { rooms: { id: string }[] }).rooms.map((r) => r.id))

/** The number of goals (spec 1.2: screen 1 has five, keys 1 to 5). */
export const GOAL_COUNT = 5
/** A sub-choice or speciality screen answers to the digit keys 1 to 9. */
const MAX_CHOICES = 9
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** The learner is addressed as « vous »: no label or hint of the tree speaks in the first person. */
const FIRST_PERSON = /(?:^|[^\p{L}])(?:je|j[’']|me|m[’']|moi|mon|ma|mes)(?=$|[^\p{L}])/iu

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

export type GoalTreeCheck = { ok: true; tree: GoalTree } | { ok: false; errors: string[] }

/** Checks `raw` against the schema of spec 3; `rooms` = the room ids that exist. Every problem is listed (a path and what is wrong), none is repaired. */
export function validateGoalTree(raw: unknown, rooms: ReadonlySet<string>): GoalTreeCheck {
  const errors: string[] = []
  const err = (at: string, what: string): void => void errors.push(`${at}: ${what}`)
  if (!isObj(raw)) return { ok: false, errors: ['tree: not an object'] }
  if (raw.version !== 1) err('version', 'must be 1')
  if (raw.status !== 'placeholder' && raw.status !== 'researched') err('status', 'must be "placeholder" or "researched"')
  if (!text(raw.source)) err('source', 'must be a non-empty text')
  const label = (at: string, v: unknown): void => {
    if (!text(v)) err(at, 'must be a non-empty French text')
    else if (FIRST_PERSON.test(v)) err(at, 'speaks in the first person (the learner is addressed as « vous »)')
  }
  const ids = { goal: new Set<string>(), sub: new Set<string>(), speciality: new Set<string>() }
  const id = (at: string, v: unknown, kind: keyof typeof ids): void => {
    if (typeof v !== 'string' || !ID.test(v)) return err(at, 'id must be lower-case words joined by « - »')
    if (ids[kind].has(v)) err(at, `duplicate ${kind} id « ${v} »`)
    ids[kind].add(v)
  }
  const list = (at: string, v: unknown, min: number, max: number): unknown[] => {
    if (!Array.isArray(v)) {
      err(at, 'must be a list')
      return []
    }
    if (v.length < min || v.length > max) err(at, min === max ? `must hold exactly ${min}` : `must hold ${min} to ${max}`)
    return v
  }
  list('goals', raw.goals, GOAL_COUNT, GOAL_COUNT).forEach((g, gi) => {
    const at = `goals[${gi}]`
    if (!isObj(g)) return err(at, 'not an object')
    id(`${at}.id`, g.id, 'goal')
    label(`${at}.label_fr`, g.label_fr)
    label(`${at}.hint_fr`, g.hint_fr)
    if (!(PROFILE_IDS as readonly unknown[]).includes(g.profile)) err(`${at}.profile`, `must be one of ${PROFILE_IDS.join('|')}`)
    list(`${at}.subgoals`, g.subgoals, 1, MAX_CHOICES).forEach((s, si) => {
      const sat = `${at}.subgoals[${si}]`
      if (!isObj(s)) return err(sat, 'not an object')
      id(`${sat}.id`, s.id, 'sub')
      label(`${sat}.label_fr`, s.label_fr)
      list(`${sat}.specialities`, s.specialities, 1, MAX_CHOICES).forEach((p, pi) => {
        const pat = `${sat}.specialities[${pi}]`
        if (!isObj(p)) return err(pat, 'not an object')
        id(`${pat}.id`, p.id, 'speciality')
        label(`${pat}.label_fr`, p.label_fr)
        if (!Array.isArray(p.rooms)) return err(`${pat}.rooms`, 'must be a list (empty is allowed)')
        const seen = new Set<unknown>()
        for (const r of p.rooms) {
          if (typeof r !== 'string' || !rooms.has(r)) err(`${pat}.rooms`, `unknown room « ${String(r)} »`)
          if (seen.has(r)) err(`${pat}.rooms`, `room « ${String(r)} » listed twice`)
          seen.add(r)
        }
      })
    })
  })
  return errors.length ? { ok: false, errors } : { ok: true, tree: raw as unknown as GoalTree }
}

/**
 * The bundled tree, validated against the room index; null (warned) when it is not valid, so the start screen keeps the four profiles rather than show a broken
 * tree. `raw` and `warn` are for the tests.
 */
export function loadGoalTree(raw: unknown = treeJson, warn: (...a: unknown[]) => void = console.warn): GoalTree | null {
  const r = validateGoalTree(raw, new Set(ROOM_IDS))
  if (r.ok) return r.tree
  warn('[creation] goal tree ignored:', r.errors)
  return null
}

/** The three nodes of a stored path, or null when the tree does not hold it (each id must be found under the one before). */
export function findGoal(tree: GoalTree, c: GoalChoice): { goal: Goal; sub: GoalSub; speciality: GoalSpeciality } | null {
  const goal = tree.goals.find((g) => g.id === c.goal)
  const sub = goal?.subgoals.find((s) => s.id === c.sub)
  const speciality = sub?.specialities.find((p) => p.id === c.speciality)
  return goal && sub && speciality ? { goal, sub, speciality } : null
}

/** The rooms the place picker shows for this goal: the speciality's own (maybe none), or every room for no goal or a path the tree does not know. */
export function roomsForGoal(tree: GoalTree, goal: GoalChoice | null): string[] {
  const hit = goal ? findGoal(tree, goal) : null
  return hit ? [...hit.speciality.rooms] : [...ROOM_IDS]
}
