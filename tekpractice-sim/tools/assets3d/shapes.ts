/**
 * assets3d/shapes: the shape table of the scripted builder (tools/assets3d/blender/build_from_spec.py) and the check of
 * a spec's optional `build` block. Each shape works for one kind (device or connector), accepts a fixed set of numeric
 * params and may need the connector's mating diameter (`mating.outerMm`). The Python registry must list exactly
 * BUILD_SHAPES (a test compares the two), so the zod enum and the script cannot drift.
 *
 * No runtime imports: specSchema.ts imports BUILD_SHAPES from here, so this file only takes the spec type.
 */
import type { AssetSpecT } from './specSchema'

/** The optional params of the detailed rack-box (all in mm unless said otherwise; counts and flags are plain numbers). */
export const RACK_V2_PARAMS = [
  'earWidthMm', 'earThicknessMm', 'earHoleMm', 'earHoleEdgeMm', 'earHoleRowMm', 'earDiagonal',
  'handleCount', 'handleProjectionMm', 'handleDiaMm',
  'plateInsetMm', 'filletMm', 'filletSegments',
  'ventSlots', 'ventColumns', 'ventDepthMm', 'ventSlotLenMm', 'ventSlotWidthMm', 'ventPitchMm', 'ventColPitchMm', 'ventFromRearMm', 'ventSides',
  'feetMm', 'feetDiaMm', 'bodyWidthMm', 'rearInsetMm', 'frontOnIo', 'plateFilletMm', 'seamMm', 'plateRgb', 'bodyRgb',
] as const

/**
 * rack-box v3b (Wave 2, Task 2.1): features of power amplifiers and compressors, extension params of the SAME rack-box builder (any of them switches the detailed build on).
 * All positions are face-local on the FRONT face, millimetres, x from the left as seen from the front, y up (the face is `opposite`, or `io` with frontOnIo = 1).
 *   Front vents: a block of frontVentSlots x frontVentRows horizontal slots (frontVentSlotLenMm long, frontVentSlotWidthMm high) cut THROUGH the front plate
 *     (the plate is earThicknessMm thick, default 4): frontVentColPitchMm between slot centres along x (needed with more than one slot, more than the slot length),
 *     frontVentRowPitchMm between rows (needed with more than one row, more than the slot height), the block CENTRED at frontVentXMm, frontVentYMm;
 *     frontVentDepthMm (at most the plate thickness; default = through) makes a shallower recess instead. Through slots must lie in front of the chassis (inside bodyWidthMm).
 *   Meter window: one rectangular recess in the front plate, windowWMm x windowHMm with its LOWER-LEFT corner at windowXMm, windowYMm, windowDepthMm deep
 *     (default 1.5 mm, at most the plate thickness). It is picture and shape only: the controls rig draws a meter needle on the plate face, so a window over a control zone is refused.
 *   Ear handles: two handles standing earHandleProjectionMm in front of the plate (the plate moves back by that much, the size d INCLUDES them), earHandleDiaMm thick (default 10),
 *     earHandleLenMm long along y (default 0.6 of the plate height), the bar's axis earHandleFromEndMm from the plate end (default: just inboard of the rack-ear slot,
 *     so the slots stay clear). A handle that would cover an ear slot, a vent, the window or a control zone is refused. Excludes handleCount. A port on the front face needs insetMm = the projection; a control cannot sit there.
 */
export const RACK_V3B_PARAMS = [
  'frontVentSlots', 'frontVentRows', 'frontVentSlotLenMm', 'frontVentSlotWidthMm', 'frontVentColPitchMm', 'frontVentRowPitchMm', 'frontVentXMm', 'frontVentYMm', 'frontVentDepthMm',
  'windowWMm', 'windowHMm', 'windowXMm', 'windowYMm', 'windowDepthMm',
  'earHandleProjectionMm', 'earHandleDiaMm', 'earHandleLenMm', 'earHandleFromEndMm',
] as const

/** Default plate and ear thickness of the detailed rack-box, in millimetres (the Python builder uses the same: RACK_PLATE_T_MM). */
export const RACK_PLATE_T_MM = 4

/** The optional params of the detailed console-wedge (all in mm unless said otherwise; counts are plain numbers). Any of them switches the detailed build on. */
export const CONSOLE_V2_PARAMS = [
  'filletMm', 'filletSegments', 'armRestMm',
  'cheekMm', 'baseMm',
  'tierYMm', 'tierWMm', 'tierXMm',
  'feetMm', 'feetWidthMm', 'feetFromSideMm', 'feetFromEndMm',
  'slotPlates', 'slotPlateWMm', 'slotPlateHMm', 'slotPlateXMm', 'slotPlateYMm', 'slotPlatePitchMm', 'slotPlateDepthMm',
  'frontRecessWMm', 'frontRecessHMm', 'frontRecessXMm', 'frontRecessYMm', 'frontRecessDepthMm',
  'rearRecessWMm', 'rearRecessHMm', 'rearRecessXMm', 'rearRecessYMm', 'rearRecessDepthMm',
] as const

/** The corners of a console's outline are rounded with this many fillet radii (the rim bevel runs round them: an arc must be rounder than the bevel is wide). The Python builder uses the same number: CONSOLE_ARC_FACTOR. */
export const CONSOLE_ARC_FACTOR = 1.6

/**
 * moulded-box (Wave 2, Task 2.2): a rounded-plan box with filleted top and bottom edges, generalised from curved-cabinet for the things that are not speakers:
 * field recorders, body-packs, small interfaces, controllers, boundary mics, laptops. Frame: bottom at y = 0, centred on x and z, the io face is the rear (+z), the front (opposite) at -z.
 * The size is the spec size (w x h x d) exactly, except in the hinged laptop mode (see below). All in millimetres unless said otherwise.
 *   Shape: cornerRadiusMm (plan corner radius, default 6, at least the edge radius), edgeRadiusMm (the top edge's rounding, inward; default 2) with edgeDropMm (downward; default the same),
 *     bottomEdgeRadiusMm (the bottom edge: inward and upward, default edgeRadiusMm), edgeSegments (4 to 12, default 6), bodyGrey (20 to 200) for the grey of the body.
 *   Lid seam: seamHeightMm (the height of a groove that runs round the whole body, a lid on a base) with seamWidthMm (default 0.8) and seamDepthMm (default 0.5). The groove crosses every side
 *     face, so a flat zone of a control (content/control-layouts) on a side face at that height is refused.
 *   Recess: a rectangular recess in the top face, recessWMm x recessHMm, lower-left corner at recessXMm (from the left, seen from above with the io edge at the bottom of the picture) and
 *     recessYMm (from the io edge toward the front), recessDepthMm deep (default 1). A screen, a display, a keyboard well. Refused over a flat zone of the top face.
 *   Ports: every io-face port with insetMm gets a round pocket behind it, as in curved-cabinet (the flat rear face must hold it).
 *   Hinged lid (a laptop): lidAngleDeg (1 to 179; 0 is closed, 90 upright, over 90 leans back), lidThicknessMm, baseHeightMm, baseDepthMm (the base slab is w x baseDepthMm x baseHeightMm) and
 *     optionally lidLenMm (default baseDepthMm). The lid is hinged along its rear edge on the top of the base, opened to the given angle. The spec size is then the size of the OPEN pose:
 *     mouldedHingePose() computes it (height and depth; the width is the spec width); a spec size up to 3 % off is stretched to the exact size, more is refused with the pose's size in the message.
 *     No seam in this mode; the recess (a keyboard well) cuts the top of the base. The builder reports lidAngleDeg as measured on the mesh.
 */
