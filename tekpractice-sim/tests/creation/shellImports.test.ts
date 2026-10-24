import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
describe('the shell dispatches intents only (C6)', () => {
  it('no file under src/creation/shell imports ConnectionGraph or engine internals', () => {
    const dir = new URL('../../src/creation/shell/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
    if (!existsSync(dir)) return
    for (const f of walk(dir).filter((p) => p.endsWith('.ts'))) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).not.toMatch(/ConnectionGraph/)
      expect(src, f).not.toMatch(/from\s+['"].*engine\/(ConnectionGraph|RuleEvaluator)['"]/)
    }
  })
})
