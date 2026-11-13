/**
 * The tutorial's step card in the browser (onboarding packs, plan T6.1, spec 6.6, 9, 11.1 to 11.3; G8 review S2 / C2). Progress only, in a RESERVED row of the shell grid
 * (`[data-testid="tutorial-slot"]`) that exists while a tutorial runs and leaves with it.
 *
 * Pinned, in all five packages: the slot is a full-width row under the menu bar and above the view, the panels and the status bar (nothing overlaps it: not the 3D view, the
 * drawer, the panels, Oscar's icon or bubble); the card is a labelled region, not a dialog (no `aria-modal`, nothing inert, no focus trap, no animation), its button comes after the status
 * bar in the tab order; it says « Étape k sur n » (n = 10 for every package today), one mark per step (current, to come, then done / « passée » / « montré » / « déjà en place » with a key
 * under the row), and never the bubble's sentence nor « réussi »; after the last step it shows `closingLines()` (`listen.simple`, then the mic line or the engine's NO_MIC text) with a
 * « Fermer » button; « Passer le tutoriel » frees the row at once; Aide « Reprendre à l’étape k » focuses the card; a reload keeps the step; nothing on the plain address, `?oscar=0` or
 * an exam address; the colours in use pass ADR 0017 (text >= 4.5, UI >= 3, axe) in every package.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { COPY } from '../../src/creation/copy'
import { contrastRatio } from '../../src/design/creationTokens'
import { DESIGN_IDS, packageById, type DesignId } from '../../src/design/packages'
import { TUTORIAL_ROW_PX } from '../../src/design/tutorialSlot'

test.use({ viewport: { width: 1366, height: 768 } })

const GUIDE_KEY = 'oscar-guide.onboarding.v1'
const live = (page: Page) => page.locator('.oscar-live')
const slot = (page: Page) => page.getByTestId('tutorial-slot')
const card = (page: Page) => page.getByTestId('tutorial-card')
const count = (page: Page) => page.getByTestId('tutorial-step-count')
const dots = (page: Page) => page.getByTestId('tutorial-steps').locator('li')
const guideRecord = (page: Page) => page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? 'null'), GUIDE_KEY)
const states = (page: Page): Promise<string[]> => dots(page).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.state ?? ''))

async function openFresh(page: Page, query: string): Promise<void> {
  await page.goto('/' + query)
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
}
/** « Je découvre », then « Faire le tutoriel » on `?design=id`: the neutral room opens and the request goes up. */
async function takeTutorial(page: Page, id: DesignId = 1): Promise<void> {
  await openFresh(page, `?design=${id}`)
  await page.getByTestId('start-screen').getByRole('button', { name: 'Je découvre', exact: true }).click()
  await page.getByTestId('start-screen').getByRole('button', { name: /^Faire le tutoriel/ }).click()
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
  await expect(card(page)).toBeVisible({ timeout: 10_000 })
}
const act = (page: Page, intents: unknown[]) =>
  page.evaluate((list) => {
    for (const i of list) {
      const r = window.__creation!.dispatch(i as never)
      if (!r.ok) throw new Error('refused: ' + JSON.stringify(i))
    }
  }, intents)
const spawn = (deviceId: string, instanceId: string, x: number) => ({ type: 'SPAWN', deviceId, instanceId, position: [x, 0, 0] })
const connect = (a: string, ap: string, b: string, bp: string) => ({ type: 'CONNECT', a: { instance: a, port: ap }, b: { instance: b, port: bp } })
const SETUP = {
  console: [spawn('yamaha-ql1', 'ql1', 0)],
  micro: [spawn('shure-sm58', 'sm58', 0.8)],
  enceinte: [spawn('qsc-k12-2', 'k12', -1)],
  consoleEnceinte: [connect('ql1', 'out-main-l', 'k12', 'in-line-a')],
  microConsole: [connect('sm58', 'out-xlr', 'ql1', 'in-mic-1')],
  lecture: [{ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }],
  multiprise: [spawn('multiprise-secteur', 'strip', 0.4)],
  courantConsole: [connect('strip', 'out-1', 'ql1', 'power-in')],
  courantEnceinte: [connect('strip', 'out-2', 'k12', 'power-in')],
}
async function testSignal(page: Page): Promise<void> {
  await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Signal de test', exact: true }).click()
  await page.waitForFunction(() => window.__creation!.audioState().state === 'playing' && window.__creation!.audioState().source === 'test', null, { timeout: 15_000 })
}
const oscarChip = (page: Page, name: string) => page.locator('.oscar-chips').getByRole('button', { name, exact: true })
const box = async (l: Locator) => (await l.boundingBox())!
const intersects = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

