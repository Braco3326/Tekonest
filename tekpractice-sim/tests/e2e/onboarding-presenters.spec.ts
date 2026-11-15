/**
 * The presenters and package behaviour in the browser (onboarding packs, plan T6.2, spec 6.4, 6.6, 7.1, 7.2). Per package, the form named in the table is the one on screen:
 *  - the checklist « Pourquoi je n’entends rien ? » is a CHIP in the status bar that opens a dialog pop-over (packages 1, 3, 4, 5) or a PANEL docked at the foot of the Projet panel (package 2):
 *    always on the page while playback is blocked, no chip, no dialog, no focus taken, in the flow of the column (never over the 3D view); where Projet is folded or the window is phone-wide
 *    it is the chip's pop-over again, so it is never out of reach; one list element at a time (its test ids are unique);
 *  - the step card is the presenter of packages 1, 3 and 5; packages 2 and 4 hand the progress to the checklist and the card is its quiet companion (`data-presenter`);
 *  - `shortcutsBesideControls` (packages 2 and 4): a menu item shows its shortcut right beside its label; the others keep it at the end of the row;
 *  - package 4 (muted, no hint): no proactive Oscar bubble within 60 s.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { DESIGN_IDS, packageById, type DesignId } from '../../src/design/packages'
import { answerFirstQuestion, openNeutralRoomAfterAnswer } from './onboardingKit'

test.use({ viewport: { width: 1366, height: 768 } })

const start = (page: Page) => page.getByTestId('start-screen')
const chip = (page: Page) => page.getByTestId('checklist-chip')
const list = (page: Page) => page.getByTestId('checklist')

async function openFresh(page: Page, query: string): Promise<void> {
  await page.goto('/' + query)
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
}
/** « Je découvre », « Passer, je connais »: the neutral room, no tutorial. */
async function openRoom(page: Page, id: DesignId): Promise<void> {
  await openFresh(page, `?design=${id}`)
  await answerFirstQuestion(page, '1', 'click')
  await start(page).getByRole('button', { name: 'Passer, je connais', exact: true }).click()
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
}
/**
 * The checklist chip shows only while the bench cannot play. A package whose first room is the playable model (T6.3) opens a bench that plays, so the chip is hidden: unplug its two
 * line cables (what the learner could do) to give the checklist something to say; the neutral-room packages start with an empty bench and need nothing.
 */
async function blockTheBench(page: Page, id: DesignId): Promise<void> {
  if (packageById(id).layout.start !== 'playable-model') return
  await page.evaluate(() => {
    for (const [k, p] of [['k12-g', 'out-main-l'], ['k12-d', 'out-main-r']] as const) window.__creation!.dispatch({ type: 'UNPLUG', a: { instance: 'ql1', port: p }, b: { instance: k, port: 'in-line-a' } })
  })
}
const act = (page: Page, intents: unknown[]) =>
  page.evaluate((l) => {
    for (const i of l) {
      const r = window.__creation!.dispatch(i as never)
      if (!r.ok) throw new Error('refused: ' + JSON.stringify(i))
    }
  }, intents)
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
const intersects = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

// ── the checklist form named in the table ────────────────────────────────────────────────────────────────────────────────────────

