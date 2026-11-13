// The guide's own files (not the vendored copy, which has its own scan in vendor.test.ts) say nothing private: no private tokens (hashed, see privateTokens.ts),
// no id shapes.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hashToken, makeScanner, privateHits } from './privateTokens'

const ROOT = join(__dirname, '..', '..')

// Id shapes. The app's own rules (R1 to R8) may be named in prose; only the parenthesised form is banned.
const FORBIDDEN: { name: string; re: RegExp }[] = [
  { name: 'id shape', re: /\b[RFGW]-\d+/i },
  { name: 'parenthesised id', re: /\(R\d+\)/ },
]

function walk(dir: string, skip: (p: string) => boolean): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (skip(p)) continue
    if (statSync(p).isDirectory()) out.push(...walk(p, skip))
    else if (/\.(ts|css|json|md)$/.test(name)) out.push(p)
  }
  return out
}

const rel = (p: string): string => relative(ROOT, p).split(sep).join('/')
const VENDOR = join(ROOT, 'src', 'guide', 'vendor')

const files = (): string[] => [
  ...walk(join(ROOT, 'src', 'guide'), (p) => p === VENDOR),
  ...walk(join(ROOT, 'tests', 'guide'), () => false),
  // The guide's end-to-end specs (the older specs of the app are not this branch's files).
  ...walk(join(ROOT, 'tests', 'e2e'), () => false).filter((p) => /(^|[\\/])(guide|oscar)[^\\/]*$/i.test(p)),
  join(ROOT, 'src', 'main.ts'),
]

describe('the guide’s own files are public-clean', () => {
  it('scans a real list of files, none of them vendored', () => {
    const list = files().map(rel)
    expect(list.length).toBeGreaterThan(15)
    expect(list).toContain('src/main.ts')
    expect(list).toContain('src/guide/mount.ts')
    expect(list).toContain('tests/guide/publicTree.test.ts')
    expect(list.some((f) => f.startsWith('src/guide/vendor/'))).toBe(false)
    expect(list.filter((f) => f.startsWith('tests/e2e/')).every((f) => /\/(guide|oscar)[^/]*$/i.test(f))).toBe(true)
  })

  it('the parenthesised id is caught, an app rule id in prose is not', () => {
    const banned = FORBIDDEN.find((f) => f.name === 'parenthesised id')!.re
    expect(banned.test(['ends on placeChosen (', 'R7', '), then'].join(''))).toBe(true)
    expect(banned.test('R4 phantom power is the app’s own rule')).toBe(false)
    expect(banned.test('the app refuses it (rule R4 of the catalog)')).toBe(false)
  })

  it('the hashed scan catches a planted token, joined or split, in any case and punctuation, and nothing in plain prose', () => {
    // a harmless dummy word stands in for a private one: the mechanism is what is proven
    const scan = makeScanner([hashToken('zorblax'), hashToken('quuxwidget')])
    expect(scan('const a = 1 // Zorblax here')).toHaveLength(1)
    expect(scan('some zor-blax text')).toHaveLength(1) // a name split by punctuation is two adjacent tokens, tried joined
    expect(scan('zor the blax')).toEqual([]) // not adjacent
    expect(scan('quux widget')).toHaveLength(1) // two adjacent tokens, joined
    expect(scan('quux_widget')).toHaveLength(1)
    expect(scan('x/QUUX.Widget/y')).toHaveLength(1)
    expect(scan('the guide shows the next step')).toEqual([])
    expect(scan('')).toEqual([])
    // the salt matters: the same list with another salt finds nothing
    expect(makeScanner([hashToken('zorblax')], 'other-salt')('zorblax')).toEqual([])
  })

  it('a hit is reported by a hash prefix, never by the word', () => {
    const scan = makeScanner([hashToken('zorblax')])
    const [h] = scan('zorblax')
    expect(h).toMatch(/^[0-9a-f]{8}$/)
  })

  for (const { name, re } of FORBIDDEN) {
    it(`no file holds a ${name}`, () => {
      const hits: string[] = []
      for (const f of files()) {
        const text = readFileSync(f, 'utf8')
        const m = re.exec(text)
        if (m) hits.push(`${rel(f)}: ${m[0]}`)
      }
      expect(hits).toEqual([])
    })
  }
  it('no file holds a private token (hashed list)', () => {
    const hits: string[] = []
    for (const f of files()) for (const h of privateHits(readFileSync(f, 'utf8'))) hits.push(`${rel(f)}: ${h}`)
    expect(hits).toEqual([])
  })
})
