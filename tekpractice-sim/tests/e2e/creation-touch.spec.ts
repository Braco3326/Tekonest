/**
 * Night wave 2, item I: touch. With a coarse primary pointer (`hasTouch`: Chromium then reports `pointer: coarse`) every control a finger can meet is at
 * least 44 x 44 px, in every state that shows one; nothing overflows at 400 x 800; the view cube's tools still fit; « Annuler la pose » is not overlapped.
 * With a mouse nothing changes: the desktop pixels (menubar 32, status bar 28, tools 28) are asserted at 1366 x 768.
 */
import { expect, test, type Page } from '@playwright/test'

const boot = async (page: Page, template = true): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  if (!template) return
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 5)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
}
type Box = { x: number; y: number; width: number; height: number }
const meets = (a: Box, c: Box): boolean => a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height

/** Every interactive element that is on screen and smaller than 44 px in a dimension, as « selector "text" WxH » (empty list = all good). */
const small = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const SEL = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="tab"], [role="treeitem"], [role="option"]'
    const out: string[] = []
    for (const e of document.querySelectorAll<HTMLElement>(SEL)) {
      if (e.closest('[inert], [hidden], .cr-sr-only, .cr-skip')) continue
      const s = getComputedStyle(e)
      if (s.visibility === 'hidden' || s.display === 'none') continue
      let r = e.getBoundingClientRect()
      // A radio / checkbox is pressed through its label: the label is the target.
      if (e instanceof HTMLInputElement && (e.type === 'radio' || e.type === 'checkbox')) {
        const l = e.closest('label')
        if (l) r = l.getBoundingClientRect()
      }
      if (r.width === 0 || r.height === 0) continue
      if (e.id === 'renderCanvas') continue
      if (r.width < 43.5 || r.height < 43.5) {
        const name = (e.getAttribute('aria-label') ?? e.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30)
        out.push(`${e.tagName.toLowerCase()}.${(e.className && String(e.className).split(' ')[0]) || '-'} "${name}" ${Math.round(r.width * 10) / 10}x${Math.round(r.height * 10) / 10}`)
      }
    }
    return out
  })
const noOverflow = (page: Page): Promise<number> => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const canvas = (page: Page) => page.locator('#renderCanvas')
const selectKit = async (page: Page, id: string): Promise<void> => {
  await canvas(page).focus()
  for (let i = 0; i < 8 && (await page.evaluate(() => window.__creation!.selection())) !== id; i++) await page.keyboard.press(']')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe(id)
}
const openBothPanels = async (page: Page): Promise<void> => {
  for (const id of ['tree-collapse', 'props-collapse']) {
    const b = page.getByTestId(id)
    if ((await b.getAttribute('aria-expanded')) !== 'true') await b.click()
  }
}

