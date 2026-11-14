/**
 * G14e (review S13): `npm run test:onboarding` is the onboarding gate of spec 11. It builds first, runs on a private port through the same guard as `e2e:fresh`,
 * and covers what spec 11 names: the onboarding specs, the proxy, neutrality, the rule texts (11.12), the exam and legacy-guide routes (11.10) and the existing
 * specs « this work changes ». This pins the script, not the run.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ONBOARDING_SPECS } from '../../tools/onboarding-gate.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
const script = readFileSync(join(ROOT, 'tools/onboarding-gate.mjs'), 'utf8')
const e2eFiles = readdirSync(join(ROOT, 'tests/e2e')).filter((f) => f.endsWith('.spec.ts'))

describe('npm run test:onboarding', () => {
  it('is the gate script', () => {
    expect(pkg.scripts['test:onboarding']).toBe('node tools/onboarding-gate.mjs')
  })

  it('guards the port as e2e:fresh does, defaults it to 4391, builds before Playwright, keeps 3 workers', () => {
    expect(script).toContain("import { checkE2ePort } from './e2e-fresh-guard.mjs'")
    expect(script).toContain("|| '4391'")
    const build = script.indexOf("run('npm', ['run', 'build'], env)")
    const pw = script.indexOf("run('npx', ['playwright', 'test'")
    expect(build, 'the build step').toBeGreaterThan(0)
    expect(pw, 'Playwright runs after the build').toBeGreaterThan(build)
    expect(script).toContain("'--workers=3'")
  })

  it('every entry names a real spec file (or a prefix that matches some)', () => {
    for (const s of ONBOARDING_SPECS) {
      const name = s.replace('tests/e2e/', '')
      if (name.endsWith('.spec.ts')) expect(existsSync(join(ROOT, s)), s).toBe(true)
      else expect(e2eFiles.some((f) => f.startsWith(name)), s).toBe(true)
    }
  })

  it('covers what spec 11 names: rule texts, exam, guide-legacy, and the creation specs « this work changes »', () => {
    for (const must of ['rule-texts', 'exam', 'guide-legacy', 'guide-creation', 'creation-picker', 'creation-keyboard-patch', 'creation-shortcuts', 'creation-status', 'creation-listen', 'creation-polish', 'first-timer-proxy', 'engine-neutrality', 'character'])
      expect(ONBOARDING_SPECS, must).toContain(`tests/e2e/${must}.spec.ts`)
    expect(ONBOARDING_SPECS).toContain('tests/e2e/onboarding-')
  })

  it('says what it is not', () => {
    expect(script).toMatch(/What it is NOT: the full e2e suite/)
  })
})
