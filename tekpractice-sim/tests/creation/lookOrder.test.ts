/**
 * T4 fix round, S6: the design package's look gate is two facts read off <html> by `mountShell` (src/creation/shell/layout.ts `lookOfRoot`): the class `cr-practice` (src/main.ts)
 * and `data-design`, which `applyDesignAttribute` writes in boot.ts. If boot ever mounted the shell BEFORE writing the attribute, no package look would apply and nothing would
 * fail loudly. This pins the order in the source, in the style of tests/creation/entryGuard.test.ts (the DOM is proven in tests/e2e/onboarding-layout.spec.ts).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

describe('the look gate order (boot.ts, layout.ts, main.ts)', () => {
  const boot = read('../../src/creation/boot.ts')

  it('boot writes data-design (applyDesignAttribute) before it mounts the shell, and only once each', () => {
    const attr = boot.indexOf('applyDesignAttribute(document.documentElement')
    const shell = boot.indexOf('mountShell(document')
    expect(attr, 'applyDesignAttribute call').toBeGreaterThan(-1)
    expect(shell, 'mountShell call').toBeGreaterThan(-1)
    expect(attr, 'data-design is set before the shell reads it').toBeLessThan(shell)
    expect(boot.split('mountShell(document').length - 1).toBe(1)
    expect(boot.split('applyDesignAttribute(document.documentElement').length - 1).toBe(1)
  })

  it('the shell reads the package through lookOfRoot (not the address), and the class is put on <html> by main.ts before bootCreation runs', () => {
    expect(read('../../src/creation/shell/layout.ts')).toContain('lookOfRoot(doc.documentElement)')
    const main = read('../../src/main.ts')
    expect(main).toContain('classList.add(PRACTICE_CLASS)')
    expect(main.indexOf('onboardingGates(location.search)')).toBeGreaterThan(-1)
  })
})