export const MOULDED_PARAMS = [
  'cornerRadiusMm', 'edgeRadiusMm', 'edgeDropMm', 'bottomEdgeRadiusMm', 'edgeSegments', 'bodyGrey',
  'seamHeightMm', 'seamWidthMm', 'seamDepthMm',
  'recessWMm', 'recessHMm', 'recessXMm', 'recessYMm', 'recessDepthMm',
  'lidAngleDeg', 'lidThicknessMm', 'baseHeightMm', 'baseDepthMm', 'lidLenMm',
] as const

/** Defaults of the moulded-box params, in millimetres (the Python builder uses the same numbers: MOULDED_DEFAULTS_MM). */
export const MOULDED_DEFAULTS = { cornerRadiusMm: 6, edgeRadiusMm: 2, edgeSegments: 6, seamWidthMm: 0.8, seamDepthMm: 0.5, recessDepthMm: 1 } as const
/** How far a hinged pose may be from the spec size before the stretch to the exact size would show (a fraction). */
export const MOULDED_POSE_SLACK = 0.03

/** The bounding box (height and depth, mm) of a moulded-box with a hinged lid in its open pose, from its params. The width is the spec width. Pure: the Python builder computes the same. */
export function mouldedHingePose(p: Readonly<Record<string, number>>): { h: number; d: number } {
  const base = p.baseHeightMm
  const baseD = p.baseDepthMm
  const thick = p.lidThicknessMm
  const len = p.lidLenMm ?? baseD
  const th = ((p.lidAngleDeg ?? 0) * Math.PI) / 180
  let yMax = base
  let zMin = 0
  let zMax = baseD
  for (const s of [0, len]) {
    for (const tt of [0, thick]) {
      yMax = Math.max(yMax, base + s * Math.sin(th) + tt * Math.cos(th))
      const z = baseD - s * Math.cos(th) + tt * Math.sin(th)
      zMin = Math.min(zMin, z)
      zMax = Math.max(zMax, z)
    }
  }
  return { h: yMax, d: zMax - zMin }
}

/**
 * round-base-stand (Wave 2, Task 2.4): a microphone stand on a ROUND cast base (K&M 26125 class), a variant of tripod-stand. A disc (baseDiaMm, required) baseHeightMm high (default 26)
 * under a conical hub (hubDiaMm, default 44), a telescopic tube (tubeDiaMm 22, upperTubeDiaMm 19: the upper slides in the lower), a clutch sleeve at clutchFromMm (default 0.55 of the height).
 * Without boomMm it is a STRAIGHT stand: the footprint is the disc (the spec width and depth must equal baseDiaMm) and the top of the 3/8 inch thread is the height, exactly.
 * With boomMm (the boom's whole length) it gets the tilt head and boom of tripod-stand: frontMm of it in front of the pivot (default 0.6 of boomMm), rising boomAngleDeg (default 20, 5 to 45)
 * over the base at boomAzimuthDeg (default 135); the pose is stretched to the spec size, refused when that needs more than 3 % (the message gives the pose's size).
 * A stand has no ports and no controls. Defaults mirrored in build_from_spec.py (ROUND_BASE_DEFAULTS_MM).
 */
export const ROUND_BASE_PARAMS = ['baseDiaMm', 'baseHeightMm', 'hubDiaMm', 'tubeDiaMm', 'upperTubeDiaMm', 'clutchFromMm', 'boomMm', 'frontMm', 'boomAngleDeg', 'boomAzimuthDeg'] as const
export const ROUND_BASE_DEFAULTS = { baseHeightMm: 26, hubDiaMm: 44, tubeDiaMm: 22, upperTubeDiaMm: 19, boomAngleDeg: 20, boomAzimuthDeg: 135 } as const

/** Every shape the builder knows. Grows by one entry each time a later wave adds a shape. */
export const BUILD_SHAPES = ['cylinder-plug', 'trs-plug', 'rj45-plug', 'rack-box', 'stagebox-rio3224', 'revolve', 'console-wedge', 'speaker-cabinet', 'boom-arm', 'cable-assembly', 'xlr-male-plug', 'iec-inlet', 'iec-cable', 'schuko-plug', 'schuko-socket', 'locking-plug', 'usb-plug', 'dsub-plug', 'terminal-block', 'coax-plug', 'toslink-plug', 'ethercon-plug', 'curved-cabinet', 'power-strip', 'tripod-stand', 'moulded-box', 'revolve-oval', 'round-base-stand'] as const
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
  /** How the profile reads: 'lathe' = [axial position, diameter] (revolve), 'lathe-oval' = [axial position, width, depth] (revolve-oval), 'side' = [depth from the io face, height] (console-wedge). */
  profileKind?: 'lathe' | 'lathe-oval' | 'side'
  /** True when the builder also needs the spec's ports (it cuts a pocket behind each inset port): runBuilder then puts them in plan.json. */
  usesPorts?: boolean
  /** True when the builder must keep the control rectangles of content/control-layouts/<id>.json flat (runBuilder puts them in plan.json as flatZones). */
  usesFlatZones?: boolean
}