// ── the slot and the card, in every package ───────────────────────────────────────────────────────────────────────────────────

for (const id of DESIGN_IDS) {
  const pkg = packageById(id)
  test(`package ${id}: the card sits in the reserved row, overlaps nothing, is no dialog, traps no focus, runs no animation`, async ({ page }) => {
    await takeTutorial(page, id)
    await expect(count(page)).toHaveText('Étape 1 sur 10')
    await expect(page.locator('.cr')).toHaveAttribute('data-tutorial', 'on')
    await expect(card(page)).toHaveAttribute('data-presenter', pkg.presenter)

    // geometry: a full-width row between the menu bar and the (view, panels), above the status bar
    const s = await box(slot(page))
    const menu = await box(page.getByTestId('menubar'))
    const view = await box(page.locator('.cr-viewport'))
    const tree = await box(page.getByTestId('project-tree'))
    const props = await box(page.getByTestId('properties'))
    const status = await box(page.getByTestId('status-bar'))
    expect(s.x).toBe(0)
    expect(s.width).toBe(1366)
    expect(Math.abs(s.y - (menu.y + menu.height))).toBeLessThanOrEqual(1)
    for (const below of [view, tree, props]) expect(below.y, 'view and panels start under the slot').toBeGreaterThanOrEqual(s.y + s.height - 1)
    expect(s.y + s.height).toBeLessThanOrEqual(status.y)
    expect(s.height, 'a calm row, not a panel; never above what the first-sound framing reserves for it').toBeLessThanOrEqual(TUTORIAL_ROW_PX)
    const c = await box(card(page))
    expect(c.x).toBeGreaterThanOrEqual(0)
    expect(c.x + c.width).toBeLessThanOrEqual(1366)
    expect(c.y).toBeGreaterThanOrEqual(s.y - 1)
    expect(c.y + c.height).toBeLessThanOrEqual(s.y + s.height + 1)
    // Oscar's icon and bubble never cover it (spec 11.3: rectangle intersection, not centres)
    await expect(live(page)).toContainText('étape 1 sur 10', { timeout: 10_000 })
    const icon = await page.locator('.oscar-icon').boundingBox()
    expect(icon).not.toBeNull()
    expect(intersects(icon!, c), 'the icon is clear of the card').toBe(false)
    const bubble = page.locator('.oscar-bubble').first()
    if (await bubble.isVisible()) expect(intersects((await bubble.boundingBox())!, c), 'the bubble is clear of the card').toBe(false)

    // not a dialog, nothing inert, no modal (the inventory drawer is the app's own non-modal dialog, aria-modal="false")
    expect(await card(page).getAttribute('role')).toBeNull()
    expect(await card(page).getAttribute('aria-label')).toBe('Progression du tutoriel')
    expect(await page.locator('[data-testid="tutorial-slot"] [role="dialog"], [data-testid="tutorial-slot"] [aria-modal]').count()).toBe(0)
    expect(await page.locator('[aria-modal="true"], dialog[open]').count()).toBe(0)
    expect(await page.locator('[inert]').count()).toBe(0)
    // its button comes after the status bar in the tab order, and Tab leaves it (no trap)
    const after = await page.evaluate(() => {
      const status = document.querySelector('[data-testid="status-bar"]')!
      const skip = document.querySelector('[data-testid="tutorial-skip"]')!
      return Boolean(status.compareDocumentPosition(skip) & Node.DOCUMENT_POSITION_FOLLOWING)
    })
    expect(after).toBe(true)
    await page.getByTestId('tutorial-skip').focus()
    const visited = new Set<string>()
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      visited.add(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.outerHTML.slice(0, 80) ?? ''))
    }
    expect(visited.size, 'Tab keeps moving: no focus trap').toBeGreaterThan(1)
    // no animation, ever (calm): nothing animating on the card
    expect(await card(page).evaluate((e) => e.getAnimations({ subtree: true }).length)).toBe(0)
  })
}

