import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { importTrails } from '../trials/export'
import type { Trial } from '../trials/trial'
import { changeLabel, failureMessage, isQuarantineFile, mapGeometry, MAX_FILE_BYTES, MAX_TRIALS, rejectedNotice, TEACHER_COPY, trailCards, trialCountOf } from './teacherModel'

const fixture = readFileSync('tests/fixtures/essais-sample.essai.json', 'utf8')
const load = async (): Promise<Trial[]> => {
  const r = await importTrails(fixture)
  if (!r.ok) throw new Error('fixture')
  return r.trials as Trial[]
}
/** A JSON clone is a fresh object: the test may write fields the model declares readonly. */
type Mutable<T> = { -readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K] }
const mut = (t: Trial, patch: (d: Mutable<Trial>) => void): Trial => {
  const c = JSON.parse(JSON.stringify(t)) as Mutable<Trial>
  patch(c)
  return c as Trial
}

describe('trailCards', () => {
  it('one card per trial, in freeze order, with prediction, parent and changes', async () => {
    const [a, b] = await load()
    const cards = trailCards([b!, a!])
    expect(cards.map((c) => c.name)).toEqual(['A', 'B'])
    expect(cards[0]!.label).toBe('Essai A')
    expect(cards[0]!.parentName).toBeNull()
    expect(cards[0]!.fixed).toBeNull()
    expect(cards[1]!.parentName).toBe('A')
    expect(cards[1]!.prediction.text).toBe(b!.evidence.prediction.text)
    expect(cards[1]!.prediction.time).toMatch(/^\d\d:\d\d$/)
    expect(cards[1]!.changes.length).toBe(b!.evidence.changedSinceParent.length)
    expect(cards[1]!.changes.length).toBeGreaterThan(0)
    expect(cards[1]!.fixed).toEqual([])
    expect(cards[1]!.broken).toEqual([])
  })

  it('rules fixed and broken against the parent', async () => {
    const [a, b] = await load()
    const a2 = mut(a!, (d) => (d.evidence.ruleResults = [{ ruleId: 'R-x', severity: 'error', subjects: [] }, { ruleId: 'R-y', severity: 'warning', subjects: [] }]))
    const b2 = mut(b!, (d) => (d.evidence.ruleResults = [{ ruleId: 'R-y', severity: 'warning', subjects: [] }, { ruleId: 'R-z', severity: 'error', subjects: [] }]))
    const [ca, cb] = trailCards([a2, b2])
    expect(ca!.rules.map((r) => r.severityLabel)).toEqual(['erreur', 'avertissement'])
    expect(cb!.fixed).toEqual(['R-x'])
    expect(cb!.broken).toEqual(['R-z'])
  })

  it('a parent missing from the file gives null (not an empty claim)', async () => {
    const [, b] = await load()
    const [c] = trailCards([b!])
    expect(c!.parentName).toBeNull()
    expect(c!.fixed).toBeNull()
  })

  it('room name: none, known, unknown id', async () => {
    const [a] = await load()
    expect(trailCards([a!])[0]!.roomName).toBe('Sans salle')
    const withRoom = mut(a!, (d) => (d.design.roomId = 'podcast-room-small'))
    expect(trailCards([withRoom], () => ({ name: 'Studio podcast' }))[0]!.roomName).toBe('Studio podcast')
    expect(trailCards([withRoom])[0]!.roomName).toBe('podcast-room-small')
  })
})

describe('mapGeometry', () => {
  it('no room: bounding box of placements plus a margin', async () => {
    const [a] = await load()
    const g = mapGeometry(a!, null, 'Sans salle')
    expect(g.room).toBeNull()
    expect(g.dots).toHaveLength(a!.design.placements.length)
    const [vx, vy, vw, vh] = g.viewBox.split(' ').map(Number) as [number, number, number, number]
    for (const d of g.dots) {
      expect(d.x).toBeGreaterThan(vx)
      expect(d.x).toBeLessThan(vx + vw)
      expect(d.y).toBeGreaterThan(vy)
      expect(d.y).toBeLessThan(vy + vh)
    }
    expect(g.title).toContain("de l'essai A")
  })

  it('room: centred rect from typical dimensions, view covers a device outside it', async () => {
    const [a] = await load()
    const t = mut(a!, (d) => (d.design.placements[0].position_m = [10, 0, 0]))
    const g = mapGeometry(t, { name: 'x', width: 4, length: 5.5 }, 'x')
    expect(g.room).toEqual({ x: -2, y: -2.75, w: 4, h: 5.5 })
    const [vx, , vw] = g.viewBox.split(' ').map(Number) as [number, number, number, number]
    expect(vx).toBeLessThan(-2)
    expect(vx + vw).toBeGreaterThan(10)
  })

  it('empty placements do not produce NaN', async () => {
    const [a] = await load()
    const t = mut(a!, (d) => (d.design.placements = []))
    expect(mapGeometry(t, null, 'x').viewBox).not.toMatch(/NaN|Infinity/)
  })
})

describe('messages', () => {
  it('quarantine files are recognised and get their own message', () => {
    expect(isQuarantineFile('{"kind":"quarantine","items":[]}')).toBe(true)
    expect(isQuarantineFile('not json')).toBe(false)
    expect(isQuarantineFile('null')).toBe(false)
    expect(failureMessage('quarantine')).toBe(TEACHER_COPY.quarantine)
    expect(failureMessage('corrupt')).toBe(TEACHER_COPY.errorRead)
    expect(failureMessage('format')).toBe(TEACHER_COPY.errorRead)
  })
  it('trial count and limits', () => {
    expect(trialCountOf('{"trials":[1,2,3]}')).toBe(3)
    expect(trialCountOf('{"trials":5}')).toBeNull()
    expect(trialCountOf('nope')).toBeNull()
    expect(MAX_FILE_BYTES).toBe(10 * 1024 * 1024)
    expect(TEACHER_COPY.tooBig(10)).toContain('10 Mo')
    expect(TEACHER_COPY.tooMany(MAX_TRIALS)).toContain('500')
  })
  it('per-trial wording', () => {
    expect(TEACHER_COPY.frozenAt('10:49')).toBe('figé à 10:49')
    expect(TEACHER_COPY.parentOf('A')).toBe('parent : Essai A')
  })
  it('rejected notice only when something was rejected', () => {
    expect(rejectedNotice(0)).toBeNull()
    expect(rejectedNotice(1)).toContain('1 essai')
    expect(rejectedNotice(2)).toContain('2 essais')
  })
  it('change keys are in French', () => {
    expect(changeLabel('room')).toBe('Salle changée')
    expect(changeLabel('instance:+a')).toContain('ajouté')
    expect(changeLabel('connection:-2')).toBe('Câbles retirés : 2')
    expect(changeLabel('control:x.y')).toContain('x.y')
  })
  it('copy carries no acoustic numbers', () => {
    expect(JSON.stringify(TEACHER_COPY)).not.toMatch(/\bdB\b|STI/)
  })
})
