/**
 * Coach IA × TEK Brain (master prompt B3/A5): the coach may cite TEK Brain
 * chunks as [kb:<id>] — only those packed for the rule that fired.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ConnectionGraph } from '../../src/engine/ConnectionGraph'
import { buildGrounding, groundingToContext, validateReply, type KbPack } from '../../src/ai/grounding'
import { SYSTEM_PROMPT } from '../../src/ai/prompt'
import { makeLevel, makeRegistry } from '../helpers'

const registry = makeRegistry()
const a1 = makeLevel('a1')
const snapshot = () => new ConnectionGraph(registry, a1.devices).snapshot()
const q = {
  ruleId: 'R2',
  errorCode: 'SIGNAL_MISMATCH',
  subjects: [
    { instance: 'sm58-1', port: 'out-xlr' },
    { instance: 'k12-1', port: 'in-line-a' },
  ],
}
const kb: KbPack = {
  byRule: { R2: ['concept:mic-level', 'rule:signal-type-mismatch'], R4: ['concept:phantom-power'] },
  chunks: {
    'concept:mic-level': { title: 'Niveau micro', text: 'Quelques millivolts.', sourceUrls: ['https://a.example'] },
    'rule:signal-type-mismatch': { title: 'Signal', text: 'Pourquoi R2.', sourceUrls: ['https://b.example'] },
    'concept:phantom-power': { title: '+48 V', text: 'Alimentation fantôme.', sourceUrls: ['https://c.example'] },
  },
}

describe('KB chunks in the coach grounding', () => {
  it('packs only the chunks mapped to the rule that fired', () => {
    const g = buildGrounding(registry, snapshot(), q, undefined, kb)
    expect(g.allowedKbIds).toEqual(['concept:mic-level', 'rule:signal-type-mismatch'])
    const ctx = groundingToContext(g)
    expect(ctx).toContain('[kb:concept:mic-level]')
    expect(ctx).toContain('Quelques millivolts.')
    expect(ctx).not.toContain('Alimentation fantôme.')
  })

  it('accepts a [kb:…] citation from the pack and rejects any other', () => {
    const g = buildGrounding(registry, snapshot(), q, undefined, kb)
    expect(validateReply('Un micro sort des millivolts [kb:concept:mic-level]. Qu’attend cette entrée ?', g).ok).toBe(true)
    const bad = validateReply('Pense au +48 V [kb:concept:phantom-power].', g)
    expect(bad.ok).toBe(false)
  })

  it('without a pack, behaviour is unchanged (no kb ids allowed)', () => {
    const g = buildGrounding(registry, snapshot(), q)
    expect(g.allowedKbIds).toEqual([])
    expect(validateReply('Voir [kb:concept:mic-level] [R2]', g).ok).toBe(false)
  })

  it('the system prompt teaches the [kb:…] citation form', () => {
    expect(SYSTEM_PROMPT).toContain('[kb:')
  })

  it('the shipped pack covers the catalog rules and every id resolves', () => {
    const pack = JSON.parse(readFileSync('content/coach/kb-chunks.json', 'utf8')) as KbPack
    for (const r of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8']) {
      expect(pack.byRule[r]?.length, r).toBeGreaterThan(0)
      for (const id of pack.byRule[r]) expect(pack.chunks[id], id).toBeTruthy()
    }
    for (const c of Object.values(pack.chunks)) expect(c.sourceUrls.length).toBeGreaterThan(0)
  })
})
