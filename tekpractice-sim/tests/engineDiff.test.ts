/**
 * G14e (review S14, spec 11.9): the engine is not touched by the onboarding packs. `git diff --quiet <base> -- <paths>` over the code that computes the simulation's
 * results (the engine, the signal path, the logic checks R4 to R8) must be empty against the base this branch started from. The import half of
 * neutrality is tests/engineImports.test.ts; the browser half is tests/e2e/engine-neutrality.spec.ts.
 *
 * The base is 2de5ef4 (the live equipment + Oscar build the onboarding branch was merged with on 2026-11-14; before that merge the base was ee396da, the commit the
 * onboarding branch left from, and the diff against it was empty too; spec 11.9 names c51dc87, an earlier point on the same line). Skipped,
 * with the reason, when git is not there or the base commit is not in this clone (a shallow or exported tree): the check cannot be made, it is not passed.
 *
 * The store (src/creation/store.ts). RULING, mission 3 B stage 1 (2026-11-15, hand-drawn cables, spec 2026-11-15-hand-drawn-cables-design.md §3): the store
 * owns the design, and a cable's route is design data, so the store had to change. It was pinned to 2de5ef4 with the engine until then. It is now pinned to
 * STORE_BASE = d5dc20b, the commit just before its first route change (`git rev-parse HEAD` at the start of that work), and checked two ways:
 * 1. strictly: store.ts did not change between 2de5ef4 and STORE_BASE (the old pin held up to the new base);
 * 2. by behaviour: the store as it was at STORE_BASE (read from git, its imports pointed at today's modules) and today's store are driven through every
 *    pre-existing intent (and their failures, groups, rollbacks, loads) on designs with no route: every result, design, rule result, snapshot, revision and
 *    dry-run must be byte-identical. So what changed in the store can only be the routes.
 * The engine, the signal flow and the logic checks keep the 2de5ef4 pin with the same strictness as before.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { makeRegistry } from './helpers'
import { CreationStore, creationEvaluator } from '../src/creation/store'
import type { DesignState } from '../src/trials/trial'
import type { Intent } from '../src/ui/intents'

const SIM = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = '2de5ef4'
const PATHS = ['src/engine', 'src/flow', 'src/logic']
/** The commit just before the first route change of src/creation/store.ts (mission 3 B stage 1). */
const STORE_BASE = 'd5dc20b'
const STORE = 'src/creation/store.ts'

const git = (...args: string[]) => spawnSync('git', ['-c', `safe.directory=*`, ...args], { cwd: SIM, encoding: 'utf8' })
const hasGit = (() => {
  const r = git('rev-parse', '--is-inside-work-tree')
  return r.status === 0 && r.stdout.trim() === 'true'
})()
const hasBase = hasGit && git('cat-file', '-e', `${BASE}^{commit}`).status === 0
const hasStoreBase = hasGit && git('cat-file', '-e', `${STORE_BASE}^{commit}`).status === 0

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

