/**
 * assets3d/shapes: the shape table of the scripted builder (tools/assets3d/blender/build_from_spec.py) and the check of
 * a spec's optional `build` block. Each shape works for one kind (device or connector), accepts a fixed set of numeric
 * params and may need the connector's mating diameter (`mating.outerMm`). The Python registry must list exactly
 * BUILD_SHAPES (a test compares the two), so the zod enum and the script cannot drift.
 *
 * No runtime imports: specSchema.ts imports BUILD_SHAPES from here, so this file only takes the spec type.
 */
import type { AssetSpecT } from './specSchema'

/** Every shape the builder knows. Grows by one entry each time a later wave adds a shape. */
export const BUILD_SHAPES = ['cylinder-plug', 'trs-plug', 'rj45-plug', 'rack-box', 'stagebox-rio3224', 'revolve', 'console-wedge', 'speaker-cabinet', 'boom-arm', 'cable-assembly', 'xlr-male-plug', 'iec-inlet', 'iec-cable', 'schuko-plug', 'schuko-socket', 'locking-plug', 'usb-plug', 'dsub-plug', 'terminal-block', 'coax-plug', 'toslink-plug', 'ethercon-plug', 'curved-cabinet'] as const
export type BuildShape = (typeof BUILD_SHAPES)[number]

export interface ShapeSpec {
  /** The asset kind the shape builds. */
  kind: 'device' | 'connector'
  /** Names of the numeric params the shape accepts (all optional, defaults live in the Python builder). */
  params: readonly string[]
  /** True when the shape needs `mating.outerMm` (the diameter of the mating end). */
  needsMatingOuter: boolean
  /** True when the shape is driven by a lathe `profile` (and takes optional `colours`); every other shape takes neither. */
  usesProfile?: boolean
  /** How the profile reads: 'lathe' = [axial position, diameter] (revolve), 'side' = [depth from the io face, height] (console-wedge). */
  profileKind?: 'lathe' | 'side'
  /** True when the builder also needs the spec's ports (it cuts a pocket behind each inset port): runBuilder then puts them in plan.json. */
  usesPorts?: boolean
}

