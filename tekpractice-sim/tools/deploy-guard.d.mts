/** Types for tools/deploy-guard.mjs (the tests are TypeScript; the script is plain Node). */
export interface SecretVar {
  name: string
  /** `the environment` or the `.env*` file name. Never a value. */
  source: string
}
export const SECRET_VAR: RegExp
export function findSecretVars(input: { env?: Record<string, string | undefined>; rootDir: string }): SecretVar[]
export function formatRefusal(found: SecretVar[]): string
