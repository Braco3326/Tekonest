import { describe, expect, it } from 'vitest'
import { legacyControls } from '../../src/ui/controlsPanel'
import { makeRegistry } from '../helpers'

/**
 * Task 32 (P19): the legacy HUD does not grow a dead « Alimentation » switch on every active device.
 * Task 33 (P19): nor the QL1 sound controls (playback, mute, master fader, balance): no legacy rule reads them, and level a1 puts a QL1 on the legacy HUD.
 */
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
  it('the QL1 declares the four Task 33 controls and the legacy panel shows none of them (the controls stay in the rig state)', () => {
    const ids = registry.deviceById.get('yamaha-ql1')!.controls!.map((c) => c.id)
    expect(ids).toEqual(['power', 'playback-usb', 'mute-master', 'fader-master', 'balance-master'])
    expect(legacyControls(registry.deviceById.get('yamaha-ql1')!.controls)).toEqual([])
  })
  it('a legacy control of the catalog is never hidden by mistake: every control that is not a Mode Création one stays, whatever the device', () => {
    const hidden = new Set(['power', 'playback-usb', 'mute-master', 'fader-master', 'balance-master'])
    const legacy = registry.catalog.devices.flatMap((d) => legacyControls(d.controls).map((c) => c.id))
    const all = registry.catalog.devices.flatMap((d) => (d.controls ?? []).map((c) => c.id)).filter((id) => !hidden.has(id))
    expect(legacy).toEqual(all)
    expect(all.length).toBeGreaterThan(0)
  })
  it('a device with no controls gives an empty list', () => {
    expect(legacyControls(registry.deviceById.get('shure-sm58')!.controls)).toEqual([])
    expect(legacyControls(undefined)).toEqual([])
  })
})
