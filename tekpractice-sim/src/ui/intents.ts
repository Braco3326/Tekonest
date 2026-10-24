/**
 * UI intents — the ONLY way the UI/scene layer acts on the rig.
 * The bootstrap orchestrator applies intents to ConnectionGraph and notifies
 * listeners; the UI never mutates the graph (CLAUDE.md unidirectional flow).
 */
import type { ControlValue, PortRef } from '../engine/types'
import type { DesignState, Mount } from '../trials/trial'

export type Intent =
  | { type: 'CONNECT'; a: PortRef; b: PortRef }
  | { type: 'DISCONNECT'; connectionId: string }
  | { type: 'SET_CONTROL'; instance: string; control: string; value: ControlValue }
  /**
   * Sandbox (ADR-0004): grab a device from the shelves, drop it on stage.
   * Explore placement (ADR-0010) adds the floor point and yaw (degrees).
   * Mode Création (C6) adds a caller-chosen `instanceId` (undo must respawn the
   * same id), initial `controls`, and the optional `tiltDeg` / `mount` (P6).
   * The legacy game ignores the Création-only fields.
   */
  | {
      type: 'SPAWN'
      deviceId: string
      position?: [number, number, number]
      rotationY?: number
      instanceId?: string
      controls?: Record<string, ControlValue>
      tiltDeg?: number
      mount?: Mount
    }
  /**
   * Mode Création (C6): move/turn/tilt/mount a placed device in one go. A drag
   * is one SET_POSE per transaction; its inverse is the previous pose.
   */
  | { type: 'SET_POSE'; instanceId: string; position: [number, number, number]; yawDeg: number; tiltDeg: number; mount: Mount }
  /**
   * Mode Création (C5/C6): replace the whole design (template, rig or place
   * load). Its inverse is an APPLY_DESIGN of the design it replaced.
   */
  | { type: 'APPLY_DESIGN'; design: DesignState }
  /**
   * Mode Création (P1): disconnect by port pair, id-free so that undo/redo can
   * replay it after connection ids changed. History records DISCONNECT as UNPLUG.
   */
  | { type: 'UNPLUG'; a: PortRef; b: PortRef }
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
