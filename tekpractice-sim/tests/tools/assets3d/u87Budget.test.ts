/** Wave 5c finding H: the U 87 Ai ships a 10415-triangle Meshy model, over the mic class (6000). That is declared, not silent: the spec carries an explicit budget and says why. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadSpecs } from '../../../tools/assets3d/loadSpecs'

describe('neumann-u87-ai: the triangle count over the mic class is a documented exception', () => {
  const spec = loadSpecs().find((s) => s.id === 'neumann-u87-ai')
  const tris = (JSON.parse(readFileSync(new URL('../../../public/assets/ASSET_MANIFEST.json', import.meta.url), 'utf8')) as { assets: { id: string; tris: number }[] }).assets.find((a) => a.id === 'neumann-u87-ai')?.tris

  it('declares build.budget with a ceiling that holds the shipped model, above the 6000 of the other mics', () => {
    expect(spec?.build?.budget).toBeDefined()
    expect(spec!.build!.budget!.max).toBeGreaterThan(6000)
    // Structure rebuild 2026-11-15: the U 87 is now a scripted revolve (hybrid) of 2462 triangles, no longer the 10415-triangle Meshy model: the shipped count may sit under the mic class, but the
    // spec still declares the wider ceiling, and whatever ships must lie inside the declared range (below). If it ever went over the mic class again, the ceiling must hold it:
    if ((tris ?? 0) > 6000) expect(spec!.build!.budget!.max).toBeGreaterThanOrEqual(tris!)
    expect(tris).toBeDefined()
    expect(tris).toBeLessThanOrEqual(spec!.build!.budget!.max)
    expect(tris).toBeGreaterThanOrEqual(spec!.build!.budget!.min)
  })

  it('says in a source note that it is an exception and why', () => {
    const note = spec!.sources.map((s) => s.note ?? '').join(' ')
    expect(note).toMatch(/EXCEPTION to the mic class/)
    expect(note).toMatch(/Meshy/)
  })
})
