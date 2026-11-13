/**
 * T7.3 (onboarding packs, spec 11.9, plan T7.3): the import scan of engine neutrality. The browser half is tests/e2e/engine-neutrality.spec.ts.
 *
 * Claim: what computes the simulation's results (the engine `src/engine`, the signal path `src/flow`, the logic checks R4 to R8 `src/logic`, and the store
 * that applies intents and runs them, `src/creation/store.ts`) never reaches the design packages, the guide or the onboarding code: not directly, not
 * through another module (the import graph is followed to its end), not by a type-only import, a re-export, a side-effect import or a dynamic import.
 * So the five packages can change the look, the first visit and the tutorial, never a result.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const rel = (f: string): string => relative(ROOT, f).replace(/\\/g, '/')
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))

/** Every module specifier of a source text: static, type-only, side-effect, re-export, dynamic. Comments are removed first (a path in a comment is not an import). */
export function specifiers(src: string): string[] {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')
  const out: string[] = []
  for (const re of [/\bimport\s+(?:type\s+)?[^'"`;]*?\s+from\s+['"]([^'"]+)['"]/g, /\bimport\s+['"]([^'"]+)['"]/g, /\bexport\s+(?:type\s+)?[^'"`;]*?\s+from\s+['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g])
    for (const m of code.matchAll(re)) out.push(m[1])
  return out
}

/** A relative specifier resolved to a file of the repository (`.ts`, `/index.ts`, or the file itself); null for a package or an unresolved path. */
function resolveFrom(file: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null
  const base = resolve(dirname(file), spec.replace(/\?.*$/, ''))
  for (const c of [base, `${base}.ts`, join(base, 'index.ts')]) if (existsSync(c) && statSync(c).isFile()) return c
  return null
}

/** Every file reached from `roots` through relative imports (TypeScript only is read; a .json or .css is a leaf). */
export function reach(roots: readonly string[]): Map<string, string> {
  const seen = new Map<string, string>() // file -> the file that imported it first (for the message)
  const todo = roots.map((r) => [r, '(root)'] as const)
  for (const [r, by] of todo) if (!seen.has(r)) seen.set(r, by)
  const queue = [...roots]
  while (queue.length > 0) {
    const f = queue.shift()!
    if (!f.endsWith('.ts')) continue
    for (const spec of specifiers(readFileSync(f, 'utf8'))) {
      const to = resolveFrom(f, spec)
      if (to === null || seen.has(to)) continue
      seen.set(to, f)
      queue.push(to)
    }
  }
  return seen
}

/** The code the packages, the guide and the onboarding live in. */
const FORBIDDEN = ['src/design/', 'src/guide/', 'src/creation/onboarding/']
const ROOTS = [...['src/engine', 'src/flow', 'src/logic'].flatMap((d) => walk(join(ROOT, d)).filter((f) => f.endsWith('.ts'))), join(ROOT, 'src/creation/store.ts')]

/** The forbidden files `roots` reach, each with the chain that reaches it. */
function offenders(roots: readonly string[]): string[] {
  const seen = reach(roots)
  const chain = (f: string): string => {
    const out = [rel(f)]
    for (let at = seen.get(f); at !== undefined && at !== '(root)'; at = seen.get(at)) out.push(rel(at))
    return out.reverse().join(' -> ')
  }
  return [...seen.keys()].filter((f) => FORBIDDEN.some((p) => rel(f).startsWith(p))).map(chain)
}

describe('engine neutrality: the import scan (spec 11.9)', () => {
  it('the roots are the engine, the signal path, the logic checks and the store, and the scan reaches beyond them (not vacuous)', () => {
    const names = ROOTS.map(rel)
    for (const must of ['src/engine/ConnectionGraph.ts', 'src/engine/RuleEvaluator.ts', 'src/engine/CatalogLoader.ts', 'src/flow/signalPath.ts', 'src/logic/phantom.ts', 'src/logic/gpio.ts', 'src/creation/store.ts'])
      expect(names, must).toContain(must)
    const reached = [...reach(ROOTS).keys()].map(rel)
    // what the roots really import, followed: the copy deck through the signal path, the mains rule, the design applier through the store
    for (const must of ['src/creation/copy.ts', 'src/creation/mains.ts', 'src/scene/designApplier.ts']) expect(reached, must).toContain(must)
    expect(reached.length).toBeGreaterThan(ROOTS.length)
  })

  it('no file under src/engine, src/flow, src/logic, nor src/creation/store.ts, reaches src/design, src/guide or src/creation/onboarding (direct or through any module)', () => {
    expect(offenders(ROOTS)).toEqual([])
  })

  it('the scan bites: a module that imports the packages through a neighbour is caught, with its chain', () => {
    // src/guide/tutorial.ts imports src/design/packages.ts (a real module): taken as a root it must be an offender, and so must anything that imports it
    expect(offenders([join(ROOT, 'src/guide/tutorial.ts')]).some((c) => c.includes('src/design/packages.ts'))).toBe(true)
    // the onboarding's own wiring reaches the packages
    expect(offenders([join(ROOT, 'src/creation/onboarding/wire.ts')]).length).toBeGreaterThan(0)
  })

  it('the parser sees every import form and ignores comments', () => {
    const src = [
      `import { a } from './x'`,
      `import type { B } from "../y"`,
      `import './side'`,
      `export { c } from './re'`,
      `export * from './all'`,
      `const m = await import('./lazy')`,
      `// import { no } from './comment'`,
      `/* import { no2 } from './block' */`,
      `const url = 'http://example' // not a comment start inside a string`,
    ].join('\n')
    expect(specifiers(src)).toEqual(expect.arrayContaining(['./x', '../y', './side', './re', './all', './lazy']))
    expect(specifiers(src)).not.toContain('./comment')
    expect(specifiers(src)).not.toContain('./block')
  })
})
