/**
 * Task 28: the « Connecter à… » dialog in detail (CA-02, C10). The keyboard-only walk through the whole reference rig is
 * creation-keyboard-patch.spec.ts; this file holds the dialog's own behaviour: the collapsed « Incompatibles » group, Échap and
 * focus return, the scene inert behind it, held keys, a rig that changes under it, one polite announcement, the empty state, axe.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })

type Ref = { instance: string; port: string }
const MIC2: Ref = { instance: 'ql1', port: 'in-mic-2' }
const OUT_L: Ref = { instance: 'ql1', port: 'out-main-l' }
const OUT_R: Ref = { instance: 'ql1', port: 'out-main-r' }

/** Four devices in the concert hall, no cable, ql1 selected (through `]`, as a learner would). */
const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] })
    c.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58', position: [2, 0, 8] })
    c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [3, 0, -3] })
    c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-d', position: [-3, 0, -3] })
  })
  await select(page, 'ql1')
}
/** The .glb models arrive after the placeholders and move the ports: wait until the page has stopped rendering. */
const settle = async (page: Page): Promise<void> => {
  let last = -1
  for (let i = 0; i < 40; i++) {
    const n = await page.evaluate(() => window.__creation!.renders())
    if (n === last) return
    last = n
    await page.waitForTimeout(700)
  }
  throw new Error('the page never went idle')
}
const select = async (page: Page, id: string): Promise<void> => {
  await page.locator('#renderCanvas').focus()
  for (let i = 0; i < 8 && (await page.evaluate(() => window.__creation!.selection())) !== id; i++) await page.keyboard.press(']')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe(id)
}
const connections = async (page: Page) => (await page.evaluate(() => window.__creation!.design())).rig.connections
const undoSize = (page: Page) => page.evaluate(() => window.__creation!.historySize())
const opener = (page: Page, port: string) => page.locator(`[data-key="connect:${port}"]`)
const dialog = (page: Page) => page.getByTestId('cr-connect-dialog')
const filter = (page: Page) => page.getByRole('combobox', { name: 'Filtrer' })
/** Focus the row's button and press Entrée on it: the dialog opens with the filter focused. */
const open = async (page: Page, port: string): Promise<void> => {
  await opener(page, port).focus()
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toBeVisible()
  await expect(filter(page)).toBeFocused()
}

test('closed: the page has no dialog node, and a free port\'s row has « Connecter à… » while a cabled one has « Débrancher »', async ({ page }) => {
  await boot(page)
  await expect(dialog(page)).toHaveCount(0)
  await expect(opener(page, 'out-main-l')).toHaveText('Connecter à…')
  await expect(opener(page, 'out-main-l')).toHaveAccessibleName('Connecter à… (depuis out-main-l)')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'CONNECT', a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }))
  const row = page.locator('[data-key="port:in-mic-1"]')
  await expect(opener(page, 'in-mic-1')).toHaveCount(0)
  await expect(row.getByRole('button', { name: /^Débrancher in-mic-1 de/ })).toBeVisible()
  // a cabled row says its cable in text (Task 27 carry-over): both ends and the signal type's French name, output end first
  await expect(row).toContainText('sm58 out-xlr → ql1 in-mic-1 · Niveau micro')
  await expect(row).toHaveAccessibleName('in-mic-1 · XLR3 femelle · Niveau micro · branché à SM58 (sm58) · out-xlr')
  await expect(row.getByRole('button', { name: /^Débrancher/ })).toHaveAccessibleDescription(/sm58 out-xlr → ql1 in-mic-1 · Niveau micro/)
})

