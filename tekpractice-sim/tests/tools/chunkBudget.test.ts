import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
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

/**
 * A healthy fake build: creation 1 000 + 200 css, legacy 1 100 (shared vendor 10 000 and main 500 in both), every forbidden module in a lazy chunk only.
 * As in the real build the creation chunk imports the `index.html` entry (main.js) and the legacy chunk does NOT: the page entry is loaded by the browser on both
 * paths, so the budget must add it to both sides (Task 43d, review item 1).
 */
function world(): BudgetInput & { manifest: Manifest; chunkModules: ChunkModules; sizes: Record<string, number>; chunkTexts: Record<string, string>; workerAssets: string[] } {
  const manifest: Manifest = {
    'index.html': { file: 'assets/main.js', src: 'index.html', isEntry: true, imports: ['_vendor.js'], dynamicImports: ['_boot.js', '_legacy.js'] },
    '_vendor.js': { file: 'assets/vendor.js' },
    '_boot.js': {
      file: 'assets/boot.js',
      isDynamicEntry: true,
      imports: ['index.html', '_vendor.js', '_shared.js'],
      css: ['assets/boot.css'],
      dynamicImports: ['_lazy-acoustics.js', '_lazy-audio.js', '_lazy-drawer.js', '_lazy-picker.js', '_lazy-songs.js'],
    },
    '_shared.js': { file: 'assets/shared.js' },
    '_legacy.js': { file: 'assets/legacy.js', isDynamicEntry: true, imports: ['_vendor.js'] },
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
    'assets/lazy-picker.js': ['src/creation/shell/placePicker.ts', 'src/creation/shell/placePickerModel.ts', 'src/creation/placeSummary.ts', 'src/creation/placeSummary.json'],
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
  // The text of each chunk: harmless code. A chunk that carries a Web Worker reference is built by the tests that need one.
  const chunkTexts: Record<string, string> = Object.fromEntries(Object.keys(sizes).filter((f) => f.endsWith('.js')).map((f) => [f, `export const x = '${f}'`]))
  return { manifest, chunkModules, sizes, chunkTexts, workerAssets: ['assets/worker-HASH.js'] }
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

  it('the index.html entry (main.js) counts on BOTH sides, although only the creation chunk imports it: like with like, informational rows included', () => {
    const w = world()
    expect(w.manifest['_legacy.js'].imports).not.toContain('index.html') // the real shape: the legacy chunk does not import the page entry
    const v = evaluateBudget(w)
    expect(row(v, 'legacy').chunks).toBe(3) // main + vendor + legacy (was 2 before the fix)
    expect(row(v, 'creation').chunks).toBe(4) // main + vendor + boot + shared
    expect(row(v, 'legacy').bytes).toBe(500 + 10_000 + 1_100)
    // without the largest chunk (vendor, on both sides): main 500 + boot 900 + css 200 + shared 100 vs main 500 + legacy 1 100
    expect(row(v, 'creation excl. largest chunk').bytes).toBe(1_700)
    expect(row(v, 'legacy excl. largest chunk').bytes).toBe(1_600)
    expect(row(v, 'legacy excl. largest chunk').chunks).toBe(2)
  })

  it('fails when the page entry (index.html) is not in the manifest: no silent comparison of unlike sets', () => {
    const w = world()
    delete w.manifest['index.html']
    w.manifest['_boot.js'].imports = ['_vendor.js', '_shared.js']
    const v = evaluateBudget(w)
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toMatch(/page entry .*index\.html.* not found/)
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
    ['picker thumbnails', 'src/creation/placeSummary.ts'],
    ['picker thumbnails', 'src/creation/placeSummary.json'],
    ['picker thumbnails', 'src/creation/shell/placePickerModel.ts'],
    ['picker thumbnails', 'src/creation/shell/placePicker.ts'],
    ['coverage controller', 'src/creation/coverageController.ts'],
    ['listen controller', 'src/creation/listenController.ts'],
  ]
describe('chunk budget: lazy modules must not be reachable by a static import from the creation entry', () => {
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

describe('chunk budget: every start-closure chunk must have a module list (Task 43d, review item 4)', () => {
  it('a creation-closure chunk with no entry in the sidecar fails instead of being skipped', () => {
    const w = world()
    delete w.chunkModules['assets/shared.js']
    const v = evaluateBudget(w)
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toMatch(/no module list for assets\/shared\.js/)
  })
  it('the same for a legacy-closure chunk', () => {
    const w = world()
    // a chunk only the legacy start imports (the real ones: rigStore, the environment files)
    w.manifest['_legacy.js'].imports = ['_vendor.js', '_legacy-only.js']
    w.manifest['_legacy-only.js'] = { file: 'assets/legacy-only.js' }
    w.sizes['assets/legacy-only.js'] = 50
    w.chunkTexts['assets/legacy-only.js'] = 'x'
    const withList = { ...w, chunkModules: { ...w.chunkModules, 'assets/legacy-only.js': ['src/ai/index.ts'] } }
    expect(evaluateBudget(withList).ok, 'control: with its list the same world passes').toBe(true)
    const v = evaluateBudget(w) // no entry in the sidecar for it
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toMatch(/no module list for assets\/legacy-only\.js/)
  })
  it('a chunk with an EMPTY list (a vendor chunk) is fine: only a missing entry is an error', () => {
    const w = world()
    expect(w.chunkModules['assets/vendor.js']).toBeDefined()
    w.chunkModules['assets/vendor.js'] = []
    expect(evaluateBudget(w).ok).toBe(true)
  })
})

describe('chunk budget: a Web Worker started from the start closure (Task 43d, review item 2)', () => {
  // The worker script is a separate Vite sub-build: absent from the manifest and from every module list. Its only trace in the start path is TEXT.
  it('`new Worker(` in the creation entry chunk fails', () => {
    const w = world()
    w.chunkTexts['assets/boot.js'] = 'const a=1;const w=new Worker(new URL("/assets/other.js",import.meta.url));'
    const v = evaluateBudget(w)
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toMatch(/assets\/boot\.js contains `new Worker\(`/)
  })
  it('`new Worker(` in a shared chunk the entry imports fails (transitive)', () => {
    const w = world()
    w.chunkTexts['assets/shared.js'] = 'x;new  Worker (u)'
    const v = evaluateBudget(w)
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toMatch(/assets\/shared\.js/)
  })
  it('the name of an emitted worker asset in a start-closure chunk fails, even without the words new Worker', () => {
    const w = world()
    w.chunkTexts['assets/boot.js'] = 'const u="/assets/worker-HASH.js";spawn(u)'
    const v = evaluateBudget(w)
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toMatch(/assets\/boot\.js names the worker asset worker-HASH\.js/)
  })
  it('the name of the worker asset in the vendor chunk fails too (the asset name is exact, so there is no false positive to fear)', () => {
    const w = world()
    w.chunkTexts['assets/vendor.js'] = 'load("assets/worker-HASH.js")'
    expect(evaluateBudget(w).ok).toBe(false)
  })
  it('`new Worker(` in a chunk with NO project module (the Babylon vendor chunk, which has its own workers) is not flagged', () => {
    const w = world()
    w.chunkModules['assets/vendor.js'] = []
    w.chunkTexts['assets/vendor.js'] = 'class P{constructor(){this.w=new Worker(blobUrl)}}'
    expect(evaluateBudget(w).ok).toBe(true)
  })
  it("`new Worker(` in a LAZY chunk (the coverage controller) and in the legacy chunk is not this check's business", () => {
    const w = world()
    w.chunkTexts['assets/lazy-acoustics.js'] = 'new Worker(new URL("/assets/worker-HASH.js",self.location))'
    w.chunkTexts['assets/legacy.js'] = 'new Worker(x)'
    expect(evaluateBudget(w).ok).toBe(true)
  })
  it('a start-closure chunk with no text is a failure (the scan must not be skipped)', () => {
    const w = world()
    delete w.chunkTexts['assets/shared.js']
    const v = evaluateBudget(w)
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toMatch(/no text for assets\/shared\.js/)
  })
})

describe('chunk budget: each id of a rule must exist (Task 43d, review item 3)', () => {
  const idRules = FORBIDDEN_STATIC.filter((r) => r.ids)
  it('the rules with exact ids are the ones the review named', () => {
    expect(idRules.map((r) => r.id).sort()).toEqual(['coverage controller', 'inventory drawer', 'listen controller', 'picker thumbnails', 'songs'])
  })
  const ids = idRules.flatMap((r) => r.ids!.map((id) => [r.id, id] as const))
  it.each(ids)('%s: removing %s from the build (renamed / moved) is reported as stale, even though the other ids of the rule still match', (rule, id) => {
    const w = world()
    for (const f of Object.keys(w.chunkModules)) w.chunkModules[f] = w.chunkModules[f].filter((m) => m !== id)
    const v = evaluateBudget(w)
    expect(v.ok).toBe(false)
    expect(v.failures.join('\n')).toContain(`stale rule "${rule}"`)
    expect(v.failures.join('\n')).toContain(id)
  })
  it('every id of every rule is exercised by a trigger case above', () => {
    for (const [, id] of ids) expect(cases.some(([, m]) => m === id), id).toBe(true)
  })
  it('no id of the real rules is a module that this build never had (the dead roomPlanSvg.ts)', () => {
    expect(idRules.flatMap((r) => r.ids!)).not.toContain('src/creation/roomPlanSvg.ts')
  })
})

describe('chunk budget: the command line (Task 43d, review item 5)', () => {
  const script = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tools', 'chunk-budget.mjs')
  const tmp = mkdtempSync(join(tmpdir(), 'chunk-budget-cli-'))
  afterAll(() => rmSync(tmp, { recursive: true, force: true }))
  let n = 0
  type Skip = 'manifest' | 'sidecar' | 'all'
  /** Writes a fake dist/ for `w` (every file at exactly its size, its text first) in the OS temp dir and returns its path. */
  const writeDist = (w: ReturnType<typeof world>, opts: { skip?: Skip } = {}): string => {
    const dir = join(tmp, `dist${++n}`)
    mkdirSync(join(dir, 'assets'), { recursive: true })
    for (const [f, size] of Object.entries(w.sizes)) {
      const text = w.chunkTexts[f] ?? ''
      writeFileSync(join(dir, f), text + '/'.repeat(Math.max(0, size - text.length)))
    }
    if (opts.skip !== 'all') {
      mkdirSync(join(dir, '.vite'), { recursive: true })
      if (opts.skip !== 'manifest') writeFileSync(join(dir, '.vite', 'manifest.json'), JSON.stringify(w.manifest))
      if (opts.skip !== 'sidecar') writeFileSync(join(dir, '.vite', 'chunk-modules.json'), JSON.stringify(w.chunkModules))
    }
    return dir
  }
  const run = (dir: string) => {
    const r = spawnSync(process.execPath, [script, dir], { encoding: 'utf8' })
    return { code: r.status, out: `${r.stdout}${r.stderr}` }
  }
  it('exit 0 on a healthy build, with the table and "budget: OK"', () => {
    const r = run(writeDist(world()))
    expect(r.out).toContain('budget: OK')
    expect(r.code).toBe(0)
  })
  it('exit 1 when a forbidden module is in the start chunk, and the message names it', () => {
    const w = world()
    w.chunkModules['assets/boot.js'].push('src/acoustics/grid.ts')
    const r = run(writeDist(w))
    expect(r.code).toBe(1)
    expect(r.out).toContain('src/acoustics/grid.ts')
  })
  it('exit 1 when the creation start is over the limit', () => {
    const w = world()
    w.sizes['assets/boot.js'] = 5_000
    const r = run(writeDist(w))
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/above the limit/)
  })
  it('exit 1 when a start chunk names a worker asset that exists in dist/assets and is in no chunk list (the CLI finds the worker assets itself)', () => {
    const w = world()
    w.sizes['assets/worker-HASH.js'] = 20 // a file on disk that no manifest entry and no module list knows: how Vite emits a worker sub-build
    w.chunkTexts['assets/boot.js'] = 'spawn("assets/worker-HASH.js")'
    const r = run(writeDist(w))
    expect(r.code).toBe(1)
    expect(r.out).toContain('worker-HASH.js')
  })
  it('exit 1 when a chunk file named by the manifest is missing from dist/', () => {
    const dir = writeDist(world())
    rmSync(join(dir, 'assets/shared.js'))
    const r = run(dir)
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/no size for assets\/shared\.js/)
  })
  it('exit 2 when dist/.vite does not exist', () => {
    const r = run(writeDist(world(), { skip: 'all' }))
    expect(r.code).toBe(2)
    expect(r.out).toMatch(/not found.*npm run build/)
  })
  it('exit 2 when only the manifest, or only the chunk-modules sidecar, is missing', () => {
    expect(run(writeDist(world(), { skip: 'manifest' })).code).toBe(2)
    const r = run(writeDist(world(), { skip: 'sidecar' }))
    expect(r.code).toBe(2)
    expect(r.out).toContain('chunk-modules.json')
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
