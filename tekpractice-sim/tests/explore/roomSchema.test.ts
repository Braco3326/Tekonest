import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RoomFile, RoomIndex } from '../../src/explore/roomSchema'

const DIR = 'content/rooms'

describe('content/rooms (synced from TEK Brain templates)', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json')

  it('has the 32 planned rooms', () => {
    expect(files.length).toBe(32)
  })

  it.each(files)('%s parses with the runtime schema', (f) => {
    const parsed = RoomFile.safeParse(JSON.parse(readFileSync(join(DIR, f), 'utf8')))
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues[0])).toBe(true)
  })

  it('index lists every room exactly once', () => {
    const index = RoomIndex.parse(JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8')))
    expect(index.rooms.map((r) => `${r.id}.json`).sort()).toEqual([...files].sort())
  })

  it('keeps gear_positions and coordinate_system (zod would strip undeclared keys)', () => {
    const room = JSON.parse(readFileSync(join(DIR, 'radio-talk-studio-medium.json'), 'utf8'))
    const extra = { ...room, coordinate_system: 'x = right', gear_positions: [{ equipment_id: 'ev-re20', zone: 'talk-table', position_m: [0, 1, 2], rotation_deg: 90, note: 'n' }] }
    const parsed = RoomFile.parse(extra)
    expect(parsed.gear_positions).toEqual(extra.gear_positions)
    expect(parsed.coordinate_system).toBe('x = right')
  })

  it('the synced radio-talk-studio-medium carries its 14 gear_positions', () => {
    const parsed = RoomFile.parse(JSON.parse(readFileSync(join(DIR, 'radio-talk-studio-medium.json'), 'utf8')))
    expect(parsed.gear_positions).toHaveLength(14)
  })

  it('rejects a room without typical dimensions', () => {
    expect(RoomFile.safeParse({ id: 'x', name_fr: 'x' }).success).toBe(false)
  })
})
