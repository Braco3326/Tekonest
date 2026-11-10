/**
 * Writes content/control-layouts/yamaha-ql1.json from positions measured on the official overhead photo
 * (assets-source/yamaha-ql1/photos/top.jpg, 1689 x 2000, rear edge at the top, straight down).
 *
 *   node tools/controls/gen-ql1-layout.mjs
 *
 * Photo pixels -> face-local mm (the top face seen from above with the I/O edge at the BOTTOM, i.e. the photo turned half a turn):
 *   x_mm = (RIGHT_PX - px) / PX_PER_MM_X      y_mm = (py - REAR_PX) / PX_PER_MM_Y     (y = 0 is the I/O edge)
 * The console outline in the photo spans x 140..1555 (468 mm) and y 130..FRONT_PX (562 mm). Tune the four constants if the model's top
 * picture is cropped differently; everything else follows.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const LEFT_PX = 140
const RIGHT_PX = 1555
const REAR_PX = 130
const FRONT_PX = 1855
const W_MM = 468
const D_MM = 562
const SX = (RIGHT_PX - LEFT_PX) / W_MM
const SY = (FRONT_PX - REAR_PX) / D_MM
const X = (px) => +((RIGHT_PX - px) / SX).toFixed(1)
const Y = (py) => +((py - REAR_PX) / SY).toFixed(1)
const mmX = (px) => +(px / SX).toFixed(1)
const mmY = (py) => +(py / SY).toFixed(1)

const DARK = '#2a2d33'
const INK = '#cfd3da'
const controls = []

// ── channel strips: 16 + the two masters ────────────────────────────────────────────────────────────────────────
const stripX = [271, 334, 397, 460, 524, 587, 650, 713, 813, 876, 939, 1002, 1065, 1129, 1192, 1255]
const masters = [
  { id: 'st', px: 1355, label: 'ST' },
  { id: 'mono', px: 1418, label: 'MONO' },
]
const strips = [
  ...stripX.map((px, i) => ({ id: `${i + 1}`, px, n: i + 1 })),
  ...masters.map((m) => ({ id: m.id, px: m.px, n: null })),
]

for (const s of strips) {
  const x = X(s.px)
  const fid = s.n ? `fader-${s.n}` : `fader-${s.id}`
  controls.push({
    id: fid, kind: 'fader', face: 'top', xMm: x, yMm: Y(1632), axis: 'y', travelMm: 100, reverse: true, default: 0.75, taper: 'fader-db',
    slot: true, slotMm: { w: 13, len: 112 }, colour: '#a3a8b0', sizeMm: { w: 15, h: 27, d: 11 }, label: s.n ? `Fader ${s.n}` : `Fader ${s.label}`,
  })
  const base = { face: 'top', axis: 'z', latch: true, colour: DARK, ink: INK, travelMm: 1 }
  const pre = s.n ? `ch${s.n}` : s.id
  controls.push({ id: `${pre}-sel`, kind: 'button', ...base, xMm: x, yMm: Y(907), default: s.n === 1 ? 1 : 0, label: 'SEL', lit: '#2fe0a0', ink: '#cfd3da', sizeMm: { w: 15, h: 9.5, d: 3.5 }, group: 'sel' })
  controls.push({ id: `${pre}-cue`, kind: 'button', ...base, xMm: x, yMm: Y(962), default: 0, label: 'CUE', lit: '#ff6a4a', sizeMm: { w: 12, h: 8, d: 3 } })
  controls.push({ id: `${pre}-on`, kind: 'button', ...base, xMm: x, yMm: Y(1106), default: 1, label: 'ON', lit: '#ff5a3a', sizeMm: { w: 15.5, h: 9.5, d: 3.5 } })
  controls.push({
    id: `${pre}-meter`, kind: 'meter', face: 'top', xMm: x - 0.5, yMm: +((Y(999) + Y(1067)) / 2).toFixed(1), axis: 'y', default: 0,
    sizeMm: { w: 6.6, h: +(Y(1067) - Y(999) + 3).toFixed(1), d: 1.2 }, meter: { style: 'bar', source: s.n ? `ch${s.n}` : `${s.id}-l`, segments: 6, fromDb: -60, toDb: 0 },
  })
}

// ── encoders ────────────────────────────────────────────────────────────────────────────────────────────────────
const knob = (id, label, px, py, d, colour, range, def = 0.5) => ({ id, kind: 'knob', face: 'top', xMm: X(px), yMm: Y(py), axis: 'z', default: def, sweepDeg: 290, colour, range, label, sizeMm: { w: d, h: d, d: 11 } })
controls.push(
  knob('gain', 'Gain', 1150, 335, 15, '#e6e8ec', { min: -6, max: 66, unit: 'dB' }, 0.25),
  knob('pan', 'Pan', 1150, 405, 15, '#c1272d', { min: -100, max: 100, unit: '%' }),
  knob('hpf', 'HPF', 1200, 470, 15, '#2aa7a0', { min: 20, max: 600, unit: 'Hz' }, 0.2),
  knob('eq-high', 'EQ high', 1130, 527, 15, '#2aa7a0', { min: -18, max: 18, unit: 'dB' }),
  knob('eq-mid', 'EQ mid', 1200, 545, 15, '#2aa7a0', { min: -18, max: 18, unit: 'dB' }),
  knob('eq-low', 'EQ low', 1265, 525, 15, '#2aa7a0', { min: -18, max: 18, unit: 'dB' }),
  knob('dyn1', 'Dynamics 1', 1250, 335, 14, '#e6e8ec', { min: -54, max: 0, unit: 'dB' }, 0.6),
  knob('dyn2', 'Dynamics 2', 1250, 405, 14, '#e6e8ec', { min: -54, max: 0, unit: 'dB' }, 0.6),
  { ...knob('touch-and-turn', 'Touch and Turn', 1145, 705, 20, '#c9ccd2', { min: 0, max: 100, unit: '%' }), sweepDeg: 360 }
)

// ── key blocks ──────────────────────────────────────────────────────────────────────────────────────────────────
const key = (id, label, px, py, extra = {}) => ({
  id, kind: 'button', face: 'top', xMm: X(px), yMm: Y(py), axis: 'z', default: 0, latch: true, colour: DARK, ink: INK, lit: '#ffb347', label, sizeMm: { w: 11, h: 7.5, d: 3 }, travelMm: 1, ...extra,
})
const sendRows = [340, 388, 447, 497, 568, 616, 674, 722]
sendRows.forEach((py, r) => {
  controls.push(key(`sends-${r * 2 + 1}`, `${r * 2 + 1}`, 255, py, { group: 'sends', default: r === 0 ? 1 : 0, lit: '#2fe0a0' }))
  controls.push(key(`sends-${r * 2 + 2}`, `${r * 2 + 2}`, 318, py, { group: 'sends', lit: '#2fe0a0' }))
})
const userRows = [342, 390, 462, 513, 585, 633]
userRows.forEach((py, r) => {
  controls.push(key(`user-${r * 2 + 1}`, r === 0 ? 'USB' : `${r * 2 + 1}`, 1380, py, r === 0 ? { catalogControl: 'playback-usb' } : {}))
  controls.push(key(`user-${r * 2 + 2}`, `${r * 2 + 2}`, 1443, py))
})
;['1-16', '17-32', 'ST/DCA', 'MIX'].forEach((label, i) => controls.push(key(`bank-${i + 1}`, label, 1275 + i * 54, 735, { group: 'bank', default: i === 0 ? 1 : 0, lit: '#2fe0a0' })))
;['LOW', 'L-MID', 'H-MID', 'HIGH'].forEach((label, i) => controls.push(key(`eq-band-${i + 1}`, label, 1118 + i * 53, 612, { group: 'eqband', default: i === 3 ? 1 : 0, lit: '#2fe0a0' })))

// ── touch screen (the mixer overview) ───────────────────────────────────────────────────────────────────────────
controls.push({
  id: 'screen', kind: 'screen', face: 'top', xMm: X((395 + 1030) / 2), yMm: Y((295 + 705) / 2), axis: 'z', default: 0,
  sizeMm: { w: mmX(1030 - 395), h: mmY(705 - 295), d: 2 }, screen: { app: 'mixer-overview', pxW: 1024, pxH: 661 },
})

// ── rear: the power switch (linked to the simulation) ──────────────────────────────────────────────────────────
controls.push({ id: 'power', kind: 'switch', face: 'io', xMm: 147, yMm: 78.5, axis: 'x', default: 1, positions: 2, colour: '#d8dbe0', sizeMm: { w: 20.7, h: 33.2, d: 8 }, catalogControl: 'power' })

const layout = {
  schema: 1,
  deviceId: 'yamaha-ql1',
  // The spec's build.profile (depth from the I/O edge, height): the surface the faders and keys sit on.
  topProfile: [[0, 272], [6, 272], [20, 266], [40, 257], [80, 231], [120, 205], [161, 178], [201, 152], [241, 140], [281, 132], [321, 126], [361, 121], [401, 112], [442, 110], [482, 104], [522, 98], [562, 95]],
  controls,
  overrides: {
    'fader-st': { catalogControl: 'fader-master' },
    'st-on': { catalogControl: 'mute-master', invert: true },
    pan: { catalogControl: 'balance-master' },
  },
}

const out = join(dirname(fileURLToPath(import.meta.url)), '../../content/control-layouts/yamaha-ql1.json')
writeFileSync(out, JSON.stringify(layout, null, 1))
console.log(`${controls.length} controls -> ${out}`)
