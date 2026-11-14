// The feature table of the test-only build that has the guide's inbox switched on (see vite.config.ts, TP_TEST_FEATURES=guideInbox). Never part of a product build.
export interface Features { levels: boolean; guide: boolean; guideLegacy: boolean; guideInbox?: boolean }
export const FEATURES: Features = { levels: false, guide: true, guideLegacy: false, guideInbox: true }
