/**
 * Wave 1b finding 3: the badge of a beta-modelled proposal follows the PLAN's size confidence. Datasheet / dealer size on three axes with sizeConfidence ok:
 * « connecteurs non vérifiés » (only the ports are undocumented); an estimate, a partial size, an assumed axis order or a conflict: « dimensions estimées ».
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { betaSizeVerifiedIds, renderBetaBadges } from '../../tools/betaBadges'
import { loadPlan, type PlanRow } from '../../tools/equipmentPlan'
import { codePointCompare } from '../../tools/brandsRegister'

const plan = loadPlan()
const generated = JSON.parse(readFileSync('src/creation/betaBadges.json', 'utf8')) as { sizeVerified: string[] }
const row = (over: Partial<PlanRow>): PlanRow => ({
  id: 'x', status: 'beta', category: 'outboard', manufacturer: 'M', product: 'P', sizeMm: { w: 480, d: 200, h: 44 }, portsSummary: '', family: 'rack-box-v2',
  dataQuality: 'datasheet', tier: 1, wave: 1, sources: ['https://example.com/a'], notes: '', traits: [], sizeConfidence: 'ok', betaModelled: true, ...over,
})

describe('betaSizeVerifiedIds (synthetic rows)', () => {
  it('a datasheet or dealer size with three axes and confidence ok is verified; only beta-modelled rows count', () => {
    expect(betaSizeVerifiedIds([row({ id: 'a' }), row({ id: 'b', dataQuality: 'dealer' }), row({ id: 'c', betaModelled: false })])).toEqual(['a', 'b'])
  })
  it.each(['axis-assumed', 'conflict', 'partial'] as const)('sizeConfidence %s is an estimate: not verified', (sizeConfidence) => {
    expect(betaSizeVerifiedIds([row({ sizeConfidence })])).toEqual([])
  })
  it('a missing axis or an estimate grade is not verified', () => {
    expect(betaSizeVerifiedIds([row({ sizeMm: { w: 25, h: 155 } })])).toEqual([])
    expect(betaSizeVerifiedIds([row({ dataQuality: 'estimate' })])).toEqual([])
  })
})

describe('on the real plan', () => {
  it('12 of the 23 beta-modelled rows have a verified size; they are the ones that say « connecteurs non vérifiés »', () => {
    const modelled = plan.filter((r) => r.betaModelled === true)
    expect(modelled.length).toBeGreaterThanOrEqual(23)
    const ids = betaSizeVerifiedIds(plan)
    for (const id of ['presonus-hp4', 'allen-heath-ar2412', 'soundcraft-ui24r', 'ua-1176ln']) expect(ids, id).toContain(id)
    for (const id of ['yamaha-tf5', 'royer-r-121', 'furman-m-8x2', 'radial-jdi', 'jbl-305p-mkii']) expect(ids, id).not.toContain(id)
    for (const id of ids) {
      const r = plan.find((x) => x.id === id)!
      expect(['datasheet', 'dealer']).toContain(r.dataQuality)
      expect(r.sizeConfidence).toBe('ok')
    }
  })
  it('the generated src/creation/betaBadges.json is what the plan says (run `npm run register` when this fails)', () => {
    expect(readFileSync('src/creation/betaBadges.json', 'utf8')).toBe(renderBetaBadges(plan))
    expect(generated.sizeVerified).toEqual(betaSizeVerifiedIds(plan))
    expect(generated.sizeVerified.length).toBeGreaterThanOrEqual(12)
  })
})

describe('codePointCompare (the register order: RØDE sorted the same on every Node / ICU build, finding 16)', () => {
  it('orders by UTF-16 code unit: Ø comes after every plain letter, whatever the locale', () => {
    expect(['shure', 'røde', 'rode', 'akg'].sort(codePointCompare)).toEqual(['akg', 'rode', 'røde', 'shure'])
    expect(codePointCompare('a', 'a')).toBe(0)
  })
})
