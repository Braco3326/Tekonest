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
export const SURFACE_CLASS = /\.cr-(?:tree|props|drawer|pick|dialog|errlist|checklist(?!-chip)|notes|connect|cov|legend|listen|views)[\w-]*/

/** The last compound of a complex selector (after the last space or combinator). */
export function lastCompound(selector: string): string {
  // split at a space or a combinator only OUTSIDE (...) and [...] (so :is(.a, .b > .c) and [title='a > b'] stay whole)
  let depth = 0
  let start = 0
  let last = ''
  const flush = (end: number): void => {
    const part = selector.slice(start, end).trim()
    if (part !== '' && !/^[>+~]$/.test(part)) last = part
  }
  for (let k = 0; k < selector.length; k++) {
    const ch = selector[k]
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    else if (depth === 0 && (/\s/.test(ch) || ch === '>' || ch === '+' || ch === '~')) {
      flush(k)
      start = k + 1
    }
  }
  flush(selector.length)
  return last
}

/** The selectors of a list, split at commas outside (...) and [...]. */
export function splitList(list: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let k = 0; k < list.length; k++) {
    const ch = list[k]
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    else if (ch === ',' && depth === 0) {
      out.push(list.slice(start, k))
      start = k + 1
    }
  }
  out.push(list.slice(start))
  return out
}

/** Whether every selector of a rule's list is fixed chrome: its last compound starts with a chrome class and no surface class is named anywhere in it. */
export function isChromeSelector(selectorList: string): boolean {
  return splitList(selectorList).every((sel) => CHROME_CLASS.test(lastCompound(sel)) && !SURFACE_CLASS.test(sel))
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

const AMBRE_LITERAL = /#DD9349|rgba?\(\s*221[\s,]+147[\s,]+73(?!\d)/i

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

  it('round 2: child-class surfaces count as surfaces, and the last compound survives :is(...) and attribute values with spaces or combinators', () => {
    expect(directAmbreOutsideChrome('.cr-props-section .cr-status-action { border-color: var(--cr-ambre); }')).toHaveLength(1)
    expect(directAmbreOutsideChrome('.cr-connect .cr-status-action { border-color: var(--cr-ambre); }')).toHaveLength(1)
    expect(directAmbreOutsideChrome('.cr-cov-body > .cr-menu-item { color: var(--cr-ambre); }')).toHaveLength(1)
    expect(lastCompound(".cr-menu-item[data-x='a b'] .cr-menu-top:is(.a, .b > .c)")).toBe('.cr-menu-top:is(.a, .b > .c)')
    expect(lastCompound(".cr-x:is(.cr-menu-item, .cr-menu-top) > .cr-card[title='a > b']")).toBe(".cr-card[title='a > b']")
    expect(directAmbreOutsideChrome(".cr-menu-panel [title='a b'] { color: var(--cr-ambre); }")).toHaveLength(1) // an attribute value with a space is not a combinator: the leaf is `[title='a b']`
    expect(directAmbreOutsideChrome('.cr-checklist-chip:hover { background: var(--cr-ambre); }')).toHaveLength(0) // still the status bar's chip, not the pop-over
  })

  it('round 2: the literal forms of Ambre are hits too: rgb(221 147 73), rgba(221 147 73 / .3), rgba(221,147,73,.3), #dd9349', () => {
    for (const lit of ['rgb(221 147 73)', 'rgba(221 147 73 / .3)', 'rgba(221, 147, 73, 0.3)', 'rgb( 221,147,73 )', '#dd9349']) expect(directAmbreOutsideChrome(`.cr-card-badge { color: ${lit}; }`), lit).toHaveLength(1)
    expect(directAmbreOutsideChrome('.cr-card-badge { color: rgb(221 147 74); }')).toHaveLength(0)
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

describe('T4 fix rounds 1 and 2, C1: a fill is never painted with a colour that carries no declared ink pair', () => {
  /** `line` (a hairline: 1.97 : 1 under the ink in packages 4 and 5), `inkMuted` (text, 4.66 : 1 on Prune) and their role sources are not fills: a row wash is `--cr-wash`. */
  const BANNED_FILL = /background(?:-color)?:[^;]*var\(--cr-(?:panel-line|ink-muted|role-line|role-ink-muted|line)\)/
  /** The only fills allowed to use them, each with its reason. */
  const FILL_EXCEPTIONS: Readonly<Record<string, string>> = {
    '.cr-status-msg::before': 'the 6 px state dot of the status bar (fixed dark chrome, no text on it, a shape cue next to the message)',
  }
  const hitsIn = (css: string): string[] =>
    rulesOf(css)
      .filter((r) => BANNED_FILL.test(r.body.replace(/var\(--cr-wash,\s*var\(--cr-panel-line\)\)/g, '')) && !(r.selector in FILL_EXCEPTIONS))
      .map((r) => r.selector)

  it('no shell rule paints a background with the hairline or the muted-ink colour outside the listed exceptions; the connect dialog options use --cr-wash', () => {
    expect([...files, 'packages.css'].flatMap((f) => hitsIn(cssOf(f)).map((s) => `${f}: ${s}`))).toEqual([])
    expect(cssOf('connectDialog.css')).toMatch(/\.cr-connect-opt\[aria-selected='true'\][^}]*background: var\(--cr-wash/)
    expect(cssOf('packages.css')).toMatch(/--cr-wash: var\(--cr-role-wash\)/)
  })

  it('the ban bites: a row painted with --cr-panel-line, --cr-ink-muted, --cr-line or a role source is flagged; the wash and its fallback are not', () => {
    expect(hitsIn('.cr-x:hover { background: var(--cr-panel-line); }')).toHaveLength(1)
    expect(hitsIn('.cr-x { background-color: var(--cr-ink-muted); }')).toHaveLength(1)
    expect(hitsIn('.cr-x { background: var(--cr-role-line); }')).toHaveLength(1)
    expect(hitsIn('.cr-x { background: var(--cr-line); }')).toHaveLength(1)
    expect(hitsIn('.cr-x { background: var(--cr-wash, var(--cr-panel-line)); }')).toHaveLength(0)
    expect(hitsIn('.cr-x { border-color: var(--cr-ink-muted); color: var(--cr-panel-line); }')).toHaveLength(0)
    expect(hitsIn('.cr-status-msg::before { background: var(--cr-ink-muted); }')).toHaveLength(0)
  })

  it('every listed exception exists in the source (a stale entry is dead weight)', () => {
    const all = files.flatMap((f) => rulesOf(cssOf(f)))
    for (const sel of Object.keys(FILL_EXCEPTIONS)) expect(all.some((r) => r.selector === sel && BANNED_FILL.test(r.body)), sel).toBe(true)
  })
})
