/**
 * Essais (Task 10): canonical, quantised fp1 fingerprint. Pure, no Babylon, no DOM.
 */
import { describe, expect, it } from 'vitest'
import { canonicalize, fingerprint, sha256hex } from '../../src/trials/fingerprint'
import { design } from './fixtures'

describe('canonicalize', () => {
  it('sorts object keys', () => {
    expect(canonicalize({ b: 1, a: { d: true, c: 'x' } })).toBe('{"a":{"c":"x","d":true},"b":1}')
  })

  it('keeps ordinary arrays in order', () => {
    expect(canonicalize({ list: ['b', 'a'] })).toBe('{"list":["b","a"]}')
  })

  it('quantises by field name: positions 1 mm, degrees 0.1, delayMs 0.01, others 1e-6', () => {
    expect(canonicalize({ position_m: [1.23456, -0.0004, 2] })).toBe('{"position_m":[1.235,0,2]}')
    expect(canonicalize({ yawDeg: 10.04 })).toBe('{"yawDeg":10}')
    expect(canonicalize({ yawDeg: 10.06 })).toBe('{"yawDeg":10.1}')
    expect(canonicalize({ delayMs: 43.456 })).toBe('{"delayMs":43.46}')
    expect(canonicalize({ gain: 0.12345678 })).toBe('{"gain":0.123457}')
  })

  it('normalises yaw to [0, 360) before quantising (0 ≡ 360)', () => {
    expect(canonicalize({ yawDeg: 360 })).toBe('{"yawDeg":0}')
    expect(canonicalize({ yawDeg: -10 })).toBe('{"yawDeg":350}')
    expect(canonicalize({ yawDeg: 359.97 })).toBe('{"yawDeg":0}')
    expect(canonicalize({ yawDeg: 720.04 })).toBe('{"yawDeg":0}')
    expect(canonicalize({ yawDeg: -0.02 })).toBe('{"yawDeg":0}')
    expect(() => canonicalize({ yawDeg: Infinity })).toThrow(RangeError)
  })

  it('drops empty inner controls maps (no control = no entry)', () => {
    expect(canonicalize({ controls: { a: {}, b: { x: true } } })).toBe(canonicalize({ controls: { b: { x: true } } }))
    expect(canonicalize({ controls: { a: {} } })).toBe('{"controls":{}}')
  })

  it('sorts instances and placements by instanceId (insertion order has no physical meaning)', () => {
    const i = [
      { instanceId: 'b', deviceId: 'x' },
      { instanceId: 'a', deviceId: 'y' },
    ]
    expect(canonicalize({ instances: i })).toBe(canonicalize({ instances: [...i].reverse() }))
    const p = [
      { instanceId: 'z', position_m: [0, 0, 0] },
      { instanceId: 'k', position_m: [1, 0, 0] },
    ]
    expect(canonicalize({ placements: p })).toBe(canonicalize({ placements: [...p].reverse() }))
    expect(canonicalize({ instances: i })).toBe('{"instances":[{"deviceId":"y","instanceId":"a"},{"deviceId":"x","instanceId":"b"}]}')
  })

  it('keeps every cable field (not just a/b) in the canonical cable', () => {
    const base = { a: { instance: 'mic', port: 'out' }, b: { instance: 'mix', port: 'in-1' } }
    const withKind = canonicalize({ connections: [{ ...base, kind: 'xlr' }] })
    expect(withKind).not.toBe(canonicalize({ connections: [base] }))
    expect(withKind).toBe(canonicalize({ connections: [{ kind: 'xlr', a: base.b, b: base.a }] }))
  })

  it('maps -0 to 0 and never uses an exponent', () => {
    expect(canonicalize({ x: -0 })).toBe('{"x":0}')
    expect(canonicalize({ x: 1e-7 })).toBe('{"x":0}')
    expect(canonicalize({ x: 2e-6 })).toBe('{"x":0.000002}')
    expect(canonicalize({ x: 1e9 })).toBe('{"x":1000000000}')
    expect(canonicalize({ position_m: [1e12] })).toBe('{"position_m":[1000000000000]}')
  })

  it('drops undefined fields', () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}')
  })

  it('refuses non-finite numbers', () => {
    expect(() => canonicalize({ x: Number.NaN })).toThrow()
    expect(() => canonicalize({ x: Infinity })).toThrow()
  })

  it('normalises connection lists: each cable a<b, then sorted', () => {
    const one = canonicalize({
      connections: [
        { a: { instance: 'mix', port: 'main-l' }, b: { instance: 'spk', port: 'in' } },
        { a: { instance: 'mix', port: 'in-1' }, b: { instance: 'mic', port: 'out' } },
      ],
    })
    const two = canonicalize({
      connections: [
        { a: { instance: 'mic', port: 'out' }, b: { instance: 'mix', port: 'in-1' } },
        { b: { port: 'main-l', instance: 'mix' }, a: { port: 'in', instance: 'spk' } },
      ],
    })
    expect(one).toBe(two)
  })
})

describe('fingerprint (fp1)', () => {
  it('is fp1: + 64 hex chars', async () => {
    expect(await fingerprint(design())).toMatch(/^fp1:[0-9a-f]{64}$/)
  })

  it('sha256hex matches a known vector', async () => {
    expect(await sha256hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('is stable under key reorder', async () => {
    const d = design()
    const reordered = {
      placements: d.placements.map((p) => ({ yawDeg: p.yawDeg, position_m: p.position_m, deviceId: p.deviceId, instanceId: p.instanceId })),
      rig: { controls: d.rig.controls, connections: d.rig.connections, instances: d.rig.instances },
      roomId: d.roomId,
    }
    expect(await fingerprint(reordered)).toBe(await fingerprint(d))
  })

  it('is stable under connection order and direction', async () => {
    const d = design()
    const swapped = design()
    swapped.rig.connections = [...d.rig.connections].reverse().map((c) => ({ a: c.b, b: c.a }))
    expect(await fingerprint(swapped)).toBe(await fingerprint(d))
  })

  it('is stable under float noise (1e-9) and -0', async () => {
    const d = design()
    const noisy = design()
    noisy.placements[0].position_m = [0 + 1e-9, 1.2 - 1e-9, -3 + 1e-9]
    noisy.placements[1].yawDeg = 10 + 1e-9
    noisy.placements[0].yawDeg = -0
    expect(await fingerprint(noisy)).toBe(await fingerprint(d))
  })

  it('changes when a position moves 2 mm', async () => {
    const moved = design()
    moved.placements[1].position_m = [-4 + 0.002, 2.2, -9]
    expect(await fingerprint(moved)).not.toBe(await fingerprint(design()))
  })

  it('accepts an injected hasher', async () => {
    expect(await fingerprint({ a: 1 }, async (s) => `H(${s})`)).toBe('fp1:H({"a":1})')
  })
})