test('an incompatible port sits in the collapsed « Incompatibles » group with its reason, and is not selectable', async ({ page }) => {
  await boot(page)
  await open(page, 'out-main-l')
  await expect(page.getByTestId('connect-count')).toHaveText('2 prises compatibles.') // k12-g and k12-d in-line-a
  const options = dialog(page).getByRole('option')
  await expect(options).toHaveCount(2)
  const toggle = page.getByTestId('connect-rejected-toggle')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toHaveText(/^Incompatibles \(\d+\)$/)
  await expect(page.getByTestId('connect-rejected')).toBeHidden()
  // the group opens with the keyboard (Tab from the field), and says why
  await page.keyboard.press('Tab')
  await expect(toggle).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  const power = page.getByTestId('connect-rejected').getByRole('listitem').filter({ hasText: '(k12-g) · power-in' })
  await expect(power).toContainText('Connecteurs incompatibles')
  const thru = page.getByTestId('connect-rejected').getByRole('listitem').filter({ hasText: '(k12-g) · thru-out-a' })
  await expect(thru).toContainText('Sens de connexion incorrect')
  // never an option
  for (const o of await options.all()) await expect(o).not.toContainText('power-in')
  await expect(dialog(page).getByRole('option', { name: /power-in|thru-out-a/ })).toHaveCount(0)
  // typing only the incompatible one: nothing to choose, Entrée connects nothing, the reason stays listed
  await filter(page).focus()
  await page.keyboard.type('k12-g power-in')
  await expect(page.getByTestId('connect-count')).toHaveText('Aucune prise ne correspond à « k12-g power-in ».')
  await expect(options).toHaveCount(0)
  await expect(filter(page)).not.toHaveAttribute('aria-activedescendant', /./)
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  expect(await connections(page)).toHaveLength(0)
  await expect(dialog(page)).toBeVisible()
  await expect(power).toBeVisible()
})

test('arrows move the active option across groups; Entrée connects THAT one, as one undo entry announced « Connecté : … »', async ({ page }) => {
  await boot(page)
  await open(page, 'out-main-r')
  const options = dialog(page).getByRole('option')
  await expect(options.first()).toHaveAttribute('aria-selected', 'true') // the first is active at once
  await page.keyboard.press('ArrowDown')
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(options.first()).toHaveAttribute('aria-selected', 'false')
  await expect(filter(page)).toHaveAttribute('aria-activedescendant', (await options.nth(1).getAttribute('id'))!)
  await page.keyboard.press('ArrowDown') // the end: stays
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
  const base = await undoSize(page)
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toBeHidden()
  expect(await connections(page)).toEqual([{ a: OUT_R, b: { instance: 'k12-d', port: 'in-line-a' } }])
  expect(await undoSize(page)).toBe(base + 1)
  await expect(page.locator('.cr-status-msg')).toHaveText(/^Connecté : .*ql1.*out-main-r.* à .*k12-d.*in-line-a\. .* pour annuler\.$/)
  // the cable is one undo
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+z')
  expect(await connections(page)).toHaveLength(0)
})

test('a pointer user can pick an option too (click connects)', async ({ page }) => {
  await boot(page)
  await open(page, 'out-main-l')
  await page.keyboard.type('k12-d')
  await dialog(page).getByRole('option').click()
  await expect(dialog(page)).toBeHidden()
  expect(await connections(page)).toEqual([{ a: OUT_L, b: { instance: 'k12-d', port: 'in-line-a' } }])
})

test('Échap closes without connecting and gives focus back to the button that opened it; nothing stays listening', async ({ page }) => {
  await boot(page)
  await open(page, 'out-main-l')
  await page.keyboard.type('k12')
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
  await expect(opener(page, 'out-main-l')).toBeFocused()
  expect(await connections(page)).toHaveLength(0)
  // also from the « Incompatibles » toggle and from « Annuler »
  await open(page, 'out-main-l')
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('connect-rejected-toggle')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(opener(page, 'out-main-l')).toBeFocused()
  await open(page, 'out-main-l')
  await page.getByRole('button', { name: 'Annuler' }).focus()
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toHaveCount(0)
  await expect(opener(page, 'out-main-l')).toBeFocused()
  // released: a rig change now says nothing about a closed dialog
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58b', position: [5, 0, 8] }))
  await expect(page.locator('.cr-status-msg')).not.toContainText('Connecter à… fermé')
})

test('Tab stays natural in the dialog (field, group toggle, Annuler, round again) and the shell behind is inert', async ({ page }) => {
  await boot(page)
  await open(page, 'out-main-l')
  const inDialog = () => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') != null)
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    expect(await inDialog(), `Tab ${i + 1} stays in the dialog`).toBe(true)
  }
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Shift+Tab')
    expect(await inDialog(), `Shift+Tab ${i + 1} stays in the dialog`).toBe(true)
  }
  expect(await page.evaluate(() => document.querySelector('[data-testid="viewport"]')?.closest('[inert]') != null)).toBe(true)
  expect(await page.evaluate(() => document.querySelector('[data-testid="properties"]')?.closest('[inert]') != null)).toBe(true)
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => document.querySelector('[data-testid="viewport"]')?.closest('[inert]') != null)).toBe(false)
})

