/**
 * Waves 2 to 5 review, findings 9 and 11: two signal types that the patching rules must keep apart.
 *  9  AES50 (Behringer / Midas consoles and stage boxes) is not Dante: the M32 `aes50-a/b` ports are typed `aes50`, so rule R2 refuses a cable to a Dante (`aoip`) port.
 *  11 A USB MIDI / control surface carries no audio: its USB port is typed `usb-control`, so R2 refuses a cable to a `usb-audio` computer port.
 * R5 to R8 and the 25 original devices are untouched (their own tests stay green); the new signals have a cable style and French labels.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { ConnectionGraph } from '../../src/engine/ConnectionGraph'
import { COPY } from '../../src/creation/copy'
import { SIGNAL_STYLE } from '../../src/creation/cableStyle'
import { parseProposals, registerProposals } from '../../src/creation/betaDevices'

const registry = makeRegistry()
const withBeta = () => {
  const r = makeRegistry()
  registerProposals(r, parseProposals(JSON.parse(readFileSync('content/proposals/catalog-proposals.json', 'utf8')) as unknown, r).devices)
  return r
}
const graph = (r: ReturnType<typeof makeRegistry>, ids: [string, string][]) => new ConnectionGraph(r, ids.map(([instanceId, deviceId]) => ({ instanceId, deviceId })))
const signalOf = (r: ReturnType<typeof makeRegistry>, device: string, port: string) => r.deviceById.get(device)?.ports.find((p) => p.portId === port)?.signal

describe('the two signal types exist with a cable style and French labels', () => {
  it.each(['aes50', 'usb-control'])('%s is a catalogue signal with a distinct cable colour and a French name', (id) => {
    expect(registry.signalById.get(id), id).toBeTruthy()
    expect(SIGNAL_STYLE[id]?.color).toMatch(/^#[0-9A-F]{6}$/)
    expect(COPY.signal?.[id]).toBeTruthy()
  })
  it('aes50 is digital audio, usb-control is a control signal (no audio)', () => {
    expect(registry.signalById.get('aes50')?.class).toBe('digital')
    expect(registry.signalById.get('usb-control')?.class).toBe('control')
  })
})

describe('finding 9: AES50 is not Dante', () => {
  it('the M32 AES50 ports are typed aes50 (ethercon), its other network-looking ports are untouched', () => {
    expect(signalOf(registry, 'midas-m32', 'aes50-a')).toBe('aes50')
    expect(signalOf(registry, 'midas-m32', 'aes50-b')).toBe('aes50')
    expect(registry.deviceById.get('midas-m32')?.ports.find((p) => p.portId === 'aes50-a')?.connector).toBe('ethercon')
  })
  it('an M32 AES50 port cannot be patched to a CL5 Dante port: rule R2 refuses (SIGNAL_MISMATCH)', () => {
    const g = graph(registry, [['m32', 'midas-m32'], ['cl5', 'yamaha-cl5']])
    const r = g.connect({ instance: 'm32', port: 'aes50-a' }, { instance: 'cl5', port: 'net-dante-1' })
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).toMatch(/SIGNAL_MISMATCH/)
    expect(JSON.stringify(r)).toMatch(/R2/)
  })
  it('two AES50 ports patch together (M32 to the Behringer S16 stage box, a Bêta device typed from its spec)', () => {
    const r = withBeta()
    expect(signalOf(r, 'behringer-s16', 'aes50-a')).toBe('aes50')
    const g = graph(r, [['m32', 'midas-m32'], ['s16', 'behringer-s16']])
    expect(g.connect({ instance: 'm32', port: 'aes50-a' }, { instance: 's16', port: 'aes50-a' }).ok).toBe(true)
  })
  it('every port whose id says aes50 is typed aes50, in the catalogue and in the Bêta proposals', () => {
    const r = withBeta()
    let seen = 0
    for (const d of r.deviceById.values())
      for (const p of d.ports)
        if (/(^|-)aes50(-|$)/.test(p.portId)) {
          seen++
          expect(p.signal, `${d.id} ${p.portId}`).toBe('aes50')
        }
    expect(seen).toBeGreaterThanOrEqual(4)
  })
})

describe('finding 11: USB control surfaces carry no audio', () => {
  it.each([
    ['akai-mpk-mini-mk3', 'usb'],
    ['presonus-faderport-8', 'usb'],
    ['behringer-x-touch-universal', 'usb-pc'],
  ])('%s %s is typed usb-control, and rule R2 refuses a cable to a computer USB audio port', (id, port) => {
    expect(signalOf(registry, id, port)).toBe('usb-control')
    const g = graph(registry, [['ctl', id], ['pc', 'apple-mac-studio']])
    const r = g.connect({ instance: 'ctl', port }, { instance: 'pc', port: 'usb-a-1' })
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).toMatch(/SIGNAL_MISMATCH/)
  })
  it('no usb-audio port belongs to a device of the controller category', () => {
    for (const d of registry.catalog.devices.filter((x) => x.realWorld.category === 'controller'))
      for (const p of d.ports) expect(p.signal, `${d.id} ${p.portId}`).not.toBe('usb-audio')
  })
})
