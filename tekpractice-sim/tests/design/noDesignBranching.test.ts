/**
 * T0.1 lint (spec 7.1): components read FIELDS of the active package, never its
 * id. No `design ===`, `designId ===`, `data-design` read, `dataset.design` or
 * `DESIGN_PACKAGES[` outside `src/design/packages.ts`; CSS may select
 * `html[data-design]` only in `src/design/packages.css`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src')

const TS_RULES: readonly { name: string; re: RegExp }[] = [
  { name: 'design id comparison', re: /\bdesign(Id)?\s*[!=]==?/ },
  { name: 'design id switch', re: /\bswitch\s*\(\s*design(Id)?\s*\)/ },
  { name: 'data-design access', re: /data-design|dataset\s*\.\s*design\b|dataset\s*\[\s*['"]design['"]\s*\]/ },
  { name: 'package table indexing', re: /DESIGN_PACKAGES\s*\[/ },
]
const CSS_RULES: readonly { name: string; re: RegExp }[] = [
  { name: 'data-design selector', re: /\[\s*data-design/ },
]

const TS_ALLOWED = new Set(['design/packages.ts'])
const CSS_ALLOWED = new Set(['design/packages.css'])

export function scanSource(text: string, rules: readonly { name: string; re: RegExp }[]): string[] {
  const hits: string[] = []
  text.split(/\r?\n/).forEach((line, i) => {
    for (const r of rules) if (r.re.test(line)) hits.push(`line ${i + 1}: ${r.name}: ${line.trim()}`)
  })
  return hits
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

describe('no design-id branching (lint)', () => {
  it('a crafted `if (design === 2)` trips the scan', () => {
    expect(scanSource('if (design === 2) {}', TS_RULES)).toHaveLength(1)
    expect(scanSource('if (designId !== 3) {}', TS_RULES)).toHaveLength(1)
    expect(scanSource('switch (design) {', TS_RULES)).toHaveLength(1)
    expect(scanSource("root.getAttribute('data-design')", TS_RULES)).toHaveLength(1)
    expect(scanSource('document.documentElement.dataset.design', TS_RULES)).toHaveLength(1)
    expect(scanSource('const p = DESIGN_PACKAGES[2]', TS_RULES)).toHaveLength(1)
    expect(scanSource('html[data-design="3"] .x { }', CSS_RULES)).toHaveLength(1)
  })

  it('ordinary code does not trip it', () => {
    expect(scanSource('const design = loadDesign()', TS_RULES)).toHaveLength(0)
    expect(scanSource('if (design.placements.length === 2) {}', TS_RULES)).toHaveLength(0)
    expect(scanSource('const designFromSearch = x', TS_RULES)).toHaveLength(0)
  })

  it('the real scan of src finds none outside packages.ts / packages.css', () => {
    const files = walk(SRC)
    const offenders: string[] = []
    for (const f of files) {
      const rel = relative(SRC, f).replace(/\\/g, '/')
      if (/\.(ts|tsx|mjs|js)$/.test(rel) && !TS_ALLOWED.has(rel)) {
        for (const h of scanSource(readFileSync(f, 'utf8'), TS_RULES)) offenders.push(`${rel} ${h}`)
      }
      if (rel.endsWith('.css') && !CSS_ALLOWED.has(rel)) {
        for (const h of scanSource(readFileSync(f, 'utf8'), CSS_RULES)) offenders.push(`${rel} ${h}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('the scan really walks src (guards against a wrong root)', () => {
    const rels = walk(SRC).map((f) => relative(SRC, f).replace(/\\/g, '/'))
    expect(rels).toContain('creation/boot.ts')
    expect(rels).toContain('design/creationTokens.ts')
  })
})
