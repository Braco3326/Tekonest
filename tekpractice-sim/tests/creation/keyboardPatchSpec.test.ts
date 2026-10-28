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

  it('asserts the real count: the template\'s mic cable plus the two new signal cables = 3', () => {
    expect(spec).toContain('toHaveLength(3)')
    expect(spec).toContain("instance: 'sm58', port: 'out-xlr'")
  })
})
