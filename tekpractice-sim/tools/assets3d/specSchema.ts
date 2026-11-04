/**
 * assets3d/specSchema: the asset spec, one JSON per device or connector (content/asset-specs/<id>.json).
 * It is the measured side of the 3D pipeline: real size, where each port and control sits on the casing,
 * and where the numbers came from. The catalog (content/catalog.json) stays the source of ids; tools/assets3d/loadSpecs.ts
 * checks the two agree. Zod is the single source of truth for the shape, the types are inferred from it.
 *
 * Face-local coordinates: origin at the bottom-left of the face seen from OUTSIDE, x to the right, y up, in millimetres.
 * The face 'io' is the face the user plugs into. In GLB file space it sits at +Z (the app sees it at -Z after Babylon's
 * Z mirror); 'opposite' is the face at -Z in file space. On the 'top' and 'bottom' faces, y=0 is the I/O edge (the io-side edge).
 */
import { z } from 'zod'
import { BUILD_SHAPES } from './shapes'

const PositiveMm = z.number().finite().positive()
const CoordMm = z.number().finite().min(0)

export const Face = z.enum(['io', 'opposite', 'top', 'bottom', 'left', 'right']).describe(
  'A face of the casing. io = the face the user plugs into (in GLB file space it sits at +Z; the app sees it at -Z after Babylon\'s Z mirror), opposite = the face at -Z in file space. Coordinates are face-local: origin bottom-left seen from outside, x right, y up, in millimetres. On top and bottom faces, y=0 is the I/O edge (the io-side edge).',
)

export const SizeMm = z.object({
  w: PositiveMm,
  h: PositiveMm,
  d: PositiveMm,
}).strict().describe('Width x height x depth in millimetres, all strictly positive.')

export const PortSpec = z.object({
  portId: z.string().min(1).describe('Id of a port of the catalog device (checked by checkSpecParity).'),
  face: Face,
  xMm: CoordMm,
  yMm: CoordMm,
  confidence: z.enum(['manual', 'photo']).describe('manual = read from a manual or datasheet drawing; photo = read from a photo (a skeleton starts as photo, zeroed, for a human to fill).'),
  openingMm: PositiveMm.optional().describe('Diameter of the circular opening of the port, in millimetres (R3).'),
}).strict()

export const ControlSpec = z.object({
  controlId: z.string().min(1).describe('Id of a control of the catalog device (checked by checkSpecParity).'),
  kind: z.enum(['knob', 'fader', 'button', 'switch', 'led']),
  face: Face,
  xMm: CoordMm,
  yMm: CoordMm,
  axis: z.enum(['x', 'y', 'z']).describe('Axis the control moves or turns about / along.'),
  travelMm: PositiveMm.optional().describe('Linear travel of a fader or button, in millimetres.'),
  sizeMm: SizeMm,
}).strict()

export const Mating = z.object({
  role: z.enum(['plug', 'socket']),
  outerMm: PositiveMm.optional().describe('Outer diameter of the connector body, in millimetres.'),
  openingMm: PositiveMm.optional().describe('Diameter of the opening a plug goes into, in millimetres.'),
}).strict()

export const SpecSource = z.object({
  kind: z.enum(['manual', 'datasheet', 'photo']),
  url: z.string().min(1),
  note: z.string(),
}).strict()

export const BuildSpec = z.object({
  shape: z.enum(BUILD_SHAPES).describe('Shape the scripted builder makes for this asset (tools/assets3d/shapes.ts).'),
  params: z.record(z.string(), z.number().finite()).optional().describe('Extra shape dimensions in millimetres (names per shape in SHAPE_SPECS). Sizes come from realSizeMm, never from here.'),
}).strict().describe('Optional: how the scripted builder makes this asset (asset:build --scripted).')

export const AssetSpec = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'spec id must be a kebab-case slug'),
  kind: z.enum(['device', 'connector']),
  tier: z.enum(['hero', 'standard', 'connector']),
  realSizeMm: SizeMm,
  ports: z.array(PortSpec),
  controls: z.array(ControlSpec),
  mating: Mating.optional(),
  build: BuildSpec.optional(),
  sources: z.array(SpecSource),
}).strict()

export type FaceT = z.infer<typeof Face>
export type PortSpecT = z.infer<typeof PortSpec>
export type ControlSpecT = z.infer<typeof ControlSpec>
export type BuildSpecT = z.infer<typeof BuildSpec>
export type SpecSourceT = z.infer<typeof SpecSource>
export type AssetSpecT = z.infer<typeof AssetSpec>
