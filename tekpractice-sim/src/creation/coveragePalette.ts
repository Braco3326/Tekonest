/**
 * The locked colour scale of the coverage dots (Task 37, C13, ADR-0015): 8 colours, one per 3 dB bin of the relative scale (0 to −24 dB).
 * Locked = the same colours whatever the room, so a colour always means the same relative level. Pure data + two lookups.
 *
 * Found by `tools/coverage-palette-search.mjs` (seed 37) and held by tests/creation/coveragePalette.test.ts, which re-checks every constraint:
 *  - each colour has a contrast ≥ 3:1 against Nuit (the 3D background) and against the panel colour (the legend swatches),
 *  - the scale is SEQUENTIAL: relative luminance falls bin by bin, so the order still reads in greys,
 *  - the hue runs yellow → green → teal → blue → violet, one ordered ramp,
 *  - every pair stays ≥ 30 apart (RGB distance) under simulated protanopia, deuteranopia and tritanopia (Machado 2009; the search maximises it: 67.8),
 *  - no colour is near Papier (the aim lines) or Ambre (the selection).
 * Colour is never the only cue: the legend prints each bin's dB range, and the statistics panel gives every number as text.
 */
import { scaleBin } from '../acoustics/scale'

/** Index = bin: 0 = 0 to −3 dB (the loudest), 7 = −21 dB and below. */
export const COVERAGE_PALETTE: readonly string[] = ['#FEE10F', '#81F661', '#BDE0BD', '#5DC57F', '#5BB7C2', '#9D97FD', '#8154FF', '#8C4FBA']

/** The colour of a relative level (dB, ≤ 0): clamped like `scaleBin`; silence (−Infinity) is the last bin. */
export function binColor(relDb: number): string {
  return COVERAGE_PALETTE[scaleBin(relDb)]
}

/** '#RRGGBB' → [r, g, b] in 0..1 (the thin-instance colour buffer wants floats). */
export function hexToRgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
