/**
 * The mix input of the live design (Task 39, ADR-0015 addendum): which speakers sound, where they stand and how they face the listener. Pure: no
 * Babylon, no DOM, no store. The numbers then go through `listenerMix` (src/audio/listenerMix.ts).
 *
 *  - The console BALANCE is part of the feed's gain (`speakerBalanceDb`, src/audio/balance.ts: the same law as the coverage): a side cut by the balance is −Infinity, silence.
 *  - One feed per speaker of the signal path (`PathResult.speakers`: powered, with a route from the console; a Bêta device never has one).
 *  - Its pose is the placement's (position, yaw, tilt) through `speakerPose`, the conversion the coverage layer uses; the acoustic axis is the
 *    placement's local +z (ADR-0015, decision L30 viii).
 *  - `dirDb` = `directivityDb(...)` toward the listener (src/acoustics/field.ts, not re-implemented), from the catalog's sourced coverage angles.
 *    A speaker with NO usable acoustic data still plays: the mix only needs its position, so its directivity is taken as 0 dB (omnidirectional). That is
 *    an honest default, not a measurement: the coverage layer leaves such a speaker out, the listening does not.
 *  - A speaker without a placement has no position: it cannot be heard from anywhere, so it is left out (the coverage layer says `no-placement`).
 */
import type { Registry } from '../engine/CatalogLoader'
import type { PathResult } from '../flow/signalPath'
import type { DesignState } from '../trials/trial'
import { directivityDb } from '../acoustics/field'
import { offAxis } from '../acoustics/geometry'
import type { MixInput } from '../audio/listenerMix'
import { speakerBalanceDb } from '../audio/balance'
import { speakerPose, type CoverageSourceOptions } from './coverageSources'

export interface ListenerPose {
  position: [number, number, number]
  /** The camera's RENDERED right vector in the world (never assumed: src/creation/listenerPose.ts reads it off the view matrix). */
  right: [number, number, number]
}

export function mixInput(design: DesignState, registry: Registry, path: PathResult, listener: ListenerPose, options: CoverageSourceOptions = {}): MixInput {
  const feeds: MixInput['feeds'] = []
  const seen = new Set<string>()
  for (const feed of path.speakers) {
    if (seen.has(feed.instanceId)) continue
    seen.add(feed.instanceId)
    const placement = design.placements.find((p) => p.instanceId === feed.instanceId)
    if (!placement) continue
    const deviceId = design.rig.instances.find((i) => i.instanceId === feed.instanceId)?.deviceId
    // The same definition of « verified » as coverageSources (L27): a proposal lives in deviceById only.
    const dev = deviceId !== undefined && registry.catalog.devices.some((d) => d.id === deviceId) ? registry.deviceById.get(deviceId) : undefined
    const pose = speakerPose(placement, deviceId ?? '', options.frontYawOffsetDeg)
    const h = dev?.acoustic?.coverage_h_deg.value
    const v = dev?.acoustic?.coverage_v_deg.value
    let dirDb = 0
    if (h !== undefined && v !== undefined && h > 0 && v > 0 && Number.isFinite(h) && Number.isFinite(v)) {
      const a = offAxis(pose, listener.position)
      dirDb = directivityDb(a.thetaHdeg, a.thetaVdeg, h, v, a.rear)
    }
    feeds.push({ instanceId: feed.instanceId, position: [...pose.position], channels: [...feed.channels], gainDb: feed.gainDb + speakerBalanceDb(feed.balance, feed.channels), muted: feed.muted, dirDb })
  }
  return { listener: { position: [...listener.position], right: [...listener.right] }, feeds }
}
