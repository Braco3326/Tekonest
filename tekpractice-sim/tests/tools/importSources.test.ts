/**
 * Wave 0b finding 5: the importer attached the wrong pages as the sources of a size (school inventories, sibling products, accessories, blog posts).
 * Two layers: (1) the matcher on the REAL note lines that went wrong (copied verbatim from the research notes), (2) the committed plan, whose
 * `sources` were regenerated with `--refresh-sources`, checked row by row for the nine named examples and for the classes of wrong link.
 */
import { describe, expect, it } from 'vitest'
import { loadPlan } from '../../tools/equipmentPlan'
import { isNonSource, matchNoteUrls, noteLines, refreshSources, subjectIsProduct, urlsIn } from '../../tools/import-equipment-plan'

const plan = loadPlan()
const rowOf = (id: string) => plan.find((r) => r.id === id)!

/** The lines that produced the wrong sources, verbatim from the research notes (tables and bullets). */
const NOTES = [
  '| Rode PSM1 | Shock mount for end-address mics (Podcaster, Procaster, PSA1, DS1) | 122 x 110 x 155 (retailer) | 390 g | Mounts to 3/8" and 5/8" thread | None | Metal | [zZounds listing](https://www.zzounds.com/item--RODPSM1) |',
  '- McGill library loans SM58/SM57 kits, Radial ProDI passive DIs, and Sennheiser MD421-II — [McGill equipment guide, microphones](https://libraryguides.mcgill.ca/EquipmentGuide/microphones)',
  '- Stanford CCRMA live room uses a Scarlett 18i20 with Allen & Heath SQ; American University audio lab uses Scarlett 2i2 units — [Stanford CCRMA](https://ccrma.stanford.edu/docs/studios/Recording-Studio.html), [American University](https://wwwprod101.american.edu/cas/audio-technology/facilities.cfm)',
  "- Bakersfield College's commercial-music gear list includes API 512c and Neve 1073 preamps; Berklee Studio 2 lists two API 512c — [Bakersfield College](https://www.bakersfieldcollege.edu/academics/pathways/ach/music/commercial-music-gear-list.html), [Berklee Studio 2](https://college.berklee.edu/node/2435451)",
  '| Midas M32 (reference for X32 full-size) | 40-ch digital live console | 891 x 612 x 256 | 25 kg | 32 XLR mic pre | [Midas M32 data sheet](https://global-uploads.webflow.com/5f4013c686a8c427bc62226e/5f4013c686a8c4841f62246e_Midas-M32-Data-Sheet.pdf); [Markertek M32](https://www.markertek.com/product/m32live/midas-m32-live-digital-console-40-input-channels) |',
  '| Behringer X32 (full-size) | 40-ch digital live console | **Conflict:** 900 x 528 x 200 | 20.0 kg | same | [D](https://www.thomann.co.uk/behringer_x_32.htm) |',
  '| Behringer X32 Compact | 40-ch digital live console | 900 x 500 x 200 | 15 kg | same | [Thomann](https://www.thomann.de/ie/behringer_x_32_compact.htm) |',
  '- Whirlwind SP1X3 1x3 mic splitter: retailer lists operating level -0.5 to +4 dB. SPLIT6 is a 1x6 line-level parallel splitter. — [American Musical SP1X3](https://www.americanmusical.com/p/whirlwind-sp1x3-1x3-microphone-splitter), [Adorama SPLIT6](https://www.adorama.com/wwsplit6.html), [Rentex SPLIT6 manual](https://www.rentex.com/wp-content/uploads/2018/08/SPLIT6-Manual.pdf)',
  '| Sennheiser HD 25 | Closed, on-ear | About 140 g without cable | 3.5 mm with screw-on 6.3 mm adapter | 70 ohm | [HD 25 page](https://www.sennheiser.com/en-us/catalog/products/headphones/hd-25/hd-25-506909); [coiled cable](https://www.sennheiser.com/en-us/catalog/products/headphones/headphone-accessories/hd-25-coiled-cable-3m-523877) |',
  '- Middle Atlantic SRK sloped rolling rack: 16 vertical spaces below plus 12 spaces on a 25-degree sloped top; depth 16 in (406 mm). — [ADI listing](https://www.adiglobaldistribution.pr/Product/NO-SRK), [Sound Pro](https://soundpro.com/middle-atlantic-srk-series-rack), [IEWC RK2 spec sheet](https://media.iewc.com/SpecificationSheets/RK2.pdf)',
  '- Mackie 1604VLZ4 simulator: free Mac-only simulator created by SAE Creative Media Institute. — [Mackie blog](https://mackie.com/en/blog/all/SAE_INSTITUTE_1604VLZ4_ANALOG_SIMULATOR.html), [Music Connection](https://www.musicconnection.com/mackie-launches-free-mixer-simulator/)',
  '| Rode PSA1+ | Upgraded studio boom arm | Horizontal reach 940 | [Rode PSA1+](https://rode.com/en-us/products/psa1-plus) |',
  '| Rode PSA1 | Studio boom arm | Horizontal reach 820 | [Rode PSA1](https://rode.com/en-us/products/psa1) |',
  '| Shure UA844+ | Antenna distribution (UHF) | 45 H x 483 W x 172 D (1U) | [UA844+ page](https://shure.com/americas/products/accessories/wireless-systems/wireless-systems-antennas/ua844-plus-v) |',
  '| MOTU 828es | Audio interface | 483 x 177.5 x 44.5 | [MOTU 828es](https://motu.com/products/proaudio/828es/specs.html) |',
].join('\n')
const lines = noteLines(NOTES)

