/**
 * Night wave 2, item G: the Écoute block reads as one calm action.
 *  - « Écoute depuis : {point}. » above the button (the point chosen, « Ici », or the walk camera);
 *  - « Lecture » / « Stop » is the primary action: ▶ / ■ drawn by CSS with an empty alternative, Ambre fill when it can start, a dashed edge when it cannot;
 *  - one honest sentence always on screen, the rest of the limits under a closed « Limites de la simulation » (nothing removed);
 *  - each meter on two lines (the sentence assistive tech reads stays complete, in one place).
 */
import { expect, test, type Page } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })

const boot = async (page: Page, opts: { powered?: boolean } = {}): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 5)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  if (opts.powered === false) return
  const ok = await page.evaluate(() => {
    const c = window.__creation!
    return [
      c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } }).ok,
      c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-r' }, b: { instance: 'k12-d', port: 'in-line-a' } }).ok,
      c.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }).ok,
    ]
  })
  expect(ok).toEqual([true, true, true])
}
const menu = async (page: Page, name: string, opts: { force?: boolean } = {}): Promise<void> => {
  await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
  await expect(page.locator('#cr-menu-ecoute-panel')).toBeVisible()
  await page.getByRole('menuitem', { name, exact: true }).click({ force: opts.force }) // an aria-disabled item still answers (it says why it cannot)
}
const tokenColor = (page: Page, token: string): Promise<string> =>
  page.evaluate((t) => {
    const probe = document.createElement('span')
    probe.style.color = `var(${t})`
    document.body.appendChild(probe)
    const c = getComputedStyle(probe).color
    probe.remove()
    return c
  }, token)
/** The block is made on the first valid « Lecture » (a menu item that cannot start only says why): play once and stop, to have it on screen, stopped. */
const showBlock = async (page: Page): Promise<void> => {
  await menu(page, 'Lecture')
  await page.waitForFunction(() => window.__creation!.audioState().state === 'playing', null, { timeout: 15_000 })
  await menu(page, 'Stop')
  await page.waitForFunction(() => window.__creation!.audioState().state === 'stopped', null, { timeout: 10_000 })
  await expect(page.getByTestId('listen-panel')).toBeVisible()
}
const btn = (page: Page) => page.getByTestId('listen-transport')
const glyph = (page: Page) => btn(page).evaluate((e) => getComputedStyle(e, '::before').content)

test('« Écoute depuis : … » names the point, follows a chosen point while stopped, « Ici » and the walk camera', async ({ page }) => {
  await boot(page)
  await showBlock(page)
  const from = page.getByTestId('listen-from')
  await expect(from).toHaveText('Écoute depuis : Régie.')
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('2')
  await expect(from).toHaveText('Écoute depuis : Premier rang.')
  await page.keyboard.press('3')
  await expect(from).toHaveText('Écoute depuis : Fond de salle.')
  await menu(page, 'Écouter depuis ici')
  await expect(from).toHaveText('Écoute depuis : Ici.')
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Shift+V')
  await expect(from).toHaveText('Écoute depuis : la caméra de marche.')
  await page.keyboard.press('Shift+V')
  await expect(from).toHaveText('Écoute depuis : Ici.')
})

test('the button is the primary action: Ambre fill and ▶ when it can start, a dashed muted edge when it cannot, outline and ■ while it plays; always named by its word', async ({ page }) => {
  await boot(page)
  await showBlock(page)
  // the chain breaks (no playback source on the console): the button cannot start, and says so by its look as well as by aria-disabled
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: false }))
  await expect(btn(page)).toHaveAttribute('aria-disabled', 'true')
  const off = await btn(page).evaluate((e) => {
    const c = getComputedStyle(e)
    return { style: c.borderTopStyle, bg: c.backgroundColor, color: c.color }
  })
  expect(off.style).toBe('dashed')
  expect(off.bg).toBe('rgba(0, 0, 0, 0)')
  expect(off.color).toBe(await tokenColor(page, '--cr-ink-muted'))
  expect(await glyph(page)).toContain('▶')
  await expect(page.getByRole('button', { name: 'Lecture', exact: true })).toHaveCount(1) // the glyph is not in the name (empty alternative)
  // the chain is valid again
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }))
  await expect(btn(page)).not.toHaveAttribute('aria-disabled', 'true')
  const on = await btn(page).evaluate((e) => {
    const c = getComputedStyle(e)
    return { style: c.borderTopStyle, bg: c.backgroundColor, color: c.color }
  })
  expect(on.style).toBe('solid')
  expect(on.bg).toBe(await tokenColor(page, '--cr-ambre'))
  expect(on.color).toBe(await tokenColor(page, '--cr-nuit'))
  await btn(page).click()
  await page.waitForFunction(() => window.__creation!.audioState().state === 'playing', null, { timeout: 15_000 })
  await expect(btn(page)).toHaveText('Stop')
  await page.mouse.move(2, 2) // off the button: its hover look is another state
  expect(await glyph(page)).toContain('■')
  expect(await btn(page).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toHaveCount(1)
  await btn(page).click()
  await page.waitForFunction(() => window.__creation!.audioState().state === 'stopped', null, { timeout: 10_000 })
  await expect(btn(page)).toHaveText('Lecture')
})

