/**
 * assets3d/runFixup: runs the Blender fix-up (tools/assets3d/blender/fixup.py) on one raw GLB and returns its report.
 *
 * Node computes everything spec-related (placement and extras, GLB file space, see placement.ts) and hands it to
 * Python as plan.json in a fresh temp dir; Python does only the geometry: clean, rotate into the spec's axis order
 * (plus the human-picked yaw, R12, and the optional upside-down flip), scale to the exact spec size, set the pivot, add the port_/ctrl_ nodes, cut the
 * socket recesses, write the extras and export. It answers with report.json, or exits non-zero with a one-line
 * FIXUP_FAIL message on stderr. Command line (`--python-exit-code 1` turns an uncaught Python error into exit 1;
 * without it Blender exits 0 after a crashed script):
 *
 *   blender --background --factory-startup --python-exit-code 1 --python fixup.py --
 *           --in <glb> --out <glb> --plan <plan.json> --report <report.json>
 *
 * Nothing is rejected here on proportions: the caller evaluates checkProportionDrift on `preScaleSizeM`.
 * `exec` and `blender` are injectable so the contract is unit-tested without Blender.
 */
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { findBlender } from './env'
import { buildPlacement, toExtras } from './placement'
import type { AssetSpecT } from './specSchema'

/** Absolute path of the Python script Blender runs. */
export const FIXUP_SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'blender', 'fixup.py')

/** Yaw about glTF +Y applied after the automatic axis-order rotation (R12): the I/O face is a human call. */
export type YawDeg = 0 | 90 | 180 | 270
const YAWS: readonly number[] = [0, 90, 180, 270]

/** Blender wall-clock limit; a fix-up of a 30k-triangle model takes seconds, a hang should not block a batch. */
const TIMEOUT_MS = 10 * 60 * 1000
/** Blender is chatty on stdout; keep enough buffer that a long log does not kill the process. */
const MAX_BUFFER = 64 * 1024 * 1024
/** How much of stderr goes into a thrown message. */
const STDERR_TAIL = 2000

const FiniteNum = z.number().finite()
const FixupReportSchema = z.object({
  /** Model extents in Blender units (read as metres) after rotation, before scaling; spec axis order. */
  preScaleSizeM: z.object({ w: FiniteNum, h: FiniteNum, d: FiniteNum }).strict(),
  /** Non-uniform scale applied, glTF axis order (x, y, z) = (w, h, d). */
  scaleApplied: z.tuple([FiniteNum, FiniteNum, FiniteNum]),
  /** Angle of the total rotation (axis order then yaw), degrees in [0, 180]. */
  rotatedDegrees: FiniteNum,
}).strict()

export type FixupReport = z.infer<typeof FixupReportSchema>

export interface FixupOpts {
  yawDeg?: YawDeg
  /**
   * An extra 180-degree turn about glTF Z after the axis-order rotation and the yaw: up and down swap, the +Z I/O face
   * stays the I/O face. For a model the contact sheet shows upside down (CLI --flip).
   */
  flipUpright?: boolean
}

export interface ExecResult {
  code: number
  stdout: string
  stderr: string
}

export interface FixupDeps {
  /** Runs `file` with `args` and resolves with the exit code; it must not reject on a non-zero exit. */
  exec?: (file: string, args: string[]) => Promise<ExecResult>
  /** Blender executable; undefined = findBlender(), null = none found. */
  blender?: string | null
}

/**
 * child_process.execFile as a promise that resolves with the exit code instead of rejecting. Shared by every Blender
 * caller (fix-up, contact sheet); `timeoutMs` is the wall-clock limit (default 10 minutes).
 */
export function defaultExec(file: string, args: string[], timeoutMs: number = TIMEOUT_MS): Promise<ExecResult> {
  return new Promise((done) => {
    execFile(file, args, { maxBuffer: MAX_BUFFER, timeout: timeoutMs, windowsHide: true }, (err, stdout, stderr) => {
      // err.code is the exit code, or a string such as 'ENOENT' when the file could not be started.
      const raw = err ? (err as NodeJS.ErrnoException & { code?: number | string }).code : 0
      const code = typeof raw === 'number' ? raw : err ? 1 : 0
      const extra = err && typeof raw !== 'number' ? `\n${err.message}` : ''
      done({ code, stdout: String(stdout), stderr: String(stderr) + extra })
    })
  })
}

/**
 * Fixes up `inGlb` into `outGlb` for `spec` with Blender and returns the report fixup.py wrote.
 * Throws when Blender is missing, exits non-zero (the message carries the tail of stderr) or writes a bad report.
 */
export async function runFixup(
  inGlb: string,
  outGlb: string,
  spec: AssetSpecT,
  opts: FixupOpts = {},
  deps: FixupDeps = {},
): Promise<FixupReport> {
  const yawDeg = opts.yawDeg ?? 0
  if (!YAWS.includes(yawDeg)) throw new Error(`yawDeg must be 0, 90, 180 or 270, got ${String(yawDeg)}`)
  if (!/\.glb$/i.test(outGlb)) throw new Error(`the fix-up output must be a .glb file, got ${outGlb}`)

  const blender = deps.blender === undefined ? findBlender() : deps.blender
  if (!blender) {
    throw new Error('Blender is not installed (not found at the default 5.1 path): install Blender 5.1 or set BLENDER_EXE to blender.exe')
  }
  const exec = deps.exec ?? ((file: string, args: string[]) => defaultExec(file, args))

  const placement = buildPlacement(spec)
  const flipUpright = opts.flipUpright === true
  const plan = { id: spec.id, kind: spec.kind, yawDeg, flipUpright, placement, extras: toExtras(spec, placement) }

  const tmp = await mkdtemp(join(tmpdir(), 'tekpractice-fixup-'))
  try {
    const planPath = join(tmp, 'plan.json')
    const reportPath = join(tmp, 'report.json')
    await writeFile(planPath, JSON.stringify(plan, null, 2))

    const args = [
      '--background',
      '--factory-startup',
      '--python-exit-code', '1',
      '--python', FIXUP_SCRIPT,
      '--',
      '--in', resolve(inGlb),
      '--out', resolve(outGlb),
      '--plan', planPath,
      '--report', reportPath,
    ]
    const res = await exec(blender, args)
    if (res.code !== 0) {
      throw new Error(`Blender fix-up of ${spec.id} failed (exit ${res.code}): ${res.stderr.trim().slice(-STDERR_TAIL) || '(no stderr)'}`)
    }

    let text: string
    try {
      text = await readFile(reportPath, 'utf8')
    } catch {
      throw new Error(`Blender fix-up of ${spec.id} exited 0 but wrote no report (${reportPath})`)
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error(`Blender fix-up of ${spec.id} wrote a malformed report (not JSON)`)
    }
    const report = FixupReportSchema.safeParse(parsed)
    if (!report.success) {
      const issue = report.error.issues[0]
      throw new Error(`Blender fix-up of ${spec.id} wrote a malformed report: ${issue.path.join('.') || '(root)'} ${issue.message}`)
    }
    return report.data
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}