test('DOM parity (spec 11.1): the same slot and card landmarks and test ids in all five packages', async ({ page }) => {
  test.setTimeout(150_000)
  const seen: string[] = []
  for (const id of DESIGN_IDS) {
    await takeTutorial(page, id)
    seen.push(
      JSON.stringify(
        await page.evaluate(() => ({
          slot: document.querySelectorAll('[data-testid="tutorial-slot"]').length,
          ids: [...document.querySelectorAll('[data-testid="tutorial-slot"] [data-testid]')].map((e) => e.getAttribute('data-testid')),
          region: document.querySelector('[data-testid="tutorial-card"]')!.tagName,
          dots: document.querySelectorAll('[data-testid="tutorial-steps"] li').length,
        })),
      ),
    )
  }
  expect(new Set(seen).size, seen.join('\n')).toBe(1)
  expect(JSON.parse(seen[0])).toMatchObject({ slot: 1, region: 'SECTION', dots: 10, ids: ['tutorial-card', 'tutorial-step-count', 'tutorial-steps', 'tutorial-skip', 'tutorial-legend', 'tutorial-closing'] })
})

// ── what it shows ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('progress only: « Étape k sur n », one mark per step, never the bubble’s sentence nor « réussi », no figure but k and n', async ({ page }) => {
  await takeTutorial(page)
  await expect(live(page)).toContainText('étape 1 sur 10', { timeout: 10_000 })
  expect(await states(page)).toEqual(['current', ...Array(9).fill('todo')])
  await act(page, SETUP.console)
  await expect(count(page)).toHaveText('Étape 2 sur 10')
  expect(await states(page)).toEqual(['done', 'current', ...Array(8).fill('todo')])
  await expect(page.getByTestId('tutorial-legend')).toBeHidden() // all plain: no key needed
  const text = (await card(page).innerText()).replace(/\s+/g, ' ')
  for (const sentence of Object.values(COPY.tutorial!)) expect(text).not.toContain(sentence.slice(0, 25))
  expect(text).not.toMatch(/réussi|bravo|parfait/i)
  // every digit on the card is a step number or the count: the marks 2 to 10, the count « 2 » and « 10 » (no minutes, no dB, no other figure)
  expect(text.replace(/Étape 2 sur 10/g, '').match(/\d+/g)?.every((n) => Number(n) >= 1 && Number(n) <= 10) ?? true).toBe(true)
  // a mark names itself to assistive tech
  await expect(dots(page).nth(0)).toContainText('Étape 1 : faite')
  await expect(dots(page).nth(1)).toContainText('Étape 2 : en cours')
  await expect(dots(page).nth(2)).toContainText('Étape 3 : à venir')
})

