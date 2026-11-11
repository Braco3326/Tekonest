/**
 * Wave 5c finding C: the `fillet` gate must read what the builder built, not the parameter it was asked for. rack-box and power-strip used to
 * write their param into the measurement (a bevel that failed to apply would have passed). The builder script is loaded in Blender's Python
 * (its main() removed) and build_rack_device / build_power_strip are called on a shipped spec's plan, with the rounding switched off.
 */
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findBlender } from '../../../tools/assets3d/env'
import { flatZonesFor } from '../../../tools/assets3d/flatZones'
import { loadSpecs } from '../../../tools/assets3d/loadSpecs'
import { BUILD_SCRIPT } from '../../../tools/assets3d/runBuilder'
import { SHAPE_SPECS } from '../../../tools/assets3d/shapes'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'

const BLENDER = findBlender()
const specs = loadSpecs()
const spec = (id: string): AssetSpecT => specs.find((s) => s.id === id) as AssetSpecT

const PY = String.raw`
import sys, re, json
a = sys.argv[sys.argv.index("--") + 1:]
src = open(a[0], encoding="utf-8").read()
job = json.loads(a[1])
src = re.sub(r"\nmain\(\)\s*$", "\n", src)
ns = {"__name__": "builder_under_test", "__file__": a[0]}
exec(compile(src, a[0], "exec"), ns)
if job["disable"] == "rack-bevel":
    ns["rack_bevel"] = lambda *args, **kw: None
elif job["disable"] == "strip-rounding":
    ns["strip_section"] = lambda d, y0, y1, r, steps: [(d / 2, y1), (-d / 2, y1), (-d / 2, y0), (d / 2, y0)]
fn = ns["build_rack_device"] if job["plan"]["shape"] == "rack-box" else ns["build_power_strip"]
fn(job["plan"])
print("RESULT" + json.dumps(ns["MEASURE"]))
`

function planOf(s: AssetSpecT): Record<string, unknown> {
  return {
    id: s.id,
    kind: s.kind,
    shape: s.build?.shape,
    sizeMm: s.realSizeMm,
    params: s.build?.params ?? {},
    ...(SHAPE_SPECS[s.build?.shape as keyof typeof SHAPE_SPECS].usesFlatZones ? { flatZones: flatZonesFor(s.id) } : {}),
    ports: s.ports.filter((p) => p.face === 'io').map((p) => ({ portId: p.portId, xMm: p.xMm, yMm: p.yMm, ...(p.insetMm !== undefined ? { insetMm: p.insetMm } : {}), ...(p.openingMm !== undefined ? { openingMm: p.openingMm } : {}) })),
  }
}

async function measure(s: AssetSpecT, disable: 'none' | 'rack-bevel' | 'strip-rounding', params?: Record<string, number>): Promise<{ filletMm?: number }> {
  const dir = await mkdtemp(join(tmpdir(), 'tekpractice-mfillet-'))
  try {
    const script = join(dir, 'm.py')
    await writeFile(script, PY)
    const plan = { ...planOf(s), ...(params ? { params: { ...(s.build?.params ?? {}), ...params } } : {}) }
    return await new Promise((resolve, reject) => {
      execFile(BLENDER as string, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', script, '--', BUILD_SCRIPT, JSON.stringify({ plan, disable })], { maxBuffer: 1 << 24 }, (err, out, stderr) => {
        if (err) return reject(new Error(stderr.slice(-800) || out.slice(-800)))
        const line = out.split(/\r?\n/).find((l) => l.startsWith('RESULT'))
        if (!line) return reject(new Error('no RESULT line: ' + out.slice(-400)))
        resolve(JSON.parse(line.slice(6)) as { filletMm?: number })
      })
    })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe(`the fillet gate reads the mesh (${BLENDER ? 'Blender' : 'SKIPPED, Blender not found'})`, () => {
  const rackIds = ['aeta-scoop5-s', 'aeta-scoopy-plus-s', 'antelope-ocx-hd', 'avid-hd-io', 'avid-protools-hdx', 'focusrite-isa-one', 'grace-m905', 'playout-pc', 'switchcraft-studiopatch-9625']

  it.skipIf(!BLENDER).each(rackIds)('rack-box %s: the measured fillet is at least build.minFilletMm and equals the bevel actually cut', async (id) => {
    const s = spec(id)
    const m = await measure(s, 'none')
    expect(m.filletMm, id).toBeGreaterThanOrEqual(s.build?.minFilletMm ?? 0)
    // the spec's own rounding (filletMm, else the 1 mm chamfer): the mesh shows it within the 4-decimal rounding, not more
    const asked = s.build?.params?.filletMm ?? s.build?.params?.chamferMm
    if (asked !== undefined) expect(m.filletMm).toBeLessThanOrEqual(asked + 1e-3)
  }, 120_000)

  it.skipIf(!BLENDER)('rack-box with the bevel switched off measures about 0 and fails the declared minimum, whatever the filletMm param says', async () => {
    const s = spec('focusrite-isa-one')
    expect(s.build?.params?.filletMm).toBeGreaterThan(0)
    const m = await measure(s, 'rack-bevel')
    expect(m.filletMm).toBeDefined()
    expect(m.filletMm as number).toBeLessThan(s.build?.minFilletMm ?? 0)
    expect(m.filletMm as number).toBeLessThan(0.01)
  }, 120_000)

  it.skipIf(!BLENDER)('power-strip: the shipped multiprise measures its 5 mm section radius (over the declared 4.5); with the rounding switched off it measures 0', async () => {
    const s = spec('multiprise-secteur')
    const m = await measure(s, 'none')
    expect(m.filletMm).toBeCloseTo(s.build?.params?.filletMm ?? 7, 3)
    expect(m.filletMm as number).toBeGreaterThanOrEqual(s.build?.minFilletMm ?? 0)
    const off = await measure(s, 'strip-rounding')
    expect(off.filletMm).toBeDefined()
    expect(off.filletMm as number).toBeLessThan(s.build?.minFilletMm ?? 0)
    expect(off.filletMm as number).toBeLessThan(0.01)
  }, 120_000)
})
