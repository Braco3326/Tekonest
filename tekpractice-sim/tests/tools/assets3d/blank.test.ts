/**
 * Tests for assets3d/blank: blankBands removes brand text and logos from a textured model by HEIGHT. A Meshy colour map is a
 * shattered atlas, so the pixels of a logo cannot be found in the image; the faces of the model at a given height can, and their
 * UV triangles say which texels to repaint.
 */
import sharp from 'sharp'
import { Document, NodeIO } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'
import { blankBands } from '../../../tools/assets3d/blank'

const MM = 0.001
type Rgb = [number, number, number]
const RED: Rgb = [200, 30, 30]
const BLUE: Rgb = [30, 30, 200]
const GREY: Rgb = [90, 90, 90]

/**
 * A 16 x 16 texture split in vertical stripes (one colour per 4 px column) and one triangle per stripe at its own height:
 * triangle i sits at y = heightsMm[i] (centroid) and maps to the UV stripe i.
 */
async function stripedGlb(heightsMm: number[], colours: Rgb[], opts: { noUv?: boolean } = {}): Promise<Uint8Array> {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const px = Buffer.alloc(16 * 16 * 3)
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const c = colours[Math.min(colours.length - 1, Math.floor(x / 4))]
      px.set(c, (y * 16 + x) * 3)
    }
  }
  const png = new Uint8Array(await sharp(px, { raw: { width: 16, height: 16, channels: 3 } }).png().toBuffer())
  const tex = doc.createTexture('baseColor').setImage(png).setMimeType('image/png')
  const mat = doc.createMaterial('m').setBaseColorTexture(tex)
  const pos: number[] = []
  const uv: number[] = []
  heightsMm.forEach((h, i) => {
    const y = h * MM
    pos.push(0, y - MM, 0, 0.01, y - MM, 0, 0.005, y + 2 * MM, 0) // centroid y = y
    const u0 = (i * 4 + 0.5) / 16
    const u1 = (i * 4 + 3.5) / 16
    uv.push(u0, 0.1, u1, 0.1, (u0 + u1) / 2, 0.9)
  })
  const prim = doc.createPrimitive().setMaterial(mat).setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer))
  if (!opts.noUv) prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(buffer))
  const mesh = doc.createMesh('mesh').addPrimitive(prim)
  const root = doc.createNode('root').setMesh(mesh)
  doc.createScene('s').addChild(root)
  return new NodeIO().writeBinary(doc)
}

async function stripe(bytes: Uint8Array, i: number): Promise<Rgb> {
  const doc = await new NodeIO().readBinary(bytes)
  const img = doc.getRoot().listMaterials()[0].getBaseColorTexture()!.getImage()!
  const { data, info } = await sharp(Buffer.from(img)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const x = i * 4 + 2
  const y = 8
  const o = (y * info.width + x) * 3
  return [data[o], data[o + 1], data[o + 2]]
}

describe('blankBands', () => {
  it('repaints the texels of the faces inside a band with the given colour and leaves the others', async () => {
    const glb = await stripedGlb([5, 50], [RED, BLUE])
    const out = await blankBands(glb, [{ fromMm: 0, toMm: 10, fill: '#00ff00' }])
    expect(await stripe(out, 0)).toEqual([0, 255, 0])
    expect(await stripe(out, 1)).toEqual(BLUE)
  })

  it('"auto" paints with the median colour of the faces just outside the band (a text band on a handle takes the handle colour)', async () => {
    // stripe 0 = the logo (red) in the band 20-30; stripes 1 and 2 = the body just above and below (grey), stripe 3 far away (blue)
    const glb = await stripedGlb([25, 15, 35, 200], [RED, GREY, GREY, BLUE])
    const out = await blankBands(glb, [{ fromMm: 20, toMm: 30 }])
    expect(await stripe(out, 0)).toEqual(GREY)
    expect(await stripe(out, 3)).toEqual(BLUE)
  })

  it('refuses a band that covers no face (a silent no-op would ship the logo)', async () => {
    const glb = await stripedGlb([5, 50], [RED, BLUE])
    await expect(blankBands(glb, [{ fromMm: 100, toMm: 120, fill: '#000000' }])).rejects.toThrow(/covers no texel/)
  })

  it('refuses an automatic fill with nothing around the band to sample', async () => {
    const glb = await stripedGlb([5], [RED])
    await expect(blankBands(glb, [{ fromMm: 0, toMm: 10 }])).rejects.toThrow(/no texels around/)
  })

  it('refuses a model without UVs', async () => {
    const glb = await stripedGlb([5], [RED], { noUv: true })
    await expect(blankBands(glb, [{ fromMm: 0, toMm: 10, fill: '#000000' }])).rejects.toThrow(/TEXCOORD_0/)
  })

  it('returns the very same bytes when there is no band', async () => {
    const glb = await stripedGlb([5], [RED])
    expect(await blankBands(glb, [])).toBe(glb)
  })

  it('is deterministic', async () => {
    const glb = await stripedGlb([5, 50], [RED, BLUE])
    const a = await blankBands(glb, [{ fromMm: 0, toMm: 10, fill: '#123456' }])
    const b = await blankBands(glb, [{ fromMm: 0, toMm: 10, fill: '#123456' }])
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })
})

/** A 100 x 60 x 40 mm box seen as three triangles, each with its own UV stripe: A and B on the io face, C on the opposite face. */
async function faceGlb(): Promise<Uint8Array> {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const px = Buffer.alloc(16 * 16 * 3)
  const colours: Rgb[] = [RED, BLUE, GREY, [10, 200, 10]]
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px.set(colours[Math.floor(x / 4)], (y * 16 + x) * 3)
  const png = new Uint8Array(await sharp(px, { raw: { width: 16, height: 16, channels: 3 } }).png().toBuffer())
  const mat = doc.createMaterial('m').setBaseColorTexture(doc.createTexture('baseColor').setImage(png).setMimeType('image/png'))
  const pos: number[] = []
  const uv: number[] = []
  // io face is z = +d/2 = +20 mm, x_world = x_local - 50 mm. A at local (20, 30), B at (80, 30); C on the opposite face (z = -20 mm)
  const tri = (cx: number, cy: number, z: number, stripe: number): void => {
    const x0 = (cx - 50) * MM
    pos.push(x0 - 2 * MM, (cy - 2) * MM, z * MM, x0 + 2 * MM, (cy - 2) * MM, z * MM, x0, (cy + 3) * MM, z * MM)
    const u0 = (stripe * 4 + 0.5) / 16
    const u1 = (stripe * 4 + 3.5) / 16
    uv.push(u0, 0.1, u1, 0.1, (u0 + u1) / 2, 0.9)
  }
  tri(20, 30, 20, 0)
  tri(80, 30, 20, 1)
  tri(20, 30, -20, 2)
  // two corner points make the box extents: 100 x 60 x 40 mm
  pos.push(-50 * MM, 0, -20 * MM, 50 * MM, 60 * MM, 20 * MM, 50 * MM, 60 * MM, 20 * MM)
  uv.push(0.9, 0.9, 0.9, 0.9, 0.9, 0.9)
  const prim = doc.createPrimitive().setMaterial(mat)
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(buffer))
  doc.createScene('s').addChild(doc.createNode('root').setMesh(doc.createMesh('mesh').addPrimitive(prim)))
  return new NodeIO().writeBinary(doc)
}

