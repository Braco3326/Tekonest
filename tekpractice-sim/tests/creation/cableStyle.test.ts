/** Task 27 (C18): cables coloured by signal type. The catalog's signal ids rule; colour is never the only cue. */
import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { COPY } from '../../src/creation/copy'
import { CREATION_TOKENS, contrastRatio } from '../../src/design/creationTokens'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { SIGNAL_STYLE, cableColor, cableDash, cableText, connectionSignal, legendEntries, portInfoOf, presentSignals } from '../../src/creation/cableStyle'

const catalogSignals: string[] = (catalogJson as { signalTypes: { id: string }[] }).signalTypes.map((s) => s.id)
const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}
const distance = (a: string, b: string): number => {
  const [x, y] = [rgb(a), rgb(b)]
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

/** Machado, Oliveira, Fernandes (2009), severity 1.0, applied to linear RGB. */
const MACHADO: Record<string, number[][]> = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
}
const toLinear = (c: number): number => ((c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const toSrgb = (v: number): string => {
  const x = Math.min(1, Math.max(0, v))
  const c = 255 * (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)
  return Math.round(c).toString(16).padStart(2, '0')
}
/** The colour as a colour-blind eye sees it, as '#rrggbb'. */
const simulate = (m: number[][], hex: string): string => {
  const l = rgb(hex).map(toLinear)
  return '#' + m.map((row) => toSrgb(row[0]! * l[0]! + row[1]! * l[1]! + row[2]! * l[2]!)).join('')
}

describe('SIGNAL_STYLE', () => {
  it('has a style for every signal id of the catalog, and no other (the catalog is the source of truth)', () => {
    expect(catalogSignals.length).toBeGreaterThanOrEqual(16)
    expect(Object.keys(SIGNAL_STYLE).sort()).toEqual([...catalogSignals].sort())
  })
  it('lists the ids in the catalog order (the legend reads in that order)', () => {
    expect(Object.keys(SIGNAL_STYLE)).toEqual(catalogSignals)
  })
  it('every colour is a #RRGGBB', () => {
    for (const id of catalogSignals) expect(SIGNAL_STYLE[id]!.color, id).toMatch(/^#[0-9A-F]{6}$/)
  })
  it('colours are distinct pairwise (simple RGB distance >= 60)', () => {
    for (let i = 0; i < catalogSignals.length; i++)
      for (let j = i + 1; j < catalogSignals.length; j++) {
        const [a, b] = [catalogSignals[i]!, catalogSignals[j]!]
        expect(distance(SIGNAL_STYLE[a]!.color, SIGNAL_STYLE[b]!.color), `${a} / ${b}`).toBeGreaterThanOrEqual(60)
      }
  })
  it('each colour reads on the Nuit background (>= 3:1, WCAG 1.4.11)', () => {
    for (const id of catalogSignals) expect(contrastRatio(SIGNAL_STYLE[id]!.color, CREATION_TOKENS.color.nuit), id).toBeGreaterThanOrEqual(3)
  })
  it('each colour also reads on the panel colour (>= 3:1, the legend swatches sit on it)', () => {
    for (const id of catalogSignals) expect(contrastRatio(SIGNAL_STYLE[id]!.color, CREATION_TOKENS.color.panel), id).toBeGreaterThanOrEqual(3)
  })
  it('colours stay apart for colour-blind users: every pair is >= 30 apart (simple RGB distance) under simulated protanopia, deuteranopia and tritanopia', () => {
    for (const [name, m] of Object.entries(MACHADO)) {
      for (let i = 0; i < catalogSignals.length; i++)
        for (let j = i + 1; j < catalogSignals.length; j++) {
          const [a, b] = [catalogSignals[i]!, catalogSignals[j]!]
          expect(distance(simulate(m, SIGNAL_STYLE[a]!.color), simulate(m, SIGNAL_STYLE[b]!.color)), `${name}: ${a} / ${b}`).toBeGreaterThanOrEqual(30)
        }
    }
  })
  it('no signal colour is the selection Ambre or the hover Papier (a cable never reads as a selected device)', () => {
    for (const id of catalogSignals) {
      expect(distance(SIGNAL_STYLE[id]!.color, CREATION_TOKENS.color.ambre), id).toBeGreaterThanOrEqual(60)
      expect(distance(SIGNAL_STYLE[id]!.color, CREATION_TOKENS.color.papier), id).toBeGreaterThanOrEqual(60)
    }
  })
  it('mains-power is dashed, so the colour is never the only cue; no other signal is', () => {
    expect(SIGNAL_STYLE['mains-power']!.dash).toBe(true)
    expect(cableDash('mains-power')).toBe(true)
    for (const id of catalogSignals.filter((s) => s !== 'mains-power')) expect(cableDash(id), id).toBe(false)
  })
  it('labels are the French names of COPY.signal (strings live in copy.ts only)', () => {
    for (const id of catalogSignals) {
      expect(COPY.signal![id], id).toBeTruthy()
      expect(SIGNAL_STYLE[id]!.label, id).toBe(COPY.signal![id])
    }
  })
})

describe('cableColor', () => {
  it('is the style colour of the signal', () => {
    for (const id of catalogSignals) expect(cableColor(id)).toBe(SIGNAL_STYLE[id]!.color)
  })
  it('a signal the palette does not know falls back to a neutral colour that is not any signal colour (never throws)', () => {
    const c = cableColor('not-in-the-catalog')
    expect(c).toMatch(/^#[0-9A-F]{6}$/)
    for (const id of catalogSignals) expect(c).not.toBe(SIGNAL_STYLE[id]!.color)
    expect(cableDash('not-in-the-catalog')).toBe(false)
  })
})

describe('connectionSignal', () => {
  const ports: Record<string, { dir: 'in' | 'out' | 'bidir'; signal: string }> = {
    'mic:out': { dir: 'out', signal: 'mic-level' },
    'desk:in': { dir: 'in', signal: 'mic-level' },
    'amp:in': { dir: 'in', signal: 'line-level-pro' },
    'desk:out': { dir: 'out', signal: 'line-level-pro' },
    'x:bi': { dir: 'bidir', signal: 'aoip' },
    'y:bi': { dir: 'bidir', signal: 'aoip' },
  }
  const portOf = (r: { instance: string; port: string }) => ports[`${r.instance}:${r.port}`]
  it('is the signal leaving the output port, whichever end is a', () => {
    expect(connectionSignal(portOf, { instance: 'mic', port: 'out' }, { instance: 'desk', port: 'in' })).toBe('mic-level')
    expect(connectionSignal(portOf, { instance: 'desk', port: 'in' }, { instance: 'mic', port: 'out' })).toBe('mic-level')
    // a mismatched pair (in mic-level, out line): the output side still decides
    expect(connectionSignal(portOf, { instance: 'amp', port: 'in' }, { instance: 'desk', port: 'out' })).toBe('line-level-pro')
  })
  it('two bidirectional ports: the first end', () => {
    expect(connectionSignal(portOf, { instance: 'x', port: 'bi' }, { instance: 'y', port: 'bi' })).toBe('aoip')
  })
  it('null when neither port is known', () => {
    expect(connectionSignal(portOf, { instance: 'ghost', port: 'a' }, { instance: 'ghost', port: 'b' })).toBeNull()
  })
  it('a known end carries it when the other is unknown', () => {
    expect(connectionSignal(portOf, { instance: 'ghost', port: 'a' }, { instance: 'desk', port: 'in' })).toBe('mic-level')
  })
})

describe('legend', () => {
  it('presentSignals: only the signals present, once each, in catalog order, nulls ignored', () => {
    expect(presentSignals(['aes3', null, 'mic-level', 'aes3', 'mains-power'])).toEqual(['mic-level', 'aes3', 'mains-power'])
    expect(presentSignals([])).toEqual([])
  })
  it('presentSignals keeps a signal the palette does not know (it is on the scene, so it is in the legend) after the known ones', () => {
    expect(presentSignals(['zzz', 'mic-level'])).toEqual(['mic-level', 'zzz'])
  })
  it('legendEntries: id, French label, colour and dash flag', () => {
    expect(legendEntries(['mic-level', 'mains-power'])).toEqual([
      { id: 'mic-level', label: 'Niveau micro', color: SIGNAL_STYLE['mic-level']!.color, dash: false },
      { id: 'mains-power', label: 'Secteur 230 V', color: SIGNAL_STYLE['mains-power']!.color, dash: true },
    ])
  })
})

describe('portInfoOf and cableText (the hover text)', () => {
  const registry = loadCatalog(catalogJson)
  const instances = [
    { instanceId: 'ql1', deviceId: 'yamaha-ql1' },
    { instanceId: 'k12-g', deviceId: 'qsc-k12-2' },
  ]
  const portOf = portInfoOf(registry, instances)
  const OUT = { instance: 'ql1', port: 'out-main-l' }
  const IN = { instance: 'k12-g', port: 'in-line-a' }
  it('reads the direction and the signal from the catalog', () => {
    expect(portOf(OUT)).toEqual({ dir: 'out', signal: 'line-level-pro' })
    expect(portOf(IN)).toEqual({ dir: 'in', signal: 'line-level-pro' })
    expect(portOf({ instance: 'ql1', port: 'nope' })).toBeUndefined()
    expect(portOf({ instance: 'ghost', port: 'out-main-l' })).toBeUndefined()
  })
  it('« ql1 out-main-l → k12-g in-line-a · signal », the output first whichever way it is stored', () => {
    const want = 'ql1 out-main-l → k12-g in-line-a · Niveau ligne pro (+4 dBu)'
    expect(cableText(portOf, OUT, IN)).toBe(want)
    expect(cableText(portOf, IN, OUT)).toBe(want)
  })
  it('null for a connection whose ports are not in the design', () => {
    expect(cableText(portOf, { instance: 'x', port: 'a' }, { instance: 'y', port: 'b' })).toBeNull()
  })
})
