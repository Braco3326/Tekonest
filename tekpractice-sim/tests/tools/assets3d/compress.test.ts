/**
 * Tests for assets3d/compress: optimizeTextures (the texture budget step that runs before Draco).
 * The Draco step has its own tests in buildAsset.test.ts.
 */
import { execFileSync } from 'node:child_process'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { optimizeTextures } from '../../../tools/assets3d/compress'
import { inspectGlb } from '../../../tools/assets3d/inspect'
import { makeBoxGlb } from './helpers'

const SIZE = { w: 0.2, h: 0.1, d: 0.3 }
const NODES = [{ name: 'port_in', pos: [0.05, 0.02, 0.15] as [number, number, number] }, { name: 'ctrl_gain', pos: [0, 0.1, 0] as [number, number, number] }]

describe('optimizeTextures', () => {
  it('downscales a 2048 px texture to 1024 and re-encodes it as webp', async () => {
    const glb = await makeBoxGlb({ sizeM: SIZE, texture: { sizePx: 2048 } })
    expect((await inspectGlb(glb)).textures).toMatchObject([{ width: 2048, height: 2048, mimeType: 'image/png' }])

    const out = await optimizeTextures(glb, { maxPx: 1024 })
    const report = await inspectGlb(out)
    expect(report.textures).toHaveLength(1)
    expect(report.textures[0]).toMatchObject({ width: 1024, height: 1024, mimeType: 'image/webp' })
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).readBinary(out)
    expect(doc.getRoot().listExtensionsUsed().map((e) => e.extensionName)).toContain('EXT_texture_webp')
    expect(out.byteLength).toBeLessThan(glb.byteLength)
  })

  it('never upscales a 256 px texture', async () => {
    const out = await optimizeTextures(await makeBoxGlb({ sizeM: SIZE, texture: { sizePx: 256 } }), { maxPx: 1024 })
    expect((await inspectGlb(out)).textures[0]).toMatchObject({ width: 256, height: 256, mimeType: 'image/webp' })
  })

  it('resizes every map of a PBR set (base colour, normal, metallic-roughness)', async () => {
    const out = await optimizeTextures(await makeBoxGlb({ sizeM: SIZE, texture: { sizePx: 1024, pbr: true } }), { maxPx: 512 })
    const { textures } = await inspectGlb(out)
    expect(textures).toHaveLength(3)
    for (const t of textures) expect(t).toMatchObject({ width: 512, height: 512, mimeType: 'image/webp' })
  })

  it('colour maps are lossy WebP (VP8), data maps near-lossless WebP (VP8L), in two passes', async () => {
    // add emissive and occlusion maps to the helper's PBR set (base colour, normal, metallic-roughness)
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
    const doc = await io.readBinary(await makeBoxGlb({ sizeM: SIZE, nodes: NODES, texture: { sizePx: 256, noise: true, pbr: true } }))
    const material = doc.getRoot().listMaterials()[0]
    const png = new Uint8Array(await sharp({ create: { width: 256, height: 256, channels: 3, background: { r: 90, g: 40, b: 200 } } }).png().toBuffer())
    material.setEmissiveTexture(doc.createTexture('emissive').setImage(png).setMimeType('image/png'))
    material.setOcclusionTexture(doc.createTexture('occlusion').setImage(png.slice()).setMimeType('image/png'))
    const out = await optimizeTextures(await io.writeBinary(doc), { maxPx: 128 })

    const after = await io.readBinary(out)
    const m = after.getRoot().listMaterials()[0]
    const codec = (t: ReturnType<typeof m.getBaseColorTexture>): string => {
      const img = t?.getImage()
      expect(t?.getMimeType()).toBe('image/webp')
      expect(Buffer.from(img as Uint8Array).subarray(0, 4).toString('latin1')).toBe('RIFF')
      return Buffer.from(img as Uint8Array).subarray(12, 16).toString('latin1')
    }
    expect(codec(m.getBaseColorTexture())).toBe('VP8 ')
    expect(codec(m.getEmissiveTexture())).toBe('VP8 ')
    expect(codec(m.getNormalTexture())).toBe('VP8L')
    expect(codec(m.getMetallicRoughnessTexture())).toBe('VP8L')
    expect(codec(m.getOcclusionTexture())).toBe('VP8L')
    for (const t of (await inspectGlb(out)).textures) expect(Math.max(t.width, t.height)).toBeLessThanOrEqual(128)
  })

  it('keeps the port_ and ctrl_ empties and the single root', async () => {
    const glb = await makeBoxGlb({ sizeM: SIZE, nodes: NODES, texture: { sizePx: 512 } })
    const before = await inspectGlb(glb)
    const after = await inspectGlb(await optimizeTextures(glb, { maxPx: 256 }))
    expect(after.nodeNames).toEqual(before.nodeNames)
    expect(after.nodeNames).toEqual(['root', 'port_in', 'ctrl_gain'])
    expect(after.topLevelCount).toBe(1)
    expect(after.nodes.filter((n) => !n.hasMesh).map((n) => n.name)).toEqual(['port_in', 'ctrl_gain'])
    expect(after.triangles).toBe(before.triangles)
  })

  it('returns a GLB without textures bit-identical', async () => {
    const glb = await makeBoxGlb({ sizeM: SIZE, nodes: NODES })
    const out = await optimizeTextures(glb, { maxPx: 1024 })
    expect(Buffer.from(out).equals(Buffer.from(glb))).toBe(true)
  })

  it('is deterministic (same bytes twice)', async () => {
    const glb = await makeBoxGlb({ sizeM: SIZE, nodes: NODES, texture: { sizePx: 1024, noise: true, pbr: true } })
    const one = await optimizeTextures(glb, { maxPx: 512 })
    const two = await optimizeTextures(glb, { maxPx: 512 })
    expect(Buffer.from(two).equals(Buffer.from(one))).toBe(true)
  })

  it('the output loads again with inspectGlb', async () => {
    const glb = await makeBoxGlb({ sizeM: SIZE, nodes: NODES, texture: { sizePx: 1024 } })
    const report = await inspectGlb(await optimizeTextures(glb, { maxPx: 512 }))
    expect(report.triangles).toBe(12)
    expect(report.materials).toBe(1)
    expect(report.fileBytes).toBeGreaterThan(0)
  })

  it('rejects a maxPx that is not a positive whole number', async () => {
    const glb = await makeBoxGlb({ sizeM: SIZE, texture: { sizePx: 64 } })
    for (const maxPx of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(optimizeTextures(glb, { maxPx })).rejects.toThrow(/maxPx/)
    }
  })

  // vitest loads modules in its own order and hides this: under tsx (how the CLI runs) importing @gltf-transform/functions
  // before sharp loads a second libvips and dies with ERR_DLOPEN_FAILED, so compress.ts imports sharp first.
  it('loads under plain node + tsx, the way npm run asset:build runs it', () => {
    const script = "const m = await import('./tools/assets3d/compress.ts'); console.log(typeof m.optimizeTextures)"
    const out = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { cwd: process.cwd(), encoding: 'utf8' })
    expect(out.trim()).toBe('function')
  }, 60_000)
})
