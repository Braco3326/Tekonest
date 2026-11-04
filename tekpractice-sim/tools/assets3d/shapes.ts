/**
 * assets3d/shapes: the shape table of the scripted builder (tools/assets3d/blender/build_from_spec.py) and the check of
 * a spec's optional `build` block. Each shape works for one kind (device or connector), accepts a fixed set of numeric
 * params and may need the connector's mating diameter (`mating.outerMm`). The Python registry must list exactly
 * BUILD_SHAPES (a test compares the two), so the zod enum and the script cannot drift.
 *
 * No runtime imports: specSchema.ts imports BUILD_SHAPES from here, so this file only takes the spec type.
 */
import type { AssetSpecT } from './specSchema'

/** Every shape the builder knows. Grows by one entry each time a later wave adds a shape. */
export const BUILD_SHAPES = ['cylinder-plug', 'trs-plug', 'rj45-plug', 'rack-box', 'stagebox-rio3224', 'revolve', 'console-wedge'] as const
export type BuildShape = (typeof BUILD_SHAPES)[number]

export interface ShapeSpec {
  /** The asset kind the shape builds. */
  kind: 'device' | 'connector'
  /** Names of the numeric params the shape accepts (all optional, defaults live in the Python builder). */
  params: readonly string[]
  /** True when the shape needs `mating.outerMm` (the diameter of the mating end). */
  needsMatingOuter: boolean
  /** True when the shape is driven by a lathe `profile` (and takes optional `colours`); every other shape takes neither. */
  usesProfile?: boolean
  /** How the profile reads: 'lathe' = [axial position, diameter] (revolve), 'side' = [depth from the io face, height] (console-wedge). */
  profileKind?: 'lathe' | 'side'
}

export const SHAPE_SPECS: Record<BuildShape, ShapeSpec> = {
  'cylinder-plug': { kind: 'connector', params: ['frontLenMm'], needsMatingOuter: true },
  'trs-plug': { kind: 'connector', params: ['barrelMm'], needsMatingOuter: true },
  'rj45-plug': { kind: 'connector', params: [], needsMatingOuter: false },
  'rack-box': { kind: 'device', params: ['chamferMm'], needsMatingOuter: false },
  // The Yamaha Rio3224-D2 stage box: layout (connector grid, panel plates) is in the builder, only datasheet sizes are params.
  'stagebox-rio3224': { kind: 'device', params: ['earMm', 'flangeDepthMm', 'frontStepMm', 'rearStepMm'], needsMatingOuter: false },
  // A surface of revolution about the vertical axis from a measured profile (microphones, later stands and lamps).
  revolve: { kind: 'device', params: ['segments'], needsMatingOuter: false, usesProfile: true, profileKind: 'lathe' },
  // A console or any wedge-shaped casing: the side profile [depth from the io face mm, height mm] extruded across the width, edges chamfered.
  'console-wedge': { kind: 'device', params: ['chamferMm'], needsMatingOuter: false, usesProfile: true, profileKind: 'side' },
}

/**
 * Checks the `build` block of `spec`. Returns one message per problem (empty = ok, also when there is no build block).
 * Messages name the asset id, the shape and the param so a typo is found at once.
 */
/** How far a profile may be off the spec size, in mm (the fix-up rescales anyway; this keeps the shape honest). */
const PROFILE_TOL_MM = 0.05

export function validateBuild(spec: AssetSpecT): string[] {
  const build = spec.build
  if (!build) return []
  const shape = SHAPE_SPECS[build.shape]
  const errors: string[] = []

  if (shape.kind !== spec.kind) {
    // The other checks are moot for a shape of the wrong kind.
    return [`${spec.id}: build shape '${build.shape}' builds a ${shape.kind}, but this asset is a ${spec.kind}`]
  }
  for (const [name, value] of Object.entries(build.params ?? {})) {
    if (!shape.params.includes(name)) {
      const allowed = shape.params.length > 0 ? shape.params.join(', ') : '(none)'
      errors.push(`${spec.id}: build shape '${build.shape}' has no param '${name}' (allowed: ${allowed})`)
    } else if (!Number.isFinite(value) || value <= 0) {
      errors.push(`${spec.id}: build param '${name}' of shape '${build.shape}' must be a positive number, got ${String(value)}`)
    }
  }
  const size = spec.realSizeMm
  if (!shape.usesProfile) {
    if (build.profile !== undefined || build.colours !== undefined) {
      errors.push(`${spec.id}: build shape '${build.shape}' takes no profile or colours (only revolve does)`)
    }
  } else if (build.profile === undefined) {
    errors.push(shape.profileKind === 'side'
      ? `${spec.id}: build shape '${build.shape}' needs a profile (at least four [depth from the io face mm, height mm] stations)`
      : `${spec.id}: build shape '${build.shape}' needs a profile (at least four [position mm, diameter mm] stations)`)
  } else if (shape.profileKind === 'side') {
    const profile = build.profile
    const first = profile[0][0]
    const last = profile[profile.length - 1][0]
    const tallest = Math.max(...profile.map((st) => st[1]))
    if (build.colours !== undefined) errors.push(`${spec.id}: build shape '${build.shape}' takes no colours (only revolve does)`)
    if (Math.abs(first) > PROFILE_TOL_MM) errors.push(`${spec.id}: the first station must be at 0 (the io face), got ${first} mm`)
    if (Math.abs(last - size.d) > PROFILE_TOL_MM) errors.push(`${spec.id}: the last station must be at the depth ${size.d} mm (the front edge), got ${last} mm`)
    if (Math.abs(tallest - size.h) > PROFILE_TOL_MM) errors.push(`${spec.id}: the tallest station (${tallest} mm) must equal the height ${size.h} mm`)
    profile.forEach((st, i) => {
      if (!(st[1] > 0)) errors.push(`${spec.id}: station ${i} has a height of ${st[1]} mm: every height must be positive`)
    })
  } else {
    const profile = build.profile
    if (Math.abs(size.w - size.d) > PROFILE_TOL_MM) {
      errors.push(`${spec.id}: a revolved shape needs a round footprint: w (${size.w} mm) must equal d (${size.d} mm)`)
    }
    const first = profile[0][0]
    const last = profile[profile.length - 1][0]
    const widest = Math.max(...profile.map((st) => st[1]))
    if (Math.abs(first) > PROFILE_TOL_MM) errors.push(`${spec.id}: the first station must be at 0 (the base), got ${first} mm`)
    if (Math.abs(last - size.h) > PROFILE_TOL_MM) errors.push(`${spec.id}: the last station must be at the height ${size.h} mm, got ${last} mm`)
    if (Math.abs(widest - size.w) > PROFILE_TOL_MM) errors.push(`${spec.id}: the widest station (${widest} mm) must equal the width ${size.w} mm`)
    for (const c of build.colours ?? []) {
      if (c.fromMm > size.h) errors.push(`${spec.id}: a colour zone at ${c.fromMm} mm is beyond the height ${size.h} mm`)
    }
    const segments = build.params?.segments
    if (segments !== undefined && !(Number.isInteger(segments) && segments >= 12 && segments <= 64 && segments % 4 === 0)) {
      errors.push(`${spec.id}: param 'segments' must be a whole number from 12 to 64 and a multiple of 4 (so the box is exact), got ${segments}`)
    }
  }
  if (shape.needsMatingOuter && spec.mating?.outerMm === undefined) {
    errors.push(`${spec.id}: build shape '${build.shape}' needs mating.outerMm (the diameter of the mating end)`)
  }
  return errors
}
