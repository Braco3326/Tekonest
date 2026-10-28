import { readFileSync } from 'node:fs'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { Catalog, Port, PortFlag, Rule } from '../../tools/schemas'

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

/** Task 32 (C7): mains is catalog data. A generic power strip is the one mains source; active devices carry a `power` toggle. */
describe('Mains data in the catalog (Task 32, C7)', () => {
  type Dev = { id: string; ports: { portId: string; dir: string; connector: string; signal: string; flags?: string[] }[]; controls?: { id: string; type: string; label: string; default?: boolean }[] }
  const devices = catalogJson.devices as unknown as Dev[]
  const strip = devices.find((d) => d.id === 'multiprise-secteur')

  it('PortFlag knows isMainsSource, and the schema keeps it on a port', () => {
    expect(PortFlag.safeParse('isMainsSource').success).toBe(true)
    expect(Port.safeParse({ portId: 'out-1', dir: 'out', connector: 'iec-c13', signal: 'mains-power', flags: ['isMainsSource'] }).success).toBe(true)
    expect(PortFlag.safeParse('isMainsSourcee').success).toBe(false)
  })

  it('multiprise-secteur: four outputs out-1..out-4, iec-c13, mains-power, flagged isMainsSource; no power-in', () => {
    expect(strip, 'multiprise-secteur is in the catalog').toBeDefined()
    expect(strip!.ports.map((p) => p.portId)).toEqual(['out-1', 'out-2', 'out-3', 'out-4'])
    for (const p of strip!.ports) {
      expect(p, p.portId).toMatchObject({ dir: 'out', connector: 'iec-c13', signal: 'mains-power', flags: ['isMainsSource'] })
    }
    expect(strip!.ports.some((p) => p.portId === 'power-in')).toBe(false)
  })

  it('every device with a power-in port has exactly one toggle « power » labelled « Alimentation », default on', () => {
    const active = devices.filter((d) => d.ports.some((p) => p.portId === 'power-in'))
    expect(active.length).toBeGreaterThanOrEqual(13)
    for (const d of active) {
      const power = (d.controls ?? []).filter((c) => c.id === 'power')
      expect(power, d.id).toHaveLength(1)
      expect(power[0], d.id).toMatchObject({ type: 'toggle', label: 'Alimentation', default: true })
    }
  })

  it('a device without power-in has no power toggle (the strip, microphones, accessories)', () => {
    for (const d of devices.filter((x) => !x.ports.some((p) => p.portId === 'power-in')))
      expect((d.controls ?? []).some((c) => c.id === 'power'), d.id).toBe(false)
  })

  it('the catalog parses with the power control (the schema keeps it)', () => {
    expect(Catalog.safeParse(catalogJson).success).toBe(true)
  })
})

/**
 * Freshness of the hand-patched content/catalog.schema.json (known to differ from the generator: its `controls` union is stale).
 * Only the hunks Task 32 touched are held: every flag enum in the file is the zod PortFlag, value for value, description included.
 */
describe('content/catalog.schema.json: the PortFlag hunks match the generator (Task 32)', () => {
  type Node = { enum?: string[]; description?: string; [k: string]: unknown }
  const flagEnums = (schema: unknown): Node[] => {
    const found: Node[] = []
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) return n.forEach(walk)
      if (typeof n !== 'object' || n === null) return
      const node = n as Node
      if (Array.isArray(node.enum) && node.enum.includes('isDantePrimary')) found.push({ enum: node.enum, description: node.description })
      Object.values(node).forEach(walk)
    }
    walk(schema)
    return found
  }
  const onDisk = JSON.parse(readFileSync('content/catalog.schema.json', 'utf8'))
  const generated = zodToJsonSchema(Catalog, { name: 'Catalog', $refStrategy: 'none' })

  it('the file lists isMainsSource with the PortFlag description in both places a flag appears (port flags, control enables)', () => {
    const f = flagEnums(onDisk)
    expect(f).toHaveLength(2)
    for (const node of f) {
      expect(node.enum).toEqual(PortFlag.options)
      expect(node.enum).toContain('isMainsSource')
      expect(node.description).toBe(PortFlag.description)
    }
  })
  it('and it is exactly what the generator emits for those nodes', () => {
    expect(flagEnums(onDisk)).toEqual(flagEnums(generated))
    expect(flagEnums(generated)).toHaveLength(2)
  })
})
