/**
 * silhouette-profile: a revolve profile and colour zones read from a clean side photo of a round device (a microphone), so the lathe has the real silhouette.
 *
 *   node tools/assets3d/silhouette-profile.mjs <id> <photo-file-name> [--write] [--flip] [--hmm N]
 *
 * The photo (assets-source/<id>/photos/<file>) must show the device alone, upright or lying, side-on, on a transparent or white background. The mask is the alpha
 * channel (or the non-white pixels), the axis is the longer side of the mask, the scale is the spec's real height (realSizeMm.h): the photo only gives the SHAPE, never a size.
 * It prints the profile ([axial mm from the base, diameter mm], simplified to a 0.5 mm tolerance, closed by [h, 0]), the colour zones (sRGB sampled along the axis) and the
 * implied maximum diameter next to the spec's width (a gap above 12 percent means the photo is not side-on: do not write it). With --write the spec's build.profile and
 * build.colours are replaced; the generic wrap picture must then be redrawn (see wrapFromZones below, used by --write too). The end of the photo with the larger head is taken
 * as the top unless --flip. A working tool of the 3D quality pass: the photo stays private reference.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const [id, file, ...flags] = process.argv.slice(2)
if (!id || !file) { console.error('usage: node silhouette-profile.mjs <id> <photo> [--write] [--flip]'); process.exit(1) }
const specPath = join(root, 'content', 'asset-specs', `${id}.json`)
const spec = JSON.parse(readFileSync(specPath, 'utf8'))
const realH = spec.realSizeMm.h
const realW = spec.realSizeMm.w

let img = sharp(join(root, 'assets-source', id, 'photos', file)).rotate()
const meta0 = await img.metadata()
if (Math.max(meta0.width, meta0.height) > 2400) img = img.resize({ width: meta0.width >= meta0.height ? 2400 : undefined, height: meta0.height > meta0.width ? 2400 : undefined })
const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
let W = info.width, H = info.height
const px = (x, y) => (y * W + x) * 4
// mask: alpha when the photo has some transparency, else everything that is not near-white
let hasAlpha = false
for (let i = 3; i < data.length; i += 4) if (data[i] < 200) { hasAlpha = true; break }
let mask = new Uint8Array(W * H)
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const p = px(x, y)
  mask[y * W + x] = hasAlpha ? (data[p + 3] > 110 ? 1 : 0) : (data[p] < 238 || data[p + 1] < 238 || data[p + 2] < 238 ? 1 : 0)
}
// bbox
let x0 = W, x1 = -1, y0 = H, y1 = -1
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
const bw = x1 - x0 + 1, bh = y1 - y0 + 1
const horizontal = bw > bh
// rows along the axis: for an upright mic each image row; for a lying one each column
const L = horizontal ? bw : bh
const along = (i) => (horizontal ? x0 + i : y0 + i)
const widthAt = (i) => {
  let lo = 1e9, hi = -1
  const n = horizontal ? bh : bw
  for (let j = 0; j < n; j++) {
    const x = horizontal ? along(i) : x0 + j
    const y = horizontal ? y0 + j : along(i)
    if (mask[y * W + x]) { if (j < lo) lo = j; if (j > hi) hi = j }
  }
  return hi < 0 ? 0 : hi - lo + 1
}
const raw = Array.from({ length: L }, (_, i) => widthAt(i))
// median smoothing (5)
const wid = raw.map((_, i) => { const w = raw.slice(Math.max(0, i - 2), i + 3).sort((a, b) => a - b); return w[w.length >> 1] })
const scale = realH / L
let diam = wid.map((w) => w * scale)
let maxD = Math.max(...diam)
const gap = Math.abs(maxD / realW - 1)
// the top is the end with the larger head: compare the mean diameter of the first and last quarter (flip puts the larger end at the top)
const q = Math.max(1, Math.floor(L / 4))
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length
const topFirst = mean(diam.slice(0, q)) >= mean(diam.slice(L - q))      // larger end is index 0: that end is the top
let order = Array.from({ length: L }, (_, i) => i)
if (topFirst) order = order.reverse()      // order[k] = image index at axial position k (k = 0 base)
if (flags.includes('--flip')) order = order.reverse()
const prof = order.map((idx, k) => [k * scale, diam[idx]])
// Douglas-Peucker on (pos, diam) with tolerance 0.5 mm
function dp(pts, tol) {
  if (pts.length < 3) return pts
  const [a, b] = [pts[0], pts[pts.length - 1]]
  let md = -1, mi = -1
  for (let i = 1; i < pts.length - 1; i++) {
    const t = (pts[i][0] - a[0]) / (b[0] - a[0] || 1)
    const d = Math.abs(pts[i][1] - (a[1] + t * (b[1] - a[1])))
    if (d > md) { md = d; mi = i }
  }
  if (md <= tol) return [a, b]
  return [...dp(pts.slice(0, mi + 1), tol).slice(0, -1), ...dp(pts.slice(mi), tol)]
}
let simple = dp(prof.filter((p) => p[0] >= 1.5 || p[0] === 0).map((p, i, a) => (p[0] === 0 ? [0, (a[1] || p)[1]] : p)), 0.9).map(([p, d]) => [Math.round(p * 100) / 100, Math.round(Math.max(d, 0.8) * 100) / 100])
simple[0][0] = 0
simple = simple.filter((s, i) => i === 0 || s[0] > simple[i - 1][0] + 0.01)
if (simple[simple.length - 1][0] < realH - 0.05) simple.push([realH, 0])
else simple[simple.length - 1] = [realH, 0]
// width calibration to the spec: scale the diameters so the widest station equals the spec width (the photo gives the shape)
const wf = realW / Math.max(...simple.map((s) => s[1]))
const calibrated = simple.map(([p, d]) => [p, d === 0 ? 0 : Math.round(d * wf * 100) / 100])
// colours: mean sRGB of the central 40 percent of the mask width, per axial slice of 2 mm
function sample(i) {
  const n = horizontal ? bh : bw
  let lo = 1e9, hi = -1
  for (let j = 0; j < n; j++) { const x = horizontal ? along(i) : x0 + j, y = horizontal ? y0 + j : along(i); if (mask[y * W + x]) { if (j < lo) lo = j; if (j > hi) hi = j } }
  if (hi < 0) return null
  const c = (lo + hi) / 2, half = (hi - lo) * 0.2
  let r = 0, g = 0, b = 0, cnt = 0
  const lum = []
  for (let j = Math.round(c - half); j <= Math.round(c + half); j++) {
    const x = horizontal ? along(i) : x0 + j, y = horizontal ? y0 + j : along(i)
    const p = px(x, y); r += data[p]; g += data[p + 1]; b += data[p + 2]; cnt++; lum.push(0.3 * data[p] + 0.59 * data[p + 1] + 0.11 * data[p + 2])
  }
  const m = mean(lum)
  return { rgb: [r / cnt, g / cnt, b / cnt], energy: Math.sqrt(mean(lum.map((v) => (v - m) ** 2))) }
}
const slices = []
const step = Math.max(1, Math.round(2 / scale))
for (let k = 0; k < L; k += step) {
  const s = sample(order[Math.min(L - 1, k)])
  if (s) slices.push({ pos: k * scale, ...s })
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const zones = []
for (const s of slices) {
  const last = zones[zones.length - 1]
  if (!last || dist(last.rgb, s.rgb) > 38) zones.push({ from: s.pos, rgb: s.rgb.slice(), n: 1, energy: s.energy })
  else { last.rgb = last.rgb.map((v, i) => (v * last.n + s.rgb[i]) / (last.n + 1)); last.energy = (last.energy * last.n + s.energy) / (last.n + 1); last.n++ }
}
const merged = zones.filter((z, i) => i === 0 || z.n * 2 >= 6)
// the builder (and the photo step) lift every colour for Mode Création's dim lights: linear max(v, min(0.85, 3v + 0.012)); the colour written to the spec is the inverse, so that the lifted result is the photo's colour
const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const toSrgb8 = (v) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))
const unlift = (c) => { const v = toLin(c); if (v >= 0.85) return c; return toSrgb8(Math.max(0, (v - 0.012) / 3)) }
const hex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(unlift(Math.max(0, Math.min(255, v)))))).toString(16).padStart(2, '0')).join('')
const colours = merged.map((z, i) => ({ fromMm: i === 0 ? 0 : Math.round(z.from * 10) / 10, colour: hex(z.rgb) }))
// strictly increasing
const cols = colours.filter((c, i) => i === 0 || c.fromMm > colours[i - 1].fromMm)
const out = { id, photo: file, horizontal, topFirst, scaleMmPerPx: +scale.toFixed(4), impliedMaxDiameterMm: +maxD.toFixed(1), specWidthMm: realW, gapPercent: +(gap * 100).toFixed(1), stations: calibrated.length, profile: calibrated, colours: cols, zonesEnergy: merged.map((z) => ({ from: +z.from.toFixed(1), energy: +z.energy.toFixed(1) })) }
console.log(JSON.stringify(out))
if (flags.includes('--write')) {
  if (gap > 0.12) { console.error(`refused: the photo's widest part is ${(gap * 100).toFixed(1)} % off the spec width (not side-on?)`); process.exit(2) }
  spec.build.profile = calibrated
  spec.build.colours = cols
  writeFileSync(specPath, JSON.stringify(spec, null, 2) + '\n')
  // the generic wrap picture is redrawn from the zones: a flat rectangle per zone, a metal mesh where the zone is textured (high local contrast), a dark ring at each boundary
  const panelPath = join(root, 'content', 'generic-panels', `${id}.json`)
  const panel = JSON.parse(readFileSync(panelPath, 'utf8'))
  const wrap = panel.faces.wrap
  const shade = (rgb, k) => hex(rgb.map((v) => v * k))
  wrap.hMm = realH
  wrap.base = hex(merged[0].rgb)
  wrap.items = []
  merged.forEach((z, i) => {
    const to = i + 1 < merged.length ? merged[i + 1].from : realH
    const y = +z.from.toFixed(2)
    const h = +(to - z.from).toFixed(2)
    wrap.items.push({ kind: 'rect', x: 0, y, w: wrap.wMm, h, fill: hex(z.rgb) })
    if (z.energy > 45) wrap.items.push({ kind: 'weave', x: 0, y, w: wrap.wMm, h, pitch: 1.5, line: 0.3, fill: shade(z.rgb, 1.35), stroke: shade(z.rgb, 0.7), hole: shade(z.rgb, 0.35) })
    if (i > 0) wrap.items.push({ kind: 'rect', x: 0, y: +(z.from - 0.5).toFixed(2), w: wrap.wMm, h: 1, fill: shade(merged[0].rgb, 0.6) })
  })
  writeFileSync(panelPath, JSON.stringify(panel, null, 2) + '\n')
  console.error(`wrote ${id}: ${calibrated.length} profile stations, ${cols.length} colour zones`)
}