test('the 3D scene is inert behind the dialog: no pointer patch starts, no miss toast, the selection stays', async ({ page }) => {
  await boot(page)
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await settle(page)
  const p = await page.evaluate((r) => window.__creation!.portScreen(r), MIC2)
  expect(p, 'the ql1 in-mic-2 port is on screen').not.toBeNull()
  // A press and release on the canvas at the port, as the pointer would deliver them (the dialog's box may cover that point,
  // so the events go straight to the canvas: what is under test is that the patch controller is inert while the dialog is open).
  const press = () =>
    page.evaluate(({ x, y }) => {
      const canvas = document.getElementById('renderCanvas')!
      const init = { clientX: x, clientY: y, button: 0, isPrimary: true, pointerId: 7, pointerType: 'mouse', bubbles: true }
      canvas.dispatchEvent(new PointerEvent('pointerdown', init))
      canvas.dispatchEvent(new PointerEvent('pointerup', init))
    }, p!)
  await open(page, 'out-main-l')
  await press()
  expect(await page.evaluate(() => window.__creation!.patchPending())).toBeNull()
  // A real pointer press outside the dialog's box lands on its backdrop: no toast (a miss), no selection change, no cable.
  const canvas = (await page.locator('#renderCanvas').boundingBox())!
  await page.mouse.click(canvas.x + canvas.width - 8, canvas.y + canvas.height - 8)
  await expect(page.getByTestId('toast')).toBeHidden()
  await expect(filter(page)).toBeFocused() // the press did not blur the dialog: Échap below still reaches it
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  expect(await connections(page)).toHaveLength(0)
  await expect(dialog(page)).toBeVisible() // a press on the backdrop neither closes it nor connects
  await page.keyboard.press('Escape')
  // control: a real click on the same port IS a patch click once the dialog is gone (the test cannot pass vacuously)
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await settle(page)
  const now = await page.evaluate((r) => window.__creation!.portScreen(r), MIC2) // the press above may have framed the device: read the port again
  await page.mouse.click(now!.x, now!.y)
  expect(await page.evaluate(() => window.__creation!.patchPending())).toEqual(MIC2)
})

test('a held Entrée never connects: the press that opened the dialog, or a hold on an option, makes at most ONE cable', async ({ page }) => {
  await boot(page)
  // Entrée held on the button: keydown opens the dialog, the repeats land on the field and must do nothing.
  await opener(page, 'out-main-l').focus()
  await page.keyboard.down('Enter')
  await page.keyboard.down('Enter')
  await page.keyboard.down('Enter')
  await page.keyboard.up('Enter')
  await expect(dialog(page)).toBeVisible()
  expect(await connections(page)).toHaveLength(0)
  // a fresh press connects; a hold (an even number of keydowns) after it adds nothing more
  const base = await undoSize(page)
  await page.keyboard.down('Enter')
  await page.keyboard.down('Enter')
  await page.keyboard.down('Enter')
  await page.keyboard.down('Enter')
  await page.keyboard.up('Enter')
  await expect(dialog(page)).toBeHidden()
  expect(await connections(page)).toHaveLength(1)
  expect(await undoSize(page)).toBe(base + 1)
  // and the held key did not reach the buttons it left behind (focus is on the row, not on a « Débrancher »)
  await expect(page.locator('[data-key="port:out-main-l"]')).toBeFocused()
})

test('a held Entrée on « Débrancher » removes the cable once (focus leaves the button as it acts), not in a loop', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'CONNECT', a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }))
  const unplug = page.getByRole('button', { name: /^Débrancher in-mic-1/ })
  await unplug.focus()
  const base = await undoSize(page)
  await page.keyboard.down('Enter')
  await page.keyboard.down('Enter')
  await page.keyboard.down('Enter')
  await page.keyboard.up('Enter')
  expect(await connections(page)).toHaveLength(0)
  expect(await undoSize(page)).toBe(base + 1)
})

