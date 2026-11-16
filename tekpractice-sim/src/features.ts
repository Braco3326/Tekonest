/**
 * Feature flags (ADR-0013). The shipped product (2026-11-15, founder): Mode Création only. The assistant (`guide`) and the learning game (levels, exam, sandbox,
 * dashboard: `legacyPages`) are OFF until he says otherwise; the code stays and one switch each brings it back. The key order below is read by
 * tools/deploy-flag-guard.mjs (levels, legacyPages, guide, guideLegacy, guideInbox, goals, plainTutorial, accounts, plan2d, cableTrace, and nothing after it): keep it.
 * `levels: false` keeps the default URL on Mode Création (true sends it to the learning pages, only if `legacyPages` is on).
 * `legacyPages: false` makes every address that used to open the learning game (`?level=`, `?legacy=1`, an exam, the sandbox, the dashboard) open Mode Création
 * instead; true or absent keeps them (a table written before it still type-checks and behaves as it did).
 * `guide: false` removes the guide icon everywhere, and with it the tutorial « Premiers pas » (it runs in the guide's bubble): the start screen, the profiles and
 * « Pourquoi je n’entends rien ? » stay.
 * `guideLegacy: false` keeps the guide off on the level pages (`?level=a1|b1|c1|d1`): it ships dark there, on only in Mode Création; a level page shows it
 * when this flag is true or the address carries the explicit opt-in `oscar=legacy` (practice levels only; `oscar=0` still wins).
 * `guideInbox: false` keeps the unanswered-questions inbox of the guide dark: with it off nothing is recorded, no storage key is created and no global is
 * defined (optional, so a table of flags written before it still type-checks). It is turned on by hand, for testing by hand only; there is no address that turns it on.
 * Mission 1 (2026-11-15, spec docs/superpowers/specs/2026-11-15-accounts-and-goals-design.md §2), all optional (a table written before them still type-checks):
 * `goals: true` asks the goal screens (goal, sub-choice, speciality) instead of the four profiles on a package whose `layout.firstQuestion` is `goals`, filters the place
 * picker by the stored goal and names it in the chip; false or absent keeps the profiles.
 * `plainTutorial: true` turns on the plain tutorial « Premiers pas » (no assistant, no guide code); false or absent keeps it off.
 * `accounts: false` keeps everything about accounts out of the page; the deploy guard REFUSES an output whose table has it true (until the founder approves the privacy
 * text and supplies the keys).
 * Mission 2 (2026-11-15, spec docs/superpowers/specs/2026-11-15-plan2d-schema-design.md §2), optional: `plan2d: true` adds « Schéma 2D » (menu Vue) on a practice address: the
 * 2D floor plan page, a lazy chunk loaded on first open; false or absent keeps every trace of it out of the page (no entry, no chunk fetched, no storage key).
 * Mission 3 B stage 2 (2026-11-15, spec docs/superpowers/specs/2026-11-15-hand-drawn-cables-design.md), optional: `cableTrace: true` lets the learner select a cable (a click,
 * its row in « Câbles »), see it in Propriétés and trace its route on the floor (« Tracer le câble »: the drawing bar, the grid, the handles; the scene part is a lazy
 * chunk). False or absent: a cable is not selectable, the panel, the bar, the keys and the chunk are out of the page (a route already saved is still drawn).
 * `defaultDesign` (1..5, optional): the package a practice address opens with when it carries no valid `?design` (an exam address keeps no package); absent = no
 * package (the classic look, the plain app as it was before the five packages). The product ships with NONE, by the founder’s order 2026-11-16 (build on the
 * classic design now, the designs change later): `?design=1..5` still opens a package when asked for. With no package, the goal screens, the plain tutorial and
 * the start screen are dormant on a plain address (they run only under a package whose `layout.firstQuestion` is `goals`, src/creation/boot.ts). The deploy
 * guard refuses a table that carries any `defaultDesign`.
 * The unit tests and the end-to-end build run against the all-on table tests/e2e/fixtures/features.full.ts (vite.config.ts): see tests/features.test.ts.
 */
export interface Features {
  levels: boolean
  legacyPages?: boolean
  guide: boolean
  guideLegacy: boolean
  guideInbox?: boolean
  goals?: boolean
  plainTutorial?: boolean
  accounts?: boolean
  plan2d?: boolean
  cableTrace?: boolean
  defaultDesign?: 1 | 2 | 3 | 4 | 5
}
export const FEATURES: Features = { levels: false, legacyPages: false, guide: false, guideLegacy: false, guideInbox: false, goals: true, plainTutorial: true, accounts: false, plan2d: true, cableTrace: true }
