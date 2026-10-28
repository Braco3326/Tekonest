/**
 * Mains (Task 32, C7). A device is powered when its `power-in` is cabled to a MAINS SOURCE and its `power` control is on.
 * A mains source is a port the CATALOG flags `isMainsSource` (the generic `multiprise-secteur` outputs). Nothing else is:
 * a Bêta proposal that declares a `mains-power` OUT port (unverified KB data, no flag) connects like any port (same connector,
 * same signal: R1-R3 pass) but supplies nothing. Pure: no Babylon, no DOM.
 */
import type { DeviceT } from '../engine/CatalogLoader'

/** True when `portId` of `device` is flagged `isMainsSource`. False for an unknown device or port. */
export function isMainsSourcePort(device: Pick<DeviceT, 'ports'> | undefined, portId: string): boolean {
  return device?.ports.find((p) => p.portId === portId)?.flags?.includes('isMainsSource') === true
}
