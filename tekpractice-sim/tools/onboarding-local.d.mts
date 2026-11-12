/** Types for tools/onboarding-local.mjs (the tests are TypeScript; the script is plain Node). */
export const LOCAL_PORT: 4392
/** The five package addresses, `?design=1` to `?design=5`, in order. */
export function designAddresses(port?: number): string[]
/** How to see the first visit again: the narrow reset first, then the full clear with its warning. */
export function resetTip(): string
/** The command (program, args) that stops a process and its children, or null when a plain kill is enough. */
export function killTreeCommand(pid: number, platform?: string): [string, string[]] | null
