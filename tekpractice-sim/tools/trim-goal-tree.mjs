// One-off: vendors a TRIMMED copy of marketing's goal tree (the research file, e.g. `E:\CLAUDE BU\reports\goal-tree.json`) into the app.
//   node tools/trim-goal-tree.mjs <path to the research goal-tree.json>
// Writes content/onboarding/goal-tree.json (meta.version, meta.status, and the goals: id, label, level, rooms, children, school_field) and
// content/onboarding/schools.json (id, name, cities, kind; only the accounts form needs the list). Every review-only field (note, basis, sources, esco,
// certification_note, campuses_note, rooms_basis, programme, voies, confidence, kind, free_text...) is dropped, and so are seat counts, fees and dates.
// The labels stay in the JSON only (never in code): a later relabel is running this again. The app validates the result (src/creation/onboarding/goalTree.ts,
// tests/creation/goalTree.test.ts) against content/rooms/index.json.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const src = process.argv[2]
if (!src) {
  console.error('usage: node tools/trim-goal-tree.mjs <research goal-tree.json>')
  process.exit(1)
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const raw = JSON.parse(readFileSync(src, 'utf8'))

const node = (n) => ({
  id: n.id,
  label: n.label,
  level: n.level,
  rooms: Array.isArray(n.rooms) ? [...n.rooms] : [],
  children: (n.children ?? []).map(node),
  ...(n.school_field === true ? { school_field: true } : {}),
})

const tree = { version: raw.meta.version, status: raw.meta.status, goals: raw.goals.map(node) }
const schools = { version: raw.meta.version, schools: (raw.schools ?? []).map((s) => ({ id: s.id, name: s.name, cities: [...(s.cities ?? [])], kind: s.kind })) }

writeFileSync(join(root, 'content', 'onboarding', 'goal-tree.json'), JSON.stringify(tree, null, 2) + '\n')
writeFileSync(join(root, 'content', 'onboarding', 'schools.json'), JSON.stringify(schools, null, 2) + '\n')
const count = (ns) => ns.reduce((k, n) => k + 1 + count(n.children), 0)
console.log(`goal-tree.json: ${tree.goals.length} goals, ${count(tree.goals)} nodes; schools.json: ${schools.schools.length} schools`)
