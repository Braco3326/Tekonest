import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../../src/creation', import.meta.url))
const TRAP = /['"]Tab['"][\s\S]{0,200}preventDefault|preventDefault[\s\S]{0,200}['"]Tab['"]/

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : /\.ts$/.test(n) ? [p] : []
  })
}

describe('Mode Création never intercepts Tab (C10, CA-01)', () => {
  it('no file under src/creation/ calls preventDefault near a Tab check', () => {
    const all = files(root)
    expect(all.length).toBeGreaterThan(5)
    const traps = all.filter((f) => TRAP.test(readFileSync(f, 'utf8')))
    expect(traps).toEqual([])
  })
  it('the keyboard model exists (the test scans it)', () => {
    expect(all().some((f) => f.endsWith(join('input', 'keyboard.ts')))).toBe(true)
  })
})

function all(): string[] {
  return files(root)
}
