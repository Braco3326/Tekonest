/**
 * review-model: the model review sheet, a working file (never shipped). For each id it renders the shipped GLB from the
 * front and rear three-quarter in Blender and puts the two renders beside the best reference photos.
 *
 *   node tools/assets3d/review-model.mjs <out-dir> <id> [<id> ...]      (BLENDER_EXE, default D:\Blender\blender.exe)
 *
 * Output: <out-dir>/<id>.png. It is a human check (the founder's bar: "as if it was a real equipment from the collected photos").
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const blender = process.env.BLENDER_EXE || 'D:\Blender\blender.exe'
const [outDir, ...ids] = process.argv.slice(2)
if (!outDir || !ids.length) { console.error('usage: node review-model.mjs <out-dir> <id>...'); process.exit(1) }
mkdirSync(outDir, { recursive: true })
const PREFER = ['three-quarter', 'front', 'hero', 'main']

function photosOf(id) {
  const dir = join(root, 'assets-source', id, 'photos')
  if (!existsSync(dir)) return []
  const files = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !f.startsWith('_'))
  const rank = (f) => { const i = PREFER.findIndex((p) => f.toLowerCase().includes(p)); return i < 0 ? 9 : i }
  return files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).slice(0, 2).map((f) => join(dir, f))
}

const H = 480
for (const id of ids) {
  const glb = join(root, 'public', 'assets', `${id}.glb`)
  if (!existsSync(glb)) { console.log(`skip ${id}: no GLB`); continue }
  const tmp = join(outDir, `_${id}`)
  execFileSync(blender, ['--background', '--python', join(root, 'tools/assets3d/blender/review_render.py'), '--', glb, tmp, '720'], { stdio: 'pipe' })
  const panels = []
  for (const p of [`${tmp}_front.png`, `${tmp}_rear.png`, ...photosOf(id)]) {
    const buf = await sharp(p).resize({ height: H, width: 620, fit: 'contain', background: '#e8e8ea' }).png().toBuffer()
    panels.push(buf)
  }
  const w = 620
  await sharp({ create: { width: w * panels.length, height: H, channels: 3, background: '#e8e8ea' } })
    .composite(panels.map((input, i) => ({ input, left: i * w, top: 0 })))
    .png().toFile(join(outDir, `${id}.png`))
  rmSync(`${tmp}_front.png`, { force: true }); rmSync(`${tmp}_rear.png`, { force: true })
  console.log(`ok ${id} (${panels.length - 2} photos)`)
}
