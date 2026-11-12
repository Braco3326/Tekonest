/**
 * `npm run e2e:fresh` refuses to run without a private port: E2E_PORT unset, or one of
 * the ports other tools hold (4173, 4174, 4181, 5173, 3060), would make Playwright reuse or
 * fight a server that serves another checkout's build.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FORBIDDEN_E2E_PORTS, checkE2ePort } from '../../tools/e2e-fresh-guard.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }

describe('checkE2ePort (pure)', () => {
  it('lists exactly the five forbidden ports', () => {
    expect([...FORBIDDEN_E2E_PORTS].sort((a, b) => a - b)).toEqual([3060, 4173, 4174, 4181, 5173])
  })

  it('refuses an unset or empty E2E_PORT, with a message that names the variable', () => {
    for (const env of [{}, { E2E_PORT: '' }, { E2E_PORT: '  ' }]) {
      const r = checkE2ePort(env)
      expect(r.ok).toBe(false)
      expect(r.message).toContain('E2E_PORT')
    }
  })

  it.each(['4173', '4174', '4181', '5173', '3060'])('refuses forbidden port %s and says which', (p) => {
    const r = checkE2ePort({ E2E_PORT: p })
    expect(r.ok).toBe(false)
    expect(r.message).toContain(p)
  })

  it.each(['abc', '43.91', '-4391', '0', '70000', '4391x'])('refuses a value that is not a port: %s', (p) => {
    expect(checkE2ePort({ E2E_PORT: p }).ok).toBe(false)
  })

  it.each(['4391', '4392'])('accepts %s', (p) => {
    expect(checkE2ePort({ E2E_PORT: p })).toEqual({ ok: true, message: '' })
  })
})

describe('the e2e:fresh script', () => {
  it('runs the guard first, then the build, then playwright', () => {
    expect(pkg.scripts['e2e:fresh']).toBe('node tools/e2e-fresh-guard.mjs && npm run build && playwright test')
  })

  const run = (env: Record<string, string | undefined>) =>
    spawnSync(process.execPath, [join(ROOT, 'tools', 'e2e-fresh-guard.mjs')], {
      env: { ...process.env, E2E_PORT: undefined, ...env },
      encoding: 'utf8',
    })

  it('the guard CLI exits non-zero with a clear message when E2E_PORT is unset', () => {
    const r = run({})
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('E2E_PORT')
  })

  it('the guard CLI exits non-zero on a forbidden port', () => {
    const r = run({ E2E_PORT: '4173' })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('4173')
  })

  it('the guard CLI exits 0 on 4391', () => {
    expect(run({ E2E_PORT: '4391' }).status).toBe(0)
  })
})
