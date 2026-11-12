/**
 * The colour pairs a package DECLARES (spec 7.3, plan T4.1): every foreground a role is allowed to be drawn in, on every background that role may sit on.
 * Computed by `contrastRatio` (WCAG 2.1), never asserted by hand: tests/design/packageContrast.test.ts walks this list for the five maps, and the browser suite
 * (tests/e2e/onboarding-contrast.spec.ts) then measures the colours actually in use.
 *
 * Text >= 4.5, UI (a focus ring, a border, a bar, a fill's edge) >= 3. Ambre on Papier is 2.16: it is neither text nor a boundary, and `pairPasses` says so.
 * Hairlines (`line`) are decorative and never the only boundary of a control: controls are bordered in `inkMuted`, which is declared here as a UI pair.
 */
import { contrastRatio, type Hex, type RoleColours } from './creationTokens'

export const TEXT_MIN = 4.5
export const UI_MIN = 3

export interface DeclaredPair {
  /** The role that draws (e.g. `focus`) and the role-pair label, for messages. */
  role: string
  fg: Hex
  bg: Hex
  kind: 'text' | 'ui'
  /** Where it is used, for the report and the messages. */
  where: string
}

export function pairRatio(p: DeclaredPair): number {
  return contrastRatio(p.fg, p.bg)
}

export function pairPasses(p: DeclaredPair): boolean {
  return pairRatio(p) >= (p.kind === 'text' ? TEXT_MIN : UI_MIN)
}

/** Every pair a colour map declares, in a stable order. */
export function declaredPairs(c: RoleColours): DeclaredPair[] {
  const out: DeclaredPair[] = []
  const on = (role: string, fg: Hex, kind: 'text' | 'ui', where: string, bgs: readonly (readonly [string, Hex])[]): void => {
    for (const [name, bg] of bgs) out.push({ role: `${role} on ${name}`, fg, bg, kind, where })
  }
  const all = [['surface', c.surface], ['ground', c.ground], ['inset', c.inset]] as const
  on('ink', c.ink, 'text', 'body text', all)
  on('inkMuted', c.inkMuted, 'text', 'secondary text, panel titles', all)
  on('accentText', c.accentText, 'text', 'hover text, glyphs, tags', all)
  on('danger', c.danger, 'text', 'error text', all)
  on('ok', c.ok, 'text', 'success text', all)
  on('accentInk', c.accentInk, 'text', 'text on an accent fill', [['accent', c.accent]])
  on('secondaryInk', c.secondaryInk, 'text', 'text on a secondary fill (step card, links)', [['secondary', c.secondary]])
  on('bandInk', c.bandInk, 'text', 'text and focus ring on a band', [['band', c.band]])
  on('focus', c.focus, 'ui', 'focus ring', all)
  on('select', c.select, 'ui', 'selection and hover borders and bars', all)
  on('accentEdge', c.accentEdge, 'ui', 'edge of an accent fill', [['surface', c.surface], ['ground', c.ground]])
  on('inkMuted', c.inkMuted, 'ui', 'control borders (fields, buttons)', all)
  on('bandInk', c.bandInk, 'ui', 'focus ring and icons on a band', [['band', c.band]])
  // The fills the CSS paints text or marks on (T4 fix round, C1): a band carries the muted ink (panel titles) and the selection role (bars, icons); an accent fill carries accentInk and a
  // secondary fill secondaryInk (both above). `line` is NOT a fill: it is a hairline (1.97 : 1 under the ink in packages 4 and 5), the washes are `inset`.
  on('inkMuted', c.inkMuted, 'text', 'secondary text on a band', [['band', c.band]])
  on('select', c.select, 'ui', 'selection marks on a band', [['band', c.band]])
  return out
}

/** A pair of two roles of a map, for a test to craft (a role painted on a role the CSS must not paint it on). */
export function craftedPair(c: RoleColours, fgRole: keyof RoleColours, bgRole: keyof RoleColours, kind: 'text' | 'ui'): DeclaredPair {
  return { role: `${fgRole} on ${bgRole}`, fg: c[fgRole], bg: c[bgRole], kind, where: 'crafted' }
}
