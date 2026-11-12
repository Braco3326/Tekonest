/**
 * The rule text an e2e spec expects Mode Création to SHOW, through one seam. Mode Création shows its own wording of R1 to R5 (the override of T1.5,
 * `ruleText()` in src/creation/ruleTexts.ts) and the catalog text for R6 to R8; a spec that asks for the shown text calls these two functions, so a change of
 * wording is made once and no spec pins the catalog text of a rule Mode Création words itself. The LEGACY route (`?level=...`) is not behind this seam: it
 * shows the catalog and its specs read `catalog.rules` directly. tests/e2e/rule-texts.spec.ts pins the override texts from COPY.ruleOverride (itself pinned
 * to Appendix A by tests/creation/ruleOverrides.test.ts), so this seam is not circular there.
 */
import catalog from '../../content/catalog.json'
import { ruleText } from '../../src/creation/ruleTexts'

/** The title Mode Création shows for the rule. */
export const shownRuleTitle = (id: string): string => ruleText(id, catalog.rules).title
/** The explanation (the fix) Mode Création shows for the rule: what the status list, the connect dialog and Oscar (the verdict bubble, an answer) quote. */
export const shownRuleDetail = (id: string): string => ruleText(id, catalog.rules).detail
