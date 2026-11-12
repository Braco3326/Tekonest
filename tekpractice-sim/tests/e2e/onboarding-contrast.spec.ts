/**
 * Contrast in use (onboarding packs, plan T4.4, spec 7.3 and 11.2): the colours the page ACTUALLY resolves, per package, against the backgrounds they actually sit on.
 * tests/design/packageContrast.test.ts computes the declared pairs; tests/design/packageCss.test.ts scans the source; this suite reads the computed styles in Chromium.
 *
 * Per package, in the states a learner meets (the start screen, the places, the room with the drawer, Propriétés and the tree open, a dialog, the two pop-overs):
 *  - the focus ring of a control in a surface the package restyles is the package's `focus` role, at >= 3 : 1 against the background it sits on; a control of the fixed chrome
 *    (menubar, status bar) keeps Ambre;
 *  - the hover border of a device card and of a dialog button is the package's `select` role, at >= 3 : 1; its hover text is `accentText`, at >= 4.5 : 1;
 *  - the dialog's buttons are bordered in a colour at >= 3 : 1 against the dialog, and the dialog's own frame is never Ambre on Papier;
 *  - NO element of the page resolves Ambre as text (>= 4.5), outline, border or inset bar (>= 3) on a background it cannot carry it on (package 3: Papier, 2.16 : 1);
 *  - axe `color-contrast` is clean in every state (the plan asks for package 3; the other four are measured too).
 * The measured table is printed (CONTRAST lines) for the report.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { DESIGN_IDS, packageById, type DesignId } from '../../src/design/packages'
import { contrastRatio } from '../../src/design/creationTokens'

test.use({ viewport: { width: 1366, height: 768 } })

const AMBRE = '#DD9349'

/** In-page reader: effective background and the Ambre audit. Returns plain data (no DOM handles). */
interface Finding {
  where: string
  what: string
  fg: string
  bg: string
  ratio: number
  need: number
}

/**
 * Two audits in one pass over the page: `ambre` (Ambre as text, outline, border or inset bar where it cannot be read) and `text` (EVERY visible text, whatever its colour, against the
 * background it sits on, >= 4.5 : 1; disabled controls, the guide's widget, svg and the canvas are left out). The second is axe's `color-contrast` done on the computed colours
 * without its « incomplete » escape hatch: a button that names no colour and inherits the shell's light ink onto a Papier sheet was missed by axe and found on a screenshot.
 */
