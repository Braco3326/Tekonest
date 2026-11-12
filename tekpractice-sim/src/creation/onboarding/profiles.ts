/**
 * The four profiles of the first visit (onboarding packs, plan T2.2, spec 3): data only. A profile is chosen on the start screen, labelled by
 * the learner's situation (never by a job title or a level), and decides which offer button takes the focus, which inventory tab and panels the
 * neutral room opens with, whether Oscar speaks first, and what follows the first sound. No profile locks a feature or changes catalog, rules
 * or engine. Profiles and design packages are separate axes: `panels: 'package'` means « the active package's layout decides ».
 */
import type { InventoryTab } from '../inventory'
import type { ProfileId } from './state'

export type { ProfileId } from './state'

export interface ProfilePreset {
  id: ProfileId
  key: '1' | '2' | '3' | '4'
  /** COPY.onboarding key of the button text. */
  labelKey: string
  /** The offer button that has the focus (Enter accepts it). The other one is always there too. */
  offerFocus: 'tutorial' | 'skip'
  inventoryTab: InventoryTab
  panels: { tree: boolean; props: boolean } | 'package'
  /** false = Oscar starts muted (no auto-raise); the icon stays. */
  oscarProactive: boolean
  afterFirstSound: 'none' | 'own-gear-and-venues'
}

const table: readonly ProfilePreset[] = [
  { id: 'decouvre', key: '1', labelKey: 'profileDecouvre', offerFocus: 'tutorial', inventoryTab: 'consoles', panels: 'package', oscarProactive: true, afterFirstSound: 'none' },
  { id: 'etudie', key: '2', labelKey: 'profileEtudie', offerFocus: 'skip', inventoryTab: 'consoles', panels: { tree: true, props: true }, oscarProactive: true, afterFirstSound: 'none' },
  { id: 'projet', key: '3', labelKey: 'profileProjet', offerFocus: 'tutorial', inventoryTab: 'consoles', panels: 'package', oscarProactive: true, afterFirstSound: 'own-gear-and-venues' },
  { id: 'metier', key: '4', labelKey: 'profileMetier', offerFocus: 'skip', inventoryTab: 'consoles', panels: { tree: true, props: true }, oscarProactive: false, afterFirstSound: 'none' },
]

/** Frozen, in key order: the start screen lists them in this order. */
export const PROFILES: readonly ProfilePreset[] = Object.freeze(
  table.map((p) => Object.freeze({ ...p, panels: typeof p.panels === 'string' ? p.panels : Object.freeze({ ...p.panels }) }))
)

export function profileById(id: ProfileId): ProfilePreset {
  return PROFILES.find((p) => p.id === id)!
}

/** The profile bound to a pressed digit, or undefined. */
export function profileByKey(key: string): ProfilePreset | undefined {
  return PROFILES.find((p) => p.key === key)
}

/**
 * The side panels the first room opens with: the profile's own, or, for `'package'`, the active package's layout (`layout.panels`). A fresh object: the
 * frozen tables are never handed to code that may keep them.
 */
export function panelsFor(preset: ProfilePreset, packagePanels: { tree: boolean; props: boolean }): { tree: boolean; props: boolean } {
  const p = preset.panels === 'package' ? packagePanels : preset.panels
  return { tree: p.tree, props: p.props }
}
