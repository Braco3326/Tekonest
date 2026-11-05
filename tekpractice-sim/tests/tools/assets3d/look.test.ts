/**
 * Tests for assets3d/look: normaliseLook, the step that makes a textured (Meshy) model read in Mode Création's dim, IBL-less lights.
 * A Meshy PBR set is metallic 1 with a dark colour map: with no environment map a metal surface is black and a dark map vanishes,
 * so the step caps the metallic factor and lifts the colour map (the same rule as the scripted builder's revolve palette).
 */
import sharp from 'sharp'
import { Document, NodeIO } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'
import { LOOK_GAIN, LOOK_LINEAR_CAP, LOOK_METALLIC, LOOK_OFFSET, LOOK_ROUGHNESS, liftChannel, normaliseLook } from '../../../tools/assets3d/look'
import { makeBoxGlb } from './helpers'

const SIZE = { w: 0.2, h: 0.1, d: 0.3 }

/** Reference formula, written independently of the implementation: sRGB byte -> linear x gain, never darker, capped -> sRGB byte. */
function expectedLift(byte: number): number {
  const lin = (byte / 255 <= 0.04045) ? byte / 255 / 12.92 : ((byte / 255 + 0.055) / 1.055) ** 2.4
  const lifted = Math.max(lin, Math.min(LOOK_LINEAR_CAP, lin * LOOK_GAIN + LOOK_OFFSET))
  const s = lifted <= 0.0031308 ? 12.92 * lifted : 1.055 * lifted ** (1 / 2.4) - 0.055
  return Math.round(s * 255)
}

async function solidPng(rgba: [number, number, number, number]): Promise<Uint8Array> {
  const [r, g, b, alpha] = rgba
  return new Uint8Array(await sharp({ create: { width: 8, height: 8, channels: 4, background: { r, g, b, alpha: alpha / 255 } } }).png().toBuffer())
}

async function texturedGlb(colour: [number, number, number, number], metallic = 1): Promise<Uint8Array> {
  const io = new NodeIO()
  const doc = await io.readBinary(await makeBoxGlb({ sizeM: SIZE, texture: { sizePx: 8, pbr: true } }))
  const m = doc.getRoot().listMaterials()[0]
  m.getBaseColorTexture()!.setImage(await solidPng(colour)).setMimeType('image/png')
  m.setMetallicFactor(metallic).setRoughnessFactor(1)
  return io.writeBinary(doc)
}

async function read(bytes: Uint8Array): Promise<Document> {
  return new NodeIO().readBinary(bytes)
}

async function firstPixel(png: Uint8Array): Promise<number[]> {
  const { data } = await sharp(Buffer.from(png)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return [data[0], data[1], data[2], data[3]]
}

describe('liftChannel', () => {
  it('lifts a dark byte to the reference value and never darkens a bright one', () => {
    expect(liftChannel(40)).toBe(expectedLift(40))
    expect(liftChannel(40)).toBeGreaterThan(40 * 1.5) // a gain of 3 in linear light is about 1.8 in sRGB bytes
    for (const b of [0, 1, 17, 59, 120, 200, 239, 240, 255]) {
      expect(liftChannel(b)).toBe(expectedLift(b))
      expect(liftChannel(b)).toBeGreaterThanOrEqual(b)
    }
    expect(liftChannel(255)).toBe(255)
    expect(liftChannel(0)).toBeGreaterThan(20) // a black plastic cabinet or label is not a hole in the picture: the offset lifts it to a dark grey
  })
})

describe('normaliseLook', () => {
  it('caps the metallic factor (a metal surface is black without an environment map) and keeps a lower one', async () => {
    const a = (await read(await normaliseLook(await texturedGlb([60, 60, 62, 255], 1)))).getRoot().listMaterials()[0]
    expect(a.getMetallicFactor()).toBeCloseTo(LOOK_METALLIC, 6)
    const b = (await read(await normaliseLook(await texturedGlb([60, 60, 62, 255], 0.05)))).getRoot().listMaterials()[0]
    expect(b.getMetallicFactor()).toBeCloseTo(0.05, 6)
    expect(a.getRoughnessFactor()).toBe(LOOK_ROUGHNESS) // the metallic-roughness map is dropped: a constant satin roughness
  })

  it('lifts the colour map with the reference formula and keeps its alpha', async () => {
    const out = await read(await normaliseLook(await texturedGlb([40, 40, 42, 200])))
    const px = await firstPixel(out.getRoot().listMaterials()[0].getBaseColorTexture()!.getImage()!)
    expect(px).toEqual([expectedLift(40), expectedLift(40), expectedLift(42), 200])
  })

  it('drops the normal, metallic-roughness and occlusion maps (the colour map carries the detail; full PBR is heavy in a software renderer) and keeps the colour map', async () => {
    const before = (await read(await texturedGlb([40, 40, 42, 255]))).getRoot().listMaterials()[0]
    expect(before.getNormalTexture(), 'the fixture has a normal map').not.toBeNull()
    expect(before.getMetallicRoughnessTexture(), 'the fixture has a metallic-roughness map').not.toBeNull()
    const after = (await read(await normaliseLook(await texturedGlb([40, 40, 42, 255])))).getRoot().listMaterials()[0]
    expect(after.getNormalTexture()).toBeNull()
    expect(after.getMetallicRoughnessTexture()).toBeNull()
    expect(after.getOcclusionTexture()).toBeNull()
    expect(after.getBaseColorTexture()).not.toBeNull()
  })

  it('returns a GLB without textures as the very same bytes (the scripted models are not touched)', async () => {
    const glb = await makeBoxGlb({ sizeM: SIZE })
    expect(await normaliseLook(glb)).toBe(glb)
  })

  it('is deterministic', async () => {
    const glb = await texturedGlb([40, 40, 42, 255])
    const a = await normaliseLook(glb)
    const b = await normaliseLook(glb)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })
})
