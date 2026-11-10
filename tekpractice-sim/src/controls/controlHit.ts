/**
 * controls/controlHit: the identity a control's hit pad carries in its mesh metadata, and the read-back. Kept apart from the rig so the
 * pointer controller (main chunk) can recognise a control without pulling the rig (lazy chunk) in.
 */
import type { AbstractMesh } from '@babylonjs/core'

export interface ControlHit {
  isControl: true
  instanceId: string
  controlId: string
}

/** The control a pick landed on, or null. */
export function controlHit(mesh: AbstractMesh | null | undefined): ControlHit | null {
  const md = mesh?.metadata as Partial<ControlHit> | null | undefined
  return md?.isControl === true && typeof md.instanceId === 'string' && typeof md.controlId === 'string' ? (md as ControlHit) : null
}
