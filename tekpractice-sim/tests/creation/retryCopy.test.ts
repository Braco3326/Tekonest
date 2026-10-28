import { describe, expect, it } from 'vitest'
import { COPY } from '../../src/creation/copy'

/**
 * Final review 7: after an aborted dynamic-import request Chromium caches the failure for the document, so a second try in
 * the same page never makes a new request. A message that tells the learner to « réessayer » then promises something that
 * cannot happen: the two messages that follow a failed chunk / sheet fetch say to reload the page.
 */
describe('failure messages that follow a failed dynamic import never promise an in-page retry', () => {
  const I = COPY.inventory!
  for (const key of ['loadFailed', 'unavailableOpen', 'unavailable']) {
    it(`inventory.${key} says « Rechargez la page » and does not say « réessayez »`, () => {
      expect(I[key], key).toMatch(/Rechargez la page/)
      expect(I[key], key).not.toMatch(/r[ée]essay/i)
    })
  }
})
