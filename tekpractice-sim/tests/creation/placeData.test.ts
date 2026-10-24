import { describe, expect, it, vi } from 'vitest'
import { loadPlaceData } from '../../src/creation/placeData'

describe('loadPlaceData: never throws, and says when it fell back (Task 12)', () => {
  it('a real room loads, not marked as a fallback', async () => {
    const d = await loadPlaceData({ kind: 'room', id: 'concert-hall-medium' })
    expect(d.kind).toBe('room')
    expect(d.fallback).toBeUndefined()
  })
  it('the blank room is not a fallback', async () => {
    const d = await loadPlaceData({ kind: 'blank' })
    expect(d).toMatchObject({ kind: 'blank' })
    expect(d.fallback).toBeUndefined()
  })
  it('an unknown room falls back to the blank room, flagged', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const d = await loadPlaceData({ kind: 'room', id: 'nope' })
    warn.mockRestore()
    expect(d).toMatchObject({ kind: 'blank', fallback: true })
  })
})
