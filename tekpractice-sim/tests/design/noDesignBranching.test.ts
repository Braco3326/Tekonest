/**
 * T0.1 lint (spec 7.1): components read FIELDS of the active package, never its
 * id, and never the `design` query key. Outside `src/design/packages.ts` there
 * must be no: `design ===`, `designId ===`, `switch (design)`, `data-design`
 * read, `dataset.design`, `DESIGN_PACKAGES[`, `pkg.id === <number>`,
 * `packageById(<literal>)`, `designFromSearch(...) === <literal>`, nor a read of
 * the `design` query key (`get('design')`, `searchParams`). CSS (and inline CSS
 * in .html) may select `[data-design]` only in `src/design/packages.css`.
 * Scanned: .ts .tsx .mts .mjs .js .html under src, and the .html pages at the
 * project root. LIMIT (stated): the scan is per line; an id copied into a
 * variable first (`const d = pkg.id; d === 2`) is not seen.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC = join(ROOT, 'src')

interface Rule {
  name: string
  re: RegExp
}

const TS_RULES: readonly Rule[] = [
  { name: 'design id comparison', re: /\bdesign(Id)?\s*[!=]==?/ },
  { name: 'design id switch', re: /\bswitch\s*\(\s*design(Id)?\s*\)/ },
  { name: 'data-design access', re: /data-design|dataset\s*\.\s*design\b|dataset\s*\[\s*['"]design['"]\s*\]/ },
  { name: 'package table indexing', re: /DESIGN_PACKAGES\s*\[/ },
  {
    // `.id` against 1..5 (number or quoted) on any receiver, or against any literal on a receiver named like a package.
    name: 'package id comparison',
    re: /\.id\s*[!=]==?\s*(?:[1-5]|['"][1-5]['"])(?![\w.-])|\b(?:pkg|pack|package|design\w*|active\w*)\??\.id\s*[!=]==?\s*(?:\d+|['"`][^'"`]*['"`])/,
  },
  { name: 'packageById literal', re: /\bpackageById\s*\(\s*(?:[1-5]\b|['"`])/ },
  { name: 'designFromSearch compared to a literal', re: /\bdesignFromSearch\s*\(.*\)\s*[!=]==?\s*(?:\d|['"`])/ },
  {
    name: 'design query key read',
    re: /\.(?:get|getAll|has)\s*\(\s*['"`]design['"`]\s*\)|searchParams\s*\[\s*['"]design['"]\s*\]|searchParams[^;\n]*['"`]design['"`]/,
  },
]
const CSS_RULES: readonly Rule[] = [{ name: 'data-design selector', re: /\[\s*data-design/ }]

const TS_ALLOWED = new Set(['design/packages.ts'])
const CSS_ALLOWED = new Set(['design/packages.css'])

export function scanSource(text: string, rules: readonly Rule[]): string[] {
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

const ruleOf = (rules: readonly Rule[], name: string): Rule => {
  const r = rules.find((x) => x.name === name)
  if (!r) throw new Error(`no lint rule named "${name}"`)
  return r
}

/** One table row per rule: a line it must flag, and a line it must leave alone. */
const CASES: readonly { rules: readonly Rule[]; name: string; flags: readonly string[]; ok: readonly string[] }[] = [
  {
    rules: TS_RULES,
    name: 'design id comparison',
    flags: ['if (design === 2) {}', 'if (designId !== 3) {}', 'const a = designId == 4'],
    ok: ['const design = loadDesign()', 'if (design.placements.length === 2) {}', 'const designFromSearch = x'],
  },
  {
    rules: TS_RULES,
    name: 'design id switch',
    flags: ['switch (design) {', 'switch (designId) {'],
    ok: ['switch (design.kind) {', 'switch (mode) {'],
  },
  {
    rules: TS_RULES,
    name: 'data-design access',
    flags: [
      "root.getAttribute('data-design')",
      'document.documentElement.dataset.design',
      "document.documentElement.dataset['design']",
    ],
    ok: ["root.getAttribute('data-theme')", 'el.dataset.designer'],
  },
  {
    rules: TS_RULES,
    name: 'package table indexing',
    flags: ['const p = DESIGN_PACKAGES[2]', 'DESIGN_PACKAGES [id]'],
    ok: ['const DESIGN_PACKAGES: Readonly<Record<number, X>> = {', 'for (const p of Object.values(DESIGN_PACKAGES)) {}'],
  },
  {
    rules: TS_RULES,
    name: 'package id comparison',
    flags: [
      'if (pkg.id === 2) {}',
      'if (pkg.id == 3) {}',
      'if (activePackage(s)?.id === 4) {}',
      "if (p.id === '5') {}",
      "const x = pack.id !== '1'",
      "if (design.id === 'a') {}",
    ],
    ok: [
      'if (a.id === b.id) {}',
      "if (device.id === 'yamaha-ql1') {}",
      'if (r.id === deviceId) {}',
      'if (pkg.nameKey === key) {}',
      'if (item.id === 12) {}',
    ],
  },
  {
    rules: TS_RULES,
    name: 'packageById literal',
    flags: ['const p = packageById(2)', "packageById( '3' )", 'packageById(4 as DesignId)'],
    ok: ['const p = packageById(id)', 'packageById(pkg.id)', 'function packageById(id: DesignId) {'],
  },
  {
    rules: TS_RULES,
    name: 'designFromSearch compared to a literal',
    flags: [
      'if (designFromSearch(location.search) === 2) {}',
      "if (designFromSearch(s) == '3') {}",
      'const on = designFromSearch(s) !== 5',
    ],
    ok: [
      'if (designFromSearch(s) === null) {}',
      'const id = designFromSearch(location.search)',
      'if (designFromSearch(s) === other) {}',
    ],
  },
  {
    rules: TS_RULES,
    name: 'design query key read',
    flags: [
      "new URLSearchParams(location.search).get('design')",
      'params.getAll("design")',
      "if (p.has('design')) {}",
      "const v = new URL(u).searchParams.get('design')",
      "const d = searchParams['design']",
    ],
    ok: ["params.get('level')", "params.get('legacy') === '1'", "const href = '/?design=1'", 'params.get(designKey)'],
  },
  {
    rules: CSS_RULES,
    name: 'data-design selector',
    flags: ['html[data-design="3"] .x { }', 'html[ data-design] .y {}'],
    ok: ['html[data-theme="dark"] .x { }', '.data-design-note { }'],
  },
]

