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
    expect(tris).toBeGreaterThan(6000)
    expect(tris).toBeLessThanOrEqual(spec!.build!.budget!.max)
    expect(tris).toBeGreaterThanOrEqual(spec!.build!.budget!.min)
  })

  it('says in a source note that it is an exception and why', () => {
    const note = spec!.sources.map((s) => s.note ?? '').join(' ')
    expect(note).toMatch(/EXCEPTION to the mic class/)
    expect(note).toMatch(/Meshy/)
  })
})
