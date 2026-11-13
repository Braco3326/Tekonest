// The guide imports the app, never the reverse: nothing under src/creation imports the guide, and nothing there imports the page's own coach (the old « Conseils »
// toast and its « Pourquoi ? » layer: src/ui/coach.ts, src/ai).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', 'src')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return [...new Set(out)]
}

/** Every module specifier a file imports, re-exports or dynamically imports. */
function specifiers(src: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) out.push(m[1])
  for (const m of src.matchAll(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g)) out.push(m[1])
  return [...new Set(out)]
}
const isGuide = (spec: string): boolean => /(^|\/)guide(\/|$)/.test(spec)
const isOldCoach = (spec: string): boolean => /(^|\/)ui\/coach$/.test(spec) || /(^|\/)ai(\/|$)/.test(spec) || /coach\/tips\.json$/.test(spec)

describe('Mode Création and the guide', () => {
  const files = walk(join(ROOT, 'creation'))

  it('scans a real list of files, and the guide folder exists', () => {
    expect(files.length).toBeGreaterThan(50)
    expect(existsSync(join(ROOT, 'guide', 'index.ts'))).toBe(true)
  })

  it('no file under src/creation imports (statically, dynamically or by re-export) anything from the guide folder', () => {
    for (const f of files) expect(specifiers(readFileSync(f, 'utf8')).filter(isGuide), f).toEqual([])
  })

  it('no file under src/creation imports the page’s own coach (src/ui/coach, src/ai)', () => {
    for (const f of files) expect(specifiers(readFileSync(f, 'utf8')).filter(isOldCoach), f).toEqual([])
  })

  it('the matchers catch what they are for', () => {
    expect(specifiers("import { x } from '../guide/mount'\nconst y = await import('../../guide')").filter(isGuide)).toEqual(['../guide/mount', '../../guide'])
    expect(specifiers("export * from '../guide/index'").filter(isGuide)).toEqual(['../guide/index'])
    expect(specifiers("import a from '../ui/coach'\nimport b from '../../ai/AiCoach'").filter(isOldCoach)).toEqual(['../ui/coach', '../../ai/AiCoach'])
    expect(specifiers("import { z } from '../guidebook'").filter(isGuide)).toEqual([])
  })
})
