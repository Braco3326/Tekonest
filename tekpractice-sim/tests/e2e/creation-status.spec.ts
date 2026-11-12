import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import catalog from '../../content/catalog.json'
import { quietWindow } from './waits'

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
  await quietWindow(page, 10_000)
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

/** Task 34 (C9, L5): « Signal OK » and « Lecture possible » only when the signal path really reaches a powered speaker. */
test('the playback line follows the live signal path: ready on the powered rig, mute never gates, power off does', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 5)
  const playback = page.getByTestId('status-playback')
  // The template as shipped: strip and mains cables, mic cable, no speaker cable, playback off.
  await expect(playback).toHaveText('La lecture console est coupée.')
  await expect(playback).toHaveAttribute('data-ready', 'false')
  await expect(label(page)).toHaveText('Aucune erreur détectée')
  await expect(page.getByTestId('signal-status')).not.toContainText('Signal OK')
  await expect(page.getByTestId('status-mic')).toHaveText('Micro OK') // the mic is cabled to a powered QL1: separate from playback
  // The powered reference rig + playback-usb on.
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } })
    c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-r' }, b: { instance: 'k12-d', port: 'in-line-a' } })
  })
  await expect(playback).toHaveText('La lecture console est coupée.') // cables alone do not play: the source is still off
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }))
  await expect(playback).toHaveText('Lecture possible')
  await expect(playback).toHaveAttribute('data-ready', 'true')
  await expect(label(page)).toHaveText('Signal OK')
  await expect(page.getByTestId('signal-status')).toHaveAttribute('data-kind', 'ok')
  // mute-master silences, never gates.
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'mute-master', value: true }))
  await expect(playback).toHaveText('Lecture possible')
  await expect(label(page)).toHaveText('Signal OK')
  // The console switched off: not playable, not « Signal OK », and the mic is not OK either.
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'power', value: false }))
  await expect(playback).toHaveText('La console n’est pas alimentée.')
  await expect(playback).toHaveAttribute('data-ready', 'false')
  await expect(page.getByTestId('signal-status')).not.toContainText('Signal OK')
  await expect(page.getByTestId('status-mic')).toBeHidden()
  // Undo brings it back: the line is recomputed from the live design, not remembered.
  await page.evaluate(() => window.__creation!.undo())
  await expect(playback).toHaveText('Lecture possible')
})

// ── T1.3b: « Pourquoi je n’entends rien ? » (read-only checklist over the engine's own playback reasons) ───────────────────────────────────

const TITLE = 'Pourquoi je n’entends rien ?'
const bootBlank = async (page: Page, search = ''): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/' + search)
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
}
const chip = (page: Page) => page.getByTestId('checklist-chip')
const panel = (page: Page) => page.getByRole('dialog', { name: TITLE })
const crow = (page: Page, id: string) => page.getByTestId(`checklist-row-${id}`)
const design = (page: Page): Promise<string> => page.evaluate(() => JSON.stringify(window.__creation!.design()))
const spawnConsole = (page: Page): Promise<unknown> =>
  page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 2] }))

test('checklist: the chip shows on a silent rig in the blank room, also with ?oscar=0; the list is non-modal and says what blocks, row by row', async ({ page }) => {
  await bootBlank(page, '?oscar=0')
  await expect(chip(page)).toBeVisible()
  await expect(chip(page)).toHaveText(TITLE)
  await expect(chip(page)).toHaveAttribute('aria-expanded', 'false')
  const inertBefore = await page.locator('[inert]').count()
  await chip(page).click()
  await expect(panel(page)).toBeVisible()
  await expect(chip(page)).toHaveAttribute('aria-expanded', 'true')
  await expect(panel(page)).not.toHaveAttribute('aria-modal', 'true')
  expect(await page.locator('[inert]').count(), 'a non-modal list makes nothing inert').toBe(inertBefore)
  await expect(page.getByTestId('signal-status')).toBeEnabled() // the rest of the page stays live
  // An empty room: the first row is blocked with the engine's words; the others are not yet checked, never ticked.
  await expect(crow(page, 'source')).toHaveAttribute('data-state', 'blocked')
  await expect(crow(page, 'source')).toContainText('Aucune source de lecture dans le projet.')
  for (const id of ['console', 'power', 'cable']) {
    await expect(crow(page, id)).toHaveAttribute('data-state', 'unchecked')
    await expect(crow(page, id)).toContainText('Pas encore vérifié')
  }
  await expect(page.getByTestId('checklist-mic')).toHaveText('Aucun micro branché sur une entrée micro.') // the engine's NO_MIC words
  // A console with Lecture console off: the second row is the blocked one, the first passed.
  await spawnConsole(page)
  await expect(crow(page, 'source')).toHaveAttribute('data-state', 'ok')
  await expect(crow(page, 'console')).toHaveAttribute('data-state', 'blocked')
  await expect(crow(page, 'console')).toContainText('La lecture console est coupée.')
  await expect(crow(page, 'source')).toContainText('En place') // the engine got past the source gate (not « Vérifié »: that word is the sheets')
  await expect(crow(page, 'power')).toHaveAttribute('data-state', 'unchecked')
})