export const SHAPE_SPECS: Record<BuildShape, ShapeSpec> = {
  'cylinder-plug': { kind: 'connector', params: ['frontLenMm', 'pins'], needsMatingOuter: true },
  // An XLR male cable plug (hollow 19 mm shell with the pins inside): pins = 3 or 5. The mating face is at z = 0 like every connector.
  'xlr-male-plug': { kind: 'connector', params: ['pins'], needsMatingOuter: false },
  'trs-plug': { kind: 'connector', params: ['barrelMm', 'zScale', 'poles'], needsMatingOuter: true },
  'rj45-plug': { kind: 'connector', params: [], needsMatingOuter: false },
  'rack-box': { kind: 'device', params: ['chamferMm'], needsMatingOuter: false },
  // The Yamaha Rio3224-D2 stage box: layout (connector grid, panel plates) is in the builder, only datasheet sizes are params.
  'stagebox-rio3224': { kind: 'device', params: ['earMm', 'flangeDepthMm', 'frontStepMm', 'rearStepMm'], needsMatingOuter: false },
  // A surface of revolution about the vertical axis from a measured profile (microphones, later stands and lamps).
  revolve: { kind: 'device', params: ['segments'], needsMatingOuter: false, usesProfile: true, profileKind: 'lathe' },
  // A console or any wedge-shaped casing: the side profile [depth from the io face mm, height mm] extruded across the width, edges chamfered.
  'console-wedge': { kind: 'device', params: ['chamferMm'], needsMatingOuter: false, usesProfile: true, profileKind: 'side' },
  // A loudspeaker cabinet: a hexagon in plan (full width at the baffle, midWidthMm where the rear taper starts taperDepthMm from the io face,
  // rearWidthMm at the io face; mid and rear default to the width, rear to the mid width, so a plain box or trapezoid needs fewer params),
  // bevelled, with a round pocket cut into the io face behind each port that has an insetMm (depth = the inset, diameter = openingMm or 24 mm).
  'speaker-cabinet': { kind: 'device', params: ['chamferMm', 'bevelSegments', 'midWidthMm', 'rearWidthMm', 'taperDepthMm'], needsMatingOuter: false, usesPorts: true },
  // An articulated microphone arm in a POSED side view (x along the width, y up, tubes in the plane z = 0): a column on a threaded rod, a shoulder joint
  // at its top, a tube up to a raised elbow (elbowDxMm to the right and elbowDyMm above the shoulder), a second tube down to the head (headDxMm to the
  // right and headDyMm BELOW the elbow), and a head with a mic post hanging headDropMm below it. The width is the column diameter (d). All params in mm.
  'boom-arm': { kind: 'device', params: ['elbowDxMm', 'elbowDyMm', 'headDxMm', 'headDyMm', 'tubeDiaMm', 'jointDiaMm', 'columnHeightMm', 'rodLenMm', 'headDropMm'], needsMatingOuter: false },
  // A cable assembly along z: a D-sub hood with a strain relief at the io end (+z), a trunk, and a fan-out of columns x rows XLR male plugs on a
  // pitchMm grid whose tips form the opposite face (-z). The width and height come from the plug grid, the depth is the whole length.
  'cable-assembly': { kind: 'device', params: ['hoodWidthMm', 'hoodHeightMm', 'hoodLenMm', 'plugDiaMm', 'plugLenMm', 'tailLenMm', 'trunkDiaMm', 'pitchMm', 'columns', 'rows'], needsMatingOuter: false },
  // Mains and twist-lock connectors, mating face at z = 0 (sizes in spec.realSizeMm, nothing else needs a param except the locking plug).
  'iec-inlet': { kind: 'connector', params: [], needsMatingOuter: false },
  'iec-cable': { kind: 'connector', params: [], needsMatingOuter: false },
  'schuko-plug': { kind: 'connector', params: [], needsMatingOuter: false },
  'schuko-socket': { kind: 'connector', params: [], needsMatingOuter: false },
  // A Neutrik twist-lock round cable connector (speakON, powerCON): contacts = 3 or 4 holes in the face, colour = 1 black, 2 blue, 3 grey housing.
  'locking-plug': { kind: 'connector', params: ['contacts', 'colour'], needsMatingOuter: false },
  // A USB cable plug: type = 1 Standard-A, 2 USB 2 Standard-B, 3 Type-C (published shell sizes, black overmould, boot).
  'usb-plug': { kind: 'connector', params: ['type'], needsMatingOuter: false },
  // A 25-pin D-sub male cable plug (shell size B): sizes in the spec, nothing else.
  'dsub-plug': { kind: 'connector', params: [], needsMatingOuter: false },
  // A pluggable screw-terminal block: poles and pitchHundredthsMm (508 = 5.08 mm); width = poles x pitch + 2 mm.
  'terminal-block': { kind: 'connector', params: ['poles', 'pitchHundredthsMm'], needsMatingOuter: false },
  // A coaxial cable plug: type = 1 BNC, 2 RCA.
  'coax-plug': { kind: 'connector', params: ['type'], needsMatingOuter: false },
  'toslink-plug': { kind: 'connector', params: [], needsMatingOuter: false },
  // A Neutrik etherCON cable connector: an RJ45 head in a round shell with a latch lever.
  'ethercon-plug': { kind: 'connector', params: [], needsMatingOuter: false },
  // A loudspeaker cabinet with a CURVED plan and filleted top and bottom edges (die-cast monitors, moulded PA boxes): a rounded polygon in plan
  // (baffle corners planFrontMm apart, the sides bulge sideBulgeMm to their widest point midDepthMm behind the baffle (or midWidthMm apart there: a cabinet that tapers from the front), taper to rearWidthMm at the
  // rear; corners rounded by frontRadiusMm, sideRadiusMm and backRadiusMm), extruded with an elliptic fillet of edgeRadiusMm (horizontal) by
  // edgeDropMm (vertical) in edgeSegments steps on the top and the bottom; barrelMm makes the sides a shallow arc in elevation (widest at barrelCentreMm,
  // barrelMm narrower on each side at the farther end of the height); footMm adds a rubber pad (footWidthMm x footDepthMm) under the body, which then starts footMm
  // above the base; bodyGrey (20 to 200) sets the grey of the body's untextured faces. The baffle may bow forward crownMm. Optional round recesses on the
  // baffle (a woofer ring and a tweeter ring with an optional conical waveguide dish) and a round pocket cut into the rear face behind each port
  // that has an insetMm, as in speaker-cabinet. The builder measures the fillet it built (min of the two radii) for the 'fillet' gate.
  'curved-cabinet': {
    kind: 'device',
    params: ['planFrontMm', 'sideBulgeMm', 'midWidthMm', 'rearWidthMm', 'midDepthMm', 'frontRadiusMm', 'sideRadiusMm', 'backRadiusMm', 'edgeRadiusMm', 'edgeDropMm', 'edgeSegments', 'crownMm', 'barrelMm', 'barrelCentreMm', 'footMm', 'footWidthMm', 'footDepthMm', 'bodyGrey', 'wooferRingMm', 'wooferYMm', 'tweeterRingMm', 'tweeterYMm', 'ringDepthMm', 'waveguideMm', 'waveguideDepthMm'],
    needsMatingOuter: false,
    usesPorts: true,
  },
}

