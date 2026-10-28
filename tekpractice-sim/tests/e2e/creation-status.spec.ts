import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import catalog from '../../content/catalog.json'

/** Task 29 (CA-15): the rule texts are the catalog's French fields, pinned exactly. */
const RULE = (id: string) => catalog.rules.find((r) => r.id === id)!
test.use({ viewport: { width: 1366, height: 768 } })

/** Task 14 (CA-15, CA-16, C17): status bar, persistent error list, signal count = RuleEvaluator errors. */
const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 5)
  // Task 32: the template also holds its power strip `mains` and three mains cables. This spec is about the signal cables and
  // needs the power-in ports free, so it takes the strip away (the powered rig is held by creation-keyboard-patch, the SceneHost
  // test and the powered-rig test of creation-cables.spec.ts).
  await page.evaluate(() => window.__creation!.dispatch({ type: 'REMOVE', instanceId: 'mains' }))
  await page.waitForFunction(() => window.__creation!.design().rig.instances.length === 4)
}
const label = (page: Page) => page.getByTestId('signal-label')
const expectCountMatchesEvents = async (page: Page): Promise<void> => {
  const { n, cables } = await page.evaluate(() => ({ n: window.__creation!.events().filter((e) => e.severity === 'error').length, cables: window.__creation!.design().rig.connections.length }))
  // L5: « Signal OK » only for a playable chain (playbackReady, Task 34); until then 0 errors is neutral.
  await expect(label(page)).toHaveText(n === 1 ? '1 erreur' : n > 1 ? `${n} erreurs` : cables === 0 ? 'Rien de branché' : 'Aucune erreur détectée')
  await expect(page.getByTestId('signal-status')).toHaveAttribute('data-kind', n > 0 ? 'errors' : 'neutral')
}
const REFUSED = { a: { instance: 'k12-g', port: 'power-in' }, b: { instance: 'ql1', port: 'in-mic-2' } }

test('(a) the signal label always equals the RuleEvaluator error count', async ({ page }) => {
  await boot(page)
  await expect(page.getByRole('contentinfo')).toHaveAttribute('data-testid', 'status-bar')
  await expectCountMatchesEvents(page)
  await expect(label(page)).toHaveText('Aucune erreur détectée') // the template has 1 cable, playbackReady is not fed yet
  // A condenser without +48 V (R4): one error.
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'neumann-u87-ai', instanceId: 'u87', position: [1, 0, -8] })
    c.dispatch({ type: 'SPAWN', deviceId: 'focusrite-isa-one', instanceId: 'isa', position: [2, 0, -8] })
    c.dispatch({ type: 'CONNECT', a: { instance: 'u87', port: 'out-xlr' }, b: { instance: 'isa', port: 'in-mic' } })
  })
  expect(await page.evaluate(() => window.__creation!.events().filter((e) => e.severity === 'error').length)).toBeGreaterThan(0)
  await expectCountMatchesEvents(page)
  await expect(page.getByTestId('signal-status')).toHaveAttribute('data-kind', 'errors')
  await expect(page.getByRole('status')).toHaveText('Signal : 1 erreur') // said, not only shown
  // Undo the cable: back to no error.
  await page.evaluate(() => window.__creation!.undo())
  await expectCountMatchesEvents(page)
  await expect(page.getByRole('status')).toHaveText('Signal : Aucune erreur détectée')
  await expect(page.getByTestId('signal-status')).not.toContainText('Signal OK')
  // Selection line (brief wording); no snapping text until placement snapping exists.
  await expect(page.getByTestId('status-selection')).toHaveText('Aucune sélection')
  await expect(page.getByTestId('status-snapping')).toBeHidden()
  // Empty rig → « Rien de branché ».
  await page.evaluate(() => window.__creation!.dispatch({ type: 'UNPLUG', a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }))
  await expect(label(page)).toHaveText('Rien de branché')
})

