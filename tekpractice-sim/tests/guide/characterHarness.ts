// Harness for the new Oscar's browser tests (plan T5.2): the real module bundled into a blank page with the real sheets, and pixel helpers.
// Lives in tests/guide (not tests/e2e): only the guide's own files may name the vendored folder (tests/guide/vendor.test.ts).
// HOW IT RUNS: tests/guide/characterPage.ts (which imports src/guide/character.ts and the vendored mascot and overlay) is bundled by esbuild
// (installed at the top level of node_modules through tsx) into one IIFE; the page is `page.setContent` with the vendored guide.css then
// src/guide/character.css, read from the source tree (plain CSS: Vite copies it unchanged). No route of the app is added and dist/ is not
// read, so the test cannot pick up a stale build; the Playwright web server still starts (the config has one) but these specs do not use it.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSync } from 'esbuild'
import sharp from 'sharp'
import type { Page } from '@playwright/test'

export const NUIT = '#131114'
export const PAPIER = '#F3EDE3'
export const PRUNE = '#612D45'

let bundle: string | null = null
function pageBundle(): string {
  if (bundle === null) {
    const out = buildSync({ entryPoints: [resolve('tests/guide/characterPage.ts')], bundle: true, format: 'iife', target: 'es2020', write: false, logLevel: 'silent' })
    bundle = out.outputFiles[0].text
  }
  return bundle
}

/** A blank page with the vendored sheet and (unless `characterCss: false`) the character's sheet, then the bundled test page API on window.__tpo. */
export async function openCharacterPage(page: Page, opts: { characterCss?: boolean; ground?: string } = {}): Promise<void> {
  const vendorCss = readFileSync(resolve('src/guide/vendor/guide.css'), 'utf8')
  const characterCss = opts.characterCss === false ? '' : readFileSync(resolve('src/guide/character.css'), 'utf8')
  await page.setContent(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:${opts.ground ?? NUIT};font:13px system-ui,sans-serif}</style>` +
      `<style>${vendorCss}</style><style>${characterCss}</style></head><body></body></html>`,
  )
  await page.addScriptTag({ content: pageBundle() })
  await page.waitForFunction(() => typeof window.__tpo === 'object')
}

export interface Raster {
  w: number
  h: number
  data: Buffer
}

export async function shot(page: Page, selector: string): Promise<Raster> {
  const png = await page.locator(selector).screenshot({ animations: 'allow' })
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { w: info.width, h: info.height, data }
}

const TOL = 24
const hex = (c: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number]

/** Share of pixels whose colour differs (any channel by more than 24 of 255). */
export function pixelDiff(a: Raster, b: Raster): number {
  if (a.w !== b.w || a.h !== b.h) throw new Error(`size ${a.w}x${a.h} vs ${b.w}x${b.h}`)
  let n = 0
  for (let i = 0; i < a.w * a.h; i++) {
    const o = i * 4
    if (Math.max(Math.abs(a.data[o] - b.data[o]), Math.abs(a.data[o + 1] - b.data[o + 1]), Math.abs(a.data[o + 2] - b.data[o + 2])) > TOL) n++
  }
  return n / (a.w * a.h)
}

/** The silhouette: true where the pixel is not the ground colour. */
export function mask(r: Raster, ground: string): boolean[] {
  const [gr, gg, gb] = hex(ground)
  const out: boolean[] = []
  for (let i = 0; i < r.w * r.h; i++) {
    const o = i * 4
    out.push(Math.max(Math.abs(r.data[o] - gr), Math.abs(r.data[o + 1] - gg), Math.abs(r.data[o + 2] - gb)) > TOL)
  }
  return out
}

export const xorShare = (a: boolean[], b: boolean[]): number => a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0) / a.length

/** The circle closest to a silhouette: same area, centred on its centroid (the hardest plain circle to tell apart from it). */
export function bestCircle(m: boolean[], w: number): boolean[] {
  let n = 0
  let sx = 0
  let sy = 0
  m.forEach((v, i) => {
    if (!v) return
    n++
    sx += (i % w) + 0.5
    sy += Math.floor(i / w) + 0.5
  })
  const cx = sx / n
  const cy = sy / n
  const r = Math.sqrt(n / Math.PI)
  return m.map((_v, i) => Math.hypot((i % w) + 0.5 - cx, Math.floor(i / w) + 0.5 - cy) <= r)
}
