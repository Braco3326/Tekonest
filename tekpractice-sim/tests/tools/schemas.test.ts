import { readFileSync } from 'node:fs'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import catalogJson from '../../content/catalog.json'
import { Acoustic, Catalog, Device, Port, PortFlag, Route, Rule, Sourced } from '../../tools/schemas'

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

/**
 * Task 35 (C12): the acoustic fields of a loudspeaker, each with its provenance. `Sourced` is the zod shape of a value + its source;
 * `checkCatalog` (tests/tools/catalogChecks.test.ts) adds the rules zod cannot see (nominal only as 90 x 60, a speaker needs acoustic).
 */
describe('Sourced / Acoustic schema (Task 35, C12)', () => {
  const src = { kind: 'kb', ref: 'knowledge-base/equipment/loudspeakers.json#qsc-k12-2 key_specs.coverage', retrieved: '2026-10-22' }
  const ok = () => ({ coverage_h_deg: { value: 90, source: { ...src } }, coverage_v_deg: { value: 60, source: { ...src } } })
  const FIELDS = ['coverage_h_deg', 'coverage_v_deg', 'max_spl_db', 'sensitivity_db'] as const
  const full = () => ({ ...ok(), max_spl_db: { value: 131, source: { ...src } }, sensitivity_db: { value: 98, source: { ...src } } })

  it('accepts coverage alone, and with the optional max SPL and sensitivity', () => {
    expect(Acoustic.safeParse(ok()).success).toBe(true)
    expect(Acoustic.safeParse(full()).success).toBe(true)
    expect(Acoustic.safeParse({ ...ok(), max_spl_db: { value: 131, source: src } }).success).toBe(true)
  })
  it('requires both coverage angles', () => {
    for (const k of ['coverage_h_deg', 'coverage_v_deg'] as const) {
      const a: Record<string, unknown> = ok()
      delete a[k]
      expect(paths(Acoustic.safeParse(a)), k).toEqual([k])
    }
  })
  it('requires a source on EVERY acoustic field (a bare value is refused, with the path of the missing source)', () => {
    for (const k of FIELDS) {
      const a: Record<string, unknown> = full()
      a[k] = { value: 90 }
      expect(paths(Acoustic.safeParse(a)), k).toEqual([`${k}.source`])
    }
  })
  it('requires kind (datasheet | kb | nominal), a non-empty ref and an ISO date', () => {
    for (const kind of ['datasheet', 'kb', 'nominal']) expect(Sourced(z.number()).safeParse({ value: 1, source: { ...src, kind } }).success, kind).toBe(true)
    const bad = (source: Record<string, unknown>) => paths(Sourced(z.number()).safeParse({ value: 1, source }))
    expect(bad({ ...src, kind: 'memory' })).toEqual(['source.kind'])
    expect(bad({ ...src, kind: undefined })).toEqual(['source.kind'])
    expect(bad({ ...src, ref: '' })).toEqual(['source.ref'])
    expect(bad({ ...src, ref: undefined })).toEqual(['source.ref'])
    expect(bad({ ...src, retrieved: '22/10/2026' })).toEqual(['source.retrieved'])
    expect(bad({ ...src, retrieved: undefined })).toEqual(['source.retrieved'])
  })
  it('refuses a non-positive angle, a non-numeric value, and a key it does not know (a typo would vanish silently)', () => {
    expect(paths(Acoustic.safeParse({ ...ok(), coverage_h_deg: { value: 0, source: src } }))).toEqual(['coverage_h_deg.value'])
    expect(paths(Acoustic.safeParse({ ...ok(), coverage_v_deg: { value: '60', source: src } }))).toEqual(['coverage_v_deg.value'])
    expect(Acoustic.safeParse({ ...ok(), max_spl: { value: 131, source: src } }).success).toBe(false)
    expect(Acoustic.safeParse({ ...ok(), coverage_h_deg: { value: 90, source: { ...src, note: 'x' } } }).success).toBe(false)
  })
  it('every Acoustic field, and every field of a source, carries a .describe()', () => {
    const shape = Acoustic.shape as unknown as Record<string, { description?: string }>
    expect(Object.keys(shape).sort()).toEqual([...FIELDS].sort())
    for (const k of FIELDS) expect(shape[k].description, k).toMatch(/\S/)
    const sourced = Sourced(z.number()).shape as unknown as Record<string, { description?: string; shape?: Record<string, { description?: string }> }>
    expect(sourced.value.description, 'value').toMatch(/\S/)
    expect(sourced.source.description, 'source').toMatch(/\S/)
    expect(Object.keys(sourced.source.shape!).sort()).toEqual(['kind', 'ref', 'retrieved'])
    for (const [k, v] of Object.entries(sourced.source.shape!)) expect(v.description, k).toMatch(/\S/)
  })
  it('Device.acoustic is optional, and the parsed device keeps it', () => {
    const d = structuredClone(catalogJson.devices.find((x) => x.id === 'shure-sm58')!) as Record<string, unknown>
    expect(Device.safeParse(d).success).toBe(true)
    expect(Device.parse({ ...d, acoustic: ok() }).acoustic).toEqual(ok())
    expect(paths(Device.safeParse({ ...d, acoustic: { ...ok(), coverage_h_deg: { value: 90 } } }))).toEqual(['acoustic.coverage_h_deg.source'])
  })
  it('the parsed catalog keeps the acoustic block of the speakers (the schema knows the field)', () => {
    const parsed = Catalog.parse(catalogJson)
    expect(parsed.devices.find((d) => d.id === 'qsc-k12-2')!.acoustic).toBeDefined()
  })
})

