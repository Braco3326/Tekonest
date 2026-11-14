/**
 * Review fix 18: a saved project that names a Bêta port id that no longer exists after the device was promoted. The cable follows a `portAliases` entry when an old id
 * has a new equivalent; a cable whose port is gone is dropped AND listed in a visible non-blocking note (French, status « à valider »), never only a console.warn.
 */
import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { droppedCableItems } from '../../src/creation/droppedCables'
import { COPY } from '../../src/creation/copy'
import type { DesignState } from '../../src/trials/trial'

const registry = makeRegistry()
const design = (): DesignState =>
  ({
    roomId: 'concert-hall-medium',
    rig: {
      instances: [
        { instanceId: 'rx', deviceId: 'shure-axient-digital-ad4d' },
        { instanceId: 'clk', deviceId: 'mutec-mc-3-plus' },
        { instanceId: 'em', deviceId: 'sennheiser-em-6000' },
      ],
      connections: [
        // the AD4D word clock was a bidir Bêta port: it is now in-wclk (alias), fed by a MUTEC clock output
        { a: { instance: 'rx', port: 'bidir-word-clock-input-and-thru-1' }, b: { instance: 'clk', port: 'out-wclk-1' } },
        // the EM 6000 network port does not exist on the promoted model: dropped
        { a: { instance: 'em', port: 'bidir-network-control' }, b: { instance: 'rx', port: 'net-dante-1' } },
      ],
      controls: {},
    },
    placements: [],
  }) as unknown as DesignState

describe('a saved project with old Bêta port ids', () => {
  const s = new CreationStore(registry, creationEvaluator(registry))
  const r = s.dispatch({ type: 'APPLY_DESIGN', design: design() })
  it('loads; the cable on an aliased id follows it, the cable on a removed port is reported', () => {
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(s.design().rig.connections).toHaveLength(1)
    expect(s.design().rig.connections[0]!.a.port).toBe('in-wclk')
    expect(r.dropped?.cables).toHaveLength(1)
  })
  it('the dropped cable is listed by name for the visible note', () => {
    if (!r.ok) throw new Error('not loaded')
    expect(droppedCableItems(r.dropped?.cables ?? [])).toEqual(['em bidir-network-control ↔ rx net-dante-1'])
  })
  it('the note copy is French and says à valider', () => {
    const I = COPY.inventory!
    expect(I.droppedCablesTitle).toMatch(/Câbles/)
    expect(I.droppedCablesBody).toMatch(/à valider/)
  })
})
