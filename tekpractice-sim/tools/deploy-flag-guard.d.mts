/** Types for tools/deploy-flag-guard.mjs (the tests are TypeScript; the script is plain Node). */
export const INBOX_ON: RegExp
export const PAGES_ON: RegExp
export const GUIDE_ON: RegExp
export const ACCOUNTS_ON: RegExp
export const PRODUCT_TABLE: RegExp
export function findTestFlags(files: { path: string; text: string }[]): string[]
export function scanOutputForTestFlags(dir: string): string[]
export function hasProductTable(dir: string): boolean
export function formatFlagRefusal(paths: string[]): string
export function formatMissingTableRefusal(): string
