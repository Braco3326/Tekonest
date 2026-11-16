/**
 * Waves 2 to 5 review, finding 1: 29 devices lost their generic-panel picture in the layout rebuilds (the rebuild ran
 * `asset:build -- <id> --scripted --ship` without the `--project-photo` faces, so the GLB came out flat-coloured and the manifest
 * said scripted / generic). The picture is data (content/generic-panels/<id>.json), so the rule is held on the real rows:
 * every device that has a generic panel has a hybrid manifest row whose photos are the pipeline's own `_generic_*` pictures and a
 * GLB that carries at least one image. A face the spec gives a reference photo (build.photos) records that photo instead.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const PANELS = 'content/generic-panels'
const manifest = JSON.parse(readFileSync('public/assets/ASSET_MANIFEST.json', 'utf8')) as { assets: { id: string; tool?: string; photos?: string[]; trademark?: string; source?: string }[] }
const rows = new Map(manifest.assets.map((a) => [a.id, a]))
const panelIds = readdirSync(PANELS)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))

/** The glTF JSON of a .glb (the first chunk), for the image count. */
function gltfJson(file: string): { images?: unknown[]; textures?: unknown[] } {
  const buf = readFileSync(file)
  const len = buf.readUInt32LE(12)
  return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'))
}

describe('every device with a generic panel keeps its picture', () => {
  it('there are panels to check', () => {
    expect(panelIds.length).toBeGreaterThan(100)
  })
  it.each(panelIds)('%s: hybrid manifest row, generic pictures, a GLB with an image', (id) => {
    const row = rows.get(id)
    expect(row, `${id}: no manifest row`).toBeDefined()
    expect(row?.tool, `${id}: the manifest row says ${row?.tool}, a device with a panel is hybrid`).toBe('hybrid')
    expect((row?.photos ?? []).length, `${id}: no picture recorded`).toBeGreaterThan(0)
    // a face may carry a real reference photo named in the spec's build.photos (the quality pass); every other face keeps the pipeline's generic picture
    const spec = JSON.parse(readFileSync(join('content', 'asset-specs', `${id}.json`), 'utf8')) as { build?: { photos?: { file: string }[] } }
    const specPhotos = (spec.build?.photos ?? []).map((p) => p.file)
    for (const p of row?.photos ?? []) expect(p.startsWith('_generic_') || specPhotos.includes(p), `${id}: ${p} is neither a pipeline generic picture nor a build.photos file of the spec`).toBe(true)
    const glb = join('public', 'assets', `${id}.glb`)
    expect(existsSync(glb), glb).toBe(true)
    const json = gltfJson(glb)
    expect((json.images ?? []).length, `${id}: the GLB has no image`).toBeGreaterThanOrEqual(1)
    expect((json.textures ?? []).length, `${id}: the GLB has no texture`).toBeGreaterThanOrEqual(1)
  })
})
