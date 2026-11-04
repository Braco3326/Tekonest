/**
 * assets3d/blank: removes brand text and logos from a textured (Meshy) model by HEIGHT.
 *
 * A Meshy colour map is a shattered atlas of tiny islands, so a logo cannot be found (or painted over) in the image. The model
 * can: its faces at a given height are the faces that carry the printing there, and their UV triangles say which texels belong to
 * them. `blankBands` repaints those texels, for every band `{ fromMm, toMm, fill? }` (millimetres from the base, the model standing
 * upright with its pivot at the bottom-centre, as after the fix-up), with `fill` (#rrggbb) or, by default, the median colour of the
 * faces just outside the band (a text band on a handle takes the handle's colour).
 *  - a band that covers no face throws (a silent no-op would ship the logo);
 *  - an automatic fill with no face just outside the band to sample throws;
 *  - the texels are repainted with a one-pixel margin so no edge of the old printing survives the later downscale.
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

/** How far outside a band (mm) the faces sampled for the automatic fill may lie. */
const SAMPLE_MARGIN_MM = 8

type Rgb = [number, number, number]

interface Tri {
  /** UV corners in pixels. */
  px: [number, number][]
  yMm: number
}

/** Triangles of a primitive with their centroid height (world, mm) and UV corners in pixels of `tex`. */
function triangles(prim: Primitive, world: ArrayLike<number>, w: number, h: number): Tri[] {
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
    let y = 0
    const px: [number, number][] = []
    for (let k = 0; k < 3; k++) {
      const i = idx ? idx.getScalar(t + k) : t + k
      pos.getElement(i, p)
      // world y of the vertex (column-major 4x4 matrix)
      y += world[1] * p[0] + world[5] * p[1] + world[9] * p[2] + world[13]
      uv.getElement(i, q)
      px.push([q[0] * w, q[1] * h])
    }
    out.push({ px, yMm: (y / 3) * 1000 })
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

/** Returns `bytes` with the colour map repainted inside every band (see the file header). */
export async function blankBands(bytes: Uint8Array, bands: Band[]): Promise<Uint8Array> {
  if (bands.length === 0) return bytes
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const doc = await io.readBinary(bytes)

  // Group the triangles by the colour map they sample.
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
      list.push(...triangles(prim, world, w, h))
      byTexture.set(tex, list)
    }
  }
  if (byTexture.size === 0) throw new Error('blankBands: the model has no colour map to repaint')

  const covered = new Array<number>(bands.length).fill(0)
  for (const [tex, tris] of byTexture) {
    const [w, h] = tex.getSize() as [number, number]
    const { data } = await sharp(Buffer.from(tex.getImage() as Uint8Array)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (let bi = 0; bi < bands.length; bi++) {
      const band = bands[bi]
      const inside = tris.filter((t) => t.yMm >= band.fromMm && t.yMm <= band.toMm)
      covered[bi] += inside.length
      if (inside.length === 0) continue
      let colour: Rgb
      if (band.fill !== undefined) colour = hexToRgb(band.fill)
      else {
        const ring = tris.filter(
          (t) => (t.yMm < band.fromMm && t.yMm >= band.fromMm - SAMPLE_MARGIN_MM) || (t.yMm > band.toMm && t.yMm <= band.toMm + SAMPLE_MARGIN_MM),
        )
        if (ring.length === 0) throw new Error(`blankBands: no faces around the band ${band.fromMm}-${band.toMm} mm to take the fill colour from; give a fill`)
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
        if (r.length === 0) throw new Error(`blankBands: the faces around the band ${band.fromMm}-${band.toMm} mm cover no texel to take the fill colour from; give a fill`)
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
    if (n === 0) throw new Error(`blankBands: the band ${bands[bi].fromMm}-${bands[bi].toMm} mm covers no face of the model`)
  })
  return io.writeBinary(doc)
}
