import { readFileSync } from 'node:fs'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { Catalog, Device, Port, PortFlag, Route, Rule } from '../../tools/schemas'

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

/**
 * Task 33 (C8, P7): signal routing is catalog data. `Route` is the zod shape; `checkCatalog` (tests/tools/catalogChecks.test.ts)
 * checks a route against the ports and controls of its device.
 */
describe('Route schema (Task 33, C8, P7)', () => {
  const stereo = { from: 'control:playback-usb', to: ['out-main-l', 'out-main-r'], channels: ['L', 'R'], when: { control: 'playback-usb', equals: true } }

  it('accepts the QL1, K12.2, DBR12 and 8030C routes of the brief, and an enum-valued when', () => {
    for (const r of [
      stereo,
      { from: 'in-mic-1', to: ['out-main-l', 'out-main-r'] },
      { from: 'in-mic-2', to: ['out-main-l', 'out-main-r'] },
      { from: 'in-line-a', to: ['transducer'] },
      { from: 'in-line-a', to: ['thru-out-a'], passive: true },
      { from: 'in-line', to: ['link-out'], passive: true },
      { from: 'in-analog', to: ['transducer'] },
      { from: 'control:mode', to: ['out'], when: { control: 'mode', equals: 'live' } },
    ]) expect(Route.safeParse(r).success, JSON.stringify(r)).toBe(true)
  })
  it('rejects channels whose length differs from `to` (shorter, longer, empty), naming the field', () => {
    for (const channels of [['L'], ['L', 'R', 'L'], []]) {
      const parsed = Route.safeParse({ ...stereo, channels })
      expect(parsed.success, JSON.stringify(channels)).toBe(false)
      expect(paths(parsed)).toContain('channels')
    }
  })
  it('accepts channels exactly as long as `to`, one entry for a one-output route too', () => {
    expect(Route.safeParse({ from: 'in-mic-1', to: ['out-main-l'], channels: ['L'] }).success).toBe(true)
  })
  it('rejects an empty `to`, a channel that is not L or R, a non-boolean passive and a numeric when.equals', () => {
    expect(Route.safeParse({ from: 'in-mic-1', to: [] }).success).toBe(false)
    expect(Route.safeParse({ ...stereo, channels: ['L', 'C'] }).success).toBe(false)
    expect(Route.safeParse({ from: 'in-line-a', to: ['thru-out-a'], passive: 'yes' }).success).toBe(false)
    expect(Route.safeParse({ ...stereo, when: { control: 'playback-usb', equals: 1 } }).success).toBe(false)
    expect(Route.safeParse({ ...stereo, when: { equals: true } }).success).toBe(false)
  })
  it('rejects a route without `from`, or with an empty one', () => {
    expect(Route.safeParse({ to: ['out-main-l'] }).success).toBe(false)
    expect(Route.safeParse({ from: '', to: ['out-main-l'] }).success).toBe(false)
  })
  it('every Route field carries a .describe()', () => {
    const shape = (Route as unknown as { _def: { schema: { shape: Record<string, { description?: string }> } } })._def.schema.shape
    expect(Object.keys(shape).sort()).toEqual(['channels', 'from', 'passive', 'to', 'when'])
    for (const [k, v] of Object.entries(shape)) expect(v.description, k).toMatch(/\S/)
  })
  it('Device.routing is optional, and the parsed device keeps it', () => {
    const d = structuredClone(catalogJson.devices.find((x) => x.id === 'shure-sm58')) as Record<string, unknown>
    expect(Device.safeParse(d).success).toBe(true)
    const parsed = Device.parse({ ...d, routing: [{ from: 'out-xlr', to: ['out-xlr'] }] })
    expect(parsed.routing).toEqual([{ from: 'out-xlr', to: ['out-xlr'] }])
  })
  it('a catalog whose QL1 route has channels of the wrong length is refused, with the JSON path', () => {
    const broken = structuredClone(catalogJson) as unknown as { devices: { id: string; routing?: Record<string, unknown>[] }[] }
    const i = broken.devices.findIndex((d) => d.id === 'yamaha-ql1')
    expect(broken.devices[i].routing, 'the QL1 carries routing').toBeDefined()
    const j = broken.devices[i].routing!.findIndex((r) => r.channels !== undefined)
    expect(j).toBeGreaterThanOrEqual(0)
    broken.devices[i].routing![j].channels = ['L']
    const parsed = Catalog.safeParse(broken)
    expect(parsed.success).toBe(false)
    expect(paths(parsed)).toContain(`devices.${i}.routing.${j}.channels`)
  })
})

