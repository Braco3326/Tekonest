/**
 * The goal tree (mission 1, spec 3): five level-1 goals, their level-2 children, and level-3 children under some of those. Data only: the tree is
 * content/onboarding/goal-tree.json, a TRIMMED copy of marketing's research file (DRAFT, labels may still change, ids are stable) made by
 * tools/trim-goal-tree.mjs. It is bundled (imported as JSON), so a bad file fails the unit tests (tests/creation/goalTree.test.ts), not the learner. The labels
 * live in the JSON only, never in code: a relabel is a file swap. Pure: no DOM, no storage.
 *
 * A node id is dotted: a child's id is its parent's id, a dot, and one more word (`etudie.ecoles-nationales.femis-son`), so a stored id names its ancestors too.
 * `roomsForGoal` is what the place picker shows for a stored goal: the chosen node's rooms, else its parent's, else none (the empty state); every room for no goal
 * or an id the tree does not know (a record written against an older tree is never a reason to hide places).
 */
import treeJson from '../../../content/onboarding/goal-tree.json'
import roomIndexJson from '../../../content/rooms/index.json'
import type { ProfileId } from './state'

export interface GoalNode {
  /** Dotted and stable: a child's id starts with its parent's id and a dot. */
  id: string
  /** The only text shown to the learner. */
  label: string
  /** 1 (a goal, screen 1), 2 (screen 2) or 3 (screen 3). */
  level: 1 | 2 | 3
  /** Room ids of content/rooms/index.json; `[]` is legal (then the parent's rooms, then the empty state). */
  rooms: string[]
  children: GoalNode[]
  /** Only on `etudie`: the accounts form asks for a school (content/onboarding/schools.json). */
  school_field?: true
}

export interface GoalTree {
  /** The research file's `meta.version` (a draft is « 0.1-draft »). */
  version: string
  /** The research file's `meta.status`. */
  status: string
  goals: GoalNode[]
}

/** A stored goal (the onboarding record's `goal`): the deepest chosen node; its ancestors are the prefixes of the dotted id. */
export interface GoalChoice {
  id: string
}

/** Every room id of content/rooms/index.json, in its order. */
export const ROOM_IDS: readonly string[] = Object.freeze((roomIndexJson as { rooms: { id: string }[] }).rooms.map((r) => r.id))

/** The level-1 goal ids and the profile each maps to (the record keeps it for the panels and the drawer tab of profiles.ts). Ids are stable; labels are data. */
export const GOAL_PROFILES: Readonly<Record<string, ProfileId>> = Object.freeze({
  etudie: 'etudie',
  travaille: 'metier',
  reconversion: 'projet',
  passion: 'projet',
  decouvre: 'decouvre',
})

/** Screen 1 has five goals (keys 1 to 5). */
export const GOAL_COUNT = 5
/** A screen answers to the digit keys 1 to 9 and 0 (the tenth). */
export const MAX_CHOICES = 10
const WORD = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

export type GoalTreeCheck = { ok: true; tree: GoalTree } | { ok: false; errors: string[] }

/**
 * Checks `raw` against the trimmed schema; `rooms` = the room ids that exist. Every problem is listed (a path and what is wrong), none is repaired: exactly the five
 * level-1 goals of `GOAL_PROFILES`, each with children and an « autre » child (`<goal>.autre`); levels follow the depth (3 at most); ids dotted from the parent's,
 * unique; labels non-empty; every room id in content/rooms/index.json, none twice in a node; at most ten children per node.
 */
