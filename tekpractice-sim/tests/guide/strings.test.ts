// The guide's own words: one frozen table, impersonal French, nothing private, no digit.
import { describe, expect, it } from 'vitest'
import { TP_STRINGS, tpString } from '../../src/guide/strings'
import { shapeReply } from '../../src/guide/vendor/core/shape'
import { privateHits, roleHits } from './privateTokens'

function leaves(node: unknown, path: string[] = []): { path: string; value: unknown }[] {
  if (typeof node === 'string') return [{ path: path.join('.'), value: node }]
  if (node !== null && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => leaves(v, [...path, k]))
  return [{ path: path.join('.'), value: node }]
}

function frozenEverywhere(node: unknown): boolean {
  if (node === null || typeof node !== 'object') return true
  return Object.isFrozen(node) && Object.values(node).every(frozenEverywhere)
}

const all = leaves(TP_STRINGS)
const FLOWS = ['premier-montage', 'alimentation-fantome', 'lire-le-statut'] as const

describe('TP_STRINGS', () => {
  it('every string in TP_STRINGS is non-empty, contains no digit, and ends without trailing space', () => {
    expect(all.length).toBeGreaterThan(20)
    for (const { path, value } of all) {
      expect(typeof value, path).toBe('string')
      const s = value as string
      expect(s.length, path).toBeGreaterThan(0)
      expect(/\d/.test(s), `${path} has a digit`).toBe(false)
      expect(/tek\s*brain/i.test(s), path).toBe(false)
      expect(s, path).toBe(s.trim())
      expect(/[<>]/.test(s), `${path} has an angle bracket`).toBe(false)
    }
  })

  it('names no private thing, no ruling id and no vendor secret', () => {
    for (const { path, value } of all) {
      const s = value as string
      expect(privateHits(s), path).toEqual([])
      expect(roleHits(s), path).toEqual([])
      expect(/\b[RFGW]-?\d/i.test(s), path).toBe(false)
    }
  })

  it('uses the app’s own words: « lieu », never « plan de travail »', () => {
    for (const { path, value } of all) expect(/plan de travail/i.test(value as string), path).toBe(false)
    expect(TP_STRINGS.verdict.benchEmpty).toContain('lieu')
    expect(TP_STRINGS.flows['lire-le-statut'].steps.list).toContain('Erreurs et avertissements')
    expect(TP_STRINGS.flows['premier-montage'].steps.status).toContain('Signal OK')
  })

  it('writes every apostrophe as ’ except in the one pinned sentence, which stays byte-identical to the brief', () => {
    for (const { path, value } of all) {
      if (path === 'ask.noInformation') continue
      expect((value as string).includes("'"), path).toBe(false)
    }
    expect(TP_STRINGS.ask.noInformation).toBe("Je n'ai pas encore d'information sur ce point.")
  })

  it('is frozen at every level', () => {
    expect(frozenEverywhere(TP_STRINGS)).toBe(true)
    expect(() => {
      ;(TP_STRINGS as unknown as { verdict: { benchEmpty: string } }).verdict.benchEmpty = 'x'
    }).toThrow()
  })

  it('holds the sentences the brain needs', () => {
    expect(TP_STRINGS.verdict.benchEmpty).not.toBe('')
    expect(TP_STRINGS.verdict.placeFirst).not.toBe('')
    expect(TP_STRINGS.verdict.nothingToJudge).not.toBe('')
    expect(TP_STRINGS.verdict.allGood).not.toBe('')
    expect(TP_STRINGS.verdict.notYet).not.toBe('')
    expect(TP_STRINGS.verdict.toFix).not.toBe('')
    expect(TP_STRINGS.ask.examQuiet).not.toBe('')
    expect(TP_STRINGS.ask.noInformation).toBe("Je n'ai pas encore d'information sur ce point.")
    expect(TP_STRINGS.error.calm).not.toBe('')
  })

  it('has a title and at least three steps for each flow of the first release', () => {
    for (const id of FLOWS) {
      expect(tpString(`flows.${id}.title`), id).not.toBe('')
      const steps = all.filter((l) => l.path.startsWith(`flows.${id}.steps.`))
      expect(steps.length, id).toBeGreaterThanOrEqual(3)
    }
  })

  it('every string passes the browser-side shape check as a reply (nothing that looks like an id)', () => {
    for (const { path, value } of all) {
      const r = shapeReply({ kind: 'answer', text: value, lines: [{ text: value, badge: null, citation: null }], verdict: null })
      expect(r.kind, path).toBe('answer')
      expect(r.text, path).toBe(value)
      expect(r.lines[0]!.text, path).toBe(value)
    }
  })
})

describe('tpString', () => {
  it('returns the string for a known key', () => {
    expect(tpString('verdict.benchEmpty')).toBe(TP_STRINGS.verdict.benchEmpty)
    expect(tpString('flows.premier-montage.title')).toBe(TP_STRINGS.flows['premier-montage'].title)
  })

  it('returns an empty string for an unknown key, a branch, or an inherited name', () => {
    for (const k of ['', 'nope', 'verdict', 'verdict.nope', 'verdict.benchEmpty.x', 'flows', 'constructor', '__proto__', 'verdict.__proto__', 'verdict.constructor', 'toString', 'a.b.c.d']) {
      expect(tpString(k), k).toBe('')
    }
    expect(tpString(undefined as unknown as string)).toBe('')
    expect(tpString(5 as unknown as string)).toBe('')
  })
})
