import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { RoomFile } from '../../src/explore/roomSchema'
import { designFromRoomGear } from '../../src/creation/templateGear'

const room = (id: string) => RoomFile.parse(JSON.parse(readFileSync(`content/rooms/${id}.json`, 'utf8')))

describe('designFromRoomGear', () => {
  const plan = designFromRoomGear(room('radio-talk-studio-medium'), makeRegistry())

  it('spawns the 9 catalog devices with <deviceId>-g<n> ids', () => {
    const ids = plan.design.rig.instances.map((i) => i.instanceId)
    expect(ids).toHaveLength(9)
    expect(ids.filter((i) => i.startsWith('ev-re20-g'))).toEqual(['ev-re20-g1', 'ev-re20-g2', 'ev-re20-g3', 'ev-re20-g4'])
    expect(ids).toContain('yellowtec-mika-g1')
    expect(ids).toContain('yellowtec-litt-g1')
    expect(ids).toContain('genelec-8030c-g1')
    expect(ids).toContain('genelec-8030c-g2')
    expect(ids).toContain('playout-pc-g1')
  })

  it('places from position_m and yawDeg = rotation_deg ?? 0, in room:<id>', () => {
    expect(plan.design.roomId).toBe('room:radio-talk-studio-medium')
    const g = room('radio-talk-studio-medium').gear_positions!
    const first = g.find((x) => x.equipment_id === 'ev-re20')!
    const p = plan.design.placements.find((x) => x.instanceId === 'ev-re20-g1')!
    expect(p.position_m).toEqual(first.position_m)
    expect(p.yawDeg).toBe(first.rotation_deg ?? 0)
    expect(plan.design.placements).toHaveLength(9)
  })

  it('lists the 5 non-catalog items as unavailable', () => {
    expect(plan.unavailable.map((u) => u.equipmentId).sort()).toEqual(
      ['behringer-ha400', 'beyerdynamic-dt-770-pro', 'dhd-rx2', 'rtw-touchmonitor-tm7', 'telos-hx2'],
    )
    expect(plan.unavailable[0]).toHaveProperty('zone')
  })

  it('a room without gear_positions yields an empty plan', () => {
    const r = { ...room('radio-talk-studio-medium'), gear_positions: undefined }
    const empty = designFromRoomGear(r, makeRegistry())
    expect(empty.design.rig.instances).toEqual([])
    expect(empty.unavailable).toEqual([])
  })
})
