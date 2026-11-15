import { describe, expect, it } from 'vitest'
import { CREATION_ENTRY_MODULE, FORBIDDEN_STATIC, LAZY_CAPS, LEGACY_ENTRY_MODULE, evaluateBudget } from '../../tools/chunk-budget.mjs'

/** The fake build holds none of the other lazy modules, so their stale-rule failures are set aside: only the tracer is judged. */
const failuresOf = (v: { failures: string[] }): string[] => v.failures.filter((f) => !/stale rule "(?!cable tracer)/.test(f))
const MOD = 'src/creation/cableTracer.ts'

/** The scene part of the hand-drawn cables is lazy (mission 3 B stage 2): a static import from the creation start fails; its chunk has a size cap. */
function world(withTracer: boolean, over: { staticImport?: boolean; bytes?: number } = {}) {
  const manifest: Record<string, Record<string, unknown>> = {
    'index.html': { file: 'assets/main.js', src: 'index.html', isEntry: true, imports: ['_vendor.js'], dynamicImports: ['_boot.js', '_legacy.js'] },
    '_vendor.js': { file: 'assets/vendor.js' },
    '_boot.js': { file: 'assets/boot.js', isDynamicEntry: true, imports: ['index.html', '_vendor.js'], dynamicImports: [] },
    '_legacy.js': { file: 'assets/legacy.js', isDynamicEntry: true, imports: ['_vendor.js'] },
  }
  const chunkModules: Record<string, string[]> = {
    'assets/main.js': ['src/main.ts'],
    'assets/vendor.js': ['src/scene/viewCube.ts'],
    'assets/boot.js': [CREATION_ENTRY_MODULE, 'src/creation/cableRouteController.ts'],
    'assets/legacy.js': [LEGACY_ENTRY_MODULE],
  }
  const sizes: Record<string, number> = { 'assets/main.js': 500, 'assets/vendor.js': 10_000, 'assets/boot.js': 900, 'assets/legacy.js': 1_100 }
  if (withTracer) {
    manifest['_tracer.js'] = { file: 'assets/tracer.js', isDynamicEntry: true, imports: ['_vendor.js', '_boot.js'] }
    manifest['_boot.js']!.dynamicImports = ['_tracer.js']
    chunkModules['assets/tracer.js'] = [MOD]
    sizes['assets/tracer.js'] = over.bytes ?? 8_000
    if (over.staticImport) manifest['_boot.js']!.imports = ['index.html', '_vendor.js', '_tracer.js']
  }
  const chunkTexts = Object.fromEntries(Object.keys(sizes).map((f) => [f, `export const x = '${f}'`]))
  return { manifest, chunkModules, sizes, chunkTexts, workerAssets: [] } as unknown as Parameters<typeof evaluateBudget>[0]
}

describe('the cable tracer in the chunk budget', () => {
  it('has a laziness rule and a cap on its chunk', () => {
    expect(FORBIDDEN_STATIC.find((r) => r.id === 'cable tracer')?.match(MOD)).toBe(true)
    expect(LAZY_CAPS.find((c) => c.module === MOD)).toBeDefined()
  })
  it('a build without it passes (optional), and with it lazy and within its cap', () => {
    expect(failuresOf(evaluateBudget(world(false)))).toEqual([])
    expect(failuresOf(evaluateBudget(world(true)))).toEqual([])
  })
  it('a static import from the creation start fails and names the module', () => {
    const v = evaluateBudget(world(true, { staticImport: true }))
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toMatch(/src\/creation\/cableTracer\.ts \[cable tracer\] is statically reachable/)
  })
  it('a chunk over its cap fails', () => {
    const cap = LAZY_CAPS.find((c) => c.module === MOD)!
    const v = evaluateBudget(world(true, { bytes: cap.maxBytes + 1 }))
    expect(v.ok).toBe(false)
  })
})
