/**
 * assets3d/compress: the two size steps of a built GLB, texture budget first, then Draco, with the existing
 * @gltf-transform toolchain (the registration pattern of tools/blender/rig-all.mjs). Neither step calls `optimize`,
 * `prune`, `dedup` or `flatten`: they would drop the mesh-less port_ / ctrl_ nodes, which are the point.
 *  - optimizeTextures: Meshy returns 2K PBR maps and Draco does not touch images, so every texture is downscaled to at
 *    most `maxPx` on its longest side (never upscaled) and re-encoded as WebP (EXT_texture_webp): colour maps lossy
 *    quality 80, normal / metallic-roughness / occlusion near-lossless. A GLB without textures is returned as the very
 *    same bytes.
 *  - dracoCompress: positions are quantized to `quantizePositionBits` over the mesh's bounding box (16 bits keep a 6 mm
 *    connector under a hundredth of a millimetre, 14 bits do the same for a rack device); the caller re-measures the
 *    compressed bytes because quantization moves vertices.
 * Both are deterministic: the same bytes and options give the same output.
 */
// sharp MUST be imported before @gltf-transform/functions. The functions package pulls in ndarray-pixels, which bundles
// its own sharp 0.34 (the repo's is 0.35): the two native libvips builds cannot share a process, and whichever loads
// second dies with ERR_DLOPEN_FAILED. Loading ours first makes the nested copy a harmless no-op (verified under tsx).
import sharp from 'sharp'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions'
import { textureCompress } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'

export interface CompressOpts {
  /** Bits per POSITION component (Draco accepts 1 to 30). */
  quantizePositionBits: number
}

export interface TextureOpts {
  /** Longest side allowed for every texture, in pixels (a positive whole number). */
  maxPx: number
  /**
   * Longest side for the data maps (normal, metallic-roughness, occlusion) when it should be smaller than `maxPx`
   * (default: `maxPx`). Near-lossless data maps weigh several times a lossy colour map, and a colour map carries the
   * look a learner sees, so a hero model keeps a sharp colour map and halves the data maps.
   */
  dataMaxPx?: number
}

/** Colour slots (sRGB images a viewer looks at): lossy WebP, quality 80. */
export const COLOUR_SLOTS = /^(baseColor|emissive)Texture$/
export const COLOUR_WEBP_QUALITY = 80
/**
 * Data slots (normal, metallic-roughness, occlusion): lossy 4:2:0 WebP corrupts normal vectors and the packed ORM
 * channels, so they use WebP near-lossless (preprocessing level 70; sharp 0.35 and @gltf-transform 4.4 support it).
 */
export const DATA_SLOTS = /^(normal|metallicRoughness|occlusion)Texture$/
export const DATA_WEBP_QUALITY = 70

/**
 * Returns `bytes` with every texture at most `maxPx` px on its longest side (aspect kept, never upscaled) and encoded
 * as WebP, with EXT_texture_webp listed in `extensionsUsed` (and required). Two passes: the colour slots lossy at
 * quality 80, the data slots near-lossless; a third pass catches any texture left in PNG / JPEG (a slot of another
 * extension, an unused image) with the colour settings so nothing escapes the size limit. Nodes, meshes and materials
 * are untouched. A GLB without textures comes back as the same bytes. Expects an uncompressed GLB: run it before Draco.
 */
export async function optimizeTextures(bytes: Uint8Array, opts: TextureOpts): Promise<Uint8Array> {
  const maxPx = opts.maxPx
  if (!Number.isInteger(maxPx) || maxPx < 1) throw new Error(`maxPx must be a positive whole number of pixels, got ${String(maxPx)}`)
  const dataPx = opts.dataMaxPx ?? maxPx
  if (!Number.isInteger(dataPx) || dataPx < 1) throw new Error(`dataMaxPx must be a positive whole number of pixels, got ${String(opts.dataMaxPx)}`)
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const doc = await io.readBinary(bytes)
  if (doc.getRoot().listTextures().length === 0) return bytes
  const base = { encoder: sharp, targetFormat: 'webp' as const, resize: [maxPx, maxPx] as [number, number] }
  await doc.transform(
    textureCompress({ ...base, slots: COLOUR_SLOTS, quality: COLOUR_WEBP_QUALITY }),
    textureCompress({ ...base, resize: [dataPx, dataPx], slots: DATA_SLOTS, nearLossless: true, quality: DATA_WEBP_QUALITY }),
    textureCompress({ ...base, formats: /^(png|jpeg)$/, quality: COLOUR_WEBP_QUALITY }),
  )
  return io.writeBinary(doc)
}

/** Returns `bytes` re-encoded with KHR_draco_mesh_compression (required) and the given position quantization. */
export async function dracoCompress(bytes: Uint8Array, opts: CompressOpts): Promise<Uint8Array> {
  const bits = opts.quantizePositionBits
  if (!Number.isInteger(bits) || bits < 1 || bits > 30) throw new Error(`quantizePositionBits must be an integer from 1 to 30, got ${String(bits)}`)
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  })
  const doc = await io.readBinary(bytes)
  doc
    .createExtension(KHRDracoMeshCompression)
    .setRequired(true)
    .setEncoderOptions({ method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER, quantizationBits: { POSITION: bits } })
  return io.writeBinary(doc)
}
