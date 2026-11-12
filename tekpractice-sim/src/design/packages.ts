/**
 * Design packages skeleton (onboarding spec 7.1, plan T0.1). `src/design` is
 * neutral: the shell and the guide both import it.
 *
 * `?design=1..5` selects one package; without it nothing here is active and the
 * game is exactly today's. Components read FIELDS of the active package, never
 * its id: `tests/design/noDesignBranching.test.ts` keeps `design ===`,
 * `data-design` reads and `DESIGN_PACKAGES[` out of every file but this one.
 *
 * The five colour maps are the spec 7.2 / 7.3 balances of the brand family (T4.1):
 * Nuit, Papier, Ambre, Prune and the derived tokens, one balance per package, no
 * two alike. Every declared pair is computed in tests/design/packageContrast.test.ts
 * (text >= 4.5, UI >= 3); Ambre is never text and never a boundary on Papier (2.16).
 * `framing` is the first-sound camera of the neutral room, tuned in T2.5
 * (`firstSoundFraming`); `nameKey` is a COPY key (section `design`; not shown
 * anywhere yet); `tell` is a design note, not a user string. The layout presets
 * and pacing are the spec 7.2 values.
 */
import { CREATION_TOKENS, type Hex, type RoleColours } from './creationTokens'

export type { Hex, RoleColours }

export type DesignId = 1 | 2 | 3 | 4 | 5
export const DESIGN_IDS: readonly DesignId[] = [1, 2, 3, 4, 5]

/** Tutorial step ids (spec 6.3; package 5 adds the two unplug steps of 7.2). The tutorial data (T3.1a) owns the list. */
export type StepId =
  | 'console'
  | 'micro'
  | 'enceinte'
  | 'console-enceinte'
  | 'micro-console'
  | 'lecture-console'
  | 'multiprise'
  | 'courant-console'
  | 'courant-enceinte'
  | 'ecoute'
  | 'debrancher'
  | 'rebrancher'

export interface LayoutPreset {
  panels: { tree: boolean; props: boolean }
  drawer: 'close-after-place' | 'stay-open'
  density: 'comfortable' | 'dense'
  surfaceStyle: 'raised' | 'flat' | 'banded' | 'sheet' | 'framed'
  /** 'tl' is forbidden: the view cube sits there (120-130 px). */
  oscarCorner: 'br' | 'bl' | 'tr'
  shortcutsBesideControls: boolean
  checklist: 'chip' | 'panel'
  start: 'neutral-room' | 'playable-model'
}

export interface Pacing {
  steps: readonly StepId[]
  /** 0 = no hint. */
  hintAfterMs: number
}

export interface OscarPolicy {
  leads: boolean
  proactive: boolean
}

/** A plain camera pose (the neutral module does not import Babylon; the rig adapts it). */
export interface FramingPose {
  alpha: number
  beta: number
  radius: number
  target: readonly [number, number, number]
}

export interface DesignPackage {
  id: DesignId
  nameKey: string
  tell: string
  colours: RoleColours
  layout: LayoutPreset
  pacing: Pacing
  presenter: 'step-card' | 'checklist'
  oscar: OscarPolicy
  framing: FramingPose
}

const T = CREATION_TOKENS.color

/**
 * Derived tints the packages declare (spec 7.3), each with its computed pairs in tests/design/packageContrast.test.ts. Nothing else outside the brand four and the
 * existing derived tokens (panel, panelLine, inkMuted, danger, ok) is allowed in a colour map (`ALLOWED_COLOURS`).
 *  - sheetInkMuted: Nuit 65 % over Papier, 5.53 on Papier, 4.90 on sheetInset.
 *  - sheetInset: Papier 94 % + Nuit 6 %, the second tone of a Papier sheet (hover and selection wash, a field's ground): Nuit 14.32, sheetInkMuted 4.90, Prune 8.13.
 *  - dangerOnSheet / okOnSheet: the error and success text on Papier (the bright ones, 2.09 and 1.62 on Papier, stay on the Nuit chrome): 6.50 and 5.48.
 *  - dangerOnPrune: the error text on a Prune panel (the bright one is 4.39 there): 5.49.
 */
