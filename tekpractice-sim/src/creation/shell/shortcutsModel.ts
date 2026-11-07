/**
 * « Raccourcis clavier » (night 2 wave 5, P2-1): the list the Aide menu and the H key open. Pure: it reads the LIVE key map (`bindingLabel`), so a rebound action shows its
 * new key, and an action that has no key is left out. The labels are the ones the menus already use (by position, AZERTY safe: « Ctrl+Z » follows the printed Z). Two keys are
 * not in the map and are said by name: the arrows (Babylon's camera input) and Entrée (frames the selection from the 3D view, never rebindable).
 */
import { COPY } from '../copy'
import { bindingLabel, type CreationAction, type CreationBindings } from '../input/creationActions'

export interface ShortcutRow {
  id: string
  /** What the keys do. */
  name: string
  /** One label per key, in the order shown. Never empty. */
  keys: string[]
}
export interface ShortcutGroup {
  id: 'view' | 'devices' | 'project'
  title: string
  rows: ShortcutRow[]
}

const S = (): Readonly<Record<string, string>> => COPY.shortcuts!

/** A key that is not in the key map. */
type Fixed = { fixed: 'arrows' | 'enter' }
type Source = CreationAction | Fixed

interface RowSpec {
  id: string
  name: string
  from: Source[]
}
const groupSpecs = (): { id: ShortcutGroup['id']; title: string; rows: RowSpec[] }[] => [
  {
    id: 'view',
    title: S().groupView!,
    rows: [
      { id: 'orbit', name: S().orbit!, from: [{ fixed: 'arrows' }] },
      { id: 'quarter-left', name: S().quarterLeft!, from: ['VIEW_ROT_LEFT'] },
      { id: 'quarter-right', name: S().quarterRight!, from: ['VIEW_ROT_RIGHT'] },
      { id: 'points', name: S().points!, from: ['CAMERA_PRESET_1', 'CAMERA_PRESET_2', 'CAMERA_PRESET_3'] },
      { id: 'frame', name: S().frame!, from: ['FRAME_SELECTION', { fixed: 'enter' }] },
      { id: 'home', name: S().home!, from: ['CAMERA_HOME'] },
      { id: 'picker', name: S().picker!, from: ['VIEW_PICKER'] },
      { id: 'walk', name: S().walk!, from: ['WALK_TOGGLE'] },
    ],
  },
  {
    id: 'devices',
    title: S().groupDevices!,
    rows: [
      { id: 'next', name: S().next!, from: ['NEXT_DEVICE'] },
      { id: 'prev', name: S().prev!, from: ['PREV_DEVICE'] },
      { id: 'inventory', name: S().inventory!, from: ['TOGGLE_INVENTORY'] },
      { id: 'rotate-cw', name: S().rotateCw!, from: ['ROTATE_CW'] },
      { id: 'rotate-ccw', name: S().rotateCcw!, from: ['ROTATE_CCW'] },
      { id: 'snap', name: S().snap!, from: ['SNAP_TOGGLE'] },
      { id: 'duplicate', name: S().duplicate!, from: ['DUPLICATE'] },
      { id: 'delete', name: S().delete!, from: ['DELETE'] },
      { id: 'cancel', name: S().cancel!, from: ['CANCEL'] },
    ],
  },
  {
    id: 'project',
    title: S().groupProject!,
    rows: [
      { id: 'undo', name: S().undo!, from: ['UNDO'] },
      { id: 'redo', name: S().redo!, from: ['REDO'] },
      { id: 'save', name: S().save!, from: ['SAVE'] },
      { id: 'help', name: S().help!, from: ['TOGGLE_HELP'] },
    ],
  },
]

export function shortcutGroups(b: CreationBindings): ShortcutGroup[] {
  const label = (s: Source): string => {
    if (typeof s === 'string') return bindingLabel(b, s)
    return s.fixed === 'arrows' ? S().keyArrows! : COPY.keys!.enter!
  }
  return groupSpecs()
    .map((g) => ({
      id: g.id,
      title: g.title,
      rows: g.rows.map((r) => ({ id: r.id, name: r.name, keys: r.from.map(label).filter((k) => k !== '') })).filter((r) => r.keys.length > 0),
    }))
    .filter((g) => g.rows.length > 0)
}
