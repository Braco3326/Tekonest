/**
 * assets3d/env: environment helpers for the 3D-asset pipeline (Blender lookup, Meshy key).
 * Pure apart from the optional `process.env` / `fs` defaults, which tests replace by injected deps.
 * The Meshy key is a secret: it is never echoed in an error message, and `redact` scrubs it from any text
 * that is about to be logged.
 */
import { existsSync } from 'node:fs'

const DEFAULT_BLENDER = 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe'

export interface BlenderDeps {
  env: NodeJS.ProcessEnv
  exists: (p: string) => boolean
}

/** Blender executable: `BLENDER_EXE` when it exists, else the default 5.1 install path, else null. */
export function findBlender(deps: BlenderDeps = { env: process.env, exists: existsSync }): string | null {
  const fromEnv = deps.env.BLENDER_EXE
  if (fromEnv && deps.exists(fromEnv)) return fromEnv
  if (deps.exists(DEFAULT_BLENDER)) return DEFAULT_BLENDER
  return null
}

/** The Meshy API key. Throws without ever echoing a value. */
export function requireMeshyKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = env.MESHY_API_KEY
  if (!key) throw new Error('MESHY_API_KEY is not set')
  return key
}

/** Replaces every occurrence of `secret` in `text` with `***` (an empty secret leaves the text alone). */
export function redact(text: string, secret: string): string {
  if (!secret) return text
  return text.split(secret).join('***')
}