for (const id of DESIGN_IDS) {
  const pkg = packageById(id)
  if (pkg.layout.checklist === 'chip')
    test(`package ${id} (${pkg.layout.checklist}): the checklist is the status bar’s chip, and its list a dialog pop-over opened from it`, async ({ page }) => {
      await openRoom(page, id)
      await blockTheBench(page, id)
      await expect(chip(page)).toBeVisible()
      await expect(list(page), 'closed: not in the page').toHaveCount(0)
      await chip(page).click()
      await expect(list(page)).toBeVisible()
      await expect(list(page)).toHaveAttribute('role', 'dialog')
      expect(await list(page).getAttribute('data-form')).toBeNull()
      expect(await page.getByTestId('project-tree').getByTestId('checklist').count(), 'not docked in the Projet panel').toBe(0)
      await page.keyboard.press('Escape')
      await expect(list(page)).toHaveCount(0)
      await expect(chip(page)).toBeFocused()
    })
  else
    test(`package ${id} (${pkg.layout.checklist}): the checklist is a PANEL docked at the foot of Projet: on the page, no chip, no dialog, no focus taken, never over the 3D view`, async ({ page }) => {
      await openRoom(page, id)
      const dock = page.getByTestId('project-tree').getByTestId('checklist')
      await expect(dock).toBeVisible()
      await expect(dock).toHaveAttribute('data-form', 'docked')
      expect(await dock.getAttribute('role'), 'a labelled region, not a dialog').toBeNull()
      expect(await dock.getAttribute('aria-labelledby')).toBe('cr-checklist-title')
      await expect(chip(page), 'no chip while the panel shows').toBeHidden()
      await expect(page.getByTestId('checklist-row-source')).toBeVisible()
      await expect(page.getByTestId('checklist-row-source')).toHaveAttribute('data-state', 'blocked')
      await expect(page.getByTestId('checklist-row-cable')).toHaveAttribute('data-state', 'unchecked')
      // it did not take the focus, it is in the flow of the Projet column (not over the 3D view), and it fits the column
      expect(await page.evaluate(() => (document.querySelector('[data-testid="checklist"]')!.contains(document.activeElement)))).toBe(false)
      const d = (await dock.boundingBox())!
      const tree = (await page.getByTestId('project-tree').boundingBox())!
      const view = (await page.locator('.cr-viewport').boundingBox())!
      expect(d.x).toBeGreaterThanOrEqual(tree.x - 1)
      expect(d.x + d.width).toBeLessThanOrEqual(tree.x + tree.width + 1)
      expect(d.y + d.height).toBeLessThanOrEqual(tree.y + tree.height + 1)
      expect(intersects(d, view), 'never over the 3D view').toBe(false)
      // Escape does nothing to a panel; the close button is not there
      await page.getByTestId('checklist-goto-source').focus()
      await page.keyboard.press('Escape')
      await expect(dock).toBeVisible()
      await expect(dock.locator('.cr-errlist-close')).toBeHidden()
      // « Aller à » still works (it opens the inventory on Consoles) and the panel stays
      await page.getByTestId('checklist-goto-source').click()
      await expect(page.getByTestId('inventory-drawer')).toHaveAttribute('data-open', 'true')
      await expect(dock).toBeVisible()
      // the list follows the bench: ready = gone, no chip either
      await act(page, READY)
      await expect(list(page)).toHaveCount(0)
      await expect(chip(page)).toBeHidden()
      // the last cable undone (the app's own undo): the list comes back, docked
      await page.evaluate(() => window.__creation!.undo())
      await expect(dock).toBeVisible()
      await expect(page.getByTestId('checklist-row-power')).toHaveAttribute('data-state', 'blocked')
    })
}

test('package 2: Projet folded, the list is the chip’s pop-over (never out of reach); unfolded, it is docked again; one list element at a time', async ({ page }) => {
  await openRoom(page, 2)
  const dock = page.getByTestId('project-tree').getByTestId('checklist')
  await expect(dock).toBeVisible()
  await page.getByTestId('tree-collapse').click()
  await expect(page.locator('.cr')).toHaveAttribute('data-tree', 'collapsed')
  await expect(dock).toHaveCount(0)
  await expect(chip(page)).toBeVisible()
  await chip(page).click()
  await expect(list(page)).toHaveAttribute('role', 'dialog')
  expect(await list(page).count(), 'one list at a time').toBe(1)
  await page.keyboard.press('Escape')
  await page.getByTestId('tree-collapse').click()
  await expect(page.locator('.cr')).toHaveAttribute('data-tree', 'open')
  await expect(dock).toBeVisible()
  await expect(chip(page)).toBeHidden()
  expect(await list(page).count()).toBe(1)
})

test('package 2 on a phone-wide window (Projet folded by the accordion): the chip form, nothing docked', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 })
  await openRoom(page, 2)
  await expect(page.locator('.cr')).toHaveAttribute('data-tree', 'collapsed')
  await expect(chip(page)).toBeVisible()
  await expect(list(page)).toHaveCount(0)
})

test('package 2 at 1024 x 768: the panel is docked in the Projet column and fits it', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await openRoom(page, 2)
  const dock = page.getByTestId('project-tree').getByTestId('checklist')
  await expect(dock).toBeVisible()
  const d = (await dock.boundingBox())!
  const tree = (await page.getByTestId('project-tree').boundingBox())!
  expect(d.x + d.width).toBeLessThanOrEqual(tree.x + tree.width + 1)
  expect(d.y + d.height).toBeLessThanOrEqual(tree.y + tree.height + 1)
})

