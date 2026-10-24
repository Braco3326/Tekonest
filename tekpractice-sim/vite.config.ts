import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Deploy build only: tools/build-site.mjs sets TEKPRACTICE_BASE=/tekpractice/jouer/.
  base: process.env.TEKPRACTICE_BASE ?? '/',
  server: {
    port: 3000,
  },
  build: {
    target: 'es2020',
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
