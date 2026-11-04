import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { recordAsset } from '../../../tools/assets3d/manifest'
import type { ManifestEntry } from '../../../tools/assets3d/manifest'

const BASE = {
  generated: '2026-07-15 07:07',
  assets: [
    { id: 'xlr3-f', optimized: true, tris: 184, kind: 'connector', ports: 0, status: 'ok', custom: 'keep me' },
    { id: 'rj45', optimized: true, tris: 24, kind: 'connector', ports: 0, status: 'ok' },
  ],
}

const NEW_FIELDS: ManifestEntry = {
  id: 'xlr3-f',
  tool: 'meshy',
  toolVersion: 'meshy-7.1',
  date: '2026-10-29T10:00:00.000Z',
  specSource: 'https://example.com/datasheet',
  logosRemoved: false,
  tris: 590,
  gates: [{ gate: 'size', ok: true }],
}

let dir: string
let path: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tekpractice-manifest-'))
  path = join(dir, 'ASSET_MANIFEST.json')
  await writeFile(path, JSON.stringify(BASE, null, 2))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const read = async (): Promise<{ generated: string; assets: Record<string, unknown>[] }> => JSON.parse(await readFile(path, 'utf8'))

describe('recordAsset', () => {
  it('reads a manifest that starts with a UTF-8 BOM and writes it back without one', async () => {
    await writeFile(path, '﻿' + JSON.stringify(BASE, null, 2))
    recordAsset(path, NEW_FIELDS)
    const text = await readFile(path, 'utf8')
    expect(text.charCodeAt(0)).toBe(0x7b)
    expect((await read()).assets[0]).toMatchObject({ id: 'xlr3-f', tool: 'meshy' })
  })

  it('updates an existing entry in place and keeps the fields it does not know', async () => {
    recordAsset(path, NEW_FIELDS)
    const m = await read()
    expect(m.assets).toHaveLength(2)
    expect(m.assets[0]).toEqual({
      id: 'xlr3-f',
      optimized: true,
      tris: 590,
      kind: 'connector',
      ports: 0,
      status: 'ok',
      custom: 'keep me',
      tool: 'meshy',
      toolVersion: 'meshy-7.1',
      date: '2026-10-29T10:00:00.000Z',
      specSource: 'https://example.com/datasheet',
      logosRemoved: false,
      gates: [{ gate: 'size', ok: true }],
    })
    expect(m.assets[1]).toEqual(BASE.assets[1])
    expect(m.generated).toBe(BASE.generated)
  })

  it('appends a new entry with status ok when the id is not there', async () => {
    recordAsset(path, { ...NEW_FIELDS, id: 'shure-sm58', kind: 'device' })
    const m = await read()
    expect(m.assets).toHaveLength(3)
    expect(m.assets[2]).toMatchObject({ id: 'shure-sm58', kind: 'device', status: 'ok', tool: 'meshy', logosRemoved: false })
    expect(m.assets[0]).toEqual(BASE.assets[0])
  })

  it('writes 2-space JSON with a trailing newline, through a temp file that is gone afterwards', async () => {
    recordAsset(path, NEW_FIELDS)
    const text = await readFile(path, 'utf8')
    expect(text.endsWith('}\n')).toBe(true)
    expect(text.startsWith('{\n  "generated"')).toBe(true)
    expect(await readdir(dir)).toEqual(['ASSET_MANIFEST.json'])
  })

  it('refuses a file that is not valid JSON and leaves it untouched', async () => {
    await writeFile(path, '{ "assets": [ oops')
    expect(() => recordAsset(path, NEW_FIELDS)).toThrow(/not valid JSON/)
    expect(await readFile(path, 'utf8')).toBe('{ "assets": [ oops')
    expect(await readdir(dir)).toEqual(['ASSET_MANIFEST.json'])
  })

  it('refuses a JSON file without an assets array', async () => {
    await writeFile(path, '{"generated": "x"}')
    expect(() => recordAsset(path, NEW_FIELDS)).toThrow(/assets/)
    expect(await readFile(path, 'utf8')).toBe('{"generated": "x"}')
  })

  it('refuses a missing manifest instead of creating one', () => {
    expect(() => recordAsset(join(dir, 'nope.json'), NEW_FIELDS)).toThrow(/nope\.json/)
  })
})
