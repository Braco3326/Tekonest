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
export const BUILD_SHAPES = ['cylinder-plug', 'trs-plug', 'rj45-plug', 'rack-box'] as const
export type BuildShape = (typeof BUILD_SHAPES)[number]

export interface ShapeSpec {
  /** The asset kind the shape builds. */
  kind: 'device' | 'connector'
  /** Names of the numeric params the shape accepts (all optional, defaults live in the Python builder). */
  params: readonly string[]
  /** True when the shape needs `mating.outerMm` (the diameter of the mating end). */
  needsMatingOuter: boolean
}

export const SHAPE_SPECS: Record<BuildShape, ShapeSpec> = {
  'cylinder-plug': { kind: 'connector', params: ['frontLenMm'], needsMatingOuter: true },
  'trs-plug': { kind: 'connector', params: ['barrelMm'], needsMatingOuter: true },
  'rj45-plug': { kind: 'connector', params: [], needsMatingOuter: false },
  'rack-box': { kind: 'device', params: ['chamferMm'], needsMatingOuter: false },
}

/**
 * Checks the `build` block of `spec`. Returns one message per problem (empty = ok, also when there is no build block).
 * Messages name the asset id, the shape and the param so a typo is found at once.
 */
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
  if (shape.needsMatingOuter && spec.mating?.outerMm === undefined) {
    errors.push(`${spec.id}: build shape '${build.shape}' needs mating.outerMm (the diameter of the mating end)`)
  }
  return errors
}