test('« passée » (the bubble’s « Passer cette étape »), « déjà en place » (the result was on the bench): a mark each, and a key under the row names them', async ({ page }) => {
  await takeTutorial(page)
  await expect(live(page)).toContainText('étape 1 sur 10', { timeout: 10_000 })
  await act(page, SETUP.console)
  await expect(live(page)).toContainText('étape 2 sur 10', { timeout: 10_000 })
  await oscarChip(page, 'Passer cette étape').click() // step 2 (the mic) passed
  await expect(count(page)).toHaveText('Étape 3 sur 10')
  expect(await states(page)).toEqual(['done', 'passed', 'current', ...Array(7).fill('todo')])
  const key = page.getByTestId('tutorial-legend')
  await expect(key).toBeVisible()
  await expect(key).toContainText('faite')
  await expect(key).toContainText('passée')
  await expect(key).not.toContainText('montré')
  // the key sits on the card's one row: the row does not grow (the first-sound framing reserves TUTORIAL_ROW_PX for it)
  expect((await box(slot(page))).height).toBeLessThanOrEqual(TUTORIAL_ROW_PX)
  await expect(dots(page).nth(1)).toContainText('Étape 2 : passée')
  expect((await guideRecord(page)).passed).toEqual(['micro'])
  // the speaker and the console-to-speaker cable placed BEFORE their steps: both read « déjà en place » once the steps pass them
  await act(page, SETUP.enceinte)
  await expect(count(page)).toHaveText('Étape 4 sur 10', { timeout: 10_000 })
  expect(await states(page)).toEqual(['done', 'passed', 'done', 'current', ...Array(6).fill('todo')])
  // « déjà en place »: the learner cables the console to the speaker and places the strip while step 4 is current; step 5 is the mic cable (passed, no mic): skip; step 6 is the playback
  await act(page, [...SETUP.consoleEnceinte, ...SETUP.lecture])
  await expect(count(page)).toHaveText('Étape 5 sur 10', { timeout: 10_000 })
  await oscarChip(page, 'Passer cette étape').click()
  await expect(count(page)).toHaveText('Étape 7 sur 10', { timeout: 10_000 }) // step 6 (« Lecture console ») was already on: completed, not asked
  expect(await states(page)).toEqual(['done', 'passed', 'done', 'done', 'passed', 'early', 'current', 'todo', 'todo', 'todo'])
  await expect(key).toContainText('déjà en place')
  expect((await guideRecord(page)).early).toEqual(['lecture-console'])
})

test('« montré »: the steps the power helper did read « montré », never a tick', async ({ page }) => {
  await takeTutorial(page)
  await expect(live(page)).toContainText('étape 1 sur 10', { timeout: 10_000 })
  for (const [k, intents] of [SETUP.console, SETUP.micro, SETUP.enceinte, SETUP.consoleEnceinte, SETUP.microConsole, SETUP.lecture, SETUP.multiprise].entries()) {
    await act(page, intents)
    await expect(live(page)).toContainText(`étape ${k + 2} sur 10`, { timeout: 10_000 })
  }
  await oscarChip(page, 'Montre-moi').click()
  await expect.poll(() => guideRecord(page)).toMatchObject({ helper: true })
  await page.getByTestId('checklist-chip').click()
  await page.getByTestId('checklist-power').click()
  await expect(count(page)).toHaveText('Étape 10 sur 10', { timeout: 10_000 })
  expect(await states(page)).toEqual([...Array(7).fill('done'), 'shown', 'shown', 'current'])
  await expect(page.getByTestId('tutorial-legend')).toContainText('montré')
  await expect(dots(page).nth(7)).toContainText('Étape 8 : montré')
})

// ── after the last step: closingLines() (G8 review S2 / C2) ────────────────────────────────────────────────────────────────────

