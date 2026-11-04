/**
 * keyboardOrbitTap — a single tap of an arrow key must turn the camera, on a slow PC too (night 2 wave 5, P2-2).
 *
 * Babylon's keyboard input only reads the keys that are DOWN at the moment a frame renders (`checkInputs`). At 15 to 20 fps (a school laptop, software GL) a tap that is
 * released before the next frame turned the camera by 0 rad (measured live: one ArrowLeft = 0 rad, held 400 ms = 1.58 rad). The rule here: every plain arrow keydown is worth
 * at least ONE step. If a frame rendered while the key was down, Babylon's own per-frame move already gave it (the hold is unchanged: same speed feel, nothing is added);
 * if the key came up before any frame, one step is added at the release. So a tap is one step, a hold is Babylon's, and nothing is counted twice. An OS key-repeat (`repeat`)
 * is ignored: the hold already moves the camera frame by frame.
 *
 * The step is the one a frame gives with Babylon's default input at the app's usual inertia: `angularSpeed / (1 - ORBIT_FEEL.inertia)` of total travel (about 3.8°). The
 * offset handed to the camera is that travel times `(1 - inertia)` of the moment, so a reduced-motion camera (no inertia: the travel is the offset) turns by the same step.
 * Plain arrows only: Ctrl (pan) and Alt (zoom) chords are left to Babylon.
 */
import { KeyboardEventTypes, type ArcRotateCamera, type ArcRotateCameraKeyboardMoveInput, type Scene } from '@babylonjs/core'
import { ORBIT_FEEL } from '../camera/orbitFeel'
import { isTextTarget } from './cameraTween'

/** The key codes of ArcRotateCameraKeyboardMoveInput (its defaults: arrows). */
export interface TapKeys {
  up: number[]
  down: number[]
  left: number[]
  right: number[]
}
export const ARROW_KEYS: TapKeys = { up: [38], down: [40], left: [37], right: [39] }

/** Total travel of one step, in radians (what one default frame adds once the inertia has played out). */
export function tapStepTravel(angularSpeed: number): number {
  return angularSpeed / (1 - ORBIT_FEEL.inertia)
}

/** The offset to hand `inertialAlphaOffset` / `inertialBetaOffset` so the camera travels one step given its inertia (Babylon's travel = offset / (1 - inertia)). */
export function tapStepOffset(angularSpeed: number, inertia: number): number {
  const i = Number.isFinite(inertia) ? Math.min(0.99, Math.max(0, inertia)) : ORBIT_FEEL.inertia
  return tapStepTravel(angularSpeed) * (1 - i)
}

/** Which axis and sign a key code moves (Babylon: left = alpha -, right = alpha +, up = beta -, down = beta +); null for any other key. */
export function tapDirection(code: number, keys: TapKeys = ARROW_KEYS): { axis: 'alpha' | 'beta'; sign: 1 | -1 } | null {
  if (keys.left.includes(code)) return { axis: 'alpha', sign: -1 }
  if (keys.right.includes(code)) return { axis: 'alpha', sign: 1 }
  if (keys.up.includes(code)) return { axis: 'beta', sign: -1 }
  if (keys.down.includes(code)) return { axis: 'beta', sign: 1 }
  return null
}

export interface KeyLike {
  keyCode: number
  repeat?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  metaKey?: boolean
}
export interface TapCamera {
  inertia: number
  inertialAlphaOffset: number
  inertialBetaOffset: number
}

/**
 * The decision, pure: feed it the key events and the frame counter; it adds the missing step to the camera at a release that no frame saw.
 * `frames()` is the number of frames rendered so far (read at the keydown and at the keyup).
 */
export class ArrowTap {
  private readonly downAt = new Map<number, number>()
  constructor(
    private readonly cam: TapCamera,
    private readonly frames: () => number,
    private readonly angularSpeed: () => number,
    private readonly keys: TapKeys = ARROW_KEYS
  ) {}

  down(e: KeyLike): void {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return
    if (!tapDirection(e.keyCode, this.keys)) return
    if (!this.downAt.has(e.keyCode)) this.downAt.set(e.keyCode, this.frames())
  }

  up(e: KeyLike): void {
    const at = this.downAt.get(e.keyCode)
    if (at === undefined) return
    this.downAt.delete(e.keyCode)
    if (this.frames() !== at) return // a frame saw the key down: Babylon already moved the camera
    const d = tapDirection(e.keyCode, this.keys)
    if (!d) return
    const offset = d.sign * tapStepOffset(this.angularSpeed(), this.cam.inertia)
    if (d.axis === 'alpha') this.cam.inertialAlphaOffset += offset
    else this.cam.inertialBetaOffset += offset
  }

  /** The canvas lost the focus (or the camera is not the active one): no key is down any more. */
  reset(): void {
    this.downAt.clear()
  }
}

/**
 * The Babylon glue (one scene, one camera): counts the rendered frames and feeds the key events of the scene to an ArrowTap. Nothing runs per frame but a counter.
 * It listens to the same keyboard events as the camera's own input, and stays out of a text field and of a dialog (where arrows are not the camera's).
 */
export function installArrowTap(scene: Scene, camera: ArcRotateCamera): void {
  let frames = 0
  const keyboard = (): ArcRotateCameraKeyboardMoveInput | undefined => camera.inputs.attached.keyboard as ArcRotateCameraKeyboardMoveInput | undefined
  const tap = new ArrowTap(camera, () => frames, () => keyboard()?.angularSpeed ?? 0.01, {
    up: keyboard()?.keysUp ?? ARROW_KEYS.up,
    down: keyboard()?.keysDown ?? ARROW_KEYS.down,
    left: keyboard()?.keysLeft ?? ARROW_KEYS.left,
    right: keyboard()?.keysRight ?? ARROW_KEYS.right,
  })
  scene.onBeforeRenderObservable.add(() => {
    frames++
  })
  scene.onKeyboardObservable.add((info) => {
    const evt = info.event
    const target = evt.target as Element | null
    if (scene.activeCamera !== camera || isTextTarget(target) || target?.closest?.('[role="dialog"], [role="alertdialog"], dialog')) return tap.reset()
    if (info.type === KeyboardEventTypes.KEYDOWN) tap.down(evt)
    else if (info.type === KeyboardEventTypes.KEYUP) tap.up(evt)
  })
  scene.getEngine().onCanvasBlurObservable.add(() => tap.reset())
}