const urlsFor = (id: string): string[] => matchNoteUrls(rowOf(id), lines)

describe('the matcher keeps only note lines whose subject IS the product (and only the links that belong to it)', () => {
  it('rode-procaster no longer takes the PSM1 shock-mount page', () => {
    expect(urlsFor('rode-procaster')).toEqual([])
    expect(subjectIsProduct('Rode PSM1', rowOf('rode-procaster'))).toBe(false)
    expect(urlsFor('rode-psm1')).toEqual(['https://www.zzounds.com/item--RODPSM1']) // the page stays with the product it describes
  })
  it('radial-prodi, scarlett-18i20 and api-512c no longer take a school inventory', () => {
    expect(urlsFor('radial-prodi')).toEqual([])
    expect(urlsFor('focusrite-scarlett-18i20-3rd-gen')).toEqual([])
    expect(urlsFor('api-512c')).toEqual([])
  })
  it('behringer-x32 no longer takes the Midas M32 sheet, and the X32 Compact page stays with the Compact', () => {
    expect(urlsFor('behringer-x32')).toEqual(['https://www.thomann.co.uk/behringer_x_32.htm'])
    expect(urlsFor('behringer-x32-compact')).toEqual(['https://www.thomann.de/ie/behringer_x_32_compact.htm'])
    expect(urlsFor('midas-m32')).toEqual(expect.arrayContaining(['https://global-uploads.webflow.com/5f4013c686a8c427bc62226e/5f4013c686a8c4841f62246e_Midas-M32-Data-Sheet.pdf']))
  })
  it('whirlwind-sp1x3 keeps the SP1X3 page and drops the SPLIT6 pages of the sibling', () => {
    expect(urlsFor('whirlwind-sp1x3')).toEqual(['https://www.americanmusical.com/p/whirlwind-sp1x3-1x3-microphone-splitter'])
  })
  it('sennheiser-hd-25 drops the coiled-cable accessory page; middle-atlantic-srk drops the RK2 sheet; mackie-1604vlz4 drops the blog and the magazine', () => {
    expect(urlsFor('sennheiser-hd-25')).toEqual(['https://www.sennheiser.com/en-us/catalog/products/headphones/hd-25/hd-25-506909'])
    expect(urlsFor('middle-atlantic-srk').sort()).toEqual(['https://soundpro.com/middle-atlantic-srk-series-rack', 'https://www.adiglobaldistribution.pr/Product/NO-SRK'].sort())
    expect(urlsFor('mackie-1604vlz4')).toEqual([])
  })
  it('a plus or a longer model name is another product: PSA1 is not PSA1+, 828 is not 828es', () => {
    expect(urlsFor('rode-psa1')).toEqual(['https://rode.com/en-us/products/psa1'])
    expect(urlsFor('rode-psa1-plus')).toEqual(['https://rode.com/en-us/products/psa1-plus'])
    expect(urlsFor('motu-828')).toEqual([])
    expect(urlsFor('motu-828es')).toEqual(['https://motu.com/products/proaudio/828es/specs.html'])
  })
  it('a product named with a descriptor still matches its note line (UA844+ antenna distribution is « Shure UA844+ »)', () => {
    expect(urlsFor('shure-ua844-plus')).toHaveLength(1)
  })
  it('refreshSources changes only the sources: every other field, the sizes included, comes back unchanged', () => {
    const csv = new Map(plan.map((r) => [r.id, r.id === 'rode-procaster' ? 'Datasheet https://edge.rode.com/pdf/procaster.pdf' : '']))
    const next = refreshSources(plan, csv, lines)
    expect(next).toHaveLength(plan.length)
    for (const [i, r] of next.entries()) expect({ ...r, sources: 0 }).toEqual({ ...plan[i]!, sources: 0 })
    expect(next.find((r) => r.id === 'rode-procaster')!.sources).toEqual(['https://edge.rode.com/pdf/procaster.pdf'])
    expect(refreshSources(plan, new Map(), lines)).toEqual(plan) // an id the CSV does not know keeps its sources
  })
})

