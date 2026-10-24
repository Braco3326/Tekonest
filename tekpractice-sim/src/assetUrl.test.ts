import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { assetUrl } from './assetUrl'

describe('assetUrl', () => {
  it('keeps root-relative URLs at the default base', () => {
    expect(assetUrl('assets/ev-re20.glb', '/')).toBe('/assets/ev-re20.glb')
  })
  it('prefixes the deploy base', () => {
    expect(assetUrl('assets/environments/', '/tekpractice/jouer/')).toBe('/tekpractice/jouer/assets/environments/')
  })
  it('tolerates a missing trailing slash and a leading slash', () => {
    expect(assetUrl('/assets/a.png', '/tekpractice/jouer')).toBe('/tekpractice/jouer/assets/a.png')
  })
})

describe('no hard-coded absolute asset URLs in src', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f)
      return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : []
    })
  it('every "/assets/" literal goes through assetUrl()', () => {
    const code = (f: string) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
        .join('\n')
    const bad = walk('src').filter((f) => /['"`]\/assets\//.test(code(f)))
    expect(bad).toEqual([])
  })
})
