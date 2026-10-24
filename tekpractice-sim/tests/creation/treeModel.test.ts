import { describe, expect, it } from 'vitest'
import { buildTree, flattenVisible, hideKeyOf, treeKey, type TreeNode } from '../../src/creation/shell/treeModel'
import type { DesignState } from '../../src/trials/trial'

const design: DesignState = {
  roomId: 'room:concert-hall-medium',
  rig: {
    instances: [
      { instanceId: 'ql1', deviceId: 'yamaha-ql1' },
      { instanceId: 'k12-g', deviceId: 'qsc-k12-2' },
    ],
    connections: [{ a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } }],
    controls: {},
  },
  placements: [],
}
const labels: Record<string, string> = { 'yamaha-ql1': 'Yamaha QL1', 'qsc-k12-2': 'QSC K12.2' }
const tree = (portLabel?: (deviceId: string, portId: string) => string | undefined): TreeNode[] =>
  buildTree({
    placeLabel: 'Salle de concert',
    zones: [
      { id: 'scene', kind: 'stage' },
      { id: 'fosse', kind: 'audience' },
    ],
    design,
    deviceLabel: (id) => labels[id] ?? id,
    points: [],
    portLabel,
  })

describe('project tree model (Task 9)', () => {
  it('roots are Lieu → Zones → Matériel → Câbles → Points d’écoute', () => {
    expect(tree().map((n) => n.kind)).toEqual(['lieu', 'zones', 'materiel', 'cables', 'ecoute'])
    expect(tree()[0].label).toContain('Salle de concert')
  })
  it('a device node is « Yamaha QL1 (ql1) », hideable, targeting its instance', () => {
    const ql1 = tree()[2].children![0]
    expect(ql1).toMatchObject({ kind: 'device', label: 'Yamaha QL1 (ql1)', hideable: true, target: { instanceId: 'ql1' } })
  })
  it('a cable node is « ql1 out-main-l → k12-g in-line-a », French port names when the catalog has them', () => {
    const cable = tree()[3].children![0]
    expect(cable).toMatchObject({ kind: 'cable', label: 'ql1 out-main-l → k12-g in-line-a', hideable: true })
    expect(cable.target!.cableKey).toBe('k12-g in-line-a|ql1 out-main-l')
    const fr = tree((d, p) => (d === 'qsc-k12-2' && p === 'in-line-a' ? 'entrée ligne A' : undefined))[3].children![0]
    expect(fr.label).toBe('ql1 out-main-l → k12-g entrée ligne A')
  })
  it('zones are hideable children of Zones; empty groups have no children', () => {
    const zones = tree()[1]
    expect(zones.children!.map((z) => [z.kind, z.target!.zoneId, z.hideable])).toEqual([
      ['zone', 'scene', true],
      ['zone', 'fosse', true],
    ])
    expect(tree()[4].children ?? []).toEqual([])
    expect(tree()[0].hideable).toBe(false)
  })
  it('hide keys: a device by its instance id, a cable or zone by its node id', () => {
    const t = tree()
    expect(hideKeyOf(t[2].children![0])).toBe('ql1')
    expect(hideKeyOf(t[1].children![0])).toBe('zone:scene')
    expect(hideKeyOf(t[3].children![0])).toBe('cable:k12-g in-line-a|ql1 out-main-l')
    expect(hideKeyOf(t[0])).toBeNull()
  })
  it('flattenVisible lists roots, and children of expanded nodes only', () => {
    const t = tree()
    expect(flattenVisible(t, new Set()).map((n) => n.id)).toEqual(['lieu', 'zones', 'materiel', 'cables', 'ecoute'])
    expect(flattenVisible(t, new Set(['materiel'])).map((n) => n.id)).toEqual(['lieu', 'zones', 'materiel', 'device:ql1', 'device:k12-g', 'cables', 'ecoute'])
  })
})

describe('treeKey: WAI-ARIA tree keys', () => {
  const t = tree()
  const at = (focused: string, expanded: string[] = []) => ({ focused, expanded: new Set(expanded) })
  it('Down / Up move through visible rows and stop at the ends', () => {
    expect(treeKey(at('lieu'), 'ArrowDown', t).focused).toBe('zones')
    expect(treeKey(at('materiel', ['materiel']), 'ArrowDown', t).focused).toBe('device:ql1')
    expect(treeKey(at('ecoute'), 'ArrowDown', t).focused).toBe('ecoute')
    expect(treeKey(at('cables', ['materiel']), 'ArrowUp', t).focused).toBe('device:k12-g')
    expect(treeKey(at('lieu'), 'ArrowUp', t).focused).toBe('lieu')
  })
  it('Right expands a closed group (focus stays), then enters its first child; nothing on a leaf', () => {
    const s1 = treeKey(at('materiel'), 'ArrowRight', t)
    expect(s1.focused).toBe('materiel')
    expect([...s1.expanded]).toEqual(['materiel'])
    expect(treeKey(s1, 'ArrowRight', t).focused).toBe('device:ql1')
    expect(treeKey(at('device:ql1', ['materiel']), 'ArrowRight', t)).toEqual(at('device:ql1', ['materiel']))
    // an empty group is a leaf: it never expands
    expect([...treeKey(at('ecoute'), 'ArrowRight', t).expanded]).toEqual([])
  })
  it('Left collapses an open group, else goes to the parent', () => {
    const s = treeKey(at('materiel', ['materiel']), 'ArrowLeft', t)
    expect(s.focused).toBe('materiel')
    expect(s.expanded.has('materiel')).toBe(false)
    expect(treeKey(at('device:k12-g', ['materiel']), 'ArrowLeft', t).focused).toBe('materiel')
    expect(treeKey(at('lieu'), 'ArrowLeft', t).focused).toBe('lieu')
  })
  it('Home / End go to the first / last visible row', () => {
    expect(treeKey(at('device:ql1', ['materiel']), 'Home', t).focused).toBe('lieu')
    expect(treeKey(at('lieu', ['cables']), 'End', t).focused).toBe('ecoute')
    expect(treeKey(at('lieu', ['zones']), 'End', tree().slice(0, 2)).focused).toBe('zone:fosse')
  })
  it('a focus that left the tree (device removed) falls back to the first row; the input set is never mutated', () => {
    const exp = new Set(['materiel'])
    const s = treeKey({ focused: 'device:gone', expanded: exp }, 'ArrowDown', t)
    expect(s.focused).toBe('lieu')
    treeKey({ focused: 'materiel', expanded: exp }, 'ArrowLeft', t)
    expect(exp.has('materiel')).toBe(true)
  })
})
