/**
 * Task 36: the acoustics CORE (geometry, field, scale, grid) is a pure layer. It runs in a Web Worker (Task 37) and is read by
 * src/audio/listenerMix.ts (Task 39), so it may import only itself: no Babylon, no DOM, no store, no creation / engine / flow module.
 * A TYPE import from tools/schemas is the only thing allowed to reach outside (it is erased and carries no runtime dependency).
 * Task 37 adds worker.ts, client.ts and job.ts to the same folder (worker.ts uses `self` / `postMessage`); they are NOT part of the core, so this test
 * names the core files explicitly instead of reading the folder. Modelled on the src/flow guard (tests/flow/signalPath.test.ts).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../src')
const dir = resolve(root, 'acoustics')
const CORE = ['geometry', 'field', 'scale', 'grid'] as const

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
/** Every file and every package reachable by value imports from `entry`. */
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
const coreFiles = (): string[] => CORE.map((n) => resolve(dir, `${n}.ts`))
const rel = (f: string): string => f.replace(root, '').replace(/\\/g, '/')
const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('the acoustics core stays a pure layer', () => {
  it('the four core modules exist', () => {
    for (const f of coreFiles()) expect(existsSync(f), rel(f)).toBe(true)
  })
  it('the value-import closure of each core module stays inside the core and reaches no package at all', () => {
    for (const entry of coreFiles()) {
      const { files, packages } = closure(entry)
      for (const f of files) expect(rel(f), `${rel(entry)} reaches ${rel(f)}`).toMatch(new RegExp(`^/acoustics/(${CORE.join('|')})\\.ts$`))
      expect([...packages], rel(entry)).toEqual([])
    }
  })
  it('every value import of a core module is another core module `./name` (no asset, no package, no parent folder, no worker/client)', () => {
    for (const f of coreFiles()) for (const spec of valueSpecifiers(readFileSync(f, 'utf8'))) expect(spec, rel(f)).toMatch(new RegExp(`^\\./(${CORE.join('|')})$`))
  })
  it('the only thing that may leave the folder is an `import type` from tools/schemas', () => {
    for (const f of coreFiles()) {
      for (const spec of typeSpecifiers(readFileSync(f, 'utf8'))) {
        const ok = new RegExp(`^\\./(${CORE.join('|')})$`).test(spec) || /^(?:\.\.\/)+tools\/schemas$/.test(spec)
        expect(ok, `${rel(f)} type-imports ${spec}`).toBe(true)
      }
    }
  })
  it('no core module names Babylon, the DOM, a worker global, the store or the shell', () => {
    for (const f of coreFiles()) {
      const code = stripComments(readFileSync(f, 'utf8'))
      for (const bad of [/@babylonjs/, /\bdocument\b/, /\bwindow\b/, /\bself\b/, /\bpostMessage\b/, /\bnavigator\b/, /creation\/store/, /ConnectionGraph/, /RuleEvaluator/, /\bCOPY\b/]) {
        expect(code, `${rel(f)} ${bad}`).not.toMatch(bad)
      }
    }
  })
  it('the core does not depend on Date or randomness (the field is a pure function of its inputs)', () => {
    for (const f of coreFiles()) expect(readFileSync(f, 'utf8'), rel(f)).not.toMatch(/\bDate\b|Math\.random|performance\.now/)
  })
})

describe('the worker side (Task 37): worker.ts, client.ts and job.ts import only the core and each other', () => {
  const SIDE = ['worker', 'client', 'job'] as const
  const ALLOWED_SIDE: Record<(typeof SIDE)[number], string[]> = {
    job: ['job', ...CORE],
    client: ['client', 'job', ...CORE],
    worker: ['worker', 'job', ...CORE],
  }
  const file = (n: string): string => resolve(dir, `${n}.ts`)
  it('the three files exist', () => {
    for (const n of SIDE) expect(existsSync(file(n)), n).toBe(true)
  })
  it('the value-import closure of each stays inside its allow-list and reaches no package', () => {
    for (const n of SIDE) {
      const { files, packages } = closure(file(n))
      const names = [...files].map((f) => rel(f).replace(/^\/acoustics\//, '').replace(/\.ts$/, ''))
      for (const f of names) expect(ALLOWED_SIDE[n], `${n}.ts reaches ${f}`).toContain(f)
      expect([...packages], n).toEqual([])
    }
  })
  it('only the worker names a worker global; none names Babylon, the DOM, the store or the shell', () => {
    for (const n of SIDE) {
      const code = stripComments(readFileSync(file(n), 'utf8'))
      for (const bad of [/@babylonjs/, /\bdocument\b/, /\bwindow\b/, /creation\/store/, /ConnectionGraph/, /RuleEvaluator/, /\bCOPY\b/]) expect(code, `${n}.ts ${bad}`).not.toMatch(bad)
      if (n !== 'worker') expect(code, `${n}.ts names a worker global`).not.toMatch(/\bself\b/)
    }
    expect(stripComments(readFileSync(file('worker'), 'utf8'))).toMatch(/\bself\b/)
  })
  it('no core module imports the worker side (the core stays importable by listenerMix and by the worker alike)', () => {
    for (const f of coreFiles()) for (const spec of valueSpecifiers(readFileSync(f, 'utf8'))) expect(spec, rel(f)).not.toMatch(/worker|client|job/)
  })
})

describe('the guard bites (on a fixture made for the test, independent of the rest of src)', () => {
  const tmp = mkdtempSync(resolve(tmpdir(), 'acoustics-guard-'))
  afterAll(() => rmSync(tmp, { recursive: true, force: true }))
  const write = (name: string, body: string): string => {
    const f = resolve(tmp, name)
    mkdirSync(dirname(f), { recursive: true })
    writeFileSync(f, body)
    return f
  }
  const a = write('core/a.ts', "import { b } from './b'\nexport const a = b\n")
  write('core/b.ts', "import { leak } from '../outside/leak'\nimport x from '@babylonjs/core'\nexport const b = leak + String(x)\n")
  write('outside/leak.ts', 'export const leak = 1\n')
  const clean = write('core/clean.ts', "import { a } from './a'\nexport const clean = a\n")
  const dyn = write('core/dyn.ts', "export const load = () => import('@babylonjs/core')\n")
  const typeOnly = write('core/typeOnly.ts', "import type { T } from '../outside/leak'\nexport type U = T\n")

  it('the walker follows transitive imports out of the folder and reports packages', () => {
    const { files, packages } = closure(a)
    expect([...files].map((f) => f.replace(tmp, '').replace(/\\/g, '/')).sort()).toEqual(['/core/a.ts', '/core/b.ts', '/outside/leak.ts'])
    expect([...packages]).toEqual(['@babylonjs/core'])
    expect([...closure(clean).files].some((f) => /outside/.test(f))).toBe(true) // reached through a -> b
  })
  it('a dynamic import() is seen; an `import type` is not a value import but is listed as a type import', () => {
    expect([...closure(dyn).packages]).toEqual(['@babylonjs/core'])
    expect(closure(typeOnly).files.size).toBe(1)
    expect(typeSpecifiers(readFileSync(typeOnly, 'utf8'))).toEqual(['../outside/leak'])
  })
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
  it('stripComments hides words in comments but not in code', () => {
    expect(stripComments('// self\n/* window */\nconst x = self')).toMatch(/const x = self/)
    expect(stripComments('// self\n/* window */\nconst x = 1')).not.toMatch(/self|window/)
  })
})