async function audits(page: Page): Promise<{ ambre: Finding[]; text: Finding[] }> {
  return page.evaluate((AMBRE_HEX) => {
    const parse = (c: string): [number, number, number, number] | null => {
      let m = c.match(/^rgba?\(([^)]+)\)$/)
      if (m) {
        const p = m[1].split(/[,/ ]+/).filter(Boolean).map(Number)
        return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]
      }
      m = c.match(/^color\(srgb ([^)]+)\)$/)
      if (m) {
        const p = m[1].split(/[ /]+/).filter(Boolean).map(Number)
        return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]
      }
      return null
    }
    const lum = (r: number, g: number, b: number): number => {
      const ch = (v: number): number => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
    }
    const ratio = (a: number[], b: number[]): number => {
      const x = lum(a[0], a[1], a[2])
      const y = lum(b[0], b[1], b[2])
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
    }
    const bgOf = (el: Element): [number, number, number] => {
      const layers: [number, number, number, number][] = []
      for (let e: Element | null = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor)
        if (c && c[3] > 0) {
          layers.push(c)
          if (c[3] >= 0.999) break
        }
      }
      let out: [number, number, number] = [19, 17, 20] // the page's Nuit behind everything
      for (const l of layers.reverse()) out = [out[0] * (1 - l[3]) + l[0] * l[3], out[1] * (1 - l[3]) + l[1] * l[3], out[2] * (1 - l[3]) + l[2] * l[3]]
      return out
    }
    const amb = parse('rgb(221, 147, 73)')!
    const isAmbre = (c: string): boolean => {
      const p = parse(c)
      return p !== null && p[3] > 0.5 && Math.abs(p[0] - amb[0]) < 1.5 && Math.abs(p[1] - amb[1]) < 1.5 && Math.abs(p[2] - amb[2]) < 1.5
    }
    const label = (el: Element): string => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 2).join('.') : ''}`
    const out: { where: string; what: string; fg: string; bg: string; ratio: number; need: number }[] = []
    const textOut: { where: string; what: string; fg: string; bg: string; ratio: number; need: number }[] = []
    const hx = (p: number[]): string => '#' + p.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase()
    /** Text and an inset bar sit ON the element's own background; a border or an outline is drawn at (or outside) its edge, against what surrounds the element. */
    const add = (el: Element, what: string, need: number): void => {
      const bg = bgOf(what === 'text' || what === 'box-shadow bar' || !el.parentElement ? el : el.parentElement)
      const r = ratio(amb, bg)
      if (r < need) out.push({ where: label(el), what, fg: AMBRE_HEX, bg: '#' + bg.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase(), ratio: Math.round(r * 100) / 100, need })
    }
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const rc = el.getBoundingClientRect()
      if (rc.width === 0 || rc.height === 0) continue
      if (el.closest('canvas, [hidden]')) continue
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '')
      if (ownText && !el.closest('.oscar-guide, [aria-disabled="true"], :disabled, svg')) {
        const bg = bgOf(el)
        const fgc = parse(cs.color)
        if (fgc) {
          const fg = [fgc[0] * fgc[3] + bg[0] * (1 - fgc[3]), fgc[1] * fgc[3] + bg[1] * (1 - fgc[3]), fgc[2] * fgc[3] + bg[2] * (1 - fgc[3])]
          const r = ratio(fg, bg)
          if (r < 4.5) textOut.push({ where: label(el), what: `text "${(el.textContent ?? '').trim().slice(0, 24)}"`, fg: hx(fg), bg: hx(bg), ratio: Math.round(r * 100) / 100, need: 4.5 })
        }
      }
      if (ownText && isAmbre(cs.color)) add(el, 'text', 4.5)
      if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && isAmbre(cs.outlineColor)) add(el, 'outline', 3)
      for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
        const style = cs.getPropertyValue(`border-${side.toLowerCase()}-style`)
        const w = parseFloat(cs.getPropertyValue(`border-${side.toLowerCase()}-width`))
        if (style !== 'none' && w > 0 && isAmbre(cs.getPropertyValue(`border-${side.toLowerCase()}-color`))) add(el, `border-${side.toLowerCase()}`, 3)
      }
      if (cs.boxShadow !== 'none' && /rgb\(221, 147, 73\)/.test(cs.boxShadow)) add(el, 'box-shadow bar', 3)
    }
    return { ambre: out, text: textOut }
  }, AMBRE)
}

interface Probe {
  outline: string
  outlineStyle: string
  border: string
  color: string
  /** The effective background the element's own text sits on. */
  bg: string
  /** What its outline or border is drawn against: the surroundings (an outline with a positive offset and a border sit at or outside the edge), the element's own ground for an inset ring. */
  ringBg: string
}

/** The computed colours of an element and the effective background it sits on. */
async function probe(page: Page, selector: string, target: 'self' | 'child' = 'self'): Promise<Probe> {
  return page.locator(selector).first().evaluate(
    (el, which) => {
      const parse = (c: string): [number, number, number, number] => {
        let m = c.match(/^rgba?\(([^)]+)\)$/)
        if (m) {
          const p = m[1].split(/[,/ ]+/).filter(Boolean).map(Number)
          return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]
        }
        m = c.match(/^color\(srgb ([^)]+)\)$/)
        const p = m![1].split(/[ /]+/).filter(Boolean).map(Number)
        return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]
      }
      const hx = (p: number[]): string => '#' + p.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase()
      const bgOf = (e0: Element): string => {
        const layers: number[][] = []
        for (let e: Element | null = e0; e; e = e.parentElement) {
          const c = parse(getComputedStyle(e).backgroundColor)
          if (c[3] > 0) {
            layers.push(c)
            if (c[3] >= 0.999) break
          }
        }
        let out = [19, 17, 20]
        for (const l of layers.reverse()) out = [out[0] * (1 - l[3]) + l[0] * l[3], out[1] * (1 - l[3]) + l[1] * l[3], out[2] * (1 - l[3]) + l[2] * l[3]]
        return hx(out)
      }
      const t = which === 'child' ? (el.querySelector(':scope > *') ?? el) : el
      const cs = getComputedStyle(t)
      const inset = parseFloat(cs.outlineOffset) < 0
      return {
        outline: hx(parse(cs.outlineColor)),
        outlineStyle: cs.outlineStyle,
        border: hx(parse(cs.borderTopColor)),
        color: hx(parse(cs.color)),
        bg: bgOf(t),
        ringBg: bgOf(inset || !t.parentElement ? t : t.parentElement),
      }
    },
    target,
  )
}

const keyboardFocus = async (page: Page, selector: string): Promise<void> => {
  await page.keyboard.press('Shift') // keyboard modality: a programmatic focus then shows :focus-visible
  await page.locator(selector).first().focus()
}

async function axeColour(page: Page, state: string): Promise<void> {
  const r = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
  const lines = r.violations.flatMap((v) => v.nodes.map((n) => `${state}: ${n.target.join(' ')} :: ${(n.any[0]?.message ?? '').slice(0, 140)}`))
  expect(lines, `axe color-contrast, ${state}`).toEqual([])
}

let table: string[] = []
const row = (id: DesignId, what: string, fg: string, bg: string, need: number): void => {
  const r = contrastRatio(fg, bg)
  table.push(`CONTRAST package ${id} | ${what} | ${fg} on ${bg} = ${r.toFixed(2)} (needs ${need})`)
  expect(r, `package ${id} ${what}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(need)
}

