import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { COPY } from '../../src/creation/copy'

const deck = readFileSync(fileURLToPath(new URL('../../docs/copy/creation-mode.md', import.meta.url)), 'utf8')

describe('copy deck docs/copy/creation-mode.md mirrors COPY (Task 7)', () => {
  it('has a section per COPY section, and every key with its exact French text', () => {
    for (const [section, entries] of Object.entries(COPY)) {
      expect(deck, section).toContain(`## ${section}`)
      for (const [key, text] of Object.entries(entries)) {
        const row = deck.split('\n').find((l) => l.startsWith(`| \`${section}.${key}\` |`))
        expect(row, `${section}.${key}`).toBeDefined()
        expect(row!, `${section}.${key}`).toContain(`| ${text} |`)
      }
    }
  })
  it('reverse: every keyed deck row still exists in COPY (a removed or renamed key cannot linger in the deck)', () => {
    const rows = deck.split('\n').flatMap((l) => {
      const m = l.match(/^\| `([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)` \|/)
      return m ? [{ section: m[1], key: m[2] }] : []
    })
    expect(rows.length).toBeGreaterThan(300) // the parse found the deck's rows
    const stale = rows.filter((r) => !Object.prototype.hasOwnProperty.call((COPY as Record<string, Record<string, string>>)[r.section] ?? {}, r.key))
    expect(stale.map((r) => `${r.section}.${r.key}`)).toEqual([])
  })
  it('Task 29: the rule texts are catalog data (title_fr / teach_fr), not COPY: the deck has no rule section and no rule.R* key', () => {
    expect(Object.keys(COPY)).not.toContain('rule')
    expect(deck).not.toMatch(/^## rule\s*$/m)
    expect(deck).not.toMatch(/`rule\.R[1-8]/)
  })
  it('no shipped string is a placeholder', () => {
    for (const entries of Object.values(COPY)) for (const t of Object.values(entries)) expect(t).not.toContain('[À REMPLACER')
  })
})
