import { expect, test } from '@playwright/test'
test('5 place changes without reload: one scene, no leftovers, no leaks, 0 console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation) // the shell boots from a lazy chunk, after `load`
  const nav = await page.evaluate(() => performance.getEntriesByType('navigation').length)
  const choose = async (key: string) => {
    await page.evaluate((k) => window.__creation!.choosePlace(k), key) // test hook = same path as a card click
    await page.waitForFunction((k) => window.__creation!.place() === k, key)
  }
  await choose('room:concert-hall-medium')
  const meshesA = await page.evaluate(() => window.__creation!.meshCount())
  const listenersA = await page.evaluate(() => window.__creation!.liveListeners())
  for (const k of ['room:bar-club-stage-small', 'set:theatre', 'blank', 'room:classroom-lab-small', 'room:concert-hall-medium']) await choose(k)
  expect(await page.evaluate(() => window.__creation!.scenes())).toBe(1)
  expect(await page.evaluate(() => window.__creation!.meshCount())).toBe(meshesA)
  expect(await page.evaluate(() => window.__creation!.liveListeners())).toBe(listenersA)
  expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(nav)
  expect(errors).toEqual([])
})
test('changing place with gear asks « Garder le matériel / Repartir à vide »', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation) // the shell boots from a lazy chunk, after `load`
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] }))
  await page.evaluate(() => void window.__creation!.requestPlace('room:bar-club-stage-small'))
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Garder le matériel' }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:bar-club-stage-small')
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(1)
  await page.evaluate(() => window.__creation!.undo())
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
})
test('the change-place dialog: Esc cancels, « Repartir à vide » empties the rig', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation) // the shell boots from a lazy chunk, after `load`
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] }))
  await page.evaluate(() => void window.__creation!.requestPlace('blank'))
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  // everything behind the dialog is inert while it is open (the shell root carries `inert` since Task 7)
  const inInert = (sel: string) => page.evaluate((s) => !!document.querySelector(s)!.closest('[inert]'), sel)
  expect(await inInert('[data-testid="place-picker"]')).toBe(true)
  expect(await inInert('#renderCanvas')).toBe(true)
  expect(await inInert('[data-testid="menubar"]')).toBe(true)
  expect(await page.evaluate(() => !!document.querySelector('[role="dialog"]')!.closest('[inert]'))).toBe(false)
  // focus starts inside and Tab stays inside (trap)
  for (let i = 0; i < 4; i++) {
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
    await page.keyboard.press('Tab')
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(await inInert('[data-testid="place-picker"]')).toBe(false)
  expect(await inInert('#renderCanvas')).toBe(false)
  expect(await page.evaluate(() => window.__creation!.place())).toBe('room:concert-hall-medium')
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(1)

  await page.evaluate(() => void window.__creation!.requestPlace('blank'))
  await page.getByRole('button', { name: 'Repartir à vide' }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(0)
  expect(await page.evaluate(() => window.__creation!.scenes())).toBe(1)
})