for (const id of DESIGN_IDS) {
  const pkg = packageById(id)
  const c = pkg.colours

  test(`package ${id} (${pkg.tell}): focus, hover and dialog colours in use, no Ambre where it cannot be read, axe color-contrast`, async ({ page }) => {
    test.setTimeout(150_000)
    table = []
    const noAmbre = async (state: string): Promise<void> => {
      const a = await audits(page)
      expect(a.ambre, `Ambre where it cannot be read, ${state}`).toEqual([])
      expect(a.text, `text under 4.5 : 1 against its background, ${state}`).toEqual([])
    }

    // ── 1. the start screen (a ground: the profile choice, then the offer)
    await page.goto(`/?design=${id}`)
    await page.evaluate(() => window.localStorage.clear())
    await page.reload()
    await page.waitForFunction(() => !!window.__creation)
    await page.getByTestId('start-screen').waitFor()
    await noAmbre('start screen')
    await axeColour(page, 'start screen')
    await keyboardFocus(page, '.cr-start-btn')
    const startBtn = await probe(page, '.cr-start-btn')
    expect(startBtn.outlineStyle).not.toBe('none')
    expect(startBtn.outline, 'focus ring on a start-screen button = the focus role').toBe(c.focus.toUpperCase())
    row(id, 'start-screen focus ring on its background', startBtn.outline, startBtn.ringBg, 3)
    row(id, 'start-screen button border (select)', startBtn.border, startBtn.ringBg, 3)

    // ── 2. the places (Échap on the profile stage)
    await page.keyboard.press('Escape')
    await page.locator('.cr-pick-grid').first().waitFor()
    await noAmbre('places')
    await axeColour(page, 'places')

    // ── 3. the room: profile « Je suis étudiant·e » (both panels, drawer on Consoles), a console and a mic placed and selected
    await page.reload()
    await page.waitForFunction(() => !!window.__creation)
    await page.getByTestId('start-screen').waitFor()
    await page.keyboard.press('2')
    await page.getByRole('button', { name: 'Passer, je connais', exact: true }).click()
    await page.waitForFunction(() => window.__creation!.place() === 'blank')
    await expect(page.getByTestId('inventory-drawer')).toHaveAttribute('data-open', 'true')
    await page.evaluate(() => {
      window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 0], rotationY: 0 })
      window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58', position: [0.8, 0, 0], rotationY: 0 })
      window.__creation!.frameDevice('ql1')
    })
    await expect(page.locator('.cr-props-content .cr-field, .cr-props-content .cr-toggle').first()).toBeVisible()
    await page.waitForFunction(() => !window.__creation!.cameraMoving())
    await noAmbre('room')
    await axeColour(page, 'room (drawer, tree, Propriétés)')

    // focus rings: surfaces the package restyles carry its focus role; the fixed chrome keeps Ambre
    // a band (the panel heads of a banded package) carries its own ink as the ring: the focus role would be Ambre on Prune there (4.24: not enough for a ring on a band's busy edge)
    const banded = pkg.layout.surfaceStyle === 'banded'
    const surfaces: [string, string, 'self' | 'child', string][] = [
      ['drawer tab', '.cr-drawer-tab[aria-selected="true"]', 'self', c.focus],
      ['drawer filter field', '[data-testid="inventory-filter"]', 'self', c.focus],
      ['drawer device card', '[data-testid="inventory-item"]', 'self', c.focus],
      ['tree row', '.cr-tree-root [role="treeitem"]', 'child', c.focus],
      ['Propriétés collapse button', '[data-testid="props-collapse"]', 'self', banded ? c.bandInk : c.focus],
      ['Propriétés field', '.cr-props-content .cr-field-input', 'self', c.focus],
    ]
    for (const [name, sel, which, expected] of surfaces) {
      await keyboardFocus(page, sel)
      const p = await probe(page, sel, which)
      expect(p.outlineStyle, `${name} has a focus ring`).not.toBe('none')
      expect(p.outline, `${name}: its ring is the focus role`).toBe(expected.toUpperCase())
      row(id, `focus ring, ${name}`, p.outline, p.ringBg, 3)
    }
    await keyboardFocus(page, '#cr-menu-materiel')
    const menu = await probe(page, '#cr-menu-materiel')
    expect(menu.outline, 'the menubar is fixed chrome: it keeps Ambre').toBe(AMBRE)
    row(id, 'focus ring, menubar (chrome)', menu.outline, menu.ringBg, 3)

    // hover: the card's border is the select role and its text the accent text, both legible on the card
    await page.locator('[data-testid="inventory-item"]').first().hover()
    const hov = await probe(page, '[data-testid="inventory-item"]')
    expect(hov.border, 'hover border on a device card = the select role').toBe(c.select.toUpperCase())
    expect(hov.color, 'hover text on a device card = the accent text role').toBe(c.accentText.toUpperCase())
    row(id, 'hover border, device card', hov.border, hov.ringBg, 3)
    row(id, 'hover text, device card', hov.color, hov.bg, 4.5)
    await page.mouse.move(5, 400)

    // ── 4. a dialog (Aide, Raccourcis clavier): its buttons, its ring, its frame
    await page.locator('#cr-menu-aide').click()
    await page.getByRole('menuitem', { name: 'Raccourcis clavier' }).click()
    await page.locator('.cr-dialog').waitFor()
    await noAmbre('dialog')
    await axeColour(page, 'dialog')
    const frame = await probe(page, '.cr-dialog')
    expect(frame.border.toUpperCase(), 'the dialog frame is never Ambre').not.toBe(AMBRE)
    table.push(`CONTRAST package ${id} | dialog frame (decorative: the scrim marks the edge) | ${frame.border} on ${frame.bg} = ${contrastRatio(frame.border, frame.bg).toFixed(2)}`)
    await keyboardFocus(page, '.cr-dialog button')
    const dBtn = await probe(page, '.cr-dialog button')
    expect(dBtn.outline, 'focus ring inside a dialog = the focus role').toBe(c.focus.toUpperCase())
    row(id, 'focus ring, dialog button', dBtn.outline, dBtn.ringBg, 3)
    row(id, 'border, dialog button (select, or the accent edge on the primary one)', dBtn.border, dBtn.ringBg, 3)
    await page.keyboard.press('Escape')
    await page.locator('.cr-dialog').waitFor({ state: 'detached' })

    // ── 5. the two pop-overs: the error list (Signal) and « Pourquoi je n’entends rien ? » (the chip)
    await page.getByTestId('checklist-chip').click()
    await page.locator('.cr-checklist:not([hidden])').waitFor()
    await noAmbre('checklist')
    await axeColour(page, 'checklist pop-over')
    await page.keyboard.press('Escape')
    await page.locator('.cr-signal').click()
    await page.locator('.cr-errlist:not([hidden])').waitFor()
    await noAmbre('error list')
    await axeColour(page, 'error list pop-over')

    console.log(table.join('\n'))
  })
}
