/**
 * Proposals stay proposals (master prompt B3): catalog.json is the source of truth
 * and is never overwritten; level drafts are never registered as live levels.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Device } from '../../tools/schemas'
import { loadLevel } from '../../src/engine/CatalogLoader'
import { makeRegistry } from '../helpers'

const registry = makeRegistry()

describe('catalog proposals', () => {
  const file = JSON.parse(readFileSync('content/proposals/catalog-proposals.json', 'utf8')) as {
    status: string
    devices: unknown[]
  }
  it('is labelled as a proposal for review', () => {
    expect(file.status).toMatch(/needs Oscar's review/)
  })
  it('every proposal is a valid catalog Device and never collides with an existing id', () => {
    for (const d of file.devices) {
      const parsed = Device.parse(d)
      expect(registry.deviceById.has(parsed.id), parsed.id).toBe(false)
    }
  })
})

describe('level drafts', () => {
  const dir = 'content/levels/drafts'
  const drafts = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json')
  it('exist and parse as levels, marked draft', () => {
    expect(drafts.length).toBeGreaterThan(0)
    for (const f of drafts) {
      const lvl = loadLevel(JSON.parse(readFileSync(join(dir, f), 'utf8'))) as { id: string; draft?: { status: string } }
      expect(lvl.id.startsWith('draft-')).toBe(true)
      expect(lvl.draft?.status).toMatch(/needs Oscar's review/)
    }
  })
  it('are not registered as live levels', () => {
    const main = readFileSync('src/main.ts', 'utf8')
    expect(main).not.toMatch(/levels\/drafts/)
  })
})
