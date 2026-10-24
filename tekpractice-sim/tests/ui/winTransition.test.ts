import { describe, expect, it } from 'vitest'
import { winTransition } from '../../src/ui/winTransition'

describe('winTransition', () => {
  it('a learner action earns the win once, and retracts it when the chain breaks', () => {
    expect(winTransition('normal', true, false, false)).toEqual({ won: true, earn: true, retract: false })
    expect(winTransition('normal', true, true, false)).toEqual({ won: true, earn: false, retract: false })
    expect(winTransition('normal', false, true, false)).toEqual({ won: false, earn: false, retract: true })
  })

  it('an Essais restore never records a win: the flag just follows the state', () => {
    expect(winTransition('restore', true, false, false)).toEqual({ won: true, earn: false, retract: false })
    // …so the next learner action does not "earn" a win the restore produced
    expect(winTransition('normal', true, true, false).earn).toBe(false)
    expect(winTransition('restore', false, true, false)).toEqual({ won: false, earn: false, retract: true })
  })

  it('a compare preview and the sandbox never touch it', () => {
    expect(winTransition('preview', true, false, false)).toEqual({ won: false, earn: false, retract: false })
    expect(winTransition('normal', true, false, true)).toEqual({ won: false, earn: false, retract: false })
  })
})
