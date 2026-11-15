/**
 * The words that name the undo (mission 3 fixes, item 3; review finding A: a phone read « Ctrl+Z dans la scène 3D »). Pure: COPY only.
 *
 * - `undoLabelFor`: on a fine pointer the key's own label (« Ctrl+Z », from the key map: AZERTY safe), untouched; on a coarse pointer the command a finger
 *   can reach, « Annuler » (menu Projet) (COPY.undoTouch.label). boot.ts `undoLabel` is the one caller; every status line, dialog and the 2D page get its result.
 * - `fillUndo`: fills `{undo}` in a COPY string. With the touch label, « {undo} pour annuler » becomes « {undo} pour revenir en arrière » first
 *   (COPY.undoTouch.cancelFrom / cancelTo), so a phone never reads « « Annuler » pour annuler ». With any other label the result is the old fill, byte for byte.
 * The « Raccourcis clavier » list and the menus' shortcut column keep the key names on every pointer (they name keys, not the command).
 */
import { COPY } from './copy'

const U = (): Readonly<Record<string, string>> => COPY.undoTouch!

export function undoLabelFor(keyLabel: string, coarse: boolean): string {
  return coarse ? U().label! : keyLabel
}

export function fillUndo(template: string, label: string): string {
  const t = label === U().label ? template.split(U().cancelFrom!).join(U().cancelTo!) : template
  return t.split('{undo}').join(label)
}
