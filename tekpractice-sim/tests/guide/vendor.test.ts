// Integrity of the vendored guide module (src/guide/vendor): every file matches its manifest, the
// manifest lists exactly the files on disk, nothing private or unsafe is inside, and the import
// boundaries hold (the Mode Creation code never reaches the guide, the app reaches it only from main.ts).
import { privateHits, roleHits } from './privateTokens'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = 'src'
const VENDOR = join(SRC, 'guide', 'vendor')
const MANIFEST = join(VENDOR, 'VENDOR.json')

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out.sort()
}

const posix = (p: string) => p.split(sep).join('/')
const rel = (p: string, base: string) => posix(relative(base, p))
const read = (p: string) => readFileSync(p, 'utf8')
const sha256 = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex')

interface Manifest {
  files: Record<string, string> | { path: string; sha256: string }[]
}

function manifestEntries(): Map<string, string> {
  expect(existsSync(MANIFEST), 'src/guide/vendor/VENDOR.json exists').toBe(true)
  const m = JSON.parse(read(MANIFEST)) as Manifest
  const map = new Map<string, string>()
  if (Array.isArray(m.files)) for (const f of m.files) map.set(f.path, f.sha256)
  else for (const [k, v] of Object.entries(m.files)) map.set(k, v)
  return map
}

const vendorFiles = () => walk(VENDOR).filter((p) => rel(p, VENDOR) !== 'VENDOR.json')

// Id shapes (the private tokens are hashed, see privateTokens.ts).
const FORBIDDEN: { name: string; re: RegExp }[] = [{ name: 'id shape', re: /\b[RFGW]-\d+/i }]

describe('vendored guide module', () => {
  it('every vendored file hashes to VENDOR.json', () => {
    const entries = manifestEntries()
    expect(entries.size).toBeGreaterThan(0)
    for (const [path, hash] of entries) {
      const full = join(VENDOR, path)
      expect(existsSync(full), `${path} exists`).toBe(true)
      expect(sha256(full), `${path} hash`).toBe(hash)
    }
  })

  it('VENDOR.json lists exactly the files on disk', () => {
    const listed = [...manifestEntries().keys()].sort()
    const onDisk = vendorFiles().map((p) => rel(p, VENDOR)).sort()
    expect(onDisk.length).toBeGreaterThan(0)
    expect(listed).toEqual(onDisk)
  })

  it('guide.css lands at the root of the vendor folder', () => {
    expect(existsSync(join(VENDOR, 'guide.css'))).toBe(true)
  })

  it('no vendored file matches a forbidden pattern', () => {
    const files = vendorFiles()
    expect(files.length).toBeGreaterThan(0)
    const hits: string[] = []
    for (const f of files) {
      const text = read(f)
      const name = rel(f, VENDOR)
      for (const { name: what, re } of FORBIDDEN) if (re.test(text)) hits.push(`${name}: ${what}`)
      for (const h of privateHits(text)) hits.push(`${name}: ${h}`)
      if (name !== 'core/shape.ts') for (const h of roleHits(text)) hits.push(`${name}: ${h}`)
    }
    expect(hits).toEqual([])
  })

  it('nothing outside src/guide imports src/guide/vendor except src/main.ts', () => {
    const offenders: string[] = []
    const files = walk(SRC).filter((p) => /\.(ts|css)$/.test(p))
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) {
      const name = rel(f, SRC)
      if (name === 'main.ts' || name.startsWith('guide/')) continue
      if (/guide\/vendor/.test(read(f))) offenders.push(name)
    }
    // Tests outside tests/guide must not reach into the vendored folder either.
    const tests = walk('tests').filter((p) => /\.(ts|css)$/.test(p) && !rel(p, 'tests').startsWith('guide/'))
    expect(tests.length).toBeGreaterThan(0)
    for (const f of tests) if (/guide\/vendor/.test(read(f))) offenders.push(`tests/${rel(f, 'tests')}`)
    expect(offenders).toEqual([])
  })

  it('no file under src/creation imports src/guide', () => {
    const offenders: string[] = []
    const importRe = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g
    const files = walk(join(SRC, 'creation')).filter((p) => /\.(ts|css)$/.test(p))
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) {
      for (const m of read(f).matchAll(importRe)) {
        if (/(^|\/)guide(\/|$)/.test(m[1])) offenders.push(`${rel(f, SRC)} -> ${m[1]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('vendored code never uses innerHTML, eval or new Function', () => {
    const files = vendorFiles().filter((p) => p.endsWith('.ts'))
    expect(files.length).toBeGreaterThan(0)
    const hits: string[] = []
    for (const f of files) {
      const text = read(f)
      if (/innerHTML|outerHTML|insertAdjacentHTML/.test(text)) hits.push(`${rel(f, VENDOR)}: html injection`)
      if (/\beval\s*\(/.test(text)) hits.push(`${rel(f, VENDOR)}: eval`)
      if (/new\s+Function\b/.test(text)) hits.push(`${rel(f, VENDOR)}: new Function`)
    }
    expect(hits).toEqual([])
  })
})
