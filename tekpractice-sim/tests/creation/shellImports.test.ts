import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
describe('the shell dispatches intents only (C6)', () => {
  it('no file under src/creation/shell imports ConnectionGraph or engine internals', () => {
    const dir = fileURLToPath(new URL('../../src/creation/shell/', import.meta.url))
    // TODO(Task 6+): once src/creation/shell/ exists, replace this early return
    // with `expect(existsSync(dir)).toBe(true)` so the guard can never pass vacuously.
    if (!existsSync(dir)) return
    for (const f of walk(dir).filter((p) => p.endsWith('.ts'))) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).not.toMatch(/ConnectionGraph/)
      expect(src, f).not.toMatch(/from\s+['"].*engine\/(ConnectionGraph|RuleEvaluator)['"]/)
    }
  })
})
