import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COPY } from '../../src/creation/copy'
import { CABLE_TYPES } from '../../src/plan2d/cableStyle2d'

const ROOT = join(__dirname, '..', '..')
const P = (): Readonly<Record<string, string>> => COPY.plan2d ?? {}

describe('the 2D page’s French copy (spec §2 last paragraph, §4)', () => {
  it('has its own section, with the page’s title, the menu entry and a name for every cable type', () => {
    expect(P().menu).toBe('Schéma 2D')
    expect(P().title).toContain('{room}')
    const name = (t: string): string => `type${t.split('-').map((w) => w[0]!.toUpperCase() + w.slice(1)).join('')}`
    for (const t of CABLE_TYPES) expect(P()[name(t)], t).toBeTruthy()
  })

  it('claims no conformity: no « conforme », no « certifié », no « norme IEC / AES » as a fact; the conventions are « conventions courantes »', () => {
    for (const [k, v] of Object.entries(P())) expect(v, k).not.toMatch(/conforme|certifi|selon la norme|norme (IEC|CEI|AES)/i)
    expect(P().sourcesIntro).toMatch(/^Conventions courantes/)
  })

  it('every P.key the page’s files read exists in the section (a missing key would show « undefined »)', () => {
    const dir = join(ROOT, 'src', 'plan2d')
    const used = new Set<string>()
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) for (const m of readFileSync(join(dir, f), 'utf8').matchAll(/\bP\(\)\.(\w+)/g)) used.add(m[1]!)
    const wiringPath = join(ROOT, 'src', 'creation', 'plan2dWiring.ts')
    if (existsSync(wiringPath)) for (const m of readFileSync(wiringPath, 'utf8').matchAll(/\bP\(\)\.(\w+)/g)) used.add(m[1]!)
    for (const k of used) expect(P()[k], k).toBeDefined()
  })
})
