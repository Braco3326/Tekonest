/**
 * Tests for assets3d/make-sheet (npm run asset:sheet): input / photo / output resolution, and the real
 * renderContactSheet driven by an injected fake Blender exec (no Blender needed).
 */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PANEL_PX, VIEW_NAMES } from '../../../tools/assets3d/contactSheet'
import { firstPhoto, latestFinalGlb, main } from '../../../tools/assets3d/make-sheet'
import type { SheetDeps } from '../../../tools/assets3d/make-sheet'
import type { ExecResult } from '../../../tools/assets3d/runFixup'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'
import { makeBoxGlb } from './helpers'

const ID = 'test-amp'
const SPEC: AssetSpecT = { id: ID, kind: 'device', tier: 'standard', realSizeMm: { w: 100, h: 50, d: 200 }, ports: [], controls: [], sources: [] }

let root: string
let sourceDir: string
let assetsDir: string
let execCalls: { file: string; args: string[] }[]

/** A fake Blender: writes the four views where render_views.py would. */
async function exec(file: string, args: string[]): Promise<ExecResult> {
  execCalls.push({ file, args })
  const outDir = args[args.indexOf('--out-dir') + 1]
  await mkdir(outDir, { recursive: true })
  for (const name of VIEW_NAMES) {
    await sharp({ create: { width: PANEL_PX, height: PANEL_PX, channels: 3, background: { r: 200, g: 200, b: 200 } } }).png().toFile(join(outDir, `${name}.png`))
  }
  return { code: 0, stdout: '', stderr: '' }
}

function deps(over: Partial<SheetDeps> = {}): Partial<SheetDeps> {
  return { sourceDir, assetsDir, loadSpec: (id) => (id === ID ? SPEC : undefined), exec, blender: 'C:/fake/blender.exe', ...over }
}

const glb = (): Promise<Uint8Array> => makeBoxGlb({ sizeM: { w: 0.1, h: 0.05, d: 0.2 } })

async function addRun(stamp: string, withFinal: boolean): Promise<string> {
  const dir = join(sourceDir, ID, 'work', stamp)
  await mkdir(dir, { recursive: true })
  if (withFinal) await writeFile(join(dir, 'final.glb'), await glb())
  return dir
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'tekpractice-make-sheet-'))
  sourceDir = join(root, 'assets-source')
  assetsDir = join(root, 'public', 'assets')
  await mkdir(assetsDir, { recursive: true })
  execCalls = []
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('make-sheet input resolution', () => {
  it('latestFinalGlb picks the newest run that has a final.glb', async () => {
    expect(await latestFinalGlb(sourceDir, ID)).toBeNull()
    await addRun('2026-10-28T09-00-00-000Z', true)
    const mid = await addRun('2026-10-29T09-00-00-000Z', true)
    await addRun('2026-10-30T09-00-00-000Z', false) // newest run failed: no final.glb
    expect(await latestFinalGlb(sourceDir, ID)).toBe(join(mid, 'final.glb'))
  })

  it('firstPhoto takes the first image by name and ignores other files', async () => {
    expect(await firstPhoto(sourceDir, ID)).toBeNull()
    const dir = join(sourceDir, ID, 'photos')
    await mkdir(dir, { recursive: true })
    for (const n of ['notes.txt', 'c.webp', 'b.JPG']) await writeFile(join(dir, n), 'x')
    expect(await firstPhoto(sourceDir, ID)).toBe(join(dir, 'b.JPG'))
  })
})

describe('asset:sheet CLI', () => {
  it('defaults to the latest final.glb, writes contact-sheet.png next to it with the photo panel and the overlay', async () => {
    const run = await addRun('2026-10-29T09-00-00-000Z', true)
    const photos = join(sourceDir, ID, 'photos')
    await mkdir(photos, { recursive: true })
    await sharp({ create: { width: 64, height: 32, channels: 3, background: { r: 10, g: 20, b: 30 } } }).png().toFile(join(photos, 'front.png'))
    const out: string[] = []
    expect(await main([ID], deps(), (l) => out.push(l))).toBe(0)
    const sheet = join(run, 'contact-sheet.png')
    expect(out.at(-1)).toBe(`wrote ${sheet}`)
    expect(out.join('\n')).toContain(join(photos, 'front.png'))
    const meta = await sharp(await readFile(sheet)).metadata()
    expect(meta.width).toBe(5 * PANEL_PX) // four views + the reference photo
    expect(execCalls).toHaveLength(1)
    expect(execCalls[0].args).toContain(join(run, 'final.glb'))
  })

  it('falls back to public/assets/<id>.glb, and takes an explicit GLB and --out', async () => {
    await writeFile(join(assetsDir, `${ID}.glb`), await glb())
    expect(await main([ID], deps(), () => undefined)).toBe(0)
    expect(existsSync(join(assetsDir, 'contact-sheet.png'))).toBe(true)
    expect(execCalls[0].args).toContain(join(assetsDir, `${ID}.glb`))

    const other = join(root, 'other.glb')
    await writeFile(other, await glb())
    const target = join(root, 'sheets', 'x.png')
    expect(await main([ID, other, '--out', target], deps(), () => undefined)).toBe(0)
    expect(existsSync(target)).toBe(true)
    expect(execCalls[1].args).toContain(other)
    // no photo: four panels
    expect((await sharp(await readFile(target)).metadata()).width).toBe(4 * PANEL_PX)
  })

  it('works without a spec (no overlay) and says so', async () => {
    await writeFile(join(assetsDir, `${ID}.glb`), await glb())
    const out: string[] = []
    expect(await main([ID], deps({ loadSpec: () => undefined }), (l) => out.push(l))).toBe(0)
    expect(out.join('\n')).toMatch(/no spec: no overlay/)
  })

  it('exits 1 with a clear message when there is no GLB, no Blender, or bad arguments', async () => {
    const out: string[] = []
    expect(await main([ID], deps(), (l) => out.push(l))).toBe(1)
    expect(out.join('\n')).toMatch(/no GLB for test-amp/)

    await writeFile(join(assetsDir, `${ID}.glb`), await glb())
    out.length = 0
    expect(await main([ID], deps({ blender: null }), (l) => out.push(l))).toBe(1)
    expect(out.join('\n')).toMatch(/Blender is not installed/)

    for (const argv of [[], [ID, '--out'], [ID, '--bogus'], [ID, 'a.glb', 'b.glb']]) {
      out.length = 0
      expect(await main(argv, deps(), (l) => out.push(l))).toBe(1)
      expect(out.join('\n')).toMatch(/usage: npm run asset:sheet/)
    }
  })
})