export function validateGoalTree(raw: unknown, rooms: ReadonlySet<string>): GoalTreeCheck {
  const errors: string[] = []
  const err = (at: string, what: string): void => void errors.push(`${at}: ${what}`)
  if (!isObj(raw)) return { ok: false, errors: ['tree: not an object'] }
  if (!text(raw.version)) err('version', 'must be a non-empty text')
  if (!text(raw.status)) err('status', 'must be a non-empty text')
  const seen = new Set<string>()
  const walk = (n: unknown, at: string, parent: string | null, level: number): void => {
    if (!isObj(n)) return err(at, 'not an object')
    const id = n.id
    if (typeof id !== 'string') return err(`${at}.id`, 'must be a text')
    const last = parent === null ? id : id.slice(parent.length + 1)
    if ((parent !== null && !id.startsWith(`${parent}.`)) || !WORD.test(last)) err(`${at}.id`, `« ${id} » must be ${parent === null ? 'one word' : `« ${parent}. » and one word`}`)
    if (seen.has(id)) err(`${at}.id`, `duplicate id « ${id} »`)
    seen.add(id)
    if (!text(n.label)) err(`${at}.label`, 'must be a non-empty French text')
    if (n.level !== level) err(`${at}.level`, `must be ${level}`)
    if (n.school_field !== undefined && n.school_field !== true) err(`${at}.school_field`, 'must be true or absent')
    if (!Array.isArray(n.rooms)) err(`${at}.rooms`, 'must be a list (empty is allowed)')
    else {
      const once = new Set<unknown>()
      for (const r of n.rooms) {
        if (typeof r !== 'string' || !rooms.has(r)) err(`${at}.rooms`, `unknown room « ${String(r)} » (not in content/rooms/index.json)`)
        if (once.has(r)) err(`${at}.rooms`, `room « ${String(r)} » listed twice`)
        once.add(r)
      }
    }
    if (!Array.isArray(n.children)) return err(`${at}.children`, 'must be a list')
    if (n.children.length > MAX_CHOICES) err(`${at}.children`, `at most ${MAX_CHOICES} (keys 1 to 9 and 0)`)
    if (level === 1 && n.children.length === 0) err(`${at}.children`, 'a goal needs children (screen 2)')
    if (level === 3 && n.children.length > 0) err(`${at}.children`, 'a level-3 node has no children (three screens at most)')
    if (level === 1 && !n.children.some((c) => isObj(c) && c.id === `${id}.autre`)) err(`${at}.children`, `needs the « autre » child « ${id}.autre »`)
    n.children.forEach((c, i) => walk(c, `${at}.children[${i}]`, id, level + 1))
  }
  if (!Array.isArray(raw.goals)) err('goals', 'must be a list')
  else {
    if (raw.goals.length !== GOAL_COUNT) err('goals', `must hold exactly ${GOAL_COUNT}`)
    const top = raw.goals.map((g) => (isObj(g) ? g.id : undefined))
    for (const id of Object.keys(GOAL_PROFILES)) if (!top.includes(id)) err('goals', `misses the goal « ${id} »`)
    for (const id of top) if (typeof id === 'string' && !(id in GOAL_PROFILES)) err('goals', `« ${id} » is not a known goal (no profile maps to it)`)
    raw.goals.forEach((g, i) => walk(g, `goals[${i}]`, null, 1))
  }
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

/** The nodes from the goal down to `id` (each found under the one before), or null when the tree does not hold it. */
export function goalPath(tree: GoalTree, id: string): GoalNode[] | null {
  const parts = id.split('.')
  const out: GoalNode[] = []
  let level: readonly GoalNode[] = tree.goals
  for (let i = 0; i < parts.length; i++) {
    const want = parts.slice(0, i + 1).join('.')
    const n = level.find((x) => x.id === want)
    if (!n) return null
    out.push(n)
    level = n.children
  }
  return out
}

/** The node of a stored id, or null. */
export function findGoal(tree: GoalTree, id: string): GoalNode | null {
  return goalPath(tree, id)?.at(-1) ?? null
}

/** The profile a goal id maps to (by its level-1 id), or null for an id whose goal is not known. */
export function profileForGoal(id: string): ProfileId | null {
  return GOAL_PROFILES[id.split('.')[0]!] ?? null
}

/** The rooms the place picker shows for this goal: the node's own, else its parent's, else none (the empty state); every room for no goal or an unknown id. */
export function roomsForGoal(tree: GoalTree, goal: GoalChoice | null): string[] {
  const path = goal ? goalPath(tree, goal.id) : null
  if (!path) return [...ROOM_IDS]
  const node = path.at(-1)!
  const parent = path.at(-2)
  return [...(node.rooms.length ? node.rooms : (parent?.rooms ?? []))]
}
