/**
 * Wave 1b finding 11: a spec's DECLARED port facts must agree with the device that stands for it (the catalogue entry of a promoted device, the Bêta
 * proposal of a beta-modelled one): connector, signal, direction AND flags. The id-only parity of `checkSpecParity` let the Royer R-121 proposal lose the
 * `isRibbon` flag its spec has (R4 reads the proposal's flags).
 *
 * Compared: every flag the spec lists must be on the device port (a catalogue device may carry MORE flags than the spec lists: the template adds
 * requiresPhantom, isMicInput, providesPhantom and isMainsSource from traits; a proposal never carries isMainsSource, so that one is not compared there).
 */
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadPlan } from '../../tools/equipmentPlan'

interface SpecPort { portId: string; connector?: string; signal?: string; dir?: string; flags?: string[] }
interface DevPort { portId: string; connector: string; signal: string; dir: string; flags?: string[] }
const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T
const catalog = readJson<{ devices: { id: string; ports: DevPort[] }[] }>('content/catalog.json').devices
const proposals = readJson<{ devices: { id: string; ports: DevPort[] }[] }>('content/proposals/catalog-proposals.json').devices

/** Disagreements of one spec with the device ports (an empty list = they agree). */
export function portDisagreements(specPorts: readonly SpecPort[], devPorts: readonly DevPort[], isProposal: boolean): string[] {
  const out: string[] = []
  for (const sp of specPorts) {
    const dp = devPorts.find((p) => p.portId === sp.portId)
    if (!dp) continue // id parity is checkSpecParity's job
    for (const k of ['connector', 'signal', 'dir'] as const) if (sp[k] !== undefined && sp[k] !== dp[k]) out.push(`${sp.portId}: ${k} is ${sp[k]} in the spec, ${dp[k]} on the device`)
    for (const f of sp.flags ?? []) {
      if (isProposal && f === 'isMainsSource') continue
      if (!(dp.flags ?? []).includes(f)) out.push(`${sp.portId}: the spec flags ${f}, the device port does not`)
    }
  }
  return out
}

describe('portDisagreements (synthetic)', () => {
  const dev: DevPort[] = [{ portId: 'out', dir: 'out', connector: 'xlr3-m', signal: 'mic-level' }]
  it('a flag the spec has and the device port lacks is reported (the royer-r-121 case)', () => {
    expect(portDisagreements([{ portId: 'out', flags: ['isRibbon'] }], dev, true)).toEqual(['out: the spec flags isRibbon, the device port does not'])
  })
  it('connector, signal and direction are compared when the spec declares them, a device may have more flags', () => {
    expect(portDisagreements([{ portId: 'out', connector: 'trs-quarter', signal: 'aoip', dir: 'in' }], dev, false)).toHaveLength(3)
    expect(portDisagreements([{ portId: 'out', connector: 'xlr3-m', signal: 'mic-level', dir: 'out' }], [{ ...dev[0]!, flags: ['requiresPhantom'] }], false)).toEqual([])
  })
})

describe('on the real Wave 1 rows (promoted: the catalogue entry; beta-modelled: the proposal)', () => {
  const rows = loadPlan().filter((r) => r.promoted === true || r.betaModelled === true)
  it('there are rows to check', () => expect(rows.length).toBeGreaterThanOrEqual(42))
  for (const r of rows) {
    const specPath = `content/asset-specs/${r.id}.json`
    if (!existsSync(specPath)) continue
    it(`${r.id}: spec ports agree with the ${r.promoted ? 'catalogue entry' : 'proposal'} on connector, signal, direction and flags`, () => {
      const spec = readJson<{ ports: SpecPort[] }>(specPath)
      const dev = (r.promoted ? catalog : proposals).find((d) => d.id === r.id)
      expect(dev, `${r.id} is in ${r.promoted ? 'the catalogue' : 'the proposals'}`).toBeTruthy()
      expect(portDisagreements(spec.ports, dev!.ports, r.promoted !== true)).toEqual([])
    })
  }
});
