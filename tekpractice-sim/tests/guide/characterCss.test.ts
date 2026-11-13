// The new Oscar's motion sheet, read as text (plan T5.2, spec 10.2 timing table): every animation in src/guide/character.css is finite and the
// durations, counts and easings are the table's. The browser half (nothing runs 6 s later, reduced motion, 24 px) is tests/e2e/character.spec.ts.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(join(__dirname, '..', '..', 'src', 'guide', 'character.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** Every `animation:` shorthand with the selector it sits under. */
function animations(css: string): { selector: string; value: string }[] {
  const out: { selector: string; value: string }[] = []
  const rule = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = rule.exec(css)) !== null) {
    const selector = m[1].trim().replace(/\s+/g, ' ')
    for (const d of m[2].split(';')) {
      const [k, ...v] = d.split(':')
      if (k !== undefined && k.trim() === 'animation') out.push({ selector, value: v.join(':').trim() })
    }
  }
  return out
}

const named = (list: { selector: string; value: string }[]) => list.filter((a) => a.value !== 'none' && !a.value.startsWith('none '))

describe('character.css: every animation finite, the timing table', () => {
  const list = animations(CSS)

  it('finds the animations (a real list) and none is infinite', () => {
    expect(named(list).length).toBeGreaterThanOrEqual(9)
    expect(CSS).not.toMatch(/infinite/)
    expect(CSS).not.toMatch(/animation-iteration-count/)
  })

  it('every named animation carries an explicit finite iteration count', () => {
    for (const a of named(list)) {
      const count = a.value.split(/\s+(?![^(]*\))/).find((t) => /^\d+(\.\d+)?$/.test(t))
      expect(count, `${a.selector}: ${a.value}`).toBeDefined()
      expect(Number(count)).toBeGreaterThan(0)
      expect(Number(count)).toBeLessThanOrEqual(4)
    }
  })

  const TABLE: [string, RegExp][] = [
    ["[data-state='idle'] .tpo-head", /^tpo-breathe 4000ms ease-in-out 1$/],
    ["[data-state='idle'] .tpo-eyes", /^tpo-blink 4000ms ease-in-out 1$/],
    ["[data-state='walk'] .tpo-body", /^tpo-bob 550ms ease-in-out 2$/],
    ['.oscar-guide.tp-oscar-host .oscar-ring', /^tpo-ring 600ms ease-out 3$/],
    ["[data-state='think'] .tpo-dot", /^tpo-dot 1200ms linear 4 backwards$/],
    ["[data-state='celebrate'] .tpo-cups", /^tpo-cheer 1000ms cubic-bezier\(0\.3, 1\.4, 0\.5, 1\) 1$/],
    ["[data-state='shrug'] .tpo-tilt", /^tpo-shrug-tilt 700ms ease-out 1$/],
    ["[data-state='shrug'] .tpo-arm-pose", /^tpo-shrug-arm 700ms ease-out 1$/],
    ["[data-state='nod'] .tpo-tilt", /^tpo-nod 600ms ease-in-out 1$/],
    ["[data-state='wave'] .tpo-arm-pose", /^tpo-wave 1200ms ease-in-out 1$/],
  ]
  for (const [selector, want] of TABLE)
    it(`${selector}: ${want.source}`, () => {
      const hits = named(list).filter((a) => a.selector.endsWith(selector))
      expect(hits, selector).toHaveLength(1)
      expect(hits[0].value).toMatch(want)
    })

  it('sleep has no animation of its own (static)', () => {
    expect(named(list).filter((a) => a.selector.includes("'sleep'"))).toEqual([])
  })

  it('the vendored loops are stopped under the host class, without !important (the vendored reduced-motion rules keep the last word)', () => {
    const stop = list.find((a) => a.selector.includes('.oscar-guide.tp-oscar-host .oscar-mascot'))
    expect(stop?.value).toBe('none')
  })

  it('reduced motion (media query and the vendored .oscar-reduced root): no animation, no transition', () => {
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.tpo \*[^}]*\{\s*animation: none !important;\s*transition: none !important;/)
    expect(CSS).toMatch(/\.oscar-reduced \.tpo \*\s*\{\s*animation: none !important;\s*transition: none !important;/)
  })

  it('transitions are short (<= 220 ms) and every one is on the character', () => {
    const ms = [...CSS.matchAll(/transition:([^;]+);/g)].flatMap((m) => [...m[1].matchAll(/(\d+)ms/g)].map((x) => Number(x[1])))
    expect(ms.length).toBeGreaterThan(0)
    for (const v of ms) expect(v).toBeLessThanOrEqual(220)
  })
})
