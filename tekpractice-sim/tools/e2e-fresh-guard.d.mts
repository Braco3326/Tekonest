/** Types for tools/e2e-fresh-guard.mjs (the tests are TypeScript; the script is plain Node). */
export const FORBIDDEN_E2E_PORTS: readonly number[]
export function checkE2ePort(env: Record<string, string | undefined>): { ok: boolean; message: string }
