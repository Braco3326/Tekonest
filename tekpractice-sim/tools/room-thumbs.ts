/**
 * Build-time place thumbnails (Task 12, C15): `npm run thumbs:rooms`, and
 * `npm run build` runs it first. Writes, deterministically:
 *   public/room-thumbs/<room id>.svg  (32 rooms, drawn from content/rooms)
 *   public/room-thumbs/set-<env>.svg  (the 3 .glb sets: their floor)
 *   public/room-thumbs/blank.svg      (« Salle vide neutre »)
 *   src/creation/placeSummary.json    (what the cards show: names, sizes, matched gear)
 * Fails (exit 1) with the zod JSON path on any invalid room or set.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RoomFile } from '../src/explore/roomSchema'
import { Environment } from './schemas'
import { floorPlanSvg, roomPlanSvg } from '../src/creation/roomPlanSvg'
import { summarizeRoom, type PlaceSummary } from '../src/creation/placeSummary'
import { BLANK_SIZE, SET_ENV_IDS } from '../src/creation/places'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const roomsDir = join(root, 'content/rooms')
const outDir = join(root, 'public/room-thumbs')
mkdirSync(outDir, { recursive: true })

const fail = (file: string, issues: { path: (string | number)[]; message: string }[]): never => {
  console.error(`[room-thumbs] ${file}: ${issues[0]?.path.join('.')} ${issues[0]?.message}`)
  process.exit(1)
}

const catalog = JSON.parse(readFileSync(join(root, 'content/catalog.json'), 'utf8')) as { devices: { id: string }[] }
const catalogIds = new Set(catalog.devices.map((d) => d.id))

const summary: PlaceSummary = { rooms: [], sets: [] }
let bytes = 0
const write = (name: string, svg: string): void => {
  writeFileSync(join(outDir, name), svg + '\n', 'utf8')
  bytes = Math.max(bytes, Buffer.byteLength(svg))
}

for (const f of readdirSync(roomsDir).filter((x) => x.endsWith('.json') && x !== 'index.json').sort()) {
  const parsed = RoomFile.safeParse(JSON.parse(readFileSync(join(roomsDir, f), 'utf8')))
  if (!parsed.success) fail(f, parsed.error.issues)
  const room = parsed.data!
  write(`${room.id}.svg`, roomPlanSvg(room))
  summary.rooms.push(summarizeRoom(room, catalogIds))
}
for (const envId of SET_ENV_IDS) {
  const f = `content/environments/${envId}.json`
  const parsed = Environment.safeParse(JSON.parse(readFileSync(join(root, f), 'utf8')))
  if (!parsed.success) fail(f, parsed.error.issues)
  const [w, l] = parsed.data!.backdrop.floorSize
  write(`set-${envId}.svg`, floorPlanSvg(w, l))
  summary.sets.push({ envId, name: parsed.data!.name, floor: [w, l] })
}
write('blank.svg', floorPlanSvg(BLANK_SIZE.width, BLANK_SIZE.length))

writeFileSync(join(root, 'src/creation/placeSummary.json'), JSON.stringify(summary, null, 1) + '\n', 'utf8')
console.log(`[room-thumbs] ${summary.rooms.length} rooms + ${summary.sets.length} sets + blank → public/room-thumbs (largest ${bytes} B)`)