/** Task 35: Route is .strict() so that the typed catalog (which validate:catalog now uses) still reports a stray key, with its path. */
describe('Route is strict (Task 35: the typed catalog no longer hides a stray route key)', () => {
  const stereo = { from: 'in-mic-1', to: ['out-main-l'] }
  it('refuses an unknown key on a route', () => {
    for (const key of ['enabledBy', 'source']) expect(Route.safeParse({ ...stereo, [key]: 'x' }).success, key).toBe(false)
  })
  it('Catalog.parse reports a stray route key of the real catalog with its path', () => {
    const broken = structuredClone(catalogJson) as unknown as { devices: { id: string; routing?: Record<string, unknown>[] }[] }
    const i = broken.devices.findIndex((d) => d.id === 'yamaha-ql1')
    broken.devices[i].routing![0].enabledBy = 'power'
    const parsed = Catalog.safeParse(broken)
    expect(parsed.success).toBe(false)
    expect(paths(parsed)).toEqual([`devices.${i}.routing.0`])
    expect(parsed.error!.issues[0].message).toMatch(/enabledBy/)
  })
})

/** The acoustic data of the three speakers, read against the KB files (values are copied, never invented). */
describe('Acoustic data of the speakers (Task 35, C12)', () => {
  type Src = { kind: string; ref: string; retrieved: string }
  type Sv = { value: number; source: Src }
  type Ac = { coverage_h_deg: Sv; coverage_v_deg: Sv; max_spl_db?: Sv; sensitivity_db?: Sv }
  type Dev = { id: string; acoustic?: Ac }
  const devices = catalogJson.devices as unknown as Dev[]
  const ac = (id: string): Ac => devices.find((d) => d.id === id)!.acoustic!
  const kbFile = (f: string) => JSON.parse(readFileSync(`../knowledge-base/equipment/${f}`, 'utf8')) as { generated: string; devices: { id: string; key_specs: Record<string, string> }[] }
  const loud = kbFile('loudspeakers.json')
  const mon = kbFile('studio-monitors.json')
  const strip = (s: Sv) => ({ value: s.value, kind: s.source.kind, retrieved: s.source.retrieved })
  const quoted = (ref: string) => /« (.+?) »/.exec(ref)![1]

  it('K12.2: coverage 75 x 75 (kb), max SPL 132 (kb, peak), no sensitivity', () => {
    const a = ac('qsc-k12-2')
    expect(strip(a.coverage_h_deg)).toEqual({ value: 75, kind: 'kb', retrieved: '2026-10-22' })
    expect(strip(a.coverage_v_deg)).toEqual({ value: 75, kind: 'kb', retrieved: '2026-10-22' })
    expect(strip(a.max_spl_db!)).toEqual({ value: 132, kind: 'kb', retrieved: '2026-10-22' })
    expect(a.sensitivity_db, 'the KB has no sensitivity for the K12.2').toBeUndefined()
    expect(a.max_spl_db!.source.ref, 'the continuous figure is noted in ref').toContain('126 dB @ 1 m continuous')
  })
  it('DBR12: coverage 90 x 60 (kb), max SPL 131 (kb, peak), no sensitivity', () => {
    const a = ac('yamaha-dbr12')
    expect(strip(a.coverage_h_deg)).toEqual({ value: 90, kind: 'kb', retrieved: '2026-10-22' })
    expect(strip(a.coverage_v_deg)).toEqual({ value: 60, kind: 'kb', retrieved: '2026-10-22' })
    expect(strip(a.max_spl_db!)).toEqual({ value: 131, kind: 'kb', retrieved: '2026-10-22' })
    expect(a.sensitivity_db, 'the KB input_sensitivity is an input level in dBu, not an SPL sensitivity').toBeUndefined()
  })
  it('8030C: 90 x 60 nominal with the « valeur nominale » ref; no max SPL (the KB gives a lower bound only), no sensitivity', () => {
    const a = ac('genelec-8030c')
    const ref = 'valeur nominale (pas de donnée constructeur dans la KB)'
    expect(a.coverage_h_deg).toEqual({ value: 90, source: { kind: 'nominal', ref, retrieved: '2026-10-22' } })
    expect(a.coverage_v_deg).toEqual({ value: 60, source: { kind: 'nominal', ref, retrieved: '2026-10-22' } })
    expect(a.max_spl_db, '« > 104 dB SPL » is a lower bound').toBeUndefined()
    expect(a.sensitivity_db).toBeUndefined()
  })
  it('only the three speakers carry acoustic', () => {
    expect(devices.filter((d) => d.acoustic !== undefined).map((d) => d.id).sort()).toEqual(['genelec-8030c', 'qsc-k12-2', 'yamaha-dbr12'])
  })
  it('every kb value cites the KB entry and field it comes from, quotes the KB text verbatim, and carries the KB note date', () => {
    const kbValues = devices.flatMap((d) => Object.entries(d.acoustic ?? {}).map(([field, s]) => ({ id: d.id, field, s: s as Sv }))).filter((x) => x.s.source.kind === 'kb')
    expect(kbValues.map((x) => `${x.id}.${x.field}`).sort()).toEqual([
      'qsc-k12-2.coverage_h_deg', 'qsc-k12-2.coverage_v_deg', 'qsc-k12-2.max_spl_db',
      'yamaha-dbr12.coverage_h_deg', 'yamaha-dbr12.coverage_v_deg', 'yamaha-dbr12.max_spl_db',
    ])
    for (const { id, field, s } of kbValues) {
      const m = /^knowledge-base\/equipment\/(loudspeakers\.json)#([a-z0-9-]+) key_specs\.([a-z_]+) « /.exec(s.source.ref)
      expect(m, `${id}.${field}: ref = KB path#entry key_specs.<key> « quote »`).not.toBeNull()
      expect(m![2], `${id}.${field}: the entry cited is the device itself`).toBe(id)
      const text = loud.devices.find((d) => d.id === m![2])!.key_specs[m![3]]
      expect(text, `${id}.${field}: key_specs.${m![3]} exists in the KB`).toBeDefined()
      expect(quoted(s.source.ref), `${id}.${field}: the quotation is the KB text, verbatim`).toBe(text)
      expect(s.source.retrieved, `${id}.${field}: the KB note date`).toBe(loud.generated)
    }
  })
  it('the KB texts carry the values (75 / H90 x V60 / 132 peak / 131 peak), pinned against the KB file', () => {
    const k = loud.devices.find((d) => d.id === 'qsc-k12-2')!.key_specs
    const b = loud.devices.find((d) => d.id === 'yamaha-dbr12')!.key_specs
    expect(k.coverage).toBe('75° nominal, axisymmetric')
    expect(k.max_spl).toBe('132 dB @ 1 m peak; 126 dB @ 1 m continuous')
    expect(b.coverage).toBe('H90° x V60° Constant Directivity Horn')
    expect(b.max_spl).toBe('131 dB SPL (Measured Maximum SPL (Peak) IEC noise@1m)')
    expect(b.coverage).toContain(`H${ac('yamaha-dbr12').coverage_h_deg.value}° x V${ac('yamaha-dbr12').coverage_v_deg.value}°`)
    expect(k.coverage).toContain(`${ac('qsc-k12-2').coverage_h_deg.value}°`)
    expect(k.max_spl.startsWith(`${ac('qsc-k12-2').max_spl_db!.value} dB`)).toBe(true)
    expect(b.max_spl.startsWith(`${ac('yamaha-dbr12').max_spl_db!.value} dB`)).toBe(true)
  })
  it('the 8030C claims are backed by the KB: no coverage in its entry, max SPL only as a lower bound; its note date is the retrieved date', () => {
    const e = mon.devices.find((d) => d.id === 'genelec-8030c')!
    expect(JSON.stringify(e)).not.toMatch(/coverage|directivity|dispersion/i)
    expect(e.key_specs.max_spl_short_term_sine).toBe('> 104 dB SPL @ 1 m (half space, 100 Hz - 3 kHz)')
    expect(e.key_specs.max_spl_long_term).toBe('> 96 dB SPL @ 1 m (IEC weighted noise)')
    expect(ac('genelec-8030c').coverage_h_deg.source.retrieved).toBe(mon.generated)
  })
})

