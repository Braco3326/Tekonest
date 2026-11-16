/**
 * review-compare: one image per view with the BEFORE model, the AFTER model and (optionally) the source photo side by side, rendered from the same camera.
 *
 *   node tools/assets3d/review-compare.mjs <out-dir> <id> <before.glb> <after.glb> "<views>" [photo-file] [size-px]
 *
 * crop (optional): the region of the PHOTO to show, "left,top,width,height" as fractions: always crop the photo to the same spot as a close-up view.
 * views as in review-views.mjs (name:azimuth:elevation:zoom[:fx:fy:fz];...). Output <out-dir>/<id>_<view>_compare.png. Working files, never shipped.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const blender = process.env.BLENDER_EXE || 'D:\Blender\blender.exe'
const [outDir, id, before, after, views, photo, size = '800', crop] = process.argv.slice(2) // crop = "left,top,width,height" as fractions of the photo: the region the close-up shows
if (!outDir || !id || !before || !after || !views) { console.error('usage: node review-compare.mjs <out-dir> <id> <before.glb> <after.glb> "<views>" [photo] [size]'); process.exit(1) }
mkdirSync(outDir, { recursive: true })
const script = join(root, 'tools/assets3d/blender/review_render.py')
const tmpB = join(outDir, `_b_${id}`)
const tmpA = join(outDir, `_a_${id}`)
execFileSync(blender, ['--background', '--python', script, '--', before, tmpB, size, views], { stdio: 'pipe' })
execFileSync(blender, ['--background', '--python', script, '--', after, tmpA, size, views], { stdio: 'pipe' })
const H = Math.round(Number(size) * 0.78)
const label = (t) => Buffer.from(`<svg width="${size}" height="28"><rect width="100%" height="28" fill="#222"/><text x="8" y="19" font-size="16" fill="#fff" font-family="Arial">${t}</text></svg>`)
for (const v of views.split(';').map((s) => s.split(':')[0])) {
  const panels = [['BEFORE (deployed)', `${tmpB}_${v}.png`], ['AFTER (structure rebuild)', `${tmpA}_${v}.png`]]
  const comps = []
  let col = 0
  if (photo) { panels.unshift(['PHOTO', photo]) }
  for (const [name, file] of panels) {
    let src = sharp(file)
    if (crop && name === 'PHOTO') {
      const m = await sharp(file).metadata()
      const [cl, ct, cw, ch] = crop.split(',').map(Number)
      src = sharp(file).extract({ left: Math.round(cl * m.width), top: Math.round(ct * m.height), width: Math.round(cw * m.width), height: Math.round(ch * m.height) })
    }
    const img = await src.resize({ width: Number(size), height: H, fit: 'contain', background: '#e8e8ea' }).png().toBuffer()
    comps.push({ input: img, left: col * Number(size), top: 28 }, { input: label(name), left: col * Number(size), top: 0 })
    col++
  }
  await sharp({ create: { width: Number(size) * col, height: H + 28, channels: 3, background: '#222' } }).composite(comps).png().toFile(join(outDir, `${id}_${v}_compare.png`))
  rmSync(`${tmpB}_${v}.png`, { force: true }); rmSync(`${tmpA}_${v}.png`, { force: true })
}
console.log(`ok ${id}`)
