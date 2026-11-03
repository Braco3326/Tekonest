import { describe, expect, it } from 'vitest'
import {
  ALLOWED_STATIC,
  CREATION_ENTRY_MODULE,
  FORBIDDEN_STATIC,
  LEGACY_ENTRY_MODULE,
  RATIO,
  evaluateBudget,
  formatTable,
  type BudgetInput,
  type ChunkModules,
  type Manifest,
} from '../../tools/chunk-budget.mjs'

/**
 * Task 43a: the pure part of tools/chunk-budget.mjs. Every test runs against a small FAKE build (a manifest, the module list of each chunk, file sizes), so each
 * failure mode is provoked on purpose and a verdict of "ok" is never the default.
 */

/** A healthy fake build: creation 1 000 + 200 css, legacy 1 100 (shared vendor 10 000 and main 500 in both), every forbidden module in a lazy chunk only. */
function world(): BudgetInput & { manifest: Manifest; chunkModules: ChunkModules; sizes: Record<string, number> } {
  const manifest: Manifest = {
    'index.html': { file: 'assets/main.js', isEntry: true, imports: ['_vendor.js'], dynamicImports: ['_boot.js', '_legacy.js'] },
    '_vendor.js': { file: 'assets/vendor.js' },
    '_boot.js': {
      file: 'assets/boot.js',
      isDynamicEntry: true,
      imports: ['index.html', '_vendor.js', '_shared.js'],
      css: ['assets/boot.css'],
      dynamicImports: ['_lazy-acoustics.js', '_lazy-audio.js', '_lazy-drawer.js', '_lazy-picker.js', '_lazy-songs.js'],
    },
    '_shared.js': { file: 'assets/shared.js' },
    '_legacy.js': { file: 'assets/legacy.js', isDynamicEntry: true, imports: ['index.html', '_vendor.js'] },
    '_lazy-acoustics.js': { file: 'assets/lazy-acoustics.js', isDynamicEntry: true, imports: ['_boot.js'] },
    '_lazy-audio.js': { file: 'assets/lazy-audio.js', isDynamicEntry: true, imports: ['_boot.js'] },
    '_lazy-drawer.js': { file: 'assets/lazy-drawer.js', isDynamicEntry: true, imports: ['_boot.js'] },
    '_lazy-picker.js': { file: 'assets/lazy-picker.js', isDynamicEntry: true, imports: ['_boot.js'] },
    '_lazy-songs.js': { file: 'assets/lazy-songs.js', isDynamicEntry: true, imports: ['_boot.js'] },
  }
  const chunkModules: ChunkModules = {
    'assets/main.js': ['src/main.ts', 'src/routing.ts'],
    'assets/vendor.js': ['src/scene/viewCube.ts'],
    'assets/boot.js': [CREATION_ENTRY_MODULE, 'src/creation/copy.ts', 'src/audio/context.ts'],
    'assets/shared.js': ['src/util/disposable.ts'],
    'assets/legacy.js': [LEGACY_ENTRY_MODULE],
    'assets/lazy-acoustics.js': ['src/acoustics/field.ts', 'src/acoustics/client.ts', 'src/creation/coverageController.ts'],
    'assets/lazy-audio.js': ['src/audio/engine.ts', 'src/audio/listenerMix.ts', 'src/creation/listenController.ts'],
    'assets/lazy-drawer.js': ['src/creation/shell/inventoryDrawer.ts', 'src/creation/inventoryThumbs.ts'],
    'assets/lazy-picker.js': ['src/creation/shell/placePicker.ts', 'src/creation/shell/placePickerModel.ts', 'src/creation/roomPlanSvg.ts'],
    'assets/lazy-songs.js': ['content/songs.json', 'src/audio/songs.ts'],
  }
  const sizes: Record<string, number> = {
    'assets/main.js': 500,
    'assets/vendor.js': 10_000,
    'assets/boot.js': 900,
    'assets/boot.css': 200,
    'assets/shared.js': 100,
    'assets/legacy.js': 1_100,
    'assets/lazy-acoustics.js': 777,
    'assets/lazy-audio.js': 777,
    'assets/lazy-drawer.js': 777,
    'assets/lazy-picker.js': 777,
    'assets/lazy-songs.js': 777,
  }
  return { manifest, chunkModules, sizes }
}

const row = (v: ReturnType<typeof evaluateBudget>, name: string) => v.rows.find((r) => r.name === name)!

describe('chunk budget: sizes', () => {
  it('sums the entry and its STATIC imports (js + css), never the lazy chunks; the legacy side the same way', () => {
    const v = evaluateBudget(world())
    expect(v.failures).toEqual([])
    expect(v.ok).toBe(true)
    // creation = main 500 + vendor 10000 + boot 900 + boot.css 200 + shared 100 ; legacy = main 500 + vendor 10000 + legacy 1100
    expect(row(v, 'creation').bytes).toBe(11_700)
    expect(row(v, 'legacy').bytes).toBe(11_600)
    expect(row(v, 'creation').limit).toBe(13_340) // 11 600 x 1.15, integer maths
    expect(RATIO).toBe(1.15)
  })

  it('fails when the creation start is more than 15 % above the legacy start, passes exactly at the limit', () => {
    const w = world()
    w.sizes['assets/vendor.js'] = 0
    w.sizes['assets/main.js'] = 0
    w.sizes['assets/legacy.js'] = 1_000
    w.sizes['assets/boot.js'] = 1_150
    w.sizes['assets/boot.css'] = 0
    w.sizes['assets/shared.js'] = 0
    expect(evaluateBudget(w).ok).toBe(true) // 1150 = 1000 x 1.15, at the limit
    w.sizes['assets/shared.js'] = 1
    const v = evaluateBudget(w)
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toMatch(/creation start is 1151 bytes.*limit 1150/)
  })

  it('a missing file size is a failure, not a zero', () => {
    const w = world()
    delete w.sizes['assets/shared.js']
    const v = evaluateBudget(w)
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toMatch(/no size for assets\/shared\.js/)
  })
})

