/**
 * assets3d/genericPanel: a flat panel picture drawn from data, for a device that has no usable photo.
 *
 * A panel is a base colour and a list of shapes (rectangles, circles, vent grids, text) in the spec's face-local millimetres: x to the right seen from
 * outside, y UP from the bottom edge, so a connector drawn at a port's (xMm, yMm) lands exactly under that port's marker. The result is a generic
 * equivalent of the panel (a socket, a button, a vent): never a brand mark, never a copy of a photo. The hybrid route maps it on the face like any photo
 * (`asset:build <id> --scripted --project-photo <face>=<png>`); the data lives in content/generic-panels/<id>.json and `npm run asset:panel -- <id>` draws it.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

/** Pixels per millimetre of a drawn panel, before the cap below. */
export const PANEL_PX_PER_MM = 6
/** The longer side of a drawn panel never exceeds this many pixels. */
export const PANEL_MAX_PX = 2048

export type PanelItem =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill: string; stroke?: string; radius?: number }
  | { kind: 'circle'; x: number; y: number; r: number; fill: string; stroke?: string }
  | { kind: 'vents'; x: number; y: number; w: number; h: number; pitch: number; r: number; fill: string }
  | { kind: 'weave'; x: number; y: number; w: number; h: number; pitch: number; line: number; fill: string; stroke: string; hole?: string }
  /** A square mesh: vertical and horizontal wires (stroke, width line) over a dark hole colour (fill), pitch apart: a window of a studio microphone grille. */
  | { kind: 'grid'; x: number; y: number; w: number; h: number; pitch: number; line: number; fill: string; stroke: string }
  | { kind: 'text'; x: number; y: number; size: number; text: string; fill: string; anchor?: 'start' | 'middle' | 'end' }

export interface PanelSpec {
  wMm: number
  hMm: number
  base: string
  items: PanelItem[]
  /** Pixels per millimetre (default PANEL_PX_PER_MM); a wrap picture of a mic grille wants about 12. Still capped so the longer side stays within PANEL_MAX_PX. */
  pxPerMm?: number
}

const HEX = /^#[0-9a-fA-F]{6}$/

/** Pixel size of a panel of w x h mm: PANEL_PX_PER_MM, scaled down so that the longer side fits PANEL_MAX_PX. */
export function panelSizePx(wMm: number, hMm: number, pxPerMm: number = PANEL_PX_PER_MM): { w: number; h: number; ppm: number } {
  const ppm = Math.min(pxPerMm, PANEL_MAX_PX / Math.max(wMm, hMm))
  return { w: Math.round(wMm * ppm), h: Math.round(hMm * ppm), ppm }
}

const colour = (c: string, what: string): string => {
  if (!HEX.test(c)) throw new Error(`renderPanel: ${what} must be #rrggbb, got ${JSON.stringify(c)}`)
  return c
}
const xmlEscape = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n = (v: number): string => String(Math.round(v * 100) / 100)

