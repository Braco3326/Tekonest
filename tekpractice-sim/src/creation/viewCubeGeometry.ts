/**
 * View cube widget geometry (Task 17, C11): pure, no Babylon, no DOM.
 *
 * The cube mesh sits at the world origin in WORLD axes and its camera copies the
 * main camera's alpha / beta, so the cube turns exactly like the room. The zone
 * maths (cubeZones.ts, ADR-0014) speak the cube frame, where droite (+x) is the
 * audience's right at the Face pose: Babylon is left-handed, so that is world −x
 * (viewCube.ts, SIDE_SIGN = 1). Dessus / Face are world +y / +z.
 */
import { CREATION_TOKENS } from '../design/creationTokens'

const K = CREATION_TOKENS.cube

/** Layer of the cube's camera and meshes (bit 28): Babylon's default mask 0x0FFFFFFF never sees it. */
export const CUBE_LAYER = 0x10000000
/** Main camera mask: Babylon's default, i.e. every mesh except the cube's. */
export const MAIN_LAYER = 0x0fffffff

export interface XYZ {
  x: number
  y: number
  z: number
}

/** World point (cube mesh space) → cube frame (cubeZones.ts). */
export function worldToCube(p: XYZ): XYZ {
  return { x: -p.x === 0 ? 0 : -p.x, y: p.y, z: p.z }
}

/** Cube frame → world (the same mirror: it is its own inverse). */
export const cubeToWorld = worldToCube

/** C-a: 120 px, 130 px from a 1600 px wide window. */
export function cubeSizePx(windowWidth: number): 120 | 130 {
  return windowWidth >= K.wideFromPx ? (K.sizeWidePx as 130) : (K.sizePx as 120)
}

/**
 * The cube camera's Babylon viewport for a canvas of `w`×`h` CSS px: the square
 * `size` px, `margin` px from the canvas top-left. Babylon viewports are
 * normalised with the origin at the BOTTOM-left; clamped into [0, 1].
 */
export function cubeViewport(
  w: number,
  h: number,
  size: number,
  margin: number = K.marginPx
): { x: number; y: number; width: number; height: number } {
  const clamp = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)
  const x = clamp(margin / w)
  const width = clamp(Math.min(size / w, 1 - x))
  const top = clamp(margin / h)
  const height = clamp(Math.min(size / h, 1 - top))
  return { x, y: clamp(1 - top - height), width, height }
}
