import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Coach guard (Task 14, CA-16, C17): the mentor's voice placeholders
 * (« [À REMPLACER PAR OSCAR] », content/coach/tips.json, legacy only) never
 * ship in Mode Création.
 */
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
const dir = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url))
const PLACEHOLDER = /\[À REMPLACER|À REMPLACER PAR OSCAR|\[A REMPLACER/i

describe('no coach placeholder in Mode Création (CA-16)', () => {
  it('no src/creation/**/*.ts string and no content/templates JSON contains « [À REMPLACER »', () => {
    const ts = walk(dir('../../src/creation/')).filter((p) => p.endsWith('.ts'))
    const json = walk(dir('../../content/templates/')).filter((p) => p.endsWith('.json'))
    expect(ts.length).toBeGreaterThan(10)
    expect(json.length).toBeGreaterThan(0)
    for (const f of [...ts, ...json]) expect(readFileSync(f, 'utf8'), f).not.toMatch(PLACEHOLDER)
  })
  it('the guard itself catches a placeholder', () => {
    expect('[À REMPLACER PAR OSCAR — anecdote]').toMatch(PLACEHOLDER)
    expect('À REMPLACER PAR OSCAR').toMatch(PLACEHOLDER)
  })
  it('Mode Création imports nothing from the legacy coach (src/ui/coach.ts)', () => {
    expect(existsSync(dir('../../src/ui/coach.ts'))).toBe(true)
    for (const f of walk(dir('../../src/creation/')).filter((p) => p.endsWith('.ts'))) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).not.toMatch(/from\s+['"][^'"]*ui\/coach['"]/)
      expect(src, f).not.toMatch(/import\(\s*['"][^'"]*ui\/coach['"]\s*\)/)
      expect(src, f).not.toMatch(/coach\/tips\.json/)
    }
  })
})
