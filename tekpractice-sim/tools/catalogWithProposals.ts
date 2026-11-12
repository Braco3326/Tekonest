/**
 * catalogWithProposals: the catalogue as the asset pipeline sees it: content/catalog.json plus the Bêta proposals (Wave 0, Task 0.4).
 *
 * A beta-modelled device (spec 4.1) has an asset spec and a GLB but is not in the catalogue: it is a proposal. The pipeline checks a spec's port and
 * control ids against "the catalogue" (checkSpecParity), so for such a device the proposals must be visible to it. A proposal is read as the app
 * reads it (src/creation/betaDevices.ts parseProposals): ports only, no controls, no routing, no acoustic, no model front or body, never a
 * mains source; an id the catalogue has is left to the catalogue. Pure.
 */
import { Device, type CatalogT } from './schemas'

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The catalogue with every usable proposal appended to `devices` (a bad or duplicate entry is skipped, as the app skips it). */
export function catalogWithProposals(catalog: CatalogT, proposalsFile: unknown): CatalogT {
  if (!isObj(proposalsFile) || !Array.isArray(proposalsFile.devices)) return catalog
  const seen = new Set(catalog.devices.map((d) => d.id))
  const extra: CatalogT['devices'] = []
  for (const entry of proposalsFile.devices as unknown[]) {
    if (!isObj(entry)) continue
    const { routing: _r, acoustic: _a, modelFront: _f, modelBody: _b, controls: _c, ...declared } = entry
    void _r
    void _a
    void _f
    void _b
    void _c
    const parsed = Device.safeParse(declared)
    if (!parsed.success || seen.has(parsed.data.id) || !parsed.data.ports.length) continue
    seen.add(parsed.data.id)
    extra.push({
      ...parsed.data,
      ports: parsed.data.ports.map(({ flags, ...p }) => {
        const kept = (flags ?? []).filter((f) => f !== 'isMainsSource')
        return kept.length ? { ...p, flags: kept } : p
      }),
    })
  }
  return extra.length ? { ...catalog, devices: [...catalog.devices, ...extra] } : catalog
}

/**
 * The catalogue as the pipeline sees it between the two promotion stages (tools/promoteDevice.ts `stagedDevices`): the devices that stage 2 would
 * write replace a Bêta proposal of the same id (a promoted device leaves the proposals) or are appended (a new beta-modelled device). A device of
 * the real catalogue (`realIds`) is never replaced. Pure.
 */
export function catalogWithStaged(catalog: CatalogT, staged: CatalogT['devices'], realIds: ReadonlySet<string>): CatalogT {
  if (!staged.length) return catalog
  const byId = new Map(staged.filter((d) => !realIds.has(d.id)).map((d) => [d.id, d]))
  const replaced = catalog.devices.map((d) => byId.get(d.id) ?? d)
  const present = new Set(catalog.devices.map((d) => d.id))
  return { ...catalog, devices: [...replaced, ...[...byId.values()].filter((d) => !present.has(d.id))] }
}
