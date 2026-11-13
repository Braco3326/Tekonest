/**
 * The entrepreneur after the first sound, in the browser (onboarding packs, plan T6.4, spec 3).
 *
 * Profile 3 (« Je monte un projet », `afterFirstSound: 'own-gear-and-venues'`) only, after a sound has started in the session, on a practice address with `?design`: ONE line
 * (« Votre matériel n’est peut-être pas dans l’inventaire … ») and THREE generic venue types (« Salle des fêtes », « Bar-concert », « Petite salle »), each labelled « salle
 * d’exemple, non vérifiée », with no figure and no named venue. It sits in a reserved row of the shell grid just above the status bar (nothing is covered), is a labelled region (no
 * dialog, no focus trap, no animation), its dismiss button is reachable by Tab, Escape is not read, and the dismissal is remembered in `audio-sim/creation-onboarding.v1`.
 *
 * Pinned: not before the sound; nothing for profiles 1, 2 and 4; nothing on an exam address or the plain address; the card is independent of the guide (`?oscar=0`, a muted Oscar);
 * the tutorial of package 5 and the card live together without covering each other or Oscar; the colours in use pass ADR 0017 (text >= 4.5, UI >= 3, axe) in all five packages.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { contrastRatio } from '../../src/design/creationTokens'
import { DESIGN_IDS, packageById, type DesignId } from '../../src/design/packages'

test.use({ viewport: { width: 1366, height: 768 } })

const ONBOARDING_KEY = 'audio-sim/creation-onboarding.v1'
const GUIDE_KEY = 'oscar-guide.onboarding.v1'
const LINE = 'Votre matériel n’est peut-être pas dans l’inventaire : seuls les appareils listés sont dans le simulateur.'
const VENUES = ['Salle des fêtes', 'Bar-concert', 'Petite salle']
const LABEL = 'salle d’exemple, non vérifiée'

const gear = (page: Page) => page.getByTestId('own-gear')
const slot = (page: Page) => page.getByTestId('gear-slot')
const record = (page: Page) => page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? 'null'), ONBOARDING_KEY)
const box = async (l: Locator) => (await l.boundingBox())!
const intersects = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

const spawn = (deviceId: string, instanceId: string, x: number) => ({ type: 'SPAWN', deviceId, instanceId, position: [x, 0, 0] })
const connect = (a: string, ap: string, b: string, bp: string) => ({ type: 'CONNECT', a: { instance: a, port: ap }, b: { instance: b, port: bp } })
const READY = [
  spawn('yamaha-ql1', 'ql1', 0),
  spawn('qsc-k12-2', 'k12', -1),
  spawn('multiprise-secteur', 'strip', 0.4),
  connect('ql1', 'out-main-l', 'k12', 'in-line-a'),
  { type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true },
  connect('strip', 'out-1', 'ql1', 'power-in'),
  connect('strip', 'out-2', 'k12', 'power-in'),
]
/** A bench that plays: the package's playable model if its first room is one, else the READY bench (placed through the app's own intents, as a learner would). */
async function ensureBench(page: Page): Promise<void> {
  if ((await page.evaluate(() => window.__creation!.design().rig.instances.length)) > 0) return
  await page.evaluate((list) => {
    for (const i of list) {
      const r = window.__creation!.dispatch(i as never)
      if (!r.ok) throw new Error('refused: ' + JSON.stringify(i))
    }
  }, READY)
}
async function testSignal(page: Page): Promise<void> {
  await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Signal de test', exact: true }).click()
  await page.waitForFunction(() => window.__creation!.audioState().state === 'playing', null, { timeout: 15_000 })
}
async function openFresh(page: Page, query: string): Promise<void> {
  await page.goto('/' + query)
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
}
/** The start screen: the profile key, then « Passer, je connais » (no tutorial): the first room opens with that profile. */
async function startAs(page: Page, query: string, key: '1' | '2' | '3' | '4'): Promise<void> {
  await openFresh(page, query)
  await page.getByTestId('start-screen').waitFor()
  await page.keyboard.press(key)
  // on `?oscar=0` the profile choice is final (no offer, no tutorial); elsewhere the offer is declined
  if (!query.includes('oscar=0')) await page.getByRole('button', { name: 'Passer, je connais', exact: true }).click()
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
  await ensureBench(page)
}

