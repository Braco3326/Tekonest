import { describe, expect, it } from 'vitest'
import { ProjectSession } from '../../src/creation/projectSession'

describe('ProjectSession: the tab’s project identity (Task 13 re-review)', () => {
  it('starts untitled', () => {
    expect(new ProjectSession().state).toEqual({ name: null, savedFp: null, stamp: null })
  })
  it('open B, save (S2), undo past Ouvrir, redo: B comes back with its LATEST stamp and fingerprint, never the one at open', () => {
    const s = new ProjectSession()
    s.set({ name: 'A', savedFp: 'fpA', stamp: 'SA' })
    s.set({ name: 'B', savedFp: 'fp1', stamp: 'S1' }) // Ouvrir B
    s.set({ name: 'B', savedFp: 'fp2', stamp: 'S2' }) // edit + Ctrl+S
    s.restoreName('A') // undo past Ouvrir
    expect(s.state).toEqual({ name: 'A', savedFp: 'fpA', stamp: 'SA' })
    s.restoreName('B') // redo
    expect(s.state).toEqual({ name: 'B', savedFp: 'fp2', stamp: 'S2' })
  })
  it('restoring the untitled project: no fingerprint, no stamp', () => {
    const s = new ProjectSession()
    s.set({ name: 'A', savedFp: 'fpA', stamp: 'SA' })
    s.restoreName(null)
    expect(s.state).toEqual({ name: null, savedFp: null, stamp: null })
  })
  it('a name this tab never saved nor opened restores with no stamp (a save then checks as new)', () => {
    const s = new ProjectSession()
    s.restoreName('X')
    expect(s.state).toEqual({ name: 'X', savedFp: null, stamp: null })
  })
})
