/**
 * controls/busGraph: which meter buses carry signal, from what is patched. A layout may declare its buses:
 *
 *   "buses": { "ch1": { "ports": ["in-mic-1"] }, "st-l": { "follows": ["ch1", "ch2"] } }
 *
 * `ports`: the bus is live while any of those ports of the device is connected (a mic patched into the strip). `follows`: live while any
 * of those buses is. A bus the layout does not declare is silent, and a layout with no `buses` at all keeps every bus live (a device
 * whose meters are only dressing). Pure.
 */
export interface BusSpec {
  ports?: string[]
  follows?: string[]
}
export type BusMap = Record<string, BusSpec>

/** Whether `bus` carries signal given the set of connected port ids of the device. A cycle in `follows` reads as silent. */
export function busLive(buses: BusMap | undefined, bus: string, connected: ReadonlySet<string>): boolean {
  if (!buses) return true
  const seen = new Set<string>()
  const live = (name: string): boolean => {
    if (seen.has(name)) return false
    seen.add(name)
    const spec = buses[name]
    if (!spec) return false
    if (spec.ports?.some((p) => connected.has(p))) return true
    return spec.follows?.some((f) => live(f)) ?? false
  }
  return live(bus)
}

/** A bus map checked for shape (an object of { ports?: string[], follows?: string[] }); null for anything else. */
export function parseBuses(raw: unknown): BusMap | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const out: BusMap = {}
  for (const [name, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
    const { ports, follows } = v as { ports?: unknown; follows?: unknown }
    const strs = (a: unknown): string[] | undefined | null => (a === undefined ? undefined : Array.isArray(a) && a.every((x) => typeof x === 'string') ? (a as string[]) : null)
    const p = strs(ports)
    const f = strs(follows)
    if (p === null || f === null) return null
    out[name] = { ...(p ? { ports: p } : {}), ...(f ? { follows: f } : {}) }
  }
  return out
}
