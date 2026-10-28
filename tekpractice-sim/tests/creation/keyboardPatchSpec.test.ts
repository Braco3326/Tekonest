import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Task 28 (CA-02, P0): the keyboard-only e2e proves the whole reference rig can be cabled with keys alone. It only proves that
 * if it cannot cheat: no pointer call, and no shortcut around the keyboard (programmatic focus, a field filled directly, an
 * intent dispatched from the page, a place chosen from the page). This reads the spec's text.
 */
const spec = readFileSync(fileURLToPath(new URL('../e2e/creation-keyboard-patch.spec.ts', import.meta.url)), 'utf8')

describe('creation-keyboard-patch.spec.ts is keyboard only', () => {
  it('exists and drives the keyboard', () => {
    expect(spec).toContain('page.keyboard.press(')
    expect(spec).toContain('page.keyboard.type(')
    expect(spec).toContain("'Tab'")
  })

  it('has no pointer call: no `mouse` and no click of any kind', () => {
    expect(spec).not.toMatch(/mouse/i)
    expect(spec).not.toMatch(/\.(click|dblclick|tap|hover|dragTo)\(/)
    expect(spec).not.toMatch(/\bclick\b/i)
  })

  it('has no shortcut around the keys: no programmatic focus, no direct fill / check, no dispatch or place choice from the page', () => {
    expect(spec).not.toMatch(/\.(focus|fill|check|selectOption|press\w*Sequentially)\(/)
    expect(spec).not.toMatch(/\.dispatch\(/)
    expect(spec).not.toMatch(/choosePlace|requestPlace|dispatchEvent/)
  })

  it('asserts the real counts: the template\'s 4 (mic + 3 power), 5 and 6 after the signal cables, 3 after Suppr on its strip, 6 once the new strip is cabled (Task 32)', () => {
    expect(spec).toContain("instance: 'sm58', port: 'out-xlr'")
    const counts = [...spec.matchAll(/connections\)\.toHaveLength\((\d+)\)/g)].map((m) => Number(m[1]))
    expect(counts).toEqual([4, 5, 6, 3, 6])
  })

  it('powers the rig by keys: Suppr on the template strip, Espace, type, Entrée twice, then « Connecter à… » out-1..3 to the three power-in', () => {
    expect(spec).toContain("press('Delete')")
    expect(spec).toContain("press('Space')")
    expect(spec).toContain("type('multiprise')")
    expect(spec.match(/press\('Enter'\)/g)!.length).toBeGreaterThanOrEqual(8)
    expect(spec).toContain("['out-1', 'ql1'], ['out-2', 'k12-g'], ['out-3', 'k12-d']")
    expect(spec).toContain('power-in')
  })
})
