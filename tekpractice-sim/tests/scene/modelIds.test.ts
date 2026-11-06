/**
 * The spawner no longer asks for `assets/<id>.glb` when the manifest does not list it (a missing file is a visible 404 on the
 * deployed site). That short-circuit is only safe while the manifest and the shipped files agree: this fails on a drift.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import manifest from '../../public/assets/ASSET_MANIFEST.json'
import catalogJson from '../../content/catalog.json'
import { MODEL_IDS, hasModel } from '../../src/scene/modelIds'

const dir = join(__dirname, '..', '..', 'public', 'assets')
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.glb'))
  .map((f) => f.slice(0, -4))
const entries = (manifest as { assets: { id: string; status: string }[] }).assets

describe('ASSET_MANIFEST.json vs public/assets/*.glb', () => {
  it('every shipped glb has an ok manifest entry (a glb added without a manifest line would never load)', () => {
    const ok = new Set(entries.filter((a) => a.status === 'ok').map((a) => a.id))
    expect(files.filter((id) => !ok.has(id))).toEqual([])
  })

  it('every ok manifest entry has its file (the manifest would otherwise promise a 404)', () => {
    expect(entries.filter((a) => a.status === 'ok' && !files.includes(a.id)).map((a) => a.id)).toEqual([])
  })

  it('no id is listed twice', () => {
    const ids = entries.map((a) => a.id)
    expect(ids.length - new Set(ids).size).toBe(0)
  })
})

describe('hasModel', () => {
  it('is true for a shipped model, false for the multiprise and for an unknown id', () => {
    expect(hasModel('yamaha-ql1')).toBe(true)
    expect(hasModel('multiprise-secteur')).toBe(false)
    expect(hasModel('nope')).toBe(false)
  })

  it('MODEL_IDS is exactly the shipped files', () => {
    expect([...MODEL_IDS].sort()).toEqual([...files].sort())
  })

  it('the catalog devices without a model are known (only the multiprise today)', () => {
    const devices = (catalogJson as { devices: { id: string }[] }).devices
    expect(devices.filter((d) => !hasModel(d.id)).map((d) => d.id)).toEqual(['multiprise-secteur'])
  })
})

describe('Bêta proposals (content/proposals/catalog-proposals.json) have no model of their own', () => {
  const proposals = (JSON.parse(readFileSync(join(__dirname, '..', '..', 'content', 'proposals', 'catalog-proposals.json'), 'utf8')) as { devices: { id: string }[] }).devices

  it('there are proposals, and none of their ids is a shipped glb (a collision would load a verified model for an unverified sheet)', () => {
    expect(proposals.length).toBeGreaterThan(0)
    expect(proposals.filter((p) => hasModel(p.id)).map((p) => p.id)).toEqual([])
    expect(proposals.filter((p) => MODEL_IDS.has(p.id)).map((p) => p.id)).toEqual([])
  })
})
