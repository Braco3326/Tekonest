import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { RoomFile } from '../../src/explore/roomSchema'
import { floorPlanSvg, roomPlanSvg } from '../../src/creation/roomPlanSvg'

const DIR = 'content/rooms'
const rooms = readdirSync(DIR)
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .map((f) => RoomFile.parse(JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'))))

const BRAND = ['#131114', '#F3EDE3', '#DD9349', '#612D45']
const colours = (svg: string): string[] => [...svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1])
/** Well-formed enough for an <img>: every tag is `<name attr="v" …>` / `</name>` (XML has no bare attributes). */
const wellFormed = (svg: string): boolean => {
  const tags = svg.match(/<[^>]*>/g) ?? []
  return tags.every((t) => /^<\/?[a-zA-Z]+(\s+[a-zA-Z:-]+="[^"<]*")*\s*\/?>$/.test(t)) && svg.replace(/<[^>]*>/g, '').trim() === ''
}

describe('roomPlanSvg (C15): build-time floor plans from the room data', () => {
  it('there are 32 rooms', () => expect(rooms).toHaveLength(32))

  it.each(rooms.map((r) => [r.id, r] as const))('%s: an <svg>, ≤ 8 KB, one <rect> per zone, brand colours only', (_id, room) => {
    const svg = roomPlanSvg(room)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(wellFormed(svg)).toBe(true)
    expect(Buffer.byteLength(svg, 'utf8')).toBeLessThanOrEqual(8192)
    expect(svg.match(/<rect\b/g)?.length ?? 0).toBe(room.zones.length)
    for (const c of colours(svg)) expect([...BRAND, 'none'], c).toContain(c)
  })

  it('the viewBox is the room in metres (plus a margin)', () => {
    const hall = rooms.find((r) => r.id === 'concert-hall-medium')!
    const vb = /viewBox="([^"]+)"/.exec(roomPlanSvg(hall))![1].split(' ').map(Number)
    expect(vb[2]).toBeGreaterThanOrEqual(18.1)
    expect(vb[2]).toBeLessThan(18.1 + 4)
    expect(vb[3]).toBeGreaterThanOrEqual(32)
    expect(vb[3]).toBeLessThan(32 + 4)
  })

  it('reads as the Face view: front wall (stage) at the top, world +x on the left (ADR-0011, P14)', () => {
    const hall = rooms.find((r) => r.id === 'concert-hall-medium')!
    const svg = roomPlanSvg(hall)
    const rect = (id: string): { x: number; y: number; w: number; h: number } => {
      const m = new RegExp(`<rect data-zone="${id}" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"`).exec(svg)!
      return { x: +m[1], y: +m[2], w: +m[3], h: +m[4] }
    }
    const stage = rect('scene')
    const foh = rect('regie-facade')
    expect(stage.y + stage.h).toBeLessThan(foh.y) // stage above FOH
    // « régie retours » is at world x = +8: drawn left of the centre line
    const mon = rect('regie-retours')
    expect(mon.x + mon.w).toBeLessThan(0)
    // the front wall is marked (Ambre line on the top edge)
    expect(svg).toContain('data-wall="front"')
  })

  it('doors are gaps in the walls', () => {
    const hall = rooms.find((r) => r.id === 'concert-hall-medium')!
    const walls = /<path data-walls="" d="([^"]+)"/.exec(roomPlanSvg(hall))![1]
    // 4 walls + 4 doors → 8 wall runs (one M per run)
    expect(walls.match(/M/g)!.length).toBe(4 + hall.openings.filter((o) => o.kind === 'door').length)
  })

  it('is deterministic', () => {
    expect(roomPlanSvg(rooms[0])).toBe(roomPlanSvg(rooms[0]))
  })
})

describe('floorPlanSvg: a bare floor (sets, « Salle vide neutre »)', () => {
  it('draws the floor outline and the front wall, no zones, brand colours only, small', () => {
    const svg = floorPlanSvg(24, 14)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).not.toContain('<rect')
    expect(svg).toContain('data-wall="front"')
    expect(wellFormed(svg)).toBe(true)
    expect(Buffer.byteLength(svg, 'utf8')).toBeLessThanOrEqual(8192)
    for (const c of colours(svg)) expect([...BRAND, 'none'], c).toContain(c)
  })
})
