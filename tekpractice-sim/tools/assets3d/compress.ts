/**
 * assets3d/compress: the two size steps of a built GLB, texture budget first, then Draco, with the existing
 * @gltf-transform toolchain (the registration pattern of tools/blender/rig-all.mjs). Neither step calls `optimize`,
 * `prune`, `dedup` or `flatten`: they would drop the mesh-less port_ / ctrl_ nodes, which are the point.
 *  - optimizeTextures: Meshy returns 2K PBR maps and Draco does not touch images, so every texture is downscaled to at
 *    most `maxPx` on its longest side (never upscaled) and re-encoded as WebP (quality 80, EXT_texture_webp). A GLB
 *    without textures is returned as the very same bytes.
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
}

const WEBP_QUALITY = 80

/**
 * Returns `bytes` with every texture at most `maxPx` px on its longest side (aspect kept, never upscaled) and encoded
 * as WebP, with EXT_texture_webp listed in `extensionsUsed` (and required). Nodes, meshes and materials are untouched.
 * A GLB without textures comes back as the same bytes. Expects an uncompressed GLB: run it before Draco.
 */
export async function optimizeTextures(bytes: Uint8Array, opts: TextureOpts): Promise<Uint8Array> {
  const maxPx = opts.maxPx
  if (!Number.isInteger(maxPx) || maxPx < 1) throw new Error(`maxPx must be a positive whole number of pixels, got ${String(maxPx)}`)
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const doc = await io.readBinary(bytes)
  if (doc.getRoot().listTextures().length === 0) return bytes
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [maxPx, maxPx], quality: WEBP_QUALITY }))
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
