/**
 * Task 37: the pure view model of the coverage block (formatting, legend, statistics, the grid zones) and the REFERENCE case the e2e relies on:
 * concert-hall-medium + the two K12.2 of the reference template. The dots must be symmetric about the stage axis and brightest in front of the
 * speakers: that proves the room zones and the speakers share one world frame (no mirror, P14).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { computeField } from '../../src/acoustics/field'
import { RoomFile } from '../../src/explore/roomSchema'
import { roomLayout, type RoomLayout } from '../../src/explore/roomLayout'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { templateToDesign } from '../../src/creation/templates'
import { Template } from '../../src/creation/templateSchema'
import { signalPath } from '../../src/flow/signalPath'
import { coverageSources } from '../../src/creation/coverageSources'
import { binCounts, coverageGrid, formatDb, formatNumber, legendRows, listenerZones, noSourceMessage, pinnedText, pointText, statRows } from '../../src/creation/coverageModel'
import { makeRegistry } from '../helpers'
import { COVERAGE_PALETTE } from '../../src/creation/coveragePalette'
import type { PortRef } from '../../src/engine/types'
import type { PathResult } from '../../src/flow/signalPath'

const room = (id: string): RoomLayout => roomLayout(RoomFile.parse(JSON.parse(readFileSync(`content/rooms/${id}.json`, 'utf8'))))
const registry = makeRegistry()
const ref = (s: string): PortRef => {
  const [instance, port] = s.split(' ')
  return { instance, port }
}
function referenceRig() {
  const s = new CreationStore(registry, creationEvaluator(registry), templateToDesign(Template.parse(JSON.parse(readFileSync('content/templates/concert-simple-reference.json', 'utf8')))))
  for (const [a, b] of [['ql1 out-main-l', 'k12-g in-line-a'], ['ql1 out-main-r', 'k12-d in-line-a']]) expect(s.dispatch({ type: 'CONNECT', a: ref(a), b: ref(b) }).ok).toBe(true)
  expect(s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }).ok).toBe(true)
  const d = s.design()
  return { design: d, sources: coverageSources(d, registry, signalPath(d, registry, [])) }
}

describe('formatting: French decimals, a true minus, never « −0,0 » or NaN', () => {
  it('formatNumber / formatDb', () => {
    expect(formatNumber(-3.14159)).toBe('−3,1')
    expect(formatNumber(0)).toBe('0,0')
    expect(formatNumber(-0.04)).toBe('0,0')
    expect(formatNumber(2, 0)).toBe('2')
    expect(formatNumber(NaN)).toBe('–')
    expect(formatNumber(-Infinity)).toBe('–')
    expect(formatDb(-7.25)).toBe('−7,3 dB')
    expect(formatDb(0)).toBe('0,0 dB')
  })
  it('pointText / pinnedText say « aucun son » for a silent point, never a number', () => {
    expect(pointText('Régie', -2.06)).toBe('Régie : −2,1 dB')
    expect(pointText('Régie', -Infinity)).toBe('Régie : aucun son')
    expect(pinnedText(1.25, -3.75, -4)).toBe('Point épinglé (1,3 m ; −3,8 m) : −4,0 dB')
    expect(pinnedText(0, 0, -Infinity)).toContain('aucun son')
  })
})

describe('legend', () => {
  it('0 → −24 dB in 3 dB steps: 8 rows, the palette in order, the last open downward', () => {
    const rows = legendRows(null)
    expect(rows.map((r) => r.label)).toEqual(['0 à −3 dB', '−3 à −6 dB', '−6 à −9 dB', '−9 à −12 dB', '−12 à −15 dB', '−15 à −18 dB', '−18 à −21 dB', '−21 dB et moins'])
    expect(rows.map((r) => r.color)).toEqual([...COVERAGE_PALETTE])
    expect(rows.every((r) => r.count === null && r.countLabel === null)).toBe(true)
  })
  it('with a result each row carries its count as text', () => {
    const rows = legendRows([5, 0, 3, 0, 0, 0, 0, 12])
    expect(rows[0].countLabel).toBe('5 points')
    expect(rows[7].count).toBe(12)
  })
  it('binCounts: one count per scale bin (silence in the last), and the overlap flags', () => {
    const rel = new Float32Array([0, -2.9, -3, -23.9, -30, -Infinity])
    const { counts, hatched } = binCounts(rel, new Uint8Array([1, 0, 1, 0, 0, 0]))
    expect(counts).toEqual([2, 1, 0, 0, 0, 0, 0, 3])
    expect(hatched).toBe(2)
    expect(counts.reduce((a, b) => a + b, 0)).toBe(rel.length)
  })
  it('statRows: min, max, mean, σ, count and the grid step, as text', () => {
    const rows = statRows({ min: -18.04, max: 0, mean: -7.46, sd: 3.2, count: 1440 }, 0.5)
    expect(rows.map((r) => [r.label, r.value])).toEqual([['Minimum', '−18,0 dB'], ['Maximum', '0,0 dB'], ['Moyenne', '−7,5 dB'], ['Écart-type', '3,2 dB'], ['Points', '1440'], ['Pas de la grille', '0,5 m']])
    expect(statRows({ min: 0, max: 0, mean: 0, sd: 0, count: 10 }, 2)[5].value).toBe('2 m')
  })
})

describe('noSourceMessage', () => {
  const none: PathResult = { playbackReady: false, speakers: [], reasons: [], micOk: false, micReasons: [] }
  it('nothing fed and no reason: the bare sentence; several exclusion reasons are listed once each', () => {
    expect(noSourceMessage(none, [])).toBe('Aucune enceinte audible : aucune enceinte ne reçoit de signal.')
    expect(
      noSourceMessage(none, [
        { instanceId: 'a', reason: 'muted' },
        { instanceId: 'b', reason: 'muted' },
        { instanceId: 'c', reason: 'unverified' },
      ])
    ).toBe('Aucune enceinte audible : la console est en mute ; appareil non vérifié (Bêta).')
  })
})

describe('the grid zones: audience first, then foh (the earlier wins on overlap), in WORLD coordinates', () => {
  it('concert-hall-medium: the pit and the balcony, then the régie', () => {
    const zones = listenerZones(room('concert-hall-medium'))
    expect(zones.map((z) => z.id)).toEqual(['fosse', 'balcon', 'regie-facade'])
    expect(zones.map((z) => z.kind)).toEqual(['audience', 'audience', 'foh'])
    expect(zones[0]).toMatchObject({ x: 0, z: 3, w: 18.1, d: 20, y: 0 }) // as the room file, not mirrored
  })
  it('no layout (blank place / set) gives no zone: the grid is empty', () => {
    expect(listenerZones(null)).toEqual([])
    expect(coverageGrid(null, 1.2).points).toHaveLength(0)
  })
  it('about half of the shipped rooms have no zone to cover (the panel needs its empty state): the count is measured, not assumed', () => {
    const ids = (JSON.parse(readFileSync('content/rooms/index.json', 'utf8')) as { id: string }[] | { rooms: { id: string }[] }) as unknown
    const list = Array.isArray(ids) ? (ids as { id: string }[]) : (ids as { rooms: { id: string }[] }).rooms
    const empty = list.filter((r) => listenerZones(room(r.id)).length === 0)
    expect(empty.length).toBeGreaterThan(0)
    for (const r of empty) expect(coverageGrid(room(r.id), 1.2).points.length, r.id).toBe(0)
  })
  it('the ear height is the y of every point above its zone floor: 1.2 m on the pit, 1.7 m standing; the balcony stands on its deck', () => {
    const l = room('concert-hall-medium')
    const seated = coverageGrid(l, 1.2).points
    const standing = coverageGrid(l, 1.7).points
    expect(seated.length).toBe(standing.length)
    const ys = new Set<number>()
    for (let i = 1; i < seated.length; i += 3) ys.add(Math.round(seated[i] * 100) / 100)
    expect([...ys].sort()).toEqual([1.2, 4.7]) // pit floor 0 + 1.2, balcony floor 3.5 + 1.2
    expect(new Set(Array.from({ length: standing.length / 3 }, (_, i) => Math.round(standing[3 * i + 1] * 100) / 100))).toEqual(new Set([1.7, 5.2]))
  })
})

describe('reference case: concert-hall-medium + k12-g (x = +6) and k12-d (x = −6), both at yaw 0', () => {
  const layout = room('concert-hall-medium')
  const { sources } = referenceRig()
  const grid = coverageGrid(layout, 1.2)
  const f = computeField(sources, grid.points)
  const at = (x: number, y: number, z: number): number => {
    for (let i = 0; i < grid.points.length; i += 3) if (Math.abs(grid.points[i] - x) < 1e-4 && Math.abs(grid.points[i + 1] - y) < 1e-4 && Math.abs(grid.points[i + 2] - z) < 1e-4) return f.relDb[i / 3]
    throw new Error(`no dot at ${x}, ${y}, ${z}`)
  }
  it('is within the cap and at the finest step, ≤ 20 000 points, all finite and ≤ 0 with the maximum exactly 0', () => {
    expect(sources.map((s) => s.id)).toEqual(['k12-d', 'k12-g'])
    expect(grid.points.length / 3).toBeLessThanOrEqual(20000)
    expect(grid.stepM).toBe(0.5)
    expect(Math.max(...f.relDb)).toBe(0)
    expect(Array.from(f.relDb).every((v) => Number.isFinite(v) && v <= 0)).toBe(true)
  })
  it('the dots are symmetric about the stage axis x = 0: every dot at (x, z) has the same level as its mirror (−x, z)', () => {
    let n = 0
    for (let i = 0; i < grid.points.length; i += 3) {
      const [x, y, z] = [grid.points[i], grid.points[i + 1], grid.points[i + 2]]
      expect(at(-x, y, z), `(${x}, ${z})`).toBeCloseTo(f.relDb[i / 3], 3)
      n++
    }
    expect(n).toBeGreaterThan(1000)
  })
  it('the field is brightest in FRONT of the speakers (z just past the stage edge, x near ±6), and the back of the hall is far below it', () => {
    let best = 0
    for (let i = 0; i < f.relDb.length; i++) if (f.relDb[i] > f.relDb[best]) best = i
    const x = grid.points[3 * best]
    const z = grid.points[3 * best + 2]
    expect(Math.abs(Math.abs(x) - 6)).toBeLessThanOrEqual(0.25 + 1e-6) // under a speaker's axis
    expect(z).toBeGreaterThan(-7.5) // in front of the speakers (they stand at z = −7.5, facing +z, the audience)
    expect(z).toBeLessThan(-3) // the speakers hang 1.5 m above the ear plane: the closest on-axis dot is a few metres out
    // and the back of the hall, 20 m from the stage on the centre line, is far below the loudest point
    expect(at(0.25, 1.2, 12.75)).toBeLessThan(-6)
  })
  it('a speaker turned to face the stage (yaw 180) is loudest nowhere in the audience: the dots show its REAR lobe only', () => {
    const turned = sources.map((s) => ({ ...s, pose: { ...s.pose, yawDeg: 180 } }))
    const g = computeField(turned, grid.points)
    // every audience dot is behind both speakers: −30 dB rear lobe + distance: the relative field is still ≤ 0 and finite, but the levels differ
    expect(g.maxDb).toBeLessThan(f.maxDb - 20)
  })
})