test('checklist: « Aller à » selects the device and leaves the design untouched; the inventory opens on Consoles for a missing source', async ({ page }) => {
  await bootBlank(page)
  await chip(page).click()
  const before = await design(page)
  await page.getByTestId('checklist-goto-source').click()
  await expect(panel(page)).toBeHidden()
  await expect(page.getByRole('tab', { name: 'Consoles' })).toHaveAttribute('aria-selected', 'true') // the drawer opened on its Consoles tab
  await expect(page.getByRole('tab', { name: 'Consoles' })).toBeFocused() // the list's button went away with the list: the focus is not left on the page body
  expect(await design(page), 'opening the inventory changes nothing').toBe(before)
  await page.keyboard.press('Escape')
  await spawnConsole(page)
  const withConsole = await design(page)
  await chip(page).click()
  await page.getByTestId('checklist-goto-console').click()
  await expect(panel(page)).toBeHidden()
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  expect(await design(page), '« Aller à » only selects').toBe(withConsole)
})

test('checklist: Échap closes it and gives the focus back to the chip; a click outside closes it too; axe is clean', async ({ page }) => {
  await bootBlank(page)
  await spawnConsole(page)
  await chip(page).focus()
  await page.keyboard.press('Enter')
  await expect(panel(page)).toBeVisible()
  const axe = await new AxeBuilder({ page }).include('[data-testid="checklist"]').include('[data-testid="status-bar"]').analyze()
  expect(axe.violations.map((v) => v.id)).toEqual([])
  await page.keyboard.press('Escape')
  await expect(panel(page)).toBeHidden()
  await expect(chip(page)).toBeFocused()
  await expect(chip(page)).toHaveAttribute('aria-expanded', 'false')
  await chip(page).click()
  await expect(panel(page)).toBeVisible()
  await page.getByTestId('status-bar').click({ position: { x: 5, y: 5 } })
  await expect(panel(page)).toBeHidden()
})

test('checklist: the mic line says « câblé mais pas entendu » only when a mic is cabled; it is hidden, chip included, once the rig can play and shows again when it cannot', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 5)
  await expect(chip(page)).toBeVisible() // the reference template is silent (Lecture console off, no speaker cable)
  await chip(page).click()
  await expect(page.getByTestId('checklist-mic')).toHaveText('Le micro est câblé, mais Écoute ne le fait pas entendre : elle lit un morceau, un fichier ou le signal de test.')
  await expect(crow(page, 'console')).toHaveAttribute('data-state', 'blocked')
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } })
    c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-r' }, b: { instance: 'k12-d', port: 'in-line-a' } })
  })
  await expect(crow(page, 'cable')).toHaveAttribute('data-state', 'unchecked') // still behind the blocked console row
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }))
  await expect(page.getByTestId('status-playback')).toHaveText('Lecture possible')
  await expect(panel(page)).toBeHidden() // it goes with the problem
  await expect(chip(page)).toBeHidden()
  await page.evaluate(() => window.__creation!.undo())
  await expect(chip(page)).toBeVisible()
  // no mic cable at all: the engine's NO_MIC words
  await page.evaluate(() => window.__creation!.dispatch({ type: 'UNPLUG', a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }))
  await chip(page).click()
  await expect(page.getByTestId('checklist-mic')).toHaveText('Aucun micro branché sur une entrée micro.')
})

test('checklist: no chip before a place is open; the greyed Écoute items point to it under the engine reason', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await expect(chip(page)).toBeHidden() // the very first screen: the place picker only
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await spawnConsole(page)
  await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
  const play = page.getByRole('menuitem', { name: 'Lecture', exact: true })
  await expect(page.locator('#cr-menu-desc-play')).toHaveText('La lecture console est coupée.') // the engine's reason, unchanged
  await expect(page.locator('#cr-menu-hint-play')).toBeVisible()
  await expect(page.locator('#cr-menu-hint-play')).toHaveText('Voir « Pourquoi je n’entends rien ? » dans la barre d’état.')
  await expect(play).toHaveAccessibleDescription('La lecture console est coupée. Voir « Pourquoi je n’entends rien ? » dans la barre d’état.')
})

test('checklist: the legacy page and a level page have no chip (Mode Création only; exams are the level route)', async ({ page }) => {
  for (const url of ['/?legacy=1', '/?level=a1']) {
    await page.goto(url)
    await expect(page.locator('#hud')).toBeAttached()
    await expect(page.getByTestId('checklist-chip'), url).toHaveCount(0)
    expect(await page.evaluate(() => !!window.__creation), url).toBe(false)
  }
})
