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
export const CHROME_CLASS = /^(?:\.cr-(?:skip|brand|menu|submenu|status|checklist-chip|cancel-pose|cube-tool)[\w-]*|#site-link)/
/** A surface a design package restyles (packages.css): a chrome class under one of these is a REUSE, and wears the role tokens (T4 fix round, S4). */
export const SURFACE_CLASS = /\.cr-(?:tree|props|drawer|pick|dialog|errlist|checklist|notes)(?![\w-])/

/** The last compound of a complex selector (after the last space or combinator). */
export function lastCompound(selector: string): string {
  return selector.trim().split(/\s*[>+~]\s*|\s+/).pop() ?? ''
}

/** Whether every selector of a rule's list is fixed chrome: its last compound starts with a chrome class and no surface class is named anywhere in it. */
export function isChromeSelector(selectorList: string): boolean {
  return selectorList.split(',').every((sel) => CHROME_CLASS.test(lastCompound(sel)) && !SURFACE_CLASS.test(sel))
}

/** Legitimate literals of the brand Ambre outside the chrome, each with its reason (S4). Anything else naming #DD9349 or rgba(221, 147, 73, ..) is a hit. */
export const LITERAL_EXCEPTIONS: Readonly<Record<string, string>> = {
  '.cr-pick-key--operator::before': "a legend swatch for the room plan's regie zone, which the plan draws in this Ambre tint; its border is the select role, and the swatch carries no text",
}

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

const AMBRE_LITERAL = /#DD9349|rgba?\(\s*221\s*,\s*147\s*,\s*73/i

/** The rules that name Ambre directly (the token or a literal) and are not fixed chrome or a listed exception. */
export function directAmbreOutsideChrome(css: string): Rule[] {
  return rulesOf(css).filter((r) => (/var\(--cr-ambre\)/.test(r.body) || (AMBRE_LITERAL.test(r.body) && !(r.selector in LITERAL_EXCEPTIONS))) && !isChromeSelector(r.selector))
}

const PACKAGES_CSS = join(SHELL, '..', '..', 'design', 'packages.css')
const files = readdirSync(SHELL).filter((f) => f.endsWith('.css'))
const cssOf = (f: string): string => readFileSync(f === 'packages.css' ? PACKAGES_CSS : join(SHELL, f), 'utf8')

describe('Ambre is a role, not a literal, outside the fixed chrome', () => {
  it('the scan reads every shell stylesheet', () => {
    expect(files).toEqual(expect.arrayContaining(['creation.css', 'inventoryDrawer.css', 'listen.css', 'coverage.css', 'connectDialog.css', 'portLabel.css', 'toast.css']))
  })

  for (const f of [...files, 'packages.css']) {
    it(`${f}: no rule names Ambre (the token or a literal) outside the chrome allow-list`, () => {
      const hits = directAmbreOutsideChrome(cssOf(f)).map((r) => `${r.selector} { ${r.body.trim()} }`)
      expect(hits).toEqual([])
    })
  }

  it('the scan bites: a crafted rule in a side panel is flagged, the same rule on the menubar is not', () => {
    expect(directAmbreOutsideChrome('.cr-props .x:hover { color: var(--cr-ambre); }')).toHaveLength(1)
    expect(directAmbreOutsideChrome('@media (hover: hover) { .cr-collapse:hover { border-color: var(--cr-ambre); } }')).toHaveLength(1)
    expect(directAmbreOutsideChrome('.cr-menu-item:hover { color: var(--cr-ambre); }')).toHaveLength(0)
    expect(directAmbreOutsideChrome('.cr-props .x { color: var(--cr-accent-text); }')).toHaveLength(0)
  })

  it('S4: the scan reads the LAST compound and refuses a chrome class reused under a surface (the defect the browser audit found: `.cr-checklist .cr-status-action`)', () => {
    expect(directAmbreOutsideChrome('.cr-checklist .cr-status-action { border-color: var(--cr-ambre); }')).toHaveLength(1)
    expect(directAmbreOutsideChrome('.cr-props .cr-menu-item:hover { color: var(--cr-ambre); }')).toHaveLength(1)
    expect(directAmbreOutsideChrome('.cr-menu-panel .cr-card { color: var(--cr-ambre); }')).toHaveLength(1) // chrome-looking ancestor, a non-chrome leaf
    expect(directAmbreOutsideChrome('.cr .cr-status-action { border: 1px solid var(--cr-ambre); }')).toHaveLength(0)
    expect(directAmbreOutsideChrome(".cr-menu-top[aria-expanded='true'] { border-bottom-color: var(--cr-ambre); }")).toHaveLength(0)
    expect(directAmbreOutsideChrome('.cr-checklist-chip:hover { background: var(--cr-ambre); }')).toHaveLength(0) // the chip lives in the status bar; `.cr-checklist-chip` is not `.cr-checklist`
  })

  it('S4: a literal Ambre is a hit too (#DD9349, rgba(221, 147, 73, ..)), except the listed legend swatch', () => {
    expect(directAmbreOutsideChrome('.cr-card-badge { color: #dd9349; }')).toHaveLength(1)
    expect(directAmbreOutsideChrome('.cr-card-badge { background: rgba(221,147,73,.3); }')).toHaveLength(1)
    expect(directAmbreOutsideChrome('.cr-menu-top { color: #DD9349; }')).toHaveLength(0)
    for (const [sel, reason] of Object.entries(LITERAL_EXCEPTIONS)) {
      expect(reason.length, sel).toBeGreaterThan(30)
      expect(directAmbreOutsideChrome(`${sel} { background: rgba(221, 147, 73, 0.3); }`)).toHaveLength(0)
    }
    // the exception really exists in the source (a stale entry is dead weight)
    const all = files.flatMap((f) => rulesOf(cssOf(f)))
    for (const sel of Object.keys(LITERAL_EXCEPTIONS)) expect(all.some((r) => r.selector === sel && AMBRE_LITERAL.test(r.body)), sel).toBe(true)
  })

  it('the chrome allow-list stays small: only rules of the menubar, the status bar, the skip link and the 3D view overlays use Ambre directly', () => {
    const all = files.flatMap((f) => rulesOf(readFileSync(join(SHELL, f), 'utf8'))).filter((r) => /var\(--cr-ambre\)/.test(r.body))
    expect(all.length).toBeGreaterThan(0)
    expect(all.length).toBeLessThanOrEqual(24)
    for (const r of all) expect(isChromeSelector(r.selector), r.selector).toBe(true)
  })

  it('a chrome class reused inside a surface is re-pointed there (the checklist pop-over buttons wear .cr-status-action: Ambre on Papier was found by the browser audit)', () => {
    const rules = rulesOf(readFileSync(join(SHELL, 'creation.css'), 'utf8'))
    expect(rules.some((r) => r.selector === '.cr-checklist .cr-status-action' && /border-color:\s*var\(--cr-select\)/.test(r.body))).toBe(true)
    expect(rules.some((r) => r.selector === '.cr-checklist .cr-status-action:hover' && /background:\s*var\(--cr-accent\)/.test(r.body))).toBe(true)
  })

  it('the role tokens used by the shell are all defined by the plain map (a typo would silently fall back to nothing)', () => {
    const defined = new Set(['--cr-focus', '--cr-select', '--cr-accent', '--cr-accent-ink', '--cr-accent-edge', '--cr-accent-text', '--cr-band', '--cr-band-ink'])
    for (const f of files) {
      const css = readFileSync(join(SHELL, f), 'utf8')
      for (const m of css.matchAll(/var\((--cr-(?:focus|select|accent[a-z-]*|band[a-z-]*))\)/g)) expect(defined.has(m[1]), `${f}: ${m[1]}`).toBe(true)
    }
  })
})

describe('T4 fix round, C1: no fill is painted with the hairline colour', () => {
  it('no shell rule uses --cr-panel-line as a background (it is `line`: 1.97 : 1 under Papier ink in packages 4 and 5); the connect dialog options use --cr-wash', () => {
    const hits = files.flatMap((f) => rulesOf(readFileSync(join(SHELL, f), 'utf8')).filter((r) => /background(-color)?:[^;]*var\(--cr-panel-line\)/.test(r.body.replace('var(--cr-wash, var(--cr-panel-line))', ''))).map((r) => `${f}: ${r.selector}`))
    expect(hits).toEqual([])
    const connect = readFileSync(join(SHELL, 'connectDialog.css'), 'utf8')
    expect(connect).toMatch(/\.cr-connect-opt\[aria-selected='true'\][^}]*background: var\(--cr-wash/)
    expect(readFileSync(join(SHELL, '..', '..', 'design', 'packages.css'), 'utf8')).toMatch(/--cr-wash: var\(--cr-role-inset\)/)
  })
})
