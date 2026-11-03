import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { SECRET_VAR, findSecretVars, formatRefusal } from '../../tools/deploy-guard.mjs'

/**
 * Task 43d D: the deploy build (tools/build-site.mjs) must never ship an API key. @anthropic-ai/sdk is bundled in the LEGACY chunk (legacyMain-*.js) and reads
 * VITE_AI_COACH_KEY from import.meta.env; Vite inlines every VITE_* variable that exists at build time, in plain text, in a public file. Everything here runs in
 * the OS temp dir with a fake environment: no real secret is ever involved and nothing in the repository tree is read or written.
 */
const here = dirname(fileURLToPath(import.meta.url))
const tools = join(here, '..', '..', 'tools')
const tmp = mkdtempSync(join(tmpdir(), 'deploy-guard-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))
let n = 0
/** A fake project root holding the given files. */
const project = (files: Record<string, string> = {}): string => {
  const dir = join(tmp, `p${++n}`)
  mkdirSync(dir, { recursive: true })
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  return dir
}
const SENTINEL = 'sk-ant-NOT-A-REAL-KEY-zq81'

describe('SECRET_VAR (which names count)', () => {
  it.each(['VITE_AI_COACH_KEY', 'VITE_API_KEY', 'VITE_SOME_SECRET', 'VITE_GITHUB_TOKEN', 'VITE_DB_PASSWORD', 'vite_ai_coach_key', 'VITE_AI_COACH_KEY_2', 'VITE_MY_KEYBOARD'])(
    '%s is refused',
    (name) => expect(SECRET_VAR.test(name)).toBe(true),
  )
  it.each(['VITE_AI_COACH_PROVIDER', 'VITE_AI_COACH_MODEL', 'VITE_BASE', 'AI_COACH_KEY', 'NODE_KEY', 'TEKPRACTICE_BASE', 'PATH', 'KEY_VITE_X'])('%s is not', (name) =>
    expect(SECRET_VAR.test(name)).toBe(false),
  )
})

describe('findSecretVars: the environment', () => {
  it('finds a non-empty VITE_*KEY in the environment, by name only', () => {
    const found = findSecretVars({ env: { VITE_AI_COACH_KEY: SENTINEL, PATH: 'x' }, rootDir: project() })
    expect(found).toEqual([{ name: 'VITE_AI_COACH_KEY', source: 'the environment' }])
    expect(JSON.stringify(found)).not.toContain(SENTINEL)
  })
  it('finds KEY, SECRET, TOKEN and PASSWORD variables, sorted, and ignores the harmless VITE_ ones', () => {
    const found = findSecretVars({
      env: { VITE_Z_TOKEN: 'a', VITE_A_SECRET: 'b', VITE_M_PASSWORD: 'c', VITE_AI_COACH_PROVIDER: 'anthropic', VITE_AI_COACH_MODEL: 'm', VITE_B_KEY: 'd' },
      rootDir: project(),
    })
    expect(found.map((f) => f.name)).toEqual(['VITE_A_SECRET', 'VITE_B_KEY', 'VITE_M_PASSWORD', 'VITE_Z_TOKEN'])
  })
  it('an empty or blank value ships nothing and is not refused', () => {
    expect(findSecretVars({ env: { VITE_AI_COACH_KEY: '', VITE_B_TOKEN: '   ' }, rootDir: project() })).toEqual([])
  })
  it('a clean environment and a project without .env files pass', () => {
    expect(findSecretVars({ env: { PATH: 'x', VITE_AI_COACH_PROVIDER: 'anthropic' }, rootDir: project({ 'package.json': '{}' }) })).toEqual([])
  })
})

describe('findSecretVars: .env files in the project root', () => {
  it.each(['.env', '.env.local', '.env.production', '.env.production.local', '.env.development', '.env.staging'])('%s defining a key is refused, by file name', (file) => {
    const found = findSecretVars({ env: {}, rootDir: project({ [file]: `# comment\nVITE_AI_COACH_PROVIDER=anthropic\nVITE_AI_COACH_KEY=${SENTINEL}\n` }) })
    expect(found).toEqual([{ name: 'VITE_AI_COACH_KEY', source: file }])
    expect(JSON.stringify(found)).not.toContain(SENTINEL)
  })
  it('understands export, quotes, spaces and CRLF', () => {
    const text = `export VITE_A_KEY = "${SENTINEL}"\r\nVITE_B_TOKEN='x'\r\n  VITE_C_SECRET=${SENTINEL} # note\r\n`
    const found = findSecretVars({ env: {}, rootDir: project({ '.env': text }) })
    expect(found.map((f) => f.name)).toEqual(['VITE_A_KEY', 'VITE_B_TOKEN', 'VITE_C_SECRET'])
  })
  it('ignores comments, empty values, other variables, and a key only mentioned in a comment', () => {
    const text = `# VITE_AI_COACH_KEY=${SENTINEL}\nVITE_AI_COACH_KEY=\nVITE_AI_COACH_MODEL=claude\nOTHER_KEY=${SENTINEL}\n`
    expect(findSecretVars({ env: {}, rootDir: project({ '.env': text }) })).toEqual([])
  })
  it('.env.example (the documented template, never loaded by Vite) does not count, even with a value', () => {
    expect(findSecretVars({ env: {}, rootDir: project({ '.env.example': `VITE_AI_COACH_KEY=${SENTINEL}\n` }) })).toEqual([])
  })
  it('reports the variable once per place it is defined: environment and files', () => {
    const rootDir = project({ '.env': `VITE_AI_COACH_KEY=${SENTINEL}\n`, '.env.local': `VITE_AI_COACH_KEY=${SENTINEL}\n` })
    const found = findSecretVars({ env: { VITE_AI_COACH_KEY: SENTINEL }, rootDir })
    expect(found.map((f) => f.source).sort()).toEqual(['.env', '.env.local', 'the environment'])
  })
  it('a missing project root is not an error (no files to read)', () => {
    expect(findSecretVars({ env: {}, rootDir: join(tmp, 'does-not-exist') })).toEqual([])
  })
})

describe('formatRefusal', () => {
  it('is English, names every variable and where it is defined, says why, and never prints a value', () => {
    const msg = formatRefusal([
      { name: 'VITE_AI_COACH_KEY', source: 'the environment' },
      { name: 'VITE_AI_COACH_KEY', source: '.env.local' },
    ])
    expect(msg).toContain('VITE_AI_COACH_KEY')
    expect(msg).toContain('the environment')
    expect(msg).toContain('.env.local')
    expect(msg).toMatch(/plain text/)
    expect(msg).toMatch(/legacyMain/)
    expect(msg).toMatch(/refus/i)
    expect(msg).not.toContain(SENTINEL)
  })
})

describe('tools/deploy-guard.mjs (command line)', () => {
  const run = (dir: string, env: Record<string, string>) => {
    const r = spawnSync(process.execPath, [join(tools, 'deploy-guard.mjs'), dir], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '', ...env } })
    return { code: r.status, out: `${r.stdout}${r.stderr}` }
  }
  it('exit 0 and silent on a clean project', () => {
    const r = run(project({ '.env.example': 'VITE_AI_COACH_KEY=\n' }), {})
    expect(r.code).toBe(0)
    expect(r.out).toBe('')
  })
  it('exit 1 for an environment variable: the message names it and does not print the value', () => {
    const r = run(project(), { VITE_AI_COACH_KEY: SENTINEL })
    expect(r.code).toBe(1)
    expect(r.out).toContain('VITE_AI_COACH_KEY')
    expect(r.out).not.toContain(SENTINEL)
  })
  it('exit 1 for a .env file: the message names the variable and the file, not the value', () => {
    const r = run(project({ '.env': `VITE_AI_COACH_KEY=${SENTINEL}\n` }), {})
    expect(r.code).toBe(1)
    expect(r.out).toContain('VITE_AI_COACH_KEY')
    expect(r.out).toContain('.env')
    expect(r.out).not.toContain(SENTINEL)
  })
})

