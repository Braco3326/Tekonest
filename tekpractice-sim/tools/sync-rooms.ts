/**
 * Copy TEK Brain room templates (../knowledge-base/tek-brain/rooms) into
 * content/rooms/ — only the fields the game needs to GENERATE a room — plus an
 * index for the room picker. Sources stay in the knowledge base (the game shows
 * "voir la fiche source" through the KB, not here). Fails on any invalid room.
 *
 *   npx tsx tools/sync-rooms.ts
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { RoomFile } from '../src/explore/roomSchema'

const ROOT = resolve(__dirname, '..')
const SRC = resolve(ROOT, '..', 'knowledge-base', 'tek-brain', 'rooms')
const OUT = join(ROOT, 'content', 'rooms')

const KEEP = ['id', 'name_fr', 'name_en', 'family', 'size', 'review', 'dimensions_m', 'zones', 'openings', 'procedural', 'lighting'] as const

mkdirSync(OUT, { recursive: true })
const index: { id: string; name_fr: string; family: string; size: string }[] = []
let failures = 0
for (const file of readdirSync(SRC).filter((f) => f.endsWith('.json')).sort()) {
  const raw = JSON.parse(readFileSync(join(SRC, file), 'utf8')) as Record<string, unknown>
  const slim: Record<string, unknown> = Object.fromEntries(KEEP.filter((k) => k in raw).map((k) => [k, raw[k]]))
  slim.zones = (raw.zones as { id: string; kind: string; rect_m: number[]; floor_y_m?: number }[]).map(
    ({ id, kind, rect_m, floor_y_m }) => ({ id, kind, rect_m, floor_y_m }),
  )
  slim.openings = (raw.openings as Record<string, unknown>[]).map(({ wall, kind, offset_m, width_m, height_m }) => ({
    wall,
    kind,
    offset_m,
    width_m,
    height_m,
  }))
  slim.source_count = Array.isArray(raw.sources) ? raw.sources.length : 0
  const parsed = RoomFile.safeParse(slim)
  if (!parsed.success) {
    failures++
    console.error(`✗ ${file}: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}`)
    continue
  }
  writeFileSync(join(OUT, file), JSON.stringify(parsed.data, null, 1) + '\n')
  index.push({ id: parsed.data.id, name_fr: parsed.data.name_fr, family: parsed.data.family ?? 'autre', size: parsed.data.size ?? 'medium' })
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify({ rooms: index }, null, 1) + '\n')
console.log(`sync-rooms: ${index.length} rooms written to content/rooms/${failures ? `, ${failures} FAILED` : ''}`)
if (failures) process.exit(1)
