/**
 * Design packages skeleton (onboarding spec 7.1, plan T0.1). `src/design` is
 * neutral: the shell and the guide both import it.
 *
 * `?design=1..5` selects one package; without it nothing here is active and the
 * game is exactly today's. Components read FIELDS of the active package, never
 * its id: `tests/design/noDesignBranching.test.ts` keeps `design ===`,
 * `data-design` reads and `DESIGN_PACKAGES[` out of every file but this one.
 *
 * PLACEHOLDERS (replaced by plan T4.1, spec 7.2 / 7.3): the colour maps are
 * today's tokens, the same for the five packages; `framing` is the first-sound
 * camera of the neutral room, tuned in T2.5 (`firstSoundFraming`); `nameKey` is a COPY
 * key that T4.1 creates (not shown anywhere yet); `tell` is a design note, not
 * a user string. The layout presets and pacing are the spec 7.2 values.
 */
import { CREATION_TOKENS } from './creationTokens'

export type DesignId = 1 | 2 | 3 | 4 | 5
export const DESIGN_IDS: readonly DesignId[] = [1, 2, 3, 4, 5]

export type Hex = `#${string}`

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

/** Brand colours or a declared derived tint, each with its computed pairs (T4.1). */
export interface RoleColours {
  ground: Hex
  surface: Hex
  ink: Hex
  inkMuted: Hex
  accent: Hex
  accentInk: Hex
  secondary: Hex
  secondaryInk: Hex
  /** `--cr-focus`: replaces the hard-coded Ambre of the focus outline (T4.2). */
  focus: Hex
  /** `--cr-select`: selection and hover borders (T4.2). */
  select: Hex
}

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

/** PLACEHOLDER: today's tokens (T4.1 declares the five real maps). */
const todayColours: RoleColours = {
  ground: T.nuit as Hex,
  surface: T.panel as Hex,
  ink: T.papier as Hex,
  inkMuted: T.inkMuted as Hex,
  accent: T.ambre as Hex,
  accentInk: T.nuit as Hex,
  secondary: T.prune as Hex,
  secondaryInk: T.papier as Hex,
  focus: T.ambre as Hex,
  select: T.ambre as Hex,
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
    nameKey: 'design.1.name',
    tell: 'one lit thing on a dark screen',
    colours: todayColours,
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
    nameKey: 'design.2.name',
    tell: 'Prune study-sheet bands',
    colours: todayColours,
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
    nameKey: 'design.3.name',
    tell: 'a daylight Papier sheet',
    colours: todayColours,
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
    nameKey: 'design.4.name',
    tell: 'flat, hairline console, no raised panel',
    colours: todayColours,
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
    nameKey: 'design.5.name',
    tell: 'a Prune stage frame around the 3D view',
    colours: todayColours,
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
