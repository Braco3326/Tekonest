/**
 * assets3d/make-sheet: the contact sheet of one asset from the command line.
 *
 *   npm run asset:sheet -- <id> [file.glb] [--out file.png]
 *
 *  - input: the given GLB, else the final.glb of the most recent run under assets-source/<id>/work/ that has one,
 *    else the shipped public/assets/<id>.glb
 *  - reference photo: the first photo (by name) of assets-source/<id>/photos, or none
 *  - overlay: the spec of <id> (content/asset-specs) when there is one
 *  - output: --out, else contact-sheet.png next to the input, except that a GLB inside public/assets (shipped) gets its
 *    sheet under assets-source/<id>/ and an --out inside public/assets is refused: Vite would ship the PNG
 * Needs Blender (renderContactSheet renders four orthographic views). Exit codes: 0 sheet written, 1 anything else.
 * Everything is injectable (paths, spec loader, Blender exec) so it is unit-tested without Blender.
 */
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderContactSheet } from './contactSheet'
import type { ContactSheetDeps } from './contactSheet'
import { loadSpecs } from './loadSpecs'
import { isMainModule } from './mainModule'
import type { AssetSpecT } from './specSchema'

const PHOTO_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const SHEET_NAME = 'contact-sheet.png'

export const USAGE = 'usage: npm run asset:sheet -- <id> [file.glb] [--out file.png]'

export interface SheetDeps extends ContactSheetDeps {
  /** assets-source (<id>/work, <id>/photos). */
  sourceDir: string
  /** public/assets (the shipped <id>.glb). */
  assetsDir: string
  /** The spec of `id`, or undefined when there is none. */
  loadSpec: (id: string) => AssetSpecT | undefined
  render: typeof renderContactSheet
}

function resolveDeps(deps: Partial<SheetDeps>): SheetDeps {
  return {
    ...deps,
    sourceDir: deps.sourceDir ?? join(REPO_ROOT, 'assets-source'),
    assetsDir: deps.assetsDir ?? join(REPO_ROOT, 'public', 'assets'),
    loadSpec: deps.loadSpec ?? ((id) => loadSpecs().find((s) => s.id === id)),
    render: deps.render ?? renderContactSheet,
  }
}

/** The final.glb of the newest run folder of `id` that has one (run folders are named by their ISO start time), or null. */
export async function latestFinalGlb(sourceDir: string, id: string): Promise<string | null> {
  const work = join(sourceDir, id, 'work')
  if (!existsSync(work)) return null
  const runs = (await readdir(work, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort().reverse()
  for (const run of runs) {
    const glb = join(work, run, 'final.glb')
    if (existsSync(glb)) return glb
  }
  return null
}

/** The first reference photo of `id` by file name, or null. */
export async function firstPhoto(sourceDir: string, id: string): Promise<string | null> {
  const dir = join(sourceDir, id, 'photos')
  if (!existsSync(dir)) return null
  const names = (await readdir(dir)).filter((f) => PHOTO_EXTS.has(extname(f).toLowerCase())).sort()
  return names.length > 0 ? join(dir, names[0]) : null
}

type Print = (line: string) => void

/** CLI entry: returns the exit code. */
export async function main(argv: string[], deps: Partial<SheetDeps> = {}, print: Print = console.log): Promise<number> {
  const d = resolveDeps(deps)
  let id: string | undefined
  let glb: string | undefined
  let out: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) {
        print(`--out needs a .png path\n${USAGE}`)
        return 1
      }
      out = v
    } else if (a.startsWith('--')) {
      print(`unknown option ${a}\n${USAGE}`)
      return 1
    } else if (id === undefined) id = a
    else if (glb === undefined) glb = a
    else {
      print(`unexpected argument ${a}\n${USAGE}`)
      return 1
    }
  }
  if (id === undefined) {
    print(`an asset id is required\n${USAGE}`)
    return 1
  }

  try {
    const input = glb ? resolve(glb) : ((await latestFinalGlb(d.sourceDir, id)) ?? join(d.assetsDir, `${id}.glb`))
    if (!existsSync(input)) {
      print(`error: no GLB for ${id}: no final.glb under ${join(d.sourceDir, id, 'work')} and no ${join(d.assetsDir, `${id}.glb`)}`)
      return 1
    }
    const photo = await firstPhoto(d.sourceDir, id)
    const spec = d.loadSpec(id)
    const inAssets = (p: string): boolean => {
      const rel = relative(resolve(d.assetsDir), resolve(p))
      return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
    }
    if (out && inAssets(out)) {
      print(`error: --out ${out} is inside the assets dir (public/assets): Vite would ship the sheet, write it elsewhere`)
      return 1
    }
    const target = out ? resolve(out) : inAssets(input) ? join(d.sourceDir, id, SHEET_NAME) : join(dirname(input), SHEET_NAME)
    await d.render(input, photo, target, spec, { exec: d.exec, blender: d.blender })
    print(`contact sheet of ${input}${photo ? ` with ${photo}` : ' (no reference photo)'}${spec ? '' : ' (no spec: no overlay)'}`)
    print(`wrote ${target}`)
    return 0
  } catch (e) {
    print(`error: ${e instanceof Error ? e.message : String(e)}`)
    return 1
  }
}

if (isMainModule(process.argv[1], import.meta.url)) void main(process.argv.slice(2)).then((code) => process.exit(code))
