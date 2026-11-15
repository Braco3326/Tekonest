/**
 * The goal screens as data (mission 1, spec 1.2): screen 1 lists the five goals (keys 1 to 5), screen 2 the children of the chosen goal, screen 3 the children of
 * the chosen level-2 node when it has any (otherwise that node is the end of the way). A pick leads to the next screen or is the answer, with the profile its goal
 * maps to. « Retour » goes one screen up (screen 1 has nowhere to go back to); « Passer » is the start screen's (no goal). Pure: no DOM; startScreen.ts renders it.
 * The labels come from the tree (goalTree.ts), never from here.
 */
import { goalPath, profileForGoal, type GoalChoice, type GoalNode, type GoalTree } from './goalTree'
import type { ProfileId } from './state'

/** A screen lists the children of `parent` (null = the five goals, screen 1). */
export interface GoalScreen {
  parent: string | null
}

export const GOAL_SCREEN_FIRST: GoalScreen = Object.freeze({ parent: null })

export interface GoalOption {
  id: string
  /** The digit that picks it: '1'..'9', then '0' for the tenth. */
  key: string
  label: string
}

export type GoalMove =
  | { kind: 'screen'; screen: GoalScreen }
  | { kind: 'chosen'; choice: GoalChoice; profile: ProfileId | null; label: string }
  | { kind: 'none' }

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

function childrenOf(tree: GoalTree, s: GoalScreen): readonly GoalNode[] {
  if (s.parent === null) return tree.goals
  return goalPath(tree, s.parent)?.at(-1)?.children ?? []
}

/** What `s` lists, in the order of the data; nothing for a parent the tree does not hold. */
export function goalOptions(tree: GoalTree, s: GoalScreen): GoalOption[] {
  return childrenOf(tree, s)
    .slice(0, KEYS.length)
    .map((n, i) => ({ id: n.id, key: KEYS[i]!, label: n.label }))
}

/** The screen's number (1, 2 or 3): its heading follows it. */
export function goalScreenNumber(s: GoalScreen): 1 | 2 | 3 {
  return s.parent === null ? 1 : s.parent.includes('.') ? 3 : 2
}

/** The option bound to a pressed digit on `s`, or undefined. */
export function goalOptionByKey(tree: GoalTree, s: GoalScreen, key: string): GoalOption | undefined {
  return goalOptions(tree, s).find((o) => o.key === key)
}

/** Where picking `id` on `s` leads: the next screen (a node with children, above level 3), the answer (any other node), or nowhere (an id `s` does not list). */
export function goalPick(tree: GoalTree, s: GoalScreen, id: string): GoalMove {
  const n = childrenOf(tree, s).find((x) => x.id === id)
  if (!n) return { kind: 'none' }
  if (n.children.length > 0 && n.level < 3) return { kind: 'screen', screen: { parent: n.id } }
  return { kind: 'chosen', choice: { id: n.id }, profile: profileForGoal(n.id), label: n.label }
}

/** « Retour »: the screen above and the option chosen there (it takes the focus back), or null on screen 1. */
export function goalBack(s: GoalScreen): { screen: GoalScreen; focus: string } | null {
  if (s.parent === null) return null
  const dot = s.parent.lastIndexOf('.')
  return { screen: { parent: dot < 0 ? null : s.parent.slice(0, dot) }, focus: s.parent }
}

/** What was chosen before `s` (« Goal › Level 2 »), for the line above screens 2 and 3; '' on screen 1. */
export function goalPathLabel(tree: GoalTree, s: GoalScreen): string {
  if (s.parent === null) return ''
  return (goalPath(tree, s.parent) ?? []).map((n) => n.label).join(' › ')
}
