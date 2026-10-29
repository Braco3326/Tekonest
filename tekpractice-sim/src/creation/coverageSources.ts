/**
 * The loudspeakers that make sound, as the acoustic core wants them (Task 37, ADR-0015): `AcSource`s built from the design (pose), the catalog
 * (`acoustic.coverage_*`) and the signal path (`SpeakerFeed.gainDb` → `lRefDb`, P10). Pure: no Babylon, no DOM, no store.
 *
 * `computeField` throws a RangeError for a speaker without a valid coverage, and a speaker that is muted, unpowered or fed at −inf adds nothing,
 * so this PRE-FILTERS: only a speaker that
 *  - is fed by the signal path (`PathResult.speakers`: powered, with a route from the console),
 *  - is a VERIFIED catalog device (a Bêta proposal has no `acoustic`; it is never in `registry.catalog.devices`, the second definition of « non
 *    vérifié » of L27, kept aligned with `isUnverified`),
 *  - has a sourced `acoustic` coverage (finite, > 0),
 *  - is not muted (the master mute silences the feed: it never gates playback, Task 34, but it adds nothing to the field),
 *  - has a feed above −inf,
 *  - and has a placement in the design
 * becomes a source. Every other fed speaker is listed in `excluded` with the reason, so the panel can say why a field is empty.
 * `max_spl_db` (a PEAK figure, L28 (v)) is carried for the S2 rule only; it never enters the level.
 */
import type { Registry } from '../engine/CatalogLoader'
import type { PathResult } from '../flow/signalPath'
import { isPowered } from '../flow/signalPath'
import type { AcSource } from '../acoustics/field'
import type { DesignState } from '../trials/trial'

export type ExclusionReason = 'unverified' | 'no-acoustic' | 'muted' | 'silent' | 'unpowered' | 'no-placement' | 'bad-coverage'

export type SourceKind = 'datasheet' | 'kb' | 'nominal'

/** A speaker that contributes: what the panel says about where its numbers come from. */
export interface UsedSpeaker {
  instanceId: string
  deviceId: string
  hDeg: number
  vDeg: number
  hKind: SourceKind
  vKind: SourceKind
  /** The V angle is a deduction of the knowledge base (K12.2: « axisymmetric », L28 (iii)): the source note of the catalog says so. */
  vDeduced: boolean
  /** Sourced catalog figures, or undefined (none today for `sensitivityDb`). */
  sensitivityDb: number | undefined
  maxSplDb: number | undefined
}

export interface CoverageSourcesResult {
  sources: AcSource[]
  used: UsedSpeaker[]
  excluded: { instanceId: string; reason: ExclusionReason }[]
}

export interface CoverageSourceOptions {
  /**
   * Degrees added to a device's yaw to get its acoustic axis, by device id. EMPTY (ADR-0015: yaw 0 faces +z): the front of the K12.2 / DBR12 `.glb`
   * is an open question (docs/CREATIVE-MODE-LOG.md L30), not something to fix here. The seam exists so that a decision (a per-device offset,
   * or none because the assets get re-oriented) is one line of data and one test, not a change of the acoustic core.
   */
  frontYawOffsetDeg?: Readonly<Record<string, number>>
}

/** Per-device acoustic front offsets (degrees). Empty on purpose, see `CoverageSourceOptions.frontYawOffsetDeg`. */
export const FRONT_YAW_OFFSET_DEG: Readonly<Record<string, number>> = {}

/** The L28 (iii) deduction note in the `ref` of a coverage value (« V déduit de « axisymmetric » … »). */
const DEDUCED = /\bdéduit\b/i

