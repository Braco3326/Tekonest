/**
 * tests/fixtures/essais-sample.essai.json was written by the game's own export
 * (Task 14, the Essais panel's « Exporter pour l'enseignant »), not by hand.
 * Task 15's teacher page loads it: it must stay a valid, verifiable export.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { importTrails } from '../../src/trials/export'

describe('essais-sample.essai.json fixture', () => {
  it('imports cleanly: 2 Essais, B child of A, no acoustic values', async () => {
    const text = readFileSync(new URL('../fixtures/essais-sample.essai.json', import.meta.url), 'utf8')
    const r = await importTrails(text)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.rejected).toBe(0)
    expect(r.trials.map((t) => t.name)).toEqual(['A', 'B'])
    expect(r.trials[1].parentId).toBe(r.trials[0].id)
    expect(r.trials.every((t) => t.evidence.prediction.text.trim() !== '')).toBe(true)
    expect(text).not.toMatch(/dB|STI/)
  })
})
