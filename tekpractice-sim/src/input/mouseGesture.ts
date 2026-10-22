/**
 * MouseGesture — the mouse-only scheme (ADR-0010 Décision 3), pure.
 * Left held + drag = look; right held + drag = move (dy forward/back, dx strafe);
 * release under the threshold = click (interact). The threshold equals Babylon's
 * InputManager.DragMovementThreshold so a gesture is never both a Babylon tap
 * (FocusPatch) and a drag here.
 */
export const DRAG_THRESHOLD_PX = 10

export interface GestureDelta {
  kind: 'none' | 'look' | 'move'
  dx: number
  dy: number
}

const NONE: GestureDelta = { kind: 'none', dx: 0, dy: 0 }

export class MouseGesture {
  private button: number | null = null
  private startX = 0
  private startY = 0
  private lastX = 0
  private lastY = 0
  private dragging = false

  /** True while a left/right drag past the threshold is in progress. */
  get isDragging(): boolean {
    return this.dragging
  }

  down(button: number, x: number, y: number): void {
    if (button !== 0 && button !== 2) {
      this.button = null
      return
    }
    this.button = button
    this.startX = this.lastX = x
    this.startY = this.lastY = y
    this.dragging = false
  }

  move(x: number, y: number): GestureDelta {
    if (this.button === null) return NONE
    if (!this.dragging) {
      if (Math.hypot(x - this.startX, y - this.startY) < DRAG_THRESHOLD_PX) return NONE
      this.dragging = true
      // The first drag delta covers the whole distance from the press point.
      this.lastX = this.startX
      this.lastY = this.startY
    }
    const d: GestureDelta = { kind: this.button === 0 ? 'look' : 'move', dx: x - this.lastX, dy: y - this.lastY }
    this.lastX = x
    this.lastY = y
    return d
  }

  up(_x: number, _y: number): 'click' | 'drag-end' | null {
    if (this.button === null) return null
    const result = this.dragging ? 'drag-end' : 'click'
    this.button = null
    this.dragging = false
    return result
  }

  cancel(): void {
    this.button = null
    this.dragging = false
  }
}
