/**
 * Mains (Task 32, C7). A device is powered when its `power-in` is cabled to a MAINS SOURCE and its `power` control is on.
 * A mains source is a port the CATALOG flags `isMainsSource` (the generic `multiprise-secteur` outputs). Nothing else is:
 * a Bêta proposal that declares a `mains-power` OUT port (unverified KB data, no flag) connects like any port (same connector,
 * same signal: R1-R3 pass) but supplies nothing. Two layers keep it so: `parseProposals` drops the flag from any proposal
 * port, and `isMainsSourceRef` stops at `isUnverified` (L18) whatever the registry object holds. Pure: no Babylon, no DOM.
 */
import type { DeviceT, Registry } from '../engine/CatalogLoader'
import type { PortRef } from '../engine/types'
import { isUnverified } from './betaDevices'

/**
 * True when `portId` of `device` is flagged `isMainsSource`. A reader of the DATA it is given: it knows nothing of
 * « unverified ». Prefer `isMainsSourceRef` wherever a registry is at hand.
 */
export function isMainsSourcePort(device: Pick<DeviceT, 'ports'> | undefined, portId: string): boolean {
  return device?.ports.find((p) => p.portId === portId)?.flags?.includes('isMainsSource') === true
}

/**
 * Is this port of this design a mains source? The device is looked up from the ref's instance (`instances` = the design's
 * rig instances) in the registry; false for an unknown instance or device, and ALWAYS false for an unverified (Bêta) device,
 * even if its port object carries the flag. The signal path (Task 34) reads this, not the signal `mains-power`.
 */
export function isMainsSourceRef(
  registry: Registry,
  instances: ReadonlyArray<{ instanceId: string; deviceId: string }>,
  ref: PortRef,
): boolean {
  const deviceId = instances.find((i) => i.instanceId === ref.instance)?.deviceId
  if (deviceId === undefined || isUnverified(registry, deviceId)) return false
  return isMainsSourcePort(registry.deviceById.get(deviceId), ref.port)
}

/**
 * Night wave 1, item 7. A project saved before the mains model (Phase 4) holds active gear but no power strip, so nothing in it is powered and
 * the playback line gives a reason that never mentions the mains. True when the design holds a VERIFIED device that needs power (it has a
 * `power-in` and its « Alimentation » is not switched off) and NO mains source at all (no verified device with an `isMainsSource` port).
 * A strip that is in the project, cabled or not, is the learner's own state: no hint then. A Bêta device is never counted (its needs are
 * unverified, and it supplies nothing). Pure; a malformed design is simply false.
 */
export function needsMainsHint(design: { rig?: unknown } | null | undefined, registry: Registry): boolean {
  const rig = design?.rig as { instances?: unknown; controls?: unknown } | null | undefined
  if (!Array.isArray(rig?.instances)) return false
  const controls = (rig?.controls && typeof rig.controls === 'object' ? rig.controls : {}) as Record<string, Record<string, unknown> | undefined>
  let needs = false
  for (const i of rig.instances as { instanceId?: unknown; deviceId?: unknown }[]) {
    if (typeof i?.deviceId !== 'string' || typeof i.instanceId !== 'string' || isUnverified(registry, i.deviceId)) continue
    const device = registry.deviceById.get(i.deviceId)
    if (!device) continue
    if (device.ports.some((p) => isMainsSourcePort(device, p.portId))) return false // the one rule, not a copy of it
    if (device.ports.some((p) => p.portId === 'power-in') && controls[i.instanceId]?.power !== false) needs = true
  }
  return needs
}
