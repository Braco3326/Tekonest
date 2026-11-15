/**
 * assets3d/structure: the structure sheet of a device, as geometry. A spec's `structure.parts` lists the real parts of the equipment that must be MODELLED,
 * not printed: knobs (collar, knurl, pointer), faders (slot and cap), buttons (proud, in a frame), ports (collar, dark well, pins), screws, LEDs, keys, feet.
 * A photo is allowed only for printed graphics and labels. Each part sits on a face of the casing at a face-local (x, y) and may repeat (a row of faders, a grid
 * of buttons): `count`, `cols`, `pitchXMm`, `pitchYMm`. This module checks the sheet (zod) and expands it into the instances the Blender builder places
 * (tools/assets3d/blender/build_from_spec.py apply_structure): origin outside the face plane and the inward ray direction in GLB space (metres), the face axes, and
 * the part's size parameters. The builder ray-casts onto the body so a part follows a slope or a curve.
 */
import { z } from 'zod'
import { FACE_AXES, onFace } from './placement'
import type { AssetSpecT, FaceT } from './specSchema'

export const PART_KINDS = ['knob', 'button', 'fader', 'socket', 'screw', 'led', 'keys', 'slot', 'foot', 'rod', 'ball', 'ring', 'driver'] as const
export type PartKind = (typeof PART_KINDS)[number]
export const SOCKET_TYPES = ['xlr', 'jack', 'trs', 'rca', 'bnc', 'usb', 'rj45', 'iec', 'powercon', 'speakon', 'din', 'ethercon', 'sfp', 'generic'] as const

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'colour must be #rrggbb')

/** The size parameters (millimetres unless stated) each kind understands. Unknown names are refused so a typo cannot silently do nothing. */
export const PART_PARAMS: Record<PartKind, readonly string[]> = {
  knob: ['diaMm', 'heightMm', 'collarDiaMm', 'collarHeightMm', 'knurl', 'pointer', 'angleDeg', 'bevelMm', 'taper'],
  button: ['widthMm', 'heightMm', 'diaMm', 'riseMm', 'cornerMm', 'bevelMm', 'frameMm', 'wellMm'],
  fader: ['slotLenMm', 'slotWidthMm', 'capWidthMm', 'capLenMm', 'capHeightMm', 'posFrac', 'bevelMm', 'horizontal'],
  socket: ['diaMm', 'widthMm', 'heightMm', 'collarMm', 'riseMm', 'wellMm', 'pins'],
  screw: ['diaMm', 'riseMm'],
  led: ['diaMm', 'riseMm', 'widthMm', 'heightMm'],
  keys: ['whiteCount', 'whitePitchMm', 'whiteLenMm', 'blackLenMm', 'blackWidthMm', 'riseMm', 'gapMm', 'startNote'],
  slot: ['lengthMm', 'widthMm', 'riseMm', 'horizontal'],
  foot: ['diaMm', 'heightMm'],
  rod: ['x1Mm', 'y1Mm', 'z1Mm', 'x2Mm', 'y2Mm', 'z2Mm', 'diaMm', 'segments'],
  ball: ['diaMm', 'zMm'],
  ring: ['diaMm', 'innerDiaMm', 'riseMm', 'floorMm'],
  driver: ['diaMm', 'riseMm', 'capDiaMm'],
}

export const StructurePart = z.object({
  kind: z.enum(PART_KINDS),
  face: z.enum(['io', 'opposite', 'top', 'bottom', 'left', 'right']),
  xMm: z.number().finite().min(0),
  yMm: z.number().finite().min(0),
  count: z.number().int().min(1).max(256).optional().describe('How many instances (default 1): a row or, with cols, a grid.'),
  cols: z.number().int().min(1).max(256).optional().describe('Instances per row (default count: one row). Instance i sits at column i % cols, row floor(i / cols).'),
  pitchXMm: z.number().finite().optional().describe('Step along face x between columns (default 0).'),
  pitchYMm: z.number().finite().optional().describe('Step along face y between rows (default 0).'),
  type: z.enum(SOCKET_TYPES).optional().describe('socket only: the connector family drawn.'),
  params: z.record(z.string(), z.number().finite()).optional(),
  colour: Hex.optional().describe('Main colour of the part, sRGB, as on the real part (the builder lifts it for the scene).'),
  colour2: Hex.optional().describe('Second colour: knob pointer, fader cap line, socket well, LED lens...'),
  note: z.string().optional().describe('What this is on the real unit (reference for the reviewer), e.g. "fader cap, channels 1 to 8".'),
}).strict()

