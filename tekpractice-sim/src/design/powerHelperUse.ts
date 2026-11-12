/**
 * The power helper's last use (onboarding spec 6.5, plan T3.3), under `tekpractice.power-helper.v1`. Neutral: Mode Création writes it after a successful
 * « Je branche pour vous » (src/creation/onboarding/wire.ts), the guide reads it on its next look at the bench (src/guide/tutorial.ts) so that the tutorial
 * steps the helper did are marked « montré », never « déjà en place » nor a success; neither imports the other. `n` only grows; `instances` = the devices the
 * helper cabled that time. Every access in try/catch: a blocked storage loses the mark (the steps then read « déjà en place »), never the cables. Pure: no DOM.
 */
export const POWER_HELPER_KEY = 'tekpractice.power-helper.v1'

export interface PowerHelperUse {
  v: 1
  n: number
  instances: string[]
}

type Readable = { getItem(key: string): string | null }
type Writable = Readable & { setItem(key: string, value: string): void }

/** The last use in `raw`, or null when missing or malformed. */
export function parsePowerHelperUse(raw: string | null): PowerHelperUse | null {
  if (raw === null || raw === '') return null
  try {
    const o = JSON.parse(raw) as Record<string, unknown> | null
    if (o === null || typeof o !== 'object' || Array.isArray(o) || o.v !== 1) return null
    if (typeof o.n !== 'number' || !Number.isSafeInteger(o.n) || o.n < 0) return null
    if (!Array.isArray(o.instances) || !o.instances.every((s) => typeof s === 'string')) return null
    return { v: 1, n: o.n, instances: [...(o.instances as string[])] }
  } catch {
    return null
  }
}

export function readPowerHelperUse(storage: Readable | null): PowerHelperUse | null {
  try {
    return storage === null ? null : parsePowerHelperUse(storage.getItem(POWER_HELPER_KEY))
  } catch {
    return null
  }
}

/** Records one more use (n + 1) with the devices cabled. False when the storage refuses (blocked, full). */
export function recordPowerHelperUse(storage: Writable | null, instances: readonly string[]): boolean {
  try {
    if (storage === null) return false
    const n = (readPowerHelperUse(storage)?.n ?? 0) + 1
    storage.setItem(POWER_HELPER_KEY, JSON.stringify({ v: 1, n, instances: [...instances] }))
    return true
  } catch {
    return false
  }
}
