/** Feature flags (ADR-0013). `levels: false` hides levels/exams behind `?legacy=1` / `?level=`. `guide: false` removes the guide icon. */
export interface Features { levels: boolean; guide: boolean }
export const FEATURES: Features = { levels: false, guide: true }
