/**
 * assets3d/blank: removes brand text and logos from a textured (Meshy) model by HEIGHT or by RECTANGLE ON A FACE.
 *
 * A Meshy colour map is a shattered atlas of tiny islands, so a logo cannot be found (or painted over) in the image. The model
 * can: its faces at a given height are the faces that carry the printing there, and their UV triangles say which texels belong to
 * them. `blankBands` repaints those texels, for every band `{ fromMm, toMm, fill? }` (millimetres from the base, the model standing
 * upright with its pivot at the bottom-centre, as after the fix-up), with `fill` (#rrggbb) or, by default, the median colour of the
 * faces just outside the band (a text band on a handle takes the handle's colour).
 *  - a band that covers no face throws (a silent no-op would ship the logo);
 *  - an automatic fill with no face just outside the band to sample throws;
 *  - the texels are repainted with a one-pixel margin so no edge of the old printing survives the later downscale.
 * A rectangle { face, xMm, yMm, wMm, hMm, depthMm?, marginMm?, fill? } is in the spec's face-local millimetres (origin bottom-left seen
 * from outside, x right, y up, as the ports): it covers the faces whose centroid projects into it on that face and lies at most depthMm
 * (default 40, at most 40 percent of the thickness) behind the face plane, so a logo on a recessed amp plate is found too. The automatic fill samples the faces within
 * marginMm (default 8) around it. The model's size is measured from its own bounding box.
 * Runs on the fixed-up GLB (positions final, texture still full size), before the look and texture steps. An empty band list
 * returns the very same bytes. Deterministic.
 */
// sharp MUST be imported before @gltf-transform (see compress.ts).
import sharp from 'sharp'
import { NodeIO } from '@gltf-transform/core'
import type { Primitive, Texture } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

export interface Band {
  fromMm: number
  toMm: number
  /** '#rrggbb'; absent = the median colour of the faces just outside the band. */
  fill?: string
}

export type RectFace = 'io' | 'opposite' | 'top' | 'bottom' | 'left' | 'right'

export interface Rect {
  face: RectFace
  xMm: number
  yMm: number
  wMm: number
  hMm: number
  /** How far behind the face plane a covered face may lie, in mm (default 40, at most 40 percent of the casing thickness). */
  depthMm?: number
  /** Width of the ring around the rectangle that the automatic fill samples, in mm (default 8). */
  marginMm?: number
  fill?: string
}

/** How far outside a band (mm) the faces sampled for the automatic fill may lie. */
const SAMPLE_MARGIN_MM = 8

type Rgb = [number, number, number]

interface Tri {
  /** UV corners in pixels. */
  px: [number, number][]
  /** World centroid in millimetres. */
  xMm: number
  yMm: number
  zMm: number
}

/** A region of the model: the faces to repaint and the faces around them to sample the automatic fill from. */
interface Region {
  label: string
  fill?: string
  inside: (t: Tri) => boolean
  ring: (t: Tri) => boolean
}

/** Triangles of a primitive with their centroid height (world, mm) and UV corners in pixels of `tex`. */
function triangles(prim: Primitive, world: ArrayLike<number>, w: number, h: number, bounds: { lo: number[]; hi: number[] }): Tri[] {
  const pos = prim.getAttribute('POSITION')
  const uv = prim.getAttribute('TEXCOORD_0')
  if (!pos) return []
  if (!uv) throw new Error('blankBands: the model has no TEXCOORD_0, so its texture cannot be repainted')
  const idx = prim.getIndices()
  const count = idx ? idx.getCount() : pos.getCount()
  const out: Tri[] = []
  const p = [0, 0, 0]
  const q = [0, 0]
  for (let t = 0; t + 2 < count; t += 3) {
    let x = 0
    let y = 0
    let z = 0
    const px: [number, number][] = []
    for (let k = 0; k < 3; k++) {
      const i = idx ? idx.getScalar(t + k) : t + k
      pos.getElement(i, p)
      // world position of the vertex (column-major 4x4 matrix)
      const vx = world[0] * p[0] + world[4] * p[1] + world[8] * p[2] + world[12]
      const vy = world[1] * p[0] + world[5] * p[1] + world[9] * p[2] + world[13]
      const vz = world[2] * p[0] + world[6] * p[1] + world[10] * p[2] + world[14]
      x += vx
      y += vy
      z += vz
      for (const [a, v] of [[0, vx], [1, vy], [2, vz]] as [number, number][]) {
        bounds.lo[a] = Math.min(bounds.lo[a], v * 1000)
        bounds.hi[a] = Math.max(bounds.hi[a], v * 1000)
      }
      uv.getElement(i, q)
      px.push([q[0] * w, q[1] * h])
    }
    out.push({ px, xMm: (x / 3) * 1000, yMm: (y / 3) * 1000, zMm: (z / 3) * 1000 })
  }
  return out
}