/** The data of the brief, verbatim. Any other device stays free of routing (a Bêta device has none either). */
describe('Routing and console sound controls in the catalog (Task 33)', () => {
  type Dev = { id: string; controls?: Record<string, unknown>[]; routing?: Record<string, unknown>[] }
  const devices = catalogJson.devices as unknown as Dev[]
  const dev = (id: string) => devices.find((d) => d.id === id)!

  it('QL1 controls: power first, then Lecture console, Mute master, Fader master, Balance (values of the brief)', () => {
    expect(dev('yamaha-ql1').controls).toEqual([
      { id: 'power', type: 'toggle', label: 'Alimentation', default: true },
      { id: 'playback-usb', type: 'toggle', label: 'Lecture console', default: false },
      { id: 'mute-master', type: 'toggle', label: 'Mute master', default: false },
      { id: 'fader-master', type: 'enum', label: 'Fader master', options: ['-inf', '-30', '-20', '-10', '-6', '-3', '0', '+6', '+10'], defaultOption: '0' },
      { id: 'balance-master', type: 'enum', label: 'Balance', options: ['G100', 'G50', 'C', 'D50', 'D100'], defaultOption: 'C' },
    ])
  })
  it('QL1 routing: playback in stereo L/R when playback-usb is on, then both mic inputs to the main outputs', () => {
    expect(dev('yamaha-ql1').routing).toEqual([
      { from: 'control:playback-usb', to: ['out-main-l', 'out-main-r'], channels: ['L', 'R'], when: { control: 'playback-usb', equals: true } },
      { from: 'in-mic-1', to: ['out-main-l', 'out-main-r'] },
      { from: 'in-mic-2', to: ['out-main-l', 'out-main-r'] },
    ])
  })
  it('speakers: K12.2 and DBR12 feed their transducer and loop through (passive); the 8030C feeds its transducer only', () => {
    expect(dev('qsc-k12-2').routing).toEqual([
      { from: 'in-line-a', to: ['transducer'] },
      { from: 'in-line-a', to: ['thru-out-a'], passive: true },
    ])
    expect(dev('yamaha-dbr12').routing).toEqual([
      { from: 'in-line', to: ['transducer'] },
      { from: 'in-line', to: ['link-out'], passive: true },
    ])
    expect(dev('genelec-8030c').routing).toEqual([{ from: 'in-analog', to: ['transducer'] }])
  })
  it('no other device carries routing, and only the two KB parallel links are passive', () => {
    expect(devices.filter((d) => d.routing !== undefined).map((d) => d.id).sort()).toEqual(['genelec-8030c', 'qsc-k12-2', 'yamaha-dbr12', 'yamaha-ql1'])
    const passive = devices.flatMap((d) => (d.routing ?? []).filter((r) => r.passive === true).map((r) => `${d.id}:${String(r.from)}`)).sort()
    expect(passive).toEqual(['qsc-k12-2:in-line-a', 'yamaha-dbr12:in-line'])
  })
  it('every passive route is labelled as the P7 assumption (unsourced): in the schema description and in the notes of its device', () => {
    const shape = (Route as unknown as { _def: { schema: { shape: Record<string, { description?: string }> } } })._def.schema.shape
    expect(shape.passive.description, 'schema description').toContain('Hypothèse pédagogique du plan (P7), non sourcée')
    const passiveDevices = (catalogJson.devices as unknown as { id: string; realWorld: { notes: string }; routing?: { passive?: boolean }[] }[]).filter((d) => (d.routing ?? []).some((r) => r.passive === true))
    expect(passiveDevices.map((d) => d.id).sort()).toEqual(['qsc-k12-2', 'yamaha-dbr12'])
    for (const d of passiveDevices) expect(d.realWorld.notes, d.id).toContain('hypothèse pédagogique du plan (P7), non sourcée')
  })
  it('the KB phrases quoted in the data are verbatim (read from the KB file, not retyped)', () => {
    type Kb = { devices: { id: string; connectors: { role: string }[] }[] }
    const kb = JSON.parse(readFileSync('../knowledge-base/equipment/loudspeakers.json', 'utf8')) as Kb
    const roles = (id: string) => kb.devices.find((d) => d.id === id)!.connectors.map((c) => c.role)
    const DBR12_QUOTE = 'CH1 parallel through or CH1+CH2 mix'
    expect(roles('yamaha-dbr12').some((r) => r === `Output XLR3-32 (${DBR12_QUOTE})`), 'the KB role of the DBR12 output').toBe(true)
    expect(roles('qsc-k12-2')).toEqual(expect.arrayContaining(['loop-thru outputs', 'mix output']))
    const notes = (id: string) => (catalogJson.devices as unknown as { id: string; realWorld: { notes: string } }[]).find((d) => d.id === id)!.realWorld.notes
    expect(notes('yamaha-dbr12')).toContain(`« ${DBR12_QUOTE} »`)
    expect(notes('qsc-k12-2')).toContain('« loop-thru outputs »')
    expect(notes('qsc-k12-2')).toContain("n'est pas modélisée")
    const shape = (Route as unknown as { _def: { schema: { shape: Record<string, { description?: string }> } } })._def.schema.shape
    expect(shape.passive.description).toContain(`DBR12 "${DBR12_QUOTE}"`)
    expect(shape.passive.description).toContain('K12.2 "loop-thru outputs"')
  })
  it('the DBR12 notes say the real THRU/MIX output is modelled as THRU only', () => {
    const notes = (catalogJson.devices as unknown as { id: string; realWorld: { notes: string } }[]).find((d) => d.id === 'yamaha-dbr12')!.realWorld.notes
    expect(notes).toContain('Sortie THRU/MIX réelle ; seule la position THRU (liaison parallèle) est modélisée')
  })
  it('the parsed catalog keeps routing (the schema knows the field)', () => {
    const parsed = Catalog.parse(catalogJson)
    expect(parsed.devices.find((d) => d.id === 'yamaha-ql1')!.routing).toHaveLength(3)
  })
})