describe('isNonSource', () => {
  it('rejects schools, library guides, blogs, news, reviews, simulators and accessory pages, accepts a manufacturer or dealer product page', () => {
    for (const u of [
      'https://libraryguides.mcgill.ca/EquipmentGuide/microphones',
      'https://www.bakersfieldcollege.edu/academics/x',
      'https://college.berklee.edu/node/1',
      'https://mackie.com/en/blog/all/SAE_INSTITUTE_1604VLZ4_ANALOG_SIMULATOR.html',
      'https://www.musicconnection.com/x',
      'https://www.musicradar.com/music-tech/recording/zoom-h6-essential-review',
      'https://www.sennheiser.com/en-us/catalog/products/headphones/headphone-accessories/hd-25-coiled-cable-3m-523877',
    ])
      expect(isNonSource(u), u).toBe(true)
    for (const u of ['https://www.shure.com/en-US/products/microphones/sm7b', 'https://www.zzounds.com/item--RODPSM1', 'https://shure.com/americas/products/accessories/wireless-systems/wireless-systems-antennas/ua844-plus-v'])
      expect(isNonSource(u), u).toBe(false)
    expect(isNonSource('https://example.com/shop/cables/xlr-cable', 'cable')).toBe(false) // a cable row may cite a cable page
  })
})

describe('the committed plan: the nine named wrong examples are corrected', () => {
  const wrong: [string, string][] = [
    ['rode-procaster', 'https://www.zzounds.com/item--RODPSM1'],
    ['radial-prodi', 'https://libraryguides.mcgill.ca/EquipmentGuide/microphones'],
    ['focusrite-scarlett-18i20-3rd-gen', 'https://ccrma.stanford.edu/docs/studios/Recording-Studio.html'],
    ['focusrite-scarlett-18i20-3rd-gen', 'https://wwwprod101.american.edu/cas/audio-technology/facilities.cfm'],
    ['api-512c', 'https://www.bakersfieldcollege.edu/academics/pathways/ach/music/commercial-music-gear-list.html'],
    ['api-512c', 'https://college.berklee.edu/node/2435451'],
    ['behringer-x32', 'https://global-uploads.webflow.com/5f4013c686a8c427bc62226e/5f4013c686a8c4841f62246e_Midas-M32-Data-Sheet.pdf'],
    ['whirlwind-sp1x3', 'https://www.adorama.com/wwsplit6.html'],
    ['whirlwind-sp1x3', 'https://www.rentex.com/wp-content/uploads/2018/08/SPLIT6-Manual.pdf'],
    ['sennheiser-hd-25', 'https://www.sennheiser.com/en-us/catalog/products/headphones/headphone-accessories/hd-25-coiled-cable-3m-523877'],
    ['middle-atlantic-srk', 'https://media.iewc.com/SpecificationSheets/RK2.pdf'],
    ['mackie-1604vlz4', 'https://mackie.com/en/blog/all/SAE_INSTITUTE_1604VLZ4_ANALOG_SIMULATOR.html'],
  ]
  it.each(wrong)('%s no longer lists %s', (id, url) => {
    expect(rowOf(id).sources).not.toContain(url)
  })

  it('the Midas M32 sheet survives as a labelled sibling reference in the notes of the X32, not as a source', () => {
    const x32 = rowOf('behringer-x32')
    expect(x32.notes).toMatch(/Sibling reference only/)
    expect(x32.notes).toContain('Midas-M32-Data-Sheet.pdf')
    expect(x32.sources.some((u) => /M32/i.test(u) && /midas/i.test(u))).toBe(false)
  })

  it('no source of any row is a school, a library guide, a blog, a news page, a simulator or a review that the CSV notes column did not name itself', () => {
    for (const r of plan) {
      const own = new Set(urlsIn(r.notes.split('Sibling reference only')[0]!))
      for (const u of r.sources) if (!own.has(u)) expect(isNonSource(u, r.category), `${r.id}: ${u}`).toBe(false)
    }
  })

  it('a source that is a sibling product page does not carry the other product name: every X32, PSA1 and 828 source belongs to its own row', () => {
    for (const u of rowOf('behringer-x32').sources) expect(u, u).not.toMatch(/compact|m32live/i)
    for (const u of rowOf('rode-psa1').sources) expect(u, u).not.toMatch(/psa1-plus/i)
    for (const u of rowOf('motu-828').sources) expect(u, u).not.toMatch(/828es/i)
  })
})
