import { readFileSync } from 'node:fs'
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
  await expect(note).toContainText('Le navigateur bloque la sauvegarde : votre travail ne sera pas gardé.')
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
  await expect(page.getByTestId('note-storage')).toContainText('Exporter les données mises de côté')
  // « Exporter les données mises de côté… » downloads it; nothing is removed
  await page.getByRole('menuitem', { name: 'Projet' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Exporter les données mises de côté…' }).click()])
  expect(download.suggestedFilename()).toMatch(/^tekpractice-donnees-mises-de-cote-\d{4}-\d{2}-\d{2}\.json$/)
  const file = JSON.parse(readFileSync((await download.path())!, 'utf8'))
  expect(file.quarantine[0].raw).toContain('"version":2')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('audio-sim/creation.v1.quarantine')!).items.length)).toBe(1)
})

/** Projet > item. */
const menu = async (page: Page, item: RegExp | string): Promise<void> => {
  await page.getByRole('menuitem', { name: 'Projet' }).click()
  await page.getByRole('menuitem', { name: item }).click()
}
const nameAndEnter = async (page: Page, name: string): Promise<void> => {
  const field = page.getByRole('textbox', { name: 'Nom du projet' })
  await expect(field).toBeFocused()
  await field.fill(name)
  await page.keyboard.press('Enter')
  await expect(field).toBeHidden()
}
const storedProject = (page: Page, name: string) =>
  page.evaluate((n) => JSON.parse(localStorage.getItem('audio-sim/creation-projects.v1')!).projects.find((p: { name: string }) => p.name === n), name)

test('review CRITICAL: open B, undo → the rig AND the name are A again; Ctrl+S never writes A into B', async ({ page }) => {
  await boot(page)
  await placeTwo(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+s')
  await nameAndEnter(page, 'A')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'REMOVE', instanceId: 'k12-g' }))
  await menu(page, 'Enregistrer sous…')
  await nameAndEnter(page, 'B')
  await expect(page).toHaveTitle(/^B ·/)
  await menu(page, /^Ouvrir/)
  await page.getByRole('button', { name: /^A, enregistré le / }).click()
  await expect(page).toHaveTitle(/^A ·/)
  await menu(page, /^Ouvrir/)
  await page.getByRole('button', { name: /^B, enregistré le / }).click()
  await expect(page).toHaveTitle(/^B ·/)
  expect((await design(page)).rig.instances).toHaveLength(1)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+z')
  expect((await design(page)).rig.instances).toHaveLength(2)
  await expect(page).toHaveTitle('A · Mode Création · TekPractice') // clean: it is A as saved
  await page.keyboard.press('Control+y')
  await expect(page).toHaveTitle('B · Mode Création · TekPractice')
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+s')
  await expect(page.locator('.cr-status-msg')).toContainText('Projet « A » enregistré')
  expect((await storedProject(page, 'B')).design.rig.instances).toHaveLength(1) // B untouched
  expect((await storedProject(page, 'A')).design.rig.instances).toHaveLength(2)
})

test('re-review: open B, edit, Ctrl+S, undo past Ouvrir, redo all → clean B, and the next Ctrl+S is no false conflict', async ({ page }) => {
  await boot(page)
  await placeTwo(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+s')
  await nameAndEnter(page, 'A')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'REMOVE', instanceId: 'k12-g' }))
  await menu(page, 'Enregistrer sous…')
  await nameAndEnter(page, 'B')
  await menu(page, /^Ouvrir/)
  await page.getByRole('button', { name: /^A, enregistré le / }).click()
  await menu(page, /^Ouvrir/)
  await page.getByRole('button', { name: /^B, enregistré le / }).click()
  await expect(page).toHaveTitle('B · Mode Création · TekPractice')
  // edit + Ctrl+S (B gets a new stamp)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_POSE', instanceId: 'ql1', position: [1, 0, 7], yawDeg: 0, tiltDeg: 0, mount: 'floor' }))
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+s')
  await expect(page.locator('.cr-status-msg')).toContainText('Projet « B » enregistré')
  await expect(page).toHaveTitle('B · Mode Création · TekPractice')
  // undo the edit and Ouvrir B, then redo both
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+z')
  await expect(page).toHaveTitle(/A · Mode Création/)
  await page.keyboard.press('Control+y')
  await page.keyboard.press('Control+y')
  await expect(page).toHaveTitle('B · Mode Création · TekPractice') // no « * »
  await page.keyboard.press('Control+s')
  await expect(page.locator('.cr-status-msg')).toHaveText('Projet « B » enregistré')
  expect(await page.evaluate(() => window.__creation!.quarantine())).toEqual([]) // no false « other tab » conflict
})

