/**
 * assets3d/loadSpecs: reads content/asset-specs/*.json and checks a spec against the catalog.
 * loadSpecs is the only fs part; checkSpecParity is pure (the tests and the later pipeline stages call it).
 *
 * Parity (decision R7):
 *  - a spec of kind 'device' must name a catalog device, and its ports / controls must be exactly the catalog's
 *    port ids / control ids (a missing id on either side is an error that names the device and the id)
 *  - a spec of kind 'connector' must name a catalog.connectorTypes id and carry no ports and no controls;
 *    it never looks in catalog.devices
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CatalogT } from '../schemas'
import { AssetSpec } from './specSchema'
import type { AssetSpecT } from './specSchema'

/** Default folder of the specs: content/asset-specs, next to catalog.json. */
export const DEFAULT_SPEC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'asset-specs')

/** Loads every `<id>.json` of `dir` (sorted by file name). A missing folder is an empty list; a malformed file throws with its name and the JSON path. */
export function loadSpecs(dir: string = DEFAULT_SPEC_DIR): AssetSpecT[] {
  if (!existsSync(dir)) return []
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
  return files.map((file) => {
    const raw: unknown = JSON.parse(readFileSync(resolve(dir, file), 'utf8'))
    const parsed = AssetSpec.safeParse(raw)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new Error(`asset spec ${file}: ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    }
    if (parsed.data.id !== basename(file, '.json'))
      throw new Error(`asset spec ${file}: id "${parsed.data.id}" does not match the file name`)
    return parsed.data
  })
}

/** Errors for the ids that `have` and `want` do not share, each naming the owner and the id. */
function diffIds(what: 'port' | 'control', owner: string, have: string[], want: string[]): string[] {
  const errors: string[] = []
  for (const id of new Set(have))
    if (!want.includes(id)) errors.push(`${owner}: spec ${what} "${id}" is not in the catalog`)
  for (const id of new Set(want))
    if (!have.includes(id)) errors.push(`${owner}: catalog ${what} "${id}" is missing from the spec`)
  return errors
}

/** Ids listed more than once, each once. */
const repeated = (ids: string[]): string[] => [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]

/** Parity of one spec with the catalog: error strings, empty when they agree. */
export function checkSpecParity(spec: AssetSpecT, catalog: CatalogT): string[] {
  if (spec.kind === 'connector') {
    const errors: string[] = []
    if (!catalog.connectorTypes.some((c) => c.id === spec.id))
      errors.push(`connector spec "${spec.id}": not in catalog.connectorTypes`)
    if (spec.ports.length > 0) errors.push(`connector spec "${spec.id}": a connector has no ports (found ${spec.ports.length})`)
    if (spec.controls.length > 0) errors.push(`connector spec "${spec.id}": a connector has no controls (found ${spec.controls.length})`)
    return errors
  }

  const device = catalog.devices.find((d) => d.id === spec.id)
  if (!device) return [`device spec "${spec.id}": not in catalog.devices`]
  const owner = `device "${spec.id}"`
  const specPorts = spec.ports.map((p) => p.portId)
  const specControls = spec.controls.map((c) => c.controlId)
  return [
    ...diffIds('port', owner, specPorts, device.ports.map((p) => p.portId)),
    ...diffIds('control', owner, specControls, (device.controls ?? []).map((c) => c.id)),
    ...repeated(specPorts).map((id) => `${owner}: spec port "${id}" is listed more than once`),
    ...repeated(specControls).map((id) => `${owner}: spec control "${id}" is listed more than once`),
  ]
}