// ── who sees it, and when ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('profile 3: nothing before the first sound; then the line and three venue types, each labelled, no figure, nothing named', async ({ page }) => {
  await startAs(page, '?design=1', '3')
  await page.waitForTimeout(600)
  await expect(slot(page), 'before the sound').toHaveCount(0)
  expect(await page.locator('.cr').getAttribute('data-gear')).toBeNull()
  await testSignal(page)
  await expect(gear(page)).toBeVisible()
  await expect(page.getByTestId('own-gear-line')).toHaveText(LINE)
  const venues = page.getByTestId('own-gear-venue')
  await expect(venues).toHaveCount(3)
  for (let i = 0; i < 3; i++) {
    const v = venues.nth(i)
    await expect(v.locator('.tp-gear-venue-title')).toHaveText(VENUES[i])
    await expect(v.locator('.tp-gear-venue-label'), `card ${i} carries the label`).toHaveText(LABEL)
  }
  const text = (await gear(page).innerText()).replace(/\s+/g, ' ')
  expect(text, 'no digit in the card (no capacity, size, price, date)').not.toMatch(/\d/)
  expect(await gear(page).getAttribute('aria-label'), 'the accessible name has no digit either').not.toMatch(/\d/)
  // informational: the venue cards are not controls (nothing to press, nothing that opens a room)
  expect(await venues.locator('button, a, [role="button"], [tabindex]').count()).toBe(0)
  expect(await page.locator('.cr').getAttribute('data-gear')).toBe('on')
  // stopping the sound does not take it away (it is due from the first sound on, until dismissed)
  await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Stop', exact: true }).click()
  await expect(gear(page)).toBeVisible()
})

for (const [key, who] of [['1', 'Je découvre'], ['2', 'J’étudie le son'], ['4', 'Je travaille dans le son']] as const) {
  test(`profile ${key} (${who}): nothing after the first sound`, async ({ page }) => {
    await startAs(page, '?design=1', key)
    await testSignal(page)
    await page.waitForTimeout(1200)
    await expect(slot(page)).toHaveCount(0)
    await expect(page.getByText(LINE)).toHaveCount(0)
    expect(await page.locator('.cr').getAttribute('data-gear')).toBeNull()
  })
}

for (const query of ['?design=1&mode=exam', '?design=1&MODE=practice', '']) {
  test(`${query === '' ? 'the plain address' : query}: an entrepreneur record changes nothing (exam and plain: no onboarding, no card)`, async ({ page }) => {
    await page.goto('/' + query)
    await page.evaluate((k) => {
      window.localStorage.clear()
      window.localStorage.setItem(k, JSON.stringify({ v: 1, profile: 'projet', offer: 'skipped', request: 0, shown: [] }))
    }, ONBOARDING_KEY)
    await page.reload()
    await page.waitForFunction(() => !!window.__creation)
    await page.evaluate(() => window.__creation!.choosePlace('blank'))
    await page.waitForFunction(() => window.__creation!.place() === 'blank')
    await ensureBench(page)
    await testSignal(page)
    await page.waitForTimeout(1200)
    await expect(slot(page)).toHaveCount(0)
    expect(await page.locator('.cr').getAttribute('data-gear')).toBeNull()
  })
}

// ── independent of the guide ────────────────────────────────────────────────────────────────────────────────────────────────────

test('?oscar=0: profile 3 still gets the card (it does not come from the guide), and there is no Oscar', async ({ page }) => {
  await startAs(page, '?design=1&oscar=0', '3')
  await testSignal(page)
  await expect(gear(page)).toBeVisible()
  await expect(page.locator('.oscar-icon')).toHaveCount(0)
})

test('a muted Oscar does not change it: the card comes after the first sound, and the guide record is not touched by it', async ({ page }) => {
  await page.goto('/?design=1')
  await page.evaluate(([k, rec]) => {
    window.localStorage.clear()
    window.localStorage.setItem(k, rec)
    window.localStorage.setItem('oscar-guide.state.v1.muted', '1')
  }, [ONBOARDING_KEY, JSON.stringify({ v: 1, profile: 'projet', offer: 'skipped', request: 0, shown: [] })] as const)
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await ensureBench(page)
  await testSignal(page)
  await expect(gear(page)).toBeVisible()
  expect(await page.evaluate((k) => window.localStorage.getItem(k), GUIDE_KEY), 'no tutorial was started by it').toBeNull()
})

