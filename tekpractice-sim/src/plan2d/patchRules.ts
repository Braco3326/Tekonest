/**
 * Patch rules of the 2D schema page (mission 2, spec §2): an ADAPTER over the existing connection rules, never a second rule set.
 *
 * The plan's devices and cables are turned into a rig (`designOf`) held by a private, throw-away CreationStore (src/creation/store.ts, imported read-only:
 * its code is not changed and the page's own 3D store is never given to it), and every question is that store's `canConnect` dry run, the very check the
 * 3D page and the « Connecter à… » dialog use (R1 connector mate, R2 signal, R3 direction, a taken port, the same port). A refusal reads the same title
 * and teaching text as the status bar and the dialog (`rejectionOf` over `creationRuleText`). tests/plan2d/patchRules.test.ts compares the answers with
 * the dialog's model over thousands of port pairs.
 */
import type { Registry } from '../engine/CatalogLoader'
import type { PortRef } from '../engine/types'
import type { DesignState } from '../trials/trial'
import { CreationStore, creationEvaluator } from '../creation/store'
import { creationRuleText } from '../creation/ruleTexts'
import { rejectionOf, type RuleRow } from '../creation/shell/statusModel'
import type { Plan2D, PortEnd } from './model'

export type Verdict = { ok: true } | { ok: false; code: string; title: string; detail: string }

export interface PatchRules {
  /** May a cable go from `a` to `b` on this plan? */
  verdict(plan: Plan2D, a: PortEnd, b: PortEnd): Verdict
  /** The answer for every port of `deviceId`'s plan device, in catalogue order (the rear panel's lit and dimmed ports). */
  portVerdicts(plan: Plan2D, from: PortEnd, dev: string): { port: string; verdict: Verdict }[]
}

/** The plan as a rig: its devices as instances (the plan id is the instance id), its cables as connections; nothing placed, no room. */
export function designOf(plan: Plan2D): DesignState {
  return {
    roomId: null,
    rig: {
      instances: plan.devices.map((d) => ({ instanceId: d.id, deviceId: d.deviceId })),
      connections: plan.cables.map((c) => ({ a: { instance: c.a.dev, port: c.a.port }, b: { instance: c.b.dev, port: c.b.port } })),
      controls: {},
    },
    placements: [],
  }
}

const ref = (e: PortEnd): PortRef => ({ instance: e.dev, port: e.port })

export function createPatchRules(registry: Registry): PatchRules {
  const evaluator = creationEvaluator(registry)
  const text = creationRuleText(registry.catalog.rules as readonly RuleRow[])
  const stores = new WeakMap<Plan2D, CreationStore>()
  const storeOf = (plan: Plan2D): CreationStore => {
    let s = stores.get(plan)
    if (!s) stores.set(plan, (s = new CreationStore(registry, evaluator, designOf(plan))))
    return s
  }
  const verdict = (plan: Plan2D, a: PortEnd, b: PortEnd): Verdict => {
    const r = storeOf(plan).canConnect(ref(a), ref(b))
    if (r.ok) return { ok: true }
    const t = rejectionOf({ code: r.code, message: r.message, ...(r.ruleId ? { ruleId: r.ruleId } : {}) }, [ref(a), ref(b)], text)
    return { ok: false, code: r.code, title: t.title, detail: t.detail }
  }
  return {
    verdict,
    portVerdicts(plan, from, dev) {
      const d = plan.devices.find((x) => x.id === dev)
      const device = d && registry.deviceById.get(d.deviceId)
      if (!device) return []
      return device.ports.map((p) => ({ port: p.portId, verdict: verdict(plan, from, { dev, port: p.portId }) }))
    },
  }
}
