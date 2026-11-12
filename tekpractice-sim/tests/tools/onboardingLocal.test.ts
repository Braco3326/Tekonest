/**
 * T0.2: the founder's local runner (`npm run onboarding:local`). Pure parts only:
 * the address list (exactly five, on port 4392, `?design=1..5`), the reset tip
 * and the package.json wiring. The build and the preview server are not run here.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DESIGN_IDS, designFromSearch } from '../../src/design/packages'
import { LOCAL_PORT, designAddresses, killTreeCommand, resetTip } from '../../tools/onboarding-local.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }

describe('onboarding-local addresses', () => {
  it('the runner port is 4392 (4391 is the suites port)', () => {
    expect(LOCAL_PORT).toBe(4392)
  })

  it('lists exactly five addresses, on port 4392, ?design=1 to 5 in order', () => {
    const list = designAddresses()
    expect(list).toHaveLength(5)
    expect(list).toEqual([1, 2, 3, 4, 5].map((n) => `http://localhost:4392/?design=${n}`))
  })

  it('every address is a design the app accepts (same parser as boot)', () => {
    const ids = designAddresses().map((a) => designFromSearch(new URL(a).search))
    expect(ids).toEqual([...DESIGN_IDS])
  })

  it('an explicit port is honoured, never a forbidden one by default', () => {
    expect(designAddresses(5000)[0]).toBe('http://localhost:5000/?design=1')
    for (const forbidden of [4173, 4174, 4181, 5173, 3060]) {
      expect(designAddresses().join(' ')).not.toContain(`:${forbidden}/`)
    }
  })

  it('the reset tip offers the narrow reset (profile and tutorial keys only) BEFORE the full clear', () => {
    const tip = resetTip()
    for (const key of ['audio-sim/creation-onboarding.v1', 'oscar-guide.onboarding.v1', 'oscar-guide.state.v1']) {
      expect(tip).toContain(`localStorage.removeItem('${key}')`)
    }
    expect(tip.indexOf('removeItem')).toBeGreaterThanOrEqual(0)
    expect(tip.indexOf('removeItem')).toBeLessThan(tip.indexOf('localStorage.clear()'))
  })

  it('the reset tip never touches the saved projects with the narrow reset, and warns that the full clear erases them', () => {
    const tip = resetTip()
    expect(tip).not.toContain("removeItem('audio-sim/creation-projects.v1')")
    expect(tip).not.toContain("removeItem('audio-sim/creation.v1')")
    expect(tip).toMatch(/clear\(\)[^.]*(also )?eras[^.]*saved projects/i)
  })

  it('the Windows exit path kills the whole server process tree (taskkill /T /F)', () => {
    expect(killTreeCommand(1234, 'win32')).toEqual(['taskkill', ['/pid', '1234', '/T', '/F']])
    expect(killTreeCommand(1234, 'linux')).toBeNull()
  })
})

describe('package.json scripts (T0.2)', () => {
  // The guard in front of the build is pinned in tests/tools/e2eFreshGuard.test.ts (G1 fix 2); here only the tail.
  it('e2e:fresh builds, then runs playwright', () => {
    expect(pkg.scripts['e2e:fresh']).toMatch(/npm run build && playwright test$/)
  })

  it('onboarding:local runs the local runner', () => {
    expect(pkg.scripts['onboarding:local']).toBe('node tools/onboarding-local.mjs')
  })
})