const D = {
  sheetInkMuted: '#615E5C' as Hex,
  sheetInset: '#E6E0D7' as Hex,
  dangerOnSheet: '#9B2C20' as Hex,
  okOnSheet: '#2F6B3E' as Hex,
  dangerOnPrune: '#F7A59B' as Hex,
}

/** Every colour a package map may use: the brand four, the existing derived tokens, and the declared tints above (upper case). */
export const ALLOWED_COLOURS: ReadonlySet<string> = new Set(
  [T.nuit, T.papier, T.ambre, T.prune, T.panel, T.panelLine, T.inkMuted, T.danger, T.ok, ...Object.values(D)].map((h) => h.toUpperCase()),
)

const nuit = T.nuit as Hex
const papier = T.papier as Hex
const ambre = T.ambre as Hex
const prune = T.prune as Hex
const panel = T.panel as Hex
const panelLine = T.panelLine as Hex
const inkMuted = T.inkMuted as Hex
const danger = T.danger as Hex
const ok = T.ok as Hex

/** 1 « Pas à pas »: one lit thing (Ambre, the next target) on a dark screen; Prune about 3 % (the step card). Today's map, role by role. */
const coloursPasAPas: RoleColours = {
  ground: nuit, surface: panel, inset: nuit, ink: papier, inkMuted,
  accent: ambre, accentInk: nuit, accentEdge: ambre, accentText: ambre,
  secondary: prune, secondaryInk: papier, band: panel, bandInk: papier,
  focus: ambre, select: ambre, line: panelLine, danger, ok,
}
/** 2 « Atelier »: the same dark panels with Prune study-sheet bands (panel heads), about 20 % Prune; Ambre on the panels, Papier on the bands. */
const coloursAtelier: RoleColours = {
  ground: nuit, surface: panel, inset: nuit, ink: papier, inkMuted,
  accent: ambre, accentInk: nuit, accentEdge: ambre, accentText: ambre,
  secondary: prune, secondaryInk: papier, band: prune, bandInk: papier,
  focus: ambre, select: ambre, line: panelLine, danger, ok,
}
/** 3 « Salle d'abord »: a daylight Papier sheet. Ink and focus Nuit, links, selection and accent text Prune; the Ambre fill carries Nuit text and a 2 px Nuit edge. */
const coloursSalle: RoleColours = {
  ground: papier, surface: papier, inset: D.sheetInset, ink: nuit, inkMuted: D.sheetInkMuted,
  accent: ambre, accentInk: nuit, accentEdge: nuit, accentText: prune,
  secondary: prune, secondaryInk: papier, band: papier, bandInk: nuit,
  focus: nuit, select: prune, line: D.sheetInkMuted, danger: D.dangerOnSheet, ok: D.okOnSheet,
}
/** 4 « Pupitre »: flat, a hairline console, no raised panel, no Prune; the Ambre LED state on Nuit, Papier focus. */
const coloursPupitre: RoleColours = {
  ground: nuit, surface: nuit, inset: panel, ink: papier, inkMuted,
  accent: ambre, accentInk: nuit, accentEdge: ambre, accentText: ambre,
  secondary: nuit, secondaryInk: papier, band: nuit, bandInk: papier,
  focus: papier, select: ambre, line: inkMuted, danger, ok,
}
/** 5 « Modèle d'abord »: a Prune stage frame and Prune panels around the 3D view, about 45 % Prune; Papier ink and focus, Ambre fill with Nuit text, Nuit insets. */
const coloursModele: RoleColours = {
  ground: nuit, surface: prune, inset: nuit, ink: papier, inkMuted,
  accent: ambre, accentInk: nuit, accentEdge: ambre, accentText: papier,
  secondary: nuit, secondaryInk: papier, band: prune, bandInk: papier,
  focus: papier, select: ambre, line: inkMuted, danger: D.dangerOnPrune, ok,
}

