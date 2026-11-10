import { describe, expect, it } from 'vitest'
import { busLive, parseBuses } from '../../src/controls/busGraph'

const buses = { ch1: { ports: ['in-mic-1'] }, ch2: { ports: ['in-mic-2'] }, st: { follows: ['ch1', 'ch2'] } }

describe('busLive', () => {
  it('a bus is live while one of its ports is connected', () => {
    expect(busLive(buses, 'ch1', new Set(['in-mic-1']))).toBe(true)
    expect(busLive(buses, 'ch1', new Set(['in-mic-2']))).toBe(false)
    expect(busLive(buses, 'ch1', new Set())).toBe(false)
  })
  it('a bus that follows others is live while any of them is', () => {
    expect(busLive(buses, 'st', new Set(['in-mic-2']))).toBe(true)
    expect(busLive(buses, 'st', new Set())).toBe(false)
  })
  it('an undeclared bus is silent, and no bus map at all keeps every bus live', () => {
    expect(busLive(buses, 'ch9', new Set(['in-mic-1']))).toBe(false)
    expect(busLive(undefined, 'anything', new Set())).toBe(true)
  })
  it('a cycle reads as silent instead of looping', () => {
    expect(busLive({ a: { follows: ['b'] }, b: { follows: ['a'] } }, 'a', new Set(['x']))).toBe(false)
  })
})

describe('parseBuses', () => {
  it('keeps a well-formed map and refuses anything else', () => {
    expect(parseBuses(buses)).toEqual(buses)
    expect(parseBuses({ a: { ports: 'x' } })).toBeNull()
    expect(parseBuses({ a: [] })).toBeNull()
    expect(parseBuses([])).toBeNull()
    expect(parseBuses(null)).toBeNull()
  })
})
