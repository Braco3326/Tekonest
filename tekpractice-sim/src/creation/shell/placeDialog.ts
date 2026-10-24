/**
 * « Changer de lieu » dialog (C3): shown when the rig has gear, and the
 * generic choice dialog every Mode Création confirm uses. The modal contract
 * (inert page, sentinels, Esc = cancel, focus returned) lives in `modal.ts`.
 */
import { COPY } from '../copy'
import { modalButton, modalRow, openModal } from './modal'

export type PlaceChoice = 'keep' | 'empty' | 'cancel'

/** « Changer de lieu »: Garder le matériel / Repartir à vide / Annuler. */
export function openPlaceDialog(parent: HTMLElement = document.body): Promise<PlaceChoice> {
  const P = COPY.place!
  return openChoiceDialog<PlaceChoice>({
    title: P.dialogTitle!,
    body: P.dialogBody!,
    choices: [
      { id: 'keep', label: P.keep! },
      { id: 'empty', label: P.empty! },
      { id: 'cancel', label: P.cancel! },
    ],
    cancel: 'cancel',
    parent,
  })
}

/** A model over installed gear (review fix 1): Remplacer le matériel / Annuler. `undo` = the undo key's label. */
export function openReplaceDialog(undo: string, parent: HTMLElement = document.body): Promise<'replace' | 'cancel'> {
  const P = COPY.place!
  return openChoiceDialog<'replace' | 'cancel'>({
    title: P.replaceTitle!,
    body: P.replaceBody!.replace('{undo}', undo),
    choices: [
      { id: 'replace', label: P.replace! },
      { id: 'cancel', label: P.cancel! },
    ],
    cancel: 'cancel',
    parent,
  })
}

/** The first choice is the primary button (focused); Esc = `cancel`. */
export function openChoiceDialog<T extends string>(o: { title: string; body: string; choices: { id: T; label: string }[]; cancel: T; parent?: HTMLElement }): Promise<T> {
  return openModal<T>({
    id: 'cr-place-dialog',
    title: o.title,
    body: o.body,
    cancel: o.cancel,
    parent: o.parent,
    build(box, done) {
      const buttons = o.choices.map(({ id, label }, i) => {
        const b = modalButton(label, i === 0)
        b.addEventListener('click', () => done(id))
        return b
      })
      box.appendChild(modalRow(...buttons))
      return { first: buttons[0], edges: () => [buttons[0], buttons[buttons.length - 1]] }
    },
  })
}