/**
 * First-sound framing of the neutral room (T2.5 and the T2 review, ruling R-D), measured 2026-11-12 in Chromium at 1366 wide, Babylon's vertical fov 0.8.
 *
 * What is measured: the SCREEN BOX of the eight corners of a body's bounding box (`bodyBoundsInRoot` + `worldScreen`), not a pixel count of its silhouette; a thin
 * shape such as the SM58 (a 0.051 x 0.162 m body) is therefore measured by its box, which is never smaller than its silhouette's box. The canvas is the viewport minus the
 * menu bar and the status bar: 708 px high in a 768 px window, about 590 px in a 650 px window (a real 1366 x 768 laptop screen with the browser's own chrome).
 *
 * At the plain game's 19.2 m overview (clamp(max(w, l) x 0.8, 8, 55), sceneHost.ts buildScene) the SM58 box is 7.1 px, a QL1 23 px, a K12.2 30 px; the spec's 7 m
 * estimate gave the SM58 about 19 px, not 40. A body's size on screen is proportional to the canvas height over the camera distance, so `radius` is the radius AT A
 * 600 px CANVAS (src/creation/onboarding/framing.ts scales it with the real canvas height, never under the orbit camera's 2 m lower limit). Pose: from the front like the
 * default (alpha pi/2), beta 1.1, target on the floor at the room's centre (so the floor point under the middle of the view, where the product starts a placement, IS the
 * target), radius 2.2 m at 600 px (2.16 m at 590 px, 2.6 m at 708 px).
 *
 * What it holds (tests/e2e/onboarding-framing.spec.ts, 1366 x 650 and 1366 x 768): an SM58 on any floor point within 0.9 m sideways and 0.5 m in depth of the target is
 * at least 44 px on its widest axis (4 px of margin over the 40 px asked); measured 46.3 px at its smallest on a 590 px canvas (the QL1 182 px and the K12.2 209 px beside
 * it). That zone is a stated choice, the neighbourhood of where the product starts a placement; farther floor points are smaller, and the floor several metres away is visible
 * too. The view is close: from the fov and the canvas, an ESTIMATE (not measured), it spans about 1.8 m of height and 2.8 m of width at the target's distance on a 906 x 590
 * canvas. The profile opens the inventory drawer on this first room: it covers the lower 36 % of the view, and the SM58 and a QL1 placed at the starting point stay about 80 px
 * above its top (measured at 650 and 768). The five packages share this pose until a package changes its panels or its bars (T4.3): the radius does not depend on the
 * canvas width (the fov is vertical).
 */
const firstSoundFraming: FramingPose = { alpha: Math.PI / 2, beta: 1.1, radius: 2.2, target: [0, 0, 0] }

const ALL_STEPS: readonly StepId[] = [
  'console',
  'micro',
  'enceinte',
  'console-enceinte',
  'micro-console',
  'lecture-console',
  'multiprise',
  'courant-console',
  'courant-enceinte',
  'ecoute',
]

