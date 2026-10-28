import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
const creationDir = fileURLToPath(new URL('../../src/creation/', import.meta.url))
const rel = (f: string): string => relative(creationDir, f).replace(/\\/g, '/')
/** An import (static, side-effect, re-export or dynamic) of the graph or the rule evaluator, whatever the path prefix. */
const ENGINE_IMPORT = /(?:from\s+|import\s*\(\s*|import\s+)['"][^'"]*engine\/(ConnectionGraph|RuleEvaluator)['"]/

/** The one module allowed to own the graph and the evaluator: the store that applies intents (C1, C6). */
const ALLOWED = new Set(['store.ts'])

describe('the shell dispatches intents only (C6)', () => {
  it('no file under src/creation/shell imports ConnectionGraph or engine internals', () => {
    const dir = fileURLToPath(new URL('../../src/creation/shell/', import.meta.url))
    // The folder exists since Task 6: the guard can never pass vacuously.
    expect(existsSync(dir)).toBe(true)
    const files = walk(dir).filter((p) => p.endsWith('.ts'))
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).not.toMatch(/ConnectionGraph/)
      expect(src, f).not.toMatch(ENGINE_IMPORT)
    }
  })

  it('C1 defines the shell as src/creation/: nothing in it but the allow-listed store imports ConnectionGraph or RuleEvaluator (final review 6)', () => {
    expect(existsSync(creationDir)).toBe(true)
    const files = walk(creationDir).filter((p) => p.endsWith('.ts'))
    const names = files.map(rel)
    // The scan must reach the controllers Phase 3 added (a guard that skips them is no guard).
    for (const must of ['patchController.ts', 'placementController.ts', 'editController.ts', 'cableHover.ts', 'betaDevices.ts', 'portProxies.ts', 'sceneHost.ts', 'boot.ts', 'store.ts', 'shell/connectDialog.ts'])
      expect(names, must).toContain(must)
    const offenders = files
      .filter((f) => !ALLOWED.has(rel(f)))
      .filter((f) => {
        const src = readFileSync(f, 'utf8')
        return ENGINE_IMPORT.test(src) || /\bConnectionGraph\b/.test(src)
      })
      .map(rel)
    expect(offenders).toEqual([])
  })

  it('the allow-list is not dead weight: store.ts really imports both (else drop it from ALLOWED)', () => {
    const store = readFileSync(join(creationDir, 'store.ts'), 'utf8')
    expect(store).toMatch(/import\s*\{\s*ConnectionGraph\s*\}\s*from\s*'..\/engine\/ConnectionGraph'/)
    expect(store).toMatch(/import\s*\{\s*RuleEvaluator\s*\}\s*from\s*'..\/engine\/RuleEvaluator'/)
    expect([...ALLOWED]).toEqual(['store.ts'])
  })

  it('the guard bites: the matcher catches every import form of the graph and the evaluator', () => {
    for (const line of [
      `import { ConnectionGraph } from '../engine/ConnectionGraph'`,
      `import { RuleEvaluator } from "../../engine/RuleEvaluator"`,
      `import '../engine/ConnectionGraph'`,
      `export { RuleEvaluator } from '../engine/RuleEvaluator'`,
      `const m = await import('../engine/ConnectionGraph')`,
    ])
      expect(line, line).toMatch(ENGINE_IMPORT)
    expect(`import type { PortRef } from '../engine/types'`).not.toMatch(ENGINE_IMPORT)
    expect(`import { loadCatalog } from '../engine/CatalogLoader'`).not.toMatch(ENGINE_IMPORT)
  })
})
