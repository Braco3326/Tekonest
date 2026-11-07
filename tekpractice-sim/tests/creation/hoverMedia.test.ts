/**
 * Night 2 wave 4, item 3: a `:hover` style sticks after a tap on a touch screen (the browser keeps the last tapped element « hovered »). Every hover rule of the Mode Création
 * chrome therefore lives inside `@media (hover: hover)`; the focus-visible, focus, active and `[aria-expanded]` states are NOT hover and stay outside.
 * The scan reads the CSS source (comments removed), tracks the at-rules a rule is nested in, and lists each rule with `:hover` in its selector that is not inside such a media block.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../../src/creation', import.meta.url))
const cssFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? cssFiles(p) : /\.css$/.test(n) ? [p] : []
  })

/** The selectors (rule preludes) that contain `:hover` and are not nested in `@media (hover: hover)`. */
function bareHoverRules(css: string): string[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const stack: string[] = []
  const bare: string[] = []
  let prelude = ''
  for (const ch of src) {
    if (ch === '{') {
      const p = prelude.trim().replace(/\s+/g, ' ')
      stack.push(p)
      if (!p.startsWith('@') && p.includes(':hover') && !stack.some((s) => /^@media[^{]*\(hover:\s*hover\)/.test(s))) bare.push(p)
      prelude = ''
    } else if (ch === '}') {
      stack.pop()
      prelude = ''
    } else if (ch === ';') {
      prelude = ''
    } else prelude += ch
  }
  return bare
}

describe('hover-only styles (wave 4, item 3)', () => {
  it('the scanner finds a bare hover rule, and accepts one inside (hover: hover), also nested in another media', () => {
    expect(bareHoverRules('.a:hover { color: red; }')).toEqual(['.a:hover'])
    expect(bareHoverRules('.a:hover, .a:focus { color: red; }')).toEqual(['.a:hover, .a:focus'])
    expect(bareHoverRules('@media (hover: hover) { .a:hover { color: red; } }')).toEqual([])
    expect(bareHoverRules('@media (max-width: 760px) { @media (hover: hover) { .a:hover { color: red; } } }')).toEqual([])
    expect(bareHoverRules('@media (pointer: coarse) { .a:hover { color: red; } }')).toEqual(['.a:hover'])
    expect(bareHoverRules('/* .a:hover { } */ .a:focus-visible { color: red; }')).toEqual([])
  })

  it('no CSS file of the Mode Création chrome has a bare :hover rule', () => {
    const all = cssFiles(root)
    expect(all.length).toBeGreaterThan(5)
    const found = all.flatMap((f) => bareHoverRules(readFileSync(f, 'utf8')).map((s) => `${f.slice(root.length + 1)}: ${s}`))
    expect(found).toEqual([])
  })

  it('the rules are still there (the scan is not passing on an emptied file)', () => {
    const css = readFileSync(join(root, 'shell', 'creation.css'), 'utf8')
    expect((css.match(/@media \(hover: hover\)/g) ?? []).length).toBeGreaterThan(20)
    // focus stays outside: the menu item keeps its :focus look for the keyboard
    expect(css).toMatch(/^\.cr-menu-item:focus \{/m)
  })
})
