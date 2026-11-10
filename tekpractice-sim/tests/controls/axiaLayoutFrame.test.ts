/**
 * The Axia iQ layout against the picture it sits on (Wave 5). The top picture (assets-source/axia-iq/photos/top_rectified.png, 2048 x 1904 px over
 * 519.3 x 482.9 mm) has the REAR at the bottom and the FRONT at the top, and the face frame counts y from the I/O (rear) edge. The strip controls were
 * once written in the frame of the unrotated photo (x and y both mirrored), so the rig's knobs stood at the front edge and its ON keys at the bridge.
 * These numbers are read on the picture (mm grid, +/- 1 mm): the strip's encoder at the bridge foot, the PGM / PHONE keys behind the fader, the
 * fader between its two screws, SOFT / PREVIEW and ON / OFF at the front.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseControlLayout, type ControlDef } from '../../src/controls/controlTypes'

const { layout, errors } = parseControlLayout(JSON.parse(readFileSync(join(__dirname, '../../content/control-layouts/axia-iq.json'), 'utf8')))
const byId = new Map<string, ControlDef>((layout?.controls ?? []).map((c) => [c.id, c]))
const near = (a: number, b: number, tol: number): void => expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThanOrEqual(tol)

describe('axia-iq layout: every strip control sits on its printed counterpart', () => {
  it('parses and expands to 8 strips', () => {
    expect(errors).toEqual([])
    for (let n = 1; n <= 8; n++) for (const k of ['fader-', 'ch', 'ch']) expect(byId.has(k === 'fader-' ? `fader-${n}` : `${k}${n}-on`)).toBe(true)
  })

  it('front to back along y (from the rear edge): encoder < PGM 1 / 2 < PGM 3 / PHONE < fader < PREVIEW < ON < OFF', () => {
    const y = (id: string): number => byId.get(id)!.yMm
    expect(y('ch1-encoder')).toBeLessThan(y('ch1-pgm1'))
    expect(y('ch1-pgm1')).toBeLessThan(y('ch1-pgm3'))
    expect(y('ch1-pgm3')).toBeLessThan(y('fader-1') - 100)
    expect(y('fader-1')).toBeLessThan(y('ch1-cue'))
    expect(y('ch1-cue')).toBeLessThan(y('ch1-on'))
    expect(y('ch1-on')).toBeLessThan(y('ch1-off'))
    near(y('ch1-encoder'), 72, 2) // the knob at the bridge foot, about 72 mm from the rear edge
    near(y('ch1-on'), 330.5, 2)
    near(y('ch1-off'), 355.1, 2)
  })

  it('the faders start at the infinity mark (the front end, y 250) and travel 100 mm toward the rear (reverse), inside the printed slot', () => {
    for (let n = 1; n <= 8; n++) {
      const f = byId.get(`fader-${n}`)!
      expect(f.axis).toBe('y')
      expect(f.reverse).toBe(true)
      near(f.yMm, 250, 1)
      expect(f.yMm - (f.travelMm ?? 0)).toBeGreaterThan(133) // the rear screw of the slot at about 133 mm
      expect(f.yMm).toBeLessThan(265) // the front screw at about 265 mm
    }
  })

  it('channel 1 is the strip at the high-x end (the photo is turned 180 degrees: the operator\'s left is +x) and the pitch is about 42.5 mm', () => {
    near(byId.get('fader-1')!.xMm, 450.8, 1)
    near(byId.get('fader-8')!.xMm, 153.3, 1)
    for (let n = 1; n < 8; n++) near(byId.get(`fader-${n}`)!.xMm - byId.get(`fader-${n + 1}`)!.xMm, 42.5, 0.5)
    // each key row keeps its own pitch (the picture is a little keystoned: 43.5 mm at the ON / OFF row, 41.6 mm at the PGM row)
    near(byId.get('ch1-on')!.xMm - byId.get('ch2-on')!.xMm, 43.5, 0.5)
    near(byId.get('ch1-pgm1')!.xMm - byId.get('ch2-pgm1')!.xMm, 41.6, 0.5)
  })

  it('the monitor section is at the low-x end of the picture: knobs at x 64 to 107 mm, the headphones knob near the front (y about 342)', () => {
    near(byId.get('headphones-level')!.xMm, 64, 2)
    near(byId.get('headphones-level')!.yMm, 342, 3)
    near(byId.get('monitor-level')!.xMm, 107, 2)
    near(byId.get('studio-level')!.yMm, 160, 3)
    expect(byId.get('monitor-mute')!.yMm).toBeLessThan(120)
  })

  it('the meters stay on the bridge at the rear (y < 45 mm, where the profile is 111.2 mm high)', () => {
    for (const id of ['pgm1-meter-l', 'pgm1-meter-r']) expect(byId.get(id)!.yMm).toBeLessThan(45)
  })
})
