/**
 * scene/assetExtras: the shape of the `extras` object the 3D pipeline writes on the root node of every GLB
 * (version 1). It carries the measured placement of the ports and controls in GLB file space, in metres,
 * pivot bottom-centre, so the app can read them back without parsing node names.
 *
 * Where Babylon puts them (proved in tests/scene/deviceSpawnerExtras.test.ts, Babylon 7.54.3): the glTF loader's
 * ExtrasAsMetadata extension is registered AND enabled by default (no plugin options needed on ImportMeshAsync), and
 * copies a glTF node's `extras` to `babylonNode.metadata.gltf.extras`. The pipeline's custom property `tekpractice`
 * therefore lands on `metadata.gltf.extras.tekpractice` of the glTF root node, which is a CHILD of the loader's own
 * `__root__` mesh (meshes[0], no extras of its own): hence the search through the descendants.
 *
 * Type-only Babylon import: this module stays free of runtime Babylon code.
 */
import type { AbstractMesh } from '@babylonjs/core'

export interface AssetExtrasV1 {
  schema: 1
  realSizeMm: { w: number; h: number; d: number }
  ports: { portId: string; pos: [number, number, number] }[]
  controls: { controlId: string; pos: [number, number, number]; axis: 'x' | 'y' | 'z'; kind: string }[]
}

type Vec3 = [number, number, number]
const AXES = new Set(['x', 'y', 'z'])

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isPositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0

function vec3(v: unknown): Vec3 | null {
  if (!Array.isArray(v) || v.length !== 3) return null
  // Array.from visits holes (as undefined), so a sparse array is rejected; .map would skip them and keep the holes.
  const out = Array.from(v, (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : NaN))
  return out.every((n) => !Number.isNaN(n)) ? (out as Vec3) : null
}

/** Validates the extras (an object, or a JSON string of one); null for anything malformed. Never throws. */
export function parseAssetExtras(raw: unknown): AssetExtrasV1 | null {
  try {
    const v: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!isRecord(v) || v.schema !== 1) return null
    const size = v.realSizeMm
    if (!isRecord(size) || !isPositive(size.w) || !isPositive(size.h) || !isPositive(size.d)) return null
    if (!Array.isArray(v.ports) || !Array.isArray(v.controls)) return null

    const ports: AssetExtrasV1['ports'] = []
    for (const p of v.ports as unknown[]) {
      const pos = isRecord(p) ? vec3(p.pos) : null
      if (!isRecord(p) || !isId(p.portId) || !pos) return null
      ports.push({ portId: p.portId, pos })
    }
    const controls: AssetExtrasV1['controls'] = []
    for (const c of v.controls as unknown[]) {
      const pos = isRecord(c) ? vec3(c.pos) : null
      if (!isRecord(c) || !isId(c.controlId) || !pos || typeof c.axis !== 'string' || !AXES.has(c.axis) || typeof c.kind !== 'string') return null
      controls.push({ controlId: c.controlId, pos, axis: c.axis as 'x' | 'y' | 'z', kind: c.kind })
    }
    return { schema: 1, realSizeMm: { w: size.w, h: size.h, d: size.d }, ports, controls }
  } catch {
    return null
  }
}

/** `metadata.gltf.extras.tekpractice` of a node, parsed; null when absent or malformed. */
function extrasOf(node: { metadata?: unknown }): AssetExtrasV1 | null {
  const meta = node.metadata
  if (!isRecord(meta) || !isRecord(meta.gltf) || !isRecord(meta.gltf.extras)) return null
  return parseAssetExtras(meta.gltf.extras.tekpractice)
}

/** The extras of a loaded GLB: on its root or on any descendant node (the first valid one wins); null when none. */
export function findExtras(glbRoot: AbstractMesh): AssetExtrasV1 | null {
  try {
    const own = extrasOf(glbRoot)
    if (own) return own
    for (const n of glbRoot.getDescendants(false)) {
      const found = extrasOf(n)
      if (found) return found
    }
  } catch {
    // a hierarchy that cannot be walked carries no usable extras
  }
  return null
}