export const SHAPE_SPECS: Record<BuildShape, ShapeSpec> = {
  'cylinder-plug': { kind: 'connector', params: ['frontLenMm', 'pins'], needsMatingOuter: true },
  // An XLR male cable plug (hollow 19 mm shell with the pins inside): pins = 3 or 5. The mating face is at z = 0 like every connector.
  'xlr-male-plug': { kind: 'connector', params: ['pins'], needsMatingOuter: false },
  'trs-plug': { kind: 'connector', params: ['barrelMm', 'zScale', 'poles'], needsMatingOuter: true },
  'rj45-plug': { kind: 'connector', params: [], needsMatingOuter: false },
  // A rack unit, desktop box or tower. Only chamferMm = the old plain chamfered box (44 triangles, byte-identical to the first builder). Any of the RACK_V2_PARAMS
  // switches on the detailed build: a full-width front plate (earThicknessMm thick, its face is the bounding-box face so ports and controls sit on it) with
  // slotted rack-ear holes (EIA-310: hole centres earHoleEdgeMm from the plate end, default 8.75 so they are 465.1 mm apart on a 482.6 plate; earHoleRowMm = distance of the slot centres from the plate bottom and top, default 6.35; slot earHoleMm high, 2.5 x that long; earDiagonal = 1 gives one slot per ear, top on the left and bottom on the right),
  // a chassis bodyWidthMm wide behind it (the ears are the plate beyond it: earWidthMm = (w - bodyWidthMm) / 2, give either), the chassis inset plateInsetMm from the plate
  // outline at top and bottom, two handles (handleCount 2) standing handleProjectionMm in front of the plate (the plate then moves back, so the unit must have no port
  // or control on the front face), vent slots (ventSlots in a row, ventColumns rows of them) on the top or, with ventSides, on both sides, rubber feet (feetMm tall),
  // a rear panel rearInsetMm deep as a separate shell (a seam), a horizontal seam seamMm above the chassis bottom (a base and a lid shell, each filleted, so the seam is a groove; vents then lie in the lid), filletMm round chassis edges in filletSegments steps (plateFilletMm for the plate edges, default 0.45 x the plate thickness at most); plateRgb and bodyRgb colour the faces no picture covers (the whole number 0xRRGGBB, e.g. 0x2f6db8 = 3042744; default a lifted grey). frontOnIo = 1 when the front panel is the io face.
  'rack-box': { kind: 'device', params: ['chamferMm', ...RACK_V2_PARAMS, ...RACK_V3B_PARAMS], needsMatingOuter: false, usesFlatZones: true },
  // The Yamaha Rio3224-D2 stage box: layout (connector grid, panel plates) is in the builder, only datasheet sizes are params.
  'stagebox-rio3224': { kind: 'device', params: ['earMm', 'flangeDepthMm', 'frontStepMm', 'rearStepMm'], needsMatingOuter: false },
  // A surface of revolution about the vertical axis from a measured profile (microphones, later stands and lamps).
  revolve: { kind: 'device', params: ['segments'], needsMatingOuter: false, usesProfile: true, profileKind: 'lathe' },
  // A console or any wedge-shaped casing: the side profile [depth from the io face mm, height mm] extruded across the width, edges chamfered (chamferMm only = the
  // old plain wedge, byte-identical to the first builder). Any of CONSOLE_V2_PARAMS switches on the detailed build: filletMm rounds the side rims in filletSegments steps
  // (and the profile's rear-top corner), armRestMm rounds the front-top edge into a thick roll, cheekMm + baseMm make the upper shell overhang a lower base (cheeks: side
  // plates cheekMm thick, base baseMm tall above the feet, set back cheekMm at the sides and the front, flush at the rear), tierYMm / tierWMm / tierXMm make everything above
  // that height a narrower tier (a meter bridge), feetMm four round rubber feet (feetWidthMm across at the body, 0.72 of it at the table, centres feetFromSideMm / feetFromEndMm from the edges), slotPlates shallow
  // rectangular recesses on the io face (slotPlateWMm x slotPlateHMm, first lower-left corner at slotPlateXMm / slotPlateYMm, slotPlatePitchMm apart, slotPlateDepthMm deep),
  // frontRecess* one recess on the front face, rearRecess* one more on the io face (the ports inside it need insetMm = its depth). The builder refuses detail over a control zone.
  'console-wedge': { kind: 'device', params: ['chamferMm', ...CONSOLE_V2_PARAMS], needsMatingOuter: false, usesProfile: true, profileKind: 'side', usesFlatZones: true, usesPorts: true },
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
  // A power strip lying with its outlets facing the io face: a bar along x with a rounded section (filletMm) and tapered ends (endTaperMm), one IEC C13 outlet
  // recess socketDepthMm deep per io port (the port sits on its floor, so each io port needs insetMm = socketDepthMm; the port x / y are the socket centres),
  // a lit rocker switch in a window switchMm high at the left end (switchXMm = its centre, default halfway to the first socket), feetMm rubber feet and a cord stub
  // (lenMm of the width, cableDiaMm thick) out of the right end. `sockets` is only a check against the number of io ports. The builder writes filletMm as measured.
  'power-strip': {
    kind: 'device',
    params: ['sockets', 'socketDepthMm', 'switchMm', 'switchXMm', 'feetMm', 'filletMm', 'endTaperMm', 'cableDiaMm', 'lenMm'],
    needsMatingOuter: false,
    usesPorts: true,
  },
  // revolve-oval (Wave 2, Task 2.3, plan family revolve-v2-oval): a lathe whose section is an ELLIPSE, for side-address condensers (AKG C414), ribbons and stereo mics.
  // The profile stations are [axial mm from the base, width mm (along x), depth mm (along z)]: first at 0, last at the height, strictly increasing, the widest width is the spec
  // width w and the deepest depth is the spec depth d (w and d may differ); a station with width 0 and depth 0 is a pole, one of them 0 alone is refused. params.segments as revolve
  // (a multiple of 4 from 12 to 64, so the box is exact). The wrap picture covers the whole side by ARC LENGTH of each ellipse; its width is the perimeter of the widest section
  // (ellipsePerimeterMm(w, d), what projectionFaceMm('wrap') returns), its height the spec height. With width = depth at every station the geometry is the round revolve's.
  'revolve-oval': { kind: 'device', params: ['segments'], needsMatingOuter: false, usesProfile: true, profileKind: 'lathe-oval' },
  // A microphone stand on a round base, straight or with a boom (see ROUND_BASE_PARAMS).
  'round-base-stand': { kind: 'device', params: ROUND_BASE_PARAMS, needsMatingOuter: false },
  // A rounded-plan box with filleted edges for recorders, body-packs, small interfaces, controllers, boundary mics and hinged laptops (see MOULDED_PARAMS).
  'moulded-box': { kind: 'device', params: MOULDED_PARAMS, needsMatingOuter: false, usesPorts: true, usesFlatZones: true },
  // A microphone boom stand (tripod, telescopic tube with clutch, tilt head and boom with counterweight and mic thread). The pose is built from these params,
  // then centred and stretched to the spec size (refused when that needs more than 3 %): the three legs are legAngleDeg, +120 and +240 degrees from +x towards +z
  // (15 degrees gives the same extent along x and z) with their length solved from the width, footDiaMm rubber feet, the boom of boomMm in all (frontMm of it in
  // front of the pivot) rises boomAngleDeg over the leg at boomAzimuthDeg and its tip is the top of the model; tubeDiaMm / upperTubeDiaMm are the lower and upper tube,
  // clutchFromMm the height of the clutch sleeve's bottom.
  'tripod-stand': {
    kind: 'device',
    params: ['legAngleDeg', 'footDiaMm', 'boomMm', 'frontMm', 'boomAngleDeg', 'boomAzimuthDeg', 'tubeDiaMm', 'upperTubeDiaMm', 'clutchFromMm'],
    needsMatingOuter: false,
  },
}

