/**
 * Wave 0b finding 5 (second half): the `kind` of a spec source says what the page is. The first promotion tool stamped every plan URL
 * `datasheet`, so a retailer page or a manual hosted by a third party read as a manufacturer datasheet in the spec and in the register.
 */
import { describe, expect, it } from 'vitest'
import { loadPlan } from '../../tools/equipmentPlan'
import { sourceKind } from '../../tools/sourceKind'

describe('sourceKind', () => {
  it('a manufacturer page is a datasheet, a retailer a dealer, a third-party manual host a manual, anything else a reference', () => {
    expect(sourceKind('Neumann', 'https://www.neumann.com/en-en/products/microphones/tlm-103/')).toBe('datasheet')
    expect(sourceKind('Shure', 'https://content-files.shure.com/publications/specSheet/en/slx-d-spec-sheet.pdf')).toBe('datasheet')
    expect(sourceKind('Allen & Heath', 'https://www.allen-heath.com/content/uploads/2023/06/Weights-and-Measures-SQ-6.pdf')).toBe('datasheet')
    expect(sourceKind('K&M', 'https://www.k-m.de/en/kmPdf/datasheet/ordernumber/23200-300-55')).toBe('datasheet')
    expect(sourceKind('Radial Engineering', 'https://www.radialeng.com/product/jdi/specifications/')).toBe('datasheet')
    expect(sourceKind('Neumann', 'https://www.zzounds.com/item--NEUTLM103')).toBe('dealer')
    expect(sourceKind('Yamaha', 'https://www.thomann.de/yamaha_tf5.htm')).toBe('dealer')
    expect(sourceKind('Yamaha', 'https://www.manualslib.com/manual/1071068/Yamaha-Tf5.html')).toBe('manual')
    expect(sourceKind('Behringer', 'https://global.channelonline.com/acme/ccs/Products/overview/M025221227')).toBe('reference')
    expect(sourceKind('Shure', 'not a url')).toBe('reference')
  })
  it('a page of another manufacturer is never a datasheet (a Midas sheet under a Behringer row, a Shure page under a Cisco row)', () => {
    expect(sourceKind('Behringer', 'https://www.midasconsoles.com/m32')).toBe('reference')
    expect(sourceKind('Cisco', 'https://service.shure.com/x')).toBe('reference')
  })
  it('on the real plan no retailer, no manual host and no foreign page is typed datasheet, and the first source of a datasheet row of a known maker is', () => {
    const dealer = /(zzounds|thomann|adorama|bhphotovideo|markertek|fullcompass|crutchfield|canford|sonovente|americanmusical|goknight|soundpro|andertons)/
    const manual = /(manualslib|manualshive|manuals\.plus|manualowl|manualmachine|manualsdir)/
    let datasheets = 0
    for (const r of loadPlan()) {
      for (const u of r.sources) {
        const host = new URL(u).hostname
        const k = sourceKind(r.manufacturer, u)
        if (dealer.test(host)) expect(k, `${r.id} ${u}`).toBe('dealer')
        if (manual.test(host)) expect(k, `${r.id} ${u}`).toBe('manual')
        if (k === 'datasheet') {
          datasheets++
          expect(dealer.test(host) || manual.test(host), `${r.id} ${u}`).toBe(false)
        }
      }
    }
    expect(datasheets).toBeGreaterThan(80)
    expect(sourceKind('Neumann', loadPlan().find((r) => r.id === 'neumann-tlm-103')!.sources[0]!)).toBe('datasheet')
  })
})