/** Default diameter of a socket pocket when the port gives no openingMm, in millimetres (the builder uses the same). */
export const POCKET_DEFAULT_MM = 24

/**
 * Checks the `build` block of `spec`. Returns one message per problem (empty = ok, also when there is no build block).
 * Messages name the asset id, the shape and the param so a typo is found at once.
 */
/** How far a profile may be off the spec size, in mm (the fix-up rescales anyway; this keeps the shape honest). */
const PROFILE_TOL_MM = 0.05

export function validateBuild(spec: AssetSpecT): string[] {
  const build = spec.build
  if (!build) return []
  const shape = SHAPE_SPECS[build.shape]
  const errors: string[] = []

  if (shape.kind !== spec.kind) {
    // The other checks are moot for a shape of the wrong kind.
    return [`${spec.id}: build shape '${build.shape}' builds a ${shape.kind}, but this asset is a ${spec.kind}`]
  }
  for (const [name, value] of Object.entries(build.params ?? {})) {
    if (!shape.params.includes(name)) {
      const allowed = shape.params.length > 0 ? shape.params.join(', ') : '(none)'
      errors.push(`${spec.id}: build shape '${build.shape}' has no param '${name}' (allowed: ${allowed})`)
    } else if (!Number.isFinite(value) || value <= 0) {
      errors.push(`${spec.id}: build param '${name}' of shape '${build.shape}' must be a positive number, got ${String(value)}`)
    }
  }
  const size = spec.realSizeMm
  if (!shape.usesProfile) {
    if (build.profile !== undefined || build.colours !== undefined) {
      errors.push(`${spec.id}: build shape '${build.shape}' takes no profile or colours (only revolve does)`)
    }
  } else if (build.profile === undefined) {
    errors.push(shape.profileKind === 'side'
      ? `${spec.id}: build shape '${build.shape}' needs a profile (at least four [depth from the io face mm, height mm] stations)`
      : `${spec.id}: build shape '${build.shape}' needs a profile (at least four [position mm, diameter mm] stations)`)
  } else if (shape.profileKind === 'side') {
    const profile = build.profile
    const first = profile[0][0]
    const last = profile[profile.length - 1][0]
    const tallest = Math.max(...profile.map((st) => st[1]))
    if (build.colours !== undefined) errors.push(`${spec.id}: build shape '${build.shape}' takes no colours (only revolve does)`)
    if (Math.abs(first) > PROFILE_TOL_MM) errors.push(`${spec.id}: the first station must be at 0 (the io face), got ${first} mm`)
    if (Math.abs(last - size.d) > PROFILE_TOL_MM) errors.push(`${spec.id}: the last station must be at the depth ${size.d} mm (the front edge), got ${last} mm`)
    if (Math.abs(tallest - size.h) > PROFILE_TOL_MM) errors.push(`${spec.id}: the tallest station (${tallest} mm) must equal the height ${size.h} mm`)
    profile.forEach((st, i) => {
      if (!(st[1] > 0)) errors.push(`${spec.id}: station ${i} has a height of ${st[1]} mm: every height must be positive`)
    })
  } else {
    const profile = build.profile
    if (Math.abs(size.w - size.d) > PROFILE_TOL_MM) {
      errors.push(`${spec.id}: a revolved shape needs a round footprint: w (${size.w} mm) must equal d (${size.d} mm)`)
    }
    const first = profile[0][0]
    const last = profile[profile.length - 1][0]
    const widest = Math.max(...profile.map((st) => st[1]))
    if (Math.abs(first) > PROFILE_TOL_MM) errors.push(`${spec.id}: the first station must be at 0 (the base), got ${first} mm`)
    if (Math.abs(last - size.h) > PROFILE_TOL_MM) errors.push(`${spec.id}: the last station must be at the height ${size.h} mm, got ${last} mm`)
    if (Math.abs(widest - size.w) > PROFILE_TOL_MM) errors.push(`${spec.id}: the widest station (${widest} mm) must equal the width ${size.w} mm`)
    for (const c of build.colours ?? []) {
      if (c.fromMm > size.h) errors.push(`${spec.id}: a colour zone at ${c.fromMm} mm is beyond the height ${size.h} mm`)
    }
    const segments = build.params?.segments
    if (segments !== undefined && !(Number.isInteger(segments) && segments >= 12 && segments <= 64 && segments % 4 === 0)) {
      errors.push(`${spec.id}: param 'segments' must be a whole number from 12 to 64 and a multiple of 4 (so the box is exact), got ${segments}`)
    }
  }
  if (build.shape === 'speaker-cabinet') errors.push(...validateSpeakerCabinet(spec))
  if (build.shape === 'curved-cabinet') errors.push(...validateCurvedCabinet(spec))
  if (shape.needsMatingOuter && spec.mating?.outerMm === undefined) {
    errors.push(`${spec.id}: build shape '${build.shape}' needs mating.outerMm (the diameter of the mating end)`)
  }
  return errors
}