test('after the last step: listen.simple, then the checklist’s mic line (a mic cabled); a « Fermer » button frees the row', async ({ page }) => {
  await takeTutorial(page)
  await expect(live(page)).toContainText('étape 1 sur 10', { timeout: 10_000 })
  for (const [k, intents] of [SETUP.console, SETUP.micro, SETUP.enceinte, SETUP.consoleEnceinte, SETUP.microConsole, SETUP.lecture, SETUP.multiprise, SETUP.courantConsole, SETUP.courantEnceinte].entries()) {
    await act(page, intents)
    await expect(live(page)).toContainText(`étape ${k + 2} sur 10`, { timeout: 10_000 })
  }
  await expect(page.getByTestId('tutorial-closing')).toBeHidden() // nothing is claimed before a sound plays
  await testSignal(page)
  const closing = page.getByTestId('tutorial-closing')
  await expect(closing).toBeVisible({ timeout: 10_000 })
  await expect(count(page)).toHaveText(COPY.tutorialCard!.closingTitle)
  await expect(closing.locator('p')).toHaveText([COPY.listen!.simple, COPY.checklist!.micCabled])
  expect(await states(page)).toEqual(Array(10).fill('done'))
  await expect(page.getByTestId('tutorial-skip')).toHaveText('Fermer')
  const text = await card(page).innerText()
  expect(text).not.toMatch(/réussi|bravo|parfait|correct/i)
  // the learner closes it: the slot leaves the page, the row is freed
  await page.getByTestId('tutorial-skip').click()
  await expect(slot(page)).toHaveCount(0)
  await expect(page.locator('.cr')).not.toHaveAttribute('data-tutorial', /.*/)
  expect((await guideRecord(page)).status).toBe('done')
  // a finished tutorial shows no card after a reload (the closing card is for the page that ended it)
  await page.reload()
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
  await page.waitForTimeout(1500)
  await expect(slot(page)).toHaveCount(0)
})

test('a mic never cabled (its two steps passed): the closing lines are listen.simple and the engine’s own NO_MIC text, verbatim; the two steps read « passée »', async ({ page }) => {
  await takeTutorial(page)
  await expect(live(page)).toContainText('étape 1 sur 10', { timeout: 10_000 })
  await act(page, SETUP.console)
  await expect(live(page)).toContainText('étape 2 sur 10', { timeout: 10_000 })
  await oscarChip(page, 'Passer cette étape').click() // the mic
  await expect(live(page)).toContainText('étape 3 sur 10', { timeout: 10_000 })
  await act(page, SETUP.enceinte)
  await act(page, SETUP.consoleEnceinte)
  await expect(live(page)).toContainText('étape 5 sur 10', { timeout: 10_000 })
  await oscarChip(page, 'Passer cette étape').click() // the mic cable
  await expect(live(page)).toContainText('étape 6 sur 10', { timeout: 10_000 })
  for (const [k, intents] of [SETUP.lecture, SETUP.multiprise, SETUP.courantConsole, SETUP.courantEnceinte].entries()) {
    await act(page, intents)
    await expect(live(page)).toContainText(`étape ${k + 7} sur 10`, { timeout: 10_000 })
  }
  await testSignal(page)
  await expect(page.getByTestId('tutorial-closing')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('tutorial-closing').locator('p')).toHaveText([COPY.listen!.simple, COPY.playback!.noMic])
  expect(await states(page)).toEqual(['done', 'passed', 'done', 'done', 'passed', 'done', 'done', 'done', 'done', 'done'])
})

// ── leaving, resuming, absent ────────────────────────────────────────────────────────────────────────────────────────────────

