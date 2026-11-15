// The all-on feature table the unit tests and the end-to-end build run against (see vite.config.ts: TP_TEST_FEATURES=full, and every unit test). The assistant and
// the learning pages are ON here and OFF in the shipped product (src/features.ts), and so are the accounts (mission 1); only those three switches differ (the 2D schema page, `plan2d`, is on in both), and this
// table has no `defaultDesign` so a plain address of the tests keeps no package (tests/features.test.ts). Never part of a product build.
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
  defaultDesign?: 1 | 2 | 3 | 4 | 5
}
export const FEATURES: Features = { levels: false, legacyPages: true, guide: true, guideLegacy: false, guideInbox: false, goals: true, plainTutorial: true, accounts: true, plan2d: true }
