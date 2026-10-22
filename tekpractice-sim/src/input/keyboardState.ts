/**
 * KeyboardState — which actions are held, plus one-shot "pressed" edges.
 * Pure (no DOM): the Babylon/DOM adapter feeds it keydown/keyup codes and
 * calls reset() on window blur so alt-tab never leaves the player walking.
 */
import { MOVEMENT_ACTIONS, type Action } from './actions'
import { actionsForCode, type Bindings } from './bindings'

export class KeyboardState {
  private down = new Set<string>()
  private pressed: Action[] = []
  /** True once any movement key was used this session (pointer-lock "auto"). */
  anyMovementUsed = false

  constructor(private bindings: Bindings) {}

  setBindings(b: Bindings): void {
    this.bindings = b
    this.reset()
  }

  keyDown(code: string): void {
    if (this.down.has(code)) return // auto-repeat: no new edge
    this.down.add(code)
    for (const a of actionsForCode(this.bindings, code)) {
      this.pressed.push(a)
      if (MOVEMENT_ACTIONS.includes(a)) this.anyMovementUsed = true
    }
  }

  keyUp(code: string): void {
    this.down.delete(code)
  }

  held(action: Action): boolean {
    return this.bindings[action].some((c) => this.down.has(c))
  }

  /** Actions pressed since the last call (each physical press once). */
  consumePressed(): Action[] {
    const out = this.pressed
    this.pressed = []
    return out
  }

  reset(): void {
    this.down.clear()
    this.pressed = []
  }
}
