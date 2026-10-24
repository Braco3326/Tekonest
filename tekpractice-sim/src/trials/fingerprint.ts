/**
 * Essais (ADR-0012, Décision 5): canonical, quantised, versioned fingerprint.
 * Pure: no Babylon, no DOM, never imported by src/engine/.
 *
 *   fingerprint(design) = 'fp1:' + sha256hex(canonicalize(design))
 *
 * canonicalize():
 * - object keys sorted, undefined fields dropped;
 * - arrays kept in order, EXCEPT:
 *   - a `connections` list: each cable is written with its two ends ordered
 *     (a < b) and the list is sorted, so the same wiring always gives the same
 *     string whatever the patch order or direction;
 *   - `instances` and `placements`: sorted by instanceId (insertion order has
 *     no physical meaning);
 * - inside `controls`, an empty per-instance map is dropped (= no controls);
 * - numbers quantised by field name (positions 1 mm, degrees 0.1°, delayMs
 *   0.01 ms, anything else 1e-6), -0 → 0, plain decimals (never an exponent);
 *   yawDeg is first normalised to [0, 360).
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

/**
 * The single quantisation rule for a numeric field, shared by canonicalize()
 * and diffDesign() so that "same fingerprint" ⇔ "no diff".
 * yawDeg is normalised to [0, 360) first, so 0 ≡ 360 ≡ -360.
 */
export function quantField(key: string | null, value: number): string {
  if (key === 'yawDeg') {
    const s = formatQuantised(((value % 360) + 360) % 360, 1)
    return s === '360' ? '0' : s
  }
  return formatQuantised(value, placesFor(key))
}

const idOf = (v: unknown): string =>
  typeof v === 'object' && v !== null && typeof (v as { instanceId?: unknown }).instanceId === 'string'
    ? (v as { instanceId: string }).instanceId
    : ''

const isEmptyMap = (v: unknown): boolean =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every((x) => x === undefined)

function isCable(v: unknown): v is { a: unknown; b: unknown } {
  return typeof v === 'object' && v !== null && 'a' in v && 'b' in v
}

/**
 * One cable, direction-free: its two ends are ordered (a < b by canonical
 * string) and EVERY other field of the cable is kept, so a future cable
 * attribute (kind, length…) is fingerprinted too.
 */
export function canonicalCable(c: unknown): string {
  if (!isCable(c)) return canon(c, null)
  const a = canon(c.a, 'a')
  const b = canon(c.b, 'b')
  return canon(a > b ? { ...c, a: c.b, b: c.a } : c, null)
}

function canon(value: unknown, key: string | null): string {
  if (value === null) return 'null'
  switch (typeof value) {
    case 'number':
      return quantField(key, value)
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
      const cables = value.map(canonicalCable)
      cables.sort()
      return `[${cables.join(',')}]`
    }
    if (key === 'instances' || key === 'placements') {
      // Insertion order has no physical meaning: sort by instanceId (code-unit order), then by content.
      const items = value.map((v) => ({ id: idOf(v), s: canon(v, null) }))
      items.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : x.s < y.s ? -1 : x.s > y.s ? 1 : 0))
      return `[${items.map((x) => x.s).join(',')}]`
    }
    return `[${value.map((v) => canon(v, key)).join(',')}]`
  }
  const obj = value as Record<string, unknown>
  const parts = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    // controls: an empty per-instance map means "no controls" and is dropped.
    .filter((k) => !(key === 'controls' && isEmptyMap(obj[k])))
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