test('a rig that changes under the open dialog closes it, says so, and nothing stale is dispatched', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await boot(page)
  // 1. an undo (of the last SPAWN, k12-d) while the dialog is open
  await open(page, 'out-main-l')
  await page.keyboard.type('k12-d')
  await expect(dialog(page).getByRole('option')).toHaveCount(1)
  await page.evaluate(() => window.__creation!.undo())
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.locator('.cr-status-msg')).toContainText('Connecter à… fermé : le matériel a changé')
  expect(await connections(page)).toHaveLength(0)
  // focus is back on the opener, and reopening lists the current rig only
  await expect(opener(page, 'out-main-l')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toBeVisible()
  await page.keyboard.type('k12-d')
  await expect(dialog(page).getByRole('option')).toHaveCount(0)
  await page.keyboard.press('Escape')
  // 2. the target's device removed while open
  await open(page, 'out-main-l')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'REMOVE', instanceId: 'k12-g' }))
  await expect(dialog(page)).toHaveCount(0)
  expect(await connections(page)).toHaveLength(0)
  // 3. a place change: focus goes to the 3D canvas (the rig the dialog was about is gone), never <body> or a panel row
  await open(page, 'out-main-l')
  await page.evaluate(() => window.__creation!.choosePlace('room:radio-talk-studio-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:radio-talk-studio-medium')
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.locator('#renderCanvas')).toBeFocused()
  expect(await page.evaluate(() => window.__creation!.design().rig.connections.length)).toBe(0)
  expect(errors).toEqual([])
})

test('« Connecté : … » is a polite status, said once, and not again when the panel re-renders', async ({ page }) => {
  await boot(page)
  const status = page.locator('.cr-status-msg')
  expect(await status.getAttribute('role')).toBe('status')
  expect(await status.getAttribute('aria-live')).not.toBe('assertive')
  await status.evaluate((el) => {
    const w = window as unknown as { __said: string[] }
    w.__said = []
    new MutationObserver(() => w.__said.push(el.textContent ?? '')).observe(el, { childList: true, characterData: true, subtree: true })
  })
  await open(page, 'out-main-l')
  await page.keyboard.type('k12-g')
  await page.keyboard.press('Enter')
  await expect(status).toContainText('Connecté : ')
  // re-renders: another selection and back, a pose edit, an undo and redo
  await select(page, 'k12-g')
  await select(page, 'ql1')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_POSE', instanceId: 'ql1', position: [0.5, 0, 8], yawDeg: 0, tiltDeg: 0, mount: 'floor' }))
  await page.waitForTimeout(400)
  const said = await page.evaluate(() => (window as unknown as { __said: string[] }).__said)
  expect(said.filter((t) => t.startsWith('Connecté : ')), `heard: ${JSON.stringify(said)}`).toHaveLength(1)
})

test('empty state: with nothing compatible and free, the dialog says so and Entrée does nothing', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => {
    const c = window.__creation!
    for (const id of ['ql1', 'k12-g', 'k12-d']) c.dispatch({ type: 'REMOVE', instanceId: id })
  })
  await select(page, 'sm58')
  await open(page, 'out-xlr')
  await expect(page.getByTestId('connect-count')).toHaveText('Aucune prise compatible n’est libre.')
  await expect(dialog(page).getByRole('option')).toHaveCount(0)
  await expect(page.getByTestId('connect-rejected-toggle')).toBeHidden()
  await page.keyboard.press('Enter')
  expect(await connections(page)).toHaveLength(0)
  await expect(dialog(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(opener(page, 'out-xlr')).toBeFocused()
})

test('accessibility: no serious or critical axe violation on the open dialog (group expanded) nor on Connexions', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'CONNECT', a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }))
  const bad = (r: Awaited<ReturnType<AxeBuilder['analyze']>>) => r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  const panel = await new AxeBuilder({ page }).include('[data-testid="properties"]').disableRules(['region']).analyze()
  expect(bad(panel).map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
  // a long list scrolls inside the dialog: axe must still be content (a scroll region needs a keyboard way in)
  await page.evaluate(() => {
    for (let i = 0; i < 14; i++) window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: `k12-x${i}`, position: [i, 0, -6] })
  })
  await open(page, 'out-main-l')
  expect(await page.getByTestId('connect-list').evaluate((el) => el.scrollHeight > el.clientHeight), 'the list overflows').toBe(true)
  await page.getByTestId('connect-rejected-toggle').focus()
  await page.keyboard.press('Enter') // expand « Incompatibles »
  await expect(page.getByTestId('connect-rejected')).toBeVisible()
  const dlg = await new AxeBuilder({ page }).include('[data-testid="cr-connect-dialog"]').disableRules(['region']).analyze()
  expect(bad(dlg).map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
  // with the whole page too: the shell behind is inert, the dialog is the only live tree
  const all = await new AxeBuilder({ page }).exclude('#renderCanvas').disableRules(['region']).analyze()
  expect(bad(all).map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
})

