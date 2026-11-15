import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * No key, URL or project ref of the account provider may live in the repository. The values are read at build time from
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (never committed). This scans every tracked or new (not ignored) file of src, supabase, tools, docs and the
 * .env* files for JWT-looking strings and provider hosts.
 */

const ROOT = resolve(__dirname, '..', '..')
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/
const PROVIDER_HOST = /\.supabase\.(co|in|net)\b/i
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|glb|gltf|bin|woff2?|ttf|otf|mp4|webm|mp3|wav|ogg|pdf|zip|ktx2|blend|hdr|exr)$/i

function trackedFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'src', 'supabase', 'tools', 'docs', '.env', '.env.*'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return out.split('\0').filter((f) => f !== '')
}

/** Pure: the problems found in one file's text. */
function findLeaks(text: string): string[] {
  const found: string[] = []
  if (JWT.test(text)) found.push('a JWT-looking string (eyJ...)')
  if (PROVIDER_HOST.test(text)) found.push('a .supabase.co host')
  return found
}

describe('findLeaks', () => {
  it('flags a JWT and a provider host', () => {
    expect(findLeaks('const k = "' + 'eyJhbGciOiJIUzI1NiIs' + '.eyJpc3MiOiJzdXBhYmFzZSJ9.abc"')).toHaveLength(1)
    expect(findLeaks('https://abcdefgh' + '.supabase' + '.co/rest')).toHaveLength(1)
  })
  it('leaves ordinary text alone', () => {
    expect(findLeaks('import.meta.env.VITE_SUPABASE_URL and eyJ is just a prefix')).toEqual([])
  })
})

describe('the repository holds no provider secret', () => {
  it('scans a non-trivial set of tracked files', () => {
    expect(trackedFiles().length).toBeGreaterThan(20)
  })

  it('no tracked file in src, supabase, tools, docs or .env* has a JWT or a .supabase.co host', () => {
    const problems: string[] = []
    for (const rel of trackedFiles()) {
      const p = join(ROOT, rel)
      if (BINARY.test(rel) || !existsSync(p)) continue
      if (statSync(p).size > 4 * 1024 * 1024) continue
      for (const what of findLeaks(readFileSync(p, 'latin1'))) problems.push(`${rel}: ${what}`)
    }
    expect(problems).toEqual([])
  })

  it('the only places that read the provider settings are the adapter and the type declarations', () => {
    const readers = trackedFiles().filter((rel) => /\.(ts|mjs|js)$/.test(rel) && /VITE_SUPABASE_(URL|ANON_KEY)/.test(readFileSync(join(ROOT, rel), 'utf8')))
    expect(readers.sort()).toEqual(expect.arrayContaining(['src/accounts/supabaseService.ts']))
    for (const r of readers) expect(r.startsWith('src/accounts/') || r.startsWith('src/vite-env') || r.startsWith('tools/') || r.startsWith('supabase/')).toBe(true)
  })
})
