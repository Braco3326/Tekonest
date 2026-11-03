// Chunk budget (Task 43a, plan Task 43). `npm run build && npm run budget`.
//
// Two rules about what the browser must load to START Mode Création (the "creation start"):
//   1. SIZE: creation start <= legacy start x 1.15. Both sides are the sum of the RAW bytes (not gzip) of the entry chunk, every chunk it imports STATICALLY
//      (transitively) and the CSS files of those chunks. Lazy chunks (`dynamicImports`) are never counted. LIKE WITH LIKE (Task 43d): the browser loads the
//      `index.html` entry (main-*.js, src/main.ts, the route decision) on BOTH paths, but only the creation chunk imports it in the manifest, so the
//      page entry and its own static closure are added to BOTH sides as a second root. The vendor (Babylon) chunk is in both and is over 90 % of each
//      (92 % of the creation start in the 43d build), so the ratio is loose by construction; a second, informational row shows the same sums without the
//      largest chunk of each closure. It has no limit. What is left of the difference there is real: the legacy start also carries the Anthropic SDK, rigStore
//      and the 7 environment files, the creation start the Mode Création shell.
//   2. LAZINESS: the acoustics code (which includes the worker client and the worker), Web Audio, the inventory drawer, the place-picker thumbnails and the
//      songs module must not be reachable from the creation start by a static import. They are dynamic imports (CA-18, plan "Performance").
//
// HOW EACH MODULE IS IDENTIFIED. Vite's manifest (dist/.vite/manifest.json) is chunk-level: it names a module (`src`) only when that module is the root of a
// chunk, so a module merged into the start chunk by a careless static import would simply vanish from it. The check would then pass for the wrong reason.
// vite.config.ts therefore also writes dist/.vite/chunk-modules.json (the `chunkModules` plugin: chunk file -> project modules inside it, root-relative,
// node_modules left out). The graph (which chunk imports which) comes from the manifest; "is module M inside a chunk of the creation start" comes from that file.
//   - creation entry = the chunk that holds src/creation/boot.ts   (src/main.ts, the index.html entry, loads it with `import('./creation/boot')`)
//   - legacy entry   = the chunk that holds src/legacyMain.ts      (same file, `import('./legacyMain')`)
//   - the worker: the acoustics worker is a separate Vite sub-build (dist/assets/worker-HASH.js), in no manifest entry and in no module list. The line that starts
//     it is `new Worker(new URL('../acoustics/worker.ts', import.meta.url))` in src/creation/coverageController.ts (src/acoustics/client.ts takes the factory
//     from its caller). That file is a forbidden module, but the same line written in boot.ts would leave no trace in any module list, so the TEXT of the start
//     closure is scanned too: any emitted worker asset name (a JS file of dist/ that no chunk list knows) is a failure in any start chunk, and a `new Worker(` is
//     a failure in a start chunk that holds a project module (the Babylon chunk has project-free workers of its own, and is not scanned for it). A `?worker`
//     import is matched on the module id.
//   - A rule that matches no module anywhere in the build is STALE (the file was renamed): that is a failure, never a silent pass. For a rule that lists exact
//     ids, EACH id must exist in some chunk. A start-closure chunk with no entry in the sidecar is a failure, not a skip.
//
// ONE EXCEPTION, stated and narrow: src/audio/context.ts is allowed in the start chunk. The AudioContext must be made SYNCHRONOUSLY inside the user's click,
// before the `await import()` of the engine, or Safari / iOS leave it suspended (docs/CREATIVE-MODE-LOG.md L31 viii; the file header says the same). It is a
// 60-line file with no Web Audio graph in it. Everything else under src/audio/ is lazy.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const RATIO = 1.15
const RATIO_PERCENT = 115 // integer maths: 1000 x 1.15 must be exactly 1150
export const CREATION_ENTRY_MODULE = 'src/creation/boot.ts'
export const LEGACY_ENTRY_MODULE = 'src/legacyMain.ts'
/** The page entry (src/main.ts, main-*.js): the browser loads it on both paths. Its manifest key is the html file. */
export const PAGE_ENTRY_SRC = 'index.html'
export const ALLOWED_STATIC = ['src/audio/context.ts']