/** Same idea as the PortFlag hunks above: the routing hunk of the hand-patched file is what the generator emits. */
describe('content/catalog.schema.json: the routing hunk matches the generator (Task 33)', () => {
  type Obj = { properties?: Record<string, unknown>; required?: string[] }
  const deviceItems = (schema: unknown): Obj => (schema as { definitions: { Catalog: { properties: { devices: { items: Obj } } } } }).definitions.Catalog.properties.devices.items
  const onDisk = deviceItems(JSON.parse(readFileSync('content/catalog.schema.json', 'utf8')))
  const generated = deviceItems(zodToJsonSchema(Catalog, { name: 'Catalog', $refStrategy: 'none' }))

  it('Device.routing is optional (not in `required`) and its node is exactly the generated one', () => {
    expect(onDisk.properties).toHaveProperty('routing')
    expect(onDisk.required).not.toContain('routing')
    expect(onDisk.properties!.routing).toEqual(generated.properties!.routing)
  })
  it('the node documents the route fields (the descriptions travel to the editor)', () => {
    const items = (onDisk.properties!.routing as { items: { properties: Record<string, { description?: string }> } }).items
    expect(Object.keys(items.properties).sort()).toEqual(['channels', 'from', 'passive', 'to', 'when'])
    for (const [k, v] of Object.entries(items.properties)) expect(v.description, k).toMatch(/\S/)
  })
})
