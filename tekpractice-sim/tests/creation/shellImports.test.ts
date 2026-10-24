import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
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
      expect(src, f).not.toMatch(/from\s+['"].*engine\/(ConnectionGraph|RuleEvaluator)['"]/)
    }
  })
})
