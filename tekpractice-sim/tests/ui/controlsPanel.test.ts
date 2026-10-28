import { describe, expect, it } from 'vitest'
import { legacyControls } from '../../src/ui/controlsPanel'
import { makeRegistry } from '../helpers'

/** Task 32 (P19): the legacy HUD does not grow a dead « Alimentation » switch on every active device. */
describe('legacyControls', () => {
  const registry = makeRegistry()
  it('drops the Mode Création « power » switch and keeps every other control, in order', () => {
    const axia = registry.deviceById.get('axia-iq')!
    expect(axia.controls!.some((c) => c.id === 'power')).toBe(true)
    expect(legacyControls(axia.controls).map((c) => c.id)).toEqual(axia.controls!.filter((c) => c.id !== 'power').map((c) => c.id))
    expect(legacyControls(axia.controls).length).toBe(axia.controls!.length - 1)
  })
  it('a device whose only control is « power » has none left (no empty panel section)', () => {
    expect(legacyControls(registry.deviceById.get('qsc-k12-2')!.controls)).toEqual([])
    expect(legacyControls(registry.deviceById.get('yamaha-ql1')!.controls)).toEqual([])
  })
  it('a device with no controls gives an empty list', () => {
    expect(legacyControls(registry.deviceById.get('shure-sm58')!.controls)).toEqual([])
    expect(legacyControls(undefined)).toEqual([])
  })
})
