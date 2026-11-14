// `npm run test:onboarding` (G14e, review S13): the onboarding packs' e2e gate (spec 11), cross-platform.
//
// What it does, in order: E2E_PORT defaults to 4391 (spec 11: « ports 4391 (suites) ») and goes through the SAME guard as `e2e:fresh` (tools/e2e-fresh-guard.mjs:
// never a port another tool holds, so the run never reuses another checkout's server); `npm run build` (spec 11: « every e2e run is preceded by a build »,
// playwright.config.ts serves dist/); then Playwright on 3 workers over the spec files below.
//
// What it covers: the onboarding specs (tests/e2e/onboarding-*.spec.ts, the visual baseline included), the character, the guide placement specs, the
// first-timer proxy (11.8), engine neutrality (11.9), the rule texts (11.12), the exam and legacy-guide routes (11.10: « the legacy route untouched »), and the
// existing specs this work changes that spec 11 names (« Existing tests this work changes »: creation-picker, creation-keyboard-patch, creation-shortcuts,
// creation-status, creation-listen, creation-polish).
// What it is NOT: the full e2e suite (`npm run e2e:fresh` runs every spec), nor the unit tests (`npm test`), nor tsc / lint / validate:catalog / budget.
// Extra arguments are passed to Playwright (for example `-- -g "package 2"`).
import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkE2ePort } from './e2e-fresh-guard.mjs'

export const ONBOARDING_SPECS = [
  'tests/e2e/onboarding-',
  'tests/e2e/character.spec.ts',
  'tests/e2e/guide-overlap.spec.ts',
  'tests/e2e/guide-creation.spec.ts',
  'tests/e2e/guide-legacy.spec.ts',
  'tests/e2e/first-timer-proxy.spec.ts',
  'tests/e2e/engine-neutrality.spec.ts',
  'tests/e2e/rule-texts.spec.ts',
  'tests/e2e/exam.spec.ts',
  'tests/e2e/creation-picker.spec.ts',
  'tests/e2e/creation-keyboard-patch.spec.ts',
  'tests/e2e/creation-shortcuts.spec.ts',
  'tests/e2e/creation-status.spec.ts',
  'tests/e2e/creation-listen.spec.ts',
  'tests/e2e/creation-polish.spec.ts',
]

function run(cmd, args, env) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env, shell: process.platform === 'win32' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function main() {
  const env = { ...process.env, E2E_PORT: (process.env.E2E_PORT ?? '').trim() || '4391' }
  const port = checkE2ePort(env)
  if (!port.ok) {
    console.error(port.message)
    process.exit(1)
  }
  console.log(`test:onboarding: E2E_PORT=${env.E2E_PORT}, fresh build, then ${ONBOARDING_SPECS.length} spec groups on 3 workers`)
  run('npm', ['run', 'build'], env)
  run('npx', ['playwright', 'test', ...ONBOARDING_SPECS, '--workers=3', ...process.argv.slice(2)], env)
}

/** True when this file is the script node was started with (both sides through realpath), as in e2e-fresh-guard.mjs. */
function isMain() {
  try {
    return !!process.argv[1] && realpathSync.native(resolve(process.argv[1])) === realpathSync.native(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isMain()) main()
