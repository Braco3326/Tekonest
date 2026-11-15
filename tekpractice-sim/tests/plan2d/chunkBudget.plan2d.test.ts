import { describe, expect, it } from 'vitest'
import { CREATION_ENTRY_MODULE, FORBIDDEN_STATIC, LAZY_CAPS, LEGACY_ENTRY_MODULE, evaluateBudget } from '../../tools/chunk-budget.mjs'

/** The fake build holds none of the other lazy modules, so their stale-rule failures are set aside: only what concerns the 2D page is judged. */
const failuresOf = (v: { failures: string[] }): string[] => v.failures.filter((f) => !/stale rule "(?!plan2d)/.test(f))

/** The 2D schema page is lazy (mission 2): (1) a static import from the creation start fails, (2) its chunk has a size cap, (3) a build without it passes. */
function world(withPage: boolean, over: { staticImport?: boolean; pageBytes?: number } = {}) {
  const manifest: Record<string, Record<string, unknown>> = {
    'index.html': { file: 'assets/main.js', src: 'index.html', isEntry: true, imports: ['_vendor.js'], dynamicImports: ['_boot.js', '_legacy.js'] },
    '_vendor.js': { file: 'assets/vendor.js' },
    '_boot.js': { file: 'assets/boot.js', isDynamicEntry: true, imports: ['index.html', '_vendor.js'], dynamicImports: [] },
    '_legacy.js': { file: 'assets/legacy.js', isDynamicEntry: true, imports: ['_vendor.js'] },
  }
  const chunkModules: Record<string, string[]> = {
    'assets/main.js': ['src/main.ts'],
    'assets/vendor.js': ['src/scene/viewCube.ts'],
    'assets/boot.js': [CREATION_ENTRY_MODULE, 'src/creation/plan2dWiring.ts'],
    'assets/legacy.js': [LEGACY_ENTRY_MODULE],
  }
  const sizes: Record<string, number> = { 'assets/main.js': 500, 'assets/vendor.js': 10_000, 'assets/boot.js': 900, 'assets/legacy.js': 1_100 }
  if (withPage) {
    manifest['_view.js'] = { file: 'assets/view.js', isDynamicEntry: true, imports: ['_vendor.js', '_boot.js'] }
    manifest['_boot.js']!.dynamicImports = ['_view.js']
    chunkModules['assets/view.js'] = ['src/plan2d/view.ts', 'src/plan2d/model.ts', 'src/plan2d/patchRules.ts']
    sizes['assets/view.js'] = over.pageBytes ?? 60_000
    if (over.staticImport) manifest['_boot.js']!.imports = ['index.html', '_vendor.js', '_view.js']
  }
  const chunkTexts = Object.fromEntries(Object.keys(sizes).map((f) => [f, `export const x = '${f}'`]))
  return { manifest, chunkModules, sizes, chunkTexts, workerAssets: [] } as unknown as Parameters<typeof evaluateBudget>[0]
}

describe('the 2D schema page in the chunk budget', () => {
  it('has a laziness rule over src/plan2d/ and a cap on the page chunk', () => {
    expect(FORBIDDEN_STATIC.find((r) => r.id === 'plan2d')?.match('src/plan2d/view.ts')).toBe(true)
    expect(LAZY_CAPS.find((c) => c.module === 'src/plan2d/view.ts')).toBeDefined()
  })
  it('a build with nothing importing src/plan2d/ passes (the rule is optional)', () => {
    expect(failuresOf(evaluateBudget(world(false)))).toEqual([])
  })
  it('the lazy page chunk within its cap passes', () => {
    expect(failuresOf(evaluateBudget(world(true)))).toEqual([])
  })
  it('a static import of the page from the creation start fails and names the module', () => {
    const v = evaluateBudget(world(true, { staticImport: true }))
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toMatch(/src\/plan2d\/view\.ts \[plan2d\] is statically reachable/)
  })
  it('a page chunk over its cap fails', () => {
    const cap = LAZY_CAPS.find((c) => c.module === 'src/plan2d/view.ts')!
    const v = evaluateBudget(world(true, { pageBytes: cap.maxBytes + 1 }))
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toMatch(/lazy chunk assets\/view\.js \(2D schema page\) .*above its cap/)
  })
})
