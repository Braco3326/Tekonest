// Coverage palette search (Task 37). Usage: node tools/coverage-palette-search.mjs
// Finds the 8 colours of the locked relative scale (bin 0 = 0 to -3 dB, the loudest, ... bin 7 = -21 dB and below) maximising the worst pairwise
// RGB distance seen through normal vision AND through simulated protanopia / deuteranopia / tritanopia (Machado et al. 2009, severity 1.0, on
// linear RGB, back to sRGB 0..255: the approach and the matrices of tools/cable-palette-search.mjs, Task 27), subject to:
//  - contrast >= 3.2:1 against Nuit (the 3D scene background) AND the panel colour (the legend swatches),
//  - a SEQUENTIAL scale: relative luminance strictly increases from bin 7 to bin 0 by >= MIN_STEP each, so the order reads in grey too,
//  - a smooth hue run: the hue falls from bin 7 (blue) to bin 0 (yellow) by >= MIN_HUE_STEP degrees per bin, inside [HUE_LO, HUE_HI], saturation >= SAT_MIN,
//    so the scale reads as one ordered ramp and not as eight unrelated colours (the unconstrained optimum was a rainbow shuffle),
//  - a normal-vision distance >= ADJACENT_MIN between neighbouring bins and >= 60 from Papier (#F3EDE3, the aim lines) and Ambre (#DD9349,
//    the selection), so a dot never reads as a selected device.
// Seeded random restarts + hill climbing; the printed result is committed as constants in src/creation/coveragePalette.ts and held by
// tests/creation/coveragePalette.test.ts (which re-checks every constraint independently).
const NUIT = '#131114'
const PANEL = '#1C191D'
const N = 8
const SEED = 37
const MIN_STEP = 0.035
const ADJACENT_MIN = 40
const MIN_HUE_STEP = 12
const HUE_LO = 45
const HUE_HI = 275
const SAT_MIN = 0.35

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
const gam = (v) => { v = Math.min(1, Math.max(0, v)); return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) }
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const contrast = (c, bg) => { const a = lum(c); const b = lum(hex2(bg)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) }
const M = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
}
const sim = (m, c) => { const l = c.map(lin); return m.map((row) => gam(row[0] * l[0] + row[1] * l[1] + row[2] * l[2])) }
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const views = (c) => [c, sim(M.protan, c), sim(M.deutan, c), sim(M.tritan, c)]
const hsl = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2
  if (d === 0) return [0, 0, l]
  const sat = d / (1 - Math.abs(2 * l - 1))
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  return [h < 0 ? h + 360 : h, sat, l]
}
const RESERVED = ['#F3EDE3', '#DD9349'].map(hex2)
const valid = (c) => RESERVED.every((r) => dist(c, r) >= 60) && c.every((v) => v >= 0 && v <= 255) && contrast(c, NUIT) >= 3.2 && contrast(c, PANEL) >= 3.2 && lum(c) <= 0.75 && hsl(c)[1] >= SAT_MIN && hsl(c)[0] >= HUE_LO && hsl(c)[0] <= HUE_HI

let s = SEED
const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
const randomColour = () => { for (;;) { const c = [rnd() * 255, rnd() * 255, rnd() * 255].map(Math.round); if (valid(c)) return c } }

/** index 0 = bin 0 (loudest, brightest) ... index 7 = bin 7 (quietest, darkest). Returns -1 when a hard constraint fails. */
function score(set) {
  for (let i = 0; i < N - 1; i++) if (lum(set[i]) - lum(set[i + 1]) < MIN_STEP || hsl(set[i + 1])[0] - hsl(set[i])[0] < MIN_HUE_STEP) return -1
  const v = set.map(views)
  let worst = Infinity
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    if (j === i + 1 && dist(v[i][0], v[j][0]) < ADJACENT_MIN) return -1
    for (let k = 0; k < 4; k++) worst = Math.min(worst, dist(v[i][k], v[j][k]))
  }
  return worst
}

// A feasible start: random colours sorted by luminance, then repaired by hill climbing on a soft penalty.
const penalty = (set) => {
  let p = 0
  for (let i = 0; i < N - 1; i++) p += Math.max(0, MIN_STEP - (lum(set[i]) - lum(set[i + 1]))) * 1000
  for (let i = 0; i < N - 1; i++) p += Math.max(0, ADJACENT_MIN - dist(set[i], set[i + 1])) + Math.max(0, MIN_HUE_STEP - (hsl(set[i + 1])[0] - hsl(set[i])[0])) * 3
  return p
}
let best = null
let bestScore = -2
for (let restart = 0; restart < 40; restart++) {
  let cur = Array.from({ length: N }, randomColour).sort((a, b) => lum(b) - lum(a))
  let pen = penalty(cur)
  for (let it = 0; it < 20000 && pen > 0; it++) {
    const i = Math.floor(rnd() * N)
    const c = cur[i].map((v) => Math.round(v + (rnd() - 0.5) * 50))
    if (!valid(c)) continue
    const old = cur[i]
    cur[i] = c
    const np = penalty(cur)
    if (np <= pen) pen = np
    else cur[i] = old
  }
  let cs = score(cur)
  if (cs < 0) continue
  for (let it = 0; it < 40000; it++) {
    const i = Math.floor(rnd() * N)
    const step = it < 12000 ? 40 : it < 28000 ? 16 : 6
    const c = cur[i].map((v) => Math.round(v + (rnd() - 0.5) * step))
    if (!valid(c)) continue
    const old = cur[i]
    cur[i] = c
    const sc = score(cur)
    if (sc >= cs) cs = sc
    else cur[i] = old
  }
  if (cs > bestScore) { bestScore = cs; best = cur.map((c) => c.slice()) }
}
const hex = (c) => '#' + c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase()
if (!best) { console.error('no feasible palette found'); process.exit(1) }
console.log('worst pair distance over normal + simulated protanopia / deuteranopia / tritanopia:', bestScore.toFixed(1))
console.log('min contrast vs Nuit / panel:', Math.min(...best.map((c) => contrast(c, NUIT))).toFixed(2), Math.min(...best.map((c) => contrast(c, PANEL))).toFixed(2))
console.log('hue, bin 0 .. bin 7:', best.map((c) => hsl(c)[0].toFixed(0)).join(' '))
console.log('relative luminance, bin 0 .. bin 7:', best.map((c) => lum(c).toFixed(3)).join(' '))
console.log('bin 0 .. bin 7:')
console.log(best.map(hex).join(' '))
