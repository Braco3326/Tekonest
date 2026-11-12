/**
 * Wave 0, Task 0.6: docs/legal/BRANDS_AND_CREDITS.md section 6 is GENERATED from the manifest and the asset specs, so it cannot drift:
 * one row per manifest device row, stable output, the committed document equals the generator's output.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BEGIN, END, OURS, deviceLabels, dimensionsSource, readSpecsLoose, renderRegister, replaceBlock, type LooseSpec, type RegisterAsset } from '../../tools/brandsRegister'
import { loadPlan } from '../../tools/equipmentPlan'

const manifest = JSON.parse(readFileSync('public/assets/ASSET_MANIFEST.json', 'utf8').replace(/^\uFEFF/, '')) as { assets: RegisterAsset[] }
const specs = readSpecsLoose('content/asset-specs')
const catalog = JSON.parse(readFileSync('content/catalog.json', 'utf8')) as { devices: { id: string; label: string }[] }
const proposals = JSON.parse(readFileSync('content/proposals/catalog-proposals.json', 'utf8')) as { devices: { id: string; label: string }[] }
const labels = deviceLabels(catalog, proposals)
const planSources = new Map(loadPlan().flatMap((r) => (r.sources[0] ? [[r.id, r.sources[0]] as [string, string]] : [])))
const deviceRows = manifest.assets.filter((a) => a.kind === 'device')
const doc = readFileSync('docs/legal/BRANDS_AND_CREDITS.md', 'utf8')

/** The table rows of a rendered block (lines that start with `| ` and carry a backticked id). */
const rowsOf = (block: string): string[] => block.split('\n').filter((l) => l.startsWith('| ') && /\(`[a-z0-9-]+`\)/.test(l))

describe('renderRegister', () => {
  it('has exactly one row per manifest device row (no connector rows, none missing, none twice)', () => {
    const block = renderRegister(manifest, specs, labels, planSources)
    const rows = rowsOf(block)
    expect(rows).toHaveLength(deviceRows.length)
    for (const a of deviceRows) expect(rows.filter((r) => r.includes(`(\`${a.id}\`)`)), a.id).toHaveLength(1)
    for (const a of manifest.assets.filter((x) => x.kind === 'connector').slice(0, 5)) expect(block).not.toContain(`(\`${a.id}\`)`)
  })

  it('is stable: the same inputs give the same text, and replacing the block twice changes nothing (second run, no diff)', () => {
    const a = renderRegister(manifest, specs, labels, planSources)
    expect(renderRegister(manifest, specs, labels, planSources)).toBe(a)
    const once = replaceBlock(doc, a)
    expect(replaceBlock(once, a)).toBe(once)
    // order does not depend on the manifest's own order
    const shuffled = { ...manifest, assets: [...manifest.assets].reverse() }
    expect(renderRegister(shuffled, specs, labels, planSources)).toBe(a)
  })

  it('the committed document holds exactly the generated block (run `npm run register` after a manifest or spec change)', () => {
    expect(replaceBlock(doc, renderRegister(manifest, specs, labels, planSources))).toBe(doc)
  })

  it('carries, per device: tool, source of dimensions (a URL), picture origin, Meshy yes/no, trademark flag', () => {
    const rows = rowsOf(renderRegister(manifest, specs, labels, planSources))
    for (const r of rows) {
      const cells = r.split(' | ').map((c) => c.trim())
      expect(cells.length, r).toBeGreaterThanOrEqual(7)
      expect(['scripted', 'hybrid', 'meshy', 'raw'], r).toContain(cells[1])
      // Wave 0b: an http(s) URL or the literal « catalogue (ours) », never a local file path, a dash or a repo path
      expect(cells[3] === OURS || /^https?:\/\/\S+$/.test(cells[3]!), `${r}: Dimensions source "${cells[3]}"`).toBe(true)
      expect(cells[5], r).toMatch(/^(no|yes)/)
      expect(cells[6].replace(/\s*\|$/, ''), r).toMatch(/^(generic|branded-internal)/)
    }
  })

  it('Meshy appears on the Meshy rows only, and no generic-artwork row says Meshy', () => {
    const rows = rowsOf(renderRegister(manifest, specs, labels, planSources))
    for (const r of rows) {
      const cells = r.split(' | ').map((c) => c.trim())
      if (cells[4].startsWith('generic artwork')) expect(cells[5], r).toBe('no')
    }
    const yes = rows.filter((r) => /\| yes/.test(r)).length
    expect(yes).toBe(deviceRows.filter((a) => a.tool === 'meshy' || /Meshy render/.test(a.source ?? '')).length)
  })

  it('a device that is only a Bêta proposal (a beta-modelled model) is labelled from the proposals; an unknown id falls back to the id; a pipe in a cell cannot break the table', () => {
    const fake: RegisterAsset = { id: 'fx-beta', kind: 'device', status: 'ok', tool: 'hybrid', source: 'hybrid: own scripted geometry + generic artwork drawn by the pipeline as picture (no manufacturer image)', trademark: 'branded-internal', specSource: 'https://example.com/a|b' }
    const block = renderRegister({ assets: [fake, { ...fake, id: 'fx-unknown' }] }, [], new Map([['fx-beta', 'Acme | Beta']]))
    const rows = rowsOf(block)
    expect(rows).toHaveLength(2)
    expect(block).toContain('Acme \\| Beta (`fx-beta`)')
    expect(block).toContain('(`fx-unknown`)')
    expect(block).toContain('https://example.com/a\\|b')
    expect(block).toContain('generic artwork drawn by us')
  })

  it('picture origin by source: photo, generic artwork, flat colours, Meshy', () => {
    const mk = (over: Partial<RegisterAsset>): string => rowsOf(renderRegister({ assets: [{ id: 'x', kind: 'device', tool: 'hybrid', trademark: 'generic', ...over }] }, [], new Map()))[0]!
    expect(mk({ source: 'hybrid: own scripted geometry + official photo as texture', photos: ['front.jpg', 'rear.jpg'] })).toContain('official manufacturer photos (front.jpg, rear.jpg)')
    expect(mk({ source: 'modeled', tool: 'scripted' })).toContain('none (flat colours)')
    expect(mk({ source: 'ai-meshy', tool: 'meshy' })).toContain('Meshy model and its texture')
    expect(mk({ source: 'ai-meshy', tool: 'meshy' })).toMatch(/\| yes/)
  })

  it('the Dimensions source cell is the first source of the plan row, then the manifest URL, then the spec URL, each only when it is an http(s) URL; a local file path never reaches the register', () => {
    const asset = (over: Partial<RegisterAsset>): RegisterAsset => ({ id: 'x', kind: 'device', tool: 'scripted', source: 'modeled', trademark: 'generic', ...over })
    const spec = { id: 'x', sources: [{ url: 'https://example.com/spec.pdf' }] }
    expect(dimensionsSource(asset({ specSource: 'https://example.com/manifest.pdf' }), spec, 'https://example.com/plan.pdf')).toBe('https://example.com/plan.pdf')
    expect(dimensionsSource(asset({ specSource: 'https://example.com/manifest.pdf' }), spec, undefined)).toBe('https://example.com/manifest.pdf')
    expect(dimensionsSource(asset({}), spec, undefined)).toBe('https://example.com/spec.pdf')
    expect(dimensionsSource(asset({ specSource: 'content/generic-panels/shure-sm58.json' }), undefined, undefined)).toBe(OURS)
    expect(dimensionsSource(asset({ specSource: 'content/catalog.json (devices[multiprise-secteur])' }), { id: 'x', sources: [{ url: 'C:/Users/x/a.pdf' }] }, 'not a url')).toBe(OURS)
    expect(dimensionsSource(asset({}), undefined, undefined)).toBe(OURS)
    // review fix 15: the spec's own dimensions page beats the plan's first source (which can be another product's page)
    const own: LooseSpec = { id: 'x', sources: [{ url: 'https://example.com/other-product', note: 'equipment plan source (research grade: datasheet); size 1 x 2 x 3 mm' }, { url: 'https://example.com/this-product', note: 'product page: 237 x 243 x 351 mm' }] }
    expect(dimensionsSource(asset({}), own, 'https://example.com/other-product')).toBe('https://example.com/this-product')
  })

  it('on the real manifest: the devices measured by hand say « catalogue (ours) », no cell is a repo path or a dash, and a plan source is shown for its device', () => {
    const block = renderRegister(manifest, specs, labels, planSources)
    expect(block).toContain('| catalogue (ours) |')
    expect(block).not.toContain('content/generic-panels')
    expect(block).not.toContain('content/catalog.json')
    const fake = renderRegister({ assets: [{ id: 'x', kind: 'device', tool: 'scripted', source: 'modeled', trademark: 'generic', specSource: 'content/catalog.json (devices[x])' }] }, [], new Map(), new Map([['x', 'https://example.com/plan.pdf']]))
    expect(fake).toContain('https://example.com/plan.pdf')
  })

  it('the spec supplies the dimension source when the manifest has none', () => {
    const row = rowsOf(renderRegister({ assets: [{ id: 'x', kind: 'device', tool: 'scripted', source: 'modeled', trademark: 'generic' }] }, [{ id: 'x', sources: [{ url: 'https://example.com/ds.pdf' }] }], new Map()))[0]!
    expect(row).toContain('https://example.com/ds.pdf')
  })
})

