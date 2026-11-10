/**
 * The 'right' projection face (Wave 2b): a picture can be mapped on the right side of a scripted box, x running from the io (rear) edge to the front like the
 * spec's right-face ports (the AETA Scoopy+ S has its XLR inputs on that side). No Blender needed except for the last case (skipped without it).
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { NodeIO } from '@gltf-transform/core'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findBlender } from '../../../tools/assets3d/env'
import { loadSpecs } from '../../../tools/assets3d/loadSpecs'
import { parsePhotoArg } from '../../../tools/assets3d/photoProjection'
import { projectionFaceMm } from '../../../tools/assets3d/projection'
import { runBuilder } from '../../../tools/assets3d/runBuilder'
import { AssetSpec } from '../../../tools/assets3d/specSchema'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'

const BLENDER = findBlender()

describe("the 'right' projection face (no Blender)", () => {
  it('is depth x height, like the left face', () => {
    expect(projectionFaceMm('right', { w: 155, h: 80, d: 234 })).toEqual({ w: 234, h: 80 })
  })
  it('parses on the --project-photo command line', () => {
    expect(parsePhotoArg('right=side.png').face).toBe('right')
  })
  it('is accepted by the spec schema, alone or with other faces', () => {
    const base = loadSpecs().find((s) => s.id === 'aeta-scoopy-plus-s') as AssetSpecT
    for (const projection of ['right', ['opposite', 'io', 'right']]) {
      expect(AssetSpec.safeParse({ ...base, build: { ...base.build, projection } }).success).toBe(true)
    }
  })
})

describe("the 'right' picture on a scripted box (Blender)", () => {
  let dir = ''
  beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'right-proj-')) })
  afterAll(async () => { await rm(dir, { recursive: true, force: true }) })

  it.skipIf(!BLENDER)('lands on the +x side with its left edge at the io (rear) end and its right edge at the front', async () => {
    const base = loadSpecs().find((s) => s.id === 'avid-hd-io') as AssetSpecT
    const spec: AssetSpecT = { ...base, id: 'right-test', realSizeMm: { w: 150, h: 60, d: 200 }, ports: [], controls: [], texture: undefined, build: { shape: 'rack-box', params: { chamferMm: 1 } } }
    // left half red (the io end), right half blue (the front)
    const px = Buffer.alloc(200 * 60 * 3)
    for (let y = 0; y < 60; y++) for (let x = 0; x < 200; x++) px.set(x < 100 ? [220, 30, 30] : [30, 30, 220], (y * 200 + x) * 3)
    const png = new Uint8Array(await sharp(px, { raw: { width: 200, height: 60, channels: 3 } }).png().toBuffer())
    const out = join(dir, 'right.glb')
    await runBuilder(spec, out, {}, [{ face: 'right', png }])
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).readBinary(new Uint8Array(await readFile(out)))
    const tex = doc.getRoot().listMaterials()[0].getBaseColorTexture()!
    const { data, info } = await sharp(Buffer.from(tex.getImage()!)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    let seen = 0
    for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
      const pos = prim.getAttribute('POSITION')!
      const uv = prim.getAttribute('TEXCOORD_0')!
      const nrm = prim.getAttribute('NORMAL')!
      for (let i = 0; i < pos.getCount(); i++) {
        if (nrm.getElement(i, [0, 0, 0])[0] < 0.99) continue
        const [u, v] = uv.getElement(i, [0, 0]) as [number, number]
        const x = Math.min(info.width - 1, Math.floor(u * info.width))
        const y = Math.min(info.height - 1, Math.floor(v * info.height))
        const c = Array.from(data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3))
        const z = pos.getElement(i, [0, 0, 0])[2] // glTF z: +d/2 is the io (rear) end
        if (z > 0.05) expect(c[0] > 150 && c[2] < 100, `rear end shows ${c}`).toBe(true)
        else if (z < -0.05) expect(c[2] > 150 && c[0] < 100, `front end shows ${c}`).toBe(true)
        seen++
      }
    }
    expect(seen).toBeGreaterThan(0)
  }, 120_000)
})
