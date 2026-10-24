import { expect, test, type Page } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })

/** Task 13 (C16, CA-14): autosave, « * » dirty marker, Ctrl+S, named projects. */
const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
}
const placeTwo = async (page: Page): Promise<void> => {
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8], rotationY: 30 })
    c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [3, 0, -3] })
    c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } })
  })
}
const design = (page: Page) => page.evaluate(() => window.__creation!.design())

test('2 devices → 1.2 s → reload: both back with the same ids and poses, no picker', async ({ page }) => {
  await boot(page)
  await placeTwo(page)
  const before = await design(page)
  await page.waitForTimeout(1200)
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  const after = await design(page)
  expect(after.rig.instances.map((i) => i.instanceId).sort()).toEqual(['k12-g', 'ql1'])
  expect(after.placements).toEqual(before.placements)
  expect(after.rig.connections).toHaveLength(1)
  await expect(page.getByTestId('place-picker')).toBeHidden()
  await expect(page.locator('.cr-status-msg')).toContainText('Travail de la dernière séance rouvert.')
  // the reopened autosave is not an undo entry
  expect(await page.evaluate(() => window.__creation!.historySize())).toBe(0)
})

test('« * » while dirty; Ctrl+S asks a name, Enter saves (no click); legacy keys untouched', async ({ page }) => {
  await boot(page)
  const legacy = '{"version":2,"rigs":[]}'
  await page.evaluate((v) => localStorage.setItem('audio-sim/rigs.v2', v), legacy)
  expect(await page.title()).toBe('Sans titre · Mode Création · TekPractice')
  // Ctrl+S is always taken (never the browser's « save page »), even before a place
  const prevented = await page.evaluate(() => {
    const e = new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, bubbles: true, cancelable: true })
    document.body.dispatchEvent(e)
    return e.defaultPrevented
  })
  expect(prevented).toBe(true)
  await expect(page.locator('.cr-status-msg')).toContainText('Choisissez un lieu avant d’enregistrer.')
  await placeTwo(page)
  await expect(page).toHaveTitle(/^\* Sans titre · Mode Création · TekPractice$/)
  await expect(page.getByTestId('project-title')).toContainText('*')
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+s')
  const dialog = page.getByRole('dialog', { name: 'Enregistrer le projet' })
  await expect(dialog).toBeVisible()
  const field = dialog.getByRole('textbox', { name: 'Nom du projet' })
  await expect(field).toBeFocused()
  // empty + Enter: refused, said
  await page.keyboard.press('Enter')
  await expect(dialog.getByText('Donnez un nom au projet.')).toBeVisible()
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await field.fill('Mon concert')
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  await expect(page).toHaveTitle('Mon concert · Mode Création · TekPractice')
  await expect(page.getByTestId('project-title')).not.toContainText('*')
  await expect(page.locator('.cr-status-msg')).toContainText('Projet « Mon concert » enregistré')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('audio-sim/creation-projects.v1')!))
  expect(saved.projects.map((p: { name: string }) => p.name)).toEqual(['Mon concert'])
  expect(await page.evaluate(() => localStorage.getItem('audio-sim/rigs.v2'))).toBe(legacy)
  // a second Ctrl+S saves under the same name, no dialog
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_POSE', instanceId: 'k12-g', position: [4, 0, -3], yawDeg: 0, tiltDeg: 0, mount: 'floor' }))
  await expect(page).toHaveTitle(/^\* Mon concert/)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+s')
  await expect(page).toHaveTitle('Mon concert · Mode Création · TekPractice')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // the name and the clean state survive a reload
  await page.waitForTimeout(1200)
  await page.reload()
  await page.waitForFunction(() => window.__creation?.place() === 'room:concert-hall-medium')
  await expect(page).toHaveTitle('Mon concert · Mode Création · TekPractice')
})

test('Nouveau then Ouvrir…: Enter on a listed project opens it (an undoable entry)', async ({ page }) => {
  await boot(page)
  await placeTwo(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+s')
  await page.getByRole('textbox', { name: 'Nom du projet' }).fill('Projet A')
  await page.keyboard.press('Enter')
  await expect(page).toHaveTitle(/^Projet A/)
  // Nouveau: clean → no question; the rig empties, the picker opens over the place
  await page.getByRole('menuitem', { name: 'Projet' }).click()
  await page.getByRole('menuitem', { name: /^Nouveau/ }).click()
  await expect(page.getByTestId('place-picker')).toBeVisible()
  expect((await design(page)).rig.instances).toHaveLength(0)
  await expect(page).toHaveTitle('Sans titre · Mode Création · TekPractice')
  await page.getByRole('button', { name: 'Fermer' }).click()
  // Ouvrir…
  await page.getByRole('menuitem', { name: 'Projet' }).click()
  await page.getByRole('menuitem', { name: /^Ouvrir/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Ouvrir un projet' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: /^Projet A, enregistré le / })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  expect((await design(page)).rig.instances.map((i) => i.instanceId).sort()).toEqual(['k12-g', 'ql1'])
  await expect(page).toHaveTitle('Projet A · Mode Création · TekPractice')
  await expect(page.locator('.cr-status-msg')).toContainText('Projet « Projet A » ouvert.')
})

test('Nouveau with unsaved changes asks first; Annuler keeps everything', async ({ page }) => {
  await boot(page)
  await placeTwo(page)
  await page.getByRole('menuitem', { name: 'Projet' }).click()
  await page.getByRole('menuitem', { name: /^Nouveau/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet ?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Annuler' }).click()
  expect((await design(page)).rig.instances).toHaveLength(2)
})

test('blocked localStorage: the shell boots, says so, and Ctrl+S never crashes (0 page errors)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked')
      },
    }),
  )
  await boot(page)
  const note = page.getByTestId('note-storage')
  await expect(note).toContainText('Le navigateur bloque la sauvegarde : ton travail ne sera pas gardé.')
  await placeTwo(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+s')
  await page.getByRole('textbox', { name: 'Nom du projet' }).fill('X')
  await page.keyboard.press('Enter')
  await expect(page.locator('.cr-status-msg')).toContainText('Le navigateur bloque la sauvegarde')
  await page.waitForTimeout(1200)
  expect(errors).toEqual([])
})

test('an unreadable autosave is set aside (quarantined, not deleted) with a notice; the picker shows', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('audio-sim/creation.v1', JSON.stringify({ version: 2, future: true }))
    }
  })
  await boot(page)
  await expect(page.getByTestId('place-picker')).toBeVisible()
  await expect(page.getByTestId('note-storage')).toContainText('Sauvegarde incompatible, on repart de zéro.')
  const q = await page.evaluate(() => JSON.parse(localStorage.getItem('audio-sim/creation.v1.quarantine')!))
  expect(q.items[0].raw).toContain('"version":2')
})
