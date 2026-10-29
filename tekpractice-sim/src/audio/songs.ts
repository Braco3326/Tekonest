import { z } from 'zod'

/** Hard cap per demo song (plan global constraint: each file <= 3 MB, taken as 3 MiB). */
export const MAX_SONG_BYTES = 3 * 1024 * 1024
export const MAX_SONGS = 3

/**
 * One licensed demo song. `file` is relative to `public/` (served at `/<file>`), restricted to
 * `audio/songs/<name>.mp3|ogg` so a content edit cannot point outside the songs folder.
 * Licence is exactly CC0-1.0: anything else must not ship (Pixabay licence is NOT CC0).
 */
export const SongEntry = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  author: z.string().min(1),
  file: z.string().regex(/^audio\/songs\/[A-Za-z0-9._-]+\.(mp3|ogg)$/, 'must be audio/songs/<name>.mp3|ogg'),
  bytes: z.number().int().positive().max(MAX_SONG_BYTES),
  licence: z.literal('CC0-1.0'),
  licenceUrl: z.string().url(),
  sourceUrl: z.string().url(),
  retrieved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD'),
  sha256: z.string().regex(/^[0-9a-f]{64}$/, 'must be 64 lower-case hex characters'),
})
export type SongEntry = z.infer<typeof SongEntry>

/**
 * Loads content/songs.json. Lazy import: the JSON stays out of the creation start chunk.
 * The list is empty until a CC0 track is verified and approved (see ASSET_LOG.md).
 */
export async function loadSongs(): Promise<SongEntry[]> {
  const mod = await import('../../content/songs.json')
  return z.array(SongEntry).parse(mod.default)
}
