import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { makeRegistry } from '../helpers'
import { ConnectionGraph } from '../../src/engine/ConnectionGraph'
import { Template } from '../../src/creation/templateSchema'
import { loadTemplates, parseTemplate, templateToDesign } from '../../src/creation/templates'
import { placeCards } from '../../src/creation/shell/placePickerModel'
import { placeSummary } from '../../src/creation/placeSummary'
import { SET_ENV_IDS } from '../../src/creation/places'
import { RoomFile } from '../../src/explore/roomSchema'

const DIR = 'content/templates'
const files = readdirSync(DIR).filter((f) => f.endsWith('.json'))

describe('content/templates', () => {
  const registry = makeRegistry()

  it('has the starter template', () => {
    expect(files).toContain('concert-simple-reference.json')
  })

  it.each(files)('%s parses and validates against the catalog', (f) => {
    const t = Template.parse(JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')))
    for (const i of t.instances) expect(registry.deviceById.has(i.deviceId), i.deviceId).toBe(true)
    const g = new ConnectionGraph(registry, t.instances)
    for (const c of t.connections) {
      const r = g.canConnect(c.a, c.b)
      expect(r.ok, JSON.stringify(c)).toBe(true)
      expect(g.connect(c.a, c.b).ok).toBe(true)
    }
    const ids = new Set(t.instances.map((i) => i.instanceId))
    for (const p of t.placements) expect(ids.has(p.instanceId)).toBe(true)
  })

  it('templateToDesign maps the template to a DesignState', () => {
    const t = Template.parse(JSON.parse(readFileSync(`${DIR}/concert-simple-reference.json`, 'utf8')))
    const d = templateToDesign(t)
    expect(d.roomId).toBe(t.roomId)
    expect(d.rig.instances).toEqual(t.instances)
    expect(d.rig.connections).toEqual(t.connections)
    expect(d.placements).toEqual(t.placements)
    expect(d.placements.find((p) => p.instanceId === 'k12-g')?.position_m).toEqual([6, 2.7, -7.5])
  })

  it('loadTemplates returns every file', async () => {
    const all = await loadTemplates()
    expect(all.map((t) => t.id)).toContain('concert-simple-reference')
    expect(all).toHaveLength(files.length)
  })

  // ── Task 12 (carried over from the Task 11 review)
  const cards = placeCards({ rooms: placeSummary().rooms, sets: SET_ENV_IDS.map((envId) => ({ envId, name: envId })) })
  const placeKeys = new Set(cards.map((c) => c.key))

  it.each(files)('%s: each placement names its instance’s device, instance ids are unique, roomId is a place card', (f) => {
    const t = Template.parse(JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')))
    const ids = t.instances.map((i) => i.instanceId)
    expect(new Set(ids).size).toBe(ids.length)
    const deviceOf = new Map(t.instances.map((i) => [i.instanceId, i.deviceId]))
    for (const p of t.placements) expect(p.deviceId, p.instanceId).toBe(deviceOf.get(p.instanceId))
    expect(placeKeys.has(t.roomId), t.roomId).toBe(true)
  })

  it('every placement of « Concert simple » stands inside a zone of its room; « G » is at world +x (P14)', () => {
    const t = Template.parse(JSON.parse(readFileSync(`${DIR}/concert-simple-reference.json`, 'utf8')))
    const room = RoomFile.parse(JSON.parse(readFileSync(`content/rooms/${t.roomId.replace(/^room:/, '')}.json`, 'utf8')))
    for (const p of t.placements) {
      const [x, , z] = p.position_m
      const inside = room.zones.some((zn) => Math.abs(x - zn.rect_m[0]) <= zn.rect_m[2] / 2 && Math.abs(z - zn.rect_m[1]) <= zn.rect_m[3] / 2)
      expect(inside, p.instanceId).toBe(true)
    }
    expect(t.placements.find((p) => p.instanceId === 'k12-g')!.position_m[0]).toBeGreaterThan(0)
  })

  it('parseTemplate: an invalid template is skipped and the warning names the JSON path', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const raw = JSON.parse(readFileSync(`${DIR}/concert-simple-reference.json`, 'utf8'))
    raw.instances[1].deviceId = 42
    expect(parseTemplate(raw, 'bad.json')).toBeNull()
    expect(String(warn.mock.calls[0]?.join(' '))).toContain('instances.1.deviceId')
    warn.mockRestore()
  })

  it('parseTemplate / loadTemplates: a template whose roomId is not a place card is skipped (warned)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const raw = JSON.parse(readFileSync(`${DIR}/concert-simple-reference.json`, 'utf8'))
    expect(parseTemplate(raw, 'ok.json', placeKeys)?.id).toBe('concert-simple-reference')
    expect(parseTemplate({ ...raw, roomId: 'room:nope' }, 'nope.json', placeKeys)).toBeNull()
    expect(String(warn.mock.calls[0]?.join(' '))).toContain('room:nope')
    expect((await loadTemplates(new Set(['blank']))).map((t) => t.id)).not.toContain('concert-simple-reference')
    expect((await loadTemplates(placeKeys)).map((t) => t.id)).toContain('concert-simple-reference')
    warn.mockRestore()
  })
})