/** The checks of a speaker-cabinet: plan widths, taper, bevel, and that every socket pocket fits in the flat rear face. */
function validateSpeakerCabinet(spec: AssetSpecT): string[] {
  const errors: string[] = []
  const { w, h, d } = spec.realSizeMm
  const p = spec.build?.params ?? {}
  const chamfer = p.chamferMm ?? 1
  const mid = p.midWidthMm ?? w
  const rear = p.rearWidthMm ?? mid
  const taper = p.taperDepthMm
  if (mid > w) errors.push(`${spec.id}: midWidthMm (${mid}) cannot be wider than the width ${w} mm`)
  if (rear > mid) errors.push(`${spec.id}: rearWidthMm (${rear}) cannot be wider than midWidthMm (${mid})`)
  else if (rear <= 4 * chamfer) errors.push(`${spec.id}: rearWidthMm (${rear}) must be more than four times the bevel (chamferMm ${chamfer})`)
  if (rear < mid && taper === undefined) errors.push(`${spec.id}: a rear narrower than the middle needs taperDepthMm (how far from the io face the sides start to narrow)`)
  if (rear >= mid && taper !== undefined) errors.push(`${spec.id}: taperDepthMm (${taper}) has no effect when rearWidthMm is not narrower than midWidthMm`)
  if (taper !== undefined && taper >= d) errors.push(`${spec.id}: taperDepthMm (${taper}) must be less than the depth ${d} mm`)
  const segments = p.bevelSegments
  if (segments !== undefined && !(Number.isInteger(segments) && segments >= 1 && segments <= 4)) {
    errors.push(`${spec.id}: param 'bevelSegments' must be a whole number from 1 to 4, got ${segments}`)
  }
  const left = (w - Math.min(rear, w)) / 2 + chamfer
  const right = (w + Math.min(rear, w)) / 2 - chamfer
  for (const port of spec.ports) {
    if (!(port.insetMm !== undefined && port.insetMm > 0)) continue // no inset, no pocket
    if (port.face !== 'io') {
      errors.push(`${spec.id}: port '${port.portId}' has an insetMm but is on the ${port.face} face: a pocket is cut on the io face only`)
      continue
    }
    const r = (port.openingMm ?? POCKET_DEFAULT_MM) / 2
    if (port.xMm - r < left || port.xMm + r > right || port.yMm - r < chamfer || port.yMm + r > h - chamfer) {
      errors.push(`${spec.id}: the pocket of port '${port.portId}' (x ${port.xMm}, y ${port.yMm}, radius ${r} mm) does not fit in the flat rear face (x ${left} to ${right} mm)`)
    }
    if (port.insetMm > d / 2) errors.push(`${spec.id}: port '${port.portId}' inset (${port.insetMm} mm) is deeper than half the depth`)
  }
  return errors
}

