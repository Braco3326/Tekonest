/**
 * photo-fit-scan: for each catalogue device, which of its reference photos can be projected straight onto a face of the scripted shape
 * (the product's trimmed aspect within the photoProjection tolerance of the face). A read-only working tool of the quality pass.
 *
 *   npx tsx tools/assets3d/photo-fit-scan.ts [id ...]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { photoProjection } from './photoProjection'
import type { ProjectionFace } from './projection'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const catalog = JSON.parse(readFileSync(join(root, 'content/catalog.json'), 'utf8'))
const ids: string[] = process.argv.slice(2).length ? process.argv.slice(2) : catalog.devices.map((d: { id: string }) => d.id)
const FACES: ProjectionFace[] = ['opposite', 'top', 'io', 'left']
async function main(): Promise<void> {
for (const id of ids) {
  const specFile = join(root, 'content/asset-specs', `${id}.json`)
  if (!existsSync(specFile)) continue
  const spec = JSON.parse(readFileSync(specFile, 'utf8'))
  const dir = join(root, 'assets-source', id, 'photos')
  const photos = existsSync(dir) ? readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !f.startsWith('_')) : []
  const hits: string[] = []
  for (const p of photos) {
    for (const face of FACES) {
      try {
        await photoProjection(join(dir, p), face, spec.realSizeMm)
        hits.push(`${p}->${face}`)
      } catch (e) {
        /* not straight-on for this face */
      }
    }
  }
  console.log(`${id}\t${spec.build?.shape ?? '-'}\t${photos.length}\t${hits.join(' ') || '(none fit)'}`)
}
}
void main()