/** A rule on EXACT module ids: `ids` is kept so the stale check can look for each id on its own (a rename of any one must be caught). */
const exact = (ids) => ({ ids, match: (m) => ids.includes(m) })

/** @type {import('./chunk-budget.mjs').ForbiddenRule[]} */
export const FORBIDDEN_STATIC = [
  { id: 'acoustics', why: 'the acoustics core, its worker client and the worker load on the first Couverture click', match: (m) => m.startsWith('src/acoustics/') },
  { id: 'worker', why: 'a Vite `?worker` import would put the worker script in the start path', match: (m) => /[?&]worker\b/.test(m), optional: true },
  { id: 'audio', why: 'Web Audio loads on the first Lecture click (src/audio/context.ts alone is allowed, see the header)', match: (m) => m.startsWith('src/audio/') && !ALLOWED_STATIC.includes(m) },
  { id: 'songs', why: 'the songs list loads on the first approach of the Ecoute menu', ...exact(['content/songs.json', 'src/audio/songs.ts']) },
  { id: 'inventory drawer', why: 'the inventory drawer loads on the first open', ...exact(['src/creation/shell/inventoryDrawer.ts']) },
  // The picker's room thumbnails are static images made by tools/room-thumbs.ts (dist/room-thumbs); the modules are the picker, its model, the per-place
  // summary it reads (placeSummary.ts + the placeSummary.json that tools/room-thumbs.ts generates) and the drawer's inventory thumbnails.
  {
    id: 'picker thumbnails',
    why: 'the place picker, its card data and the inventory thumbnails load on the first picker / drawer open',
    ...exact(['src/creation/inventoryThumbs.ts', 'src/creation/placeSummary.ts', 'src/creation/placeSummary.json', 'src/creation/shell/placePicker.ts', 'src/creation/shell/placePickerModel.ts']),
  },
  { id: 'coverage controller', why: 'the coverage controller loads on the first Couverture click', ...exact(['src/creation/coverageController.ts']) },
  { id: 'listen controller', why: 'the listen controller loads on the first Lecture click', ...exact(['src/creation/listenController.ts']) },
]

/** The manifest key of the chunk that holds `moduleId`: the key equal to its `src`, else the chunk whose module list has it. */
function chunkKeyOf(manifest, chunkModules, moduleId) {
  for (const [key, c] of Object.entries(manifest)) if (c.src === moduleId) return key
  for (const [key, c] of Object.entries(manifest)) if ((chunkModules[c.file] ?? []).includes(moduleId)) return key
  return null
}

/** The manifest key of the page entry: the entry chunk whose `src` is index.html. */
function pageEntryKey(manifest) {
  return Object.keys(manifest).find((k) => manifest[k].isEntry && manifest[k].src === PAGE_ENTRY_SRC) ?? null
}

/** Breadth-first walk over STATIC imports only, from one or more roots. Returns key -> the key it was reached from (null for a root), so a failure can print the path. */
function staticClosure(manifest, rootKeys) {
  const from = new Map(rootKeys.map((k) => [k, null]))
  const queue = [...rootKeys]
  while (queue.length) {
    const key = queue.shift()
    for (const dep of manifest[key]?.imports ?? []) {
      if (!from.has(dep) && manifest[dep]) {
        from.set(dep, key)
        queue.push(dep)
      }
    }
  }
  return from
}

const filesOf = (manifest, keys) => {
  const js = []
  const css = []
  for (const k of keys) {
    js.push(manifest[k].file)
    css.push(...(manifest[k].css ?? []))
  }
  return { js: [...new Set(js)], css: [...new Set(css)] }
}

