import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseControlLayout } from '../../src/controls/controlTypes'

const ctl = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'k1',
  kind: 'knob',
  face: 'top',
  xMm: 10,
  yMm: 20,
  sizeMm: { w: 20, h: 20, d: 12 },
  ...over,
})
const layout = (controls: unknown[], extra: Record<string, unknown> = {}): unknown => ({ schema: 1, deviceId: 'dev', controls, ...extra })

describe('parseControlLayout', () => {
  it('reads a knob with its defaults (axis z, default 0)', () => {
    const { layout: l, errors } = parseControlLayout(layout([ctl()]))
    expect(errors).toEqual([])
    expect(l!.controls[0]).toMatchObject({ id: 'k1', kind: 'knob', axis: 'z', default: 0, xMm: 10, yMm: 20 })
  })

  it('expands repeat: ids from the format, positions stepped, {n} in a group or a legend replaced', () => {
    const { layout: l } = parseControlLayout(
      layout([{ ...ctl({ id: undefined, kind: 'button', group: 'ch{n}', label: 'K{n}' }), repeat: { count: 3, dxMm: 40, dyMm: 5, idFormat: 'key-{n}' } }])
    )
    expect(l!.controls.map((c) => [c.id, c.xMm, c.yMm, c.group, c.label])).toEqual([
      ['key-1', 10, 20, 'ch1', 'K1'],
      ['key-2', 50, 25, 'ch2', 'K2'],
      ['key-3', 90, 30, 'ch3', 'K3'],
    ])
  })

  it('refuses, listing every problem, and never returns a half-built layout', () => {
    const r = parseControlLayout(
      layout([ctl({ kind: 'dial' }), ctl({ id: 'f', kind: 'fader', axis: 'z', travelMm: 50 }), ctl({ id: 'g', kind: 'fader' }), ctl({ id: 'k1' }), ctl({ id: 'm', kind: 'meter' }), { kind: 'knob' }])
    )
    expect(r.layout).toBeNull()
    const all = r.errors.join('\n')
    expect(all).toMatch(/unknown kind/)
    expect(all).toMatch(/travels along x or y/)
    expect(all).toMatch(/needs travelMm/)
    expect(all).toMatch(/needs meter\.style/)
    expect(all).toMatch(/no id/)
  })

  it('refuses a duplicated id, a bad repeat and a bad topProfile', () => {
    expect(parseControlLayout(layout([ctl(), ctl()])).errors.join()).toMatch(/defined twice/)
    expect(parseControlLayout(layout([{ ...ctl(), repeat: { count: 2, dxMm: 1, dyMm: 0, idFormat: 'no-placeholder' } }])).errors.join()).toMatch(/repeat needs/)
    expect(parseControlLayout(layout([ctl()], { topProfile: [[0, 100], [0, 90]] })).errors.join()).toMatch(/topProfile/)
    expect(parseControlLayout({ schema: 2 }).layout).toBeNull()
  })

  it('every shipped layout (content/control-layouts) is valid, matches its file name and has controls', () => {
    const dir = join(__dirname, '../../content/control-layouts')
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      const { layout: l, errors } = parseControlLayout(JSON.parse(readFileSync(join(dir, f), 'utf8')))
      expect(errors, f).toEqual([])
      expect(l!.deviceId, f).toBe(f.replace(/\.json$/, ''))
      expect(l!.controls.length, f).toBeGreaterThan(0)
    }
  })
})
