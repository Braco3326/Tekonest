/**
 * Task 39: src/audio/listenerMix.ts is a PURE layer (geometry in, numbers out). It runs anywhere (it is unit-tested in Node, no DOM, no Web Audio) and
 * imports nothing at all: the directivity toward the listener (src/acoustics/field.ts `directivityDb`) is computed by its caller and handed in as `dirDb`,
 * never re-implemented here. Modelled on tests/acoustics/layering.test.ts, with the same « the guard bites » fixture approach.
 * The Web Audio side (engine.ts) and the test signal's renderer take their browser classes by injection and are the only audio files that may name them.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { levelDb } from '../../src/acoustics/field'
import { MIN_DISTANCE_M } from '../../src/audio/listenerMix'

const root = resolve(__dirname, '../../src')
const file = resolve(root, 'audio/listenerMix.ts')

/** Specifiers of value imports, value re-exports, side-effect imports, dynamic import() and require(); `import type` is left out. */
function valueSpecifiers(src: string): string[] {
  return [
    ...src.matchAll(/^\s*(?:import|export)\s+(?!type\b)[\w\s{},*$]*?\bfrom\s+['"]([^'"]+)['"]/gm),
    ...src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm),
    ...src.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g),
    ...src.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]/g),
  ].map((m) => m[1])
}
const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** Names the pure mix must never mention (browser, Web Audio, Babylon, the store and the shell). */
const FORBIDDEN: RegExp[] = [
  /@babylonjs/,
  /\bdocument\b/,
  /\bwindow\b/,
  /\bnavigator\b/,
  /\bself\b/,
  /\bAudioContext\b/,
  /\bOfflineAudioContext\b/,
  /\bAudioNode\b/,
  /\bGainNode\b/,
  /\bperformance\b/,
  /creation\/store/,
  /ConnectionGraph/,
  /\bCOPY\b/,
]
const violations = (code: string): string[] => FORBIDDEN.filter((re) => re.test(stripComments(code))).map(String)

describe('src/audio/listenerMix.ts is pure', () => {
  it('exists, and imports nothing: no module, no package', () => {
    expect(existsSync(file)).toBe(true)
    expect(valueSpecifiers(readFileSync(file, 'utf8'))).toEqual([])
    expect(readFileSync(file, 'utf8')).not.toMatch(/^\s*import\b/m) // not even a type import: the contract is the numbers
  })
  it('names no browser, Web Audio, Babylon, store or shell global', () => {
    expect(violations(readFileSync(file, 'utf8'))).toEqual([])
  })
  it('depends on neither the clock nor randomness (a pure function of its input)', () => {
    expect(stripComments(readFileSync(file, 'utf8'))).not.toMatch(/\bDate\b|Math\.random|performance\.now/)
  })
  it('its 0.5 m distance floor is the one of the field model (levelDb): below it the level stops growing, in both', () => {
    expect(MIN_DISTANCE_M).toBe(0.5)
    const src = { id: 's', pose: { position: [0, 0, 0] as [number, number, number], yawDeg: 0, tiltDeg: 0 }, hDeg: 90, vDeg: 60, lRefDb: 0 }
    const at = (z: number): number => levelDb(src, [0, 0, z])
    expect(at(0.5)).toBeCloseTo(at(0.1), 12) // flat below the floor
    expect(at(1) - at(0.5)).toBeCloseTo(-20 * Math.log10(1 / MIN_DISTANCE_M), 12) // the 1/r law starts at the same 0.5 m
  })
})

describe('src/audio/balance.ts is pure too (shared by the sound and the coverage)', () => {
  const balance = resolve(root, 'audio/balance.ts')
  it('exists, imports nothing, names no browser / Web Audio / Babylon / store / shell global, no clock or randomness', () => {
    expect(existsSync(balance)).toBe(true)
    const src = readFileSync(balance, 'utf8')
    expect(valueSpecifiers(src)).toEqual([])
    expect(src).not.toMatch(/^\s*import\b/m)
    expect(violations(src)).toEqual([])
    expect(stripComments(src)).not.toMatch(/Date|Math.random|performance.now/)
  })
})

describe('the guard bites (on a fixture made for the test, independent of src)', () => {
  const tmp = mkdtempSync(resolve(tmpdir(), 'audio-guard-'))
  afterAll(() => rmSync(tmp, { recursive: true, force: true }))
  const write = (name: string, body: string): string => {
    const f = resolve(tmp, name)
    mkdirSync(dirname(f), { recursive: true })
    writeFileSync(f, body)
    return f
  }
  it('sees an import, a Web Audio class, a DOM global and Babylon in a would-be pure file', () => {
    const f = write('mix.ts', "import { x } from '../outside/x'\nconst c = new AudioContext()\nconst d = document.body\nexport const m = () => import('@babylonjs/core')\n")
    const src = readFileSync(f, 'utf8')
    expect(valueSpecifiers(src).sort()).toEqual(['../outside/x', '@babylonjs/core'])
    expect(violations(src).length).toBeGreaterThanOrEqual(3)
  })
  it('lets a clean file and a word in a comment through', () => {
    const f = write('clean.ts', '// an AudioContext lives elsewhere, and the window too\nexport const gain = (r: number): number => 1 / r\n')
    const src = readFileSync(f, 'utf8')
    expect(valueSpecifiers(src)).toEqual([])
    expect(violations(src)).toEqual([])
  })
})
