/**
 * Pure design helpers shared by the legacy game (`game.ts`) and Mode Création
 * (`creation/store.ts`), extracted from `game.ts` (C2 strangler, P15).
 * No Babylon, no DOM: plain data in, plain data out.
 */
import type { ControlValue, PortRef, RigSnapshot } from '../engine/types'
import type { DeepReadonly, DesignState, Placement } from '../trials/trial'

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * Stored data is untrusted: only finite numbers count as a position. A
 * placement needs a 3-number position and a finite yaw; an optional tilt must
 * be finite too.
 */
export function isFinitePlacement(p: unknown): p is Placement {
  if (typeof p !== 'object' || p === null) return false
  const q = p as { position_m?: unknown; yawDeg?: unknown; tiltDeg?: unknown }
  return (
    Array.isArray(q.position_m) &&
    q.position_m.length === 3 &&
    q.position_m.every(isFiniteNumber) &&
    isFiniteNumber(q.yawDeg) &&
    (q.tiltDeg === undefined || isFiniteNumber(q.tiltDeg))
  )
}

/**
 * The placements of a design that may be used as poses, one per instance.
 * Like the legacy `applyDesign` Map, the LAST placement of an instance wins,
 * and an invalid last one leaves the instance without a placement.
 */
export function sanitizePlacements(design: DeepReadonly<DesignState>): Placement[] {
  const last = new Map<string, DeepReadonly<Placement>>()
  for (const p of design.placements) last.set(p.instanceId, p)
  const out: Placement[] = []
  for (const p of last.values()) {
    if (!isFinitePlacement(p)) continue
    out.push({
      instanceId: p.instanceId,
      deviceId: p.deviceId,
      position_m: [p.position_m[0], p.position_m[1], p.position_m[2]],
      yawDeg: p.yawDeg,
      ...(p.tiltDeg !== undefined ? { tiltDeg: p.tiltDeg } : {}),
      ...(p.mount !== undefined ? { mount: p.mount } : {}),
    })
  }
  return out
}

/** A saved rig (ADR-0005, rigs.v2) as far as the design conversion cares. */
export interface RigLike {
  roomId?: string | null
  instances: ReadonlyArray<{ instanceId: string; deviceId: string }>
  connections: ReadonlyArray<{ a: PortRef; b: PortRef }>
  controls: Record<string, Record<string, ControlValue>>
  /** [x, y, z, yawDeg]; anything but 4 finite numbers is dropped. */
  positions?: Record<string, number[]>
}

/** A saved rig becomes a design, applied like an Essai (legacy `loadRigByName`). */
export function rigToDesign(rig: RigLike): DesignState {
  return {
    roomId: rig.roomId ?? null,
    rig: { instances: rig.instances as DesignState['rig']['instances'], connections: rig.connections as DesignState['rig']['connections'], controls: rig.controls },
    placements: rig.instances.flatMap((s) => {
      const saved = rig.positions?.[s.instanceId]
      // Stored data is untrusted: only 4 finite numbers count as a position.
      const valid = Array.isArray(saved) && saved.length === 4 && saved.every((v) => Number.isFinite(v))
      return valid
        ? [{ instanceId: s.instanceId, deviceId: s.deviceId, position_m: [saved[0], saved[1], saved[2]] as [number, number, number], yawDeg: saved[3] }]
        : []
    }),
  }
}

/**
 * The live rig as a design: graph snapshot + the placements of instances still
 * in the graph (snapshot order) + the room id. Controls are copies.
 */
export function captureDesignFrom(
  snapshot: RigSnapshot,
  placements: ReadonlyMap<string, Placement>,
  roomId: string | null,
): DesignState {
  return {
    roomId,
    rig: {
      instances: snapshot.instances.map((i) => ({ instanceId: i.instanceId, deviceId: i.deviceId })),
      connections: snapshot.connections.map((c) => ({ a: { ...c.a }, b: { ...c.b } })),
      controls: Object.fromEntries(snapshot.instances.map((i) => [i.instanceId, { ...i.controls }])),
    },
    placements: snapshot.instances.flatMap((i) => {
      const p = placements.get(i.instanceId)
      if (!p) return []
      return [
        {
          instanceId: p.instanceId,
          deviceId: p.deviceId,
          position_m: [p.position_m[0], p.position_m[1], p.position_m[2]] as [number, number, number],
          yawDeg: p.yawDeg,
          ...(p.tiltDeg !== undefined ? { tiltDeg: p.tiltDeg } : {}),
          ...(p.mount !== undefined ? { mount: p.mount } : {}),
        },
      ]
    }),
  }
}
