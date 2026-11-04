/**
 * Minimal typing for the Khronos glTF validator (gltf-validator, the package ships none). Only what
 * tools/assets3d/validateGltf.ts uses: validateBytes and the issue summary of its report.
 */
declare module 'gltf-validator' {
  /** 0 error, 1 warning, 2 info, 3 hint. */
  export type Severity = 0 | 1 | 2 | 3
  export interface ValidatorMessage {
    code: string
    message: string
    severity: Severity
    pointer?: string
    offset?: number
  }
  export interface ValidationReport {
    issues: {
      numErrors: number
      numWarnings: number
      numInfos: number
      numHints: number
      messages: ValidatorMessage[]
      truncated: boolean
    }
  }
  export interface ValidationOptions {
    uri?: string
    format?: 'glb' | 'gltf'
    maxIssues?: number
    ignoredIssues?: string[]
    severityOverrides?: Record<string, Severity>
  }
  export function validateBytes(data: Uint8Array, options?: ValidationOptions): Promise<ValidationReport>
  export function version(): string
}
