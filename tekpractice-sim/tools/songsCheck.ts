/**
 * Pure checks for content/songs.json (Task 38). Node-side (hashing), so it lives in tools/, not src/.
 * Every entry must: pass the SongEntry schema (licence exactly CC0-1.0), have its file, match the
 * declared size and SHA-256, stay <= 3 MB for real, and appear in ASSET_LOG.md on ONE line that
 * carries both the file and the licenceUrl. At most 3 entries, unique ids.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MAX_SONGS, MAX_SONG_BYTES, SongEntry } from '../src/audio/songs'

export interface SongsDeps {
  /** Reads a file given as in the entry (`audio/songs/x.mp3`, relative to public/). */
  read: (file: string) => Uint8Array
  exists: (file: string) => boolean
  assetLog: string
}

export function validateSongs(entries: unknown, deps: SongsDeps): string[] {
  if (!Array.isArray(entries)) return ['songs.json: must be an array']
  const errors: string[] = []
  if (entries.length > MAX_SONGS) errors.push(`songs.json: at most ${MAX_SONGS} songs (got ${entries.length})`)
  const seen = new Set<string>()
  const logLines = deps.assetLog.split(/\r?\n/)

  entries.forEach((raw: unknown, i) => {
    const label = (raw as { id?: unknown } | null)?.id
    const name = typeof label === 'string' ? label : `#${i}`
    const parsed = SongEntry.safeParse(raw)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors.push(`${name}: ${issue.path.join('.')}: ${issue.message}`)
      return
    }
    const e = parsed.data
    if (seen.has(e.id)) errors.push(`${e.id}: duplicate id`)
    seen.add(e.id)

    if (!logLines.some((l) => l.includes(e.file) && l.includes(e.licenceUrl)))
      errors.push(`${e.id}: no ASSET_LOG.md line carries both ${e.file} and its licenceUrl`)

    if (!deps.exists(e.file)) {
      errors.push(`${e.id}: file does not exist (public/${e.file})`)
      return
    }
    const bytes = deps.read(e.file)
    if (bytes.length > MAX_SONG_BYTES) errors.push(`${e.id}: file is ${bytes.length} bytes, above the 3 MB cap`)
    if (bytes.length !== e.bytes) errors.push(`${e.id}: size ${bytes.length} does not match bytes ${e.bytes}`)
    const actual = createHash('sha256').update(bytes).digest('hex')
    if (actual !== e.sha256) errors.push(`${e.id}: sha256 ${actual} does not match ${e.sha256}`)
  })
  return errors
}

/** Runs validateSongs against a project root (content/songs.json, public/, ASSET_LOG.md). */
export function validateSongsAt(root: string): string[] {
  let entries: unknown
  try {
    entries = JSON.parse(readFileSync(join(root, 'content', 'songs.json'), 'utf8'))
  } catch (err) {
    return [`content/songs.json: cannot read or parse (${(err as Error).message})`]
  }
  let assetLog = ''
  try {
    assetLog = readFileSync(join(root, 'ASSET_LOG.md'), 'utf8')
  } catch {
    // an unreadable log leaves assetLog empty, so every entry fails its ASSET_LOG check
  }
  return validateSongs(entries, {
    read: (f) => readFileSync(join(root, 'public', f)),
    exists: (f) => existsSync(join(root, 'public', f)),
    assetLog,
  })
}
