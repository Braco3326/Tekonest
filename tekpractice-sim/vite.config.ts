import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'

/**
 * Task 43a: writes dist/.vite/chunk-modules.json (chunk file -> the project modules inside it, root-relative, node_modules left out) next to the manifest.
 * The manifest alone cannot say what a chunk contains; tools/chunk-budget.mjs needs it to prove that no lazy module was merged into the creation start chunk.
 */
function chunkModules(): Plugin {
  let root = ''
  return {
    name: 'tekpractice-chunk-modules',
    apply: 'build',
    configResolved(c) {
      root = c.root.split('\\').join('/').replace(/\/+$/, '') + '/'
    },
    generateBundle(_options, bundle) {
      const out: Record<string, string[]> = {}
      for (const [file, item] of Object.entries(bundle)) {
        if (item.type !== 'chunk') continue
        out[file] = Object.keys(item.modules)
          .map((id) => id.split('\u0000').join('').split('\\').join('/'))
          .filter((id) => id.startsWith(root) && !id.includes('/node_modules/'))
          .map((id) => id.slice(root.length))
          .sort()
      }
      this.emitFile({ type: 'asset', fileName: '.vite/chunk-modules.json', source: JSON.stringify(out, null, 1) })
    },
  }
}

/**
 * A TEST-ONLY table: with TP_TEST_FEATURES=guideInbox in the environment, every import of src/features.ts is answered by
 * tests/e2e/fixtures/features.guide-inbox.ts (the same table with the guide's inbox on), so an end-to-end spec can exercise the flag-on path of a build
 * that never ships. With TP_TEST_FEATURES=full (`npm run build:e2e`) and in every unit test (vitest), the answer is tests/e2e/fixtures/features.full.ts: the
 * assistant and the learning pages ON, which the shipped table (src/features.ts) has OFF since 2026-11-15, so the specs of those features keep running.
 * It is a build-time switch of a local test build only: no address and no runtime setting turns anything on, and tools/build-site.mjs
 * clears the variable so the deploy build can never carry it (and checks the output for the product table).
 */
function testFeatures(): Plugin | false {
  const mode = process.env.TP_TEST_FEATURES
  const fixture = mode === 'guideInbox' ? 'features.guide-inbox.ts' : mode === 'full' || process.env.VITEST ? 'features.full.ts' : null
  if (fixture === null) return false
  const target = fileURLToPath(new URL(`./tests/e2e/fixtures/${fixture}`, import.meta.url))
  const original = fileURLToPath(new URL('./src/features.ts', import.meta.url)).replaceAll('\\', '/')
  return {
    name: 'tekpractice-test-features',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || !/(^|\/)features$/.test(source)) return null
      const r = await this.resolve(source, importer, { ...options, skipSelf: true })
      return r && r.id.replaceAll('\\', '/') === original ? target : null
    },
  }
}

export default defineConfig({
  // Deploy build only: tools/build-site.mjs sets TEKPRACTICE_BASE=/tekpractice/jouer/.
  base: process.env.TEKPRACTICE_BASE ?? '/',
  plugins: [chunkModules(), testFeatures()],
  server: {
    port: 3000,
  },
  build: {
    target: 'es2020',
    // tools/chunk-budget.mjs reads dist/.vite/manifest.json (Task 43a).
    manifest: true,
    rollupOptions: {
      // Multi-page: the game (index.html) and the DOM-only teacher page (no Babylon).
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        teacher: fileURLToPath(new URL('./teacher.html', import.meta.url)),
      },
      output: {
        manualChunks: {
          // Babylon in its own long-cached chunk; app code iterates without
          // re-downloading the 3D engine.
          babylon: ['@babylonjs/core', '@babylonjs/loaders'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
