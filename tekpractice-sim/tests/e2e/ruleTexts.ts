/**
 * The rule text an e2e spec expects Mode Création to SHOW, through one seam. Today the app shows the catalog text; the rule-text accessor of T1.5
 * (`ruleText()` in src/creation/ruleTexts.ts) will show Mode Création's own override for some rules. A spec that asks for the shown text calls these two
 * functions, so that change is made here once (the day the accessor exists these read it) and not in every spec.
 */
import catalog from '../../content/catalog.json'

const row = (id: string) => catalog.rules.find((r) => r.id === id)!

/** The title Mode Création shows for the rule. */
export const shownRuleTitle = (id: string): string => row(id).title_fr
/** The explanation (the fix) Mode Création shows for the rule: what the status list and Oscar's « Correction à apporter » bubble quote. */
export const shownRuleDetail = (id: string): string => row(id).teach_fr
