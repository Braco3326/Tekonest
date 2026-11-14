/**
 * Placeholder box size (pure): what a device with no shipped model is drawn as. Wave 0, Task 0.5 (build all equipment).
 *
 * Order of preference: the device's own `sizeMm` (the equipment plan's size, carried by a Bêta proposal; any subset of w, d, h), then the
 * rough footprint of its `realWorld.category`, then the 0.4 x 0.3 x 0.3 m default. Axes mix: a proposal that knows only its height takes
 * its width and depth from the category. A device WITH a model ignores all of this (the spawner scales the model to its real size).
 *
 * `SIZE_BY_CATEGORY` is unchanged from before Wave 0 (it moved here from DeviceSpawner so tools can use it without Babylon).
 */
import type { DeviceT } from '../engine/CatalogLoader'

/** Rough placeholder footprints per realWorld.category (metres: w, h, d). */
export const SIZE_BY_CATEGORY: Readonly<Record<string, readonly [number, number, number]>> = {
  console: [1.0, 0.25, 0.55],
  stagebox: [0.48, 0.18, 0.4],
  microphone: [0.07, 0.22, 0.07],
  'powered-speaker': [0.4, 0.62, 0.36],
  'studio-monitor': [0.2, 0.3, 0.25],
  accessory: [0.06, 1.6, 0.06],
  signaling: [0.12, 0.28, 0.12],
  computer: [0.45, 0.45, 0.2],
  codec: [0.48, 0.09, 0.32],
  'monitor-controller': [0.26, 0.1, 0.3],
  'mic-preamp': [0.24, 0.09, 0.26],
  'master-clock': [0.48, 0.09, 0.26],
  patchbay: [0.48, 0.14, 0.22],
  cable: [0.3, 0.06, 0.12],
  'audio-interface': [0.48, 0.13, 0.3],
}
export const DEFAULT_SIZE: readonly [number, number, number] = [0.4, 0.3, 0.3]

/** Width, height, depth in metres of the category footprint (or the default). */
export function categoryFootprintM(category: string): { w: number; h: number; d: number } {
  const [w, h, d] = Object.prototype.hasOwnProperty.call(SIZE_BY_CATEGORY, category) ? SIZE_BY_CATEGORY[category]! : DEFAULT_SIZE
  return { w, h, d }
}

const axis = (v: number | undefined): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

/** The placeholder box of a device, in metres: the plan size where it has one (axis by axis), else the category footprint, else the default. */
export function deviceFootprint(device: Pick<DeviceT, 'realWorld' | 'sizeMm'>): { w: number; h: number; d: number } {
  const base = categoryFootprintM(device.realWorld.category)
  const s = device.sizeMm
  if (!s) return base
  return { w: axis(s.w) ? s.w / 1000 : base.w, h: axis(s.h) ? s.h / 1000 : base.h, d: axis(s.d) ? s.d / 1000 : base.d }
}

/**
 * A complete size in millimetres for a plan row that has only some axes (a beta-modelled device: dimensions ESTIMATED): the known axes stay,
 * the others come from the category footprint, except that a round-section category (a microphone) takes the missing one of width / depth
 * from the other. Returns which axes were estimated, so the spec and the report can say so. Never returns a zero.
 */
export function estimateSizeMm(category: string, size: { w?: number; d?: number; h?: number }): { sizeMm: { w: number; d: number; h: number }; estimated: ('w' | 'd' | 'h')[] } {
  const f = categoryFootprintM(category)
  const estimated: ('w' | 'd' | 'h')[] = []
  const pick = (k: 'w' | 'd' | 'h', fallback: number): number => {
    const v = size[k]
    if (axis(v)) return v
    estimated.push(k)
    return fallback
  }
  const round = category === 'microphone'
  const w = pick('w', round && axis(size.d) ? size.d : f.w * 1000)
  const d = pick('d', round && axis(size.w) ? size.w : f.d * 1000)
  const h = pick('h', f.h * 1000)
  return { sizeMm: { w, d, h }, estimated }
}
