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

export const PART_KINDS = ['knob', 'button', 'fader', 'socket', 'screw', 'led', 'keys', 'slot', 'foot', 'rod', 'ball', 'ring', 'driver', 'prism'] as const
export type PartKind = (typeof PART_KINDS)[number]
export const SOCKET_TYPES = ['xlr', 'jack', 'trs', 'rca', 'bnc', 'usb', 'rj45', 'iec', 'powercon', 'speakon', 'din', 'ethercon', 'sfp', 'usbb', 'generic'] as const

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'colour must be #rrggbb')

/** The size parameters (millimetres unless stated) each kind understands. Unknown names are refused so a typo cannot silently do nothing. */
export const PART_PARAMS: Record<PartKind, readonly string[]> = {
  knob: ['diaMm', 'heightMm', 'collarDiaMm', 'collarHeightMm', 'knurl', 'pointer', 'angleDeg', 'bevelMm', 'taper', 'zMm', 'textured'],
  button: ['widthMm', 'heightMm', 'diaMm', 'riseMm', 'cornerMm', 'bevelMm', 'frameMm', 'wellMm', 'zMm', 'textured'],
  fader: ['slotLenMm', 'slotWidthMm', 'capWidthMm', 'capLenMm', 'capHeightMm', 'posFrac', 'bevelMm', 'horizontal', 'zMm', 'textured'],
  socket: ['diaMm', 'widthMm', 'heightMm', 'collarMm', 'riseMm', 'wellMm', 'pins', 'zMm', 'textured'],
  screw: ['diaMm', 'riseMm', 'zMm', 'textured'],
  led: ['diaMm', 'riseMm', 'widthMm', 'heightMm', 'zMm', 'textured'],
  keys: ['whiteCount', 'whitePitchMm', 'whiteLenMm', 'blackLenMm', 'blackWidthMm', 'riseMm', 'gapMm', 'startNote', 'dir', 'zMm', 'textured'],
  slot: ['lengthMm', 'widthMm', 'riseMm', 'horizontal', 'zMm', 'textured'],
  foot: ['diaMm', 'heightMm', 'zMm', 'textured'],
  rod: ['x1Mm', 'y1Mm', 'z1Mm', 'x2Mm', 'y2Mm', 'z2Mm', 'diaMm', 'segments', 'zMm', 'textured'],
  ball: ['diaMm', 'zMm', 'zMm', 'textured'],
  ring: ['diaMm', 'innerDiaMm', 'riseMm', 'floorMm', 'zMm', 'textured'],
  driver: ['diaMm', 'riseMm', 'capDiaMm', 'zMm', 'textured'],
  prism: ['riseMm', 'bevelMm', 'textured', 'zMm'],
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
  points: z.array(z.tuple([z.number().finite(), z.number().finite()])).min(3).max(32).optional().describe('prism only: the outline polygon in the local frame of the part, millimetres from the part origin (x right, y up on the face), extruded outwards by riseMm: a wedge-shaped end cheek, a sloped plate.'),
  type: z.enum(SOCKET_TYPES).optional().describe('socket only: the connector family drawn.'),
  params: z.record(z.string(), z.number().finite()).optional(),
  colour: Hex.optional().describe('Main colour of the part, sRGB, as on the real part (the builder lifts it for the scene).'),
  colour2: Hex.optional().describe('Second colour: knob pointer, fader cap line, socket well, LED lens...'),
  note: z.string().optional().describe('What this is on the real unit (reference for the reviewer), e.g. "fader cap, channels 1 to 8".'),
}).strict()

