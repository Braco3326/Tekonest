/**
 * Night wave 2, items E and F: the place picker and the inventory drawer, polished.
 *  E. Picker: the wide grid never clips at 375 px; the select's edge is the muted ink; the « scène » swatch is outlined; thin scrollbars;
 *     a hint that says the click first; a one-line pitch under « MODÈLES ».
 *  F. Drawer: head on one row (tabs on the content border), no overlap with « Fermer » at 400 px, thumbnails and silhouettes in one 40 x 36 box,
 *     and an empty filter that says what to do, with a real « Effacer le filtre » button.
 */
import { expect, test, type Page } from '@playwright/test'

const PLACE = 'room:concert-hall-medium'
type Box = { x: number; y: number; width: number; height: number }
const box = async (loc: ReturnType<Page['locator']>): Promise<Box> => (await loc.boundingBox())!
const meets = (a: Box, c: Box): boolean => a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height

const boot = async (page: Page, place: string | null = null): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  if (place) {
    await page.evaluate((p) => window.__creation!.choosePlace(p), place)
    await page.waitForFunction((p) => window.__creation!.place() === p, place)
  }
}
/** The computed colour of a token, as the browser writes it (rgb(...)): the way to compare a border to « the token » without hard-coding it. */
const tokenColor = (page: Page, token: string): Promise<string> =>
  page.evaluate((t) => {
    const probe = document.createElement('span')
    probe.style.color = `var(${t})`
    document.body.appendChild(probe)
    const c = getComputedStyle(probe).color
    probe.remove()
    return c
  }, token)
const openDrawer = async (page: Page): Promise<void> => {
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Space')
  await expect(page.getByTestId('inventory-drawer')).toBeVisible()
}

