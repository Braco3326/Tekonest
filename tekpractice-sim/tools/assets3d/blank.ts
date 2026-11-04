/**
 * assets3d/blank: removes brand text and logos from a textured (Meshy) model by HEIGHT or by RECTANGLE ON A FACE.
 *
 * A Meshy colour map is a shattered atlas of tiny islands, so a logo cannot be found (or painted over) in the image. The model
 * can: every texel of the map belongs to a triangle, and a triangle's UV corners and 3D corners give the 3D position of each of its
 * texels (barycentric interpolation). `blankBands` repaints the texels whose 3D position lies in a region, so a logo printed on one
 * big flat triangle is removed exactly, whatever the triangle's centre is:
 *  - a band `{ fromMm, toMm, fill? }`: millimetres from the base, the model standing upright with its pivot at the bottom-centre,
 *    as after the fix-up;
 *  - a rectangle `{ face, xMm, yMm, wMm, hMm, depthMm?, marginMm?, fill? }` in the spec's face-local millimetres (origin
 *    bottom-left seen from outside, x right, y up, as the ports) on that face, at most `depthMm` (default 40, and at most 40
 *    percent of the casing thickness there) behind the face plane, so a logo on a recessed amp plate is found too.
 * `fill` is '#rrggbb' or, by default, the median colour of the texels just around the region (a band: 8 mm above and below;
 * a rectangle: `marginMm`, default 8). The model's size is measured from its own vertices.
 *  - a region that covers no texel throws (a silent no-op would ship the logo); so does an automatic fill with nothing around the
 *    region to sample;
 *  - the repainted texels are grown by one pixel so no edge of the old printing survives the later downscale.
 * Runs on the fixed-up GLB (positions final, texture still full size), before the look and texture steps. No region returns the very
 * same bytes. Deterministic.
 */
// sharp MUST be imported before @gltf-transform (see compress.ts).
import sharp from 'sharp'
import { NodeIO } from '@gltf-transform/core'
import type { Primitive, Texture } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

export interface Band {
  fromMm: number
  toMm: number
  /** '#rrggbb'; absent = the median colour of the texels just outside the band. */
  fill?: string
}

export type RectFace = 'io' | 'opposite' | 'top' | 'bottom' | 'left' | 'right'

export interface Rect {
  face: RectFace
  xMm: number
  yMm: number
  wMm: number
  hMm: number
  /** How far behind the face plane a covered point may lie, in mm (default 40, at most 40 percent of the casing thickness). */
  depthMm?: number
  /** Width of the ring around the rectangle that the automatic fill samples, in mm (default 8). */
  marginMm?: number
  fill?: string
}

/** How far outside a band (mm) the texels sampled for the automatic fill may lie. */
const SAMPLE_MARGIN_MM = 8

type Rgb = [number, number, number]
type P3 = [number, number, number]

interface Tri {
  /** UV corners in pixels. */
  px: [number, number][]
  /** 3D corners in millimetres (world, after the node transforms). */
  p: P3[]
}

/** A region of the model: which 3D points are repainted and which are sampled for the automatic fill. */
interface Region {
  label: string
  fill?: string
  /** true = repaint, false = not. */
  inside: (p: P3) => boolean
  /** true = a texel to sample the automatic fill from (just around the region). */
  ring: (p: P3) => boolean
  /** Can the triangle possibly touch the region or its ring? (a cheap pre-filter on the triangle's corners) */
  near: (t: Tri) => boolean
}

/** Triangles of a primitive with their UV corners in pixels of the texture and 3D corners in mm; `bounds` collects the vertex extents. */
function triangles(prim: Primitive, world: ArrayLike<number>, w: number, h: number, bounds: { lo: number[]; hi: number[] }): Tri[] {
  const pos = prim.getAttribute('POSITION')
  const uv = prim.getAttribute('TEXCOORD_0')
  if (!pos) return []
  if (!uv) throw new Error('blankBands: the model has no TEXCOORD_0, so its texture cannot be repainted')
  const idx = prim.getIndices()
  const count = idx ? idx.getCount() : pos.getCount()
  const out: Tri[] = []
  const v = [0, 0, 0]
  const q = [0, 0]
  for (let t = 0; t + 2 < count; t += 3) {
    const px: [number, number][] = []
    const p: P3[] = []
    for (let k = 0; k < 3; k++) {
      const i = idx ? idx.getScalar(t + k) : t + k
      pos.getElement(i, v)
      const wp: P3 = [
        (world[0] * v[0] + world[4] * v[1] + world[8] * v[2] + world[12]) * 1000,
        (world[1] * v[0] + world[5] * v[1] + world[9] * v[2] + world[13]) * 1000,
        (world[2] * v[0] + world[6] * v[1] + world[10] * v[2] + world[14]) * 1000,
      ]
      for (let a = 0; a < 3; a++) {
        bounds.lo[a] = Math.min(bounds.lo[a], wp[a])
        bounds.hi[a] = Math.max(bounds.hi[a], wp[a])
      }
      p.push(wp)
      uv.getElement(i, q)
      px.push([q[0] * w, q[1] * h])
    }
    out.push({ px, p })
  }
  return out
}

