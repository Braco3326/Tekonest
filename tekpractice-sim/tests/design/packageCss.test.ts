/**
 * T4.2 / T4.4 static scan (spec 7.3, « package 3 trap »): in the shell's stylesheets Ambre is never named directly outside the fixed dark chrome (menubar and its menus, the
 * status bar and its chip, the skip link, the labels over the 3D view). Everywhere else a focus ring, a border, a bar, a fill or an emphasis goes through a ROLE token
 * (`--cr-focus`, `--cr-select`, `--cr-accent*`), which a package re-points (package 3: Nuit, Prune), so no rule can resolve Ambre as text, outline or border on Papier (2.16 : 1).
 * The browser suite measures the colours in use (tests/e2e/onboarding-contrast.spec.ts); this scan keeps the source from growing a new direct use.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SHELL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'creation', 'shell')

/** The fixed dark chrome: it keeps today's Ambre whatever the package (spec 7.3: « menubar and status bar stay Nuit / panel »). */
export const CHROME = /\.cr-skip|\.cr-brand|\.cr-menu|\.cr-submenu|#site-link|\.cr-status|\.cr-checklist-chip|\.cr-cancel-pose|\.cr-cube-tool/

export interface Rule {
  selector: string
  body: string
}

/** The innermost rules of a stylesheet (comments dropped; a rule inside an @media is a rule). */
export function rulesOf(css: string): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: Rule[] = []
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push({ selector: m[1].trim(), body: m[2] })
  return out
}

/** The rules that name Ambre directly and are not fixed chrome. */
export function directAmbreOutsideChrome(css: string): Rule[] {
  return rulesOf(css).filter((r) => /var\(--cr-ambre\)/.test(r.body) && !CHROME.test(r.selector))
}

const files = readdirSync(SHELL).filter((f) => f.endsWith('.css'))

describe('Ambre is a role, not a literal, outside the fixed chrome', () => {
  it('the scan reads every shell stylesheet', () => {
    expect(files).toEqual(expect.arrayContaining(['creation.css', 'inventoryDrawer.css', 'listen.css', 'coverage.css', 'connectDialog.css', 'portLabel.css', 'toast.css']))
  })

  for (const f of files) {
    it(`${f}: no rule names var(--cr-ambre) outside the chrome allow-list`, () => {
      const hits = directAmbreOutsideChrome(readFileSync(join(SHELL, f), 'utf8')).map((r) => `${r.selector} { ${r.body.trim()} }`)
      expect(hits).toEqual([])
    })
  }

  it('the scan bites: a crafted rule in a side panel is flagged, the same rule on the menubar is not', () => {
    expect(directAmbreOutsideChrome('.cr-props .x:hover { color: var(--cr-ambre); }')).toHaveLength(1)
    expect(directAmbreOutsideChrome('@media (hover: hover) { .cr-collapse:hover { border-color: var(--cr-ambre); } }')).toHaveLength(1)
    expect(directAmbreOutsideChrome('.cr-menu-item:hover { color: var(--cr-ambre); }')).toHaveLength(0)
    expect(directAmbreOutsideChrome('.cr-props .x { color: var(--cr-accent-text); }')).toHaveLength(0)
  })

  it('the chrome allow-list stays small: only rules of the menubar, the status bar, the skip link and the 3D view overlays use Ambre directly', () => {
    const all = files.flatMap((f) => rulesOf(readFileSync(join(SHELL, f), 'utf8'))).filter((r) => /var\(--cr-ambre\)/.test(r.body))
    expect(all.length).toBeGreaterThan(0)
    expect(all.length).toBeLessThanOrEqual(24)
    for (const r of all) expect(CHROME.test(r.selector), r.selector).toBe(true)
  })

  it('the role tokens used by the shell are all defined by the plain map (a typo would silently fall back to nothing)', () => {
    const defined = new Set(['--cr-focus', '--cr-select', '--cr-accent', '--cr-accent-ink', '--cr-accent-edge', '--cr-accent-text', '--cr-band', '--cr-band-ink'])
    for (const f of files) {
      const css = readFileSync(join(SHELL, f), 'utf8')
      for (const m of css.matchAll(/var\((--cr-(?:focus|select|accent[a-z-]*|band[a-z-]*))\)/g)) expect(defined.has(m[1]), `${f}: ${m[1]}`).toBe(true)
    }
  })
})
