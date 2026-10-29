import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    // Task 39: lets the creation specs read the analysers without caring about the autoplay policy. The app makes its AudioContext synchronously inside the
    // click / key press (src/audio/context.ts); tests/e2e/creation-listen-gesture.spec.ts runs Chromium WITHOUT this flag to check that path. Legacy specs
    // never make a context and are not affected.
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  // Production-like: smoke runs against the built bundle, not the dev server.
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