describe(`engine neutrality: the store (pinned to ${STORE_BASE}, routes only since)`, () => {
  it.skipIf(!hasBase || !hasStoreBase)(`${STORE} did not change between ${BASE} and ${STORE_BASE} (the old pin held up to the new base)`, () => {
    const r = git('diff', '--quiet', BASE, STORE_BASE, '--', STORE)
    expect(r.status, `git diff --quiet ${BASE} ${STORE_BASE} -- ${STORE} (1 = differences: ${r.stderr})`).toBe(0)
  })

  it.skipIf(!hasStoreBase)(`the store at ${STORE_BASE} and today's give byte-identical results through every pre-existing intent (designs with no route)`, async () => {
    const OldStore = await loadStoreAt(STORE_BASE)
    const registry = makeRegistry()
    const evaluator = () => creationEvaluator(registry)
    for (const initial of [undefined, template('concert-simple-reference'), template('premier-son-pret'), { roomId: null, rig: 'bad' } as unknown as DesignState]) {
      const now = new CreationStore(registry, evaluator(), initial)
      const was = new OldStore(registry, evaluator(), initial)
      const log: string[] = []
      const same = (what: string, a: unknown, b: unknown): void => {
        const x = JSON.stringify(a)
        const y = JSON.stringify(b)
        if (x !== y) log.push(`${what}\n  today: ${x}\n  base:  ${y}`)
      }
      const state = (step: string): void => {
        same(`${step}: design`, now.design(), was.design())
        same(`${step}: events`, now.events(), was.events())
        same(`${step}: snapshot`, now.snapshot(), was.snapshot())
        same(`${step}: revision`, now.revision, was.revision)
      }
      same('initialLoad', now.initialLoad, was.initialLoad)
      state('start')
      const changesNow: unknown[] = []
      const changesWas: unknown[] = []
      now.subscribe((c) => changesNow.push(c))
      was.subscribe((c: unknown) => changesWas.push(c))
      for (const [k, step] of script().entries()) {
        if ('group' in step) same(`step ${k} group`, now.dispatchAll(step.group), was.dispatchAll(step.group))
        else same(`step ${k} ${step.type}`, now.dispatch(step), was.dispatch(step))
        state(`step ${k}`)
      }
      for (const r of [{ instance: 'm', port: 'out-xlr' }, { instance: 'q', port: 'in-mic-1' }, { instance: 'ql1', port: 'in-mic-1' }]) same(`connectionAt ${r.instance}`, now.connectionAt(r), was.connectionAt(r))
      same('canConnect', now.canConnect({ instance: 'm', port: 'out-xlr' }, { instance: 'q', port: 'in-mic-2' }), was.canConnect({ instance: 'm', port: 'out-xlr' }, { instance: 'q', port: 'in-mic-2' }))
      same('newInstanceId', now.newInstanceId('shure-sm58'), was.newInstanceId('shure-sm58'))
      same('notifications', changesNow, changesWas)
      expect(log, log.join('\n')).toEqual([])
      expect(changesNow.length).toBeGreaterThanOrEqual(15) // the script really changed the stores (not only refusals)
    }
  })

  it.skipIf(!hasStoreBase)('the oracle can fail: a store that answers one intent differently is caught', async () => {
    const OldStore = await loadStoreAt(STORE_BASE)
    const registry = makeRegistry()
    const now = new CreationStore(registry, creationEvaluator(registry))
    const was = new OldStore(registry, creationEvaluator(registry))
    for (const s of [now, was]) s.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' })
    // the same SET_ROUTE is unknown to the base store (no branch: it does not even return a result) and a refused cable key today: the oracle sees it
    const intent = { type: 'SET_ROUTE', key: 'x', points: null } as Intent
    const base = ((): string => {
      try {
        return JSON.stringify(was.dispatch(intent))
      } catch {
        return 'threw'
      }
    })()
    expect(JSON.stringify(now.dispatch(intent))).not.toBe(base)
  })
})

/** A content template as a design (content/templates/<id>.json). */
function template(id: string): DesignState {
  const t = JSON.parse(readFileSync(join(SIM, 'content', 'templates', `${id}.json`), 'utf8')) as {
    roomId: string
    instances: DesignState['rig']['instances']
    connections: DesignState['rig']['connections']
    controls: DesignState['rig']['controls']
    placements: DesignState['placements']
  }
  return { roomId: t.roomId, rig: { instances: t.instances, connections: t.connections, controls: t.controls ?? {} }, placements: t.placements }
}

type Step = Intent | { group: Intent[] }

