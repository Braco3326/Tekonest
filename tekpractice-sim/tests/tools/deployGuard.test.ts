import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, rmdirSync, symlinkSync, writeFileSync } from 'node:fs'
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
  // R1 S5: broadened to the other usual words for a credential. The app really reads three variables (src/vite-env.d.ts): only the KEY is a secret.
  it.each(['VITE_DB_PASS', 'VITE_DB_PASSWD', 'VITE_AWS_CREDENTIALS', 'VITE_CRED', 'VITE_AUTH0_CLIENT', 'VITE_OAUTH_ID', 'VITE_PRIVATE_URL', 'VITE_OPENAI_API', 'VITE_MAPS_APIKEY', 'vite_x_api_url'])(
    '%s is refused (R1 S5)',
    (name) => expect(SECRET_VAR.test(name)).toBe(true),
  )
  it('of the three variables the app reads, only VITE_AI_COACH_KEY is refused; the provider and the model are not secrets and need no allow-list', () => {
    const decl = readFileSync(join(here, '..', '..', 'src', 'vite-env.d.ts'), 'utf8')
    const names = [...decl.matchAll(/readonly (VITE_[A-Z_]+)\?:/g)].map((m) => m[1])
    expect(names.sort()).toEqual(['VITE_AI_COACH_KEY', 'VITE_AI_COACH_MODEL', 'VITE_AI_COACH_PROVIDER'])
    expect(names.filter((n) => SECRET_VAR.test(n))).toEqual(['VITE_AI_COACH_KEY'])
  })
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
  // R1 S3: the script runs in a THROWAWAY COPY of the tools (a temp project root) with a stub Vite that only writes a marker. If the guard ever regresses, the
  // build "succeeds" in the temp root: the real dist-site of the repository is never written, whatever happens here.
  const STUB_VITE = [
    "const fs = require('node:fs'); const path = require('node:path')",
    "const root = path.resolve(__dirname, '..', '..', '..')",
    "fs.writeFileSync(path.join(root, 'vite-ran.marker'), 'ran')",
    "fs.mkdirSync(path.join(root, 'dist-site'), { recursive: true })",
    "fs.writeFileSync(path.join(root, 'dist-site', 'index.html'), '<html></html>')",
    '',
  ].join('\n')
  /** A temp project root: tools/build-site.mjs + tools/deploy-guard.mjs copied, node_modules/vite/bin/vite.js the stub. */
  const fakeRoot = (): string => {
    const dir = join(tmp, `site${++n}`)
    mkdirSync(join(dir, 'tools'), { recursive: true })
    mkdirSync(join(dir, 'node_modules', 'vite', 'bin'), { recursive: true })
    for (const f of ['build-site.mjs', 'deploy-guard.mjs']) copyFileSync(join(tools, f), join(dir, 'tools', f))
    writeFileSync(join(dir, 'node_modules', 'vite', 'bin', 'vite.js'), STUB_VITE)
    return dir
  }
  const build = (dir: string, env: Record<string, string>) => {
    const r = spawnSync(process.execPath, [join(dir, 'tools', 'build-site.mjs')], { cwd: tmp, encoding: 'utf8', env: { PATH: process.env.PATH ?? '', ...env } })
    return { code: r.status, out: `${r.stdout}${r.stderr}` }
  }
  it('with a secret in the environment: exit 1, names the variable, no value, and Vite is NEVER started (the stub leaves no marker, nothing is built)', () => {
    const dir = fakeRoot()
    const r = build(dir, { VITE_AI_COACH_KEY: SENTINEL })
    expect(r.code).toBe(1)
    expect(r.out).toContain('VITE_AI_COACH_KEY')
    expect(r.out).not.toContain(SENTINEL)
    expect(existsSync(join(dir, 'vite-ran.marker')), 'Vite was started').toBe(false)
    expect(existsSync(join(dir, 'dist-site')), 'dist-site was created').toBe(false)
  })
  it('with a key in a .env file of the project root: the same', () => {
    const dir = fakeRoot()
    writeFileSync(join(dir, '.env'), `VITE_AI_COACH_KEY=${SENTINEL}\n`)
    const r = build(dir, {})
    expect(r.code).toBe(1)
    expect(r.out).toContain('.env')
    expect(existsSync(join(dir, 'vite-ran.marker'))).toBe(false)
  })
  it('control, so the tests above are not vacuous: with nothing set the same copy runs Vite (marker present, dist-site/index.html written, exit 0)', () => {
    const dir = fakeRoot()
    const r = build(dir, {})
    expect(r.out).not.toContain('REFUSED')
    expect(r.code).toBe(0)
    expect(existsSync(join(dir, 'vite-ran.marker'))).toBe(true)
    expect(existsSync(join(dir, 'dist-site', 'index.html'))).toBe(true)
  })
  it('an existing dist-site of the project is left alone when the build is refused (not even cleaned)', () => {
    const dir = fakeRoot()
    mkdirSync(join(dir, 'dist-site'))
    writeFileSync(join(dir, 'dist-site', 'old.txt'), 'old')
    expect(build(dir, { VITE_X_TOKEN: 'a' }).code).toBe(1)
    expect(existsSync(join(dir, 'dist-site', 'old.txt'))).toBe(true)
  })
  it('calls the guard before it removes dist-site or starts Vite (source order)', () => {
    const src = readFileSync(join(tools, 'build-site.mjs'), 'utf8')
    const guard = src.indexOf('findSecretVars(')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(src.indexOf('rmSync(out'))
    expect(guard).toBeLessThan(src.indexOf('spawnSync(process.execPath, [viteBin'))
  })
})

