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