test('package 2: axe finds nothing on the docked panel (colour contrast and the rest)', async ({ page }) => {
  await openRoom(page, 2)
  await expect(page.getByTestId('project-tree').getByTestId('checklist')).toBeVisible()
  const r = await new AxeBuilder({ page }).include('[data-testid="checklist"]').analyze()
  const lines = r.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} :: ${(n.any[0]?.message ?? n.failureSummary ?? '').slice(0, 140)}`))
  expect(lines).toEqual([])
})

test('package 2 with ?oscar=0: the panel is docked all the same (the checklist needs no guide), and no card, no Oscar', async ({ page }) => {
  await openFresh(page, '?design=2&oscar=0')
  await answerFirstQuestion(page, '1', 'click') // package 2 asks the goal screens (mission 1); with ?oscar=0 the choice is final
  await openNeutralRoomAfterAnswer(page) // no offer here: the goal's picker shows, the neutral room is opened from it
  await expect(page.getByTestId('project-tree').getByTestId('checklist')).toBeVisible()
  await expect(page.getByTestId('tutorial-slot')).toHaveCount(0)
  await expect(page.locator('.oscar-icon')).toHaveCount(0)
})

// ── the presenter named in the table ─────────────────────────────────────────────────────────────────────────────────────────────

for (const id of DESIGN_IDS) {
  const pkg = packageById(id)
  test(`package ${id}: with the tutorial on, the presenter is the ${pkg.presenter === 'step-card' ? 'step card' : 'checklist (the card is its quiet companion)'}, the checklist form is the ${pkg.layout.checklist}`, async ({ page }) => {
    await openFresh(page, `?design=${id}`)
    await answerFirstQuestion(page, '1', 'click')
    await start(page).getByRole('button', { name: /^Faire le tutoriel/ }).click()
    await page.waitForFunction(() => window.__creation?.place() === 'blank')
    await expect(page.getByTestId('tutorial-card')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('tutorial-card')).toHaveAttribute('data-presenter', pkg.presenter)
    if (pkg.layout.checklist === 'panel') {
      await expect(page.getByTestId('project-tree').getByTestId('checklist')).toBeVisible()
      await expect(chip(page)).toBeHidden()
    } else {
      await blockTheBench(page, id)
      await expect(chip(page)).toBeVisible()
      await expect(page.getByTestId('project-tree').getByTestId('checklist')).toHaveCount(0)
    }
    // the companion is quieter than the main presenter (a tighter row)
    const h = (await page.getByTestId('tutorial-slot').boundingBox())!.height
    if (pkg.presenter === 'checklist') expect(h).toBeLessThan(44)
    else expect(h).toBeGreaterThanOrEqual(44)
  })
}

// ── shortcutsBesideControls ──────────────────────────────────────────────────────────────────────────────────────────────────────

for (const id of DESIGN_IDS) {
  const pkg = packageById(id)
  test(`package ${id}: the menu shows an item’s shortcut ${pkg.layout.shortcutsBesideControls ? 'right beside its label' : 'at the end of the row (today’s look)'}`, async ({ page }) => {
    await openRoom(page, id)
    await expect(page.locator('html')).toHaveAttribute('data-shortcuts', pkg.layout.shortcutsBesideControls ? 'beside' : 'end')
    await page.locator('#cr-menu-projet').click()
    const item = page.locator('#cr-menu-projet-panel [data-item="save"]')
    await expect(item).toBeVisible()
    const m = await item.evaluate((e) => {
      const label = e.querySelector('span:first-child')!.getBoundingClientRect()
      const key = e.querySelector('.cr-shortcut')!.getBoundingClientRect()
      const row = e.getBoundingClientRect()
      return { gap: key.left - label.right, toEnd: row.right - key.right, text: e.querySelector('.cr-shortcut')!.textContent }
    })
    expect(m.text).toBeTruthy()
    if (pkg.layout.shortcutsBesideControls) expect(m.gap, 'beside the label').toBeLessThanOrEqual(24)
    else {
      expect(m.toEnd, 'at the end of the row').toBeLessThanOrEqual(16)
      expect(m.gap).toBeGreaterThan(24)
    }
  })
}

test('the plain address: the shortcut stays at the end of the row (no package attribute)', async ({ page }) => {
  await openFresh(page, '')
  expect(await page.locator('html').getAttribute('data-shortcuts')).toBeNull()
  await page.locator('#cr-menu-projet').click()
  const m = await page.locator('#cr-menu-projet-panel [data-item="save"]').evaluate((e) => {
    const key = e.querySelector('.cr-shortcut')!.getBoundingClientRect()
    return { toEnd: e.getBoundingClientRect().right - key.right }
  })
  expect(m.toEnd).toBeLessThanOrEqual(16)
})

// ── package 4: no proactive Oscar within 60 s ────────────────────────────────────────────────────────────────────────────────────────

/** Samples the page every 3 s for 60 s: Oscar's bubble stays shut and nothing new is said (`.oscar-live` unchanged). */
async function noProactiveBubble(page: Page, label: string): Promise<void> {
  const read = () =>
    page.evaluate(() => {
      const b = document.querySelector('.oscar-bubble') as HTMLElement | null
      return { hidden: b === null ? true : b.hidden, live: document.querySelector('.oscar-live')?.textContent ?? '' }
    })
  // positive control (T6a S5): the sampler can see a bubble. A click on Oscar's icon (a learner's action) opens it: read() must change; then it is closed again and the baseline is taken
  const before = await read()
  await page.locator('.oscar-icon').click()
  await expect.poll(async () => JSON.stringify(await read()), { message: `${label}: the sampler must see the bubble open` }).not.toBe(JSON.stringify(before))
  expect((await read()).hidden, `${label}: opened by the learner`).toBe(false)
  await page.locator('.oscar-bubble .oscar-close').click()
  await expect.poll(async () => (await read()).hidden).toBe(true)
  const first = await read()
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(3000)
    const now = await read()
    expect(now.hidden, `${label}: bubble closed at ${(i + 1) * 3} s`).toBe(first.hidden)
    expect(now.live, `${label}: nothing new said at ${(i + 1) * 3} s`).toBe(first.live)
  }
}

test('package 4 (muted, no hint): no proactive Oscar bubble within 60 s of a bench change (no tutorial)', async ({ page }) => {
  test.setTimeout(120_000)
  await openRoom(page, 4)
  await act(page, [spawn('yamaha-ql1', 'ql1', 0), spawn('qsc-k12-2', 'k12', -1)])
  await expect(page.locator('.oscar-icon')).toBeVisible()
  const first = await page.evaluate(() => ({ hidden: (document.querySelector('.oscar-bubble') as HTMLElement | null)?.hidden ?? true }))
  expect(first.hidden).toBe(true)
  await noProactiveBubble(page, 'package 4')
})

test('package 4 (hintAfterMs 0): in the tutorial on its power step, with the bubble closed by the learner, nothing is raised in 60 s and the helper stays locked', async ({ page }) => {
  test.setTimeout(150_000)
  await openFresh(page, '?design=4')
  await answerFirstQuestion(page, '1', 'click')
  await start(page).getByRole('button', { name: /^Faire le tutoriel/ }).click()
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
  await expect(page.getByTestId('tutorial-card')).toBeVisible({ timeout: 10_000 })
  const steps: unknown[][] = [
    [spawn('yamaha-ql1', 'ql1', 0)],
    [spawn('shure-sm58', 'sm58', 0.8)],
    [spawn('qsc-k12-2', 'k12', -1)],
    [connect('ql1', 'out-main-l', 'k12', 'in-line-a')],
    [connect('sm58', 'out-xlr', 'ql1', 'in-mic-1')],
    [{ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }],
    [spawn('multiprise-secteur', 'strip', 0.4)],
  ]
  for (const [k, s] of steps.entries()) {
    await act(page, s)
    await expect(page.getByTestId('tutorial-step-count')).toHaveText(`Étape ${k + 2} sur 10`, { timeout: 10_000 })
  }
  await page.locator('.oscar-bubble .oscar-close').click()
  await expect(page.locator('.oscar-bubble')).toBeHidden()
  await noProactiveBubble(page, 'package 4, step 8')
  const rec = await page.evaluate(() => JSON.parse(window.localStorage.getItem('oscar-guide.onboarding.v1') ?? 'null'))
  expect(rec).toMatchObject({ status: 'running', step: 'courant-console', helper: false })
})
