/**
 * Essais (ADR-0012, Décision 5): canonical, quantised, versioned fingerprint.
 * Pure: no Babylon, no DOM, never imported by src/engine/.
 *
 *   fingerprint(design) = 'fp1:' + sha256hex(canonicalize(design))
 *
 * canonicalize():
 * - object keys sorted, undefined fields dropped;
 * - arrays kept in order, EXCEPT a `connections` list: each cable is written
 *   with its two ends ordered (a < b) and the list is sorted, so the same
 *   wiring always gives the same string whatever the patch order or direction;
 * - numbers quantised by field name (positions 1 mm, degrees 0.1°, delayMs
 *   0.01 ms, anything else 1e-6), -0 → 0, plain decimals (never an exponent).
 *
 * Any change to these rules is a new prefix (fp2:), never a silent rewrite.
 */

export const FP_PREFIX = 'fp1:'

export type Hasher = (text: string) => Promise<string>

/** Decimal places per field: the quantum is 10^-places. */
export function placesFor(key: string | null): number {
  if (key === null) return 6
  if (key === 'delayMs') return 2
  if (key.endsWith('Deg')) return 1
  if (key.endsWith('_m') || /position/i.test(key)) return 3
  return 6
}

/** Rounds to `places` decimals and prints a plain decimal: no exponent, no -0, no trailing zeros. */
export function formatQuantised(value: number, places: number): string {
  if (!Number.isFinite(value)) throw new RangeError(`canonicalize: non-finite number ${value}`)
  const n = Math.round(value * 10 ** places)
  if (!Number.isSafeInteger(n)) throw new RangeError(`canonicalize: number out of range ${value}`)
  if (n === 0) return '0'
  const digits = String(Math.abs(n)).padStart(places + 1, '0')
  const int = digits.slice(0, digits.length - places)
  const frac = digits.slice(digits.length - places).replace(/0+$/, '')
  return (n < 0 ? '-' : '') + int + (frac ? '.' + frac : '')
}

function isCable(v: unknown): v is { a: unknown; b: unknown } {
  return typeof v === 'object' && v !== null && 'a' in v && 'b' in v
}

function canon(value: unknown, key: string | null): string {
  if (value === null) return 'null'
  switch (typeof value) {
    case 'number':
      return formatQuantised(value, placesFor(key))
    case 'string':
      return JSON.stringify(value)
    case 'boolean':
      return value ? 'true' : 'false'
    case 'object':
      break
    default:
      throw new TypeError(`canonicalize: unsupported ${typeof value}`)
  }
  if (Array.isArray(value)) {
    if (key === 'connections') {
      const cables = value.map((c) => {
        if (!isCable(c)) return canon(c, null)
        let a = canon(c.a, 'a')
        let b = canon(c.b, 'b')
        if (a > b) [a, b] = [b, a]
        return `{"a":${a},"b":${b}}`
      })
      cables.sort()
      return `[${cables.join(',')}]`
    }
    return `[${value.map((v) => canon(v, key)).join(',')}]`
  }
  const obj = value as Record<string, unknown>
  const parts = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canon(obj[k], k)}`)
  return `{${parts.join(',')}}`
}

export function canonicalize(value: unknown): string {
  return canon(value, null)
}

/** WebCrypto is missing (very old browser, insecure context). Callers degrade to read-only, never quarantine. */
export class CryptoUnavailableError extends Error {
  constructor() {
    super('crypto.subtle is unavailable')
    this.name = 'CryptoUnavailableError'
  }
}

/** SHA-256 as lowercase hex via WebCrypto (browsers, Node 20+). */
export async function sha256hex(text: string): Promise<string> {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle
  if (!subtle) throw new CryptoUnavailableError()
  const bytes = new TextEncoder().encode(text)
  const digest = await subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function fingerprint(design: unknown, hash: Hasher = sha256hex): Promise<string> {
  return FP_PREFIX + (await hash(canonicalize(design)))
}

/** `rulesRev` for Evidence: computed by the caller from catalog.rules (this module never imports the catalog). */
export async function rulesRevOf(rules: unknown, hash: Hasher = sha256hex): Promise<string> {
  return 'r1:' + (await hash(canonicalize(rules)))
}