export const Structure = z.object({
  bodyHeightMm: z.number().finite().positive().optional().describe('Height of the BODY alone when the keys, knobs, faders or buttons stand above it and bring the overall height up to realSizeMm.h (a keyboard: the case is lower than the key tops). The shape is built at this height; the overall size gate still checks realSizeMm.'),
  bodyWidthMm: z.number().finite().positive().optional().describe('Width of the BODY alone when parts on the side faces (end cheeks, side frames) bring the overall width up to realSizeMm.w.'),
  bodyDepthMm: z.number().finite().positive().optional().describe('Depth of the BODY alone when parts on the front or rear faces bring the overall depth up to realSizeMm.d.'),
  topSeenFromFront: z.boolean().optional().describe('Measure the parts of the TOP face the way a photo or the player sees it: from above with the front edge at the bottom of the picture, x from the LEFT of that picture, y from the REAR edge (the top of the picture). The face-local frame of the sheet (x right seen from outside) has the io edge at the bottom, which mirrors left and right; with this flag the builder converts (x becomes the width minus x, keys run to the right).'),
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
    if (p.kind === 'prism' && p.points === undefined) errors.push(`${where}: a prism needs its points`)
    if (p.kind !== 'prism' && p.points !== undefined) errors.push(`${where}: only a prism has points`)
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
  /** The ray is cast at the centre of a wide part (a key row) so that its surface frame is not taken on an edge: the frame origin is moved back by this (face-local mm). */
  shiftMm?: [number, number]
  /** prism: the outline polygon, mm in the part's local frame. */
  points?: [number, number][]
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
      let xMm = p.xMm + col * (p.pitchXMm ?? 0)
      const yMm = p.yMm + row * (p.pitchYMm ?? 0)
      const mirror = spec.structure?.topSeenFromFront === true && p.face === 'top'
      if (mirror) xMm = spec.realSizeMm.w - xMm
      let rayX = xMm
      let rayY = yMm
      let shift: [number, number] | undefined
      if (p.kind === 'keys') {
        // a key row is wide: cast the ray at its middle so the surface frame is taken on the deck, not on an edge or a rounded corner
        const n = p.params?.whiteCount ?? 15
        const dxm = (n * (p.params?.whitePitchMm ?? 23.5)) / 2 * (mirror ? -1 : (p.params?.dir ?? 1) < 0 ? -1 : 1)
        const dym = (p.params?.whiteLenMm ?? 90) / 2
        rayX = xMm + dxm
        rayY = yMm + dym
        shift = [dxm, dym]
      }
      const { pos, outward } = onFace(p.face as FaceT, rayX / 1000, rayY / 1000, s)
      out.push({
        kind: p.kind,
        ...(p.type !== undefined ? { type: p.type } : {}),
        origin: [pos[0] + outward[0] * RAY_START_M, pos[1] + outward[1] * RAY_START_M, pos[2] + outward[2] * RAY_START_M],
        dir: [-outward[0], -outward[1], -outward[2]],
        xAxis: axes.x,
        yAxis: axes.y,
        params: { ...(p.kind === 'keys' && mirror ? { dir: -1 } : {}), ...(p.params ?? {}) },
        ...(p.points ? { points: p.points } : {}),
        ...(shift ? { shiftMm: shift } : {}),
        ...(p.colour ? { colour: p.colour } : {}),
        ...(p.colour2 ? { colour2: p.colour2 } : {}),
        part: index,
      })
    }
  })
  return out
}

/** The area a part covers on its face, face-local millimetres (centre and size): where a PRINTED copy of the part in a reference photo must be painted out. */
export interface Footprint { shape: 'circle' | 'rect'; cx: number; cy: number; w: number; h: number }

/** Footprints of every part instance on `face` (the same positions the builder places, including the top-face mirror of topSeenFromFront). */
export function partFootprints(spec: AssetSpecT, face: FaceT): Footprint[] {
  const out: Footprint[] = []
  ;(spec.structure?.parts ?? []).forEach((p) => {
    if (p.face !== face) return
    const count = p.count ?? 1
    const cols = p.cols ?? count
    const mirror = spec.structure?.topSeenFromFront === true && face === 'top'
    const prm = p.params ?? {}
    const g = (name: string, d: number): number => prm[name] ?? d
    if ((prm.textured ?? 0) > 0) return   // a textured part shows the printed picture itself: nothing to paint out
    for (let i = 0; i < count; i++) {
      let x = p.xMm + (i % cols) * (p.pitchXMm ?? 0)
      const y = p.yMm + Math.floor(i / cols) * (p.pitchYMm ?? 0)
      if (mirror) x = spec.realSizeMm.w - x
      switch (p.kind) {
        case 'knob': out.push({ shape: 'circle', cx: x, cy: y, w: Math.max(g('diaMm', 18), g('collarDiaMm', 0)) + 1, h: 0 }); break
        case 'button': {
          const dia = g('diaMm', 0)
          const fr = 2 * g('frameMm', 0)
          if (dia > 0) out.push({ shape: 'circle', cx: x, cy: y, w: dia + fr + 1, h: 0 })
          else out.push({ shape: 'rect', cx: x, cy: y, w: g('widthMm', 9) + fr + 1, h: g('heightMm', 6) + fr + 1 })
          break
        }
        case 'fader': {
          const len = g('slotLenMm', 100)
          const wid = Math.max(g('slotWidthMm', 3) + 2, g('capWidthMm', 10))
          out.push(g('horizontal', 0) > 0 ? { shape: 'rect', cx: x, cy: y, w: len + 2, h: wid + 2 } : { shape: 'rect', cx: x, cy: y, w: wid + 2, h: len + 2 })
          break
        }
        case 'socket': {
          const col = g('collarMm', 1.4)
          const dia = prm.diaMm
          if (dia !== undefined || ['xlr', 'jack', 'trs', 'rca', 'bnc', 'powercon', 'speakon', 'din', 'ethercon'].includes(p.type ?? '')) {
            const d = dia ?? ({ xlr: 19.5, jack: 9.5, trs: 7, rca: 8, bnc: 10, powercon: 24, speakon: 24, din: 15, ethercon: 24 } as Record<string, number>)[p.type ?? ''] ?? 10
            out.push({ shape: 'circle', cx: x, cy: y, w: d + 2 * col + 1, h: 0 })
          } else {
            const defaults: Record<string, [number, number]> = { usbb: [12, 11], usb: [12, 4.6], rj45: [14, 13], iec: [27, 19], sfp: [14, 9], generic: [10, 6] }
            const [dw, dh] = defaults[p.type ?? 'generic'] ?? [10, 6]
            out.push({ shape: 'rect', cx: x, cy: y, w: g('widthMm', dw) + 2 * col + 1, h: g('heightMm', dh) + 2 * col + 1 })
          }
          break
        }
        case 'keys': {
          const n = g('whiteCount', 15)
          const pitch = g('whitePitchMm', 23.5)
          const dir = g('dir', mirror ? -1 : 1) < 0 ? -1 : 1
          const len = g('whiteLenMm', 90)
          out.push({ shape: 'rect', cx: x + (dir * n * pitch) / 2, cy: y + len / 2, w: n * pitch, h: len })
          break
        }
        case 'screw': case 'led': out.push({ shape: 'circle', cx: x, cy: y, w: (g('diaMm', p.kind === 'screw' ? 3 : 2.5)) + 1, h: 0 }); break
        case 'slot': out.push(g('horizontal', 0) > 0 ? { shape: 'rect', cx: x, cy: y, w: g('lengthMm', 40), h: g('widthMm', 3) } : { shape: 'rect', cx: x, cy: y, w: g('widthMm', 3), h: g('lengthMm', 40) }); break
        case 'driver': case 'ring': out.push({ shape: 'circle', cx: x, cy: y, w: g('diaMm', 30), h: 0 }); break
        default: break
      }
    }
  })
  return out
}

