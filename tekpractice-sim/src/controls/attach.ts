/**
 * controls/attach: gives a loaded device instance its hands-on surface. Loaded lazily by the spawner (own chunk, only when a model
 * with a layout arrives): looks the layout up by device id, builds the bank and the rig, and registers the rig's meters with the
 * ticker. A device with no layout, or a model without extras (no real size), gets nothing and costs nothing.
 */
import type { Scene, TransformNode } from '@babylonjs/core'
import { ControlBank } from './controlBank'
import { ControlRig } from './controlRig'
import { parseControlLayout, type ControlLayout } from './controlTypes'
import type { ControlTicker } from './ticker'

const loaders = import.meta.glob('../../content/control-layouts/*.json', { import: 'default' }) as Record<string, () => Promise<unknown>>

const cache = new Map<string, ControlLayout | null>()

/** The layout of a device (parsed and checked once), or null when it has none or it is invalid (logged, never thrown). */
export async function layoutFor(deviceId: string): Promise<ControlLayout | null> {
  if (cache.has(deviceId)) return cache.get(deviceId) ?? null
  const load = loaders[`../../content/control-layouts/${deviceId}.json`]
  let layout: ControlLayout | null = null
  if (load) {
    const { layout: parsed, errors } = parseControlLayout(await load())
    if (parsed && parsed.deviceId === deviceId) layout = parsed
    else console.warn(`[controls] ${deviceId}: layout refused — ${errors.join('; ') || 'deviceId mismatch'}`)
  }
  cache.set(deviceId, layout)
  return layout
}

export interface AttachedControls {
  bank: ControlBank
  rig: ControlRig
}

/** Build the bank and the rig for one instance; null when the device has no layout. */
export async function attachControls(
  deviceId: string,
  instanceId: string,
  scene: Scene,
  root: TransformNode,
  sizeMm: { w: number; h: number; d: number },
  ticker: ControlTicker | null
): Promise<AttachedControls | null> {
  const layout = await layoutFor(deviceId)
  if (!layout || root.isDisposed()) return null
  const bank = new ControlBank(layout.controls)
  const rig = new ControlRig(scene, root, instanceId, bank, sizeMm, layout.topProfile)
  ticker?.add(rig)
  return { bank, rig }
}
