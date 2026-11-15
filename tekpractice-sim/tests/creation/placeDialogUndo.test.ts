// @vitest-environment jsdom
/** Mission 3 fixes, item 3: « Remplacer le matériel ? » (a model over installed gear) names « Annuler » on a coarse pointer, the key on a fine one. */
import { afterEach, describe, expect, it } from 'vitest'
import { coarsePointer } from '../../src/creation/input/coarsePointer'
import { openReplaceDialog } from '../../src/creation/shell/placeDialog'
import { undoLabelFor } from '../../src/creation/undoWording'

const win = (coarse: boolean) => ({ matchMedia: (q: string) => ({ matches: coarse && q === '(pointer: coarse)' }) }) as unknown as Window
const body = (): string => document.querySelector('[data-testid="cr-place-dialog"]')?.textContent ?? ''

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the replace dialog’s undo words', () => {
  it('a phone: « Annuler » (menu Projet) permet de revenir en arrière', () => {
    void openReplaceDialog(undoLabelFor('Ctrl+Z', coarsePointer(win(true))))
    expect(body()).toContain('« Annuler » (menu Projet) permet de revenir en arrière.')
    expect(body()).not.toContain('Ctrl')
  })
  it('a desktop: the old words, Ctrl+Z permet de revenir en arrière', () => {
    void openReplaceDialog(undoLabelFor('Ctrl+Z', coarsePointer(win(false))))
    expect(body()).toContain('Ctrl+Z permet de revenir en arrière.')
  })
})
