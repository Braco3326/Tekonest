/**
 * assets3d/validateGltf: runs the Khronos glTF validator (npm gltf-validator) over the bytes of a GLB.
 *
 * The validator cannot decode KHR_draco_mesh_compression: it reports it as an UNSUPPORTED_EXTENSION info (not an
 * error) and skips the compressed accessors, so a Draco + WebP file still validates. EXT_texture_webp is supported.
 * Errors make the `validator` gate fail (gates.ts checkValidator); warnings are only reported in its detail.
 * Pure over bytes, no fs.
 */
import { validateBytes } from 'gltf-validator'
import type { ValidatorMessage } from 'gltf-validator'

export interface GltfValidation {
  errors: number
  warnings: number
  /** The error and warning messages, `CODE message (pointer)`, errors first, at most MAX_MESSAGES. */
  messages: string[]
}

/** Issues the validator collects at most (a broken 30k-triangle mesh can raise thousands of the same issue). */
const MAX_ISSUES = 200
const MAX_MESSAGES = 20

const format = (m: ValidatorMessage): string => `${m.code} ${m.message}${m.pointer ? ` (${m.pointer})` : ''}`

/** Validates `bytes` as a GLB. Never throws for a malformed file: that is reported as errors. */
export async function validateGltf(bytes: Uint8Array): Promise<GltfValidation> {
  const report = await validateBytes(new Uint8Array(bytes), { format: 'glb', maxIssues: MAX_ISSUES })
  const { numErrors, numWarnings, messages } = report.issues
  const errors = messages.filter((m) => m.severity === 0).map(format)
  const warnings = messages.filter((m) => m.severity === 1).map(format)
  return { errors: numErrors, warnings: numWarnings, messages: [...errors, ...warnings].slice(0, MAX_MESSAGES) }
}
