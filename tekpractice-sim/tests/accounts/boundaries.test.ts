import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '..', '..', 'src')

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []))
}

const files = walk(SRC).map((f) => ({ rel: relative(SRC, f).split('\\').join('/'), text: readFileSync(f, 'utf8') }))
const importing = (needle: RegExp) => files.filter((f) => needle.test(f.text)).map((f) => f.rel)

describe('module boundaries of the accounts code', () => {
  it('only supabaseService.ts imports the provider SDK', () => {
    expect(importing(/from ['"]@supabase\/supabase-js['"]|import\(['"]@supabase\/supabase-js['"]\)/)).toEqual(['accounts/supabaseService.ts'])
  })

  it('no production file imports the in-memory fake', () => {
    expect(importing(/(from |import\()['"][^'"]*fakeService['"]/).filter((f) => f !== 'accounts/fakeService.ts')).toEqual([])
  })

  it('the adapter is loaded with a dynamic import() only, so it is its own chunk', () => {
    const users = files.filter((f) => /(from |import\()['"][^'"]*supabaseService['"]/.test(f.text) && f.rel !== 'accounts/supabaseService.ts')
    expect(users.length).toBeGreaterThan(0)
    for (const u of users) {
      expect(u.text).not.toMatch(/^\s*import\b[^\n]*['"][^'"]*supabaseService['"]/m)
      expect(u.text).toMatch(/import\(['"][^'"]*supabaseService['"]\)/)
    }
  })

  it('nothing outside src/accounts imports the accounts code statically (the integrator must use import())', () => {
    const outside = files.filter((f) => !f.rel.startsWith('accounts/') && /^\s*import\b[^\n]*['"][^'"]*\/accounts\//m.test(f.text))
    expect(outside.map((f) => f.rel)).toEqual([])
  })

  it('there is no network call, no analytics and no storage of the password outside the adapter', () => {
    const acc = files.filter((f) => f.rel.startsWith('accounts/') && f.rel !== 'accounts/supabaseService.ts')
    for (const f of acc) {
      expect(f.text, f.rel).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon|gtag\(|analytics/i)
      expect(f.text, f.rel).not.toMatch(/localStorage|sessionStorage|indexedDB/)
    }
  })
})
