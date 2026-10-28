import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { Catalog, Rule } from '../../tools/schemas'

/** Task 29 (C17, CA-15): every catalog rule carries its French title and teaching text. */
const rule = () => structuredClone(catalogJson.rules[0]) as Record<string, unknown>
const paths = (p: { success: boolean; error?: { issues: { path: (string | number)[] }[] } }): string[] => (p.error?.issues ?? []).map((i) => i.path.join('.'))

describe('Rule schema: title_fr / teach_fr are required (Task 29)', () => {
  it('accepts the first catalog rule as it is', () => {
    expect(Rule.safeParse(rule()).success).toBe(true)
  })
  it('rejects a rule without title_fr, naming the field', () => {
    const r = rule()
    delete r.title_fr
    const parsed = Rule.safeParse(r)
    expect(parsed.success).toBe(false)
    expect(paths(parsed)).toContain('title_fr')
  })
  it('rejects a rule without teach_fr, naming the field', () => {
    const r = rule()
    delete r.teach_fr
    const parsed = Rule.safeParse(r)
    expect(parsed.success).toBe(false)
    expect(paths(parsed)).toContain('teach_fr')
  })
  it('rejects empty French fields', () => {
    expect(Rule.safeParse({ ...rule(), title_fr: '' }).success).toBe(false)
    expect(Rule.safeParse({ ...rule(), teach_fr: '' }).success).toBe(false)
  })
  it('keeps the English fields the legacy UI reads', () => {
    const r = Rule.parse(rule())
    expect(r.title).toBe(catalogJson.rules[0].title)
    expect(r.teach).toBe(catalogJson.rules[0].teach)
  })
})

describe('Catalog schema: the validate-catalog gate fails when a rule lacks the French fields', () => {
  it('the real catalog parses', () => {
    expect(Catalog.safeParse(catalogJson).success).toBe(true)
  })
  it.each(['title_fr', 'teach_fr'] as const)('a catalog whose R5 lacks %s is refused, with the JSON path', (field) => {
    const broken = structuredClone(catalogJson) as unknown as { rules: Record<string, unknown>[] }
    const i = broken.rules.findIndex((r) => r.id === 'R5')
    expect(i).toBeGreaterThanOrEqual(0)
    delete broken.rules[i][field]
    const parsed = Catalog.safeParse(broken)
    expect(parsed.success).toBe(false)
    expect(paths(parsed)).toContain(`rules.${i}.${field}`)
  })
})
