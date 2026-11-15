/**
 * Feature flags (ADR-0013). The shipped product (2026-11-15, founder): Mode Création only. The assistant (`guide`) and the learning game (levels, exam, sandbox,
 * dashboard: `legacyPages`) are OFF until he says otherwise; the code stays and one switch each brings it back. The key order below is read by
 * tools/deploy-flag-guard.mjs (levels, legacyPages, guide, guideLegacy, guideInbox): keep it.
 * `levels: false` keeps the default URL on Mode Création (true sends it to the learning pages, only if `legacyPages` is on).
 * `legacyPages: false` makes every address that used to open the learning game (`?level=`, `?legacy=1`, an exam, the sandbox, the dashboard) open Mode Création
 * instead; true or absent keeps them (a table written before it still type-checks and behaves as it did).
 * `guide: false` removes the guide icon everywhere, and with it the tutorial « Premiers pas » (it runs in the guide's bubble): the start screen, the profiles and
 * « Pourquoi je n’entends rien ? » stay.
 * `guideLegacy: false` keeps the guide off on the level pages (`?level=a1|b1|c1|d1`): it ships dark there, on only in Mode Création; a level page shows it
 * when this flag is true or the address carries the explicit opt-in `oscar=legacy` (practice levels only; `oscar=0` still wins).
 * `guideInbox: false` keeps the unanswered-questions inbox of the guide dark: with it off nothing is recorded, no storage key is created and no global is
 * defined (optional, so a table of flags written before it still type-checks). It is turned on by hand, for testing by hand only; there is no address that turns it on.
 * The unit tests and the end-to-end build run against the all-on table tests/e2e/fixtures/features.full.ts (vite.config.ts): see tests/features.test.ts.
 */
export interface Features { levels: boolean; legacyPages?: boolean; guide: boolean; guideLegacy: boolean; guideInbox?: boolean }
export const FEATURES: Features = { levels: false, legacyPages: false, guide: false, guideLegacy: false, guideInbox: false }
