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
 * today's tokens, the same for the five packages; `framing` is the default
 * camera of the blank room (T2.5 measures and tunes it); `nameKey` is a COPY
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

/** PLACEHOLDER: the default camera of the blank room (sceneHost.ts buildScene; radius clamp(24 x 0.8, 8, 55) = 19.2). */
const defaultFraming: FramingPose = { alpha: Math.PI / 2, beta: 1.05, radius: 19.2, target: [0, 1, 0] }

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

const DESIGN_PACKAGES: Readonly<Record<DesignId, DesignPackage>> = {
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
    framing: defaultFraming,
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
    framing: defaultFraming,
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
    framing: defaultFraming,
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
    framing: defaultFraming,
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
    pacing: { steps: ['ecoute', 'debrancher', 'rebrancher'], hintAfterMs: 25_000 },
    presenter: 'step-card',
    oscar: { leads: true, proactive: true },
    framing: defaultFraming,
  },
}

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
