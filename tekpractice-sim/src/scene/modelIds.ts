import manifest from '../../public/assets/ASSET_MANIFEST.json'

/**
 * Devices that ship a `public/assets/<id>.glb`: the manifest lists exactly those files (status `ok`).
 * One source for the inventory drawer (model icon) and the spawner (never ask for a file that does not exist).
 * tests/scene/modelIds.test.ts fails when the manifest and the shipped files drift.
 */
export const MODEL_IDS: ReadonlySet<string> = new Set(
  (manifest as { assets: { id: string; status: string }[] }).assets.filter((a) => a.status === 'ok').map((a) => a.id),
)

/** True when `public/assets/<deviceId>.glb` ships. */
export function hasModel(deviceId: string): boolean {
  return MODEL_IDS.has(deviceId)
}
