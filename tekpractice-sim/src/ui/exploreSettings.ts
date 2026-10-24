/**
 * Explore settings (ADR-0010 Décision 9): comfort options + remapped bindings,
 * persisted in localStorage like ProgressStore — versioned, every access in
 * try/catch (private mode / blocked storage must never break the game).
 */
import { DEFAULT_BINDINGS, parseBindings, serializeBindings, type Bindings } from '../input/bindings'

export type ReducedMotionPref = 'system' | 'on' | 'off'
export type PointerLockPref = 'auto' | 'always' | 'never'
export type ViewPref = 'orbit' | 'explore'

export interface ExploreSettings {
  /** Multiplies walk/run speed. */
  speedMult: number
  /** Multiplies mouse look. */
  sensitivity: number
  invertY: boolean
  fovDeg: number
  reducedMotion: ReducedMotionPref
  pointerLock: PointerLockPref
  /** Default view inside levels A1–D1 / exam (sandbox always starts in explore). */
  levelView: ViewPref
  /**
   * BTS year (Essais, Task 14): 1 = flat list, at most 3 Essais; 2 = mini-tree.
   * Added without a version bump: a file without it reads as 2 (the default).
   */
  year: 1 | 2
  bindings: Bindings
}

export const SETTINGS_KEY = 'audio-sim/explore-settings'
export const SETTINGS_VERSION = 1

export const DEFAULT_SETTINGS: ExploreSettings = {
  speedMult: 1,
  sensitivity: 1,
  invertY: false,
  fovDeg: 70,
  reducedMotion: 'system',
  pointerLock: 'auto',
  levelView: 'orbit',
  year: 2,
  bindings: DEFAULT_BINDINGS,
}

const num = (v: unknown, lo: number, hi: number, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], d: T): T =>
  allowed.includes(v as T) ? (v as T) : d

export function loadSettings(storage: Pick<Storage, 'getItem'>): ExploreSettings {
  try {
    const raw = storage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const file = JSON.parse(raw) as { version?: number; settings?: Record<string, unknown> }
    if (file.version !== SETTINGS_VERSION || !file.settings) return DEFAULT_SETTINGS
    const s = file.settings
    return {
      speedMult: num(s.speedMult, 0.25, 3, DEFAULT_SETTINGS.speedMult),
      sensitivity: num(s.sensitivity, 0.1, 5, DEFAULT_SETTINGS.sensitivity),
      invertY: typeof s.invertY === 'boolean' ? s.invertY : DEFAULT_SETTINGS.invertY,
      fovDeg: num(s.fovDeg, 40, 100, DEFAULT_SETTINGS.fovDeg),
      reducedMotion: oneOf(s.reducedMotion, ['system', 'on', 'off'] as const, DEFAULT_SETTINGS.reducedMotion),
      pointerLock: oneOf(s.pointerLock, ['auto', 'always', 'never'] as const, DEFAULT_SETTINGS.pointerLock),
      levelView: oneOf(s.levelView, ['orbit', 'explore'] as const, DEFAULT_SETTINGS.levelView),
      year: s.year === 1 || s.year === 2 ? s.year : DEFAULT_SETTINGS.year,
      bindings: parseBindings(s.bindings),
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(storage: Pick<Storage, 'setItem'>, s: ExploreSettings): void {
  try {
    storage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ version: SETTINGS_VERSION, settings: { ...s, bindings: serializeBindings(s.bindings) } }),
    )
  } catch (err) {
    console.warn('[explore] réglages non sauvegardés (stockage plein ou bloqué)', err)
  }
}
