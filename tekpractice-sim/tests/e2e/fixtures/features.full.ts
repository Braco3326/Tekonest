// The all-on feature table the unit tests and the end-to-end build run against (see vite.config.ts: TP_TEST_FEATURES=full, and every unit test). The assistant and
// the learning pages are ON here and OFF in the shipped product (src/features.ts); only those two switches differ (tests/features.test.ts). Never part of a product build.
export interface Features { levels: boolean; legacyPages?: boolean; guide: boolean; guideLegacy: boolean; guideInbox?: boolean }
export const FEATURES: Features = { levels: false, legacyPages: true, guide: true, guideLegacy: false, guideInbox: false }
