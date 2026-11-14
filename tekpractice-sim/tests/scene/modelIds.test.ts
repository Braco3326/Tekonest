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
  it('is true for a shipped model (the multiprise ships one since Wave 4b), false for an unknown id', () => {
    expect(hasModel('yamaha-ql1')).toBe(true)
    expect(hasModel('multiprise-secteur')).toBe(true)
    expect(hasModel('nope')).toBe(false)
  })

  it('MODEL_IDS is exactly the shipped files', () => {
    expect([...MODEL_IDS].sort()).toEqual([...files].sort())
  })

  it('every catalog device ships a model (the multiprise was the last without one; a new device without a glb must be listed here on purpose)', () => {
    const devices = (catalogJson as { devices: { id: string }[] }).devices
    expect(devices.filter((d) => !hasModel(d.id)).map((d) => d.id)).toEqual([])
  })
})

describe('Bêta proposals (content/proposals/catalog-proposals.json) own a model only when the plan row is beta-modelled', () => {
  const proposals = (JSON.parse(readFileSync(join(__dirname, '..', '..', 'content', 'proposals', 'catalog-proposals.json'), 'utf8')) as { devices: { id: string }[] }).devices
  const plan = (JSON.parse(readFileSync(join(__dirname, '..', '..', 'content', 'proposals', 'equipment-plan.json'), 'utf8')) as { rows: { id: string; betaModelled?: boolean }[] }).rows
  const betaModelled = new Set(plan.filter((r) => r.betaModelled === true).map((r) => r.id))

  /** The ids a proposal file wrongly owns a model for: a shipped glb whose plan row is not betaModelled (a verified model for an unverified sheet). */
  const ownsModelWithoutRow = (ids: string[], hasGlb: (id: string) => boolean, beta: ReadonlySet<string>): string[] => ids.filter((id) => hasGlb(id) && !beta.has(id))
  /** The beta-modelled rows that lost their model (the badge « dimensions estimées » promises one). */
  const betaWithoutModel = (ids: string[], hasGlb: (id: string) => boolean, beta: ReadonlySet<string>): string[] => [...beta].filter((id) => ids.includes(id) && !hasGlb(id))

  it('there are proposals, and every proposal that has a shipped glb has a plan row with betaModelled true', () => {
    expect(proposals.length).toBeGreaterThan(0)
    const ids = proposals.map((p) => p.id)
    expect(ownsModelWithoutRow(ids, hasModel, betaModelled), 'proposals with a glb but no betaModelled plan row').toEqual([])
    expect(ownsModelWithoutRow(ids, (id) => MODEL_IDS.has(id), betaModelled)).toEqual([])
  })

  it('every beta-modelled plan row is a proposal and has its model (a beta-modelled device is badged « dimensions estimées » because a model ships)', () => {
    const ids = proposals.map((p) => p.id)
    expect([...betaModelled].filter((id) => !ids.includes(id)), 'betaModelled rows missing from the proposals').toEqual([])
    expect(betaWithoutModel(ids, hasModel, betaModelled)).toEqual([])
  })

  it('a promoted row is a catalogue device, not a proposal (the id left the proposals file at stage 2)', () => {
    const promoted = plan.filter((r) => (r as { promoted?: boolean }).promoted === true).map((r) => r.id)
    const catalogIds = new Set((catalogJson as { devices: { id: string }[] }).devices.map((d) => d.id))
    const inProposals = new Set(proposals.map((p) => p.id))
    expect(promoted.filter((id) => !catalogIds.has(id))).toEqual([])
    expect(promoted.filter((id) => inProposals.has(id))).toEqual([])
  })

  it('the rule itself: a non-beta proposal that owns a glb still fails, a beta-modelled one does not', () => {
    const glbs = new Set(['plain-proposal', 'beta-proposal'])
    const has = (id: string): boolean => glbs.has(id)
    const beta = new Set(['beta-proposal'])
    expect(ownsModelWithoutRow(['plain-proposal', 'beta-proposal', 'no-glb'], has, beta)).toEqual(['plain-proposal'])
    expect(ownsModelWithoutRow(['beta-proposal'], has, beta)).toEqual([])
    expect(betaWithoutModel(['beta-proposal', 'other'], (id) => id === 'other', beta)).toEqual(['beta-proposal'])
  })
})
