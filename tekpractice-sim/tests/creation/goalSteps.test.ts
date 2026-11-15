/**
 * The goal screens as data (mission 1, spec 1.2): what each screen lists (keys 1 to 9, then 0), where a pick leads (screen 3 only under a level-2 node that has
 * children), « Retour », and the profile of the answer. Pure (no DOM): the screens themselves are proven in tests/e2e/onboarding-goals.spec.ts.
 */
import { describe, expect, it } from 'vitest'
import { loadGoalTree, type GoalNode } from '../../src/creation/onboarding/goalTree'
import { GOAL_SCREEN_FIRST, goalBack, goalOptionByKey, goalOptions, goalPathLabel, goalPick, goalScreenNumber, type GoalScreen } from '../../src/creation/onboarding/goalSteps'
import { SMALL } from './goalTreeFixture'

const tree = loadGoalTree()!
const all = (ns: readonly GoalNode[]): GoalNode[] => ns.flatMap((n) => [n, ...all(n.children)])

describe('goalOptions: what a screen lists', () => {
  it('screen 1: the five goals, keys 1 to 5, their labels from the data', () => {
    const o = goalOptions(tree, GOAL_SCREEN_FIRST)
    expect(o.map((x) => x.key)).toEqual(['1', '2', '3', '4', '5'])
    expect(o.map((x) => x.id)).toEqual(tree.goals.map((g) => g.id))
    expect(o.map((x) => x.label)).toEqual(tree.goals.map((g) => g.label))
    expect(goalScreenNumber(GOAL_SCREEN_FIRST)).toBe(1)
  })

  it('screen 2 lists the children of the goal; a tenth child answers to 0', () => {
    const big = tree.goals.find((g) => g.children.length === 10)
    const g = big ?? tree.goals[0]!
    const o = goalOptions(tree, { parent: g.id })
    expect(o.map((x) => x.id)).toEqual(g.children.map((c) => c.id))
    if (big) expect(o.at(-1)!.key).toBe('0')
    expect(goalScreenNumber({ parent: g.id })).toBe(2)
    expect(goalScreenNumber({ parent: 'travaille.live' })).toBe(3)
  })

  it('a parent the tree does not hold lists nothing', () => {
    expect(goalOptions(tree, { parent: 'gone' })).toEqual([])
    expect(goalOptions(tree, { parent: 'travaille.gone' })).toEqual([])
  })

  it('goalOptionByKey: the digit of an option, undefined for any other key', () => {
    expect(goalOptionByKey(SMALL, GOAL_SCREEN_FIRST, '5')?.id).toBe('decouvre')
    expect(goalOptionByKey(SMALL, GOAL_SCREEN_FIRST, '6')).toBeUndefined()
    expect(goalOptionByKey(SMALL, { parent: 'travaille' }, '1')?.id).toBe('travaille.live')
    expect(goalOptionByKey(SMALL, { parent: 'travaille' }, '3')).toBeUndefined()
  })
})

describe('goalPick and goalBack: the way through the screens', () => {
  it('a goal leads to screen 2; a level-2 node with children to screen 3; a level-3 node is the answer, with the profile of its goal', () => {
    expect(goalPick(SMALL, GOAL_SCREEN_FIRST, 'travaille')).toEqual({ kind: 'screen', screen: { parent: 'travaille' } })
    expect(goalPick(SMALL, { parent: 'travaille' }, 'travaille.live')).toEqual({ kind: 'screen', screen: { parent: 'travaille.live' } })
    expect(goalPick(SMALL, { parent: 'travaille.live' }, 'travaille.live.club')).toEqual({ kind: 'chosen', choice: { id: 'travaille.live.club' }, profile: 'metier', label: 'travaille.live.club' })
  })

  it('a level-2 node with no children is the end of the way (screen 3 is skipped)', () => {
    expect(goalPick(SMALL, { parent: 'etudie' }, 'etudie.a')).toEqual({ kind: 'chosen', choice: { id: 'etudie.a' }, profile: 'etudie', label: 'etudie.a' })
  })

  it('an id the screen does not list does nothing', () => {
    expect(goalPick(SMALL, GOAL_SCREEN_FIRST, 'gone')).toEqual({ kind: 'none' })
    expect(goalPick(SMALL, { parent: 'travaille' }, 'etudie.a')).toEqual({ kind: 'none' })
  })

  it('« Retour » goes one screen up and remembers what was chosen there; on screen 1 there is nowhere to go back to', () => {
    expect(goalBack({ parent: 'travaille.live' })).toEqual({ screen: { parent: 'travaille' }, focus: 'travaille.live' })
    expect(goalBack({ parent: 'travaille' })).toEqual({ screen: GOAL_SCREEN_FIRST, focus: 'travaille' })
    expect(goalBack(GOAL_SCREEN_FIRST)).toBeNull()
  })

  it('goalPathLabel: the labels chosen so far, for the line above screens 2 and 3', () => {
    expect(goalPathLabel(SMALL, GOAL_SCREEN_FIRST)).toBe('')
    expect(goalPathLabel(SMALL, { parent: 'travaille' })).toBe('Travailler')
    expect(goalPathLabel(SMALL, { parent: 'travaille.live' })).toBe('Travailler › travaille.live')
  })

  it('every node of the real tree below level 1 is reachable, and every end of the way is an answer', () => {
    for (const n of all(tree.goals).filter((x) => x.level > 1)) {
      const parts = n.id.split('.')
      let at: GoalScreen = GOAL_SCREEN_FIRST
      for (let i = 1; i < parts.length; i++) {
        const m = goalPick(tree, at, parts.slice(0, i).join('.'))
        expect(m.kind, n.id).toBe('screen')
        if (m.kind === 'screen') at = m.screen
      }
      expect(goalPick(tree, at, n.id).kind, n.id).toBe(n.children.length > 0 ? 'screen' : 'chosen')
    }
  })
})