/** Calls `visit(x, y)` for every pixel whose centre lies in the triangle (barycentric test, small tolerance). */
function rasterise(tri: [number, number][], w: number, h: number, visit: (x: number, y: number) => void): void {
  const [a, b, c] = tri
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])))
  const maxX = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0])))
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])))
  const maxY = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])))
  const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
  if (Math.abs(det) < 1e-9) return
  const eps = -0.02
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / det
      const l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / det
      const l3 = 1 - l1 - l2
      if (l1 >= eps && l2 >= eps && l3 >= eps) visit(x, y)
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
      inside: (t) => t.yMm >= band.fromMm && t.yMm <= band.toMm,
      ring: (t) => (t.yMm < band.fromMm && t.yMm >= band.fromMm - SAMPLE_MARGIN_MM) || (t.yMm > band.toMm && t.yMm <= band.toMm + SAMPLE_MARGIN_MM),
    })),
    ...rects.map((r): Region => {
      // default: 40 mm behind the face, but never more than 40 percent of the casing's thickness there (a thin unit's far face is not this face)
      const thickness = r.face === 'io' || r.face === 'opposite' ? d : r.face === 'top' || r.face === 'bottom' ? h : w
      const depthMax = r.depthMm ?? Math.min(40, 0.4 * thickness)
      const margin = r.marginMm ?? SAMPLE_MARGIN_MM
      const local = (t: Tri) => faceLocal(r.face, t.xMm - cx, t.yMm - lo[1], t.zMm - cz, w, h, d)
      const within = (t: Tri, grow: number): boolean => {
        const l = local(t)
        return l.depth <= depthMax && l.depth >= -2 && l.u >= r.xMm - grow && l.u <= r.xMm + r.wMm + grow && l.v >= r.yMm - grow && l.v <= r.yMm + r.hMm + grow
      }
      return { label: `the ${r.face} rectangle ${r.xMm},${r.yMm} ${r.wMm}x${r.hMm} mm`, fill: r.fill, inside: (t) => within(t, 0), ring: (t) => within(t, margin) && !within(t, 0) }
    }),
  ]

  const covered = new Array<number>(regions.length).fill(0)
  for (const [tex, tris] of byTexture) {
    const [w, h] = tex.getSize() as [number, number]
    const { data } = await sharp(Buffer.from(tex.getImage() as Uint8Array)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (let bi = 0; bi < regions.length; bi++) {
      const region = regions[bi]
      const inside = tris.filter(region.inside)
      covered[bi] += inside.length
      if (inside.length === 0) continue
      let colour: Rgb
      if (region.fill !== undefined) colour = hexToRgb(region.fill)
      else {
        const ring = tris.filter(region.ring)
        if (ring.length === 0) throw new Error(`blankBands: no faces around ${region.label} to take the fill colour from; give a fill`)
        const r: number[] = []
        const g: number[] = []
        const b: number[] = []
        for (const t of ring) {
          rasterise(t.px, w, h, (x, y) => {
            const o = (y * w + x) * 4
            r.push(data[o])
            g.push(data[o + 1])
            b.push(data[o + 2])
          })
        }
        if (r.length === 0) throw new Error(`blankBands: the faces around ${region.label} cover no texel to take the fill colour from; give a fill`)
        colour = [median(r), median(g), median(b)]
      }
      // The band's texels, grown by one pixel.
      const mask = new Uint8Array(w * h)
      for (const t of inside) rasterise(t.px, w, h, (x, y) => (mask[y * w + x] = 1))
      const grown = Uint8Array.from(mask)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (!mask[y * w + x]) continue
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx >= 0 && ny >= 0 && nx < w && ny < h) grown[ny * w + nx] = 1
          }
        }
      }
      for (let i = 0; i < w * h; i++) {
        if (!grown[i]) continue
        data[i * 4] = colour[0]
        data[i * 4 + 1] = colour[1]
        data[i * 4 + 2] = colour[2]
      }
    }
    const png = await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer()
    tex.setImage(new Uint8Array(png)).setMimeType('image/png')
  }
  covered.forEach((n, bi) => {
    if (n === 0) throw new Error(`blankBands: ${regions[bi].label} covers no face of the model`)
  })
  return io.writeBinary(doc)
}
