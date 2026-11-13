/**
 * T7.3: engine neutrality in the browser (onboarding packs, spec 11.9, plan T7.3). The import half is tests/engineImports.test.ts.
 *
 * Claim: the five design packages change the look, the first visit and the tutorial, never a result of the simulation. The same corpus of benches, applied
 * the same way, gives the same engine outputs on `/` and on `/?design=1..5`, whatever the package side holds (a profile, a running tutorial, the own-gear
 * card dismissed, Oscar off): the rule events (R4 to R8, as `events()` returns them), the normalised design, whether the bench can play (the status bar's
 * `data-ready`) and the reason texts the status bar shows (playback and mic), the signal summary, and the autosave written (its design and fingerprint).
 *
 * The corpus (all on the neutral room, through the hook's `dispatch`, the same path as the UI's `history.do`): an empty bench; one bench per playback reason
 * code (NO_SOURCE, SOURCE_OFF, HOST_UNPOWERED, NO_PATH, SPEAKER_UNPOWERED), a playable bench without a mic (NO_MIC), a condenser mic on a preamp with +48 V
 * off (an R4 error event, RULE_ERROR on the mic line), a console whose mic fader ships open (an R5 warning), both templates (`premier-son-pret`,
 * `concert-simple-reference`, read from content/templates); then a script of single intents that builds a playable bench step by step, unplugs and undoes,
 * read after every intent. RULE_ERROR on the PLAYBACK line is not in the corpus: no catalog bench found for it here (the unit tests cover it with a synthetic
 * event, tests/flow/signalPath.test.ts).
 *
 * The comparer is proven able to fail (spec 11.9): the same run with ONE fixture changed on the engine side (« Lecture console » on in the SOURCE_OFF bench)
 * must be reported as different, at that fixture and only there.
 */
import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { rulesRevOf } from '../../src/trials/fingerprint'
import { expect, GUIDE_KEY, loadFresh, ONBOARDING_KEY, test } from './onboardingKit'
import { AUTOSAVE_KEY } from './waits'

test.use({ viewport: { width: 1366, height: 768 } })
test.describe.configure({ mode: 'parallel' })

/** `rulesRevOf(catalog.rules)` of the pre-flight (ledger, G1; pinned in tests/creation/ruleOverrides.test.ts). */
const PRE_FLIGHT_RULES_REV = 'r1:31976636175ae95deac28925c5e7e1b8f7dd309fc65bf093f596ca335480c619'

// ── the corpus ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

type Ref = { instance: string; port: string }
interface Design {
  roomId: string
  rig: { instances: { instanceId: string; deviceId: string }[]; connections: { a: Ref; b: Ref }[]; controls: Record<string, Record<string, boolean | string>> }
  placements: { instanceId: string; deviceId: string; position_m: [number, number, number]; yawDeg: number; mount: string }[]
}
const r = (s: string): Ref => ({ instance: s.split(' ')[0], port: s.split(' ')[1] })
const cable = (a: string, b: string) => ({ a: r(a), b: r(b) })
const X: Record<string, number> = { ql1: 0, k12: -1.5, mains: 0.8, sm58: 1.4, u87: 2, isa: 2.6, iq: -2.4 }
const DEVICE: Record<string, string> = { ql1: 'yamaha-ql1', k12: 'qsc-k12-2', mains: 'multiprise-secteur', sm58: 'shure-sm58', u87: 'neumann-u87-ai', isa: 'focusrite-isa-one', iq: 'axia-iq' }
function bench(ids: string[], cables: [string, string][], controls: Design['rig']['controls'] = {}): Design {
  return {
    roomId: 'blank',
    rig: { instances: ids.map((i) => ({ instanceId: i, deviceId: DEVICE[i] })), connections: cables.map(([a, b]) => cable(a, b)), controls },
    placements: ids.map((i) => ({ instanceId: i, deviceId: DEVICE[i], position_m: [X[i], 0, 0], yawDeg: 0, mount: 'floor' })),
  }
}
const PLAY = { ql1: { 'playback-usb': true } }
const AUDIO: [string, string] = ['ql1 out-main-l', 'k12 in-line-a']
const P_QL1: [string, string] = ['mains out-1', 'ql1 power-in']
const P_K12: [string, string] = ['mains out-2', 'k12 power-in']
function template(file: string): Design {
  const t = JSON.parse(readFileSync(`content/templates/${file}.json`, 'utf8')) as { roomId: string; instances: Design['rig']['instances']; connections: { a: Ref; b: Ref }[]; controls: Design['rig']['controls']; placements: Design['placements'] }
  return { roomId: t.roomId, rig: { instances: t.instances, connections: t.connections, controls: t.controls }, placements: t.placements }
}