/** Defaults of the curved-cabinet params, in millimetres (the Python builder uses the same numbers). */
export const CURVED_DEFAULTS = { frontRadiusMm: 24, backRadiusMm: 24, edgeRadiusMm: 16, edgeSegments: 8, ringDepthMm: 2, waveguideDepthMm: 8, midDepthFraction: 0.4 } as const
/** How far the plan polygon may be from the width before the builder's final stretch to the exact width would be visible (a fraction of the width). */
export const CURVED_WIDTH_SLACK = 0.12

/** The checks of a curved-cabinet that need no geometry: radii and widths, edge segments, baffle rings, rear pockets. (The Python builder checks the fit of rings and pockets in the real outline.) */
function validateCurvedCabinet(spec: AssetSpecT): string[] {
  const errors: string[] = []
  const { w, h, d } = spec.realSizeMm
  const p = spec.build?.params ?? {}
  const edge = p.edgeRadiusMm ?? CURVED_DEFAULTS.edgeRadiusMm
  const drop = p.edgeDropMm ?? edge
  const half = Math.min(w, h, d) / 2
  if (edge >= half) errors.push(`${spec.id}: edgeRadiusMm (${edge}) must be less than half the smallest side (${half} mm)`)
  if (drop * 2 >= h) errors.push(`${spec.id}: edgeDropMm (${drop}) must be less than half the height (${h / 2} mm)`)
  for (const name of ['frontRadiusMm', 'sideRadiusMm', 'backRadiusMm'] as const) {
    const r = name === 'sideRadiusMm' ? p[name] : (p[name] ?? CURVED_DEFAULTS[name])
    if (r !== undefined && r < edge) errors.push(`${spec.id}: ${name} (${r}) must be at least edgeRadiusMm (${edge}): a tighter plan corner than the fillet would make the fillet fold over`)
  }
  const segments = p.edgeSegments
  if (segments !== undefined && !(Number.isInteger(segments) && segments >= 4 && segments <= 16)) {
    errors.push(`${spec.id}: param 'edgeSegments' must be a whole number from 4 to 16, got ${segments}`)
  }
  const bulge = p.sideBulgeMm ?? 0
  const front = p.planFrontMm ?? w - 2 * bulge
  if (p.midWidthMm !== undefined && p.sideBulgeMm !== undefined) errors.push(`${spec.id}: midWidthMm and sideBulgeMm both set the widest points: give one`)
  const widest = p.midWidthMm !== undefined ? Math.max(front, p.midWidthMm) : front + 2 * bulge
  if (front > w * (1 + CURVED_WIDTH_SLACK)) errors.push(`${spec.id}: planFrontMm (${front}) cannot be more than ${CURVED_WIDTH_SLACK * 100} % wider than the width ${w} mm`)
  if (Math.abs(widest - w) > w * CURVED_WIDTH_SLACK) errors.push(`${spec.id}: planFrontMm + 2 x sideBulgeMm (${widest}) is more than ${CURVED_WIDTH_SLACK * 100} % away from the width ${w} mm: the final stretch to the exact width would show`)
  if (p.barrelMm !== undefined && p.barrelMm >= w / 4) errors.push(`${spec.id}: barrelMm (${p.barrelMm}) must be less than a quarter of the width (${w / 4} mm)`)
  if (p.barrelCentreMm !== undefined && p.barrelCentreMm >= h) errors.push(`${spec.id}: barrelCentreMm (${p.barrelCentreMm}) must be inside the height ${h} mm`)
  const foot = p.footMm
  if (foot !== undefined && foot >= h / 3) errors.push(`${spec.id}: footMm (${foot}) must be less than a third of the height (${h / 3} mm)`)
  if (foot === undefined && (p.footWidthMm !== undefined || p.footDepthMm !== undefined)) errors.push(`${spec.id}: footWidthMm and footDepthMm have no effect without footMm`)
  if (p.footWidthMm !== undefined && p.footWidthMm > w) errors.push(`${spec.id}: footWidthMm (${p.footWidthMm}) cannot be wider than the cabinet (${w} mm)`)
  if (p.footDepthMm !== undefined && p.footDepthMm > d) errors.push(`${spec.id}: footDepthMm (${p.footDepthMm}) cannot be deeper than the cabinet (${d} mm)`)
  if (p.bodyGrey !== undefined && !(p.bodyGrey >= 20 && p.bodyGrey <= 200)) errors.push(`${spec.id}: bodyGrey (${p.bodyGrey}) must be a grey level from 20 to 200`)
  const rear = p.rearWidthMm
  if (rear !== undefined && rear > w * (1 + CURVED_WIDTH_SLACK)) errors.push(`${spec.id}: rearWidthMm (${rear}) cannot be more than ${CURVED_WIDTH_SLACK * 100} % wider than the width ${w} mm`)
  if (p.midDepthMm !== undefined && p.midDepthMm >= d) errors.push(`${spec.id}: midDepthMm (${p.midDepthMm}) must be less than the depth ${d} mm`)

  const rings: [string, string][] = [['wooferRingMm', 'wooferYMm'], ['tweeterRingMm', 'tweeterYMm']]
  if (rings.some(([ring]) => p[ring] !== undefined) && p.crownMm !== undefined) {
    errors.push(`${spec.id}: crownMm bows the baffle, but a ring is cut into a flat baffle: use no crownMm with a woofer or tweeter ring`)
  }
  for (const [ring, y] of rings) {
    const dia = p[ring]
    if (dia === undefined) continue
    if (p[y] === undefined) errors.push(`${spec.id}: ${ring} needs ${y} (the height of its centre above the base, in mm)`)
    else if (p[y] - dia / 2 < drop || p[y] + dia / 2 > h - drop) errors.push(`${spec.id}: ${ring} (${dia} mm at ${y} ${p[y]} mm) does not fit between the fillets of the baffle (${drop} to ${h - drop} mm)`)
    const frontRadius = p.frontRadiusMm ?? CURVED_DEFAULTS.frontRadiusMm
    if (dia + 2 * frontRadius * 0.9 > w) errors.push(`${spec.id}: ${ring} (${dia} mm) is too wide for the flat baffle of a ${w} mm cabinet with front corners of ${frontRadius} mm`)
  }
  if (p.waveguideMm !== undefined) {
    if (p.tweeterRingMm === undefined) errors.push(`${spec.id}: waveguideMm needs tweeterRingMm (the waveguide floor is the tweeter ring)`)
    else if (p.waveguideMm <= p.tweeterRingMm) errors.push(`${spec.id}: waveguideMm (${p.waveguideMm}) must be wider than tweeterRingMm (${p.tweeterRingMm})`)
  } else if (p.waveguideDepthMm !== undefined) errors.push(`${spec.id}: waveguideDepthMm has no effect without waveguideMm`)

  for (const port of spec.ports) {
    if (!(port.insetMm !== undefined && port.insetMm > 0)) continue // no inset, no pocket
    if (port.face !== 'io') {
      errors.push(`${spec.id}: port '${port.portId}' has an insetMm but is on the ${port.face} face: a pocket is cut on the io face only`)
      continue
    }
    if (port.insetMm > d / 2) errors.push(`${spec.id}: port '${port.portId}' inset (${port.insetMm} mm) is deeper than half the depth`)
  }
  return errors
}
