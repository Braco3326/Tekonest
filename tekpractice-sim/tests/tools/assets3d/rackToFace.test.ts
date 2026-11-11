/**
 * Wave 5c finding D: the Python rack builder's rack_to_face (build_from_spec.py) and the placement of ports (placement.ts onFace) must agree on the
 * face-local convention of every face, the bottom included (seen from outside: x from the left, y from the io edge toward the front is d/2 - gz).
 * The Python function is pulled out of the builder source and run in Blender's Python (the module itself cannot be imported: it runs main()).
 */
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findBlender } from '../../../tools/assets3d/env'
import { buildPlacement } from '../../../tools/assets3d/placement'
import { BUILD_SCRIPT } from '../../../tools/assets3d/runBuilder'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'

const BLENDER = findBlender()
const FACES = ['io', 'opposite', 'top', 'bottom', 'left', 'right'] as const
const SIZE = { w: 482.6, h: 44.45, d: 300 }

const PY = String.raw`
import re, json, sys
src = open(sys.argv[sys.argv.index("--") + 1], encoding="utf-8").read()
pts = json.loads(sys.argv[sys.argv.index("--") + 2])
w, d = float(sys.argv[sys.argv.index("--") + 3]), float(sys.argv[sys.argv.index("--") + 4])
m = re.search(r"def rack_to_face.*?(?=\n\n\ndef )", src, re.S)
ns = {}
exec("from __future__ import annotations\n" + m.group(0), ns)
print("RESULT" + json.dumps([ns["rack_to_face"](p["face"], p["flipped"], w, d, p["gx"], p["gy"], p["gz"]) for p in pts]))
`

async function runPython(points: { face: string; flipped: boolean; gx: number; gy: number; gz: number }[]): Promise<[number, number][]> {
  const dir = await mkdtemp(join(tmpdir(), 'tekpractice-r2f-'))
  const script = join(dir, 'r2f.py')
  await writeFile(script, PY)
  return new Promise((resolve, reject) => {
    execFile(BLENDER as string, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', script, '--', BUILD_SCRIPT, JSON.stringify(points), String(SIZE.w / 1000), String(SIZE.d / 1000)], (err, out, stderr) => {
      void rm(dir, { recursive: true, force: true })
      if (err) return reject(new Error(stderr || out.slice(-600) || String(err)))
      const line = out.split(/\r?\n/).find((l) => l.startsWith('RESULT'))
      if (!line) return reject(new Error('no RESULT line: ' + out.slice(-400)))
      resolve(JSON.parse(line.slice(6)) as [number, number][])
    })
  })
}

describe(`rack_to_face agrees with the port placement on every face (${BLENDER ? 'Blender' : 'SKIPPED, Blender not found'})`, () => {
  it('the builder source defines rack_to_face once', () => {
    expect(readFileSync(BUILD_SCRIPT, 'utf8').match(/^def rack_to_face\(/gm)?.length).toBe(1)
  })

  it.skipIf(!BLENDER)('a sample point (x 120, y 70 mm) placed on each face maps back to (120, 70) mm, unflipped and with the front on the io face', async () => {
    const ports = FACES.map((face) => ({ portId: face, face, xMm: 120, yMm: 70 }))
    const placement = buildPlacement({ kind: 'device', realSizeMm: SIZE, ports, controls: [] } as unknown as AssetSpecT)
    const pts = []
    for (const flipped of [false, true]) {
      for (const [i, face] of FACES.entries()) {
        const [x, y, z] = placement.ports[i]!.pos
        // GLB space of the finished model -> the frame the builder works in (rotated 180 degrees about y when the front is the io face)
        pts.push({ face, flipped, gx: flipped ? -x : x, gy: y, gz: flipped ? -z : z })
      }
    }
    const got = await runPython(pts)
    pts.forEach((p, i) => {
      expect(got[i]![0] * 1000, `${p.face} flipped=${p.flipped} u`).toBeCloseTo(120, 6)
      expect(got[i]![1] * 1000, `${p.face} flipped=${p.flipped} v`).toBeCloseTo(70, 6)
    })
  }, 120_000)
})
