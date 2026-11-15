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
import { PRACTICE_CLASS } from './practice'

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
  /**
   * The first question of the start screen (mission 1, spec 1.2 and 6): the four profiles, or the goal screens (only where the feature table's `goals` is on; the
   * profiles otherwise). Package 2 asks the goals; the others keep their own start screen.
   */
  firstQuestion: 'profiles' | 'goals'
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
 *  - washOnPrune: Prune 90 % + Papier 10 %, the hover / selected wash on a Prune panel: ink 7.06, Ambre bar 3.27 (a lighter one drops the bar under 3), 1.30 against the panel.
 */
const D = {
  sheetInkMuted: '#615E5C' as Hex,
  sheetInset: '#E6E0D7' as Hex,
  dangerOnSheet: '#9B2C20' as Hex,
  okOnSheet: '#2F6B3E' as Hex,
  dangerOnPrune: '#F7A59B' as Hex,
  washOnPrune: '#704055' as Hex,
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
  ground: nuit, surface: panel, inset: nuit, wash: panelLine, ink: papier, inkMuted,
  accent: ambre, accentInk: nuit, accentEdge: ambre, accentText: ambre,
  secondary: prune, secondaryInk: papier, band: panel, bandInk: papier,
  focus: ambre, select: ambre, line: panelLine, danger, ok,
}
/** 2 « Atelier »: the same dark panels with Prune study-sheet bands (panel heads), about 20 % Prune; Ambre on the panels, Papier on the bands. */
const coloursAtelier: RoleColours = {
  ground: nuit, surface: panel, inset: nuit, wash: panelLine, ink: papier, inkMuted,
  accent: ambre, accentInk: nuit, accentEdge: ambre, accentText: ambre,
  secondary: prune, secondaryInk: papier, band: prune, bandInk: papier,
  focus: ambre, select: ambre, line: panelLine, danger, ok,
}
/** 3 « Salle d'abord »: a daylight Papier sheet. Ink and focus Nuit, links, selection and accent text Prune; the Ambre fill carries Nuit text and a 2 px Nuit edge. */
const coloursSalle: RoleColours = {
  ground: papier, surface: papier, inset: D.sheetInset, wash: D.sheetInset, ink: nuit, inkMuted: D.sheetInkMuted,
  accent: ambre, accentInk: nuit, accentEdge: nuit, accentText: prune,
  secondary: prune, secondaryInk: papier, band: papier, bandInk: nuit,
  focus: nuit, select: prune, line: D.sheetInkMuted, danger: D.dangerOnSheet, ok: D.okOnSheet,
}
/** 4 « Pupitre »: flat, a hairline console, no raised panel, no Prune; the Ambre LED state on Nuit, Papier focus. */
const coloursPupitre: RoleColours = {
  ground: nuit, surface: nuit, inset: panel, wash: panelLine, ink: papier, inkMuted,
  accent: ambre, accentInk: nuit, accentEdge: ambre, accentText: ambre,
  secondary: nuit, secondaryInk: papier, band: nuit, bandInk: papier,
  focus: papier, select: ambre, line: inkMuted, danger, ok,
}
/** 5 « Modèle d'abord »: a Prune stage frame and Prune panels around the 3D view, about 45 % Prune; Papier ink and focus, Ambre fill with Nuit text, Nuit insets. */
const coloursModele: RoleColours = {
  ground: nuit, surface: prune, inset: nuit, wash: D.washOnPrune, ink: papier, inkMuted,
  accent: ambre, accentInk: nuit, accentEdge: ambre, accentText: papier,
  secondary: nuit, secondaryInk: papier, band: prune, bandInk: papier,
  focus: papier, select: ambre, line: inkMuted, danger: D.dangerOnPrune, ok,
}

/**
 * First-sound framing of the neutral room (T2.5), measured 2026-11-12 in Chromium at 1366 wide, Babylon's vertical fov 0.8.
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

/**
 * The first-room framing of package 5 (T6.3): the playable model, not the empty neutral room. The five devices of content/templates/premier-son-pret.json stand 10.5 m apart in
 * depth (the QL1 at z = 4, the two K12.2 on stands at z = -5.5 and x = +-3, the SM58 and the strip behind), so the neutral room's close pose (target at the room's centre, radius
 * 2.2 m) shows only floor. This pose looks from the front of house toward the stage, low and far enough to hold all five at once. `radius` is at a 600 px canvas, as
 * `firstSoundFraming` (framing.ts scales it with the canvas height).
 *
 * Computed, then measured (tests/e2e/onboarding-model.spec.ts): the scene's own projection (vertical fov 0.8, calibrated against `worldScreen` on the real page to 0.2 px) of the
 * eight corners of an estimated box around each body, searched over beta, radius and target for the pose that holds all five inside the canvas AND above the inventory drawer's top
 * (the profile opens the drawer on the first room: it covers the lower 36 % of the view) at both canvas heights of the framing spec (659 and 541 px), with the QL1 and the two speakers
 * as large as possible. At 1366 x 768 the QL1 is about 150 px wide, each K12.2 about 40 px, the SM58 about 11 px (a mic is a small thing at this distance: the model is read as a whole,
 * the unplug step rings the console's end of the cable). The speakers are on the side the learner expects: stage left and right as seen from the console.
 */
