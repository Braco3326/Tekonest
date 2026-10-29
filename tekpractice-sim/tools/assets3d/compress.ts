/**
 * assets3d/compress: Draco-compresses a GLB with the existing @gltf-transform toolchain (the registration pattern of
 * tools/blender/rig-all.mjs). Draco only: `optimize` would prune the mesh-less port_ / ctrl_ nodes, which are the point.
 * Positions are quantized to `quantizePositionBits` over the mesh's bounding box (16 bits keep a 6 mm connector under
 * a hundredth of a millimetre, 14 bits do the same for a rack device); the caller re-measures the compressed bytes
 * because quantization moves vertices. Deterministic: the same bytes and bits give the same output.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'

export interface CompressOpts {
  /** Bits per POSITION component (Draco accepts 1 to 30). */
  quantizePositionBits: number
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
