/**
 * Mode Création's rule texts (T1.5, spec 6.5 and Appendix A): the ONE host-side accessor.
 *
 * The catalog's `teach_fr` of R1 to R5 says things a simulator must not say (« il ne faut jamais forcer », « peuvent endommager le matériel »,
 * « contrat de sécurité », two figures with no source record). `content/catalog.json` is never edited (the legacy Essais hash `rulesRevOf(catalog.rules)`
 * covers it, and the legacy route keeps the old texts), so Mode Création reads the rows through `creationRuleRows`: the same rows with `teach_fr`
 * replaced, by rule id, from COPY.ruleOverride. Titles and the English fields are never touched. R6 to R8 have no override.
 *
 * Read sites (all pass the rows through here): the status list (boot.ts), the « Connecter à… » default reason (connectModel.ts), Oscar's answer
 * to a rule's title and Oscar's verdict (mount.ts hands the creation route `creationRuleRows(rules)`; the legacy route hands the catalog rows).
 * Pure: no DOM, no Babylon, no catalog import (the caller owns the rows).
 */
import { COPY } from './copy'
import { ruleTextFor, type RuleRow, type RuleText } from './shell/statusModel'

/** The rule ids Mode Création words itself (the keys of COPY.ruleOverride). */
export const RULE_OVERRIDE_IDS: readonly string[] = ['R1', 'R2', 'R3', 'R4', 'R5']

/** The rows with Mode Création's `teach_fr` applied: a new list, the given rows are never written to. A row without an override is returned as is. */
export function creationRuleRows<T extends RuleRow>(rows: readonly T[]): T[] {
  const overrides = COPY.ruleOverride ?? {}
  return rows.map((row) => {
    const text = Object.prototype.hasOwnProperty.call(overrides, row.id) ? overrides[row.id] : undefined
    // A row with no French title degrades to its id in `ruleTextFor` (never to the English text): do not dress it up with an override.
    return text !== undefined && row.title_fr ? { ...row, teach_fr: text } : row
  })
}

/** The accessor Mode Création surfaces share: a `RuleText` over the overridden rows (the status list, the connect dialog, the verdict read this). */
export function creationRuleText(rows: readonly RuleRow[]): RuleText {
  return ruleTextFor(creationRuleRows(rows))
}

/** The title and the text Mode Création shows for one rule id; an unknown id falls back exactly as `ruleTextFor` does. */
export function ruleText(ruleId: string, rows: readonly RuleRow[]): { title: string; detail: string } {
  return creationRuleText(rows)(ruleId)
}