/** Calls `visit(x, y, point)` for every pixel whose centre lies in the triangle, with the pixel's interpolated 3D point. */
function rasterise(tri: Tri, w: number, h: number, visit: (x: number, y: number, point: P3) => void): void {
  const [a, b, c] = tri.px
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])))
  const maxX = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0])))
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])))
  const maxY = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])))
  const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
  if (Math.abs(det) < 1e-9) return
  const eps = -0.02
  const [pa, pb, pc] = tri.p
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / det
      const l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / det
      const l3 = 1 - l1 - l2
      if (l1 >= eps && l2 >= eps && l3 >= eps) {
        visit(x, y, [l1 * pa[0] + l2 * pb[0] + l3 * pc[0], l1 * pa[1] + l2 * pb[1] + l3 * pc[1], l1 * pa[2] + l2 * pb[2] + l3 * pc[2]])
      }
    }
  }
}

function hexToRgb(hex: string): Rgb {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) throw new Error(`blankBands: fill must be #rrggbb, got ${hex}`)
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const median = (v: number[]): number => {
  const s = [...v].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}

/** Face-local coordinates (mm) of a point on `face` of a casing w x h x d (pivot bottom-centre, x and z centred), and how far behind the face plane it lies. */
function faceLocal(face: RectFace, x: number, y: number, z: number, w: number, h: number, d: number): { u: number; v: number; depth: number } {
  switch (face) {
    case 'io': return { u: x + w / 2, v: y, depth: d / 2 - z }
    case 'opposite': return { u: w / 2 - x, v: y, depth: z + d / 2 }
    case 'top': return { u: x + w / 2, v: d / 2 - z, depth: h - y }
    case 'bottom': return { u: w / 2 - x, v: d / 2 - z, depth: y }
    case 'left': return { u: z + d / 2, v: y, depth: x + w / 2 }
    case 'right': return { u: d / 2 - z, v: y, depth: w / 2 - x }
  }
}

