/** Types for tools/deploy-flag-guard.mjs (the tests are TypeScript; the script is plain Node). */
export const INBOX_ON: RegExp
export function findTestFlags(files: { path: string; text: string }[]): string[]
export function scanOutputForTestFlags(dir: string): string[]
export function formatFlagRefusal(paths: string[]): string