describe('no design-id branching (lint)', () => {
  for (const c of CASES) {
    describe(`rule: ${c.name}`, () => {
      it.each(c.flags)('flags this: %s', (line) => {
        const hits = scanSource(line, [ruleOf(c.rules, c.name)])
        expect(hits).toHaveLength(1)
      })
      it.each(c.ok)('does not flag this: %s', (line) => {
        expect(scanSource(line, [ruleOf(c.rules, c.name)])).toEqual([])
      })
    })
  }

  it('the real scan of src and the root pages finds none outside packages.ts / packages.css', () => {
    const files = [...walk(SRC), ...readdirSync(ROOT).filter((n) => n.endsWith('.html')).map((n) => join(ROOT, n))]
    const offenders: string[] = []
    for (const f of files) {
      const rel = relative(SRC, f).replace(/\\/g, '/')
      const isCode = /\.(ts|tsx|mts|mjs|js|html)$/.test(rel)
      const isCss = rel.endsWith('.css') || rel.endsWith('.html')
      if (!isCode && !isCss) continue
      const text = readFileSync(f, 'utf8')
      if (isCode && !TS_ALLOWED.has(rel)) for (const h of scanSource(text, TS_RULES)) offenders.push(`${rel} ${h}`)
      if (isCss && !CSS_ALLOWED.has(rel)) for (const h of scanSource(text, CSS_RULES)) offenders.push(`${rel} ${h}`)
    }
    expect(offenders).toEqual([])
  })

  it('the scan really walks src, .mts / .html are in its extension set, and the root pages exist', () => {
    const rels = walk(SRC).map((f) => relative(SRC, f).replace(/\\/g, '/'))
    expect(rels).toContain('creation/boot.ts')
    expect(rels).toContain('design/creationTokens.ts')
    expect(readdirSync(ROOT).filter((n) => n.endsWith('.html')).length).toBeGreaterThan(0)
    expect(scanSource('const d = designFromSearch(s) === 2', TS_RULES).length).toBeGreaterThan(0)
  })
})