test.describe('coarse pointer, 400 x 800', () => {
  test.use({ viewport: { width: 400, height: 800 }, hasTouch: true })

  test('the emulation is a coarse pointer (the sweep below means something)', async ({ page }) => {
    await boot(page, false)
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
  })

  test('the first screen: menubar, picker and status bar are 44 px targets', async ({ page }) => {
    await boot(page, false)
    await expect(page.getByTestId('place-picker')).toBeVisible()
    expect(await small(page)).toEqual([])
    expect(await noOverflow(page)).toBeLessThanOrEqual(0)
    const menubar = (await page.getByTestId('menubar').boundingBox())!
    const status = (await page.getByTestId('status-bar').boundingBox())!
    expect(menubar.height).toBe(48)
    expect(status.height).toBe(48)
    expect(status.y + status.height).toBe(800)
  })

  test('a place with a selection and both panels open: the tree rows, the settings, the ports and the rails are 44 px targets', async ({ page }) => {
    await boot(page)
    await selectKit(page, 'ql1')
    await openBothPanels(page)
    await page.getByRole('treeitem', { name: /^Matériel/ }).click() // opens the group: its rows are on screen
    expect(await small(page)).toEqual([])
    expect(await noOverflow(page)).toBeLessThanOrEqual(0)
    // the settings are one column here: nothing is clipped on the right of the 260 px column
    const props = (await page.getByTestId('properties').boundingBox())!
    for (const sel of ['.cr-field-input', '.cr-step', '.cr-toggle']) {
      const b = await page.locator(`.cr-props ${sel}`).first().boundingBox()
      expect(b, `${sel} exists in the properties column (an absent control would hide a clipped one)`).not.toBeNull()
      expect(b!.x + b!.width, sel).toBeLessThanOrEqual(props.x + props.width + 0.5)
    }
  })

  test('S5 (wave 2c): a control that starts above the fold is scrolled to below the 45 px sticky title row, not under it', async ({ page }) => {
    await boot(page)
    await selectKit(page, 'ql1')
    await page.getByTestId('props-collapse').click()
    const props = page.getByTestId('properties')
    await props.evaluate((e) => e.scrollTo(0, e.scrollHeight))
    expect(await props.evaluate((e) => e.scrollTop), 'the column is long enough to scroll').toBeGreaterThan(100)
    const head = (await page.locator('.cr-props .cr-panel-head').boundingBox())!
    expect(head.height).toBeGreaterThanOrEqual(45)
    await page.locator('.cr-props .cr-field-input').first().focus() // above the fold now: the browser scrolls it into view
    const f = (await page.locator('.cr-props .cr-field-input').first().boundingBox())!
    expect(f.y, 'not under the sticky row').toBeGreaterThanOrEqual(head.y + head.height - 0.5)
    expect(await props.evaluate((e) => getComputedStyle(e).scrollPaddingTop)).toBe('52px')
  })

  test('the folded rails (Projet and Propriétés, with the legend rail) are 44 px wide targets', async ({ page }) => {
    await boot(page)
    for (const id of ['tree-collapse', 'props-collapse']) {
      const b = page.getByTestId(id)
      if ((await b.getAttribute('aria-expanded')) === 'true') await b.click()
    }
    expect(await small(page)).toEqual([])
    const rail = (await page.getByTestId('tree-collapse').boundingBox())!
    expect(rail.width).toBeGreaterThanOrEqual(44)
    expect(rail.height).toBeGreaterThanOrEqual(44)
    expect(await noOverflow(page)).toBeLessThanOrEqual(0)
  })

  test('the drawer: tabs, filter, Fermer, the empty-filter button and the items are 44 px targets, and nothing overlaps Fermer', async ({ page }) => {
    await boot(page)
    await canvas(page).focus()
    await page.keyboard.press('Space')
    await expect(page.getByTestId('inventory-drawer')).toBeVisible()
    expect(await small(page)).toEqual([])
    await page.getByTestId('inventory-filter').fill('zzzz')
    expect(await small(page)).toEqual([])
    const close = (await page.getByTestId('inventory-close').boundingBox())!
    const filter = (await page.getByTestId('inventory-filter').boundingBox())!
    const tabs = (await page.locator('.cr-drawer-tabs').boundingBox())!
    expect(meets(filter, close)).toBe(false)
    expect(meets(tabs, close)).toBe(false)
    expect(await noOverflow(page)).toBeLessThanOrEqual(0)
  })

  test('coverage and listening open in Propriétés: their toggles, chip, buttons and summaries are 44 px targets', async ({ page }) => {
    await boot(page)
    await page.evaluate(() => {
      const c = window.__creation!
      c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } })
      c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-r' }, b: { instance: 'k12-d', port: 'in-line-a' } })
      c.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true })
    })
    await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Couverture' }).click()
    await page.waitForFunction(() => window.__creation!.coverage().status === 'ready' && !window.__creation!.coverage().pending, null, { timeout: 20_000 })
    await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Lecture', exact: true }).click()
    await page.waitForFunction(() => window.__creation!.audioState().state === 'playing', null, { timeout: 15_000 })
    await expect(page.getByTestId('listen-panel')).toBeVisible()
    await expect(page.getByTestId('coverage-panel')).toBeVisible()
    await page.getByTestId('coverage-about-title').scrollIntoViewIfNeeded()
    await page.getByTestId('coverage-about-title').click()
    await page.getByTestId('listen-limits-title').scrollIntoViewIfNeeded()
    await page.getByTestId('listen-limits-title').click()
    expect(await small(page)).toEqual([])
    expect(await noOverflow(page)).toBeLessThanOrEqual(0)
    // wave 2c (S4): a 44 px summary still draws its disclosure marker (a flex summary loses it)
    for (const id of ['coverage-about-title', 'listen-limits-title']) expect(await page.getByTestId(id).evaluate((e) => getComputedStyle(e).display), id).toBe('list-item')
    await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Stop', exact: true }).click()
  })

  test('a menu open: every item is a 44 px target', async ({ page }) => {
    await boot(page)
    await page.getByRole('menuitem', { name: 'Projet', exact: true }).click()
    await expect(page.getByRole('menu', { name: 'Projet' })).toBeVisible()
    expect(await small(page)).toEqual([])
  })

  test('the error list, a note with an action and « Annuler la pose »: 44 px targets, and the button is not overlapped', async ({ page }) => {
    await boot(page)
    await canvas(page).focus()
    await page.keyboard.press('Space')
    await page.getByRole('tab', { name: 'Consoles' }).click()
    await page.locator('[data-testid="inventory-item"][data-device-id="yamaha-ql1"]').click()
    await expect.poll(() => page.evaluate(() => window.__creation!.placing())).toBe(true)
    await page.evaluate(() => {
      const stack = document.querySelector('[data-testid="notes"]')!
      const n = document.createElement('section')
      n.className = 'cr-note'
      n.innerHTML = '<h3 class="cr-note-title">Une note</h3><button type="button" class="cr-note-close" aria-label="Fermer la note">×</button><p class="cr-note-body">Texte</p><div class="cr-note-actions"><button type="button" class="cr-note-action">Reprendre ici</button></div>'
      stack.append(n)
      const t = document.querySelector<HTMLElement>('[data-testid="toast"]')!
      t.hidden = false
      t.textContent = 'Rien ici : Espace ouvre le tiroir des appareils pour en poser un.'
    })
    await page.getByTestId('signal-status').click()
    await expect(page.getByTestId('error-list')).toBeVisible()
    expect(await small(page)).toEqual([])
    const cancel = (await page.getByRole('button', { name: 'Annuler la pose' }).boundingBox())!
    expect(cancel.height).toBeGreaterThanOrEqual(44)
    for (const [name, loc] of [
      ['error list', page.getByTestId('error-list')],
      ['notes', page.getByTestId('notes')],
      ['toast', page.getByTestId('toast')],
    ] as const) expect(meets((await loc.boundingBox())!, cancel), `${name} overlaps « Annuler la pose »`).toBe(false)
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-testid'), { x: cancel.x + cancel.width / 2, y: cancel.y + cancel.height / 2 })).toBe('cancel-placement')
    expect(await noOverflow(page)).toBeLessThanOrEqual(0)
  })

  test('the view cube tools are 44 px, inside the view, and below them the notes stack still stands clear', async ({ page }) => {
    await boot(page)
    const view = (await page.getByTestId('viewport').boundingBox())!
    const tools = page.getByTestId('view-cube-tools')
    const n = await tools.getByRole('button').count()
    expect(n).toBe(3)
    for (let i = 0; i < n; i++) {
      const b = (await tools.getByRole('button').nth(i).boundingBox())!
      expect(b.width).toBeGreaterThanOrEqual(44)
      expect(b.height).toBeGreaterThanOrEqual(44)
      expect(b.x + b.width).toBeLessThanOrEqual(view.x + view.width)
      expect(b.y + b.height).toBeLessThanOrEqual(view.y + view.height)
    }
    const group = (await tools.boundingBox())!
    await page.evaluate(() => {
      const stack = document.querySelector('[data-testid="notes"]')!
      for (let i = 0; i < 4; i++) {
        const n = document.createElement('section')
        n.className = 'cr-note'
        n.style.minHeight = '140px'
        n.textContent = 'Une note'
        stack.append(n)
      }
    })
    const notes = (await page.getByTestId('notes').boundingBox())!
    expect(meets(group, notes), 'the tools and the notes stack never meet').toBe(false)
  })
})

test.describe('a mouse, 1366 x 768: the desktop pixels do not move', () => {
  test.use({ viewport: { width: 1366, height: 768 } })

  test('menubar 32, status bar 28, rails 32, tools 28, signal at least 24, steppers 28', async ({ page }) => {
    await boot(page)
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(false)
    expect((await page.getByTestId('menubar').boundingBox())!.height).toBe(32)
    expect((await page.getByTestId('status-bar').boundingBox())!.height).toBe(28)
    expect((await page.getByTestId('tree-collapse').boundingBox())!.width).toBe(32)
    expect((await page.getByTestId('view-cube-tools').getByRole('button').first().boundingBox())!.height).toBe(28)
    expect((await page.getByTestId('signal-status').boundingBox())!.height).toBeLessThanOrEqual(26)
    await selectKit(page, 'ql1')
    const step = (await page.locator('.cr-props .cr-step').first().boundingBox())!
    expect([step.width, step.height]).toEqual([28, 28])
    const field = await page.locator('.cr-props .cr-field').first().evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)
    expect(field, 'two columns on desktop: label, control').toBe(2)
    const tree = (await page.getByTestId('project-tree').boundingBox())!
    expect(tree.width).toBe(200)
  })
})
