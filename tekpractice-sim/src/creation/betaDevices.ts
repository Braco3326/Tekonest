/**
 * « Bêta » devices (Task 30, S5): catalog PROPOSALS, never verified gear.
 *
 * Source: content/proposals/catalog-proposals.json, the file `npm run sync:kb`
 * writes (tools/propose-content.ts, from the knowledge base). It is NOT the
 * catalog: content/catalog.json stays the source of truth and is never edited
 * to add a proposal.
 *
 * To be placed, a device must be in the registry the store, the spawner and the
 * panels share (`registry.deviceById`). A proposal is therefore registered there
 * for the session, as a device that declares only its ports (connector, signal,
 * direction, the flags the KB sources): `registry.catalog.devices` is untouched, so
 * the catalog list, the validators and `inventory()` still see the verified gear
 * only. Everything that tells "verified" from "proposed" goes through
 * `isUnverified`, the one definition of « non vérifié ».
 *
 * No Babylon, no DOM, no engine change: the engine reads the declared ports
 * exactly as it reads a catalog device's (R1–R3 on connector / signal, R4–R8 on
 * the declared flags). Behaviour a proposal does not declare does not exist. The one flag it cannot declare is
 * `isMainsSource` (parseProposals drops it): a proposal never powers anything.
 */
import { Device } from '../../tools/schemas'
import type { DeviceT, Registry } from '../engine/CatalogLoader'
import type { DesignState } from '../trials/trial'

/** What the inventory needs of a proposal (`inventory()`'s `proposals` option). */
export interface BetaProposal {
  deviceId: string
  label: string
}

