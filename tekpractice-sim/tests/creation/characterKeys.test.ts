/**
 * WCAG 2.1.4 (Character Key Shortcuts) guard: with no remapping UI yet, every
 * action bound to a plain single-character key that has a handler in Mode
 * Création must act only while the 3D canvas has focus (`CANVAS_ONLY`).
 * Scans the shell sources for `onAction('<ACTION>'` registrations.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CREATION_ACTIONS, DEFAULT_CREATION_BINDINGS } from '../../src/creation/input/creationActions'
import { CANVAS_ONLY, isPlainCharacterChord } from '../../src/creation/input/keyboard'

const root = fileURLToPath(new URL('../../src/creation', import.meta.url))
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : []
  })
const handled = new Set<string>()
for (const f of files(root)) for (const m of readFileSync(f, 'utf8').matchAll(/onAction\(\s*'([A-Z_0-9]+)'/g)) handled.add(m[1])

describe('character-key shortcuts act only on the canvas (WCAG 2.1.4)', () => {
  it('recognises plain character chords, not modified ones nor named keys', () => {
    for (const c of ['KeyF', 'KeyH', 'Digit1', 'BracketLeft', 'BracketRight', 'Comma', 'key:f']) expect(isPlainCharacterChord(c), c).toBe(true)
    for (const c of ['Ctrl+key:z', 'Shift+KeyV', 'Alt+KeyH', 'Delete', 'Escape', 'Space', 'Enter', 'ArrowLeft']) expect(isPlainCharacterChord(c), c).toBe(false)
  })
  it('the scan sees the shell handlers', () => {
    expect(handled.has('UNDO')).toBe(true)
    expect(handled.has('NEXT_DEVICE')).toBe(true)
  })
  it('every handled action with a plain character key is in CANVAS_ONLY', () => {
    for (const a of CREATION_ACTIONS) {
      if (!handled.has(a)) continue
      if (DEFAULT_CREATION_BINDINGS[a].some(isPlainCharacterChord)) expect(CANVAS_ONLY.has(a), a).toBe(true)
    }
  })
})