describe('tools/build-site.mjs refuses BEFORE building', () => {
  const repoRoot = join(here, '..', '..')
  const site = join(repoRoot, 'dist-site', 'index.html')
  it('with a secret in the environment: exit non-zero, names the variable, no value, no Vite build, dist-site untouched', () => {
    const before = existsSync(site) ? statSync(site).mtimeMs : null
    const started = Date.now()
    // cwd in the temp dir: nothing relative to the repository is used by the child
    const r = spawnSync(process.execPath, [join(tools, 'build-site.mjs')], { cwd: tmp, encoding: 'utf8', env: { PATH: process.env.PATH ?? '', VITE_AI_COACH_KEY: SENTINEL } })
    const out = `${r.stdout}${r.stderr}`
    expect(r.status).toBe(1)
    expect(out).toContain('VITE_AI_COACH_KEY')
    expect(out).not.toContain(SENTINEL)
    expect(out).not.toMatch(/vite v\d|building for production|modules transformed|\[build-site\] output/i)
    expect(Date.now() - started, 'it stopped at once, a build takes far longer').toBeLessThan(8000)
    expect(existsSync(site) ? statSync(site).mtimeMs : null).toBe(before) // not even cleaned
  })
  it('calls the guard before it removes dist-site or starts Vite (source order)', () => {
    const src = readFileSync(join(tools, 'build-site.mjs'), 'utf8')
    const guard = src.indexOf('findSecretVars(')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(src.indexOf('rmSync(out'))
    expect(guard).toBeLessThan(src.indexOf('spawnSync(process.execPath, [viteBin'))
  })
})
