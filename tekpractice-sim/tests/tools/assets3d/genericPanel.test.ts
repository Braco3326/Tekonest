/**
 * Tests for assets3d/genericPanel: a flat panel picture drawn from data (a base colour and a list of shapes in face-local millimetres, y up from the
 * bottom edge like the spec's ports), for a device that has no usable photo: generic connectors, buttons and vents, never a brand mark.
 */
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { PANEL_MAX_PX, PANEL_PX_PER_MM, panelSizePx, renderPanel } from '../../../tools/assets3d/genericPanel'
import type { PanelSpec } from '../../../tools/assets3d/genericPanel'

const pixel = async (png: Uint8Array, x: number, y: number): Promise<number[]> => {
  const { data, info } = await sharp(Buffer.from(png)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const o = (y * info.width + x) * 3
  return [data[o], data[o + 1], data[o + 2]]
}
const hex = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

describe('panelSizePx', () => {
  it('is PANEL_PX_PER_MM pixels per millimetre, scaled down so that the longer side stays within PANEL_MAX_PX', () => {
    expect(panelSizePx(100, 50)).toEqual({ w: 100 * PANEL_PX_PER_MM, h: 50 * PANEL_PX_PER_MM, ppm: PANEL_PX_PER_MM })
    const tall = panelSizePx(169, 386)
    expect(Math.max(tall.w, tall.h)).toBeLessThanOrEqual(PANEL_MAX_PX)
    expect(tall.h).toBe(Math.round(386 * tall.ppm))
    expect(tall.w / tall.h).toBeCloseTo(169 / 386, 2)
  })
})

describe('renderPanel pxPerMm and weave', () => {
  it('draws at the pixel density of the spec (pxPerMm) when it is given, still capped at PANEL_MAX_PX', async () => {
    const fine = await renderPanel({ wMm: 100, hMm: 50, base: '#202020', items: [], pxPerMm: 12 })
    const meta = await sharp(Buffer.from(fine)).metadata()
    expect([meta.width, meta.height]).toEqual([1200, 600])
    const capped = await renderPanel({ wMm: 300, hMm: 50, base: '#202020', items: [], pxPerMm: 12 })
    expect((await sharp(Buffer.from(capped)).metadata()).width).toBeLessThanOrEqual(PANEL_MAX_PX)
  })
  it('draws a diamond weave: crossing diagonal lines (stroke) over a fill, in its area only', async () => {
    const png = await renderPanel({ wMm: 40, hMm: 40, base: '#101010', pxPerMm: 12, items: [{ kind: 'weave', x: 10, y: 10, w: 20, h: 20, pitch: 2, line: 0.4, fill: '#cccccc', stroke: '#333333' }] })
    const { data, info } = await sharp(Buffer.from(png)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const at = (x: number, y: number): number => data[(y * info.width + x) * 3]
    expect(at(5, 5)).toBe(0x10) // outside the weave: the base
    const seen = new Set<number>()
    for (let y = 150; y < 330; y++) for (let x = 150; x < 330; x++) seen.add(at(x, y) > 0x80 ? 1 : 0)
    expect(seen.size).toBe(2) // inside: both the light fill and the dark lines
  })
})

describe('renderPanel', () => {
  const spec: PanelSpec = {
    wMm: 100,
    hMm: 40,
    base: '#202020',
    items: [
      { kind: 'rect', x: 10, y: 5, w: 20, h: 10, fill: '#ff0000' }, // low-left
      { kind: 'circle', x: 80, y: 30, r: 5, fill: '#00ff00' }, // high-right
    ],
  }

  it('draws at the size of the face, base colour where nothing is drawn', async () => {
    const png = await renderPanel(spec)
    const meta = await sharp(Buffer.from(png)).metadata()
    const { w, h } = panelSizePx(100, 40)
    expect([meta.width, meta.height]).toEqual([w, h])
    expect(await pixel(png, 2, 2)).toEqual(hex('#202020'))
  })

  it('places a shape at its face-local position with y going UP from the bottom edge (a rect at y 5-15 mm is near the BOTTOM of the picture)', async () => {
    const png = await renderPanel(spec)
    const { h, ppm } = panelSizePx(100, 40)
    expect(await pixel(png, Math.round(20 * ppm), Math.round(h - 10 * ppm))).toEqual(hex('#ff0000')) // x 20 mm, y 10 mm from the bottom
    expect(await pixel(png, Math.round(20 * ppm), Math.round(10 * ppm))).toEqual(hex('#202020')) // the same x, 10 mm from the TOP: empty
    expect(await pixel(png, Math.round(80 * ppm), Math.round(h - 30 * ppm))).toEqual(hex('#00ff00')) // the circle at (80, 30)
  })

  it('refuses a colour that is not #rrggbb, a size below 1 mm, and a text with markup characters (the panel text is drawn, never interpreted)', async () => {
    await expect(renderPanel({ ...spec, base: 'red' })).rejects.toThrow(/#rrggbb/)
    await expect(renderPanel({ ...spec, wMm: 0 })).rejects.toThrow(/size/)
    const t = await renderPanel({ ...spec, items: [{ kind: 'text', x: 5, y: 5, size: 4, text: 'A<B&C', fill: '#ffffff' }] })
    expect((await sharp(Buffer.from(t)).metadata()).width).toBeGreaterThan(0)
  })

  it('draws a vent grid as many small dots in its area', async () => {
    const png = await renderPanel({ ...spec, items: [{ kind: 'vents', x: 10, y: 10, w: 40, h: 20, pitch: 4, r: 1, fill: '#ffffff' }] })
    const { data, info } = await sharp(Buffer.from(png)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    let white = 0
    for (let i = 0; i < data.length; i += 3) if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) white++
    expect(white).toBeGreaterThan(50 * 20) // 10 x 5 = 50 dots of about 2 mm diameter
    expect(white).toBeLessThan((info.width * info.height) / 4)
  })
})
