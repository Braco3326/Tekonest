import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { cheats } from './keyboardCheats'

/**
 * Onboarding packs T7.1c (spec 4.3; the plan's « 11.6 »): the keyboard-only e2e proves a learner reaches a first sound in each package with keys alone. It only proves that if it cannot cheat: no pointer call,
 * and no shortcut around the keyboard (programmatic focus, a field filled directly, text inserted, a value written or an event dispatched from the page, an intent dispatched, a place chosen).
 * The spec holds the route between two markers (the rest of the file is the runtime honesty scan, which may click); this reads the text between them. Same idea as keyboardPatchSpec.test.ts
 * (CA-02). G14e (review S7): the real route and the crafted cheats go through the SAME checker, `cheats()` (keyboardCheats.ts).
 */
const text = readFileSync(fileURLToPath(new URL('../e2e/onboarding-keyboard.spec.ts', import.meta.url)), 'utf8')
const begin = text.indexOf('T7.1c KEYBOARD ONLY: BEGIN')
const end = text.indexOf('T7.1c KEYBOARD ONLY: END')
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

  it('has no cheat: no pointer call, no programmatic focus, fill, inserted text, written value, dispatched event or intent, no kit helper that clicks or dispatches', () => {
    expect(cheats(body)).toEqual([])
  })

  it('asserts the real outcome: the engine plays the test signal on a speaker, and no pointer event reached the page', () => {
    expect(body).toContain("source === 'test'")
    expect(body).toContain('voices')
    expect(body).toContain('__pointerEvents')
    expect(body).toMatch(/pointerEvents\(page\)[^)]*\)\.toBe\(0\)/)
  })
})

describe('the checker can fail: crafted routes through the same cheats()', () => {
  const crafted = [
    'await page.getByRole("button").click()',
    'await page.mouse.click(10, 10)',
    'await page.locator("#renderCanvas").focus()',
    'await page.getByRole("textbox").fill("QL1")',
    'await page.keyboard.insertText("QL1")',
    'await page.evaluate(() => { (document.querySelector("#cr-inv-filter") as HTMLInputElement).value = "QL1" })',
    'await page.evaluate(() => document.querySelector("#x")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })))',
    'await page.evaluate(() => window.__creation!.dispatch({}))',
    "await page.evaluate(() => window.__creation!.choosePlace('blank'))",
    'await act(page, [spawn("yamaha-ql1", "ql1", 0)])',
    'await testSignal(page)',
    'await page.locator("input").pressSequentially("QL1")',
  ]
  it.each(crafted)('trips on %s', (line) => {
    expect(cheats(`\n${line}\n`).length).toBeGreaterThan(0)
  })
  const nearMisses = [
    "await page.keyboard.press('Enter')",
    "await page.keyboard.type('QL1')",
    'await testSignalByKeys(page)',
    'await connectByKeys(page, "yamaha-ql1", "out-main-l", "in-line-a")',
    "await expect(page.getByTestId('props-collapse')).toHaveAttribute('aria-expanded', 'true')",
    'const v = el.value === "x"',
    '// a comment that says click( is not a call',
  ]
  it.each(nearMisses)('passes %s', (line) => {
    expect(cheats(`\n${line}\n`)).toEqual([])
  })
  it('the real route with one cheat added trips', () => {
    expect(cheats(`${body}\nawait page.keyboard.insertText('K12')`)).toEqual(["text inserted without key events: await page.keyboard.insertText('K12')"])
  })
})