test('every control of the dialog has a visible focus ring, square corners and no transition', async ({ page }) => {
  await boot(page)
  await open(page, 'out-main-l')
  const style = (sel: string) =>
    page.evaluate((s) => {
      const el = document.querySelector(s) as HTMLElement
      const cs = getComputedStyle(el)
      return { outlineW: parseFloat(cs.outlineWidth), outlineStyle: cs.outlineStyle, shadow: cs.boxShadow, radius: cs.borderTopLeftRadius, transition: cs.transitionDuration }
    }, sel)
  for (const sel of ['[data-testid="connect-filter"]', '[data-testid="connect-rejected-toggle"]', '[data-testid="connect-cancel"]']) {
    await page.locator(sel).focus()
    const s = await style(sel)
    expect(s.outlineStyle, sel).not.toBe('none')
    expect(s.outlineW, sel).toBeGreaterThanOrEqual(2)
    expect(s.shadow, `${sel} Nuit ring`).not.toBe('none')
    expect(s.radius, sel).toBe('0px')
    expect(parseFloat(s.transition), `${sel} transition`).toBeLessThanOrEqual(0.001) // 0 s, or the reduced-motion floor
  }
  await page.keyboard.press('Escape')
  // the row's new button too
  await opener(page, 'out-main-l').focus()
  const s = await style('[data-key="connect:out-main-l"]')
  expect(s.outlineW).toBeGreaterThanOrEqual(2)
  expect(parseFloat(s.transition)).toBeLessThanOrEqual(0.001)
})

test('narrow window: the dialog fits a 390 px wide screen and its list scrolls inside', async ({ page }) => {
  await boot(page)
  await open(page, 'out-main-l')
  await page.setViewportSize({ width: 390, height: 700 })
  const box = (await dialog(page).boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  expect(box.y + box.height).toBeLessThanOrEqual(700)
  await page.screenshot({ path: process.env.TK_SHOT_DIR ? `${process.env.TK_SHOT_DIR}/connect-narrow.png` : 'test-results/connect-narrow.png' })
})

test('a press on a group heading, the count line or the text keeps focus in the field: the arrows and Échap still work', async ({ page }) => {
  await boot(page)
  await open(page, 'out-main-r')
  const options = dialog(page).getByRole('option')
  for (const target of [dialog(page).locator('.cr-connect-group-title').first(), page.getByTestId('connect-count'), dialog(page).locator('.cr-dialog-title'), dialog(page).locator('.cr-dialog-body')]) {
    await target.click()
    await expect(filter(page)).toBeFocused()
  }
  await page.keyboard.press('ArrowDown')
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
  await expect(opener(page, 'out-main-r')).toBeFocused()
})

test('where focus goes when the rig changes under the dialog: the opener while it still stands, else the Propriétés title, never <body> nor the row of another device', async ({ page }) => {
  await boot(page)
  const active = () => page.evaluate(() => ({ tag: document.activeElement?.tagName ?? null, cls: document.activeElement?.className ?? '', key: (document.activeElement as HTMLElement | null)?.dataset?.key ?? null }))
  // 1. a change that leaves ql1's panel as it was (k12-d removed): the opener is still the opener
  await open(page, 'out-main-l')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'REMOVE', instanceId: 'k12-d' }))
  await expect(dialog(page)).toHaveCount(0)
  await expect(opener(page, 'out-main-l')).toBeFocused()
  // 2. a change that rebuilds the panel (this very port is cabled from elsewhere): the opener is gone, focus is the panel's title
  await open(page, 'out-main-l')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } }))
  await expect(dialog(page)).toHaveCount(0)
  await expect(opener(page, 'out-main-l')).toHaveCount(0)
  expect(await active()).toMatchObject({ cls: expect.stringContaining('cr-props-title') })
  await expect(page.getByTestId('properties').getByRole('heading', { name: 'Yamaha QL1' })).toBeFocused()
  // 3. the device the dialog was opened from leaves the rig: the panel says « Aucune sélection » and that title takes focus
  await open(page, 'out-main-r')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'REMOVE', instanceId: 'ql1' }))
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByTestId('properties').getByRole('heading', { name: 'Aucune sélection' })).toBeFocused()
})
