import { expect, test, type Page } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })

/** Task 10: the « Propriétés » panel edits the selection through history.do only. */
const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] })
    c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [3, 0, -3] })
    c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } })
  })
}
/** Select through the UI: ] in the 3D view until `id` is selected. */
const select = async (page: Page, id: string): Promise<void> => {
  await page.locator('#renderCanvas').focus()
  for (let i = 0; i < 6 && (await page.evaluate(() => window.__creation!.selection())) !== id; i++) await page.keyboard.press(']')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe(id)
}
const pose = (page: Page, id: string) => page.evaluate((id) => window.__creation!.design().placements.find((p) => p.instanceId === id) ?? null, id)
const undoSize = (page: Page) => page.evaluate(() => window.__creation!.historySize())

test('empty selection says so, with the way to select', async ({ page }) => {
  await boot(page)
  const props = page.getByTestId('properties')
  await expect(props.getByRole('heading', { name: 'Aucune sélection' })).toBeVisible()
  await expect(props.getByText(/panneau Projet/)).toBeVisible()
})

test('X: « 2,5 » + Entrée = one undoable SET_POSE; Ctrl+Z puts it back; « abc » is an error and dispatches nothing; Échap reverts', async ({ page }) => {
  await boot(page)
  await select(page, 'ql1')
  const props = page.getByTestId('properties')
  await expect(props.getByRole('heading', { name: 'Yamaha QL1' })).toBeVisible()
  const x = props.getByRole('textbox', { name: 'X', exact: true })
  await expect(x).toHaveValue('0,00')

  const u0 = await undoSize(page)
  await x.fill('2,5')
  await x.press('Enter')
  expect((await pose(page, 'ql1'))!.position_m[0]).toBe(2.5)
  expect(await undoSize(page)).toBe(u0 + 1)
  await expect(x).toHaveValue('2,50')
  await expect(x).toBeFocused() // the panel updates in place: focus stays

  // Ctrl+Z from the 3D view (keys never fire inside a text field)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+z')
  expect((await pose(page, 'ql1'))!.position_m[0]).toBe(0)
  await expect(x).toHaveValue('0,00')

  // invalid: announced on the field, nothing dispatched
  const u1 = await undoSize(page)
  await x.fill('abc')
  await x.press('Enter')
  await expect(x).toHaveAttribute('aria-invalid', 'true')
  const errId = (await x.getAttribute('aria-describedby'))!.split(' ').find((id) => id.endsWith('-error'))!
  await expect(page.locator(`[id="${errId}"]`)).toHaveText('Valeur non valide : entrez un nombre, par exemple 2,5.')
  await expect(x).toHaveAccessibleDescription(/Valeur non valide/)
  expect(await undoSize(page)).toBe(u1)
  expect((await pose(page, 'ql1'))!.position_m[0]).toBe(0)

  // Échap reverts the field to the store value and clears the error
  await x.fill('9')
  await x.press('Escape')
  await expect(x).toHaveValue('0,00')
  await expect(x).not.toHaveAttribute('aria-invalid', 'true')
  expect(await undoSize(page)).toBe(u1)
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1') // Échap in a field never clears the selection

  // blur commits
  await x.fill('1,25')
  await props.getByRole('textbox', { name: 'Z', exact: true }).focus()
  expect((await pose(page, 'ql1'))!.position_m[0]).toBe(1.25)
  expect(await undoSize(page)).toBe(u1 + 1)
})

test('« Augmenter Lacet » clicked 5 times quickly = one undo entry (stepper burst)', async ({ page }) => {
  await boot(page)
  await select(page, 'ql1')
  const props = page.getByTestId('properties')
  const up = props.getByRole('button', { name: 'Augmenter Lacet' })
  await expect(props.getByRole('button', { name: 'Diminuer Lacet' })).toBeVisible()
  const u0 = await undoSize(page)
  for (let i = 0; i < 5; i++) await up.click()
  await expect(up).toBeFocused() // the button survives the store updates
  await expect(props.getByRole('textbox', { name: 'Lacet', exact: true })).toHaveValue('75')
  await expect.poll(() => undoSize(page)).toBe(u0 + 1)
  expect((await pose(page, 'ql1'))!.yawDeg).toBe(75)
  await page.waitForTimeout(800)
  expect(await undoSize(page)).toBe(u0 + 1)
  await page.evaluate(() => window.__creation!.undo())
  expect((await pose(page, 'ql1'))!.yawDeg).toBe(0)
})