/** Perimeter of an ellipse of full width `w` and full depth `d` (Ramanujan's approximation, exact for a circle: pi x w), in the unit of the arguments. */
export function ellipsePerimeterMm(w: number, d: number): number {
  const a = w / 2
  const b = d / 2
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))
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
  } else if (shape.profileKind === 'lathe-oval') {
    const profile = build.profile
    if (build.shape === 'revolve-oval') errors.push(...validateOvalProfile(spec, profile))
  } else {
    const profile = build.profile
    const bad = profile.findIndex((st) => st.length !== 2)
    if (bad >= 0) errors.push(`${spec.id}: revolve takes [position, diameter] stations, but station ${bad} has ${profile[bad].length} numbers: use the shape revolve-oval for an oval section`)
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
  if (build.shape === 'rack-box') errors.push(...validateRackBox(spec))
  if (build.shape === 'console-wedge') errors.push(...validateConsoleWedge(spec))
  if (build.shape === 'power-strip') errors.push(...validatePowerStrip(spec))
  if (build.shape === 'tripod-stand') errors.push(...validateTripodStand(spec))
  if (build.shape === 'moulded-box') errors.push(...validateMouldedBox(spec))
  if (build.shape === 'round-base-stand') errors.push(...validateRoundBaseStand(spec))
  if (shape.needsMatingOuter && spec.mating?.outerMm === undefined) {
    errors.push(`${spec.id}: build shape '${build.shape}' needs mating.outerMm (the diameter of the mating end)`)
  }
  return errors
}

