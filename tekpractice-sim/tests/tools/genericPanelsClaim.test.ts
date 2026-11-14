/**
 * Wave 0b finding 12: the register intro (docs/legal/BRANDS_AND_CREDITS.md section 6) says devices wearing generic panel artwork carry « no manufacturer
 * photo, no logo, no Meshy ». The panels are data (content/generic-panels/*.json), so the claim is checked on them: only the drawn item kinds, no picture
 * reference, no manufacturer or brand name in a text item.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadPlan } from '../../tools/equipmentPlan'

const DIR = 'content/generic-panels'
type Item = { kind: string; text?: string } & Record<string, unknown>
const panels = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ file: f, text: readFileSync(join(DIR, f), 'utf8'), json: JSON.parse(readFileSync(join(DIR, f), 'utf8')) as { faces: Record<string, { items: Item[] }> } }))

/** The item kinds tools/assets3d/genericPanel.ts draws: shapes and text, never an image. */
const DRAWN = new Set(['rect', 'circle', 'vents', 'weave', 'grid', 'text'])
const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const catalog = JSON.parse(readFileSync('content/catalog.json', 'utf8')) as { devices: { realWorld: { brand: string } }[] }
const brands = new Set<string>([...catalog.devices.map((d) => d.realWorld.brand), ...loadPlan().map((r) => r.manufacturer)].map((b) => fold(b.replace(/\(.*\)/, ''))).filter((b) => b.length >= 3 && b !== 'generic'))

describe('generic panels carry no photo and no logo', () => {
  it('there are panels to check', () => {
    expect(panels.length).toBeGreaterThan(0)
  })
  it.each(panels.map((p) => [p.file, p] as const))('%s: only drawn item kinds, no picture reference', (_f, p) => {
    for (const [name, face] of Object.entries(p.json.faces))
      for (const it of face.items) expect(DRAWN.has(it.kind), `${p.file} ${name}: item kind "${it.kind}" is not a drawn shape`).toBe(true)
    expect(p.text, p.file).not.toMatch(/data:image|\.(png|jpe?g|webp|gif|svg)\b|https?:\/\//i)
    for (const key of ['image', 'photo', 'src', 'href', 'url']) expect(p.text, `${p.file}: key ${key}`).not.toContain(`"${key}"`)
  })
  it.each(panels.map((p) => [p.file, p] as const))('%s: no text item prints a manufacturer or brand name', (_f, p) => {
    for (const face of Object.values(p.json.faces))
      for (const it of face.items.filter((i) => i.kind === 'text')) {
        const words = ` ${fold(it.text ?? '')} `
        for (const b of brands) expect(words.includes(` ${b} `), `${p.file}: text "${it.text}" names ${b}`).toBe(false)
      }
  })
})
