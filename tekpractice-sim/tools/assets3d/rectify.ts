/**
 * assets3d/rectify: straightens a quadrilateral of a perspective photo into a flat rectangular picture.
 *
 * Most official product photos are not straight-on: a console is shot from the front and above, a rack unit from a 3/4 angle. The hybrid route maps a flat
 * picture of each face onto our exact shape, so such a photo is first rectified: the four corners of the face as they appear in the photo (top-left,
 * top-right, bottom-right, bottom-left, in the picture's own up direction) are mapped by a homography onto a W x H rectangle, sampled bilinearly.
 *
 *   npm run asset:rectify -- <photo> <x1,y1,x2,y2,x3,y3,x4,y4> <outW> <outH> <out.png>
 *
 * Pure over bytes apart from the CLI: `rectifyQuad` takes and returns PNG bytes.
 */
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

type Pt = [number, number]
export type Quad = [Pt, Pt, Pt, Pt]

/**
 * The 3x3 homography (row-major, h[8] = 1) that maps each point of `src` onto the point of `dst` with the same index: u = (h0 x + h1 y + h2) / (h6 x + h7 y + 1),
 * v = (h3 x + h4 y + h5) / (h6 x + h7 y + 1). Throws on four points that do not determine a unique mapping (collinear or repeated).
 */
export function solveHomography(src: Pt[], dst: Pt[]): number[] {
  if (src.length !== 4 || dst.length !== 4) throw new Error('solveHomography needs four points on each side')
  // 8 unknowns h0..h7: for each pair, two rows of the linear system A h = b
  const a: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]
    const [u, v] = dst[i]
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    b.push(u)
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    b.push(v)
  }
  // Gauss elimination with partial pivoting
  const n = 8
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r
    if (Math.abs(a[piv][col]) < 1e-9) throw new Error('solveHomography: the four points are degenerate (collinear or repeated), there is no unique mapping')
    ;[a[col], a[piv]] = [a[piv], a[col]]
    ;[b[col], b[piv]] = [b[piv], b[col]]
    for (let r = col + 1; r < n; r++) {
      const f = a[r][col] / a[col][col]
      for (let c = col; c < n; c++) a[r][c] -= f * a[col][c]
      b[r] -= f * b[col]
    }
  }
  const h = new Array<number>(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]
    for (let c = r + 1; c < n; c++) s -= a[r][c] * h[c]
    h[r] = s / a[r][r]
  }
  return [...h, 1]
}

/**
 * Returns the PNG of the quad `corners` of `photo` (top-left, top-right, bottom-right, bottom-left, in photo pixels) flattened to `outW` x `outH` pixels.
 * Throws on a size below 1 px, a corner outside the photo, or a degenerate quad.
 */
export async function rectifyQuad(photo: Uint8Array, corners: Quad, outW: number, outH: number): Promise<Uint8Array> {
  if (!(outW >= 1) || !(outH >= 1) || !Number.isInteger(outW) || !Number.isInteger(outH)) throw new Error(`rectifyQuad: the output size must be whole pixels from 1, got ${outW} x ${outH}`)
  const { data, info } = await sharp(Buffer.from(photo)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  for (const [x, y] of corners) {
    if (!(x >= 0 && y >= 0 && x <= info.width - 1 && y <= info.height - 1)) throw new Error(`rectifyQuad: the corner (${x}, ${y}) is outside the photo (${info.width} x ${info.height})`)
  }
  // inverse mapping: for each output pixel, where does it come from in the photo
  const dst: Pt[] = [[0, 0], [outW - 1, 0], [outW - 1, outH - 1], [0, outH - 1]]
  const h = solveHomography(dst, corners)
  const out = Buffer.alloc(outW * outH * 3)
  const at = (x: number, y: number, k: number): number => data[(y * info.width + x) * 3 + k]
  for (let v = 0; v < outH; v++) {
    for (let u = 0; u < outW; u++) {
      const w = h[6] * u + h[7] * v + 1
      const sx = Math.min(info.width - 1, Math.max(0, (h[0] * u + h[1] * v + h[2]) / w))
      const sy = Math.min(info.height - 1, Math.max(0, (h[3] * u + h[4] * v + h[5]) / w))
      const x0 = Math.floor(sx)
      const y0 = Math.floor(sy)
      const x1 = Math.min(info.width - 1, x0 + 1)
      const y1 = Math.min(info.height - 1, y0 + 1)
      const fx = sx - x0
      const fy = sy - y0
      for (let k = 0; k < 3; k++) {
        const top = at(x0, y0, k) * (1 - fx) + at(x1, y0, k) * fx
        const bot = at(x0, y1, k) * (1 - fx) + at(x1, y1, k) * fx
        out[(v * outW + u) * 3 + k] = Math.round(top * (1 - fy) + bot * fy)
      }
    }
  }
  return new Uint8Array(await sharp(out, { raw: { width: outW, height: outH, channels: 3 } }).png().toBuffer())
}

/** CLI: see the file header. Exit code 0 written, 1 anything else. */
export async function main(argv: string[]): Promise<number> {
  const [file, quadArg, w, h, out] = argv
  if (!file || !quadArg || !w || !h || !out) {
    console.error('usage: npm run asset:rectify -- <photo> <x1,y1,x2,y2,x3,y3,x4,y4> <outW> <outH> <out.png>')
    return 1
  }
  const n = quadArg.split(',').map(Number)
  if (n.length !== 8 || n.some((v) => !Number.isFinite(v))) {
    console.error('the quad must be eight numbers: top-left, top-right, bottom-right, bottom-left (x,y each)')
    return 1
  }
  const quad: Quad = [[n[0], n[1]], [n[2], n[3]], [n[4], n[5]], [n[6], n[7]]]
  try {
    const png = await rectifyQuad(new Uint8Array(await readFile(file)), quad, Number(w), Number(h))
    await writeFile(out, png)
    console.log(`wrote ${out} (${w} x ${h})`)
    return 0
  } catch (e) {
    console.error((e as Error).message)
    return 1
  }
}

if (process.argv[1] && /rectify\.(ts|js)$/.test(process.argv[1])) {
  main(process.argv.slice(2)).then((c) => process.exit(c))
}
