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
  it('reverse: every keyed deck row (hyphenated keys too) still exists in COPY, and the deck has exactly COPY\'s keys', () => {
    const rows = deck.split('\n').flatMap((l) => {
      const m = l.match(/^\| `([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)` \|/)
      return m ? [{ section: m[1], key: m[2] }] : []
    })
    const copy = COPY as Record<string, Record<string, string>>
    const stale = rows.filter((r) => !Object.prototype.hasOwnProperty.call(copy[r.section] ?? {}, r.key))
    expect(stale.map((r) => `${r.section}.${r.key}`)).toEqual([])
    // The forward test above guarantees a row per COPY key, so with no stale and no duplicate row the counts are equal:
    // a parser that silently skips rows (a key character it does not know) breaks this, with no hard-coded bound.
    const total = Object.values(COPY).reduce((n, e) => n + Object.keys(e).length, 0)
    expect(rows.length).toBe(total)
  })
  it('reverse: every `## section` heading of the deck is a COPY section, or a listed non-COPY section', () => {
    // Deliberately not COPY sections: the vocabulary rules (prose, no keys) and the catalog rule texts (Task 29).
    const NOT_COPY = new Set(['Glossaire', 'Textes des règles (catalogue)'])
    const headings = [...deck.matchAll(/^## (.+?)\s*$/gm)].map((m) => m[1])
    expect(headings.length).toBeGreaterThan(0)
    expect(headings.filter((h) => !(h in COPY) && !NOT_COPY.has(h))).toEqual([])
    for (const h of NOT_COPY) expect(headings, h).toContain(h) // an allow-list entry that no longer exists is dead weight
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