describe('the Vercel build command is guarded too (R1 S1)', () => {
  const projectRoot = join(here, '..', '..')
  const vercel = JSON.parse(readFileSync(join(projectRoot, 'vercel.json'), 'utf8')) as { buildCommand: string; outputDirectory: string; framework: string }
  it('starts with the guard, then the normal build; the other fields are kept', () => {
    expect(vercel.buildCommand).toBe('node tools/deploy-guard.mjs && npm run build')
    expect(vercel.outputDirectory).toBe('dist')
    expect(vercel.framework).toBe('vite')
  })
  it('the guard part of that very command refuses a key (run as written, from the project root)', () => {
    const guardPart = vercel.buildCommand.split('&&')[0].trim()
    const env = { ...process.env, VITE_AI_COACH_KEY: SENTINEL } // the whole environment: a shell needs ComSpec, SystemRoot...
    const r = spawnSync(guardPart, { shell: true, cwd: projectRoot, encoding: 'utf8', env })
    expect(r.status).toBe(1)
    expect(`${r.stdout}${r.stderr}`).toContain('VITE_AI_COACH_KEY')
    expect(`${r.stdout}${r.stderr}`).not.toContain(SENTINEL)
  })
})

describe('the CLIs also run when started through a link or a junction (R1 S4: a path mismatch must not make them silently do nothing)', () => {
  // A Windows junction needs no administrator right; elsewhere 'junction' is ignored and a directory symlink is made. The link is removed with rmdir, never
  // with a recursive remove through it.
  const link = join(tmp, 'tools-link')
  const makeLink = (): string => {
    if (!existsSync(link)) symlinkSync(tools, link, 'junction')
    return link
  }
  afterAll(() => {
    try {
      rmdirSync(link)
    } catch {
      /* never created */
    }
  })
  it('deploy-guard.mjs through the link: still exit 1 with a key (it used to exit 0 and print nothing)', () => {
    const r = spawnSync(process.execPath, [join(makeLink(), 'deploy-guard.mjs'), project()], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '', VITE_AI_COACH_KEY: SENTINEL } })
    expect(r.status).toBe(1)
    expect(`${r.stdout}${r.stderr}`).toContain('VITE_AI_COACH_KEY')
  })
  it('deploy-guard.mjs through the link: exit 0 and silent on a clean project', () => {
    const r = spawnSync(process.execPath, [join(makeLink(), 'deploy-guard.mjs'), project()], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '' } })
    expect(r.status).toBe(0)
    expect(`${r.stdout}${r.stderr}`).toBe('')
  })
  it('chunk-budget.mjs through the link: it runs (exit 2 and its message for a dist with no .vite, not a silent 0)', () => {
    const r = spawnSync(process.execPath, [join(makeLink(), 'chunk-budget.mjs'), project()], { encoding: 'utf8' })
    expect(r.status).toBe(2)
    expect(`${r.stdout}${r.stderr}`).toMatch(/not found.*npm run build/)
  })
})

describe('.gitignore (R1 item 12)', () => {
  const ignored = (file: string): boolean => spawnSync('git', ['check-ignore', '-q', file], { cwd: join(here, '..', '..') }).status === 0
  it.each(['.env', '.env.local', '.env.production', '.env.production.local', '.env.staging'])('%s is ignored', (f) => expect(ignored(f)).toBe(true))
  it('.env.example (the documented template) is not', () => expect(ignored('.env.example')).toBe(false))
})
