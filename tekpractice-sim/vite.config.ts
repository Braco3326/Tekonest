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

export default defineConfig({
  // Deploy build only: tools/build-site.mjs sets TEKPRACTICE_BASE=/tekpractice/jouer/.
  base: process.env.TEKPRACTICE_BASE ?? '/',
  plugins: [chunkModules()],
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
