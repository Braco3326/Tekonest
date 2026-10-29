/**
 * Tests for tools/validate-assets: validateAssets (shipped GLBs vs their specs) and the CLI's report and exit code.
 * Everything runs in temp dirs with GLBs from makeBoxGlb.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildPlacement } from '../../../tools/assets3d/placement'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'
import { main, validateAssets } from '../../../tools/validate-assets'
import { makeBoxGlb } from './helpers'

/** A 100 x 50 x 200 mm device with one port on the io face and one knob on the top face. */
function deviceSpec(over: Partial<AssetSpecT> = {}): AssetSpecT {
  return {
    id: 'test-mixer',
    kind: 'device',
    tier: 'standard',
    realSizeMm: { w: 100, h: 50, d: 200 },
    ports: [{ portId: 'in-mic-1', face: 'io', xMm: 20, yMm: 25, confidence: 'manual' }],
    controls: [{ controlId: 'gain', kind: 'knob', face: 'top', xMm: 30, yMm: 100, axis: 'y', sizeMm: { w: 10, h: 10, d: 10 } }],
    sources: [],
    ...over,
  }
}

const SIZE_M = { w: 0.1, h: 0.05, d: 0.2 }

/** The port and control nodes of `spec`, where the placement puts them. */
function nodesOf(spec: AssetSpecT): { name: string; pos: [number, number, number] }[] {
  const placement = buildPlacement(spec)
  return [...placement.ports.map((p) => ({ name: p.name, pos: p.pos })), ...placement.controls.map((c) => ({ name: c.name, pos: c.pos }))]
}

/** A GLB that meets `spec`: a box of its size with the port and control nodes in place. */
async function goodGlb(spec: AssetSpecT): Promise<Uint8Array> {
  return makeBoxGlb({ sizeM: SIZE_M, nodes: nodesOf(spec) })
}

let root: string
let assetsDir: string
let specsDir: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'validate-assets-'))
  assetsDir = join(root, 'assets')
  specsDir = join(root, 'specs')
  mkdirSync(assetsDir)
  mkdirSync(specsDir)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const writeSpec = (spec: AssetSpecT): void => writeFileSync(join(specsDir, `${spec.id}.json`), JSON.stringify(spec))
const writeGlb = (id: string, bytes: Uint8Array): void => writeFileSync(join(assetsDir, `${id}.glb`), bytes)

