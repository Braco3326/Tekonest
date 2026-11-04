import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Task 43d R1 (item 6): the glTF extensions the shipped models rely on are an ALLOW-LIST. Babylon's loader needs a decoder for some of them: the Draco decoder is
 * vendored under public/draco/ (src/render/draco.ts), WebP textures are decoded by the browser. A model compressed with something else (KTX2 / Basis textures,
 * Meshopt, quantization...) would make the loader fetch ANOTHER decoder from cdn.babylonjs.com at runtime (a third party again, CA-24) or fail: it must fail
 * HERE, when the file is added, not in a visitor's browser. To allow a new extension: vendor its decoder under public/ first, then add it below.
 */
const ALLOWED_USED = [
  'EXT_texture_webp', // browser-native
  'KHR_draco_mesh_compression', // public/draco/
  'KHR_materials_ior',
  'KHR_materials_specular',
  'KHR_materials_unlit',
  'KHR_texture_transform',
]
const ALLOWED_REQUIRED = ['EXT_texture_webp', 'KHR_draco_mesh_compression', 'KHR_texture_transform']

const publicDir = join(__dirname, '..', '..', 'public')
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))

/** extensionsUsed / extensionsRequired of a .glb (the JSON chunk is the first chunk). */
function extensionsOf(glb: Buffer): { used: string[]; required: string[] } {
  if (glb.readUInt32LE(0) !== 0x46546c67) throw new Error('not a glb (magic)')
  if (glb.readUInt32LE(16) !== 0x4e4f534a) throw new Error('first chunk is not JSON')
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { extensionsUsed?: string[]; extensionsRequired?: string[] }
  return { used: json.extensionsUsed ?? [], required: json.extensionsRequired ?? [] }
}

/** A minimal glb holding the given JSON. */
function fakeGlb(json: object): Buffer {
  let body = Buffer.from(JSON.stringify(json), 'utf8')
  body = Buffer.concat([body, Buffer.alloc((4 - (body.length % 4)) % 4, 0x20)])
  const head = Buffer.alloc(20)
  head.writeUInt32LE(0x46546c67, 0)
  head.writeUInt32LE(2, 4)
  head.writeUInt32LE(12 + 8 + body.length, 8)
  head.writeUInt32LE(body.length, 12)
  head.writeUInt32LE(0x4e4f534a, 16)
  return Buffer.concat([head, body])
}

describe('the scanner itself', () => {
  it('reads extensionsUsed and extensionsRequired, and sees a KTX2 or Meshopt model', () => {
    const e = extensionsOf(fakeGlb({ asset: { version: '2.0' }, extensionsUsed: ['KHR_texture_basisu', 'EXT_meshopt_compression'], extensionsRequired: ['KHR_texture_basisu'] }))
    expect(e.used).toEqual(['KHR_texture_basisu', 'EXT_meshopt_compression'])
    expect(e.required).toEqual(['KHR_texture_basisu'])
    expect(e.used.filter((x) => !ALLOWED_USED.includes(x))).toEqual(['KHR_texture_basisu', 'EXT_meshopt_compression'])
  })
  it('an extension-free model is an empty list', () => {
    expect(extensionsOf(fakeGlb({ asset: { version: '2.0' } }))).toEqual({ used: [], required: [] })
  })
})

describe('every shipped .glb under public/', () => {
  const files = walk(publicDir).filter((f) => f.toLowerCase().endsWith('.glb'))
  const scanned = files.map((f) => ({ f: f.slice(publicDir.length + 1).split('\\').join('/'), ...extensionsOf(readFileSync(f)) }))
  it('is a real scan (many models, some Draco), not an empty directory', () => {
    expect(scanned.length).toBeGreaterThan(40)
    expect(scanned.filter((s) => s.used.includes('KHR_draco_mesh_compression')).length).toBeGreaterThan(10)
  })
  it('uses only allow-listed extensions (anything else would need a decoder from a third party)', () => {
    expect(scanned.flatMap((s) => s.used.filter((x) => !ALLOWED_USED.includes(x)).map((x) => `${s.f}: ${x}`))).toEqual([])
  })
  it('requires only allow-listed extensions', () => {
    expect(scanned.flatMap((s) => s.required.filter((x) => !ALLOWED_REQUIRED.includes(x)).map((x) => `${s.f}: ${x}`))).toEqual([])
  })
  it('every allow-listed extension is really used by some model (a stale entry would hide a drift)', () => {
    const present = new Set(scanned.flatMap((s) => s.used))
    expect(ALLOWED_USED.filter((x) => !present.has(x))).toEqual([])
  })
})
