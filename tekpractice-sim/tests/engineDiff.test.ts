/**
 * G14e (review S14, spec 11.9): the engine is not touched by the onboarding packs. `git diff --quiet <base> -- <paths>` over the code that computes the simulation's
 * results (the engine, the signal path, the logic checks R4 to R8, the store) must be empty against the base this branch started from. The import half of
 * neutrality is tests/engineImports.test.ts; the browser half is tests/e2e/engine-neutrality.spec.ts.
 *
 * The base is 2de5ef4 (the live equipment + Oscar build the onboarding branch was merged with on 2026-11-14; before that merge the base was ee396da, the commit the
 * onboarding branch left from, and the diff against it was empty too; spec 11.9 names c51dc87, an earlier point on the same line). Skipped,
 * with the reason, when git is not there or the base commit is not in this clone (a shallow or exported tree): the check cannot be made, it is not passed.
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SIM = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = '2de5ef4'
const PATHS = ['src/engine', 'src/flow', 'src/logic', 'src/creation/store.ts']

const git = (...args: string[]) => spawnSync('git', ['-c', `safe.directory=*`, ...args], { cwd: SIM, encoding: 'utf8' })
const hasGit = (() => {
  const r = git('rev-parse', '--is-inside-work-tree')
  return r.status === 0 && r.stdout.trim() === 'true'
})()
const hasBase = hasGit && git('cat-file', '-e', `${BASE}^{commit}`).status === 0

describe('engine neutrality: the engine diff (spec 11.9)', () => {
  it.skipIf(!hasBase)(`git diff ${BASE} is empty for ${PATHS.join(', ')} (working tree included)`, () => {
    const r = git('diff', '--quiet', BASE, '--', ...PATHS)
    if (r.status !== 0) {
      const names = git('diff', '--name-status', BASE, '--', ...PATHS).stdout.trim()
      expect(names, `the engine changed since ${BASE}`).toBe('')
    }
    expect(r.status, `git diff --quiet exit code (1 = differences, other = error: ${r.stderr})`).toBe(0)
  })

  it.skipIf(!hasBase)('the check can fail: the same diff against a base where src/engine differs is not empty', () => {
    // the root commit of the repository has no src/engine of today: a diff from it over the same paths cannot be empty
    const root = git('rev-list', '--max-parents=0', 'HEAD').stdout.trim().split('\n')[0]
    expect(root, 'the root commit').toMatch(/^[0-9a-f]{40}$/)
    expect(git('diff', '--quiet', root, '--', ...PATHS).status).toBe(1)
  })
})