test('Oscar’s tutorial is unaffected: package 5, profile 3, the tutorial taken: the sound ends step 1 and the card shows without covering the step card, the icon or the bubble', async ({ page }) => {
  await openFresh(page, '?design=5')
  await page.getByTestId('start-screen').waitFor()
  await page.keyboard.press('3')
  await page.getByRole('button', { name: /^Faire le tutoriel/ }).click()
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
  await expect(page.getByTestId('tutorial-step-count')).toHaveText('Étape 1 sur 3', { timeout: 10_000 })
  await expect(slot(page)).toHaveCount(0)
  await testSignal(page)
  await expect(gear(page)).toBeVisible()
  await expect(page.getByTestId('tutorial-step-count')).toHaveText('Étape 2 sur 3', { timeout: 10_000 })
  await expect.poll(() => page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? 'null'), GUIDE_KEY)).toMatchObject({ status: 'running', k: 2, n: 3, step: 'debrancher' })
  const g = await box(slot(page))
  const step = await box(page.getByTestId('tutorial-slot'))
  const status = await box(page.getByTestId('status-bar'))
  expect(intersects(g, step), 'the two reserved rows are apart').toBe(false)
  expect(g.y + g.height).toBeLessThanOrEqual(status.y + 1)
  const icon = await page.locator('.oscar-icon').boundingBox()
  expect(icon).not.toBeNull()
  expect(intersects(icon!, g), 'Oscar’s icon is clear of the card').toBe(false)
  const bubble = page.locator('.oscar-bubble').first()
  if (await bubble.isVisible()) expect(intersects((await bubble.boundingBox())!, g), 'the bubble is clear of the card').toBe(false)
  // the tutorial goes on: the unplug is still step 2's event
  await page.evaluate(() => window.__creation!.dispatch({ type: 'UNPLUG', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } }))
  await expect(page.getByTestId('tutorial-step-count')).toHaveText('Étape 3 sur 3', { timeout: 10_000 })
})

// ── the card itself: place, behaviour, memory ─────────────────────────────────────────────────────────────────────────────────

for (const [w, h] of [[1366, 768], [1024, 768], [820, 1180]] as const) {
  test(`${w} x ${h}: the card is a reserved row above the status bar, inside the window, off the canvas centre, off Oscar; not a dialog, no trap, no animation`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await startAs(page, '?design=1', '3')
    await testSignal(page)
    await expect(gear(page)).toBeVisible()
    const s = await box(slot(page))
    const status = await box(page.getByTestId('status-bar'))
    const view = await box(page.locator('.cr-viewport'))
    const canvas = await box(page.locator('#renderCanvas'))
    expect(s.x).toBe(0)
    expect(s.width).toBe(w)
    expect(s.y + s.height, 'just above the status bar').toBeLessThanOrEqual(status.y + 1)
    expect(Math.abs(s.y + s.height - status.y), 'touching it: a row, not a float').toBeLessThanOrEqual(1)
    expect(view.y + view.height, 'under the view: the view gives up the row').toBeLessThanOrEqual(s.y + 1)
    expect(s.height, 'a strip, not a panel').toBeLessThanOrEqual(w >= 1000 ? 120 : 190)
    const centre = { x: canvas.x + canvas.width / 4, y: canvas.y + canvas.height / 4, width: canvas.width / 2, height: canvas.height / 2 }
    expect(intersects(s, centre), 'the middle half of the 3D view is clear of the card').toBe(false)
    const icon = await page.locator('.oscar-icon').boundingBox()
    if (icon) expect(intersects(icon, s), 'Oscar’s icon is clear of the card').toBe(false)
    // not a dialog, nothing inert, no animation
    expect(await gear(page).getAttribute('role')).toBeNull()
    expect(await gear(page).evaluate((e) => e.tagName)).toBe('SECTION')
    expect(await page.locator('[data-testid="gear-slot"] [role="dialog"], [data-testid="gear-slot"] [aria-modal]').count()).toBe(0)
    expect(await page.locator('[aria-modal="true"], dialog[open]').count()).toBe(0)
    expect(await page.locator('[inert]').count()).toBe(0)
    expect(await gear(page).evaluate((e) => e.getAnimations({ subtree: true }).length)).toBe(0)
    // every control of the card is inside the window
    const b = await box(page.getByTestId('own-gear-dismiss'))
    expect(b.x + b.width).toBeLessThanOrEqual(w)
    expect(b.y + b.height).toBeLessThanOrEqual(h)
  })
}

