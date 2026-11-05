/**
 * assets3d/look: makes a textured (Meshy) model read in Mode Création's lights.
 *
 * Mode Création lights the scene with a dim hemispheric fill and one key light and has no environment map. A Meshy PBR set
 * (metallic factor 1, a colour map made for a lit studio) is therefore black on every metal surface and very dark elsewhere:
 * the SM58 handle vanishes. The scripted builder solves the same problem by lifting its palette (build_from_spec.py lift_hex);
 * this step applies the same rule to a textured model:
 *  - the metallic factor is capped at LOOK_METALLIC (a lower factor is kept); the normal and metallic-roughness maps are DROPPED and the roughness
 *    set to LOOK_ROUGHNESS: the colour map already carries the detail a learner sees (grille weave, slats, labels), and full PBR with a normal map
 *    made two speakers slow enough in a software-rendered browser to starve the page's audio timers (e2e), and costs three textures of GPU memory;
 *  - every pixel of the base-colour map is lifted: linear x LOOK_GAIN + LOOK_OFFSET, capped at LOOK_LINEAR_CAP, never darker than it was
 *    (a white label stays white); alpha is untouched.
 * A GLB without a base-colour texture comes back as the very same bytes.
 * Runs on the fixed-up GLB, before the texture step (so the lift is applied to the full-size map, then downscaled).
 */
// sharp MUST be imported before @gltf-transform (see compress.ts).
import sharp from 'sharp'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

/** Metallic factor ceiling: a little sheen on the grille and rim, never a black mirror. */
export const LOOK_METALLIC = 0.15
/** Roughness of a textured model once its metallic-roughness map is dropped (a satin finish). */
export const LOOK_ROUGHNESS = 0.6
/** Linear gain of the colour map, the value of the scripted builder's REVOLVE_LIFT. */
export const LOOK_GAIN = 3.0
/** Linear offset added with the gain: black plastic (a speaker cabinet, a label) becomes a dark grey, not a hole in the picture. */
export const LOOK_OFFSET = 0.012
/** Linear ceiling of a lifted pixel (the scripted builder's REVOLVE_LIFT_CAP). */
export const LOOK_LINEAR_CAP = 0.85

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (v: number): number => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

/** One sRGB byte, lifted: max(linear, min(cap, linear x gain)) back to an sRGB byte. */
export function liftChannel(byte: number): number {
  const lin = toLinear(byte / 255)
  const lifted = Math.max(lin, Math.min(LOOK_LINEAR_CAP, lin * LOOK_GAIN + LOOK_OFFSET))
  return Math.max(0, Math.min(255, Math.round(toSrgb(lifted) * 255)))
}

const LUT = Uint8Array.from({ length: 256 }, (_, i) => liftChannel(i))

/** Returns `bytes` with the base-colour maps lifted and the metallic factors capped (see the file header). Expects an uncompressed GLB. */
export async function normaliseLook(bytes: Uint8Array): Promise<Uint8Array> {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const doc = await io.readBinary(bytes)
  const materials = doc.getRoot().listMaterials().filter((m) => m.getBaseColorTexture() !== null)
  if (materials.length === 0) return bytes
  const lifted = new Set<unknown>()
  for (const m of materials) {
    m.setMetallicFactor(Math.min(m.getMetallicFactor(), LOOK_METALLIC))
    m.setRoughnessFactor(LOOK_ROUGHNESS)
    m.setNormalTexture(null)
    m.setMetallicRoughnessTexture(null)
    m.setOcclusionTexture(null)
    const tex = m.getBaseColorTexture()!
    if (lifted.has(tex)) continue
    lifted.add(tex)
    const image = tex.getImage()
    if (!image) continue
    const { data, info } = await sharp(Buffer.from(image)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (let i = 0; i < data.length; i += 4) {
      data[i] = LUT[data[i]]
      data[i + 1] = LUT[data[i + 1]]
      data[i + 2] = LUT[data[i + 2]]
    }
    const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
    tex.setImage(new Uint8Array(png)).setMimeType('image/png')
  }
  return io.writeBinary(doc)
}
