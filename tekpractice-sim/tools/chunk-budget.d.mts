/** Types for tools/chunk-budget.mjs (the tests are TypeScript; the script is plain Node). */
export interface ManifestChunk {
  file: string
  src?: string
  name?: string
  isEntry?: boolean
  isDynamicEntry?: boolean
  imports?: string[]
  dynamicImports?: string[]
  css?: string[]
  assets?: string[]
}
/** Vite's `.vite/manifest.json`: key -> chunk. */
export type Manifest = Record<string, ManifestChunk>
/** `.vite/chunk-modules.json` (written by the chunkModules plugin of vite.config.ts): chunk file -> the project modules inside it. */
export type ChunkModules = Record<string, string[]>
export interface BudgetInput {
  manifest: Manifest
  chunkModules: ChunkModules
  /** File (relative to dist) -> raw bytes. */
  sizes: Record<string, number>
}
export interface BudgetRow {
  name: string
  /** Chunks in the static closure. */
  chunks: number
  js: number
  css: number
  /** js + css. */
  bytes: number
  /** null = informational row, no limit. */
  limit: number | null
}
export interface BudgetVerdict {
  ok: boolean
  rows: BudgetRow[]
  failures: string[]
}
export interface ForbiddenRule {
  id: string
  why: string
  match: (moduleId: string) => boolean
  optional?: boolean
}
export const RATIO: number
export const CREATION_ENTRY_MODULE: string
export const LEGACY_ENTRY_MODULE: string
export const ALLOWED_STATIC: string[]
export const FORBIDDEN_STATIC: ForbiddenRule[]
export function evaluateBudget(input: BudgetInput): BudgetVerdict
export function formatTable(verdict: BudgetVerdict): string