describe('replaceBlock', () => {
  it('replaces only what is between the markers and refuses a document without them', () => {
    const d = `before\n${BEGIN}\nold\n${END}\nafter\n`
    expect(replaceBlock(d, 'new')).toBe(`before\n${BEGIN}\nnew\n${END}\nafter\n`)
    expect(() => replaceBlock('no markers here', 'x')).toThrow(/markers/)
    expect(() => replaceBlock(`${END}\n${BEGIN}`, 'x')).toThrow(/markers/)
  })
})

describe('the inputs', () => {
  it('every manifest device id has a label (catalogue or proposal) or is reported by its id', () => {
    const missing = deviceRows.filter((a) => !labels.has(a.id)).map((a) => a.id)
    expect(missing).toEqual([]) // every shipped device is a catalogue device today; a beta-modelled one is a proposal
  })
  it('readSpecsLoose reads every spec file (it never throws on an unfinished one)', () => {
    expect(specs.length).toBe(readdirSync(join('content', 'asset-specs')).filter((f) => f.endsWith('.json')).length)
  })
})

describe('review fix 15: real rows cite their own product page', () => {
  const md = readFileSync('docs/legal/BRANDS_AND_CREDITS.md', 'utf8')
  it('the 8341A row cites the 8341A page and the 1073DPD row the 1073DPD page', () => {
    const row = (id: string): string => md.split(String.fromCharCode(10)).find((l) => l.includes('(' + String.fromCharCode(96) + id + String.fromCharCode(96) + ')')) ?? ''
    expect(row('genelec-8341a')).toContain('https://www.genelec.com/8341a')
    expect(row('genelec-8341a')).not.toContain('genelec.com/8351')
    expect(row('ams-neve-1073dpd')).toContain('https://www.ams-neve.com/1073dpd/')
    expect(row('ams-neve-1073dpd')).not.toContain('?p=1408')
  })
})
