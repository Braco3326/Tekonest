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
import { LOCAL_PORT, designAddresses, resetTip } from '../../tools/onboarding-local.mjs'

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

  it('the reset tip says how to see the first visit again', () => {
    expect(resetTip()).toContain('localStorage.clear()')
  })
})

describe('package.json scripts (T0.2)', () => {
  it('e2e:fresh builds first, then runs playwright', () => {
    expect(pkg.scripts['e2e:fresh']).toBe('npm run build && playwright test')
  })

  it('onboarding:local runs the local runner', () => {
    expect(pkg.scripts['onboarding:local']).toBe('node tools/onboarding-local.mjs')
  })
})