describe('validateAssets', () => {
  it('reports unmigrated for a GLB without a spec', async () => {
    writeGlb('old-model', await makeBoxGlb({ sizeM: SIZE_M }))
    expect(await validateAssets(assetsDir, specsDir)).toEqual([{ id: 'old-model', status: 'unmigrated', results: [] }])
  })

  it('passes a GLB that meets its spec', async () => {
    const spec = deviceSpec()
    writeSpec(spec)
    writeGlb(spec.id, await goodGlb(spec))
    const [entry] = await validateAssets(assetsDir, specsDir)
    expect(entry).toMatchObject({ id: 'test-mixer', status: 'ok' })
    expect(entry.results.map((r) => r.gate)).toEqual(['size', 'transform', 'parts', 'portPositions', 'budget', 'textures'])
    expect(entry.results.every((r) => r.ok)).toBe(true)
  })

  it('fails when a shipped GLB breaks its spec', async () => {
    const spec = deviceSpec()
    writeSpec(spec)
    writeGlb(spec.id, await makeBoxGlb({ sizeM: { w: 0.2, h: 0.1, d: 0.4 }, nodes: [] }))
    const [entry] = await validateAssets(assetsDir, specsDir)
    expect(entry.status).toBe('failed')
    expect(entry.results.filter((r) => !r.ok).map((r) => r.gate)).toContain('size')
  })

  it('a spec without a GLB fails with missing-glb', async () => {
    writeSpec(deviceSpec())
    const [entry] = await validateAssets(assetsDir, specsDir)
    expect(entry).toMatchObject({ id: 'test-mixer', status: 'failed' })
    expect(entry.results).toHaveLength(1)
    expect(entry.results[0]).toMatchObject({ gate: 'missing-glb', ok: false })
    expect(entry.results[0].detail).toContain('test-mixer.glb')
  })

  it('an invalid spec JSON fails that entry without throwing', async () => {
    writeFileSync(join(specsDir, 'broken.json'), '{ not json')
    writeFileSync(join(specsDir, 'wrongshape.json'), JSON.stringify({ id: 'wrongshape', kind: 'device' }))
    writeFileSync(join(specsDir, 'other-name.json'), JSON.stringify(deviceSpec({ id: 'test-mixer' })))
    writeGlb('broken', await makeBoxGlb({ sizeM: SIZE_M }))
    writeGlb('wrongshape', await makeBoxGlb({ sizeM: SIZE_M }))
    const good = deviceSpec({ id: 'good-one' })
    writeSpec(good)
    writeGlb('good-one', await goodGlb(good))

    const out = await validateAssets(assetsDir, specsDir)
    const byId = Object.fromEntries(out.map((e) => [e.id, e]))
    for (const id of ['broken', 'wrongshape', 'other-name']) {
      expect(byId[id].status).toBe('failed')
      expect(byId[id].results).toHaveLength(1)
      expect(byId[id].results[0]).toMatchObject({ gate: 'spec', ok: false })
      expect(byId[id].results[0].detail.length).toBeGreaterThan(0)
    }
    expect(byId['other-name'].results[0].detail).toContain('does not match the file name')
    expect(byId['good-one'].status).toBe('ok')
  })

  it('an unreadable GLB fails that entry without throwing', async () => {
    const spec = deviceSpec()
    writeSpec(spec)
    writeFileSync(join(assetsDir, `${spec.id}.glb`), Buffer.from('this is not a glb'))
    const [entry] = await validateAssets(assetsDir, specsDir)
    expect(entry.status).toBe('failed')
    expect(entry.results[0]).toMatchObject({ gate: 'glb', ok: false })
  })

  it('ignores a nested environments directory', async () => {
    mkdirSync(join(assetsDir, 'environments'))
    writeFileSync(join(assetsDir, 'environments', 'studio.glb'), await makeBoxGlb({ sizeM: SIZE_M }))
    writeFileSync(join(assetsDir, 'thumb.png'), 'x')
    writeFileSync(join(assetsDir, 'ASSET_MANIFEST.json'), '{}')
    expect(await validateAssets(assetsDir, specsDir)).toEqual([])
  })

  it('a textured file over the texture limit fails the textures gate', async () => {
    const spec = deviceSpec()
    writeSpec(spec)
    writeGlb(spec.id, await makeBoxGlb({ sizeM: SIZE_M, nodes: nodesOf(spec), texture: { sizePx: 1100 } }))
    const [entry] = await validateAssets(assetsDir, specsDir)
    expect(entry.status).toBe('failed')
    expect(entry.results.filter((r) => !r.ok).map((r) => r.gate)).toEqual(['textures'])
  })

  it('treats a missing specs directory (or assets directory) as empty', async () => {
    writeGlb('old-model', await makeBoxGlb({ sizeM: SIZE_M }))
    expect((await validateAssets(assetsDir, join(root, 'nope'))).map((e) => e.status)).toEqual(['unmigrated'])
    expect(await validateAssets(join(root, 'nope'), join(root, 'nope2'))).toEqual([])
  })

  it('lists entries sorted by id', async () => {
    for (const id of ['b-old', 'a-old', 'c-old']) writeGlb(id, await makeBoxGlb({ sizeM: SIZE_M }))
    expect((await validateAssets(assetsDir, specsDir)).map((e) => e.id)).toEqual(['a-old', 'b-old', 'c-old'])
  })
})

describe('validate-assets CLI main', () => {
  const run = async (): Promise<{ code: number; lines: string[] }> => {
    const lines: string[] = []
    const code = await main(['--assets', assetsDir, '--specs', specsDir], (l) => lines.push(l))
    return { code, lines }
  }

  it('prints the table and the summary, exits 0 with only ok and unmigrated entries', async () => {
    const spec = deviceSpec()
    writeSpec(spec)
    writeGlb(spec.id, await goodGlb(spec))
    writeGlb('old-model', await makeBoxGlb({ sizeM: SIZE_M }))
    const { code, lines } = await run()
    expect(code).toBe(0)
    expect(lines.at(-1)).toBe('1 ok, 0 failed, 1 unmigrated')
    expect(lines.some((l) => /^old-model\s+unmigrated\s+\S/.test(l))).toBe(true)
    expect(lines.some((l) => /^test-mixer\s+ok\s+\S/.test(l))).toBe(true)
  })

  it('exits 1 and names the failing gate when an entry fails', async () => {
    writeSpec(deviceSpec())
    const { code, lines } = await run()
    expect(code).toBe(1)
    expect(lines.some((l) => /^test-mixer\s+failed\s+.*missing-glb/.test(l))).toBe(true)
    expect(lines.at(-1)).toBe('0 ok, 1 failed, 0 unmigrated')
  })

  it('works on empty and missing directories', async () => {
    const lines: string[] = []
    const code = await main(['--assets', join(root, 'x'), '--specs', join(root, 'y')], (l) => lines.push(l))
    expect(code).toBe(0)
    expect(lines.at(-1)).toBe('0 ok, 0 failed, 0 unmigrated')
  })
})