/** The checks of a revolve-oval profile: [position, width, depth] stations from 0 to the height, widest = w, deepest = d, poles round. */
function validateOvalProfile(spec: AssetSpecT, profile: NonNullable<AssetSpecT['build']>['profile'] & object): string[] {
  const errors: string[] = []
  const size = spec.realSizeMm
  const id = spec.id
  const badIdx = profile.findIndex((st) => st.length !== 3)
  if (badIdx >= 0) return [`${id}: station ${badIdx} must be [position, width, depth] for revolve-oval, got ${profile[badIdx].length} numbers`]
  const st3 = profile as unknown as [number, number, number][]
  if (Math.abs(st3[0][0]) > PROFILE_TOL_MM) errors.push(`${id}: the first station must be at 0 (the base), got ${st3[0][0]} mm`)
  const last = st3[st3.length - 1][0]
  if (Math.abs(last - size.h) > PROFILE_TOL_MM) errors.push(`${id}: the last station must be at the height ${size.h} mm, got ${last} mm`)
  const widest = Math.max(...st3.map((st) => st[1]))
  const deepest = Math.max(...st3.map((st) => st[2]))
  if (Math.abs(widest - size.w) > PROFILE_TOL_MM) errors.push(`${id}: the widest station (${widest} mm) must equal the width ${size.w} mm`)
  if (Math.abs(deepest - size.d) > PROFILE_TOL_MM) errors.push(`${id}: the deepest station (${deepest} mm) must equal the depth ${size.d} mm`)
  st3.forEach((st, i) => {
    if ((st[1] === 0) !== (st[2] === 0)) errors.push(`${id}: station ${i} is a pole in one direction only: width and depth must both be 0 or both above 0 (got ${st[1]} x ${st[2]})`)
  })
  for (const c of spec.build?.colours ?? []) {
    if (c.fromMm > size.h) errors.push(`${id}: a colour zone at ${c.fromMm} mm is beyond the height ${size.h} mm`)
  }
  const segments = spec.build?.params?.segments
  if (segments !== undefined && !(Number.isInteger(segments) && segments >= 12 && segments <= 64 && segments % 4 === 0)) {
    errors.push(`${id}: param 'segments' must be a whole number from 12 to 64 and a multiple of 4 (so the box is exact), got ${segments}`)
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

/** The checks of a detailed rack-box that need no geometry (the Python builder checks the fit of slots and vents in the real outline and against the flat zones). */
function validateRackBox(spec: AssetSpecT): string[] {
  const p = spec.build?.params ?? {}
  if (!RACK_V2_PARAMS.some((n) => p[n] !== undefined) && !RACK_V3B_PARAMS.some((n) => p[n] !== undefined)) return []
  const errors: string[] = []
  const { w, h, d } = spec.realSizeMm
  const id = spec.id
  const whole = (name: string, lo: number, hi: number): void => {
    const v = p[name]
    if (v !== undefined && !(Number.isInteger(v) && v >= lo && v <= hi)) errors.push(`${id}: param '${name}' must be a whole number from ${lo} to ${hi}, got ${v}`)
  }
  whole('handleCount', 2, 2)
  whole('filletSegments', 1, 12)
  whole('ventSlots', 1, 40)
  whole('ventColumns', 1, 20)
  whole('ventSides', 1, 1)
  whole('frontOnIo', 1, 1)
  whole('earDiagonal', 1, 1)
  whole('plateRgb', 1, 0xffffff)
  whole('bodyRgb', 1, 0xffffff)
  if (p.bodyWidthMm !== undefined && p.bodyWidthMm > w) errors.push(`${id}: bodyWidthMm (${p.bodyWidthMm}) cannot be wider than the width ${w} mm`)
  if (p.bodyWidthMm !== undefined && p.earWidthMm !== undefined && Math.abs((w - p.bodyWidthMm) / 2 - p.earWidthMm) > 0.5) {
    errors.push(`${id}: earWidthMm (${p.earWidthMm}) and bodyWidthMm (${p.bodyWidthMm}) disagree: the ears are (${w} - bodyWidthMm) / 2 = ${(w - p.bodyWidthMm) / 2} mm wide each; give one of them`)
  }
  if (p.earWidthMm !== undefined && p.earWidthMm * 2 >= w) errors.push(`${id}: earWidthMm (${p.earWidthMm}) must be less than half the width`)
  if (p.plateInsetMm !== undefined && p.plateInsetMm * 4 >= h) errors.push(`${id}: plateInsetMm (${p.plateInsetMm}) must be less than a quarter of the height ${h} mm`)
  if (p.feetMm !== undefined && p.feetMm * 4 >= h) errors.push(`${id}: feetMm (${p.feetMm}) must be less than a quarter of the height ${h} mm`)
  if (p.rearInsetMm !== undefined && p.rearInsetMm * 4 >= d) errors.push(`${id}: rearInsetMm (${p.rearInsetMm}) must be less than a quarter of the depth ${d} mm`)
  if (p.earHoleMm !== undefined && p.earHoleMm * 2 > h) errors.push(`${id}: earHoleMm (${p.earHoleMm}) is too tall for the height ${h} mm`)
  if (p.ventColumns !== undefined && p.ventSlots === undefined) errors.push(`${id}: ventColumns has no effect without ventSlots`)
  if (p.ventSides !== undefined && p.ventSlots === undefined) errors.push(`${id}: ventSides has no effect without ventSlots`)
  if (p.handleProjectionMm !== undefined && p.handleCount === undefined) errors.push(`${id}: handleProjectionMm has no effect without handleCount`)
  if (p.handleCount !== undefined) {
    if (p.handleProjectionMm === undefined) errors.push(`${id}: handleCount needs handleProjectionMm (how far the handles stand in front of the plate)`)
    // handles stand in the bounding box: the plate moves back, so a port or control on the front face would float in front of it
    const front = p.frontOnIo === 1 ? 'io' : 'opposite'
    const onFront = [...spec.ports.map((x) => [x.portId, x.face] as const), ...spec.controls.map((x) => [x.controlId, x.face] as const)].filter(([, face]) => face === front)
    if (onFront.length > 0) errors.push(`${id}: handles move the front plate back, but ${onFront.map(([n]) => n).join(', ')} sit on the front face (${front}): a unit with ports or controls on its front has no handles in this shape`)
  }
  errors.push(...validateRackV3b(spec))
  return errors
}

/** The v3b checks that need no geometry (the Python builder checks the fit in the plate, against the ear slots, each other and the flat zones). */
function validateRackV3b(spec: AssetSpecT): string[] {
  const p = spec.build?.params ?? {}
  if (!RACK_V3B_PARAMS.some((n) => p[n] !== undefined)) return []
  const errors: string[] = []
  const { w, h } = spec.realSizeMm
  const id = spec.id
  const plate = p.earThicknessMm ?? RACK_PLATE_T_MM
  const whole = (name: string, lo: number, hi: number): void => {
    const v = p[name]
    if (v !== undefined && !(Number.isInteger(v) && v >= lo && v <= hi)) errors.push(`${id}: param '${name}' must be a whole number from ${lo} to ${hi}, got ${v}`)
  }
  /** True when the group is given in full (its core names all there); one error when some of it is given and a core name is missing. */
  const group = (what: string, core: string[], all: string[]): boolean => {
    if (!all.some((n) => p[n] !== undefined)) return false
    const missing = core.filter((n) => p[n] === undefined)
    if (missing.length > 0) {
      errors.push(`${id}: ${what} ${what.endsWith('s') ? 'need' : 'needs'} ${core.join(', ')} (missing ${missing.join(', ')})`)
      return false
    }
    return true
  }

  // front vents
  const ventNames = ['frontVentSlots', 'frontVentRows', 'frontVentSlotLenMm', 'frontVentSlotWidthMm', 'frontVentColPitchMm', 'frontVentRowPitchMm', 'frontVentXMm', 'frontVentYMm', 'frontVentDepthMm']
  if (group('front vents', ['frontVentSlots', 'frontVentSlotLenMm', 'frontVentSlotWidthMm', 'frontVentXMm', 'frontVentYMm'], ventNames)) {
    whole('frontVentSlots', 1, 40)
    whole('frontVentRows', 1, 12)
    const cols = p.frontVentSlots
    const rows = p.frontVentRows ?? 1
    if (cols > 1 && p.frontVentColPitchMm === undefined) errors.push(`${id}: ${cols} front vent slots per row need frontVentColPitchMm (the distance between slot centres)`)
    if (rows > 1 && p.frontVentRowPitchMm === undefined) errors.push(`${id}: ${rows} front vent rows need frontVentRowPitchMm (the distance between row centres)`)
    if (p.frontVentColPitchMm !== undefined && p.frontVentColPitchMm <= p.frontVentSlotLenMm) errors.push(`${id}: frontVentColPitchMm (${p.frontVentColPitchMm}) must be more than the slot length (${p.frontVentSlotLenMm} mm): the slots would run into each other`)
    if (p.frontVentRowPitchMm !== undefined && p.frontVentRowPitchMm <= p.frontVentSlotWidthMm) errors.push(`${id}: frontVentRowPitchMm (${p.frontVentRowPitchMm}) must be more than the slot height (${p.frontVentSlotWidthMm} mm): the rows would run into each other`)
    if (p.frontVentDepthMm !== undefined && p.frontVentDepthMm > plate + 1e-9) errors.push(`${id}: frontVentDepthMm (${p.frontVentDepthMm}) is deeper than the plate thickness (${plate} mm, earThicknessMm): at most a through slot`)
  }

  // meter window
  const windowNames = ['windowWMm', 'windowHMm', 'windowXMm', 'windowYMm', 'windowDepthMm']
  if (group('the window', ['windowWMm', 'windowHMm', 'windowXMm', 'windowYMm'], windowNames)) {
    if (p.windowXMm + p.windowWMm > w) errors.push(`${id}: the window (x ${p.windowXMm} to ${p.windowXMm + p.windowWMm} mm) is outside the plate width ${w} mm`)
    if (p.windowYMm + p.windowHMm > h) errors.push(`${id}: the window (y ${p.windowYMm} to ${p.windowYMm + p.windowHMm} mm) reaches above the height ${h} mm`)
    if (p.windowDepthMm !== undefined && p.windowDepthMm > plate + 1e-9) errors.push(`${id}: windowDepthMm (${p.windowDepthMm}) is deeper than the plate thickness (${plate} mm, earThicknessMm)`)
  }

  // ear handles
  const handleNames = ['earHandleProjectionMm', 'earHandleDiaMm', 'earHandleLenMm', 'earHandleFromEndMm']
  if (p.earHandleProjectionMm === undefined) {
    const extra = handleNames.find((n) => p[n] !== undefined)
    if (extra) errors.push(`${id}: ${extra} has no effect without earHandleProjectionMm (how far the handles stand in front of the plate)`)
  } else {
    const dia = p.earHandleDiaMm ?? 10
    if (p.handleCount !== undefined) errors.push(`${id}: ear handles and handleCount are two handle styles: give one of them`)
    if (p.earHandleProjectionMm < dia + 2) errors.push(`${id}: earHandleProjectionMm (${p.earHandleProjectionMm}) must be at least the handle diameter plus 2 mm (${dia + 2})`)
    if (p.earHandleLenMm !== undefined && p.earHandleLenMm >= h) errors.push(`${id}: earHandleLenMm (${p.earHandleLenMm}) must be less than the height ${h} mm`)
    if (p.earHandleFromEndMm !== undefined && p.earHandleFromEndMm * 2 >= w) errors.push(`${id}: earHandleFromEndMm (${p.earHandleFromEndMm}) must be less than half the width`)
    // the plate moves back by the handle depth: a control on the front would float in front of it, a port needs the same set-back
    const front = p.frontOnIo === 1 ? 'io' : 'opposite'
    const controls = spec.controls.filter((x) => x.face === front).map((x) => x.controlId)
    if (controls.length > 0) errors.push(`${id}: ear handles move the front plate back, but ${controls.join(', ')} sit on the front face (${front}): a control would float in front of the plate`)
    for (const port of spec.ports.filter((x) => x.face === front)) {
      if (port.insetMm === undefined || Math.abs(port.insetMm - p.earHandleProjectionMm) > 0.05) errors.push(`${id}: port '${port.portId}' on the front face (${front}) needs insetMm ${p.earHandleProjectionMm} (the handle depth): the plate is that far behind the bounding-box face`)
    }
  }
  return errors
}

/** The checks of a detailed console-wedge that need no geometry (the Python builder checks the fit in the real outline and against the flat zones). */
function validateConsoleWedge(spec: AssetSpecT): string[] {
  const p = spec.build?.params ?? {}
  if (!CONSOLE_V2_PARAMS.some((n) => p[n] !== undefined)) return []
  const errors: string[] = []
  const { w, h } = spec.realSizeMm
  const id = spec.id
  const profile = spec.build?.profile ?? []
  const lowest = profile.length > 0 ? Math.min(...profile.map((st) => st[1])) : h
  const whole = (name: string, lo: number, hi: number): void => {
    const v = p[name]
    if (v !== undefined && !(Number.isInteger(v) && v >= lo && v <= hi)) errors.push(`${id}: param '${name}' must be a whole number from ${lo} to ${hi}, got ${v}`)
  }
  whole('filletSegments', 1, 12)
  whole('slotPlates', 1, 4)
  if (p.filletSegments !== undefined && p.filletMm === undefined) errors.push(`${id}: filletSegments has no effect without filletMm`)
  if (p.filletMm !== undefined && p.filletMm * 2 >= Math.min(w, lowest)) errors.push(`${id}: filletMm (${p.filletMm}) must be smaller than half the smallest side (${Math.min(w, lowest) / 2} mm)`)
  if (p.armRestMm !== undefined) {
    if (p.filletMm === undefined) errors.push(`${id}: armRestMm needs filletMm (the rest of the rim)`)
    else if (p.armRestMm < CONSOLE_ARC_FACTOR * p.filletMm) errors.push(`${id}: armRestMm (${p.armRestMm}) must be at least ${CONSOLE_ARC_FACTOR} times filletMm (${p.filletMm}): it is the thick roll of the front edge and the rim bevel runs round it`)
    if (p.armRestMm * 2 >= lowest) errors.push(`${id}: armRestMm (${p.armRestMm}) must be smaller than half the lowest station of the profile (${lowest / 2} mm)`)
  }
  const feet = p.feetMm ?? 0
  if (p.cheekMm !== undefined && p.baseMm === undefined) errors.push(`${id}: cheekMm needs baseMm (the height of the base the cheeks overhang)`)
  if (p.baseMm !== undefined && p.cheekMm === undefined) errors.push(`${id}: baseMm has no effect without cheekMm`)
  if (p.cheekMm !== undefined && p.cheekMm * 4 >= w) errors.push(`${id}: cheekMm (${p.cheekMm}) must be less than a quarter of the width ${w} mm`)
  if (p.baseMm !== undefined && feet + p.baseMm + (p.armRestMm ?? p.filletMm ?? 0) >= lowest) errors.push(`${id}: baseMm (${p.baseMm}) + feetMm (${feet}) leaves no room for the shell under the lowest station of the profile (${lowest} mm)`)
  for (const n of ['feetWidthMm', 'feetFromSideMm', 'feetFromEndMm'] as const) {
    if (p[n] !== undefined && p.feetMm === undefined) errors.push(`${id}: ${n} has no effect without feetMm`)
  }
  if (p.feetMm !== undefined && p.feetMm * 4 >= lowest) errors.push(`${id}: feetMm (${p.feetMm}) must be less than a quarter of the lowest station of the profile (${lowest} mm)`)
  if ((p.tierYMm === undefined) !== (p.tierWMm === undefined)) errors.push(`${id}: tierYMm and tierWMm go together (the height above which the body is narrower, and its width)`)
  if (p.tierXMm !== undefined && p.tierWMm === undefined) errors.push(`${id}: tierXMm has no effect without tierYMm and tierWMm`)
  if (p.tierYMm !== undefined && !(p.tierYMm >= lowest && p.tierYMm < h)) errors.push(`${id}: tierYMm (${p.tierYMm}) must be from the lowest station of the profile (${lowest} mm) up to below the height ${h} mm`)
  if (p.tierWMm !== undefined && !(p.tierWMm < w)) errors.push(`${id}: tierWMm (${p.tierWMm}) must be narrower than the width ${w} mm`)
  if (p.tierWMm !== undefined && Math.abs(p.tierXMm ?? 0) + p.tierWMm / 2 > w / 2) errors.push(`${id}: the tier (width ${p.tierWMm}, offset ${p.tierXMm ?? 0} mm) sticks out of the width ${w} mm`)
  const group = (prefix: string, names: string[], what: string): void => {
    const given = names.filter((n) => p[n] !== undefined)
    if (given.length > 0 && given.length < names.length) errors.push(`${id}: ${what} needs ${names.join(', ')} (missing ${names.filter((n) => p[n] === undefined).join(', ')})`)
    if (given.length === 0 && p[`${prefix}DepthMm`] !== undefined) errors.push(`${id}: ${prefix}DepthMm has no effect without ${names.join(', ')}`)
    const depth = p[`${prefix}DepthMm`]
    if (depth !== undefined && depth > 20) errors.push(`${id}: ${prefix}DepthMm (${depth}) is deeper than 20 mm`)
    const x = p[`${prefix}XMm`]
    const ww = p[`${prefix}WMm`]
    if (x !== undefined && ww !== undefined && x + ww > w) errors.push(`${id}: ${what} (x ${x} to ${x + ww} mm) is outside the width ${w} mm`)
  }
  group('frontRecess', ['frontRecessWMm', 'frontRecessHMm', 'frontRecessXMm', 'frontRecessYMm'], 'the front recess')
  group('rearRecess', ['rearRecessWMm', 'rearRecessHMm', 'rearRecessXMm', 'rearRecessYMm'], 'the rear recess')
  const slotNames = ['slotPlateWMm', 'slotPlateHMm', 'slotPlateXMm', 'slotPlateYMm']
  const slotGiven = [...slotNames, 'slotPlates'].filter((n) => p[n] !== undefined)
  if (slotGiven.length > 0 && slotGiven.length < slotNames.length + 1) errors.push(`${id}: the slot plates need slotPlates, ${slotNames.join(', ')} (missing ${[...slotNames, 'slotPlates'].filter((n) => p[n] === undefined).join(', ')})`)
  if (slotGiven.length === 0 && (p.slotPlatePitchMm !== undefined || p.slotPlateDepthMm !== undefined)) errors.push(`${id}: slotPlatePitchMm and slotPlateDepthMm have no effect without the slot plates`)
  if (p.slotPlates !== undefined && p.slotPlates >= 2) {
    if (p.slotPlatePitchMm === undefined) errors.push(`${id}: ${p.slotPlates} slot plates need slotPlatePitchMm (the distance between the lower-left corners)`)
    else if (p.slotPlateWMm !== undefined && p.slotPlatePitchMm < p.slotPlateWMm) errors.push(`${id}: slotPlatePitchMm (${p.slotPlatePitchMm}) must be at least slotPlateWMm (${p.slotPlateWMm}): the plates would overlap`)
    else if (p.slotPlateXMm !== undefined && p.slotPlateWMm !== undefined && p.slotPlateXMm + p.slotPlateWMm + (p.slotPlates - 1) * p.slotPlatePitchMm > w) errors.push(`${id}: the slot plates reach past the width ${w} mm`)
  } else if (p.slotPlatePitchMm !== undefined) errors.push(`${id}: slotPlatePitchMm has no effect with a single slot plate`)
  if (p.slotPlateDepthMm !== undefined && p.slotPlateDepthMm > 20) errors.push(`${id}: slotPlateDepthMm (${p.slotPlateDepthMm}) is deeper than 20 mm`)
  if (p.slotPlateYMm !== undefined && p.slotPlateHMm !== undefined && p.slotPlateYMm + p.slotPlateHMm > h) errors.push(`${id}: the slot plates reach above the height ${h} mm`)
  return errors
}

/** Defaults of the power-strip params, in millimetres (the Python builder uses the same numbers: STRIP_DEFAULTS_MM). */
export const STRIP_DEFAULTS = { socketDepthMm: 9, switchMm: 24, feetMm: 2, filletMm: 7, endTaperMm: 2.5, cableDiaMm: 9, lenMm: 30 } as const

/** The checks of a power-strip that need no geometry: the sockets are the io ports and sit on their floors; the stub, the section and the sockets fit the size. (The builder checks the fit of every opening on the flat front.) */
function validatePowerStrip(spec: AssetSpecT): string[] {
  const errors: string[] = []
  const { w, h, d } = spec.realSizeMm
  const p = spec.build?.params ?? {}
  const num = (name: keyof typeof STRIP_DEFAULTS): number => p[name] ?? STRIP_DEFAULTS[name]
  const sockets = spec.ports.filter((x) => x.face === 'io')
  const off = spec.ports.filter((x) => x.face !== 'io')
  if (sockets.length === 0) errors.push(`${spec.id}: a power-strip needs its sockets as ports on the io face`)
  if (off.length > 0) errors.push(`${spec.id}: a power-strip has its sockets on the io face only, but ${off.map((x) => x.portId).join(', ')} are on another face`)
  if (p.sockets !== undefined && (!Number.isInteger(p.sockets) || p.sockets !== sockets.length)) {
    errors.push(`${spec.id}: param 'sockets' (${p.sockets}) must be the number of io ports (${sockets.length})`)
  }
  const depth = num('socketDepthMm')
  for (const s of sockets) {
    if (s.insetMm === undefined || Math.abs(s.insetMm - depth) > 0.05) {
      errors.push(`${spec.id}: port '${s.portId}' needs insetMm ${depth} (the socket depth): the port sits on the socket floor`)
    }
  }
  const lenMm = num('lenMm')
  if (lenMm >= w / 2) errors.push(`${spec.id}: lenMm (${lenMm}) must be less than half the width ${w} mm`)
  const feet = num('feetMm')
  const bar = h - feet
  if (num('filletMm') * 2 >= Math.min(bar, d)) errors.push(`${spec.id}: filletMm (${num('filletMm')}) must be less than half the bar's section (${Math.min(bar, d)} mm)`)
  if (num('endTaperMm') * 4 >= Math.min(bar, d)) errors.push(`${spec.id}: endTaperMm (${num('endTaperMm')}) is too large for the bar's section`)
  if (num('cableDiaMm') * 2.4 >= bar) errors.push(`${spec.id}: cableDiaMm (${num('cableDiaMm')}) is too thick for the bar's height ${bar} mm`)
  if (num('switchMm') >= bar - 2 * num('filletMm')) errors.push(`${spec.id}: switchMm (${num('switchMm')}) does not fit on the flat front (${bar - 2 * num('filletMm')} mm)`)
  return errors
}

/** The checks of a round-base-stand that need no geometry (the builder checks that the boom pose fits the spec size). */
function validateRoundBaseStand(spec: AssetSpecT): string[] {
  const errors: string[] = []
  const { w, h, d } = spec.realSizeMm
  const p = spec.build?.params ?? {}
  const id = spec.id
  const num = (name: keyof typeof ROUND_BASE_DEFAULTS): number => p[name] ?? ROUND_BASE_DEFAULTS[name]
  if (spec.ports.length > 0) errors.push(`${id}: a round-base-stand has no ports (it is a prop)`)
  if (spec.controls.length > 0) errors.push(`${id}: a round-base-stand has no controls`)
  if (p.baseDiaMm === undefined) {
    errors.push(`${id}: round-base-stand needs baseDiaMm (the diameter of the base disc)`)
    return errors
  }
  if (num('upperTubeDiaMm') > num('tubeDiaMm')) errors.push(`${id}: upperTubeDiaMm (${num('upperTubeDiaMm')}) cannot be thicker than tubeDiaMm (${num('tubeDiaMm')}): the upper section slides in the lower one`)
  if (num('hubDiaMm') >= p.baseDiaMm) errors.push(`${id}: hubDiaMm (${num('hubDiaMm')}) must be less than baseDiaMm (${p.baseDiaMm})`)
  if (num('baseHeightMm') >= h / 4) errors.push(`${id}: baseHeightMm (${num('baseHeightMm')}) must be less than a quarter of the height ${h} mm`)
  if (p.clutchFromMm !== undefined && p.clutchFromMm + 200 >= h) errors.push(`${id}: clutchFromMm (${p.clutchFromMm}) leaves no room for the upper tube under the top (height ${h} mm)`)
  if (p.boomMm === undefined) {
    for (const n of ['frontMm', 'boomAngleDeg', 'boomAzimuthDeg'] as const) if (p[n] !== undefined) errors.push(`${id}: ${n} has no effect without boomMm`)
    if (Math.abs(w - p.baseDiaMm) > 0.05 || Math.abs(d - p.baseDiaMm) > 0.05) errors.push(`${id}: a straight round-base stand is as wide as its base: the spec width and depth (${w} x ${d} mm) must equal baseDiaMm (${p.baseDiaMm} mm)`)
  } else {
    const front = p.frontMm ?? 0.6 * p.boomMm
    if (!(num('boomAngleDeg') > 5 && num('boomAngleDeg') < 45)) errors.push(`${id}: boomAngleDeg (${num('boomAngleDeg')}) must be between 5 and 45 degrees`)
    if (front <= 250 || front >= p.boomMm - 120) errors.push(`${id}: frontMm (${front}) must be more than 250 mm and at least 120 mm less than boomMm (${p.boomMm})`)
    if (Math.max(w, d) < p.baseDiaMm - 0.05) errors.push(`${id}: the footprint (${w} x ${d} mm) is smaller than the base disc (${p.baseDiaMm} mm)`)
  }
  return errors
}

/** The checks of a moulded-box that need no geometry (the Python builder checks the fit of the recess, the pockets and the flat zones in the real outline). */
function validateMouldedBox(spec: AssetSpecT): string[] {
  const errors: string[] = []
  const { w, h, d } = spec.realSizeMm
  const p = spec.build?.params ?? {}
  const id = spec.id
  const num = (name: keyof typeof MOULDED_DEFAULTS): number => p[name] ?? MOULDED_DEFAULTS[name]
  const hinge = p.lidAngleDeg !== undefined || p.lidThicknessMm !== undefined || p.baseHeightMm !== undefined || p.baseDepthMm !== undefined || p.lidLenMm !== undefined
  const edge = num('edgeRadiusMm')
  const drop = p.edgeDropMm ?? edge
  const bottom = p.bottomEdgeRadiusMm ?? edge
  const bodyH = hinge ? (p.baseHeightMm ?? h) : h
  const bodyD = hinge ? (p.baseDepthMm ?? d) : d
  const half = Math.min(w, bodyH, bodyD) / 2
  if (Math.max(edge, bottom) >= half) errors.push(`${id}: edgeRadiusMm / bottomEdgeRadiusMm (${Math.max(edge, bottom)}) must be less than half the smallest side (${half} mm)`)
  if (Math.max(drop, bottom) * 2 >= bodyH) errors.push(`${id}: edgeDropMm (${Math.max(drop, bottom)}) must be less than half the height (${bodyH / 2} mm)`)
  if (num('cornerRadiusMm') < Math.max(edge, bottom)) errors.push(`${id}: cornerRadiusMm (${num('cornerRadiusMm')}) must be at least the edge radius (${Math.max(edge, bottom)}): a tighter plan corner than the fillet would make the fillet fold over`)
  const segments = p.edgeSegments
  if (segments !== undefined && !(Number.isInteger(segments) && segments >= 4 && segments <= 12)) errors.push(`${id}: param 'edgeSegments' must be a whole number from 4 to 12, got ${segments}`)
  if (p.bodyGrey !== undefined && !(p.bodyGrey >= 20 && p.bodyGrey <= 200)) errors.push(`${id}: bodyGrey (${p.bodyGrey}) must be a grey level from 20 to 200`)

  // lid seam
  if (p.seamHeightMm === undefined) {
    for (const n of ['seamWidthMm', 'seamDepthMm'] as const) if (p[n] !== undefined) errors.push(`${id}: ${n} has no effect without seamHeightMm`)
  } else {
    if (hinge) errors.push(`${id}: a hinged lid has its own gap: give no seamHeightMm with lidAngleDeg`)
    const sw = num('seamWidthMm')
    if (p.seamHeightMm - sw / 2 <= bottom || p.seamHeightMm + sw / 2 >= h - drop) errors.push(`${id}: seamHeightMm (${p.seamHeightMm}) leaves no wall for the groove: it must be between the bottom fillet (${bottom} mm) and the top fillet (${h - drop} mm) by half its width`)
    if (num('seamDepthMm') >= Math.min(w, d) / 8) errors.push(`${id}: seamDepthMm (${num('seamDepthMm')}) is too deep for a groove in a ${w} x ${d} mm body`)
    if (num('seamDepthMm') >= num('cornerRadiusMm')) errors.push(`${id}: seamDepthMm (${num('seamDepthMm')}) must be less than cornerRadiusMm (${num('cornerRadiusMm')}): the groove would fold over at the plan corners`)
  }

  // recess in the top face
  const recessNames = ['recessWMm', 'recessHMm', 'recessXMm', 'recessYMm']
  const recessGiven = [...recessNames, 'recessDepthMm'].filter((n) => p[n] !== undefined)
  if (recessGiven.length > 0) {
    const missing = recessNames.filter((n) => p[n] === undefined)
    if (missing.length > 0) errors.push(`${id}: the recess needs ${recessNames.join(', ')} (missing ${missing.join(', ')})`)
    else {
      if (p.recessXMm + p.recessWMm > w) errors.push(`${id}: the recess (x ${p.recessXMm} to ${p.recessXMm + p.recessWMm} mm) is outside the width ${w} mm`)
      if (p.recessYMm + p.recessHMm > bodyD) errors.push(`${id}: the recess (y ${p.recessYMm} to ${p.recessYMm + p.recessHMm} mm from the io edge) is outside the depth ${bodyD} mm`)
      if (num('recessDepthMm') * 2 >= bodyH) errors.push(`${id}: recessDepthMm (${num('recessDepthMm')}) must be less than half the height (${bodyH / 2} mm)`)
    }
  }

  // hinged lid
  if (hinge) {
    const need = ['lidAngleDeg', 'lidThicknessMm', 'baseHeightMm', 'baseDepthMm']
    const missing = need.filter((n) => p[n] === undefined)
    if (missing.length > 0) errors.push(`${id}: a hinged lid needs ${need.join(', ')} (missing ${missing.join(', ')})`)
    else {
      if (!(p.lidAngleDeg >= 1 && p.lidAngleDeg <= 179)) errors.push(`${id}: lidAngleDeg (${p.lidAngleDeg}) must be from 1 to 179 degrees`)
      if (p.lidThicknessMm <= 2 * Math.max(edge, bottom)) errors.push(`${id}: lidThicknessMm (${p.lidThicknessMm}) must be more than twice the edge radius (${2 * Math.max(edge, bottom)} mm)`)
      if (p.baseHeightMm <= 2 * Math.max(drop, bottom)) errors.push(`${id}: baseHeightMm (${p.baseHeightMm}) must be more than twice the edge drop (${2 * Math.max(drop, bottom)} mm)`)
      const pose = mouldedHingePose(p)
      if (Math.abs(pose.h - h) > h * MOULDED_POSE_SLACK || Math.abs(pose.d - d) > d * MOULDED_POSE_SLACK) {
        errors.push(`${id}: the open pose is ${w} x ${pose.h.toFixed(1)} x ${pose.d.toFixed(1)} mm (w x h x d) but the spec size is ${w} x ${h} x ${d} mm: the stretch to the spec would show (more than ${MOULDED_POSE_SLACK * 100} %); change the spec size, the angle or the base and lid sizes`)
      }
    }
  }
  return errors
}

/** Defaults of the tripod-stand params (angles in degrees, the rest in millimetres; the Python builder uses the same numbers: TRIPOD_DEFAULTS_MM). */
export const TRIPOD_DEFAULTS = { legAngleDeg: 15, footDiaMm: 34, boomMm: 745, frontMm: 445, boomAngleDeg: 20, boomAzimuthDeg: 135, tubeDiaMm: 21.8, upperTubeDiaMm: 19, clutchFromMm: 1028 } as const

/** The checks of a tripod-stand that need no geometry (the builder checks that the pose fits the spec size). */
function validateTripodStand(spec: AssetSpecT): string[] {
  const errors: string[] = []
  const { h } = spec.realSizeMm
  const p = spec.build?.params ?? {}
  const num = (name: keyof typeof TRIPOD_DEFAULTS): number => p[name] ?? TRIPOD_DEFAULTS[name]
  if (spec.ports.length > 0) errors.push(`${spec.id}: a tripod-stand has no ports (it is a prop)`)
  if (!(num('boomAngleDeg') > 5 && num('boomAngleDeg') < 45)) errors.push(`${spec.id}: boomAngleDeg (${num('boomAngleDeg')}) must be between 5 and 45 degrees`)
  if (num('frontMm') <= 250 || num('frontMm') >= num('boomMm') - 120) errors.push(`${spec.id}: frontMm (${num('frontMm')}) must be more than 250 mm and at least 120 mm less than boomMm (${num('boomMm')})`)
  if (num('clutchFromMm') + 100 >= h - 250) errors.push(`${spec.id}: clutchFromMm (${num('clutchFromMm')}) leaves no room for the upper tube under the boom (height ${h} mm)`)
  if (num('upperTubeDiaMm') > num('tubeDiaMm')) errors.push(`${spec.id}: upperTubeDiaMm (${num('upperTubeDiaMm')}) cannot be thicker than tubeDiaMm (${num('tubeDiaMm')}): the upper section slides in the lower one`)
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