test('« Passer le tutoriel » removes the slot at once and frees the row; Aide offers « Premiers pas » again; the focus returns to the 3D view', async ({ page }) => {
  await takeTutorial(page)
  const before = await box(page.locator('.cr-viewport'))
  await page.getByTestId('tutorial-skip').click()
  await expect(slot(page)).toHaveCount(0)
  await expect(card(page)).toHaveCount(0)
  await expect(page.locator('.cr')).not.toHaveAttribute('data-tutorial', /.*/)
  const after = await box(page.locator('.cr-viewport'))
  const menu = await box(page.getByTestId('menubar'))
  expect(Math.abs(after.y - (menu.y + menu.height)), 'the view takes its row back').toBeLessThanOrEqual(1)
  expect(after.height).toBeGreaterThan(before.height)
  await expect.poll(() => guideRecord(page)).toMatchObject({ status: 'skipped', step: null })
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('renderCanvas')
  await page.locator('#cr-menu-aide').click()
  await expect(page.getByRole('menuitem', { name: 'Premiers pas', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  // it does not come back by itself
  await page.waitForTimeout(1200)
  await expect(slot(page)).toHaveCount(0)
})

test('Aide › « Reprendre à l’étape k » focuses the card', async ({ page }) => {
  await takeTutorial(page)
  await expect(live(page)).toContainText('étape 1 sur 10', { timeout: 10_000 })
  await act(page, [...SETUP.console, ...SETUP.micro])
  await expect(count(page)).toHaveText('Étape 3 sur 10')
  await page.locator('#cr-menu-aide').click()
  await page.getByRole('menuitem', { name: 'Reprendre à l’étape 3', exact: true }).click()
  await expect(card(page)).toBeFocused()
  await expect(live(page)).toContainText('étape 3 sur 10', { timeout: 10_000 })
  await page.waitForTimeout(800) // the guide answers the request (a poll): the card keeps the focus
  await expect(card(page)).toBeFocused()
})

test('a reload at step 4: the card is back with the same step', async ({ page }) => {
  await takeTutorial(page)
  await expect(live(page)).toContainText('étape 1 sur 10', { timeout: 10_000 })
  await act(page, [...SETUP.console, ...SETUP.micro, ...SETUP.enceinte])
  await expect(count(page)).toHaveText('Étape 4 sur 10')
  await page.reload()
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
  await expect(card(page)).toBeVisible({ timeout: 10_000 })
  await expect(count(page)).toHaveText('Étape 4 sur 10')
  expect(await states(page)).toEqual(['done', 'done', 'done', 'current', ...Array(6).fill('todo')])
})

for (const [name, query] of [
  ['the plain address (no ?design)', ''],
  ['?design=1&oscar=0', '?design=1&oscar=0'],
  ['an exam address (?design=1&mode=exam)', '?design=1&mode=exam'],
] as const)
  test(`${name}: no slot and no card, ever`, async ({ page }) => {
    await openFresh(page, query)
    if (query.includes('oscar=0')) {
      await page.getByTestId('start-screen').getByRole('button', { name: 'Je découvre', exact: true }).click()
      await page.waitForFunction(() => window.__creation?.place() === 'blank')
    }
    await page.waitForTimeout(1500)
    await expect(slot(page)).toHaveCount(0)
    await expect(card(page)).toHaveCount(0)
    await expect(page.locator('.cr')).not.toHaveAttribute('data-tutorial', /.*/)
  })

test('C1 (T6a review): the address turns to an exam one while a tutorial runs (pushState), then the bench changes: no slot, no card, no data-tutorial; the positive control shows the card on ?design=1', async ({ page }) => {
  await takeTutorial(page)
  await expect(slot(page)).toHaveCount(1) // positive control: ?design=1 shows the card
  await expect(card(page)).toBeVisible()
  await page.evaluate(() => window.history.pushState(null, '', '/?design=1&mode=exam'))
  await act(page, SETUP.console)
  await expect(slot(page)).toHaveCount(0)
  await expect(card(page)).toHaveCount(0)
  await expect(page.locator('.cr')).not.toHaveAttribute('data-tutorial', /.*/)
  await act(page, SETUP.micro)
  await page.waitForTimeout(1500) // later polls: still nothing
  await expect(slot(page)).toHaveCount(0)
  await expect(page.locator('.oscar-icon')).toHaveCount(0)
})

// ── tablet and the colours in use ─────────────────────────────────────────────────────────────────────────────────────────────

for (const vp of [
  { width: 1024, height: 768 },
  { width: 820, height: 1180 },
]) {
  test(`at ${vp.width} x ${vp.height} the card stays in its row (marks wrap under the count), clear of the view, with the button at a comfortable size`, async ({ page }) => {
    await page.setViewportSize(vp)
    await takeTutorial(page, 3)
    await expect(count(page)).toHaveText('Étape 1 sur 10')
    const c = await box(card(page))
    const view = await box(page.locator('.cr-viewport'))
    expect(c.x).toBeGreaterThanOrEqual(0)
    expect(c.x + c.width).toBeLessThanOrEqual(vp.width)
    expect(c.y + c.height).toBeLessThanOrEqual(view.y + 1)
    expect(await card(page).evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true)
    expect(c.height).toBeLessThanOrEqual(120)
    const btn = await box(page.getByTestId('tutorial-skip'))
    expect(btn.height).toBeGreaterThanOrEqual(24)
    expect(btn.x + btn.width).toBeLessThanOrEqual(vp.width)
    if (vp.width <= 900) {
      const cnt = await box(count(page))
      const row = await box(page.getByTestId('tutorial-steps'))
      expect(row.y, 'the marks wrap under the count on a tablet').toBeGreaterThanOrEqual(cnt.y + cnt.height - 1)
    }
  })
}
interface Computed {
  cardFg: string
  cardBg: string
  line: string
  curFg: string
  curBg: string
  curBorder: string
  doneFg: string
  doneBg: string
  skipFg: string
  skipBorder: string
  skipBg: string
  passedBorder: string
  todoBorder: string
}
const readColour = (page: Page, css: string): Promise<string> =>
  page.evaluate((c) => {
    const m = c.match(/\(([^)]+)\)/)
    if (!m) return c
    const parts = m[1].split(/[,/ ]+/).filter(Boolean)
    if (c.startsWith('color(')) parts.shift() // the colour space
    const p = parts.map(Number)
    const v = c.startsWith('color(') ? p.slice(0, 3).map((x) => Math.round(x * 255)) : p.slice(0, 3)
    return '#' + v.map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase()
  }, css)
/** `rgb(...)` / `color(srgb ...)` to `#RRGGBB` in the page. */
const readColours = (page: Page): Promise<Computed> =>
  page.evaluate(() => {
    const hex = (c: string): string => {
      const m = c.match(/\(([^)]+)\)/)
      if (!m) return c
      const p = m[1].split(/[,/ ]+/).filter(Boolean).map(Number)
      const v = c.startsWith('color(') ? p.slice(0, 3).map((x) => Math.round(x * 255)) : p.slice(0, 3)
      return '#' + v.map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase()
    }
    const cs = (sel: string) => getComputedStyle(document.querySelector(sel)!)
    const dot = (state: string) => `[data-testid="tutorial-steps"] li[data-state="${state}"]`
    return {
      cardFg: hex(cs('[data-testid="tutorial-card"]').color),
      cardBg: hex(cs('[data-testid="tutorial-card"]').backgroundColor),
      line: hex(cs('[data-testid="tutorial-card"]').borderBottomColor),
      curFg: hex(cs(dot('current')).color),
      curBg: hex(cs(dot('current')).backgroundColor),
      curBorder: hex(cs(dot('current')).borderTopColor),
      doneFg: hex(cs(dot('done')).color),
      doneBg: hex(cs(dot('done')).backgroundColor),
      skipFg: hex(cs('[data-testid="tutorial-skip"]').color),
      skipBorder: hex(cs('[data-testid="tutorial-skip"]').borderTopColor),
      skipBg: hex(cs('[data-testid="tutorial-skip"]').backgroundColor),
      passedBorder: hex(cs(dot('passed')).borderTopColor),
      todoBorder: hex(cs(dot('todo')).borderTopColor),
    }
  })

for (const id of DESIGN_IDS) {
  test(`package ${id}: the card’s colours in use pass ADR 0017 (text >= 4.5, UI >= 3) and axe finds nothing on it`, async ({ page }) => {
    test.setTimeout(90_000)
    await takeTutorial(page, id)
    await expect(live(page)).toContainText('étape 1 sur 10', { timeout: 10_000 })
    await act(page, SETUP.console)
    await expect(live(page)).toContainText('étape 2 sur 10', { timeout: 10_000 })
    await oscarChip(page, 'Passer cette étape').click() // a « passée » mark, so every state wears its colours
    await expect(count(page)).toHaveText('Étape 3 sur 10')
    const c = await readColours(page)
    const row = (what: string, fg: string, bg: string, need: number): void => {
      const r = contrastRatio(fg, bg)
      console.log(`CONTRAST package ${id} | step card ${what} | ${fg} on ${bg} = ${r.toFixed(2)} (needs ${need})`)
      expect(r, `package ${id} ${what}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(need)
    }
    // S3 (T6a review): a Papier sheet (surfaceStyle 'sheet', package 3) gets a Papier card with Nuit text and Prune marks, not a second dark header; the others keep the secondary fill
    const sheet = packageById(id).layout.surfaceStyle === 'sheet'
    expect(c.cardBg.toUpperCase(), `package ${id}: the card's ground`).toBe((sheet ? packageById(id).colours.ground : packageById(id).colours.secondary).toUpperCase())
    if (sheet) {
      expect(c.cardFg.toUpperCase(), 'Nuit text on the Papier card').toBe(packageById(id).colours.ink.toUpperCase())
      expect(c.doneBg.toUpperCase(), 'a done mark is a Prune fill').toBe(packageById(id).colours.select.toUpperCase())
      expect(c.curBorder.toUpperCase(), 'the current step is edged in Nuit, never Ambre on Papier').toBe(packageById(id).colours.accentEdge.toUpperCase())
    }
    row('text', c.cardFg, c.cardBg, 4.5)
    row('current step, text on the accent fill', c.curFg, c.curBg, 4.5)
    // the current step's boundary: its Ambre fill where Ambre is legible on the card; on a Papier sheet (Ambre 2.16 there) the 2 px edge in the accent edge role
    row(sheet ? 'current step, 2 px edge against the card' : 'current step, fill against the card', sheet ? c.curBorder : c.curBg, c.cardBg, 3)
    row('done step, mark against its fill', c.doneBg, c.doneFg, 3) // the tick (the card's own fill) on the ink fill
    row('done step, fill against the card', c.doneBg, c.cardBg, 3)
    row('« Passer le tutoriel », text', c.skipFg, c.cardBg, 4.5)
    row('« Passer le tutoriel », edge (UI)', c.skipBorder, c.cardBg, 3)
    row('a step to come, outline (UI)', c.todoBorder, c.cardBg, 3)
    row('a step passed, dashed outline (UI)', c.passedBorder, c.cardBg, 3)
    // the keyboard ring on the card's button: the shell's ring over its Nuit halo, against the card
    await page.keyboard.press('Shift')
    await page.getByTestId('tutorial-skip').focus()
    const ring = await page.getByTestId('tutorial-skip').evaluate((e) => {
      const s = getComputedStyle(e)
      return { w: s.outlineWidth, c: s.outlineColor, style: s.outlineStyle }
    })
    expect(ring.style).not.toBe('none')
    expect(Number.parseFloat(ring.w)).toBeGreaterThanOrEqual(2)
    const ringHex = (await readColour(page, ring.c)) // the keyboard ring against the card it sits on (UI >= 3): never Ambre on Papier
    row('keyboard focus ring (UI)', ringHex, c.cardBg, 3)
    const r = await new AxeBuilder({ page }).include('[data-testid="tutorial-slot"]').analyze()
    const lines = r.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} :: ${(n.any[0]?.message ?? n.failureSummary ?? '').slice(0, 140)}`))
    expect(lines, `axe on the card, package ${id}`).toEqual([])
  })
}

test('the first-sound framing counts the card’s row: with the tutorial taken, the camera radius is the framing for the canvas AS IT IS once the row is there (the SM58 keeps its pixels)', async ({ page }) => {
  await takeTutorial(page, 1)
  await expect(page.getByTestId('tutorial-slot')).toBeVisible()
  await page.waitForFunction(() => !window.__creation!.cameraMoving())
  const m = await page.evaluate(() => ({ h: document.getElementById('renderCanvas')!.clientHeight, radius: window.__creation!.camera()!.radius }))
  expect(m.radius).toBeCloseTo(Math.max(2, (packageById(1).framing.radius * m.h) / 600), 1)
})