test('« Ouvrir… » with unsaved changes asks first; an unreadable project list is said, never « no project »', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('audio-sim/creation-projects.v1', '{not json')
    }
  })
  await boot(page)
  await placeTwo(page)
  await menu(page, /^Ouvrir/)
  const ask = page.getByRole('dialog', { name: 'Ouvrir un autre projet ?' })
  await expect(ask).toBeVisible()
  await ask.getByRole('button', { name: 'Choisir un projet' }).click()
  const list = page.getByRole('dialog', { name: 'Ouvrir un projet' })
  await expect(list).toContainText('La liste des projets enregistrés est illisible.')
  await expect(list).not.toContainText('Aucun projet enregistré')
  await page.keyboard.press('Escape')
  // set aside at once (kept, exportable), the key itself untouched
  expect(await page.evaluate(() => localStorage.getItem('audio-sim/creation-projects.v1'))).toBe('{not json')
  expect(await page.evaluate(() => window.__creation!.quarantine().map((q) => q.raw))).toContain('{not json')
  // the next save says it started a new list
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+s')
  await nameAndEnter(page, 'Neuf')
  await expect(page.locator('.cr-status-msg')).toContainText('L’ancienne liste de projets, illisible, est gardée à part.')
})

test('quarantine full (5): the unreadable autosave is not dropped; autosave waits until it is exported', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1')
      const items = [0, 1, 2, 3, 4].map((i) => ({ at: 't', key: 'audio-sim/creation.v1', reason: 'corrupt', raw: `old${i}` }))
      localStorage.setItem('audio-sim/creation.v1.quarantine', JSON.stringify({ version: 1, items }))
      localStorage.setItem('audio-sim/creation.v1', '{sixth')
    }
  })
  await boot(page)
  await expect(page.getByTestId('note-kept-full')).toContainText('Exportez-les')
  await placeTwo(page)
  await page.waitForTimeout(1300)
  expect(await page.evaluate(() => localStorage.getItem('audio-sim/creation.v1'))).toBe('{sixth') // not overwritten
  expect(await page.evaluate(() => window.__creation!.quarantine().length)).toBe(5) // nothing evicted
  await page.getByRole('menuitem', { name: 'Projet' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Exporter les données mises de côté…' }).click()])
  const file = JSON.parse(readFileSync((await download.path())!, 'utf8'))
  expect(file.pending.map((p: { raw: string }) => p.raw)).toEqual(['{sixth'])
  expect(file.quarantine).toHaveLength(5)
  // the note stays until the learner says the file is good; autosave still waits
  const note = page.getByTestId('note-kept-full')
  await expect(note).toContainText('vérifier')
  await page.waitForTimeout(1300)
  expect(await page.evaluate(() => localStorage.getItem('audio-sim/creation.v1'))).toBe('{sixth')
  await note.getByRole('button', { name: 'J’ai vérifié le fichier' }).click()
  await expect(note).toHaveCount(0)
  await page.waitForTimeout(1300)
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('audio-sim/creation.v1')))!).design.rig.instances).toHaveLength(2)
})

