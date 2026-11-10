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
  insetMm: z.number().finite().min(0).max(200).optional().describe('How far behind the bounding-box face the real jack sits, in millimetres: a connector panel recessed into a speaker cabinet. The port node is placed that far inside the face plane (default 0 = on it).'),
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

/** One lathe station: [position along the axis from the base in mm, diameter in mm]. */
const Station = z.tuple([z.number().finite(), z.number().finite().min(0)])
/** A colour zone of a revolved shape: from `fromMm` along the axis up to the next zone. sRGB hex, as on the real part. */
const ZoneColour = z.object({
  fromMm: z.number().finite().min(0),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'colour must be #rrggbb'),
}).strict()

const ProjectionFaceEnum = z.enum(['io', 'opposite', 'top', 'left', 'wrap'])

export const BuildSpec = z.object({
  shape: z.enum(BUILD_SHAPES).describe('Shape the scripted builder makes for this asset (tools/assets3d/shapes.ts).'),
  params: z.record(z.string(), z.number().finite()).optional().describe('Extra shape dimensions in millimetres (names per shape in SHAPE_SPECS). Sizes come from realSizeMm, never from here.'),
  profile: z.array(Station).min(4).optional().describe('Shape revolve only: the lathe profile, at least four [axial mm from the base, diameter mm] stations with strictly increasing positions; first at 0, last at the height, widest = the width.'),
  colours: z.array(ZoneColour).min(1).optional().describe('Shape revolve only: colour zones along the axis (first at 0, strictly increasing), sRGB hex of the real part.'),
  projection: z.union([ProjectionFaceEnum, z.array(ProjectionFaceEnum).min(1).max(4)]).optional().describe('The face(s) that take their picture from a Meshy model (asset:build --scripted --project <fixed.glb>); default io. Each picture is mapped planar onto the scripted faces that look that way; a face given twice or two faces looking the same way is refused.'),
  projectionShiftMm: z.object({ io: z.number().finite(), opposite: z.number().finite(), top: z.number().finite(), left: z.number().finite() }).partial().strict().optional().describe("Millimetres to move the picture of a projected face sideways (face-local x, positive = right) before it is mapped: for a cabinet whose real panel sits where the Meshy model has it off-centre, so the picture moves with the ports."),
}).strict().superRefine((b, ctx) => {
  const { profile, colours } = b
  profile?.forEach((st, i) => {
    if (i > 0 && !(st[0] > profile[i - 1][0])) ctx.addIssue({ code: 'custom', path: ['profile', i, 0], message: `station positions must strictly increase (${st[0]} after ${profile[i - 1][0]})` })
  })
  colours?.forEach((c, i) => {
    if (i === 0 && c.fromMm !== 0) ctx.addIssue({ code: 'custom', path: ['colours', 0, 'fromMm'], message: 'the first colour zone must start at 0' })
    if (i > 0 && !(c.fromMm > colours[i - 1].fromMm)) ctx.addIssue({ code: 'custom', path: ['colours', i, 'fromMm'], message: 'colour zones must strictly increase' })
  })
}).describe('Optional: how the scripted builder makes this asset (asset:build --scripted).')

/** A height band of a textured model whose printing (brand text, logos) is repainted away (tools/assets3d/blank.ts). */
const BlankBand = z.object({
  fromMm: z.number().finite().min(0),
  toMm: z.number().finite().min(0),
  fill: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'fill must be #rrggbb').optional().describe('Colour of the repainted texels; absent = the median colour of the faces just outside the band.'),
}).strict().refine((b) => b.toMm > b.fromMm, { message: 'a band must have toMm greater than fromMm' })

/** A rectangle on a face of a textured model whose printing is repainted: face-local millimetres, like the ports. */
const BlankRect = z.object({
  face: Face,
  xMm: CoordMm,
  yMm: CoordMm,
  wMm: PositiveMm,
  hMm: PositiveMm,
  depthMm: PositiveMm.optional().describe('How far behind the face plane a covered face may lie (default 40, at most 40 percent of the casing thickness): a logo on a recessed plate.'),
  marginMm: PositiveMm.optional().describe('Width of the ring around the rectangle that the automatic fill samples (default 8).'),
  fill: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'fill must be #rrggbb').optional().describe('Colour of the repainted texels; absent = the median colour of the faces just around the rectangle.'),
}).strict()

export const TextureSpec = z.object({
  blankBandsMm: z.array(BlankBand).min(1).optional().describe('Height bands, in millimetres from the base of the upright model, where the colour map is repainted: removes brand text and logos that run around a mic or a stand.'),
  blankRects: z.array(BlankRect).min(1).optional().describe('Rectangles on a face (face-local millimetres, like the ports) where the colour map is repainted: removes a logo on a panel.'),
}).strict().refine((t) => t.blankBandsMm !== undefined || t.blankRects !== undefined, { message: 'a texture block needs blankBandsMm or blankRects' })
  .describe('Optional: how the colour map of a textured (Meshy) model is cleaned.')

export const AssetSpec = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'spec id must be a kebab-case slug'),
  kind: z.enum(['device', 'connector']),
  tier: z.enum(['hero', 'standard', 'connector']),
  realSizeMm: SizeMm,
  ports: z.array(PortSpec),
  controls: z.array(ControlSpec),
  mating: Mating.optional(),
  build: BuildSpec.optional(),
  texture: TextureSpec.optional(),
  driftLimit: z.number().finite().gt(0).max(0.35).optional().describe('Proportion drift the fix-up may absorb, as a fraction (default 0.05). A Meshy model whose depth was guessed from front photos (a speaker cabinet) may need more; the founder accepts it per device.'),
  sources: z.array(SpecSource),
}).strict()

export type FaceT = z.infer<typeof Face>
export type PortSpecT = z.infer<typeof PortSpec>
export type ControlSpecT = z.infer<typeof ControlSpec>
export type BuildSpecT = z.infer<typeof BuildSpec>
export type TextureSpecT = z.infer<typeof TextureSpec>
export type SpecSourceT = z.infer<typeof SpecSource>
export type AssetSpecT = z.infer<typeof AssetSpec>