/** The benches, each applied whole (APPLY_DESIGN), then read. */
const CORPUS: { name: string; design: Design }[] = [
  { name: 'empty', design: bench([], []) },
  { name: 'NO_SOURCE (a powered speaker alone)', design: bench(['k12', 'mains'], [P_K12]) },
  { name: 'SOURCE_OFF (all cabled, « Lecture console » off)', design: bench(['ql1', 'k12', 'mains'], [AUDIO, P_QL1, P_K12]) },
  { name: 'HOST_UNPOWERED', design: bench(['ql1', 'k12', 'mains'], [AUDIO, P_K12], PLAY) },
  { name: 'NO_PATH', design: bench(['ql1', 'k12', 'mains'], [P_QL1, P_K12], PLAY) },
  { name: 'SPEAKER_UNPOWERED', design: bench(['ql1', 'k12', 'mains'], [AUDIO, P_QL1], PLAY) },
  { name: 'NO_MIC (playable, no mic)', design: bench(['ql1', 'k12', 'mains'], [AUDIO, P_QL1, P_K12], PLAY) },
  { name: 'R4 error: condenser on a preamp, +48 V off (RULE_ERROR on the mic line)', design: bench(['ql1', 'k12', 'mains', 'u87', 'isa'], [AUDIO, P_QL1, P_K12, ['mains out-3', 'isa power-in'], ['u87 out-xlr', 'isa in-mic']], PLAY) },
  { name: 'R5 warning: a console with its mic fader open, alone', design: bench(['iq'], []) },
  { name: 'template premier-son-pret', design: template('premier-son-pret') },
  { name: 'template concert-simple-reference', design: template('concert-simple-reference') },
]
/** Single intents after the corpus, read after each: a playable bench built step by step, a mic, an unplug, an undo. */
const SCRIPT: { name: string; intent: unknown; refused?: true }[] = [
  { name: 'reset to empty', intent: { type: 'APPLY_DESIGN', design: bench([], []) } },
  { name: 'spawn ql1', intent: { type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 0] } },
  { name: 'spawn k12', intent: { type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12', position: [-1.5, 0, 0] } },
  { name: 'cable ql1 -> k12', intent: { type: 'CONNECT', ...cable(...AUDIO) } },
  { name: 'spawn sm58', intent: { type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58', position: [1.4, 0, 0] } },
  { name: 'cable sm58 -> ql1', intent: { type: 'CONNECT', ...cable('sm58 out-xlr', 'ql1 in-mic-1') } },
  { name: '« Lecture console » on', intent: { type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true } },
  { name: 'spawn strip', intent: { type: 'SPAWN', deviceId: 'multiprise-secteur', instanceId: 'mains', position: [0.8, 0, 0] } },
  { name: 'power ql1', intent: { type: 'CONNECT', ...cable(...P_QL1) } },
  { name: 'power k12', intent: { type: 'CONNECT', ...cable(...P_K12) } },
  { name: 'unplug ql1 -> k12', intent: { type: 'UNPLUG', ...cable(...AUDIO) } },
  { name: 'undo the unplug', intent: 'undo' },
  // refusals of the connection graph (R1 to R3): the refusal itself is an output (code, message, rule)
  { name: 'spawn a second speaker', intent: { type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12b', position: [-2.5, 0, 0] } },
  { name: 'spawn a second mic', intent: { type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58b', position: [2.2, 0, 0] } },
  { name: 'refused: output to output (R3)', intent: { type: 'CONNECT', ...cable('ql1 out-main-r', 'k12b thru-out-a') }, refused: true },
  { name: 'refused: mic into a line input (R2)', intent: { type: 'CONNECT', ...cable('sm58b out-xlr', 'k12b in-line-a') }, refused: true },
  { name: 'refused: mains into an audio input', intent: { type: 'CONNECT', ...cable('mains out-3', 'k12b in-line-a') }, refused: true },
  { name: 'refused: a busy input', intent: { type: 'CONNECT', ...cable('ql1 out-main-r', 'k12 in-line-a') }, refused: true },
]

// ── one run: an address, a package-side state, the corpus, the outputs ─────────────────────────────────────────────────────────────

interface Output {
  name: string
  /** What the dispatch answered (ok, or the refusal's code, message and rule). */
  result: unknown
  design: unknown
  events: unknown
  ready: string | null
  playback: string
  mic: string
  signal: string
  autosave: unknown
}

/** The engine outputs on the page now, once two reads agree and the autosave holds the design on screen (state waits). */
async function outputs(page: Page, name: string, result: unknown): Promise<Output> {
  const read = () =>
    page.evaluate(
      ({ key }) => {
        const c = window.__creation!
        const text = (id: string): string => (document.querySelector(`[data-testid="${id}"]`)?.textContent ?? '').replace(/\s+/g, ' ').trim()
        const canon = (v: unknown): unknown => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v)
        const raw = localStorage.getItem(key)
        const saved = raw === null ? null : (JSON.parse(raw) as { version: unknown; name: unknown; design: unknown; savedFingerprint: unknown })
        const design = canon(JSON.parse(JSON.stringify(c.design())))
        return {
          design,
          events: canon(JSON.parse(JSON.stringify(c.events()))),
          ready: document.querySelector('[data-testid="status-playback"]')?.getAttribute('data-ready') ?? null,
          playback: text('status-playback'),
          mic: text('status-mic'),
          signal: text('signal-label'),
          autosave: saved === null ? null : canon({ version: saved.version, name: saved.name, design: saved.design, savedFingerprint: saved.savedFingerprint }),
          saved: saved !== null && JSON.stringify(canon(saved.design)) === JSON.stringify(design),
        }
      },
      { key: AUTOSAVE_KEY },
    )
  let last = ''
  let out: Awaited<ReturnType<typeof read>> | null = null
  await expect
    .poll(
      async () => {
        out = await read()
        const now = JSON.stringify(out)
        const stable = out.saved && now === last
        last = now
        return stable
      },
      { message: `${name}: the outputs settle and the autosave holds the design`, timeout: 20_000, intervals: [250] },
    )
    .toBe(true)
  const o = out!
  return { name, result, design: o.design, events: o.events, ready: o.ready, playback: o.playback, mic: o.mic, signal: o.signal, autosave: o.autosave }
}

/** Through the hook (the UI's `history.do` path); the answer as plain data: ok, or the refusal (code, message, rule). */
const dispatch = (page: Page, intent: unknown) =>
  page.evaluate((i) => {
    const c = window.__creation!
    if (i === 'undo') return c.undo() ? { ok: true } : { ok: false, error: { code: 'undo' } }
    const res = c.dispatch(i as never)
    return res.ok ? { ok: true } : { ok: false, error: JSON.parse(JSON.stringify((res as { error?: unknown }).error ?? null)) }
  }, intent)

interface Address {
  query: string
  /** The package side of the run (stored before the load). */
  storage: Record<string, string>
  what: string
}
const record = (o: Record<string, unknown>): string => JSON.stringify({ v: 1, shown: [], request: 0, ...o })
const ADDRESSES: Address[] = [
  { query: '', storage: {}, what: 'no package (the reference)' },
  { query: '?design=1', storage: { [ONBOARDING_KEY]: record({ profile: 'decouvre', offer: 'skipped' }) }, what: 'profile « Je découvre », tutorial declined' },
  { query: '?design=2', storage: { [ONBOARDING_KEY]: record({ profile: 'etudie', offer: 'skipped' }) }, what: 'profile « J’étudie le son »' },
  {
    query: '?design=3',
    storage: { [ONBOARDING_KEY]: record({ profile: 'projet', offer: 'taken', request: 1 }), [GUIDE_KEY]: JSON.stringify({ v: 1, handledRequest: 1, step: 'console', k: 1, n: 10, status: 'running', early: [], shown: [], passed: [], helper: false }) },
    what: 'profile « Je monte un projet », a tutorial run recorded as running',
  },
  { query: '?design=4', storage: { [ONBOARDING_KEY]: record({ profile: 'metier', offer: 'skipped' }) }, what: 'profile « Je travaille dans le son » (Oscar muted by default)' },
  { query: '?design=5', storage: { [ONBOARDING_KEY]: record({ profile: 'projet', offer: 'skipped', ownGear: 'dismissed' }) }, what: 'profile « Je monte un projet », the own-gear card dismissed' },
  { query: '?design=2&oscar=0', storage: { [ONBOARDING_KEY]: record({ profile: 'decouvre', offer: 'skipped' }) }, what: 'Oscar off' },
]

/** One run: the address with its package side, the neutral room, every bench of the corpus, then the script; the outputs in order. */
async function run(page: Page, a: Address, corpus = CORPUS): Promise<Output[]> {
  await loadFresh(page, a.query, a.storage)
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  const out: Output[] = []
  for (const f of corpus) {
    const res = await dispatch(page, { type: 'APPLY_DESIGN', design: f.design })
    expect(res, `${a.query || '/'}: the bench « ${f.name} » applies`).toEqual({ ok: true })
    out.push(await outputs(page, f.name, res))
  }
  for (const s of SCRIPT) {
    const res = await dispatch(page, s.intent)
    expect(res.ok, `${a.query || '/'}: « ${s.name} » ${JSON.stringify(res)}`).toBe(s.refused !== true)
    out.push(await outputs(page, `script: ${s.name}`, res))
  }
  return out
}

/** The comparer: one line per output field that differs, `fixture | field: reference -> other`. */
export function differences(ref: readonly Output[], other: readonly Output[]): string[] {
  const out: string[] = []
  if (ref.length !== other.length) out.push(`length ${ref.length} -> ${other.length}`)
  for (let i = 0; i < Math.min(ref.length, other.length); i++)
    for (const k of Object.keys(ref[i]) as (keyof Output)[]) {
      const a = JSON.stringify(ref[i][k])
      const b = JSON.stringify(other[i][k])
      if (a !== b) out.push(`${ref[i].name} | ${k}: ${a.slice(0, 120)} -> ${b.slice(0, 120)}`)
    }
  return out
}

// ── the tests ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('engine neutrality across the packages (spec 11.9)', () => {
  test.describe.configure({ mode: 'default' })
  const runs = new Map<string, Output[]>()

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(600_000)
    for (const a of ADDRESSES) {
      const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } })
      try {
        runs.set(a.query, await run(await ctx.newPage(), a))
      } finally {
        await ctx.close()
      }
    }
  })

  test('the corpus means something on the reference: every playback reason shows, the playable benches are ready, rule events fire', () => {
    const ref = runs.get('')!
    const at = (name: string): Output => ref.find((o) => o.name.startsWith(name))!
    for (const name of ['NO_SOURCE', 'SOURCE_OFF', 'HOST_UNPOWERED', 'NO_PATH', 'SPEAKER_UNPOWERED']) {
      expect(at(name).ready, `${name}: not ready`).toBe('false')
      expect(at(name).playback, `${name}: a reason is shown`).not.toBe('')
    }
    expect(new Set(['NO_SOURCE', 'SOURCE_OFF', 'HOST_UNPOWERED', 'NO_PATH', 'SPEAKER_UNPOWERED'].map((n) => at(n).playback)).size, 'five different reason texts').toBe(5)
    for (const name of ['NO_MIC', 'R4 error', 'template premier-son-pret']) expect(at(name).ready, `${name}: ready`).toBe('true')
    expect(JSON.stringify(at('R4 error').events)).toContain('"R4"')
    expect(JSON.stringify(at('R5 warning').events)).toContain('"R5"')
    // the status bar's mic mark shows « Micro OK » only: the template's cabled SM58 gets it, the condenser with +48 V off does not
    expect(at('template premier-son-pret').mic, 'Micro OK on the template').not.toBe('')
    expect(at('R4 error').mic, 'no Micro OK for the R4 bench').toBe('')
    const refusals = ref.filter((o) => o.name.startsWith('script: refused')).map((o) => o.result as { ok: boolean; error?: { code?: string } })
    expect(refusals.map((x) => x.ok), 'the four refusals are refusals').toEqual([false, false, false, false])
    expect(new Set(refusals.map((x) => x.error?.code)).size, `refusals for different reasons: ${JSON.stringify(refusals)}`).toBeGreaterThanOrEqual(2)
    console.log('NEUTRALITY', JSON.stringify({ outputs: ref.length, playbackTexts: [...new Set(ref.map((o) => o.playback))], refusals: refusals.map((x) => x.error), ruleIds: [...new Set(ref.flatMap((o) => (o.events as { ruleId: string }[]).map((e) => e.ruleId)))] }))
    expect(ref.find((o) => o.name === 'script: power k12')!.ready, 'the script reaches a playable bench').toBe('true')
    expect(ref.find((o) => o.name === 'script: unplug ql1 -> k12')!.ready).toBe('false')
    expect(ref.find((o) => o.name === 'script: undo the unplug')!.ready).toBe('true')
    expect(ref.every((o) => o.autosave !== null), 'an autosave was written for every bench').toBe(true)
  })

  for (const a of ADDRESSES.slice(1))
    test(`${a.query}: identical engine outputs to the plain address (${a.what})`, () => {
      expect(differences(runs.get('')!, runs.get(a.query)!)).toEqual([])
    })

  test('the rules revision is the pre-flight one (the catalog the bundle carries is unchanged)', async () => {
    const catalog = JSON.parse(readFileSync('content/catalog.json', 'utf8')) as { rules: unknown }
    expect(await rulesRevOf(catalog.rules)).toBe(PRE_FLIGHT_RULES_REV)
  })
})

test('the comparer can fail: ONE bench changed on the engine side (« Lecture console » on in SOURCE_OFF) is reported, at that bench and only there', async ({ page }) => {
  test.setTimeout(300_000)
  const ref = await run(page, ADDRESSES[1])
  const perturbed = CORPUS.map((f) => (f.name.startsWith('SOURCE_OFF') ? { ...f, design: { ...f.design, rig: { ...f.design.rig, controls: PLAY } } } : f))
  const other = await run(page, ADDRESSES[1], perturbed)
  const diff = differences(ref, other)
  expect(diff.length, diff.join('\n')).toBeGreaterThan(0)
  expect(new Set(diff.map((d) => d.split(' | ')[0])), diff.join('\n')).toEqual(new Set([CORPUS.find((f) => f.name.startsWith('SOURCE_OFF'))!.name]))
  expect(diff.some((d) => d.includes('| ready:')), 'the change shows on the readiness').toBe(true)
  // and the comparer itself: identical runs give nothing, a reordered run gives something
  expect(differences(ref, ref)).toEqual([])
  expect(differences(ref, [...ref].reverse()).length).toBeGreaterThan(0)
})
