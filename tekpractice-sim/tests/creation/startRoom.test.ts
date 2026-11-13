/**
 * T6.3: which room the start screen (and Aide « Premiers pas ») opens, from the package's `layout.start` FIELD (never its number). Pure: no DOM, no Babylon.
 * `neutral-room` opens « Salle vide » (the `blank` card); `playable-model` opens the template `premier-son-pret` through the picker's own template path
 * (key `template:premier-son-pret`), and falls back to the neutral room when that template is not among the cards (a template is data: a missing one must not
 * leave the learner without a room).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLAYABLE_MODEL_TEMPLATE, startRoomKey } from '../../src/creation/onboarding/startRoom'
import { DESIGN_IDS, packageById } from '../../src/design/packages'

const withModel = (key: string): boolean => key === 'blank' || key === `template:${PLAYABLE_MODEL_TEMPLATE}`

describe('startRoomKey (the start data field decides, never a package number)', () => {
  it('triggers: playable-model opens the template premier-son-pret', () => {
    expect(startRoomKey('playable-model', withModel)).toBe('template:premier-son-pret')
  })
  it('does not trigger: neutral-room opens the blank card, even when the template exists', () => {
    expect(startRoomKey('neutral-room', withModel)).toBe('blank')
  })
  it('a playable model whose template is not among the cards falls back to the neutral room', () => {
    expect(startRoomKey('playable-model', (k) => k === 'blank')).toBe('blank')
  })
  it('by package data: only the package whose layout.start is playable-model gets the template', () => {
    const keys = DESIGN_IDS.map((id) => startRoomKey(packageById(id).layout.start, withModel))
    expect(keys).toEqual(['blank', 'blank', 'blank', 'blank', 'template:premier-son-pret'])
  })
  it('the template id names a template file that exists (content/templates)', () => {
    const file = join(__dirname, '..', '..', 'content', 'templates', `${PLAYABLE_MODEL_TEMPLATE}.json`)
    expect(JSON.parse(readFileSync(file, 'utf8')).id).toBe(PLAYABLE_MODEL_TEMPLATE)
  })
})
