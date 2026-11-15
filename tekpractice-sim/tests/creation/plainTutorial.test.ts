/**
 * The plain tutorial « Premiers pas » (mission 1, spec 4): a pure step machine over four facts the page already reads (no DOM, no guide). Each step completes on an
 * observable fact of the bench (the checklist's own source row, the catalog's speakers, a cable between them, the first sound of the session), never on a click on
 * the card; the steps already true complete at once, in order; « Étape suivante » passes the current step; « Passer le tutoriel » ends it.
 */
import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { signalPath } from '../../src/flow/signalPath'
import type { DesignState } from '../../src/trials/trial'
import {
  benchFacts,
  hintDue,
  nextStep,
  PLAIN_HINT_MS,
  PLAIN_START,
  PLAIN_STEPS,
  plainProgress,
  restartPlain,
  settle,
  skipPlain,
  type PlainFacts,
} from '../../src/creation/onboarding/plainTutorial'
import { PLAIN_STEP_COUNT } from '../../src/creation/onboarding/state'

const registry = loadCatalog(catalogJson)
const NONE: PlainFacts = { console: false, enceinte: false, cable: false, ecoute: false }

function design(instances: [string, string][], connections: [string, string, string, string][] = []): DesignState {
  return {
    roomId: 'blank',
    rig: {
      instances: instances.map(([instanceId, deviceId]) => ({ instanceId, deviceId })),
      connections: connections.map(([a, ap, b, bp]) => ({ a: { instance: a, port: ap }, b: { instance: b, port: bp } })),
      controls: {},
    },
    placements: [],
  }
}
const facts = (d: DesignState, sounded = false): PlainFacts => benchFacts(d, registry, signalPath(d, registry, []), sounded)

describe('the four steps', () => {
  it('are console, enceinte, cable, ecoute, and the record allows exactly their count', () => {
    expect(PLAIN_STEPS).toEqual(['console', 'enceinte', 'cable', 'ecoute'])
    expect(PLAIN_STEPS.length).toBe(PLAIN_STEP_COUNT)
    expect(PLAIN_START).toEqual({ step: 1, done: false })
  })
})

describe('benchFacts: what the page already knows, read from the store', () => {
  it('an empty bench: nothing is true', () => {
    expect(facts(design([]))).toEqual(NONE)
  })
  it('the console step is the checklist’s own source row: the console that plays a test sound (the QL1), not any desk', () => {
    expect(facts(design([['ql1', 'yamaha-ql1']])).console).toBe(true)
    expect(facts(design([['mg', 'yamaha-mg10xu']])).console).toBe(false)
  })
  it('a speaker is a catalog loudspeaker (the Enceintes tab, a route to its transducer); headphones are not', () => {
    expect(facts(design([['k12', 'qsc-k12-2']])).enceinte).toBe(true)
    expect(facts(design([['g', 'genelec-8030c']])).enceinte).toBe(true)
    const phones = registry.catalog.devices.find((d) => d.realWorld.category === 'headphones')
    if (phones) expect(facts(design([['h', phones.id]])).enceinte).toBe(false)
    expect(facts(design([['ql1', 'yamaha-ql1']])).enceinte).toBe(false)
  })
  it('the cable step: an output of the console cabled to an input of the speaker, either way round in the record', () => {
    const both: [string, string][] = [['ql1', 'yamaha-ql1'], ['k12', 'qsc-k12-2']]
    expect(facts(design(both)).cable).toBe(false)
    expect(facts(design(both, [['ql1', 'out-main-l', 'k12', 'in-line-a']])).cable).toBe(true)
    expect(facts(design(both, [['k12', 'in-line-a', 'ql1', 'out-main-r']])).cable).toBe(true)
    // a cable that is not console output to speaker input does not count
    expect(facts(design([...both, ['strip', 'multiprise-secteur']], [['strip', 'out-1', 'k12', 'power-in']])).cable).toBe(false)
  })
  it('the sound step is the first sound of the session (handed in), never the bench alone', () => {
    const d = design([['ql1', 'yamaha-ql1'], ['k12', 'qsc-k12-2']], [['ql1', 'out-main-l', 'k12', 'in-line-a']])
    expect(facts(d).ecoute).toBe(false)
    expect(facts(d, true).ecoute).toBe(true)
  })
})

describe('settle: the steps already true complete at once, in order', () => {
  it('nothing true: the tutorial stays at step 1', () => {
    expect(settle(PLAIN_START, NONE)).toEqual({ step: 1, done: false })
  })
  it('a bench that has the console and the speaker: step 3 at once', () => {
    expect(settle(PLAIN_START, { ...NONE, console: true, enceinte: true })).toEqual({ step: 3, done: false })
  })
  it('a later fact does not jump an earlier step that is not true (order kept)', () => {
    expect(settle(PLAIN_START, { ...NONE, enceinte: true, cable: true })).toEqual({ step: 1, done: false })
  })
  it('all four true: done, at step 4', () => {
    expect(settle(PLAIN_START, { console: true, enceinte: true, cable: true, ecoute: true })).toEqual({ step: 4, done: true })
  })
  it('a step done stays done when its fact goes away (an unplugged cable does not send the learner back)', () => {
    const at3 = settle(PLAIN_START, { ...NONE, console: true, enceinte: true })
    expect(settle(at3, NONE)).toEqual(at3)
  })
  it('a finished tutorial does not move', () => {
    expect(settle({ step: 4, done: true }, NONE)).toEqual({ step: 4, done: true })
  })
})

describe('« Étape suivante », « Passer le tutoriel », Aide « Premiers pas »', () => {
  it('« Étape suivante » passes the current step, then the true ones after it complete', () => {
    expect(nextStep(PLAIN_START, NONE)).toEqual({ step: 2, done: false })
    expect(nextStep(PLAIN_START, { ...NONE, enceinte: true })).toEqual({ step: 3, done: false })
    expect(nextStep({ step: 4, done: false }, NONE)).toEqual({ step: 4, done: true })
  })
  it('« Passer le tutoriel » ends it where it is', () => {
    expect(skipPlain({ step: 2, done: false })).toEqual({ step: 2, done: true })
  })
  it('starting again begins at step 1 and settles on the bench as it is', () => {
    expect(restartPlain(NONE)).toEqual({ step: 1, done: false })
    expect(restartPlain({ ...NONE, console: true })).toEqual({ step: 2, done: false })
  })
  it('progress for Aide: the step to resume at while it runs, null when over or never started', () => {
    expect(plainProgress({ step: 2, done: false })).toEqual({ k: 2, n: 4 })
    expect(plainProgress({ step: 4, done: true })).toBeNull()
    expect(plainProgress(undefined)).toBeNull()
  })
})

describe('the hint', () => {
  it('is due 30 s after the step started, not before', () => {
    expect(PLAIN_HINT_MS).toBe(30_000)
    expect(hintDue(1000, 1000 + 29_999)).toBe(false)
    expect(hintDue(1000, 1000 + 30_000)).toBe(true)
  })
})
