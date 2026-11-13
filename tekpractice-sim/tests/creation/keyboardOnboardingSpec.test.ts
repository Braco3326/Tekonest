import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Onboarding packs T7.1c (spec 11.6): the keyboard-only e2e proves a learner reaches a first sound in each package with keys alone. It only proves that if it cannot cheat: no pointer call,
 * and no shortcut around the keyboard (programmatic focus, a field filled directly, an intent dispatched from the page, a place chosen from the page). The spec holds the route between two
 * markers (the rest of the file is the runtime honesty scan, which may click); this reads the text between them. Same idea as keyboardPatchSpec.test.ts (CA-02).
 */
const text = readFileSync(fileURLToPath(new URL('../e2e/onboarding-keyboard.spec.ts', import.meta.url)), 'utf8')
const begin = text.indexOf('11.6 KEYBOARD ONLY: BEGIN')
const end = text.indexOf('11.6 KEYBOARD ONLY: END')
const route = begin >= 0 && end > begin ? text.slice(begin, end) : ''
// the markers' own comment line names what the checker forbids: the route proper starts after it
const body = route.slice(route.indexOf('\n'))

describe('onboarding-keyboard.spec.ts: the route is keyboard only', () => {
  it('has its two markers, in order, around a real route', () => {
    expect(begin).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(begin)
    expect(body.length).toBeGreaterThan(3000)
  })

  it('drives the keyboard: Tab, Enter, Espace, the arrows, `]`, typed filters', () => {
    expect(body).toContain("'Shift+Tab' : 'Tab'")
    expect(body).toContain("page.keyboard.press('Enter')")
    expect(body).toContain("page.keyboard.press('Space')")
    expect(body).toContain("page.keyboard.press('ArrowRight')")
    expect(body).toContain("page.keyboard.press(']')")
    expect(body).toContain('page.keyboard.type(')
  })

  it('has no pointer call: no `mouse` and no click of any kind (the pointer COUNTER in the page is the other half of the proof)', () => {
    expect(body).not.toMatch(/\.mouse\b/)
    expect(body).not.toMatch(/\.(click|dblclick|tap|hover|dragTo)\(/)
    expect(body).not.toMatch(/\bclick\(/i)
  })

  it('has no shortcut around the keys: no programmatic focus, no direct fill / check, no dispatch, no place chosen from the page', () => {
    expect(body).not.toMatch(/\.(focus|fill|check|selectOption|press\w*Sequentially)\(/)
    expect(body).not.toMatch(/\.dispatch\(/)
    expect(body).not.toMatch(/choosePlace|requestPlace|dispatchEvent|\.setValue\(|setControlValue|frameDevice/)
    expect(body).not.toMatch(/\bact\(|\bconnect\(|\bspawn\(/) // the kit's dispatching helpers are not imported by the route
  })

  it('asserts the real outcome: the engine plays the test signal on a speaker, and no pointer event reached the page', () => {
    expect(body).toContain("source === 'test'")
    expect(body).toContain('voices')
    expect(body).toContain('__pointerEvents')
    expect(body).toMatch(/pointerEvents\(page\)[^)]*\)\.toBe\(0\)/)
  })
})

describe('the checker can fail: crafted routes', () => {
  const cheats = [
    'await page.getByRole("button").click()',
    'await page.mouse.click(10, 10)',
    'await page.locator("#renderCanvas").focus()',
    'await page.getByRole("textbox").fill("QL1")',
    'await page.evaluate(() => window.__creation!.dispatch({}))',
    "await page.evaluate(() => window.__creation!.choosePlace('blank'))",
  ]
  it.each(cheats)('trips on %s', (line) => {
    const hit = /\.mouse\b|\.(click|dblclick|tap|hover|dragTo|focus|fill|check|selectOption)\(|\.dispatch\(|choosePlace/.test(line)
    expect(hit).toBe(true)
  })
})