/** Every intent the store knew before routes, with the refusals, a group that applies and one that rolls back. */
function script(): Step[] {
  const M = { instance: 'm', port: 'out-xlr' }
  const Q1 = { instance: 'q', port: 'in-mic-1' }
  const QL = { instance: 'q', port: 'out-main-l' }
  const KA = { instance: 'k', port: 'in-line-a' }
  return [
    { type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm', position: [1, 0, 2] },
    { type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'q' },
    { type: 'SPAWN', deviceId: 'qsc-k12-2', position: [4, 0, -2], rotationY: 30, tiltDeg: -5, mount: 'stand' },
    { type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k', position: [5, 0, -2], controls: {} },
    { type: 'SPAWN', deviceId: 'no-such-device', instanceId: 'x' },
    { type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' },
    { type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'bad-pose', position: [Number.NaN, 0, 0] },
    { type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'bad-mount', mount: 'ceiling' as never },
    { type: 'CONNECT', a: M, b: Q1 },
    { type: 'CONNECT', a: QL, b: KA },
    { type: 'CONNECT', a: { instance: 'k', port: 'power-in' }, b: { instance: 'q', port: 'in-mic-2' } },
    { type: 'CONNECT', a: M, b: { instance: 'q', port: 'in-mic-3' } },
    { type: 'SET_CONTROL', instance: 'q', control: 'power', value: false },
    { type: 'SET_CONTROL', instance: 'q', control: 'no-such-control', value: true },
    { type: 'SET_POSE', instanceId: 'k', position: [6, 2.7, -7.5], yawDeg: 15, tiltDeg: -5, mount: 'stand' },
    { type: 'SET_POSE', instanceId: 'nope', position: [0, 0, 0], yawDeg: 0, tiltDeg: 0, mount: 'floor' },
    { type: 'SET_POSE', instanceId: 'k', position: [0, 0, 0], yawDeg: Number.POSITIVE_INFINITY, tiltDeg: 0, mount: 'floor' },
    { type: 'CLEAR_POSE', instanceId: 'q' },
    { type: 'SET_POSE', instanceId: 'q', position: [0, 0, 1], yawDeg: 180, tiltDeg: 0, mount: 'floor' },
    { type: 'UNPLUG', a: Q1, b: M },
    { type: 'UNPLUG', a: Q1, b: M },
    { type: 'CONNECT', a: M, b: Q1 },
    { type: 'DISCONNECT', connectionId: 'no-such-id' },
    { group: [{ type: 'UNPLUG', a: QL, b: KA }, { type: 'SET_POSE', instanceId: 'k', position: [1, 0, 1], yawDeg: 0, tiltDeg: 0, mount: 'floor' }] },
    { group: [{ type: 'CONNECT', a: QL, b: KA }, { type: 'REMOVE', instanceId: 'nope' }] },
    { group: [] },
    { type: 'CONNECT', a: QL, b: KA },
    { type: 'REMOVE', instanceId: 'q' },
    { type: 'REMOVE', instanceId: 'q' },
    { type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'q' },
    { type: 'CONNECT', a: M, b: Q1 },
    { type: 'APPLY_DESIGN', design: template('concert-simple-reference') },
    { type: 'APPLY_DESIGN', design: { roomId: 'x', rig: { instances: [{ instanceId: 'z', deviceId: 'no-such' }], connections: [], controls: {} }, placements: [] } },
    { type: 'APPLY_DESIGN', design: { roomId: null, rig: 'bad' } as unknown as DesignState },
    {
      type: 'APPLY_DESIGN',
      design: {
        roomId: 'room:studio-live-room-medium',
        rig: {
          instances: [{ instanceId: 'm', deviceId: 'shure-sm58' }, { instanceId: 'q', deviceId: 'yamaha-ql1' }, { instanceId: 'u', deviceId: 'no-such' }],
          connections: [{ a: M, b: Q1 }, { a: M, b: { instance: 'q', port: 'no-port' } }],
          controls: { q: { power: true, 'no-such': true } },
        },
        placements: [
          { instanceId: 'm', deviceId: 'shure-sm58', position_m: [1, 0, 1], yawDeg: 0 },
          { instanceId: 'q', deviceId: 'yamaha-ql1', position_m: [Number.NaN, 0, 0], yawDeg: 0 },
        ],
      },
    },
    { type: 'LOAD_RIG', name: 'x' },
    {
      type: 'RESTORE_INSTANCE',
      instanceId: 'm',
      deviceId: 'shure-sm58',
      pose: { position: [0, 0, 0], rotationY: 0 },
      wires: [],
      controls: {},
    },
    { type: 'REMOVE', instanceId: 'm' },
  ]
}

/**
 * The CreationStore class as it was at `rev`: its source read from git into a temporary module whose relative imports point at today's modules (the
 * engine is pinned, so they are the same code), loaded with vitest's own transform.
 */
async function loadStoreAt(rev: string): Promise<typeof CreationStore> {
  const src = git('show', `${rev}:./${STORE}`)
  if (src.status !== 0) throw new Error(`git show ${rev}:${STORE} failed: ${src.stderr}`)
  const abs = (p: string): string => join(SIM, p).replace(/\\/g, '/')
  const code = src.stdout.replace(/from '\.\.\//g, `from '${abs('src')}/`).replace(/from '\.\//g, `from '${abs('src/creation')}/`)
  const dir = mkdtempSync(join(tmpdir(), 'store-base-'))
  const file = join(dir, `store.${rev}.ts`)
  writeFileSync(file, code)
  try {
    const mod = (await import(/* @vite-ignore */ pathToFileURL(file).href)) as { CreationStore: typeof CreationStore }
    return mod.CreationStore
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
