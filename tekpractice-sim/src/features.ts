/** Feature flags (ADR-0013). `levels: false` hides levels/exams behind `?legacy=1` / `?level=`. */
export interface Features { levels: boolean }
export const FEATURES: Features = { levels: false }