describe('blankBands rects (a logo on a face, in the spec face-local millimetres)', () => {
  it('repaints only the faces of the rectangle on the given face', async () => {
    const out = await blankBands(await faceGlb(), [], [{ face: 'io', xMm: 10, yMm: 20, wMm: 20, hMm: 20, fill: '#00ff00' }])
    expect(await stripe(out, 0)).toEqual([0, 255, 0]) // A: inside
    expect(await stripe(out, 1)).toEqual(BLUE) // B: another x
    expect(await stripe(out, 2)).toEqual(GREY) // C: the opposite face, same x and y
  })

  it('the opposite face is mirrored (x runs the other way seen from outside)', async () => {
    // C sits at world x = -30 mm; seen from the back, local x = w/2 - x_world = 50 + 30 = 80
    const out = await blankBands(await faceGlb(), [], [{ face: 'opposite', xMm: 70, yMm: 20, wMm: 20, hMm: 20, fill: '#00ff00' }])
    expect(await stripe(out, 2)).toEqual([0, 255, 0])
    expect(await stripe(out, 0)).toEqual(RED)
  })

  it('refuses a rectangle that covers no face', async () => {
    await expect(blankBands(await faceGlb(), [], [{ face: 'io', xMm: 40, yMm: 0, wMm: 10, hMm: 10, fill: '#000000' }])).rejects.toThrow(/covers no texel/)
  })

  it('the automatic fill takes the median colour of the faces just around the rectangle on that face', async () => {
    // A is blanked; B (60 mm to the right, 20 mm margin is not enough) -> a wide margin rect: sample B by asking for a rect around A with margin
    const out = await blankBands(await faceGlb(), [], [{ face: 'io', xMm: 10, yMm: 20, wMm: 20, hMm: 20, marginMm: 70 }])
    expect(await stripe(out, 0)).toEqual(BLUE)
  })
})

describe('blankBands on one big triangle (a logo printed on a large flat face)', () => {
  /** One triangle 10 mm wide and 100 mm tall (y 0 to 100), centroid at y = 33, whose UV runs from pixel row 14.4 (y = 0) to 1.6 (y = 100) of a 16 px red map. */
  async function tallGlb(): Promise<Uint8Array> {
    const doc = new Document()
    const buffer = doc.createBuffer()
    const png = new Uint8Array(await sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 200, g: 30, b: 30 } } }).png().toBuffer())
    const mat = doc.createMaterial('m').setBaseColorTexture(doc.createTexture('baseColor').setImage(png).setMimeType('image/png'))
    const pos = [0, 0, 0, 10 * MM, 0, 0, 5 * MM, 100 * MM, 0]
    const uv = [0.1, 0.9, 0.9, 0.9, 0.5, 0.1]
    const prim = doc.createPrimitive().setMaterial(mat)
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(buffer))
    doc.createScene('s').addChild(doc.createNode('root').setMesh(doc.createMesh('mesh').addPrimitive(prim)))
    return new NodeIO().writeBinary(doc)
  }
  const pixel = async (bytes: Uint8Array, x: number, y: number): Promise<Rgb> => {
    const img = (await new NodeIO().readBinary(bytes)).getRoot().listMaterials()[0].getBaseColorTexture()!.getImage()!
    const { data, info } = await sharp(Buffer.from(img)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const o = (y * info.width + x) * 3
    return [data[o], data[o + 1], data[o + 2]]
  }

  it('repaints only the texels inside the band, although the triangle centroid (y = 33) is outside it', async () => {
    const out = await blankBands(await tallGlb(), [{ fromMm: 10, toMm: 20, fill: '#00ff00' }])
    expect(await pixel(out, 8, 13)).toEqual([0, 255, 0]) // row 13: y of about 12 mm, inside
    expect(await pixel(out, 8, 8)).toEqual([200, 30, 30]) // row 8: about 50 mm
    expect(await pixel(out, 8, 3)).toEqual([200, 30, 30]) // row 3: about 90 mm
  })
})
