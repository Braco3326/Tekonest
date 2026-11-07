/**
 * Night 2 wave 4, item 4: `content: '▶' / ''` (a glyph with an alternative text) is dropped whole by Safari < 17.4 and Firefox < 128, which then show no glyph at all.
 * An engine ignores a declaration it cannot parse and keeps the one before it, so each alt-text declaration is preceded by the plain one with the same glyph:
 * `content: '▶'; content: '▶' / '';`. Modern engines use the last one (the glyph is decoration, the button's word is its name); old ones draw the glyph.
 * The scan reads the CSS source of the Mode Création chrome.
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

/** Every `content: X / Y` that does not have `content: X;` right before it in the same rule. */
function unguarded(css: string): string[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: string[] = []
  for (const m of src.matchAll(/content:\s*([^;{}/]+?)\s*\/\s*([^;{}]+?)\s*(?=[;}])/g)) {
    const before = src.slice(0, m.index!)
    const rule = before.slice(Math.max(before.lastIndexOf('{'), before.lastIndexOf('}')) + 1)
    const plain = rule.replace(/\s+/g, ' ').trimEnd().endsWith(`content: ${m[1].trim()};`)
    if (!plain) out.push(m[0])
  }
  return out
}

describe('glyphs drawn by CSS with an alternative text (wave 4, item 4)', () => {
  it('the scanner flags a lone alt-text declaration and accepts a guarded one', () => {
    expect(unguarded(".a::before { content: '▶' / ''; }")).toEqual(["content: '▶' / ''"])
    expect(unguarded(".a::before { content: '▶'; content: '▶' / ''; }")).toEqual([])
    expect(unguarded(".a::before { content: '▶'; content: '■' / ''; }")).toEqual(["content: '■' / ''"])
    expect(unguarded(".a::before { content: '▶'; } .b::before { content: '▶' / ''; }")).toEqual(["content: '▶' / ''"])
  })

  it('every alt-text content in the Mode Création CSS has its plain fallback before it', () => {
    const all = cssFiles(root)
    const bad = all.flatMap((f) => unguarded(readFileSync(f, 'utf8')).map((d) => `${f.slice(root.length + 1)}: ${d}`))
    expect(bad).toEqual([])
  })

  it('the play and stop glyphs are there, in the right order (plain first, alternative last)', () => {
    const css = readFileSync(join(root, 'shell', 'listen.css'), 'utf8')
    expect(css).toContain("content: '▶'; content: '▶' / '';")
    expect(css).toContain("content: '■'; content: '■' / '';")
  })
})
