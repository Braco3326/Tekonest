/**
 * review-views: large renders of one model from chosen angles, to put beside a source photo taken from the same angle (the review gate of the structure rebuild).
 *
 *   node tools/assets3d/review-views.mjs <out-dir> <id>[@model.glb] "<name>:<azimuth>:<elevation>:<zoom>[:fx:fy:fz];..." [size-px]
 *
 * azimuth 215 = the front (the face opposite the io face), 35 = the io (rear) face, 125 / 305 = the sides; elevation in degrees; zoom 1 = the whole model, 0.4 = a
 * close-up of the point (fx, fy, fz) given as fractions of the bounding box in Blender axes (x right, y = depth towards the rear, z up). Default size 1100 px.
 * Output: <out-dir>/<id>_<name>.png. A working file, never shipped.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const blender = process.env.BLENDER_EXE || 'D:\Blender\blender.exe'
const [outDir, arg, views, size = '1100'] = process.argv.slice(2)
if (!outDir || !arg || !views) { console.error('usage: node review-views.mjs <out-dir> <id>[@model.glb] "<views>" [size]'); process.exit(1) }
mkdirSync(outDir, { recursive: true })
const [id, glbArg] = arg.split('@')
const glb = glbArg || join(root, 'public', 'assets', `${id}.glb`)
execFileSync(blender, ['--background', '--python', join(root, 'tools/assets3d/blender/review_render.py'), '--', glb, join(outDir, id), size, views], { stdio: 'pipe' })
console.log(`ok ${id}: ${views.split(';').map((v) => v.split(':')[0]).join(', ')}`)
