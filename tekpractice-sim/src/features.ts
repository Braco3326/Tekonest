/**
 * Feature flags (ADR-0013). `levels: false` hides levels/exams behind `?legacy=1` / `?level=`. `guide: false` removes the guide icon everywhere.
 * `guideLegacy: false` keeps the guide off on the level pages (`?level=a1|b1|c1|d1`): it ships dark there, on only in Mode Création; a level page shows it
 * when this flag is true or the address carries the explicit opt-in `oscar=legacy` (practice levels only; `oscar=0` still wins).
 */
export interface Features { levels: boolean; guide: boolean; guideLegacy: boolean }
export const FEATURES: Features = { levels: false, guide: true, guideLegacy: false }
