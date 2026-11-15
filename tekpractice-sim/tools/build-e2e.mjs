// The build the end-to-end specs run against (`npm run build:e2e`, then `npx playwright test`): the same build as `npm run build`, but with the all-on feature
// table (tests/e2e/fixtures/features.full.ts), because the shipped table (src/features.ts) has the assistant and the learning pages OFF since 2026-11-15 and most
// specs exercise them. Windows-safe (no cross-env). A local test build only: tools/build-site.mjs clears the switch for the deploy build and proves the output.
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const run = (script, args, env = {}) => {
  const r = spawnSync(process.execPath, [join(root, 'node_modules', script), ...args], { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } })
  if (r.status !== 0) process.exit(r.status ?? 1)
}
// the same steps as `npm run build`: the room thumbnails, the type check, then Vite with the all-on table
run('tsx/dist/cli.mjs', ['tools/room-thumbs.ts'])
run('typescript/bin/tsc', [])
run('vite/bin/vite.js', ['build'], { TP_TEST_FEATURES: 'full' })