const modelFraming: FramingPose = { alpha: Math.PI / 2, beta: 1.3, radius: 6.5, target: [0, 0, 3] }

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
      firstQuestion: 'profiles',
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
      firstQuestion: 'goals',
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
      firstQuestion: 'profiles',
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
      firstQuestion: 'profiles',
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
      firstQuestion: 'profiles',
    },
    // Runs on the playable model the start opens (T6.3): the sound, one unplug, the replug.
    pacing: { steps: ['ecoute', 'debrancher', 'rebrancher'], hintAfterMs: 25_000 },
    presenter: 'step-card',
    oscar: { leads: true, proactive: true },
    framing: modelFraming,
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
 * The steps a package's tutorial runs: its pacing data, for every package. Package 5 starts on the playable model (`layout.start`, T6.3), a bench that is already wired and
 * powered, so its run is the three steps `ecoute`, `debrancher`, `rebrancher` (spec 7.2); the others start in the empty neutral room and run the ten of spec 6.3. (Between T3
 * and T6.3 package 5 fell back to the ten steps, because its first room was the empty neutral room where a sound cannot start: the fallback is gone.) The start screen's
 * « N étapes », the step card's n and the guide's flow all read this.
 */
export function tutorialSteps(pkg: DesignPackage): readonly StepId[] {
  return pkg.pacing.steps
}

/**
 * The active package for this address: its valid `?design`, else `fallback` (the caller's default package, mission 1: `defaultDesignFor`), else null (no package:
 * the plain address as it was). Pure: the caller decides the fallback, this module never reads the feature table.
 */
export function activePackage(search: string, fallback: DesignId | null = null): DesignPackage | null {
  const id = designFromSearch(search) ?? fallback
  return id === null ? null : packageById(id)
}

/**
 * The package a page opens with when its address carries no valid `?design` (mission 1, spec 1.1): the feature table's `defaultDesign`, on a practice address only. An exam
 * address (the onboarding entirely off) keeps no package; an absent or unknown value is no package.
 */
export function defaultDesignFor(o: { practice: boolean; defaultDesign?: DesignId }): DesignId | null {
  if (!o.practice || o.defaultDesign === undefined) return null
  return DESIGN_IDS.includes(o.defaultDesign) ? o.defaultDesign : null
}

/** The slice of `HTMLElement` the attribute needs (tests pass a fake). */
export interface AttributeRoot {
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
}

/** Sets `data-design` on `root` (the `<html>` element) when a package is active (`activePackage`, with the caller's `fallback`), removes it otherwise. Returns the package. */
export function applyDesignAttribute(root: AttributeRoot, search: string, fallback: DesignId | null = null): DesignPackage | null {
  const pkg = activePackage(search, fallback)
  if (pkg) root.setAttribute('data-design', String(pkg.id))
  else root.removeAttribute('data-design')
  return pkg
}

export { PRACTICE_CLASS }

/** The slice of `<html>` that says which package's look applies (tests pass a fake). */
export interface LookRoot {
  getAttribute(name: string): string | null
  classList: { contains(token: string): boolean }
}

/** The package whose layout preset and colours apply to this page: a valid `data-design` AND the practice class; null otherwise (plain, exam, legacy). */
export function lookOfRoot(root: LookRoot): DesignPackage | null {
  if (!root.classList.contains(PRACTICE_CLASS)) return null
  const v = root.getAttribute('data-design')
  return v === '1' || v === '2' || v === '3' || v === '4' || v === '5' ? packageById(Number(v) as DesignId) : null
}

/**
 * Writes the layout attributes the stylesheets (src/design/packages.css) and the drawer read, from the package's preset: `data-surface`, `data-density`, `data-drawer`
 * (`close-after-place` | `stay-open`) and `data-shortcuts` (`beside`: the menu shows an item's shortcut right beside its label, T6.2; `end`: at the end of the row, today's look). No package removes them. Selecting on these (never on the package number) is what keeps the no-branching lint true.
 */
export function applyLookAttributes(root: AttributeRoot, pkg: DesignPackage | null): void {
  if (pkg === null) {
    for (const a of ['data-surface', 'data-density', 'data-drawer', 'data-shortcuts']) root.removeAttribute(a)
    return
  }
  root.setAttribute('data-surface', pkg.layout.surfaceStyle)
  root.setAttribute('data-density', pkg.layout.density)
  root.setAttribute('data-drawer', pkg.layout.drawer)
  root.setAttribute('data-shortcuts', pkg.layout.shortcutsBesideControls ? 'beside' : 'end')
}