test('(b)(c) a refused CONNECT is listed first, persists, selects its device; a later valid CONNECT clears it', async ({ page }) => {
  await boot(page)
  const r = await page.evaluate((i) => window.__creation!.dispatch({ type: 'CONNECT', ...i }), REFUSED)
  expect(r.ok).toBe(false)
  await expect(page.getByRole('status')).toHaveText('Connexion refusée : Sens de connexion incorrect')
  await expectCountMatchesEvents(page) // a refusal changes nothing in the rig: not counted
  await expect(page.getByTestId('signal-extra')).toContainText('connexion refusée')

  const btn = page.getByTestId('signal-status')
  await expect(btn).not.toHaveAttribute('aria-controls', /.+/) // only while the list exists
  await btn.click()
  await expect(btn).toHaveAttribute('aria-controls', 'cr-error-list')
  const dialog = page.getByRole('dialog', { name: 'Erreurs et avertissements' })
  await expect(dialog).toBeVisible()
  const rows = dialog.locator('.cr-errlist-row')
  await expect(rows.first()).toHaveAttribute('data-severity', 'rejection')
  await expect(rows.first()).toContainText('Connexion refusée :')
  await expect(rows.first()).toContainText(RULE('R3').title_fr)
  await expect(rows.first()).toContainText(RULE('R3').teach_fr)
  await expect(rows.first()).not.toContainText(RULE('R3').teach) // never the English text
  await expect(rows.first()).toContainText('K12.2')
  // Focus moved into the pop-over; Échap closes it and focus returns to the button.
  await expect(rows.first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(btn).toBeFocused()

  // Persistent, not a toast.
  await page.waitForTimeout(10_000)
  await btn.click()
  await expect(rows.first()).toHaveAttribute('data-severity', 'rejection')
  await expect(page).toHaveTitle(/Mode Création/)
  const axe = await new AxeBuilder({ page }).include('[data-testid="error-list"]').include('[data-testid="status-bar"]').analyze()
  expect(axe.violations.map((v) => v.id)).toEqual([])

  await rows.first().click()
  await expect(dialog).toBeHidden()
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('k12-g')
  await expect(page.getByTestId('status-selection')).toContainText('Sélection : ')
  await expect(page.getByTestId('status-selection')).toContainText('(k12-g)')

  // (c) a valid CONNECT clears the refusal row.
  const ok = await page.evaluate(() =>
    window.__creation!.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } }),
  )
  expect(ok.ok).toBe(true)
  await expect(page.getByTestId('signal-extra')).toHaveText('')
  await btn.click()
  await expect(dialog.locator('.cr-errlist-row[data-severity="rejection"]')).toHaveCount(0)
})

test('the autosave state shows in the status bar: Modifié → Enregistré', async ({ page }) => {
  await boot(page)
  const save = page.getByTestId('status-autosave')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58-2', position: [2, 0, -8] }))
  await expect(save).toHaveText('Sauvegarde auto : Modifié')
  await expect(save).toHaveText('Sauvegarde auto : Enregistré', { timeout: 5000 })
})

test('« kept-full »: closing the note leaves a persistent paused line with « Exporter… » in the status bar', async ({ page }) => {
  // 5 quarantined items (the cap) + an unreadable autosave: it cannot be set aside, the autosave stops until the export.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    const items = [0, 1, 2, 3, 4].map((i) => ({ at: 't', key: 'audio-sim/creation.v1', reason: 'corrupt', raw: `old${i}` }))
    localStorage.setItem('audio-sim/creation.v1.quarantine', JSON.stringify({ version: 1, items }))
    localStorage.setItem('audio-sim/creation.v1', '{sixth')
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await expect(page.getByTestId('note-kept-full')).toBeVisible()
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await page.getByTestId('note-kept-full').getByRole('button', { name: 'Fermer la note' }).click()
  const line = page.getByTestId('status-autosave-paused')
  await expect(line).toBeVisible()
  await expect(line).toContainText('Sauvegarde automatique en pause : exportez')
  const action = page.getByTestId('status-autosave-action')
  await expect(action).toHaveText('Exporter…')
  const download = page.waitForEvent('download')
  await action.click()
  await download
  await expect(action).toHaveText('J’ai vérifié le fichier')
  await action.click()
  await expect(line).toBeHidden()
})