test('review fixes 1-2: a foreign command during a burst is its own entry; an undo right after a burst undoes it', async ({ page }) => {
  await boot(page)
  await select(page, 'ql1')
  const up = page.getByTestId('properties').getByRole('button', { name: 'Augmenter Lacet' })
  const u0 = await undoSize(page)
  // Two steps, then within the 600 ms burst another edit that leaves the panel as it is (focus stays
  // on the stepper). All in ONE page task: under a loaded parallel run, two Playwright clicks can land
  // more than 600 ms apart and make two bursts (the old flake).
  await up.evaluate((b: HTMLButtonElement) => {
    b.focus()
    b.click()
    b.click()
    window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58', position: [1, 0, 6] })
  })
  await expect(up).toBeFocused()
  await page.waitForTimeout(800)
  expect(await undoSize(page)).toBe(u0 + 2)
  // undo the SPAWN only: the burst is untouched
  await page.evaluate(() => window.__creation!.undo())
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(2)
  expect((await pose(page, 'ql1'))!.yawDeg).toBe(30)

  // 45, then undo at once, inside the 600 ms (same page task: really inside the burst)
  expect(
    await up.evaluate((b: HTMLButtonElement) => {
      b.click()
      return window.__creation!.undo()
    })
  ).toBe(true)
  expect((await pose(page, 'ql1'))!.yawDeg).toBe(30)
})

test('review fix 3: a held stepper stops when its device leaves the panel (no step lands on the next selection)', async ({ page }) => {
  await boot(page)
  await select(page, 'ql1')
  const up = page.getByTestId('properties').getByRole('button', { name: 'Augmenter Lacet' })
  // A press that does not focus the button (Safari, touch): no blur will ever stop it.
  await up.dispatchEvent('pointerdown', { button: 0, isPrimary: true, pointerType: 'touch' })
  await expect.poll(async () => (await pose(page, 'ql1'))!.yawDeg, { timeout: 3000 }).toBeGreaterThan(15) // repeating
  await page.evaluate(() => window.__creation!.dispatch({ type: 'REMOVE', instanceId: 'ql1' })) // the panel empties under the pointer
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press(']')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('k12-g')
  await page.waitForTimeout(700)
  expect((await pose(page, 'k12-g'))!.yawDeg).toBe(0)
})

test('mount: « Pied » unlocks the height, « Sol » puts it back on the floor; tilt clamps to 90', async ({ page }) => {
  await boot(page)
  await select(page, 'k12-g')
  const props = page.getByTestId('properties')
  const height = props.getByRole('textbox', { name: 'Hauteur', exact: true })
  await expect(height).toHaveAttribute('readonly', '')
  await props.getByRole('combobox', { name: 'Montage' }).selectOption({ label: 'Pied' })
  expect((await pose(page, 'k12-g'))!.mount).toBe('stand')
  await expect(height).not.toHaveAttribute('readonly', '')
  await height.fill('1,8')
  await height.press('Enter')
  expect((await pose(page, 'k12-g'))!.position_m[1]).toBe(1.8)
  const tilt = props.getByRole('textbox', { name: 'Inclinaison', exact: true })
  await tilt.fill('120')
  await tilt.press('Enter')
  expect((await pose(page, 'k12-g'))!.tiltDeg).toBe(90)
  await expect(tilt).toHaveValue('90')
  await props.getByRole('combobox', { name: 'Montage' }).selectOption({ label: 'Sol' })
  const p = (await pose(page, 'k12-g'))!
  expect(p.mount ?? 'floor').toBe('floor')
  expect(p.position_m[1]).toBe(0)
})

test('controls: a toggle is a pressed button, an enum a select; both undoable', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => {
    window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'focusrite-isa-one', instanceId: 'isa', position: [1, 0, 6] })
    window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'avid-hd-io', instanceId: 'hdio', position: [-1, 0, 6] })
  })
  await select(page, 'isa')
  const props = page.getByTestId('properties')
  const phantom = props.getByRole('button', { name: '+48V phantom' })
  await expect(phantom).toHaveAttribute('aria-pressed', 'false')
  await phantom.click()
  await expect(phantom).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => window.__creation!.design().rig.controls.isa['phantom-48v'])).toBe(true)
  await page.evaluate(() => window.__creation!.undo())
  await expect(phantom).toHaveAttribute('aria-pressed', 'false')

  await select(page, 'hdio')
  await props.getByRole('combobox', { name: 'Sample rate' }).selectOption('96000')
  expect(await page.evaluate(() => window.__creation!.design().rig.controls.hdio['sample-rate'])).toBe('96000')
})

test('« Alimentation » (Task 32): every active device has it on by default; the press is one undoable SET_CONTROL; a device with no power-in has none', async ({ page }) => {
  await boot(page)
  await select(page, 'k12-g')
  const props = page.getByTestId('properties')
  const power = props.getByRole('button', { name: 'Alimentation' })
  await expect(power).toHaveAttribute('aria-pressed', 'true')
  expect(await power.evaluate((e) => getComputedStyle(e).transitionProperty)).toBe('none')
  const u0 = await undoSize(page)
  await power.click()
  await expect(power).toHaveAttribute('aria-pressed', 'false')
  expect(await page.evaluate(() => window.__creation!.design().rig.controls['k12-g'].power)).toBe(false)
  expect(await undoSize(page)).toBe(u0 + 1)
  await page.evaluate(() => window.__creation!.undo())
  await expect(power).toHaveAttribute('aria-pressed', 'true')
  // a microphone has no mains inlet, so no switch for it
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'mic', position: [1, 0, 6] }))
  await select(page, 'mic')
  await expect(props.getByRole('heading', { name: 'Shure SM58' })).toBeVisible()
  await expect(props.getByRole('button', { name: 'Alimentation' })).toHaveCount(0)
})