export const Structure = z.object({
  bodyHeightMm: z.number().finite().positive().optional().describe('Height of the BODY alone when the keys, knobs, faders or buttons stand above it and bring the overall height up to realSizeMm.h (a keyboard: the case is lower than the key tops). The shape is built at this height; the overall size gate still checks realSizeMm.'),
  parts: z.array(StructurePart).min(1).max(160),
}).strict()
export type StructureT = z.infer<typeof Structure>
export type StructurePartT = z.infer<typeof StructurePart>

/** Errors of a structure sheet that zod cannot see: unknown parameter names, a socket without type, too many instances. */
export function validateStructure(spec: AssetSpecT): string[] {
  const errors: string[] = []
  const parts = spec.structure?.parts ?? []
  let total = 0
  parts.forEach((p, i) => {
    const where = `${spec.id}: structure.parts[${i}] (${p.kind} on ${p.face})`
    for (const name of Object.keys(p.params ?? {})) if (!PART_PARAMS[p.kind].includes(name)) errors.push(`${where}: no param '${name}' (allowed: ${PART_PARAMS[p.kind].join(', ')})`)
    if (p.kind === 'socket' && p.type === undefined) errors.push(`${where}: a socket needs its type`)
    if (p.kind !== 'socket' && p.type !== undefined) errors.push(`${where}: only a socket has a type`)
    if (p.kind === 'foot' && p.face !== 'bottom') errors.push(`${where}: a foot sits on the bottom face`)
    total += p.count ?? 1
  })
  if (total > 600) errors.push(`${spec.id}: ${total} part instances, the budget is 600 (use fewer or merge into rows)`)
  return errors
}

/** One placed instance, in GLB space, metres (the builder converts to Blender space). */
export interface PartInstance {
  kind: PartKind
  type?: string
  /** Outside the face plane (pulled out along the outward normal) so that the ray starts outside the body. */
  origin: [number, number, number]
  /** Inward ray direction (the opposite of the face's outward normal). */
  dir: [number, number, number]
  xAxis: [number, number, number]
  yAxis: [number, number, number]
  params: Record<string, number>
  colour?: string
  colour2?: string
  /** Index in the sheet, for messages. */
  part: number
}

const RAY_START_M = 0.5

/** Expands the structure sheet into instances (row-major over cols). */
export function expandStructure(spec: AssetSpecT): PartInstance[] {
  const out: PartInstance[] = []
  const s = { w: spec.realSizeMm.w / 1000, h: spec.realSizeMm.h / 1000, d: spec.realSizeMm.d / 1000 }
  ;(spec.structure?.parts ?? []).forEach((p, index) => {
    const count = p.count ?? 1
    const cols = p.cols ?? count
    const axes = FACE_AXES[p.face as FaceT]
    for (let i = 0; i < count; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const xMm = p.xMm + col * (p.pitchXMm ?? 0)
      const yMm = p.yMm + row * (p.pitchYMm ?? 0)
      const { pos, outward } = onFace(p.face as FaceT, xMm / 1000, yMm / 1000, s)
      out.push({
        kind: p.kind,
        ...(p.type !== undefined ? { type: p.type } : {}),
        origin: [pos[0] + outward[0] * RAY_START_M, pos[1] + outward[1] * RAY_START_M, pos[2] + outward[2] * RAY_START_M],
        dir: [-outward[0], -outward[1], -outward[2]],
        xAxis: axes.x,
        yAxis: axes.y,
        params: { ...(p.params ?? {}) },
        ...(p.colour ? { colour: p.colour } : {}),
        ...(p.colour2 ? { colour2: p.colour2 } : {}),
        part: index,
      })
    }
  })
  return out
}