test('two tabs: when the other tab autosaves, this one pauses (said) and writes nothing until Ctrl+S here', async ({ page, context }) => {
  await boot(page)
  await placeTwo(page)
  await page.waitForTimeout(1300) // tab 1 autosaved
  const tab2 = await context.newPage()
  await boot(tab2)
  await tab2.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  // tab 1 writes again → tab 2 hears it
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58', position: [1, 0, 6] }))
  await page.waitForTimeout(1300)
  await expect(tab2.getByTestId('note-other-tab')).toContainText('Ce projet est ouvert dans un autre onglet')
  // tab 2 changes: nothing written over tab 1's autosave
  await tab2.evaluate(() => window.__creation!.dispatch({ type: 'REMOVE', instanceId: 'ql1' }))
  await tab2.waitForTimeout(1300)
  const ids = async () => JSON.parse((await page.evaluate(() => localStorage.getItem('audio-sim/creation.v1')))!).design.rig.instances.map((i: { instanceId: string }) => i.instanceId).sort()
  expect(await ids()).toEqual(['k12-g', 'ql1', 'sm58'])
  // Ctrl+S in tab 2: it becomes the active tab, its autosave resumes
  await tab2.locator('#renderCanvas').focus()
  await tab2.keyboard.press('Control+s')
  await nameAndEnter(tab2, 'Onglet 2')
  await expect(tab2.getByTestId('note-other-tab')).toHaveCount(0)
  await tab2.waitForTimeout(300)
  expect(await ids()).toEqual(['k12-g']) // tab 2's own rig (it never saw tab 1's sm58)
  await tab2.close()
})

test('two tabs: « Reprendre ici » in the note resumes this tab’s autosave', async ({ page, context }) => {
  await boot(page)
  await placeTwo(page)
  await page.waitForTimeout(1300)
  const tab2 = await context.newPage()
  await boot(tab2)
  await tab2.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'REMOVE', instanceId: 'k12-g' }))
  await page.waitForTimeout(1300)
  const note = tab2.getByTestId('note-other-tab')
  await expect(note).toContainText('« Reprendre ici »')
  await note.getByRole('button', { name: 'Reprendre ici' }).click()
  await expect(note).toHaveCount(0)
  await tab2.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58', position: [1, 0, 6] }))
  await tab2.waitForTimeout(1300)
  const ids = JSON.parse((await tab2.evaluate(() => localStorage.getItem('audio-sim/creation.v1')))!).design.rig.instances.map((i: { instanceId: string }) => i.instanceId).sort()
  expect(ids).toEqual(['k12-g', 'ql1', 'sm58']) // tab 2's rig written
  await tab2.close()
})

test('two tabs: saving a project the other tab saved meanwhile keeps that version aside', async ({ page, context }) => {
  await boot(page)
  await placeTwo(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+s')
  await nameAndEnter(page, 'Partagé')
  await page.waitForTimeout(1300)
  const tab2 = await context.newPage()
  await boot(tab2)
  await tab2.waitForFunction(() => window.__creation!.project().name === 'Partagé')
  // tab 2 saves Partagé with a change
  await tab2.evaluate(() => window.__creation!.dispatch({ type: 'REMOVE', instanceId: 'ql1' }))
  await tab2.locator('#renderCanvas').focus()
  await tab2.keyboard.press('Control+s')
  await expect(tab2.locator('.cr-status-msg')).toContainText('Projet « Partagé » enregistré')
  // tab 1 (stale) saves too: tab 2's version is kept aside, and it says so
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_POSE', instanceId: 'k12-g', position: [5, 0, -3], yawDeg: 0, tiltDeg: 0, mount: 'floor' }))
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+s')
  await expect(page.locator('.cr-status-msg')).toContainText('La version enregistrée depuis un autre onglet est gardée à part.')
  const kept = await page.evaluate(() => window.__creation!.quarantine())
  expect(kept.map((k) => k.reason)).toEqual(['conflict'])
  expect(JSON.parse(kept[0].raw).design.rig.instances).toHaveLength(1)
  await tab2.close()
})

test('Ctrl+S inside a Propriétés text field is handled (preventDefault), not the browser’s save', async ({ page }) => {
  await boot(page)
  await placeTwo(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press(']')
  const input = page.getByTestId('properties').locator('input').first()
  await input.focus()
  const prevented = await input.evaluate((el) => {
    const e = new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, bubbles: true, cancelable: true })
    el.dispatchEvent(e)
    return e.defaultPrevented
  })
  expect(prevented).toBe(true)
  await expect(page.getByRole('dialog', { name: 'Enregistrer le projet' })).toBeVisible()
})