// ── E: the picker ────────────────────────────────────────────────────────────────────────────────
test.describe('picker (E)', () => {
  for (const width of [375, 360]) {
    test(`E: at ${width} px the wide template cards stay inside the padded scrolling area (no spill into the margin, no clipping), with no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 })
      await boot(page)
      const scroll = await box(page.locator('.cr-pick-scroll'))
      const pad = await page.locator('.cr-pick-scroll').evaluate((e) => parseFloat(getComputedStyle(e).paddingRight))
      const o = await page.evaluate(() => {
        const s = document.querySelector('.cr-pick-scroll')!
        return { x: s.scrollWidth - s.clientWidth, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth }
      })
      expect(o.x).toBeLessThanOrEqual(0)
      expect(o.doc).toBeLessThanOrEqual(0)
      for (const grid of ['template-grid', 'place-grid']) {
        const cards = page.getByTestId(grid).getByRole('option')
        const n = Math.min(await cards.count(), 4)
        for (let i = 0; i < n; i++) {
          const c = await box(cards.nth(i))
          expect(c.x, `${grid} card ${i} left`).toBeGreaterThanOrEqual(scroll.x + pad - 0.5)
          expect(c.x + c.width, `${grid} card ${i} right (the card is ${c.width} px)`).toBeLessThanOrEqual(scroll.x + scroll.width - pad + 0.5)
        }
      }
    })
  }

  test('E: the type filter is drawn with the muted ink (a visible control edge), and the « scène » swatch has its own 1 px outline', async ({ page }) => {
    await boot(page)
    const muted = await tokenColor(page, '--cr-ink-muted')
    const edge = await page.getByTestId('place-filter').evaluate((e) => getComputedStyle(e).borderTopColor)
    expect(edge).toBe(muted)
    const sw = await page.locator('.cr-pick-key--stage').evaluate((e) => {
      const c = getComputedStyle(e, '::before')
      return { w: c.borderTopWidth, style: c.borderTopStyle, color: c.borderTopColor }
    })
    expect(sw).toEqual({ w: '1px', style: 'solid', color: muted })
  })

  test('E: the scrollbars are thin and tinted for the dark chrome', async ({ page }) => {
    await boot(page, PLACE)
    for (const sel of ['.cr-pick-scroll', '.cr-props .cr-panel-body', '.cr-tree .cr-panel-body']) {
      const w = await page.locator(sel).evaluate((e) => ({ width: getComputedStyle(e).scrollbarWidth, color: getComputedStyle(e).scrollbarColor }))
      expect(w.width, sel).toBe('thin')
      expect(w.color, sel).not.toBe('auto')
    }
  })

  test('E: the hint says the click first, and one line under « Modèles » says what a template is', async ({ page }) => {
    await boot(page)
    await expect(page.locator('.cr-pick-hint')).toHaveText('Cliquez un lieu pour l’ouvrir (ou flèches puis Entrée).')
    const pitch = page.getByTestId('template-pitch')
    await expect(pitch).toHaveText('Un lieu avec son matériel déjà posé : le plus simple pour commencer.')
    // it goes with the « Modèles » heading (on its line when there is room, under it when not) and above its cards, and the row is as tall as the bare heading
    const h = await box(page.getByRole('heading', { name: 'Modèles' }))
    const p = await box(pitch)
    const g = await box(page.getByTestId('template-grid'))
    expect(p.x >= h.x + h.width - 1 || p.y >= h.y + h.height - 1, 'right of the heading, or under it').toBe(true)
    expect(g.y).toBeGreaterThanOrEqual(p.y + p.height - 1)
    expect(g.y - (h.y + h.height), 'the gap to the cards is the heading own 10 px').toBeLessThanOrEqual(10.5)
    // on a wide window the pitch costs no height: the place grid below stays where the bare heading put it (the axe label-in-name rule of the picker is sensitive to what straddles the fold, creation-budgets)
    expect((await box(page.locator('.cr-pick-rowhead'))).height, 'one line, as tall as the bare heading').toBeLessThanOrEqual(h.height + 1)
  })
})

// ── F: the drawer ────────────────────────────────────────────────────────────────────────────────
test.describe('drawer (F), 1366 x 768', () => {
  test.use({ viewport: { width: 1366, height: 768 } })

  test('F: the head is one row and the tab row sits on the border above the list', async ({ page }) => {
    await boot(page, PLACE)
    await openDrawer(page)
    const head = await box(page.locator('.cr-drawer-head'))
    const panel = await box(page.locator('.cr-drawer-panel'))
    expect(head.height, 'one row (a 36 px tab + its border)').toBeLessThanOrEqual(44)
    const tabs = page.getByRole('tab')
    const n = await tabs.count()
    for (let i = 0; i < n; i++) {
      const t = await box(tabs.nth(i))
      expect(Math.abs(t.y + t.height - panel.y), `tab ${i} bottom on the content border`).toBeLessThanOrEqual(2)
    }
    const filter = await box(page.getByTestId('inventory-filter'))
    const close = await box(page.getByTestId('inventory-close'))
    expect(meets(filter, close)).toBe(false)
    expect(await page.getByTestId('inventory-filter').evaluate((e) => getComputedStyle(e, '::placeholder').color), 'no duplicate word beside the visible label').toBe('rgba(0, 0, 0, 0)')
  })

  test('F: thumbnails and silhouettes fill the same 40 x 36 box, so every name starts at the same x, and a failed picture does not move it', async ({ page }) => {
    await boot(page, PLACE)
    await openDrawer(page)
    await page.getByRole('tab', { name: 'Consoles' }).click()
    const items = page.getByTestId('inventory-item')
    const n = await items.count()
    expect(n).toBeGreaterThan(0)
    const nameX = async (): Promise<number[]> =>
      page.evaluate(() => [...document.querySelectorAll('[data-testid="inventory-item"]')].map((b) => b.querySelector('.cr-inv-name')!.getBoundingClientRect().x - b.getBoundingClientRect().x))
    const before = await nameX()
    expect(new Set(before.map((x) => Math.round(x))).size, 'one name column').toBe(1)
    const sizes = await page.evaluate(() => [...document.querySelectorAll('.cr-inv-thumb, .cr-inv-icon')].map((e) => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]))
    for (const [w, h] of sizes) expect([Math.round(w), Math.round(h)]).toEqual([40, 36])
    // a picture that fails to load becomes the silhouette in the same box
    await page.evaluate(() => {
      const img = document.querySelector('.cr-inv-thumb')
      if (img) img.dispatchEvent(new Event('error'))
    })
    expect(await nameX()).toEqual(before)
    const after = await page.evaluate(() => [...document.querySelectorAll('.cr-inv-thumb, .cr-inv-icon')].map((e) => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]))
    for (const [w, h] of after) expect([Math.round(w), Math.round(h)]).toEqual([40, 36])
  })

  test('F: an empty filter says what to do and offers « Effacer le filtre » (clears, refocuses the field); the spoken status stays short', async ({ page }) => {
    await boot(page, PLACE)
    await openDrawer(page)
    const filter = page.getByTestId('inventory-filter')
    await filter.fill('zzzz')
    await expect(page.getByTestId('inventory-filter-status')).toHaveText('Aucun appareil ne correspond')
    const empty = page.locator('.cr-drawer-empty')
    await expect(empty).toContainText('Aucun appareil ne correspond à « zzzz ». Effacez le filtre ou essayez un autre mot (micro, console, enceinte).')
    const clear = page.getByRole('button', { name: 'Effacer le filtre' })
    await expect(clear).toBeVisible()
    await clear.click()
    await expect(filter).toHaveValue('')
    await expect(filter).toBeFocused()
    await expect(page.getByTestId('inventory-item').first()).toBeVisible()
    await expect(clear).toHaveCount(0)
    await expect(page.getByTestId('inventory-filter-status')).toHaveText('')
  })

  test('F: Espace on « Effacer le filtre » presses it (it does not close the drawer, as it does everywhere else)', async ({ page }) => {
    await boot(page, PLACE)
    await openDrawer(page)
    await page.getByTestId('inventory-filter').fill('zzzz')
    await page.getByRole('button', { name: 'Effacer le filtre' }).focus()
    await page.keyboard.press('Space')
    await expect(page.getByTestId('inventory-drawer')).toBeVisible()
    await expect(page.getByTestId('inventory-filter')).toHaveValue('')
    await expect(page.getByTestId('inventory-filter')).toBeFocused()
  })

  test('F: the typed text is shown as text, never as markup', async ({ page }) => {
    await boot(page, PLACE)
    await openDrawer(page)
    await page.getByTestId('inventory-filter').fill('<b>x</b>')
    await expect(page.locator('.cr-drawer-empty')).toContainText('« <b>x</b> »')
    await expect(page.locator('.cr-drawer-empty b')).toHaveCount(0)
  })
})

test.describe('drawer (F), 400 x 800', () => {
  test.use({ viewport: { width: 400, height: 800 } })

  test('F: the tab row scrolls sideways and nothing overlaps « Fermer »', async ({ page }) => {
    await boot(page, PLACE)
    await openDrawer(page)
    const close = await box(page.getByTestId('inventory-close'))
    const filter = await box(page.getByTestId('inventory-filter'))
    const list = await box(page.locator('.cr-drawer-tabs'))
    expect(meets(filter, close), 'filter vs Fermer').toBe(false)
    expect(meets(list, close), 'tab row vs Fermer').toBe(false)
    expect(close.x + close.width).toBeLessThanOrEqual(400)
    expect(await page.locator('.cr-drawer-tabs').evaluate((e) => getComputedStyle(e).overflowX)).toBe('auto')
    // the label gives way to the placeholder (the same word) on a phone, and is still the field's name
    const ph = await page.getByTestId('inventory-filter').evaluate((e) => getComputedStyle(e, '::placeholder').color)
    expect(ph, 'placeholder drawn').not.toBe('rgba(0, 0, 0, 0)')
    await expect(page.getByTestId('inventory-filter')).toHaveAttribute('placeholder', 'Filtrer')
    expect((await box(page.locator('.cr-drawer-filter-label'))).width, 'label is out of sight').toBeLessThanOrEqual(2)
    await expect(page.getByRole('textbox', { name: 'Filtrer' })).toBeVisible()
    // every tab is still reachable: the last one scrolls into view when focused
    const tabs = page.getByRole('tab')
    await tabs.last().focus()
    await expect(tabs.last()).toBeInViewport()
    const t = await box(tabs.last())
    expect(meets(t, close), 'the last tab never goes under Fermer').toBe(false)
  })
})
