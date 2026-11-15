/**
 * The product's feature table (src/features.ts) and the all-on table the tests run against (tests/e2e/fixtures/features.full.ts).
 * 2026-11-15 (founder): the assistant and the learning game (levels, exam, sandbox, dashboard) are OFF in the shipped product until he says otherwise; Mode Création
 * (with its first-visit start screen under `?design`) is what a visitor gets on every address. The code stays: one switch each brings them back.
 * Mission 1 (2026-11-15): the goal screens (`goals`) and the plain tutorial (`plainTutorial`) ship ON, a plain address opens design 2 (`defaultDesign`), and the accounts
 * (`accounts`) ship OFF. Mission 2 (2026-11-15): the 2D schema page (`plan2d`) is ON in both tables. The all-on table turns the accounts on and has no `defaultDesign` (a plain address of the tests keeps no design).
 * The unit tests and the end-to-end build run with the all-on table (vite.config.ts), so this file reads the real product table as text.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')

/** The object literal of `export const FEATURES: Features = { ... }` as plain data (booleans and whole numbers). */
function table(file: string): Record<string, boolean | number> {
  const src = readFileSync(join(ROOT, file), 'utf8')
  const m = /export const FEATURES: Features = \{([^}]*)\}/.exec(src)
  expect(m, `${file} has a FEATURES table`).not.toBeNull()
  const out: Record<string, boolean | number> = {}
  for (const part of m![1]!.split(',')) {
    const kv = /^\s*(\w+)\s*:\s*(true|false|\d+)\s*$/.exec(part)
    if (kv) out[kv[1]!] = kv[2] === 'true' ? true : kv[2] === 'false' ? false : Number(kv[2])
  }
  return out
}

describe('the shipped product table', () => {
  it('has the assistant off, the learning game off, the inbox dark, the goals and the plain tutorial on, the accounts off, and design 2 by default', () => {
    expect(table('src/features.ts')).toEqual({
      levels: false, legacyPages: false, guide: false, guideLegacy: false, guideInbox: false,
      goals: true, plainTutorial: true, accounts: false, plan2d: true, defaultDesign: 2,
    })
  })

  it('keeps the key order the deploy guard reads (tools/deploy-flag-guard.mjs)', () => {
    expect(Object.keys(table('src/features.ts'))).toEqual(['levels', 'legacyPages', 'guide', 'guideLegacy', 'guideInbox', 'goals', 'plainTutorial', 'accounts', 'plan2d', 'defaultDesign'])
  })

  it('the all-on table of the tests differs from it only by the switches that bring the assistant, the learning pages and the accounts back, and has no default design', () => {
    const product = table('src/features.ts')
    const full = table('tests/e2e/fixtures/features.full.ts')
    expect(Object.keys(full).sort()).toEqual(Object.keys(product).filter((k) => k !== 'defaultDesign').sort())
    expect('defaultDesign' in full, 'a plain address of the tests keeps no design').toBe(false)
    const differing = Object.keys(full).filter((k) => product[k] !== full[k]).sort()
    expect(differing).toEqual(['accounts', 'guide', 'legacyPages'])
    expect(full.guide).toBe(true)
    expect(full.legacyPages).toBe(true)
    expect(full.accounts).toBe(true)
    expect(full.goals).toBe(true)
    expect(full.plainTutorial).toBe(true)
    expect(full.plan2d, 'mission 2: the 2D schema page is on in both tables').toBe(true)
  })
})