test('the limits: one honest sentence on screen, the rest of them under a closed « Limites de la simulation », nothing removed', async ({ page }) => {
  await boot(page)
  await menu(page, 'Lecture')
  await page.waitForFunction(() => window.__creation!.audioState().state === 'playing', null, { timeout: 15_000 })
  await expect(page.getByTestId('listen-simple')).toHaveText('Simulation simple : niveau relatif, volume normalisé, retard et placement gauche-droite d’après la géométrie. Ni acoustique de salle, ni réponse en fréquence, ni réflexions.')
  const box = page.getByTestId('listen-limits-box')
  await expect(box).not.toHaveAttribute('open', '')
  await expect(page.getByTestId('listen-limits-title')).toHaveText('Limites de la simulation')
  await expect(page.getByTestId('listen-limits-more')).toBeHidden()
  await expect(page.getByTestId('listen-limits')).toBeHidden()
  await page.getByTestId('listen-limits-title').click()
  await expect(box).toHaveAttribute('open', '')
  await expect(page.getByTestId('listen-limits-more')).toBeVisible()
  await expect(page.getByTestId('listen-limits')).toContainText('la moyenne de ses deux côtés')
  await expect(page.getByTestId('listen-limits')).toContainText('effet Doppler')
  await expect(page.getByTestId('listen-limits-more')).toContainText('Le volume est normalisé')
  await expect(page.getByTestId('listen-limits-more')).toContainText('diaphonie')
  // the safety and privacy lines are not folded
  await expect(page.getByTestId('listen-volume')).toBeVisible()
  await expect(page.getByTestId('listen-local')).toBeVisible()
  // keyboard: the summary is a tab stop that Entrée toggles
  await page.getByTestId('listen-limits-title').focus()
  await page.keyboard.press('Enter')
  await expect(box).not.toHaveAttribute('open', '')
  await menu(page, 'Stop')
})

test('each meter is two lines (name and level in Papier, the rest muted), and its sentence for assistive tech is complete and in one place', async ({ page }) => {
  await boot(page)
  await menu(page, 'Lecture')
  await page.waitForFunction(
    () => {
      const l = window.__creation!.audioLevels()
      return (l['k12-g'] ?? 0) > 0 && (l['k12-d'] ?? 0) > 0
    },
    null,
    { timeout: 15_000 }
  )
  const row = page.getByTestId('listen-meters').locator('li[data-instance="k12-g"]')
  await expect(row.locator('.cr-listen-meter-main')).toHaveText(/^QSC K12\.2 \(k12-g\) : −?\d+,\d dBFS$/)
  await expect(row.locator('.cr-listen-meter-sub')).toHaveText(/^gain 0,0 dB · retard 0,0 ms · pan gauche \d+ %$/)
  const a = (await row.locator('.cr-listen-meter-main').boundingBox())!
  const b = (await row.locator('.cr-listen-meter-sub').boundingBox())!
  expect(b.y, 'the second line is below the first').toBeGreaterThanOrEqual(a.y + a.height - 1)
  expect(await row.locator('.cr-listen-meter-main').evaluate((e) => getComputedStyle(e).color)).toBe(await tokenColor(page, '--cr-papier'))
  expect(await row.locator('.cr-listen-meter-sub').evaluate((e) => getComputedStyle(e).color)).toBe(await tokenColor(page, '--cr-ink-muted'))
  // the drawn lines are hidden from assistive tech; the full sentence is read, once
  expect(await row.locator('.cr-listen-meter-view').getAttribute('aria-hidden')).toBe('true')
  const spoken = row.locator('.cr-listen-meter-text')
  await expect(spoken).toHaveText(/^QSC K12\.2 \(k12-g\) : niveau de sortie −?\d+,\d dBFS, gain 0,0 dB, retard 0,0 ms, pan gauche \d+ %$/)
  expect(await spoken.evaluate((e) => !e.closest('[aria-hidden="true"]'))).toBe(true)
  await menu(page, 'Stop')
})