/**
 * Paints out, in a face picture (the whole face, y up from the bottom edge), the printed copies of the parts the structure sheet models: each footprint is filled with the
 * colour of the picture just outside it (a ring a few pixels wide), so a printed knob under the modelled knob never shows. Labels and legends outside the footprints stay.
 * Returns PNG bytes; the picture keeps its size.
 */
export async function maskPartsInPicture(png: Uint8Array, faceMm: { w: number; h: number }, footprints: Footprint[]): Promise<Uint8Array> {
  if (footprints.length === 0) return png
  const sharp = (await import('sharp')).default
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const W = info.width
  const H = info.height
  const k = W / faceMm.w
  const at = (x: number, y: number): [number, number, number] => {
    const xi = Math.max(0, Math.min(W - 1, Math.round(x)))
    const yi = Math.max(0, Math.min(H - 1, Math.round(y)))
    const o = (yi * W + xi) * 3
    return [data[o], data[o + 1], data[o + 2]]
  }
  const out = Buffer.from(data)
  for (const f of footprints) {
    const cx = f.cx * k
    const cy = H - f.cy * k
    const hw = (f.w * k) / 2
    const hh = (f.shape === 'circle' ? f.w : f.h) * k / 2
    // the colour just outside: sample 24 points on the outline, 4 px out
    const samples: [number, number, number][] = []
    for (let s = 0; s < 24; s++) {
      const a = (2 * Math.PI * s) / 24
      const ex = f.shape === 'circle' ? Math.cos(a) * (hw + 4) : Math.max(-1, Math.min(1, Math.cos(a) * 1.5)) * (hw + 4)
      const ey = f.shape === 'circle' ? Math.sin(a) * (hh + 4) : Math.max(-1, Math.min(1, Math.sin(a) * 1.5)) * (hh + 4)
      samples.push(at(cx + ex, cy + ey))
    }
    const mean = [0, 1, 2].map((c) => Math.round(samples.reduce((acc, p) => acc + p[c], 0) / samples.length))
    const x0 = Math.max(0, Math.floor(cx - hw))
    const x1 = Math.min(W - 1, Math.ceil(cx + hw))
    const y0 = Math.max(0, Math.floor(cy - hh))
    const y1 = Math.min(H - 1, Math.ceil(cy + hh))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (f.shape === 'circle' && ((x - cx) / hw) ** 2 + ((y - cy) / hh) ** 2 > 1) continue
        const o = (y * W + x) * 3
        out[o] = mean[0]; out[o + 1] = mean[1]; out[o + 2] = mean[2]
      }
    }
  }
  return new Uint8Array(await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer())
}