export interface ParsedProposals {
  /** Usable proposals, in file order, one per id (the first wins). */
  devices: DeviceT[]
  /** Why each other entry was left out (a bad entry never takes the tab down). */
  skipped: { id: string; reason: string }[]
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * The proposals file → devices that can be registered. Never throws: anything unusable
 * (not an object, no `devices` array, a malformed device, an id the catalog already has, a
 * repeated id, a connector / signal the catalog does not know, a repeated port id, no port)
 * is skipped with its reason, and a file with nothing usable gives an empty list.
 */
export function parseProposals(raw: unknown, registry: Registry): ParsedProposals {
  const out: ParsedProposals = { devices: [], skipped: [] }
  if (!isObj(raw) || !Array.isArray(raw.devices)) return out
  const catalogIds = new Set(registry.catalog.devices.map((d) => d.id))
  const seen = new Set<string>()
  for (const entry of raw.devices as unknown[]) {
    const id = isObj(entry) && typeof entry.id === 'string' ? entry.id : '?'
    const skip = (reason: string): void => void out.skipped.push({ id, reason })
    if (!isObj(entry)) {
      skip('not an object')
      continue
    }
    if (seen.has(id)) {
      skip('duplicate id (the first one is kept)')
      continue
    }
    seen.add(id)
    if (catalogIds.has(id)) {
      skip('already a verified catalog device')
      continue
    }
    const parsed = Device.safeParse(entry)
    if (!parsed.success) {
      const i = parsed.error.issues[0]
      skip(`schema: ${i?.path.join('.')} ${i?.message}`)
      continue
    }
    const d = parsed.data
    if (!d.ports.length) {
      skip('no declared port')
      continue
    }
    const portIds = new Set(d.ports.map((p) => p.portId))
    if (portIds.size !== d.ports.length) {
      skip('repeated port id')
      continue
    }
    const unknown = d.ports.find((p) => !registry.connectorById.has(p.connector) || !registry.signalById.has(p.signal))
    if (unknown) {
      skip(`port ${unknown.portId}: connector or signal unknown to the catalog`)
      continue
    }
    // A proposal declares ports only: no switch or knob is invented for it.
    const { controls: _controls, ...device } = d
    void _controls
    // And it never SUPPLIES mains (Task 32, C7): `isMainsSource` is a verified-catalog flag, so one carried by a proposal
    // (a regenerated or hand-edited file) is dropped here, the other flags kept. Not reported in `skipped`: the device is usable.
    device.ports = device.ports.map(({ flags, ...port }) => {
      const kept = (flags ?? []).filter((f) => f !== 'isMainsSource')
      return kept.length ? { ...port, flags: kept } : port
    })
    out.devices.push(device)
  }
  return out
}

/** The inventory's view of the devices (`inventory()` puts them in « Bêta », badged). */
export const proposalEntries = (devices: readonly DeviceT[]): BetaProposal[] => devices.map((d) => ({ deviceId: d.id, label: d.label }))

/** Ids registered as proposals, per registry (a WeakMap: a registry that goes away takes its set with it). */
const registered = new WeakMap<Registry, Set<string>>()

/**
 * Make proposals placeable in this registry. Idempotent. A verified catalog device always wins:
 * an id the catalog has is never replaced. Returns the ids newly registered.
 */
export function registerProposals(registry: Registry, devices: readonly DeviceT[]): string[] {
  let ids = registered.get(registry)
  if (!ids) registered.set(registry, (ids = new Set()))
  const catalogIds = new Set(registry.catalog.devices.map((d) => d.id))
  const added: string[] = []
  for (const d of devices) {
    if (catalogIds.has(d.id) || ids.has(d.id)) continue
    registry.deviceById.set(d.id, d)
    ids.add(d.id)
    added.push(d.id)
  }
  return added
}

/** True for a device that is in the registry as a proposal (never for a verified catalog device or an unknown id). */
export function isUnverified(registry: Registry, deviceId: string): boolean {
  return registered.get(registry)?.has(deviceId) === true
}

/** The distinct device ids of a design that the registry does not know yet (the proposals to load before it opens). */
export function unknownDeviceIds(registry: Registry, design: Pick<DesignState, 'rig'> | null | undefined): string[] {
  const instances = design?.rig?.instances
  if (!Array.isArray(instances)) return []
  const ids = instances.flatMap((i) => (isObj(i) && typeof i.deviceId === 'string' && !registry.deviceById.has(i.deviceId) ? [i.deviceId] : []))
  return [...new Set(ids)]
}

/** The proposals as loaded: `failed` = the file could not be fetched (network, timeout), which is NOT « the file has no such sheet ». */
export interface BetaLoad {
  devices: readonly DeviceT[]
  failed: boolean
}

/**
 * What opening a saved design needs of the Bêta sheets.
 * - `none`: every device is known (no fetch was made);
 * - `unavailable`: the fetch FAILED. Nothing is registered; the caller must not apply the design (it would drop the Bêta devices);
 * - `ready`: the file loaded; `missing` = ids it does not hold (a sheet that is genuinely gone), which the store will drop.
 */
export type BetaPrep = { kind: 'ready'; missing: string[] } | { kind: 'unavailable'; ids: string[] }

/** Fetch the sheets a design needs (only when it holds a device the registry does not know) and register them. */
export async function prepareBeta(registry: Registry, design: Pick<DesignState, 'rig'>, load: () => Promise<BetaLoad>): Promise<BetaPrep> {
  const need = unknownDeviceIds(registry, design)
  if (!need.length) return { kind: 'ready', missing: [] }
  const loaded = await load()
  if (loaded.failed) return { kind: 'unavailable', ids: need }
  registerProposals(
    registry,
    loaded.devices.filter((d) => need.includes(d.id)),
  )
  return { kind: 'ready', missing: unknownDeviceIds(registry, design) }
}

/** The promise's value, or `{ ok: false }` when it rejects or does not settle within `ms` (the timer never outlives the race). */
export function within<T>(p: Promise<T>, ms: number): Promise<{ ok: true; value: T } | { ok: false }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false }), ms)
    p.then(
      (value) => {
        clearTimeout(timer)
        resolve({ ok: true, value })
      },
      () => {
        clearTimeout(timer)
        resolve({ ok: false })
      },
    )
  })
}
