/**
 * UI intents — the ONLY way the UI/scene layer acts on the rig.
 * The bootstrap orchestrator applies intents to ConnectionGraph and notifies
 * listeners; the UI never mutates the graph (CLAUDE.md unidirectional flow).
 */
import type { ControlValue, PortRef } from '../engine/types'

export type Intent =
  | { type: 'CONNECT'; a: PortRef; b: PortRef }
  | { type: 'DISCONNECT'; connectionId: string }
  | { type: 'SET_CONTROL'; instance: string; control: string; value: ControlValue }
  /**
   * Sandbox (ADR-0004): grab a device from the shelves, drop it on stage.
   * Explore placement (ADR-0010) adds the floor point and yaw (degrees).
   */
  | { type: 'SPAWN'; deviceId: string; position?: [number, number, number]; rotationY?: number }
  /** Sandbox (ADR-0010): pick a placed device back up (its cables are unplugged). */
  | { type: 'REMOVE'; instanceId: string }
  /** Sandbox (ADR-0005): rebuild a saved rig — clear stage, respawn, rewire. */
  | { type: 'LOAD_RIG'; name: string }
  /**
   * Sandbox (ADR-0010 Décision 8): undo a pick-up — the same instance comes
   * back where it stood, with its cables and controls. An intent like any
   * other, so a read-only Essais compare refuses it (Task 14 review).
   */
  | {
      type: 'RESTORE_INSTANCE'
      instanceId: string
      deviceId: string
      pose: { position: [number, number, number]; rotationY: number }
      wires: { a: PortRef; b: PortRef }[]
      controls: Record<string, ControlValue>
    }

export type IntentDispatcher = (intent: Intent) => void
