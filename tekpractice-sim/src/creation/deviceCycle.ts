/**
 * `[` / `]` device cycling (Task 8, C10): the keyboard way to select a device
 * in the 3D view. Pure. A current id that is not in the list counts as none.
 */
export function nextDevice(ids: readonly string[], current: string | null, dir: 1 | -1): string | null {
  const n = ids.length
  if (n === 0) return null
  const at = current === null ? -1 : ids.indexOf(current)
  if (at < 0) return dir === 1 ? ids[0] : ids[n - 1]
  return ids[(at + dir + n) % n]
}
