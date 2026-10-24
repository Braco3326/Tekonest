/**
 * designerOrbitInput — the ArcRotateCamera pointer input with the designer
 * gestures (Task 3), inspired by pro acoustic-design and 3D modelling tools:
 *   left-drag            = orbit (Babylon default)
 *   right-drag           = pan (Babylon default, panning button 2)
 *   Shift + left-drag    = pan (added here; Babylon 7 has no "shift for panning" flag)
 *   Ctrl + left-drag     = pan (Babylon's camera._useCtrlForPanning: every
 *                          attachControl() call — ours pass only `true`, the
 *                          legacy noPreventDefault flag — leaves it at its
 *                          default, true. We keep it as a second pan gesture.)
 * The pan speed is re-tuned at each pointerdown so the scene follows the cursor
 * at the current distance (orbitFeel.panningSensibilityFor): zero per-frame work.
 * Camera-only: never touches the graph. Explore view detaches this camera.
 */
import {
  ArcRotateCameraPointersInput,
  type ArcRotateCamera,
  type IPointerEvent,
  type Nullable,
  type PointerTouch,
} from '@babylonjs/core'
import { panningSensibilityFor } from '../camera/orbitFeel'

export class DesignerOrbitPointersInput extends ArcRotateCameraPointersInput {
  /** The current left-button drag started with Shift held: it pans. */
  private shiftPan = false

  override onButtonDown(evt: IPointerEvent): void {
    super.onButtonDown(evt)
    this.shiftPan = evt.button === 0 && evt.shiftKey
    const cam = this.camera
    const engine = cam.getScene().getEngine()
    const heightPx = engine.getRenderingCanvas()?.clientHeight || engine.getRenderHeight()
    this.panningSensibility = panningSensibilityFor(cam.radius, heightPx, cam.fov, cam.panningInertia)
  }

  override onTouch(point: Nullable<PointerTouch>, offsetX: number, offsetY: number): void {
    if (this.shiftPan && this.panningSensibility !== 0) {
      // Same maths as Babylon's own pan branch (right-drag), so both feel identical.
      this.camera.inertialPanningX += -offsetX / this.panningSensibility
      this.camera.inertialPanningY += offsetY / this.panningSensibility
      return
    }
    super.onTouch(point, offsetX, offsetY)
  }

  override onButtonUp(evt: IPointerEvent): void {
    super.onButtonUp(evt)
    this.shiftPan = false
  }

  override onLostFocus(): void {
    super.onLostFocus()
    this.shiftPan = false
  }
}

/** Swap the camera's stock pointer input for the designer one (keeps its sensibilities). */
export function installDesignerOrbitInput(cam: ArcRotateCamera): DesignerOrbitPointersInput {
  const next = new DesignerOrbitPointersInput()
  const old = cam.inputs.attached.pointers as ArcRotateCameraPointersInput | undefined
  if (old) {
    next.angularSensibilityX = old.angularSensibilityX
    next.angularSensibilityY = old.angularSensibilityY
    next.pinchPrecision = old.pinchPrecision
    cam.inputs.remove(old)
  }
  cam.inputs.add(next)
  return next
}