/** The PNG of `spec`. Throws on a size below 1 mm or a colour that is not #rrggbb. */
export async function renderPanel(spec: PanelSpec): Promise<Uint8Array> {
  if (!(spec.wMm >= 1) || !(spec.hMm >= 1)) throw new Error(`renderPanel: the size must be at least 1 mm, got ${spec.wMm} x ${spec.hMm}`)
  const { w, h, ppm } = panelSizePx(spec.wMm, spec.hMm, spec.pxPerMm)
  const px = (mm: number): number => mm * ppm
  const py = (mmFromBottom: number): number => h - mmFromBottom * ppm // image y runs down
  const parts: string[] = [`<rect width="${w}" height="${h}" fill="${colour(spec.base, 'base')}"/>`]
  const defs: string[] = []
  for (const [idx, it] of spec.items.entries()) {
    if (it.kind === 'rect') {
      const stroke = it.stroke ? ` stroke="${colour(it.stroke, 'stroke')}" stroke-width="${n(ppm * 0.4)}"` : ''
      parts.push(`<rect x="${n(px(it.x))}" y="${n(py(it.y + it.h))}" width="${n(px(it.w))}" height="${n(px(it.h))}" rx="${n(px(it.radius ?? 0))}" fill="${colour(it.fill, 'fill')}"${stroke}/>`)
    } else if (it.kind === 'circle') {
      const stroke = it.stroke ? ` stroke="${colour(it.stroke, 'stroke')}" stroke-width="${n(ppm * 0.4)}"` : ''
      parts.push(`<circle cx="${n(px(it.x))}" cy="${n(py(it.y))}" r="${n(px(it.r))}" fill="${colour(it.fill, 'fill')}"${stroke}/>`)
    } else if (it.kind === 'weave') {
      // a diamond lattice: two diagonal lines per cell over the fill, and (optionally) a dark hole at the centre of each diamond
      const cell = it.pitch * ppm
      const lw = Math.max(0.5, it.line * ppm)
      const stroke = colour(it.stroke, 'stroke')
      const hole = it.hole ? `<circle cx="${n(cell / 2)}" cy="${n(cell / 2)}" r="${n(cell * 0.16)}" fill="${colour(it.hole, 'hole')}"/>` : ''
      defs.push(
        `<pattern id="weave${idx}" x="${n(px(it.x))}" y="${n(py(it.y + it.h))}" width="${n(cell)}" height="${n(cell)}" patternUnits="userSpaceOnUse"><rect width="${n(cell)}" height="${n(cell)}" fill="${colour(it.fill, 'fill')}"/>${hole}<path d="M0 0 L${n(cell)} ${n(cell)} M${n(cell)} 0 L0 ${n(cell)}" stroke="${stroke}" stroke-width="${n(lw)}" fill="none"/></pattern>`,
      )
      parts.push(`<rect x="${n(px(it.x))}" y="${n(py(it.y + it.h))}" width="${n(px(it.w))}" height="${n(px(it.h))}" fill="url(#weave${idx})"/>`)
    } else if (it.kind === 'grid') {
      const cell = it.pitch * ppm
      const lw = Math.max(0.5, it.line * ppm)
      const wire = colour(it.stroke, 'stroke')
      defs.push(
        `<pattern id="grid${idx}" x="${n(px(it.x))}" y="${n(py(it.y + it.h))}" width="${n(cell)}" height="${n(cell)}" patternUnits="userSpaceOnUse"><rect width="${n(cell)}" height="${n(cell)}" fill="${colour(it.fill, 'fill')}"/><path d="M${n(cell / 2)} 0 V${n(cell)} M0 ${n(cell / 2)} H${n(cell)}" stroke="${wire}" stroke-width="${n(lw)}" fill="none"/></pattern>`,
      )
      parts.push(`<rect x="${n(px(it.x))}" y="${n(py(it.y + it.h))}" width="${n(px(it.w))}" height="${n(px(it.h))}" fill="url(#grid${idx})"/>`)
    } else if (it.kind === 'vents') {
      const fill = colour(it.fill, 'fill')
      for (let gx = it.pitch / 2; gx < it.w; gx += it.pitch) {
        for (let gy = it.pitch / 2; gy < it.h; gy += it.pitch) {
          parts.push(`<circle cx="${n(px(it.x + gx))}" cy="${n(py(it.y + gy))}" r="${n(px(it.r))}" fill="${fill}"/>`)
        }
      }
    } else {
      parts.push(
        `<text x="${n(px(it.x))}" y="${n(py(it.y))}" font-family="Arial, Helvetica, sans-serif" font-size="${n(px(it.size))}" font-weight="bold" text-anchor="${it.anchor ?? 'start'}" fill="${colour(it.fill, 'fill')}">${xmlEscape(it.text)}</text>`,
      )
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs.length > 0 ? `<defs>${defs.join('')}</defs>` : ''}${parts.join('')}</svg>`
  return new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer())
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** CLI: `npm run asset:panel -- <id>` draws every face of content/generic-panels/<id>.json into assets-source/<id>/photos/_generic_<face>.png. */
export async function main(argv: string[]): Promise<number> {
  const id = argv[0]
  if (!id) {
    console.error('usage: npm run asset:panel -- <id>')
    return 1
  }
  try {
    const data = JSON.parse(await readFile(join(REPO_ROOT, 'content', 'generic-panels', `${id}.json`), 'utf8')) as { faces: Record<string, PanelSpec> }
    const dir = join(REPO_ROOT, 'assets-source', id, 'photos')
    await mkdir(dir, { recursive: true })
    for (const [face, spec] of Object.entries(data.faces)) {
      const out = join(dir, `_generic_${face}.png`)
      await writeFile(out, await renderPanel(spec))
      console.log(`wrote ${out}`)
    }
    return 0
  } catch (e) {
    console.error((e as Error).message)
    return 1
  }
}

if (process.argv[1] && /genericPanel\.(ts|js)$/.test(process.argv[1])) {
  main(process.argv.slice(2)).then((c) => process.exit(c))
}