test('keyboard: Tab reaches the dismiss control (after the status bar), Escape is not hijacked (it closes a menu as before and leaves the card), Enter dismisses for good', async ({ page }) => {
  await startAs(page, '?design=1', '3')
  await testSignal(page)
  await expect(gear(page)).toBeVisible()
  const after = await page.evaluate(() => {
    const status = document.querySelector('[data-testid="status-bar"]')!
    const dismiss = document.querySelector('[data-testid="own-gear-dismiss"]')!
    return Boolean(status.compareDocumentPosition(dismiss) & Node.DOCUMENT_POSITION_FOLLOWING)
  })
  expect(after, 'its button comes after the status bar in the tab order').toBe(true)
  await page.locator('#renderCanvas').focus()
  let reached = false
  for (let i = 0; i < 60 && !reached; i++) {
    await page.keyboard.press('Tab')
    reached = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.testid === 'own-gear-dismiss')
  }
  expect(reached, 'Tab reaches the dismiss button').toBe(true)
  // Escape on the card does nothing to it
  await page.keyboard.press('Escape')
  await expect(gear(page)).toBeVisible()
  // and still closes a menu as it always did, with the card shown
  await page.locator('#cr-menu-aide').click()
  await expect(page.locator('#cr-menu-aide-panel')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('#cr-menu-aide-panel')).toBeHidden()
  await expect(gear(page)).toBeVisible()
  // Enter on the button dismisses it; the focus goes back to the 3D view, the row is freed
  await page.getByTestId('own-gear-dismiss').focus()
  await page.keyboard.press('Enter')
  await expect(slot(page)).toHaveCount(0)
  expect(await page.locator('.cr').getAttribute('data-gear')).toBeNull()
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('renderCanvas')
})

test('the dismissal is remembered in the onboarding record (every other field kept) and survives a reload: a new sound brings nothing back', async ({ page }) => {
  await startAs(page, '?design=1', '3')
  await testSignal(page)
  await page.getByTestId('own-gear-dismiss').click()
  await expect(slot(page)).toHaveCount(0)
  await expect.poll(() => record(page)).toEqual({ v: 1, profile: 'projet', offer: 'skipped', request: 0, shown: [], ownGear: 'dismissed' })
  await page.reload() // the project is kept (autosave): the room is back, the profile too
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
  await ensureBench(page)
  await testSignal(page)
  await page.waitForTimeout(1200)
  await expect(slot(page)).toHaveCount(0)
})

test('an old record (no field) is read as it always was: the card shows after a sound and the record keeps its shape until the learner dismisses it', async ({ page }) => {
  await page.goto('/?design=1')
  await page.evaluate((k) => {
    window.localStorage.clear()
    window.localStorage.setItem(k, JSON.stringify({ v: 1, profile: 'projet', offer: 'skipped', request: 0, shown: [] }))
  }, ONBOARDING_KEY)
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await ensureBench(page)
  await testSignal(page)
  await expect(gear(page)).toBeVisible()
  expect(await record(page)).toEqual({ v: 1, profile: 'projet', offer: 'skipped', request: 0, shown: [] })
})

// ── the colours in use, in every package ──────────────────────────────────────────────────────────────────────────────────────

