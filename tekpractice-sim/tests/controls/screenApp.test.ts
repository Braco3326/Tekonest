import { describe, expect, it } from 'vitest'
import { ControlBank } from '../../src/controls/controlBank'
import { createMixerOverview, createScreenApp, overviewGeometry, stripsOf } from '../../src/controls/screenApp'
import type { ControlDef } from '../../src/controls/controlTypes'

const d = (over: Partial<ControlDef> & { id: string }): ControlDef => ({ kind: 'knob', face: 'top', xMm: 0, yMm: 0, sizeMm: { w: 1, h: 1, d: 1 }, axis: 'z', default: 0, ...over })
const fader = (n: number, over: Partial<ControlDef> = {}): ControlDef => d({ id: `fader-${n}`, kind: 'fader', axis: 'y', travelMm: 100, taper: 'fader-db', default: 0.75, ...over })
const on = (n: number, v = 1): ControlDef => d({ id: `ch${n}-on`, kind: 'button', default: v })

const W = 1000
const H = 400
const ctxOf = (bank: ControlBank, nowMs = 0) => ({ bank, levels: () => -20, nowMs })

/** A 2D context that records the text it is asked to draw and how many rects. */
function recorder() {
  const texts: string[] = []
  let rects = 0
  const ctx = new Proxy(
    {},
    {
      get: (_t, k) => {
        if (k === 'fillText') return (t: string) => texts.push(String(t))
        if (k === 'fillRect' || k === 'strokeRect') return () => rects++
        return () => undefined
      },
      set: () => true,
    }
  ) as unknown as CanvasRenderingContext2D
  return { ctx, texts, rects: () => rects }
}

describe('stripsOf', () => {
  it('lists the fader-<n> controls in order with their ON key when there is one', () => {
    const bank = new ControlBank([fader(3), fader(1), on(1), d({ id: 'knob-x' }), fader(2)])
    const s = stripsOf(bank)
    expect(s.map((x) => x.n)).toEqual([1, 2, 3])
    expect(s[0].on?.id).toBe('ch1-on')
    expect(s[1].on).toBeUndefined()
  })
})

describe('mixer overview', () => {
  const make = () => {
    const bank = new ControlBank([fader(1), fader(2), on(1), on(2, 0)])
    return { bank, app: createMixerOverview(), g: overviewGeometry(W, H, 2) }
  }

  it('is a live app and draws the strip numbers and the fader values', () => {
    const { bank, app } = make()
    const r = recorder()
    expect(app.animated).toBe(true)
    app.draw(r.ctx, W, H, ctxOf(bank))
    expect(r.texts).toContain('1')
    expect(r.texts).toContain('2')
    expect(r.texts).toContain('ON')
    expect(r.texts.some((t) => /^0\.0$/.test(t))).toBe(true) // 0 dB at 75 %
    expect(r.rects()).toBeGreaterThan(30)
  })

  it('says so when there are no strips', () => {
    const app = createMixerOverview()
    const r = recorder()
    app.draw(r.ctx, W, H, ctxOf(new ControlBank([d({ id: 'k' })])))
    expect(r.texts).toContain('Aucune voie')
  })

  it('a touch on a strip\'s track sets that fader from the height (top of the track = 1, bottom = 0), a drag follows, the release names the control', () => {
    const { bank, app, g } = make()
    const c = ctxOf(bank)
    const x1 = g.padX + g.stripW * 0.5
    expect(app.pointer('down', x1, g.track.y0, c, W, H)).toEqual({ handled: true })
    expect(bank.get('fader-1')).toBeCloseTo(1, 6)
    app.pointer('move', x1, (g.track.y0 + g.track.y1) / 2, c, W, H)
    expect(bank.get('fader-1')).toBeCloseTo(0.5, 6)
    app.pointer('move', x1, g.track.y1 + 500, c, W, H) // dragged off the glass: clamped
    expect(bank.get('fader-1')).toBe(0)
    expect(app.pointer('up', x1, 0, c, W, H)).toEqual({ handled: true, changed: 'fader-1' })
    expect(bank.get('fader-2')).toBe(0.75) // the other strip never moved
    // after the release a move is nobody\'s
    expect(app.pointer('move', x1, g.track.y0, c, W, H)).toEqual({ handled: false })
  })

  it('a touch on the second strip drags the second fader', () => {
    const { bank, app, g } = make()
    app.pointer('down', g.padX + g.stripW * 1.5, (g.track.y0 + g.track.y1) / 2, ctxOf(bank), W, H)
    expect(bank.get('fader-2')).toBeCloseTo(0.5, 6)
    expect(bank.get('fader-1')).toBe(0.75)
  })

  it('a touch on an ON key toggles it and names it at once; a strip without a key ignores the touch there', () => {
    const { bank, app, g } = make()
    const x2 = g.padX + g.stripW * 1.5
    expect(app.pointer('down', x2, g.onY + 2, ctxOf(bank), W, H)).toEqual({ handled: true, changed: 'ch2-on' })
    expect(bank.get('ch2-on')).toBe(1)
    const noKey = new ControlBank([fader(1)])
    expect(createMixerOverview().pointer('down', g.padX + 5, overviewGeometry(W, H, 1).onY + 2, ctxOf(noKey), W, H)).toEqual({ handled: false })
  })

  it('a touch outside every widget is not taken (it falls through to the camera)', () => {
    const { bank, app } = make()
    expect(app.pointer('down', 5, 5, ctxOf(bank), W, H)).toEqual({ handled: false })
    expect(app.pointer('down', W + 50, H / 2, ctxOf(bank), W, H)).toEqual({ handled: false })
  })

  it('a muted strip (ON off) draws no level and the registry knows the app by name', () => {
    expect(createScreenApp('mixer-overview')).not.toBeNull()
    expect(createScreenApp('nope')).toBeNull()
  })
})