/** Same idea as the routing hunk above: the acoustic hunk of the hand-patched file is what the generator emits. */
describe('content/catalog.schema.json: the acoustic hunk matches the generator (Task 35)', () => {
  type Obj = { properties?: Record<string, unknown>; required?: string[] }
  const deviceItems = (schema: unknown): Obj => (schema as { definitions: { Catalog: { properties: { devices: { items: Obj } } } } }).definitions.Catalog.properties.devices.items
  const onDisk = deviceItems(JSON.parse(readFileSync('content/catalog.schema.json', 'utf8')))
  const generated = deviceItems(zodToJsonSchema(Catalog, { name: 'Catalog', $refStrategy: 'none' }))

  it('Device.acoustic is optional (not in `required`) and its node is exactly the generated one', () => {
    expect(onDisk.properties).toHaveProperty('acoustic')
    expect(onDisk.required).not.toContain('acoustic')
    expect(onDisk.properties!.acoustic).toEqual(generated.properties!.acoustic)
  })
  it('the node documents every acoustic field and every source field', () => {
    type N = { description?: string; properties?: Record<string, N> }
    const node = onDisk.properties!.acoustic as N
    expect(Object.keys(node.properties!).sort()).toEqual(['coverage_h_deg', 'coverage_v_deg', 'max_spl_db', 'sensitivity_db'])
    for (const [k, v] of Object.entries(node.properties!)) {
      expect(v.description, k).toMatch(/\S/)
      expect(v.properties!.value.description, `${k}.value`).toMatch(/\S/)
      expect(Object.keys(v.properties!.source.properties!).sort(), `${k}.source`).toEqual(['kind', 'ref', 'retrieved'])
      for (const [s, sv] of Object.entries(v.properties!.source.properties!)) expect(sv.description, `${k}.source.${s}`).toMatch(/\S/)
    }
  })
})
