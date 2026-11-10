/**
 * Writes a basic control layout (content/control-layouts/<id>.json) for every device whose asset spec lists controls and that has no
 * hand-made layout: the power key / rocker, the Antelope sample-rate knob, the Avid status LED. A control whose id is also a control of
 * the catalog device is linked to the simulation (catalogControl), so pressing it in 3D changes the setting and the setting moves it.
 * Layouts written here carry "generated": true and are overwritten on the next run; remove that flag to take one over by hand.
 *
 *   node tools/controls/gen-from-specs.mjs
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const specs = join(root, 'content/asset-specs')
const layouts = join(root, 'content/control-layouts')
const catalog = JSON.parse(readFileSync(join(root, 'content/catalog.json'), 'utf8')).devices
const GREEN = '#46ff5a'

let written = 0
for (const file of readdirSync(specs).filter((f) => f.endsWith('.json'))) {
  const spec = JSON.parse(readFileSync(join(specs, file), 'utf8'))
  if (spec.kind !== 'device' || !spec.controls?.length) continue
  const target = join(layouts, file)
  if (existsSync(target) && !JSON.parse(readFileSync(target, 'utf8')).generated) continue // hand-made: never touched
  const cat = catalog.find((d) => d.id === spec.id)
  const catControl = (id) => cat?.controls?.find((c) => c.id === id)
  const controls = []
  for (const c of spec.controls) {
    const cc = catControl(c.controlId)
    const base = { id: c.controlId, face: c.face, xMm: c.xMm, yMm: c.yMm, sizeMm: c.sizeMm, label: cc?.label ?? c.controlId, ...(cc ? { catalogControl: cc.id } : {}) }
    if (c.kind === 'button') {
      controls.push({ ...base, kind: 'button', axis: 'z', latch: true, round: true, colour: '#1b3a1f', lit: GREEN, travelMm: 1, default: cc?.type === 'toggle' && cc.default === false ? 0 : 1 })
    } else if (c.kind === 'switch') {
      controls.push({ ...base, kind: 'switch', axis: c.axis === 'z' ? 'x' : c.axis, positions: 2, colour: '#d8dbe0', default: cc?.type === 'toggle' && cc.default === false ? 0 : 1 })
    } else if (c.kind === 'knob') {
      const idx = cc?.type === 'enum' && cc.options ? Math.max(0, cc.options.indexOf(cc.defaultOption)) / Math.max(1, cc.options.length - 1) : 0.5
      controls.push({ ...base, kind: 'knob', axis: 'z', sweepDeg: 270, colour: '#1c1d20', default: idx })
    } else if (c.kind === 'led') {
      controls.push({ ...base, kind: 'led', axis: 'z', round: true, lit: GREEN, default: 1 })
    } else if (c.kind === 'fader') {
      controls.push({ ...base, kind: 'fader', axis: c.axis === 'x' ? 'x' : 'y', travelMm: c.travelMm ?? 60, taper: 'fader-db', default: 0.75, colour: '#2b2d31' })
    }
  }
  if (!controls.length) continue
  writeFileSync(target, JSON.stringify({ schema: 1, deviceId: spec.id, generated: true, controls }, null, 1))
  written++
  console.log(`${spec.id}: ${controls.length} control(s)${controls.some((c) => c.catalogControl) ? ' (linked: ' + controls.filter((c) => c.catalogControl).map((c) => c.catalogControl).join(', ') + ')' : ''}`)
}
console.log(`${written} layout(s) written`)
