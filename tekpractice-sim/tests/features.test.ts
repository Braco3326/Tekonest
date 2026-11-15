/**
 * The product's feature table (src/features.ts) and the all-on table the tests run against (tests/e2e/fixtures/features.full.ts).
 * 2026-11-15 (founder): the assistant and the learning game (levels, exam, sandbox, dashboard) are OFF in the shipped product until he says otherwise; Mode Création
 * (with its first-visit start screen under `?design`) is what a visitor gets on every address. The code stays: one switch each brings them back.
 * The unit tests and the end-to-end build run with the all-on table (vite.config.ts), so this file reads the real product table as text.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')

/** The object literal of `export const FEATURES: Features = { ... }` as plain data. */
function table(file: string): Record<string, boolean> {
  const src = readFileSync(join(ROOT, file), 'utf8')
  const m = /export const FEATURES: Features = \{([^}]*)\}/.exec(src)
  expect(m, `${file} has a FEATURES table`).not.toBeNull()
  const out: Record<string, boolean> = {}
  for (const part of m![1]!.split(',')) {
    const kv = /^\s*(\w+)\s*:\s*(true|false)\s*$/.exec(part)
    if (kv) out[kv[1]!] = kv[2] === 'true'
  }
  return out
}

describe('the shipped product table', () => {
  it('has the assistant off, the learning game off, and the inbox dark', () => {
    expect(table('src/features.ts')).toEqual({ levels: false, legacyPages: false, guide: false, guideLegacy: false, guideInbox: false })
  })

  it('the all-on table of the tests differs from it only by the two switches that bring the assistant and the learning pages back', () => {
    const product = table('src/features.ts')
    const full = table('tests/e2e/fixtures/features.full.ts')
    expect(Object.keys(full).sort()).toEqual(Object.keys(product).sort())
    const differing = Object.keys(product).filter((k) => product[k] !== full[k]).sort()
    expect(differing).toEqual(['guide', 'legacyPages'])
    expect(full.guide).toBe(true)
    expect(full.legacyPages).toBe(true)
  })
})