/** Returns `bytes` with the colour map repainted inside every band and rectangle (see the file header). */
export async function blankBands(bytes: Uint8Array, bands: Band[], rects: Rect[] = []): Promise<Uint8Array> {
  if (bands.length === 0 && rects.length === 0) return bytes
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const doc = await io.readBinary(bytes)

  // Group the triangles by the colour map they sample; `bounds` collects the model's vertex extents (mm).
  const bounds = { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] }
  const byTexture = new Map<Texture, Tri[]>()
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const world = node.getWorldMatrix()
    for (const prim of mesh.listPrimitives()) {
      const tex = prim.getMaterial()?.getBaseColorTexture()
      if (!tex || !tex.getImage()) continue
      const [w, h] = tex.getSize() ?? [0, 0]
      if (w === 0) continue
      const list = byTexture.get(tex) ?? []
      list.push(...triangles(prim, world, w, h, bounds))
      byTexture.set(tex, list)
    }
  }
  if (byTexture.size === 0) throw new Error('blankBands: the model has no colour map to repaint')

  // The model's size, from its own vertices (the fix-up made it the spec size, pivot bottom-centre).
  const { lo, hi } = bounds
  const [w, h, d] = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]]
  const cx = (lo[0] + hi[0]) / 2
  const cz = (lo[2] + hi[2]) / 2

  const regions: Region[] = [
    ...bands.map((band): Region => ({
      label: `the band ${band.fromMm}-${band.toMm} mm`,
      fill: band.fill,
      inside: (p) => p[1] >= band.fromMm && p[1] <= band.toMm,
      ring: (p) => (p[1] < band.fromMm && p[1] >= band.fromMm - SAMPLE_MARGIN_MM) || (p[1] > band.toMm && p[1] <= band.toMm + SAMPLE_MARGIN_MM),
      near: (t) => Math.max(t.p[0][1], t.p[1][1], t.p[2][1]) >= band.fromMm - SAMPLE_MARGIN_MM && Math.min(t.p[0][1], t.p[1][1], t.p[2][1]) <= band.toMm + SAMPLE_MARGIN_MM,
    })),
    ...rects.map((r): Region => {
      // default: 40 mm behind the face, but never more than 40 percent of the casing's thickness there (a thin unit's far face is not this face)
      const thickness = r.face === 'io' || r.face === 'opposite' ? d : r.face === 'top' || r.face === 'bottom' ? h : w
      const depthMax = r.depthMm ?? Math.min(40, 0.4 * thickness)
      const margin = r.marginMm ?? SAMPLE_MARGIN_MM
      const local = (p: P3) => faceLocal(r.face, p[0] - cx, p[1] - lo[1], p[2] - cz, w, h, d)
      const within = (p: P3, grow: number): boolean => {
        const l = local(p)
        return l.depth <= depthMax && l.depth >= -2 && l.u >= r.xMm - grow && l.u <= r.xMm + r.wMm + grow && l.v >= r.yMm - grow && l.v <= r.yMm + r.hMm + grow
      }
      return {
        label: `the ${r.face} rectangle ${r.xMm},${r.yMm} ${r.wMm}x${r.hMm} mm`,
        fill: r.fill,
        inside: (p) => within(p, 0),
        ring: (p) => within(p, margin) && !within(p, 0),
        // a triangle can reach the rectangle if its face-local extent overlaps the rectangle grown by the margin
        near: (t) => {
          const ls = t.p.map(local)
          const uMin = Math.min(...ls.map((l) => l.u))
          const uMax = Math.max(...ls.map((l) => l.u))
          const vMin = Math.min(...ls.map((l) => l.v))
          const vMax = Math.max(...ls.map((l) => l.v))
          const dMin = Math.min(...ls.map((l) => l.depth))
          return dMin <= depthMax && uMax >= r.xMm - margin && uMin <= r.xMm + r.wMm + margin && vMax >= r.yMm - margin && vMin <= r.yMm + r.hMm + margin
        },
      }
    }),
  ]

  const covered = new Array<number>(regions.length).fill(0)
  for (const [tex, tris] of byTexture) {
    const [tw, th] = tex.getSize() as [number, number]
    const { data } = await sharp(Buffer.from(tex.getImage() as Uint8Array)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    // Sample colours come from the ORIGINAL pixels, so one region's repaint never feeds another's automatic fill.
    const original = Uint8Array.from(data)
    for (let ri = 0; ri < regions.length; ri++) {
      const region = regions[ri]
      const near = tris.filter(region.near)
      const mask = new Uint8Array(tw * th)
      let any = false
      for (const t of near) {
        rasterise(t, tw, th, (x, y, p) => {
          if (region.inside(p)) {
            mask[y * tw + x] = 1
            any = true
          }
        })
      }
      if (!any) continue
      covered[ri]++
      let colour: Rgb
      if (region.fill !== undefined) colour = hexToRgb(region.fill)
      else {
        const r: number[] = []
        const g: number[] = []
        const b: number[] = []
        for (const t of near) {
          rasterise(t, tw, th, (x, y, p) => {
            if (!region.ring(p) || mask[y * tw + x]) return
            const o = (y * tw + x) * 4
            r.push(original[o])
            g.push(original[o + 1])
            b.push(original[o + 2])
          })
        }
        if (r.length === 0) throw new Error(`blankBands: no texels around ${region.label} to take the fill colour from; give a fill`)
        colour = [median(r), median(g), median(b)]
      }
      // The region's texels, grown by one pixel.
      const grown = Uint8Array.from(mask)
      for (let y = 0; y < th; y++) {
        for (let x = 0; x < tw; x++) {
          if (!mask[y * tw + x]) continue
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx >= 0 && ny >= 0 && nx < tw && ny < th) grown[ny * tw + nx] = 1
          }
        }
      }
      for (let i = 0; i < tw * th; i++) {
        if (!grown[i]) continue
        data[i * 4] = colour[0]
        data[i * 4 + 1] = colour[1]
        data[i * 4 + 2] = colour[2]
      }
    }
    const png = await sharp(data, { raw: { width: tw, height: th, channels: 4 } }).png().toBuffer()
    tex.setImage(new Uint8Array(png)).setMimeType('image/png')
  }
  covered.forEach((n, ri) => {
    if (n === 0) throw new Error(`blankBands: ${regions[ri].label} covers no texel of the model`)
  })
  return io.writeBinary(doc)
}