test('QL1 sound controls (Task 33, P8): Lecture console and Mute master are off, Fader master 0, Balance C; each change is one undoable SET_CONTROL; the K12.2 has none', async ({ page }) => {
  await boot(page)
  await select(page, 'ql1')
  const props = page.getByTestId('properties')
  const playback = props.getByRole('button', { name: 'Lecture console' })
  const mute = props.getByRole('button', { name: 'Mute master' })
  const fader = props.getByRole('combobox', { name: 'Fader master' })
  const balance = props.getByRole('combobox', { name: 'Balance' })
  await expect(playback).toHaveAttribute('aria-pressed', 'false')
  await expect(mute).toHaveAttribute('aria-pressed', 'false')
  await expect(fader).toHaveValue('0')
  await expect(balance).toHaveValue('C')
  expect(await fader.locator('option').allTextContents()).toEqual(['-inf', '-30', '-20', '-10', '-6', '-3', '0', '+6', '+10'])
  const ctl = (id: string) => page.evaluate((id) => window.__creation!.design().rig.controls.ql1[id], id)
  const u0 = await undoSize(page)
  await playback.click()
  await expect(playback).toHaveAttribute('aria-pressed', 'true')
  expect(await ctl('playback-usb')).toBe(true)
  await fader.selectOption('-6')
  expect(await ctl('fader-master')).toBe('-6')
  await balance.selectOption('G50')
  expect(await ctl('balance-master')).toBe('G50')
  expect(await undoSize(page)).toBe(u0 + 3)
  await page.evaluate(() => window.__creation!.undo())
  await expect(balance).toHaveValue('C')
  await page.evaluate(() => window.__creation!.undo())
  await expect(fader).toHaveValue('0')
  await page.evaluate(() => window.__creation!.undo())
  await expect(playback).toHaveAttribute('aria-pressed', 'false')
  // a loudspeaker has the power switch and no console control
  await select(page, 'k12-g')
  await expect(props.getByRole('heading', { name: 'QSC K12.2' })).toBeVisible()
  await expect(props.getByRole('button', { name: 'Lecture console' })).toHaveCount(0)
  await expect(props.getByRole('combobox', { name: 'Fader master' })).toHaveCount(0)
})

test('Connexions: each cable reads its signal and other end; « Débrancher » is an undoable UNPLUG', async ({ page }) => {
  await boot(page)
  await select(page, 'ql1')
  const props = page.getByTestId('properties')
  const list = props.getByRole('list', { name: 'Connexions' })
  await expect(list.getByRole('listitem')).toHaveCount(7)
  const row = list.getByRole('listitem').filter({ hasText: 'out-main-l' })
  await expect(row).toContainText('Niveau ligne pro (+4 dBu)')
  await expect(row).toContainText('K12.2 (k12-g) · in-line-a')
  const u0 = await undoSize(page)
  await row.getByRole('button', { name: 'Débrancher out-main-l de K12.2 (k12-g) · in-line-a' }).click()
  expect(await page.evaluate(() => window.__creation!.design().rig.connections.length)).toBe(0)
  expect(await undoSize(page)).toBe(u0 + 1)
  await expect(row).toContainText('libre')
  await expect(page.getByRole('status')).toHaveText('Débranché : out-main-l de K12.2 (k12-g) · in-line-a')
  await expect(row).toBeFocused() // focus stays on the row, not lost with the button
  await page.evaluate(() => window.__creation!.undo())
  expect(await page.evaluate(() => window.__creation!.design().rig.connections.length)).toBe(1)
  await expect(row).toContainText('K12.2 (k12-g) · in-line-a')
})

test('every input is labelled; idle = 0 renders in 2 s with the panel shown', async ({ page }) => {
  await boot(page)
  await select(page, 'ql1')
  const props = page.getByTestId('properties')
  for (const el of await props.locator('input, select').all()) {
    const id = await el.getAttribute('id')
    expect(id).toBeTruthy()
    expect(await props.locator(`label[for="${id}"]`).count(), id!).toBe(1)
  }
  await page.mouse.move(5, 5)
  await expect.poll(async () => {
    const a = await page.evaluate(() => window.__creation!.renders())
    await page.waitForTimeout(500)
    return (await page.evaluate(() => window.__creation!.renders())) - a
  }, { timeout: 15000 }).toBe(0)
  const r0 = await page.evaluate(() => window.__creation!.renders())
  await page.waitForTimeout(2000)
  expect(await page.evaluate(() => window.__creation!.renders())).toBe(r0)
})
