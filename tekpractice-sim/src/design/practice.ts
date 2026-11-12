/**
 * The class `src/main.ts` puts on <html> on a PRACTICE address (the guide's own mode gate: no `?mode=`, `?level=` or `?legacy=`; ruling R-A). On an exam address a valid `?design`
 * still marks the design attribute on html (T0.1) but the layout and the look do not apply: exam addresses stay unchanged. Its own tiny module so the entry (`main.ts`) names it without loading
 * the package table (T4 fix round, N4); `src/design/packages.ts` re-exports it and reads it in `lookOfRoot`.
 */
export const PRACTICE_CLASS = 'cr-practice'
