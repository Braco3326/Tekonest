/**
 * Input actions (ADR-0010 Décision 2) — the seam between devices and gameplay.
 * Keyboard, mouse (and later touch / gamepad) only ever produce these actions;
 * movement and UI react to actions, never to raw keys.
 */
export const ACTIONS = [
  'MOVE_FORWARD',
  'MOVE_BACK',
  'STRAFE_LEFT',
  'STRAFE_RIGHT',
  'MOVE_DOWN',
  'MOVE_UP',
  'RUN',
  'TURN_LEFT',
  'TURN_RIGHT',
  'LOOK_UP',
  'LOOK_DOWN',
  'TOGGLE_INVENTORY',
  'TOGGLE_HELP',
  'TOGGLE_VIEW',
  'FOCUS',
  'PICK_UP',
  'ROTATE_PLACEMENT',
  /** Back to the Ensemble pose (designer nav, Task 4). Default Alt+H: plain H stays help. */
  'CAMERA_HOME',
  /** Recall camera view 1 / 2 / 3 (designer nav, Task 5). Saving is right-click or long-press on the slot. */
  'CAMERA_PRESET_1',
  'CAMERA_PRESET_2',
  'CAMERA_PRESET_3',
  /** View cube named views (designer nav, Task 8). Ctrl chords give the opposite side. */
  'VIEW_FACE',
  'VIEW_ARRIERE',
  'VIEW_DROITE',
  'VIEW_GAUCHE',
  'VIEW_DESSUS',
  /** View cube 90° turns around the current pivot. */
  'VIEW_ROT_LEFT',
  'VIEW_ROT_RIGHT',
  'CANCEL',
] as const

export type Action = (typeof ACTIONS)[number]

/** Actions that move the player — their use flips the "keyboard player" flag (pointer lock auto). */
export const MOVEMENT_ACTIONS: readonly Action[] = [
  'MOVE_FORWARD',
  'MOVE_BACK',
  'STRAFE_LEFT',
  'STRAFE_RIGHT',
  'MOVE_DOWN',
  'MOVE_UP',
]

export const isAction = (v: unknown): v is Action => (ACTIONS as readonly unknown[]).includes(v)
