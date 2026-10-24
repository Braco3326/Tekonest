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
  it('no shipped string is a placeholder', () => {
    for (const entries of Object.values(COPY)) for (const t of Object.values(entries)) expect(t).not.toContain('[À REMPLACER')
  })
})
