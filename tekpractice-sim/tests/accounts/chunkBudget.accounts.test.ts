import { describe, expect, it } from 'vitest'
import { CREATION_ENTRY_MODULE, LAZY_CAPS, LEGACY_ENTRY_MODULE, evaluateBudget } from '../../tools/chunk-budget.mjs'

/** The fake build holds none of the other lazy modules, so their stale-rule failures are set aside: only what concerns accounts is judged. */
const failuresOf = (v: { failures: string[] }): string[] => v.failures.filter((f) => !/stale rule "(?!accounts)/.test(f))

/**
 * The accounts chunks are lazy: (1) a static import from the creation start is a failure, (2) once they exist in a build their size is capped,
 * (3) a build where nothing imports them yet (accounts not wired) still passes.
 */

function world(withAccounts: boolean, over: { staticImport?: boolean; dialogsBytes?: number; adapterBytes?: number } = {}) {
  const manifest: Record<string, Record<string, unknown>> = {
    'index.html': { file: 'assets/main.js', src: 'index.html', isEntry: true, imports: ['_vendor.js'], dynamicImports: ['_boot.js', '_legacy.js'] },
    '_vendor.js': { file: 'assets/vendor.js' },
    '_boot.js': { file: 'assets/boot.js', isDynamicEntry: true, imports: ['index.html', '_vendor.js'], dynamicImports: [] },
    '_legacy.js': { file: 'assets/legacy.js', isDynamicEntry: true, imports: ['_vendor.js'] },
  }
  const chunkModules: Record<string, string[]> = {
    'assets/main.js': ['src/main.ts'],
    'assets/vendor.js': ['src/scene/viewCube.ts'],
    'assets/boot.js': [CREATION_ENTRY_MODULE],
    'assets/legacy.js': [LEGACY_ENTRY_MODULE],
  }
  const sizes: Record<string, number> = { 'assets/main.js': 500, 'assets/vendor.js': 10_000, 'assets/boot.js': 900, 'assets/legacy.js': 1_100 }
  if (withAccounts) {
    manifest['_ui.js'] = { file: 'assets/accountUi.js', isDynamicEntry: true, imports: ['_vendor.js'], dynamicImports: ['_adapter.js'] }
    manifest['_adapter.js'] = { file: 'assets/supabaseService.js', isDynamicEntry: true, imports: ['_vendor.js'] }
    manifest['_boot.js'].dynamicImports = ['_ui.js']
    chunkModules['assets/accountUi.js'] = ['src/accounts/accountUi.ts', 'src/accounts/profileModel.ts']
    chunkModules['assets/supabaseService.js'] = ['src/accounts/supabaseService.ts']
    sizes['assets/accountUi.js'] = over.dialogsBytes ?? 27_000
    sizes['assets/supabaseService.js'] = over.adapterBytes ?? 231_000
    if (over.staticImport) {
      manifest['_boot.js'].imports = ['index.html', '_vendor.js', '_ui.js']
    }
  }
  const chunkTexts = Object.fromEntries(Object.keys(sizes).map((f) => [f, `export const x = '${f}'`]))
  // The type of the tool's input is declared in tools/chunk-budget.d.mts; the fake build above has the same shape.
  return { manifest, chunkModules, sizes, chunkTexts, workerAssets: [] } as unknown as Parameters<typeof evaluateBudget>[0]
}

describe('accounts chunks in the chunk budget', () => {
  it('a build with nothing importing src/accounts/ passes (the rule is optional until the UI is wired)', () => {
    const v = evaluateBudget(world(false))
    expect(failuresOf(v)).toEqual([])
    expect(v.failures.join('\n')).not.toMatch(/stale rule "accounts"/)
  })

  it('lazy accounts chunks within their caps pass', () => {
    const v = evaluateBudget(world(true))
    expect(failuresOf(v)).toEqual([])
  })

  it('a static import of the account dialogs from the creation start fails and names the module', () => {
    const v = evaluateBudget(world(true, { staticImport: true }))
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toMatch(/src\/accounts\/accountUi\.ts \[accounts\] is statically reachable/)
  })

  it('a dialogs chunk over its cap fails', () => {
    const cap = LAZY_CAPS.find((c) => c.module === 'src/accounts/accountUi.ts')!
    const v = evaluateBudget(world(true, { dialogsBytes: cap.maxBytes + 1 }))
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toMatch(/lazy chunk assets\/accountUi\.js .*above its cap/)
  })

  it('an adapter chunk over its cap fails', () => {
    const cap = LAZY_CAPS.find((c) => c.module === 'src/accounts/supabaseService.ts')!
    const v = evaluateBudget(world(true, { adapterBytes: cap.maxBytes + 1 }))
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toMatch(/accounts adapter/)
  })

  it('the caps leave room over the measured sizes (26.7 kB dialogs, 231 kB adapter)', () => {
    for (const c of LAZY_CAPS) expect(c.maxBytes).toBeGreaterThan(c.module.endsWith('accountUi.ts') ? 26_720 : 230_940)
  })
})
