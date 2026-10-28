// Cable palette search (Task 27, fix round 1). Usage: node tools/cable-palette-search.mjs
// Finds N colours maximising the worst pairwise RGB distance seen through normal vision AND through simulated
// protanopia / deuteranopia / tritanopia (Machado et al. 2009, severity 1.0, on linear RGB, back to sRGB 0..255),
// subject to: normal-vision pairwise distance >= NORMAL_MIN, contrast >= 3:1 against Nuit AND the panel colour,
// relative luminance <= 0.70, and a normal-vision distance >= 60 from Papier (#F3EDE3, the hover stroke) and Ambre
// (#DD9349, the selection), so a cable never reads as a selected / hovered device. Seeded random restarts + hill climbing;
// the printed result is committed as constants in src/creation/cableStyle.ts.
const NUIT = '#131114'
const PANEL = '#1C191D'
const N = 16
const NORMAL_MIN = 70
const SEED = 27

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
const RESERVED = ['#F3EDE3', '#DD9349'].map(hex2)
const valid = (c) => RESERVED.every((r) => dist(c, r) >= 60) && c.every((v) => v >= 0 && v <= 255) && contrast(c, NUIT) >= 3.2 && contrast(c, PANEL) >= 3.2 && lum(c) <= 0.7

let s = SEED
const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
const randomColour = () => { for (;;) { const c = [rnd() * 255, rnd() * 255, rnd() * 255].map(Math.round); if (valid(c)) return c } }

/** Worst CVD distance over all pairs (the objective); -1 when a normal-vision pair is under NORMAL_MIN. */
function score(set) {
  const v = set.map(views)
  let worst = Infinity
  for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) {
    if (dist(v[i][0], v[j][0]) < NORMAL_MIN) return -1
    for (let k = 1; k < 4; k++) worst = Math.min(worst, dist(v[i][k], v[j][k]))
  }
  return worst
}

let best = null
let bestScore = -2
for (let restart = 0; restart < 12; restart++) {
  let cur = Array.from({ length: N }, randomColour)
  // a feasible start: greedy farthest-point under the normal-vision constraint
  let cs = score(cur)
  for (let it = 0; it < 60000; it++) {
    const i = Math.floor(rnd() * N)
    const step = it < 20000 ? 40 : it < 40000 ? 16 : 6
    const c = cur[i].map((v) => Math.round(v + (rnd() - 0.5) * step))
    if (!valid(c)) continue
    const old = cur[i]
    cur[i] = c
    const sc = score(cur)
    if (sc >= cs || (cs < 0 && sc < 0 && rnd() < 0.02)) cs = sc
    else cur[i] = old
    // while infeasible, push apart the normal-vision closest pair instead
    if (cs < 0) {
      let md = Infinity
      for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) md = Math.min(md, dist(cur[a], cur[b]))
      if (md >= NORMAL_MIN) cs = score(cur)
    }
  }
  if (cs > bestScore) { bestScore = cs; best = cur.map((c) => c.slice()) }
}
const hex = (c) => '#' + c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase()
console.log('worst simulated-CVD pair distance:', bestScore.toFixed(1))
let nm = Infinity
for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) nm = Math.min(nm, dist(best[a], best[b]))
console.log('worst normal-vision pair distance:', nm.toFixed(1))
console.log('min contrast vs Nuit / panel:', Math.min(...best.map((c) => contrast(c, NUIT))).toFixed(2), Math.min(...best.map((c) => contrast(c, PANEL))).toFixed(2))
console.log(best.map(hex).join(' '))
