/**
 * Phase 4 final wave: the status line is ONE polite live region where the last write wins. The shell's own announcements, the listen controller's and
 * the coverage controller's all happen in the same store change; this announcer writes the FIRST message of a tick at once (the order against the other
 * writers of the line is unchanged) and, when more distinct messages arrive in the same tick, writes them all joined at the end of it, so a later writer
 * cannot silence an earlier one (WCAG 4.1.3).
 */
import { describe, expect, it } from 'vitest'
import { createAnnouncer } from '../../src/creation/shell/announcer'

function make() {
  const said: { message: string; reannounce: boolean }[] = []
  const queue: (() => void)[] = []
  const a = createAnnouncer((message, reannounce) => void said.push({ message, reannounce }), (fn) => void queue.push(fn))
  /** The end of the tick: run what was scheduled. */
  const tick = (): void => {
    for (const fn of queue.splice(0)) fn()
  }
  return { a, said, tick, queue }
}

describe('createAnnouncer', () => {
  it('writes the first message of a tick AT ONCE, and a lone message is not written again at the end of the tick', () => {
    const m = make()
    m.a.say('Lecture arrêtée. La console n’est pas alimentée.')
    expect(m.said).toEqual([{ message: 'Lecture arrêtée. La console n’est pas alimentée.', reannounce: true }])
    m.tick()
    expect(m.said).toHaveLength(1)
  })
  it('joins the distinct messages of one tick, in the order they were written, as sentences, in a final write at the end of the tick', () => {
    const m = make()
    m.a.say('Lecture arrêtée. La console n’est pas alimentée.')
    m.a.say('Aucune enceinte audible : la console est hors tension')
    m.a.say('Signal : 1 erreur')
    expect(m.said.map((s) => s.message)).toEqual(['Lecture arrêtée. La console n’est pas alimentée.']) // only the first so far
    m.tick()
    expect(m.said).toHaveLength(2)
    expect(m.said[1].message).toBe('Lecture arrêtée. La console n’est pas alimentée. Aucune enceinte audible : la console est hors tension. Signal : 1 erreur.')
  })
  it('drops an exact duplicate and an empty message', () => {
    const m = make()
    m.a.say('Couverture masquée.')
    m.a.say('Couverture masquée.')
    m.a.say('')
    m.a.say('   ')
    m.tick()
    expect(m.said.map((s) => s.message)).toEqual(['Couverture masquée.'])
  })
  it('one schedule per tick, and the next tick starts again from nothing', () => {
    const m = make()
    m.a.say('A.')
    m.a.say('B.')
    expect(m.queue).toHaveLength(1)
    m.tick()
    m.a.say('C.')
    m.tick()
    expect(m.said.map((s) => s.message)).toEqual(['A.', 'A. B.', 'C.'])
  })
  it('the final write re-announces when ANY message of the tick asks for it (an answer to the learner), not when none does', () => {
    const m = make()
    m.a.say('Signal : 1 erreur', false)
    m.a.say('Lecture arrêtée.', false)
    m.tick()
    expect(m.said.map((s) => s.reannounce)).toEqual([false, false])
    m.a.say('Signal : 1 erreur', false)
    m.a.say('Lecture arrêtée.', true)
    m.tick()
    expect(m.said.at(-1)!.reannounce).toBe(true)
    expect(m.said.at(-2)!.reannounce).toBe(false) // the first write keeps its own flag
  })
  it('dispose() drops what is pending and ignores what comes after', () => {
    const m = make()
    m.a.say('Un.')
    m.a.say('Deux.')
    m.a.dispose()
    m.tick()
    expect(m.said.map((s) => s.message)).toEqual(['Un.'])
    m.a.say('Après.')
    m.tick()
    expect(m.said).toHaveLength(1)
  })
  it('a message that already ends with ! ? or … is not given a second full stop in a merge', () => {
    const m = make()
    m.a.say('Attention !')
    m.a.say('Suite')
    m.tick()
    expect(m.said.at(-1)!.message).toBe('Attention ! Suite.')
  })
  it('a direct writer between two announcer messages of one tick is overwritten by the merge, never the other way round for a lone message', () => {
    const line: string[] = []
    const queue: (() => void)[] = []
    const a = createAnnouncer((m) => void line.push(m), (fn) => void queue.push(fn))
    a.say('Signal : 1 erreur', false)
    line.push('Posé : Yamaha QL1') // the placement controller writes directly, after the store change
    for (const fn of queue.splice(0)) fn()
    expect(line.at(-1)).toBe('Posé : Yamaha QL1') // a lone announcement does not come back over it
  })
})
