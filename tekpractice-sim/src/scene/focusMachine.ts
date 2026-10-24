/**
 * focusMachine — the PURE "Focus & Patch" state machine (spec §1-2, ADR-0008).
 * Two camera modes (Ensemble ⇄ Focus), a keyboard/selection cursor, and the
 * held-cable state. Zero Babylon, zero engine imports beyond the PortRef TYPE:
 * this file decides WHAT happens; CameraRig/FocusPatch execute HOW.
 *
 * The machine never validates connections and never mutates any graph — on a
 * second port click it only emits a `connect` command; the orchestrator's
 * intent dispatcher owns the outcome (CLAUDE.md unidirectional flow).
 */
import type { PortRef } from '../engine/types'

export type CameraMode = 'ensemble' | 'focus'

export interface FocusState {
  mode: CameraMode
  /** Instance the camera is framing (focus mode only). */
  focused: string | null
  /** Keyboard/selection cursor (single click or Tab). */
  selected: string | null
  /** The cable end currently "in hand" — survives mode changes (spec §1 step 4). */
  held: PortRef | null
}

export const initialState = (): FocusState => ({
  mode: 'ensemble',
  focused: null,
  selected: null,
  held: null,
})

export type FocusEvent =
  | { type: 'DEVICE_DOUBLE_CLICK'; instanceId: string }
  // Single click on a device. N1 (night brief 2026-10-24, ADR-0008 addendum)
  // overrides spec §1 "single click = select": it now focuses, like a double-click.
  | { type: 'DEVICE_CLICK'; instanceId: string }
  | { type: 'PORT_CLICK'; ref: PortRef }
  | { type: 'EMPTY_CLICK' }
  | { type: 'RIGHT_CLICK' }
  | { type: 'ESC' }
  | { type: 'TAB'; instanceIds: readonly string[] }
  | { type: 'ENTER' }
  /** Double-click on the floor / any non-device surface: orbit around that point. */
  | { type: 'FLOOR_DOUBLE_CLICK'; point: readonly [number, number, number] }
  /** Alt+H or the « Vue d'ensemble » button: back to the Ensemble pose. */
  | { type: 'HOME' }

export type FocusCommand =
  | { kind: 'flyToDevice'; instanceId: string }
  | { kind: 'flyToEnsemble' }
  /** Move the orbit pivot only (alpha, beta, radius kept). */
  | { kind: 'repivot'; point: readonly [number, number, number] }
  | { kind: 'pickup'; from: PortRef }
  | { kind: 'dropHeld' }
  | { kind: 'connect'; a: PortRef; b: PortRef }

export interface Transition {
  state: FocusState
  commands: FocusCommand[]
}

const same = (a: PortRef, b: PortRef) => a.instance === b.instance && a.port === b.port

const keep = (state: FocusState): Transition => ({ state, commands: [] })

/**
 * From either mode: fly straight to the device (device→device refocus allowed).
 * A held cable stays in hand (spec §1 step 5).
 */
const focusOn = (state: FocusState, instanceId: string): Transition => ({
  state: { ...state, mode: 'focus', focused: instanceId, selected: instanceId },
  commands: [{ kind: 'flyToDevice', instanceId }],
})

/**
 * ESC policy (ADR-0008): the spec lists Esc both as "back to Ensemble" and as
 * "cancel held cable". Resolution: Esc undoes the MOST RECENT commitment —
 * first press cancels the held cable, next press leaves Focus. Right-click and
 * empty-click go back to Ensemble WITH the cable still in hand (that IS the
 * §1 step-4 flow: return, watch compatible devices glow, dive into the target).
 */
export function reduce(state: FocusState, event: FocusEvent): Transition {
  switch (event.type) {
    case 'DEVICE_DOUBLE_CLICK':
      return focusOn(state, event.instanceId)

    case 'DEVICE_CLICK':
      // N1: a single click focuses too (pivot = the device). On the device
      // already framed it is a no-op: a click that misses a port must not
      // snap away the angle the learner orbited to. (Double-click still re-frames.)
      if (state.mode === 'focus' && state.focused === event.instanceId) return keep(state)
      return focusOn(state, event.instanceId)

    case 'FLOOR_DOUBLE_CLICK':
      // Orbit around a point of the room. In Focus this leaves focus (nothing
      // is framed any more) WITHOUT flying home: the camera keeps its angle.
      return {
        state: { ...state, mode: 'ensemble', focused: null },
        commands: [{ kind: 'repivot', point: event.point }],
      }

    case 'HOME':
      // Like right-click from Focus, but it also flies home from Ensemble
      // (after a pan or a re-pivot). The held cable survives.
      return {
        state: { ...state, mode: 'ensemble', focused: null },
        commands: [{ kind: 'flyToEnsemble' }],
      }

    case 'PORT_CLICK': {
      if (!state.held) {
        return {
          state: { ...state, held: event.ref },
          commands: [{ kind: 'pickup', from: event.ref }],
        }
      }
      if (same(state.held, event.ref)) {
        // Click the held end again = cancel (spec §2 table).
        return { state: { ...state, held: null }, commands: [{ kind: 'dropHeld' }] }
      }
      // Second end chosen — the ORCHESTRATOR decides the outcome. The machine
      // optimistically releases the cable; FocusPatch re-picks it up on a
      // rejected connect so the learner can retry without re-clicking the source.
      return {
        state: { ...state, held: null },
        commands: [{ kind: 'connect', a: state.held, b: event.ref }],
      }
    }

    case 'EMPTY_CLICK':
      if (state.mode === 'focus')
        return {
          state: { ...state, mode: 'ensemble', focused: null },
          commands: [{ kind: 'flyToEnsemble' }],
        }
      return keep({ ...state, selected: null })

    case 'RIGHT_CLICK':
      if (state.mode === 'focus')
        return {
          state: { ...state, mode: 'ensemble', focused: null },
          commands: [{ kind: 'flyToEnsemble' }],
        }
      return keep(state)

    case 'ESC': {
      if (state.held)
        return { state: { ...state, held: null }, commands: [{ kind: 'dropHeld' }] }
      if (state.mode === 'focus')
        return {
          state: { ...state, mode: 'ensemble', focused: null },
          commands: [{ kind: 'flyToEnsemble' }],
        }
      return keep(state)
    }

    case 'TAB': {
      const ids = event.instanceIds
      if (ids.length === 0) return keep(state)
      const current = state.selected ?? state.focused
      const idx = current ? ids.indexOf(current) : -1
      const next = ids[(idx + 1) % ids.length]
      return keep({ ...state, selected: next })
    }

    case 'ENTER':
      if (!state.selected) return keep(state)
      return {
        state: { ...state, mode: 'focus', focused: state.selected },
        commands: [{ kind: 'flyToDevice', instanceId: state.selected }],
      }
  }
}

/** Re-arm the held cable after a rejected connect (FocusPatch calls this). */
export function repickup(state: FocusState, from: PortRef): Transition {
  return { state: { ...state, held: from }, commands: [{ kind: 'pickup', from }] }
}
