/**
 * Night wave 1, item 8: the Genelec 8030C .glb is ONE mesh that includes its floor stand (a base plate and a thin neck under the cabinet), so the
 * height normalisation (the real height of the device) used to shrink the cabinet to about 73 % of its size. The catalog declares where the
 * cabinet starts (`modelBody.baseFraction`, a share of the model's total height, measured on the file); Mode Création normalises the cabinet's
 * height instead of the whole model's (DeviceSpawner, behind the existing `alignFront` option; the legacy path is untouched).
 *
 * This file is the oracle for that DATA: it re-measures the fraction on the shipped file with a rule that does not read the catalog (the cabinet
 * starts where the footprint stops being a thin neck), and compares. It also holds the arithmetic of the scale.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { describe, expect, it } from 'vitest'
import { bodyHeightOf, scaleForHeight } from '../../src/scene/modelBody'

const draco3d = createRequire(import.meta.url)('draco3dgltf') as { createDecoderModule(): Promise<unknown> }
const root = resolve(__dirname, '../..')
const catalog = JSON.parse(readFileSync(resolve(root, 'content/catalog.json'), 'utf8')) as {
  devices: { id: string; modelBody?: { baseFraction: number; cabinetHeightM: number; evidence: string } }[]
}

/** True when the shipped file is a pipeline model (a root node carries the `tekpractice` extras: exact real size, no stand, ports from the spec). */
async function isPipelineModel(id: string): Promise<boolean> {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() })
  const doc = await io.read(resolve(root, `public/assets/${id}.glb`))
  return doc.getRoot().listNodes().some((n) => (n.getExtras() as { tekpractice?: unknown } | null)?.tekpractice !== undefined)
}

/** Every vertex of the file in glTF model space (the nodes' own transforms applied), y up. */
async function vertices(id: string): Promise<number[][]> {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() })
  const doc = await io.read(resolve(root, `public/assets/${id}.glb`))
  const pts: number[][] = []
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh()
    if (!m) continue
    const w = n.getWorldMatrix()
    for (const prim of m.listPrimitives()) {
      const a = prim.getAttribute('POSITION')!
      const v = [0, 0, 0]
      for (let i = 0; i < a.getCount(); i++) {
        a.getElement(i, v)
        pts.push([w[0] * v[0] + w[4] * v[1] + w[8] * v[2] + w[12], w[1] * v[0] + w[5] * v[1] + w[9] * v[2] + w[13], w[2] * v[0] + w[6] * v[1] + w[10] * v[2] + w[14]])
      }
    }
  }
  return pts
}

/**
 * Where the cabinet starts, as a share of the total height: slice the model in 1 % bands; a band is « thin » when its footprint (the larger of the x and
 * z spans) is under 35 % of the widest band's. The cabinet starts at the first band above the LAST thin band that sits under the model's middle (the
 * neck of the stand); the base plate under the neck is wide but is below it.
 */
function measuredBaseFraction(pts: number[][]): number {
  const ys = pts.map((p) => p[1])
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  const bands = 100
  const foot = Array.from({ length: bands }, (_, b) => {
    const inBand = pts.filter((p) => Math.min(bands - 1, Math.floor(((p[1] - lo) / (hi - lo)) * bands)) === b)
    if (!inBand.length) return 0
    const span = (k: number): number => Math.max(...inBand.map((p) => p[k])) - Math.min(...inBand.map((p) => p[k]))
    return Math.max(span(0), span(2))
  })
  const widest = Math.max(...foot)
  let lastThin = -1
  // the stand is the thin run that starts at the bottom: it ends at the first wide band. A band without a vertex is skipped (a scripted
  // cabinet has vertices only at its bevel rings, its faces and its socket pockets, so most of its bands hold none or only a pocket ring).
  for (let b = 0; b < bands / 2; b++) {
    if (foot[b] === 0) continue
    if (foot[b] >= 0.35 * widest) break
    lastThin = b
  }
  return (lastThin + 1) / bands
}

describe('the 8030C has no floor stand any more (rebuilt), so the catalog declares no modelBody (2026-11-10)', () => {
  it('the shipped 8030C is a pipeline model whose footprint has no stand neck, and the catalog declares no modelBody for it', async () => {
    const dev = catalog.devices.find((d) => d.id === 'genelec-8030c')!
    expect(dev.modelBody, 'the stand data of the legacy scan was removed with the legacy scan').toBeUndefined()
    expect(await isPipelineModel('genelec-8030c'), 'the tekpractice extras: the spawner applies no height normalisation to it').toBe(true)
    // Rebuilt (Meshy, fixed up to the spec): the cabinet and its four Iso-Pod feet at the real 299 mm, NO floor stand.
    expect(measuredBaseFraction(await vertices('genelec-8030c')), 'no stand under the rebuilt cabinet').toBeLessThan(0.05)
  })

  it('no device declares a stand: every loudspeaker model is a single cabinet at its real size', () => {
    expect(catalog.devices.filter((d) => d.modelBody !== undefined).map((d) => d.id)).toEqual([])
  })
})

describe('bodyHeightOf / scaleForHeight', () => {
  it('the cabinet is the model\'s height minus the stand\'s share; no stand = the whole model', () => {
    expect(bodyHeightOf(0.5, 0.3)).toBeCloseTo(0.35, 12)
    expect(bodyHeightOf(0.5, undefined)).toBe(0.5)
    expect(bodyHeightOf(0.5, 0)).toBe(0.5)
  })
  it('the uniform scale makes the cabinet the real height: without the stand a taller scale than the whole model would give', () => {
    // 0.285 m is the cabinet target here (cabinetHeightM); the stand share (baseFraction) is the third argument
    const whole = scaleForHeight(0.285, 0.55, undefined)
    const body = scaleForHeight(0.285, 0.55, 0.285)
    expect(whole).toBeCloseTo(0.285 / 0.55, 12)
    expect(body).toBeCloseTo(0.285 / (0.55 * 0.715), 12)
    expect(body).toBeGreaterThan(whole)
    expect(0.55 * (1 - 0.285) * body).toBeCloseTo(0.285, 12) // the cabinet, in metres
  })
  it('keeps the old behaviour for an unusable model or a nonsense fraction (scale 1, or the whole model)', () => {
    expect(scaleForHeight(0.285, 0, 0.3)).toBe(1)
    expect(scaleForHeight(0.285, 1e-9, 0.3)).toBe(1)
    expect(bodyHeightOf(0.5, 1)).toBe(0.5) // a stand that is the whole model is not a stand
    expect(bodyHeightOf(0.5, -0.2)).toBe(0.5)
    expect(bodyHeightOf(0.5, Number.NaN)).toBe(0.5)
  })
})