export function coverageSourcesDetail(design: DesignState, registry: Registry, path: PathResult, options: CoverageSourceOptions = {}): CoverageSourcesResult {
  const offsets = options.frontYawOffsetDeg ?? FRONT_YAW_OFFSET_DEG
  const out: CoverageSourcesResult = { sources: [], used: [], excluded: [] }
  const seen = new Set<string>()
  for (const feed of path.speakers) {
    if (seen.has(feed.instanceId)) continue // one source per speaker, whatever the channels
    seen.add(feed.instanceId)
    const skip = (reason: ExclusionReason): void => void out.excluded.push({ instanceId: feed.instanceId, reason })
    const deviceId = design.rig.instances.find((i) => i.instanceId === feed.instanceId)?.deviceId
    // A Bêta proposal lives in `deviceById` only; a catalog device is in `catalog.devices` (see the header).
    const dev = deviceId !== undefined && registry.catalog.devices.some((d) => d.id === deviceId) ? registry.deviceById.get(deviceId) : undefined
    if (!dev) {
      skip('unverified')
      continue
    }
    const ac = dev.acoustic
    if (!ac) {
      skip('no-acoustic')
      continue
    }
    if (feed.muted) {
      skip('muted')
      continue
    }
    if (!(feed.gainDb > -Infinity) || Number.isNaN(feed.gainDb)) {
      skip('silent')
      continue
    }
    if (!isPowered(design, registry, feed.instanceId)) {
      skip('unpowered')
      continue
    }
    const placement = design.placements.find((p) => p.instanceId === feed.instanceId)
    if (!placement) {
      skip('no-placement')
      continue
    }
    const h = ac.coverage_h_deg
    const v = ac.coverage_v_deg
    if (!(h.value > 0 && v.value > 0 && Number.isFinite(h.value) && Number.isFinite(v.value))) {
      skip('bad-coverage')
      continue
    }
    out.sources.push({
      id: feed.instanceId,
      pose: { position: [...placement.position_m], yawDeg: placement.yawDeg + (offsets[dev.id] ?? 0), tiltDeg: placement.tiltDeg ?? 0 },
      hDeg: h.value,
      vDeg: v.value,
      lRefDb: feed.gainDb, // P10: the feed's gain is the scale level, not an SPL
    })
    out.used.push({
      instanceId: feed.instanceId,
      deviceId: dev.id,
      hDeg: h.value,
      vDeg: v.value,
      hKind: h.source.kind,
      vKind: v.source.kind,
      vDeduced: DEDUCED.test(v.source.ref),
      sensitivityDb: ac.sensitivity_db?.value,
      maxSplDb: ac.max_spl_db?.value,
    })
  }
  return out
}

/** The brief's signature: only the fed, powered, unmuted, verified speakers that have acoustic data. */
export function coverageSources(design: DesignState, registry: Registry, path: PathResult, options?: CoverageSourceOptions): AcSource[] {
  return coverageSourcesDetail(design, registry, path, options).sources
}

/**
 * S2: « ≈ dB SPL estimé » may exist only when EVERY contributing speaker has a sourced `sensitivity_db` AND a sourced `max_spl_db` (and there is at
 * least one). Today none has a sensitivity: false. `max_spl_db` is a peak figure and is never shown as a sustained level. No formula is given
 * by ADR-0015 and none is invented: the panel only says that an estimate would be possible (and that it is a pedagogical estimate).
 */
export function splEstimateEligible(used: readonly UsedSpeaker[]): boolean {
  return used.length > 0 && used.every((u) => Number.isFinite(u.sensitivityDb) && Number.isFinite(u.maxSplDb))
}

const KIND_ORDER: readonly SourceKind[] = ['datasheet', 'kb', 'nominal']

/** The distinct provenance kinds of the coverage angles actually used, in a fixed order, and whether a V angle is a deduction. */
export function provenanceOf(used: readonly UsedSpeaker[]): { kinds: SourceKind[]; vDeduced: boolean } {
  const present = new Set<SourceKind>()
  for (const u of used) {
    present.add(u.hKind)
    present.add(u.vKind)
  }
  return { kinds: KIND_ORDER.filter((k) => present.has(k)), vDeduced: used.some((u) => u.vDeduced) }
}
