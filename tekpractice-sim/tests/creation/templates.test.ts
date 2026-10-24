import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { ConnectionGraph } from '../../src/engine/ConnectionGraph'
import { Template } from '../../src/creation/templateSchema'
import { loadTemplates, templateToDesign } from '../../src/creation/templates'

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
})