async function colours(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const hex = (c: string): string => {
      const m = c.match(/\(([^)]+)\)/)
      if (!m) return c
      const p = m[1].split(/[,/ ]+/).filter(Boolean).map(Number)
      const v = c.startsWith('color(') ? p.slice(0, 3).map((x) => Math.round(x * 255)) : p.slice(0, 3)
      return '#' + v.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase()
    }
    const cs = (sel: string) => getComputedStyle(document.querySelector(sel)!)
    return {
      cardBg: hex(cs('[data-testid="own-gear"]').backgroundColor),
      lineFg: hex(cs('[data-testid="own-gear-line"]').color),
      titleFg: hex(cs('.tp-gear-venue-title').color),
      labelFg: hex(cs('.tp-gear-venue-label').color),
      venueBorder: hex(cs('.tp-gear-venue').borderTopColor),
      btnFg: hex(cs('[data-testid="own-gear-dismiss"]').color),
      btnBorder: hex(cs('[data-testid="own-gear-dismiss"]').borderTopColor),
    }
  })
}

for (const id of DESIGN_IDS) {
  const pkg = packageById(id)
  test(`package ${id}: the card’s colours in use are the package’s roles and pass ADR 0017 (text >= 4.5, UI >= 3), the keyboard ring is the focus role, axe finds nothing`, async ({ page }) => {
    test.setTimeout(90_000)
    await startAs(page, `?design=${id as DesignId}`, '3')
    await testSignal(page)
    await expect(gear(page)).toBeVisible()
    const c = await colours(page)
    const r = pkg.colours
    expect(c.cardBg, 'the card’s ground is the surface role').toBe(r.surface.toUpperCase())
    expect(c.lineFg, 'the line is the ink role').toBe(r.ink.toUpperCase())
    expect(c.titleFg).toBe(r.ink.toUpperCase())
    expect(c.labelFg, 'the label is the muted ink').toBe(r.inkMuted.toUpperCase())
    expect(c.venueBorder, 'a venue card is bordered in the muted ink').toBe(r.inkMuted.toUpperCase())
    expect(c.btnBorder).toBe(r.inkMuted.toUpperCase())
    const row = (what: string, fg: string, bg: string, need: number): void => {
      const ratio = contrastRatio(fg, bg)
      console.log(`CONTRAST package ${id} | own-gear card ${what} | ${fg} on ${bg} = ${ratio.toFixed(2)} (needs ${need})`)
      expect(ratio, `package ${id} ${what}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(need)
    }
    row('line text', c.lineFg, c.cardBg, 4.5)
    row('venue title text', c.titleFg, c.cardBg, 4.5)
    row('venue label text', c.labelFg, c.cardBg, 4.5)
    row('« Fermer » text', c.btnFg, c.cardBg, 4.5)
    row('venue card boundary (UI)', c.venueBorder, c.cardBg, 3)
    row('« Fermer » boundary (UI)', c.btnBorder, c.cardBg, 3)
    // never Ambre on a Papier sheet, as text or as a boundary
    for (const [k, v] of Object.entries(c)) if (pkg.layout.surfaceStyle === 'sheet') expect(v, `${k} on the sheet is not Ambre`).not.toBe('#DD9349')
    // the keyboard ring is the package's focus role, against the card (UI >= 3)
    await page.keyboard.press('Shift')
    await page.getByTestId('own-gear-dismiss').focus()
    const ring = await page.getByTestId('own-gear-dismiss').evaluate((e) => {
      const s = getComputedStyle(e)
      return { w: Number.parseFloat(s.outlineWidth), style: s.outlineStyle, color: s.outlineColor }
    })
    expect(ring.style).not.toBe('none')
    expect(ring.w).toBeGreaterThanOrEqual(2)
    const m = ring.color.match(/\(([^)]+)\)/)!
    const p = m[1].split(/[,/ ]+/).filter(Boolean).map(Number)
    const ringHex = '#' + p.slice(0, 3).map((x) => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase()
    expect(ringHex, 'the ring is the focus role').toBe(r.focus.toUpperCase())
    row('keyboard focus ring (UI)', ringHex, c.cardBg, 3)
    const a = await new AxeBuilder({ page }).include('[data-testid="gear-slot"]').analyze()
    const lines = a.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} :: ${(n.any[0]?.message ?? n.failureSummary ?? '').slice(0, 140)}`))
    expect(lines, `axe on the card, package ${id}`).toEqual([])
  })
}