/** A `new Worker(` call, however the minifier spaced it. */
const NEW_WORKER = /\bnew\s+Worker\s*\(/

/**
 * Pure: (manifest, chunk module lists, file sizes, chunk texts, emitted worker assets) -> verdict.
 * `chunkTexts`: JS file -> its source text. `workerAssets`: the JS files of dist/ that are in no chunk list (Vite's worker sub-builds).
 */
export function evaluateBudget({ manifest, chunkModules, sizes, chunkTexts = {}, workerAssets = [] }) {
  const failures = []
  const rows = []
  const sizeOf = (f) => {
    if (typeof sizes[f] !== 'number') {
      failures.push(`no size for ${f} (the file is missing from dist/?)`)
      return 0
    }
    return sizes[f]
  }
  const sum = (files) => files.reduce((n, f) => n + sizeOf(f), 0)

  const creationKey = chunkKeyOf(manifest, chunkModules, CREATION_ENTRY_MODULE)
  const legacyKey = chunkKeyOf(manifest, chunkModules, LEGACY_ENTRY_MODULE)
  if (!creationKey) failures.push(`creation entry module ${CREATION_ENTRY_MODULE} not found in any chunk (renamed? update tools/chunk-budget.mjs)`)
  if (!legacyKey) failures.push(`legacy entry module ${LEGACY_ENTRY_MODULE} not found in any chunk (renamed? update tools/chunk-budget.mjs)`)

  const pageKey = pageEntryKey(manifest)
  if (!pageKey) failures.push(`page entry ${PAGE_ENTRY_SRC} not found in the manifest as an entry chunk (the two sides could not be compared like with like)`)

  // Both sides start from the page entry too (see the header): the browser loads main-*.js whichever way it goes.
  const measure = (name, key) => {
    const closure = staticClosure(manifest, pageKey ? [pageKey, key] : [key])
    const { js, css } = filesOf(manifest, [...closure.keys()])
    const jsBytes = sum(js)
    const cssBytes = sum(css)
    const biggest = Math.max(0, ...js.map((f) => sizes[f] ?? 0))
    return { name, closure, js, jsBytes, cssBytes, bytes: jsBytes + cssBytes, biggest }
  }
  const creation = creationKey ? measure('creation', creationKey) : null
  const legacy = legacyKey ? measure('legacy', legacyKey) : null

  if (creation && legacy) {
    const limit = Math.floor((legacy.bytes * RATIO_PERCENT) / 100)
    rows.push({ name: 'creation', chunks: creation.closure.size, js: creation.jsBytes, css: creation.cssBytes, bytes: creation.bytes, limit })
    rows.push({ name: 'legacy', chunks: legacy.closure.size, js: legacy.jsBytes, css: legacy.cssBytes, bytes: legacy.bytes, limit: null })
    rows.push({ name: 'creation excl. largest chunk', chunks: creation.closure.size - 1, js: creation.jsBytes - creation.biggest, css: creation.cssBytes, bytes: creation.bytes - creation.biggest, limit: null })
    rows.push({ name: 'legacy excl. largest chunk', chunks: legacy.closure.size - 1, js: legacy.jsBytes - legacy.biggest, css: legacy.cssBytes, bytes: legacy.bytes - legacy.biggest, limit: null })
    if (creation.bytes > limit) failures.push(`creation start is ${creation.bytes} bytes, above the limit ${limit} (legacy start ${legacy.bytes} x ${RATIO})`)
  }

  // Laziness. Only the creation start is examined (the legacy start has its own business).
  const everyModule = new Set(Object.values(chunkModules).flat())
  for (const rule of FORBIDDEN_STATIC) {
    if (rule.ids) {
      // A rule on exact ids is stale as soon as ANY of its ids is in no chunk: the others would keep it alive and one rename would pass unseen.
      for (const id of rule.ids) {
        if (!everyModule.has(id)) failures.push(`stale rule "${rule.id}": ${id} is in no chunk of the build (file moved or renamed? update tools/chunk-budget.mjs)`)
      }
    } else if (!rule.optional && ![...everyModule].some((m) => rule.match(m))) {
      failures.push(`stale rule "${rule.id}": matches no module in the build (file moved or renamed? update tools/chunk-budget.mjs)`)
    }
  }
  // Every chunk of either start closure needs its module list: a missing one would skip the laziness check for it without a word.
  for (const side of [creation, legacy]) {
    if (!side) continue
    for (const key of side.closure.keys()) {
      const file = manifest[key].file
      if (!chunkModules[file]) failures.push(`no module list for ${file} in chunk-modules.json (sidecar out of date? the laziness check cannot look inside it)`)
    }
  }
  if (creation && creationKey) {
    for (const key of creation.closure.keys()) {
      const file = manifest[key].file
      // A worker started from the start path leaves no module id behind (the worker script is its own sub-build): scan the text.
      const text = chunkTexts[file]
      if (typeof text !== 'string') {
        failures.push(`no text for ${file} (the worker scan could not run; is the file missing from dist/?)`)
      } else {
        for (const wa of workerAssets) {
          const base = wa.split('/').pop()
          if (base && text.includes(base)) failures.push(`${file} names the worker asset ${base}: a Web Worker must be started from a lazy module (CA-18)`)
        }
        if ((chunkModules[file] ?? []).length > 0 && NEW_WORKER.test(text)) {
          failures.push(`${file} contains \`new Worker(\` in a start-closure chunk that holds project code: a Web Worker must be started from a lazy module (CA-18)`)
        }
      }
      for (const m of chunkModules[file] ?? []) {
        const hits = FORBIDDEN_STATIC.filter((r) => r.match(m))
        if (!hits.length) continue
        const chain = []
        for (let k = key; k !== null; k = creation.closure.get(k)) chain.unshift(manifest[k].file)
        failures.push(`${m} [${hits.map((r) => r.id).join(', ')}] is statically reachable from the creation entry: ${chain.join(' -> ')} (it must be a dynamic import())`)
      }
    }
  }
  return { ok: failures.length === 0, rows, failures }
}

/** The small table the script prints. */
export function formatTable(verdict) {
  const head = ['entry'.padEnd(30), 'chunks'.padStart(6), 'js'.padStart(10), 'css'.padStart(8), 'bytes'.padStart(10), 'limit'.padStart(10)].join('  ')
  const lines = verdict.rows.map((r) => [r.name.padEnd(30), String(r.chunks).padStart(6), String(r.js).padStart(10), String(r.css).padStart(8), String(r.bytes).padStart(10), (r.limit === null ? '-' : String(r.limit)).padStart(10)].join('  '))
  const out = [head, ...lines]
  for (const f of verdict.failures) out.push(`FAIL ${f}`)
  out.push(verdict.ok ? 'budget: OK' : `budget: FAIL (${verdict.failures.length})`)
  return out.join('\n')
}

function main() {
  const dist = resolve(process.argv[2] ?? join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist'))
  const read = (rel) => {
    const p = join(dist, '.vite', rel)
    if (!existsSync(p)) {
      console.error(`budget: ${p} not found. Run \`npm run build\` first.`)
      process.exit(2)
    }
    return JSON.parse(readFileSync(p, 'utf8'))
  }
  const manifest = read('manifest.json')
  const chunkModules = read('chunk-modules.json')
  const sizes = {}
  for (const c of Object.values(manifest)) {
    for (const f of [c.file, ...(c.css ?? [])]) if (existsSync(join(dist, f))) sizes[f] = statSync(join(dist, f)).size
  }
  // The text of every JS chunk (for the Web Worker scan), and the worker sub-builds: JS files of dist/assets that no chunk list knows.
  const chunkTexts = {}
  for (const c of Object.values(manifest)) {
    if (c.file.endsWith('.js') && existsSync(join(dist, c.file))) chunkTexts[c.file] = readFileSync(join(dist, c.file), 'utf8')
  }
  const assetsDir = join(dist, 'assets')
  const workerAssets = existsSync(assetsDir)
    ? readdirSync(assetsDir).filter((f) => f.endsWith('.js') && !(`assets/${f}` in chunkModules)).map((f) => `assets/${f}`)
    : []
  const verdict = evaluateBudget({ manifest, chunkModules, sizes, chunkTexts, workerAssets })
  console.log(formatTable(verdict))
  process.exit(verdict.ok ? 0 : 1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