/** Recursively freezes plain objects and arrays: the colour map, the step list and the framing are SHARED between packages, one write would leak into all. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v)
  }
  return value
}

const DESIGN_PACKAGES: Readonly<Record<DesignId, DesignPackage>> = deepFreeze({
  1: {
    id: 1,
    nameKey: 'design.name1',
    tell: 'one lit thing on a dark screen',
    colours: coloursPasAPas,
    layout: {
      panels: { tree: false, props: false },
      drawer: 'stay-open',
      density: 'comfortable',
      surfaceStyle: 'raised',
      oscarCorner: 'br',
      shortcutsBesideControls: false,
      checklist: 'chip',
      start: 'neutral-room',
    },
    pacing: { steps: ALL_STEPS, hintAfterMs: 20_000 },
    presenter: 'step-card',
    oscar: { leads: true, proactive: true },
    framing: firstSoundFraming,
  },
  2: {
    id: 2,
    nameKey: 'design.name2',
    tell: 'Prune study-sheet bands',
    colours: coloursAtelier,
    layout: {
      panels: { tree: true, props: true },
      drawer: 'stay-open',
      density: 'dense',
      surfaceStyle: 'banded',
      oscarCorner: 'bl',
      shortcutsBesideControls: true,
      checklist: 'panel',
      start: 'neutral-room',
    },
    pacing: { steps: ALL_STEPS, hintAfterMs: 30_000 },
    presenter: 'checklist',
    oscar: { leads: false, proactive: true },
    framing: firstSoundFraming,
  },
  3: {
    id: 3,
    nameKey: 'design.name3',
    tell: 'a daylight Papier sheet',
    colours: coloursSalle,
    layout: {
      panels: { tree: false, props: true },
      drawer: 'stay-open',
      density: 'comfortable',
      surfaceStyle: 'sheet',
      oscarCorner: 'tr',
      shortcutsBesideControls: false,
      checklist: 'chip',
      start: 'neutral-room',
    },
    pacing: { steps: ALL_STEPS, hintAfterMs: 20_000 },
    presenter: 'step-card',
    oscar: { leads: true, proactive: true },
    framing: firstSoundFraming,
  },
  4: {
    id: 4,
    nameKey: 'design.name4',
    tell: 'flat, hairline console, no raised panel',
    colours: coloursPupitre,
    layout: {
      panels: { tree: true, props: true },
      drawer: 'close-after-place',
      density: 'dense',
      surfaceStyle: 'flat',
      oscarCorner: 'br',
      shortcutsBesideControls: true,
      checklist: 'chip',
      start: 'neutral-room',
    },
    pacing: { steps: ALL_STEPS, hintAfterMs: 0 },
    presenter: 'checklist',
    oscar: { leads: false, proactive: false },
    framing: firstSoundFraming,
  },
  5: {
    id: 5,
    nameKey: 'design.name5',
    tell: 'a Prune stage frame around the 3D view',
    colours: coloursModele,
    layout: {
      panels: { tree: true, props: false },
      drawer: 'close-after-place',
      density: 'comfortable',
      surfaceStyle: 'framed',
      oscarCorner: 'bl',
      shortcutsBesideControls: false,
      checklist: 'chip',
      start: 'playable-model',
    },
    // UNUSED until T6.3 builds the playable model (`tutorialSteps` falls back to the ten steps): restored by T6.3. Kept here as data.
    pacing: { steps: ['ecoute', 'debrancher', 'rebrancher'], hintAfterMs: 25_000 },
    presenter: 'step-card',
    oscar: { leads: true, proactive: true },
    framing: firstSoundFraming,
  },
})

/** Exactly one `design` key whose value is '1'..'5'; anything else (none, two keys, '0', '6', '01', '') is null. */
export function designFromSearch(search: string): DesignId | null {
  let all: string[]
  try {
    all = new URLSearchParams(search).getAll('design')
  } catch {
    return null
  }
  if (all.length !== 1) return null
  const v = all[0]
  return v === '1' || v === '2' || v === '3' || v === '4' || v === '5' ? (Number(v) as DesignId) : null
}

export function packageById(id: DesignId): DesignPackage {
  return DESIGN_PACKAGES[id]
}

/**
 * The steps a package's tutorial actually runs (T3 close review S1). A package that starts on the playable model (package 5) cannot run its own pacing until that
 * model exists (plan T6.3): it would open the empty neutral room and ask for Écoute first, a step no learner can complete there. Until then it runs the standard
 * ten steps (spec 6.3); its own `pacing.steps` stay as data, restored by T6.3. The start screen's « N étapes » and the guide's flow both read this.
 */
export function tutorialSteps(pkg: DesignPackage): readonly StepId[] {
  return pkg.layout.start === 'playable-model' ? ALL_STEPS : pkg.pacing.steps
}

/** The active package for this address, or null (no `?design`: today's behaviour). */
export function activePackage(search: string): DesignPackage | null {
  const id = designFromSearch(search)
  return id === null ? null : packageById(id)
}

/** The slice of `HTMLElement` the attribute needs (tests pass a fake). */
export interface AttributeRoot {
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
}

/** Sets `data-design` on `root` (the `<html>` element) when a package is active, removes it otherwise. Returns the package. */
export function applyDesignAttribute(root: AttributeRoot, search: string): DesignPackage | null {
  const pkg = activePackage(search)
  if (pkg) root.setAttribute('data-design', String(pkg.id))
  else root.removeAttribute('data-design')
  return pkg
}