describe('chunk budget: the entries must be found', () => {
  it('fails when the creation entry module is in no chunk (a renamed boot must not turn the check into a pass)', () => {
    const w = world()
    w.chunkModules['assets/boot.js'] = ['src/creation/copy.ts']
    const v = evaluateBudget(w)
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toMatch(/creation entry .*src\/creation\/boot\.ts.* not found/)
  })
  it('fails when the legacy entry module is in no chunk', () => {
    const w = world()
    w.chunkModules['assets/legacy.js'] = []
    const v = evaluateBudget(w)
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toMatch(/legacy entry .*legacyMain.* not found/)
  })
})

describe('chunk budget: lazy modules must not be reachable by a static import from the creation entry', () => {
  // [rule id, a module that rule forbids]
  const cases: [string, string][] = [
    ['acoustics', 'src/acoustics/field.ts'],
    ['acoustics', 'src/acoustics/client.ts'],
    ['audio', 'src/audio/engine.ts'],
    ['audio', 'src/audio/listenerMix.ts'],
    ['songs', 'src/audio/songs.ts'],
    ['songs', 'content/songs.json'],
    ['inventory drawer', 'src/creation/shell/inventoryDrawer.ts'],
    ['picker thumbnails', 'src/creation/inventoryThumbs.ts'],
    ['picker thumbnails', 'src/creation/roomPlanSvg.ts'],
    ['picker thumbnails', 'src/creation/shell/placePicker.ts'],
    ['coverage controller', 'src/creation/coverageController.ts'],
    ['listen controller', 'src/creation/listenController.ts'],
  ]
  it.each(cases)('%s: %s inside the creation entry chunk fails and names the module', (_rule, mod) => {
    const w = world()
    w.chunkModules['assets/boot.js'] = [...w.chunkModules['assets/boot.js'], mod]
    const v = evaluateBudget(w)
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toContain(mod)
    expect(v.failures.join('\n')).toMatch(/assets\/boot\.js/)
  })

  it('a Vite worker import (?worker) inside the start chunk fails', () => {
    const w = world()
    w.chunkModules['assets/boot.js'] = [...w.chunkModules['assets/boot.js'], 'src/acoustics/worker.ts?worker']
    const v = evaluateBudget(w)
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toContain('src/acoustics/worker.ts?worker')
  })

  it('a TRANSITIVE static import fails: the module sits in a shared chunk the entry imports, and the path is shown', () => {
    const w = world()
    w.chunkModules['assets/shared.js'] = ['src/util/disposable.ts', 'src/acoustics/grid.ts']
    const v = evaluateBudget(w)
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toContain('src/acoustics/grid.ts')
    expect(v.failures.join('\n')).toMatch(/assets\/boot\.js -> assets\/shared\.js/)
  })

  it('a forbidden module inside the LEGACY start chunk is not this check\'s business', () => {
    const w = world()
    w.chunkModules['assets/legacy.js'] = [LEGACY_ENTRY_MODULE, 'src/audio/engine.ts']
    expect(evaluateBudget(w).ok).toBe(true)
  })

  it('the one allowed static audio module (context.ts, the gesture constraint) passes; its neighbours do not', () => {
    expect(ALLOWED_STATIC).toEqual(['src/audio/context.ts'])
    const w = world()
    expect(w.chunkModules['assets/boot.js']).toContain('src/audio/context.ts')
    expect(evaluateBudget(w).ok).toBe(true)
    w.chunkModules['assets/boot.js'] = [...w.chunkModules['assets/boot.js'], 'src/audio/balance.ts']
    const v = evaluateBudget(w)
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toContain('src/audio/balance.ts')
    expect(v.failures.join('\n')).not.toContain('src/audio/context.ts')
  })

  it('a rule that matches no module of the whole build is stale and fails (a moved file must not silently pass)', () => {
    const w = world()
    w.chunkModules['assets/lazy-songs.js'] = [] // neither songs module is in the build any more
    const v = evaluateBudget(w)
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toMatch(/stale rule.*songs/)
  })

  it('every forbidden rule has a human reason, a matcher, and is exercised by the cases above', () => {
    for (const r of FORBIDDEN_STATIC) {
      expect(r.why.length).toBeGreaterThan(10)
      expect(typeof r.match).toBe('function')
      expect(cases.some(([id]) => id === r.id) || r.optional === true).toBe(true)
    }
  })
})

describe('chunk budget: the table', () => {
  it('prints one line per entry with bytes and limit, and the verdict', () => {
    const t = formatTable(evaluateBudget(world()))
    expect(t).toContain('creation')
    expect(t).toContain('legacy')
    expect(t).toContain('11700')
    expect(t).toContain('OK')
    const w = world()
    w.chunkModules['assets/boot.js'].push('src/acoustics/field.ts')
    expect(formatTable(evaluateBudget(w))).toContain('FAIL')
  })
})
