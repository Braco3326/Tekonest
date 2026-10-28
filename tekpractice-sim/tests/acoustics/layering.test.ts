/**
 * Task 36: src/acoustics is a pure layer. It will run in a Web Worker (Task 37) and be read by src/audio/listenerMix.ts (Task 39), so it
 * may import only itself: no Babylon, no DOM, no store, no creation / engine / flow module. A TYPE import from tools/schemas is the only
 * thing allowed to reach outside (it is erased and carries no runtime dependency). Modelled on the src/flow guard (tests/flow/signalPath.test.ts).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../src')
const dir = resolve(root, 'acoustics')

/** Specifiers of value imports, value re-exports, side-effect imports, dynamic import() and require(); `import type` is left out. */
function valueSpecifiers(src: string): string[] {
  return [
    ...src.matchAll(/^\s*(?:import|export)\s+(?!type\b)[\w\s{},*$]*?\bfrom\s+['"]([^'"]+)['"]/gm),
    ...src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm),
    ...src.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g),
    ...src.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]/g),
  ].map((m) => m[1])
}
/** Specifiers of `import type … from` and `export type … from`. */
function typeSpecifiers(src: string): string[] {
  return [...src.matchAll(/^\s*(?:import|export)\s+type\b[\w\s{},*$]*?\bfrom\s+['"]([^'"]+)['"]/gm)].map((m) => m[1])
}
const resolveTs = (from: string, spec: string): string | null => {
  if (!spec.startsWith('.')) return null
  const base = resolve(dirname(from), spec)
  for (const c of [`${base}.ts`, `${base}/index.ts`, base]) if (existsSync(c) && c.endsWith('.ts')) return c
  return null
}
/** Every src file and every package reachable by value imports from `entry`. */
function closure(entry: string): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>()
  const packages = new Set<string>()
  const todo = [entry]
  while (todo.length) {
    const f = todo.pop()!
    if (files.has(f)) continue
    files.add(f)
    for (const spec of valueSpecifiers(readFileSync(f, 'utf8'))) {
      const next = resolveTs(f, spec)
      if (next) todo.push(next)
      else if (!spec.startsWith('.')) packages.add(spec)
      else if (!/\.(json|css|svg|png|glb)$|\?/.test(spec)) throw new Error(`cannot resolve ${spec} from ${f}`) // assets are not code
    }
  }
  return { files, packages }
}
const sources = (): string[] => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => resolve(dir, f)) : [])
const rel = (f: string): string => f.replace(root, '').replace(/\\/g, '/')

describe('src/acoustics stays a pure layer', () => {
  it('the four modules exist', () => {
    expect(sources().map(rel).sort()).toEqual(['/acoustics/field.ts', '/acoustics/geometry.ts', '/acoustics/grid.ts', '/acoustics/scale.ts'])
  })
  it('the value-import closure of each module stays inside src/acoustics and reaches no package at all', () => {
    for (const entry of sources()) {
      const { files, packages } = closure(entry)
      for (const f of files) expect(rel(f), `${rel(entry)} reaches ${rel(f)}`).toMatch(/^\/acoustics\/[a-z]+\.ts$/)
      expect([...packages], rel(entry)).toEqual([])
    }
  })
  it('every value import is a sibling module `./name` (no asset, no package, no parent folder)', () => {
    for (const f of sources()) for (const spec of valueSpecifiers(readFileSync(f, 'utf8'))) expect(spec, rel(f)).toMatch(/^\.\/[a-z]+$/)
  })
  it('the only thing that may leave the folder is an `import type` from tools/schemas', () => {
    for (const f of sources()) {
      for (const spec of typeSpecifiers(readFileSync(f, 'utf8'))) {
        const ok = /^\.\/[a-z]+$/.test(spec) || /^(?:\.\.\/)+tools\/schemas$/.test(spec)
        expect(ok, `${rel(f)} type-imports ${spec}`).toBe(true)
      }
    }
  })
  it('no module names Babylon, the DOM, a worker global, the store or the shell', () => {
    for (const f of sources()) {
      const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      for (const bad of [/@babylonjs/, /\bdocument\b/, /\bwindow\b/, /\bself\b/, /\bpostMessage\b/, /\bnavigator\b/, /creation\/store/, /ConnectionGraph/, /RuleEvaluator/, /\bCOPY\b/]) {
        expect(code, `${rel(f)} ${bad}`).not.toMatch(bad)
      }
    }
  })
  it('the modules do not depend on Date or randomness (the field is a pure function of its inputs)', () => {
    for (const f of sources()) expect(readFileSync(f, 'utf8'), rel(f)).not.toMatch(/\bDate\b|Math\.random|performance\.now/)
  })
})

describe('the guard bites', () => {
  it('valueSpecifiers sees plain, multi-line, re-export, side-effect, dynamic and require imports, and skips `import type`', () => {
    const code = [
      "import { a } from '../engine/x'",
      'import {\n  b,\n  c,\n} from "../creation/store"',
      "export * from './y'",
      "export { z } from '../flow/z'",
      "import './side'",
      "const m = await import('@babylonjs/core')",
      "const r = require('node:fs')",
      "import type { T } from '../../tools/schemas'",
    ].join('\n')
    expect(valueSpecifiers(code).sort()).toEqual(['../engine/x', '../creation/store', './y', '../flow/z', './side', '@babylonjs/core', 'node:fs'].sort())
    expect(typeSpecifiers(code)).toEqual(['../../tools/schemas'])
  })
  it('the closure walker follows transitive imports (creation/boot reaches creation/store)', () => {
    const { files } = closure(resolve(root, 'creation/boot.ts'))
    expect([...files].some((f) => /creation[\\/]store\.ts$/.test(f))).toBe(true)
  })
  it('the closure walker finds packages (a Babylon-importing module reports @babylonjs)', () => {
    const { packages } = closure(resolve(root, 'scene/CameraRig.ts'))
    expect([...packages].some((p) => /babylon/i.test(p))).toBe(true)
  })
})
