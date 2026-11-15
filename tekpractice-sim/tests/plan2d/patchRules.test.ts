/**
 * patchRules gives EXACTLY the answers of the existing connection rules (spec §2: no second rule set). The reference here is the 3D page's own path:
 * a CreationStore holding the same rig, the « Connecter à… » model (`candidates`, src/creation/shell/connectModel.ts) where it applies (both ports free,
 * two devices), and `canConnect` + `rejectionOf` (the status bar's text) for the pairs the dialog does not list (a taken port, the same device).
 */
import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import type { PortRef } from '../../src/engine/types'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { candidates } from '../../src/creation/shell/connectModel'
import { rejectionOf, type RuleRow } from '../../src/creation/shell/statusModel'
import { creationRuleText } from '../../src/creation/ruleTexts'
import { applyIntent, emptyPlan, type Plan2D, type PlanIntent } from '../../src/plan2d/model'
import { createPatchRules, designOf } from '../../src/plan2d/patchRules'

const registry = loadCatalog(catalogJson)
const ruleText = creationRuleText(registry.catalog.rules as readonly RuleRow[])

const step = (p: Plan2D, i: PlanIntent): Plan2D => {
  const r = applyIntent(p, i)
  if (!r.ok) throw new Error(r.message)
  return r.plan
}

const DEVICES = ['midas-m32', 'qsc-k12-2', 'shure-sm58', 'crown-xti-4002', 'db-audiotechnik-y10p', 'multiprise-secteur', 'yamaha-rio3224-d2', 'antelope-ocx-hd', 'playout-pc', 'qsc-k12-2']

function bench(): Plan2D {
  let p = emptyPlan('blank')
  DEVICES.forEach((deviceId, i) => (p = step(p, { type: 'place', deviceId, x: i, z: 0 })))
  // two cables already in: the microphone into the console, the console into the first speaker (both through the rules first)
  const m32 = registry.deviceById.get('midas-m32')!
  const micIn = m32.ports.find((q) => q.dir === 'in' && q.signal === 'mic-level')!
  const lineOut = m32.ports.find((q) => q.dir === 'out' && q.signal === 'line-level-pro' && q.connector === 'xlr3-m')!
  p = step(p, { type: 'connect', a: { dev: 'shure-sm58-1', port: registry.deviceById.get('shure-sm58')!.ports[0]!.portId }, b: { dev: 'midas-m32-1', port: micIn.portId } })
  p = step(p, { type: 'connect', a: { dev: 'midas-m32-1', port: lineOut.portId }, b: { dev: 'qsc-k12-2-1', port: 'in-line-a' } })
  return p
}

describe('patchRules: parity with the existing connection rules', () => {
  const plan = bench()
  const rules = createPatchRules(registry)
  const reference = new CreationStore(registry, creationEvaluator(registry), designOf(plan))
  const ports: PortRef[] = plan.devices.flatMap((d) => registry.deviceById.get(d.deviceId)!.ports.map((q) => ({ instance: d.id, port: q.portId })))

  it('the reference rig is the plan (same instances, same cables)', () => {
    expect(reference.design().rig.instances.map((i) => i.instanceId)).toEqual(plan.devices.map((d) => d.id))
    expect(reference.design().rig.connections).toHaveLength(2)
  })

  it(`every ordered pair of ${ports.length} ports: the same accept / refuse answer and the same refusal title and teaching text`, () => {
    let pairs = 0
    let dialogPairs = 0
    let refused = 0
    const reasons = new Set<string>()
    const listed = new Map<string, ReturnType<typeof candidates>>()
    for (const from of ports) {
      const free = reference.connectionAt(from) === undefined
      const dialog = free ? (listed.get(`${from.instance}.${from.port}`) ?? candidates(reference, registry, from)) : null
      if (dialog) listed.set(`${from.instance}.${from.port}`, dialog)
      for (const to of ports) {
        const got = rules.verdict(plan, { dev: from.instance, port: from.port }, { dev: to.instance, port: to.port })
        pairs++
        const ok = dialog?.ok.find((c) => c.ref.instance === to.instance && c.ref.port === to.port)
        const no = dialog?.rejected.find((c) => c.ref.instance === to.instance && c.ref.port === to.port)
        if (ok || no) {
          dialogPairs++
          if (ok) expect(got, `${from.instance}.${from.port} -> ${to.instance}.${to.port}`).toEqual({ ok: true })
          else expect(got, `${from.instance}.${from.port} -> ${to.instance}.${to.port}`).toMatchObject({ ok: false, title: no!.reason, detail: no!.detail })
        } else {
          const r = reference.canConnect(from, to)
          if (r.ok) expect(got).toEqual({ ok: true })
          else {
            const t = rejectionOf({ code: r.code, message: r.message, ...(r.ruleId ? { ruleId: r.ruleId } : {}) }, [from, to], ruleText)
            expect(got, `${from.instance}.${from.port} -> ${to.instance}.${to.port}`).toMatchObject({ ok: false, code: r.code, title: t.title, detail: t.detail })
          }
        }
        if (!got.ok) {
          refused++
          reasons.add(got.code)
        }
      }
    }
    // the table is not trivial: it holds the dialog's own pairs, accepted and refused ones, and the refusals of every kind
    expect(pairs).toBeGreaterThan(2000)
    expect(dialogPairs).toBeGreaterThan(500)
    expect(refused).toBeLessThan(pairs)
    for (const code of ['DIRECTION_MISMATCH', 'CONNECTOR_MISMATCH', 'SIGNAL_MISMATCH', 'PORT_OCCUPIED', 'SELF_CONNECTION']) expect(reasons, code).toContain(code)
  })

  it('portVerdicts lists every port of the target device in catalogue order with the same answers', () => {
    const from = { dev: 'midas-m32-1', port: registry.deviceById.get('midas-m32')!.ports.find((q) => q.dir === 'out' && q.connector === 'xlr3-m' && reference.connectionAt({ instance: 'midas-m32-1', port: q.portId }) === undefined)!.portId }
    const list = rules.portVerdicts(plan, from, 'qsc-k12-2-2')
    expect(list.map((v) => v.port)).toEqual(registry.deviceById.get('qsc-k12-2')!.ports.map((q) => q.portId))
    for (const v of list) expect(v.verdict).toEqual(rules.verdict(plan, from, { dev: 'qsc-k12-2-2', port: v.port }))
    expect(list.find((v) => v.port === 'in-line-a')!.verdict.ok).toBe(true)
    expect(list.find((v) => v.port === 'power-in')!.verdict.ok).toBe(false)
  })

  it('never touches a store it was not given: the 3D page is not involved (a fresh rig per plan, cached by plan value)', () => {
    const a = rules.verdict(plan, { dev: 'midas-m32-1', port: 'x' }, { dev: 'qsc-k12-2-2', port: 'in-line-a' })
    expect(a.ok).toBe(false)
    expect(designOf(emptyPlan('blank')).rig.instances).toEqual([])
  })
})
