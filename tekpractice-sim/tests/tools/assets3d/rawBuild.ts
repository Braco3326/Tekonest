/**
 * Test helper: runs the Blender builder on a plan.json given as an object (no spec, no catalogue, no flat-zone lookup), so a test can pin
 * the exact output of a plan taken from the past. Same command line as tools/assets3d/runBuilder.ts.
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { BUILD_SCRIPT } from '../../../tools/assets3d/runBuilder'
import { defaultExec } from '../../../tools/assets3d/runFixup'

export interface RawBuild {
  bytes: Uint8Array
  sha256: string
  /** What the builder wrote next to the GLB (filletMm, ...), {} when nothing. */
  measure: Record<string, number>
}

/** Builds `plan` with `blender` into `dir/<name>.glb`; throws with the BUILD_FAIL line when the builder refuses. */
export async function buildPlanRaw(blender: string, dir: string, name: string, plan: unknown): Promise<RawBuild> {
  const planPath = join(dir, `${name}.plan.json`)
  const glb = join(dir, `${name}.glb`)
  await writeFile(planPath, JSON.stringify(plan, null, 2))
  const res = await defaultExec(blender, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', BUILD_SCRIPT, '--', '--plan', planPath, '--out', glb])
  if (res.code !== 0) {
    const fail = /^BUILD_FAIL (.*)$/m.exec(res.stderr)
    throw new Error(`build of ${name} failed: ${fail ? fail[1].trim() : res.stderr.trim().slice(-800)}`)
  }
  const bytes = new Uint8Array(await readFile(glb))
  let measure: Record<string, number> = {}
  try {
    measure = JSON.parse(await readFile(join(dir, `${name}.measure.json`), 'utf8')) as Record<string, number>
  } catch {
    // most shapes measure nothing
  }
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex'), measure }
}

/** Triangle count and a hash of the sorted vertex positions (to 1e-7 m): equal for two builds that differ only in how flat faces were triangulated. */
export async function fingerprint(bytes: Uint8Array): Promise<string> {
  const doc = await new NodeIO().readBinary(bytes)
  const pts: string[] = []
  let tris = 0
  for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
    const pos = prim.getAttribute('POSITION')!.getArray()!
    for (let i = 0; i < pos.length; i += 3) pts.push([pos[i], pos[i + 1], pos[i + 2]].map((v) => Math.round(v * 1e7)).join(','))
    tris += prim.getIndices()!.getCount() / 3
  }
  pts.sort()
  return `${tris}:${createHash('sha256').update(pts.join(';')).digest('hex').slice(0, 24)}`
}
