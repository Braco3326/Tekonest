import { defineConfig } from '@playwright/test'

// E2E_PORT: run against a private preview server (another checkout may already hold 4173 and serve ITS build; a reused server tests the wrong code).
const PORT = Number(process.env.E2E_PORT ?? 4173)

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    // Task 39: lets the creation specs read the analysers without caring about the autoplay policy. The app makes its AudioContext synchronously inside the
    // click / key press (src/audio/context.ts); tests/e2e/creation-listen-gesture.spec.ts runs Chromium WITHOUT this flag to check that path. Legacy specs
    // never make a context and are not affected.
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  // Production-like: smoke runs against the built bundle, not the dev server.
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI && !process.env.E2E_PORT,
    timeout: 60_000,
  },
})
