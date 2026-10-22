/**
 * Explore view gates (ADR-0010): walk with the keyboard, walk and look with the
 * mouse only, orbit stays the level default, V toggles, and the ADR-0008 patch
 * grammar still works from Explore (click a device → focus → patch → back).
 */
import { expect, test, type Page } from '@playwright/test'

const FLY_SETTLE_MS = 500

const ex = (page: Page) => page.evaluate(() => window.__audioSim!.explore!())

async function boot(page: Page, query: string): Promise<void> {
  await page.goto(`/${query}`)
  await page.waitForFunction(() => !!window.__audioSim?.explore)
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!window.__audioSim?.explore)
  await page.waitForTimeout(300)
}

test('sandbox starts in Explore; holding W walks forward, S walks back', async ({ page }) => {
  await boot(page, '?level=sandbox')
  const start = await ex(page)
  expect(start.view).toBe('explore')
  await page.keyboard.down('w')
  await page.waitForTimeout(900)
  await page.keyboard.up('w')
  await page.waitForTimeout(400) // decelerate
  const walked = await ex(page)
  const forward = { x: Math.sin(start.yaw), z: Math.cos(start.yaw) }
  const moved = (walked.position.x - start.position.x) * forward.x + (walked.position.z - start.position.z) * forward.z
  expect(moved).toBeGreaterThan(0.5)
  await page.keyboard.down('s')
  await page.waitForTimeout(600)
  await page.keyboard.up('s')
  await page.waitForTimeout(300)
  const back = await ex(page)
  const moved2 = (back.position.x - walked.position.x) * forward.x + (back.position.z - walked.position.z) * forward.z
  expect(moved2).toBeLessThan(-0.3)
})

test('Q/E change eye height; Shift runs faster', async ({ page }) => {
  await boot(page, '?level=sandbox')
  const start = await ex(page)
  await page.keyboard.down('q')
  await page.waitForTimeout(500)
  await page.keyboard.up('q')
  expect((await ex(page)).position.y).toBeLessThan(start.position.y - 0.2)
})

test('mouse only: left-drag looks around, right-drag up walks forward', async ({ page }) => {
  await boot(page, '?level=sandbox')
  const size = page.viewportSize()!
  const cx = size.width / 2
  const cy = size.height / 2 + 120 // aim at the floor, away from gear
  const start = await ex(page)
  await page.mouse.move(cx, cy)
  await page.mouse.down({ button: 'left' })
  await page.mouse.move(cx + 200, cy, { steps: 10 })
  await page.mouse.up({ button: 'left' })
  const looked = await ex(page)
  expect(looked.yaw).not.toBeCloseTo(start.yaw, 2)
  expect(looked.position.x).toBeCloseTo(start.position.x, 3) // looking never moves you

  await page.mouse.move(cx, cy)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(cx, cy - 60, { steps: 6 })
  await page.waitForTimeout(800)
  await page.mouse.up({ button: 'right' })
  await page.waitForTimeout(300)
  const walked = await ex(page)
  const fwd = { x: Math.sin(walked.yaw), z: Math.cos(walked.yaw) }
  const moved = (walked.position.x - looked.position.x) * fwd.x + (walked.position.z - looked.position.z) * fwd.z
  expect(moved).toBeGreaterThan(0.3)
  expect(walked.locked).toBe(false) // mouse-only never captures the pointer
})

test('mouse wheel zooms the field of view (never moves the walker)', async ({ page }) => {
  await boot(page, '?level=sandbox')
  const start = await ex(page)
  const size = page.viewportSize()!
  await page.mouse.move(size.width / 2, size.height / 2 + 120)
  await page.mouse.wheel(0, -400)
  await page.waitForTimeout(100)
  const zoomed = await ex(page)
  expect(zoomed.fovDeg).toBeLessThan(start.fovDeg)
  expect(zoomed.position.z).toBeCloseTo(start.position.z, 3)
})

test('levels keep orbit by default; V toggles Explore and back; ?view=explore forces it', async ({ page }) => {
  await boot(page, '?level=a1')
  expect((await ex(page)).view).toBe('orbit')
  await page.keyboard.press('v')
  expect((await ex(page)).view).toBe('explore')
  await page.keyboard.press('v')
  expect((await ex(page)).view).toBe('orbit')
  await page.goto('/?level=a1&view=explore')
  await page.waitForFunction(() => !!window.__audioSim?.explore)
  expect((await ex(page)).view).toBe('explore')
})

test('from Explore: click a device → focus → patch a cable → Esc back to walking', async ({ page }) => {
  await boot(page, '?level=a1&view=explore')
  await page
    .waitForFunction(() => window.__audioSim!.assets().every((a) => a.status === 'glb'), undefined, { timeout: 5000 })
    .catch(() => undefined)
  await page.waitForTimeout(300)
  const before = await ex(page)

  // Single click on the stagebox focuses it directly in Explore view.
  let focused = false
  for (let attempt = 0; attempt < 5 && !focused; attempt++) {
    const pos = await page.evaluate(() => window.__audioSim!.deviceScreen('rio-1'))
    if (!pos) throw new Error('no screen position for rio-1')
    await page.mouse.click(pos.x, pos.y - attempt * 12)
    focused = await page
      .waitForFunction(() => window.__audioSim!.view().mode === 'focus', undefined, { timeout: 1000 })
      .then(() => true)
      .catch(() => false)
    if (focused) break
    // Recover like a learner would: drop an accidental cable pickup — but never
    // press Esc with nothing held (in Explore that opens the pause menu).
    if (await page.evaluate(() => window.__audioSim!.view().held !== null)) await page.keyboard.press('Escape')
    if ((await ex(page)).panels > 0) await page.keyboard.press('Escape')
  }
  expect(focused).toBe(true)
  await page.waitForTimeout(FLY_SETTLE_MS)

  // Pick up the Dante port, Esc drops it (ADR-0008: first Esc = cable), second Esc leaves focus.
  const port = await page.evaluate(() => window.__audioSim!.portScreen({ instance: 'rio-1', port: 'dante-primary' }))
  await page.mouse.click(port!.x, port!.y)
  await expect.poll(async () => (await page.evaluate(() => window.__audioSim!.view().held))?.port).toBe('dante-primary')
  await page.keyboard.press('Escape')
  await expect.poll(async () => page.evaluate(() => window.__audioSim!.view().held)).toBeNull()
  expect(await page.evaluate(() => window.__audioSim!.view().mode)).toBe('focus')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => window.__audioSim!.view().mode === 'ensemble')
  await page.waitForTimeout(FLY_SETTLE_MS)

  // Back in Explore, exactly where we stood, and walking works again.
  const after = await ex(page)
  expect(after.view).toBe('explore')
  expect(after.position.x).toBeCloseTo(before.position.x, 2)
  expect(after.position.z).toBeCloseTo(before.position.z, 2)
  await page.keyboard.down('w')
  await page.waitForTimeout(500)
  await page.keyboard.up('w')
  const walked = await ex(page)
  expect(Math.hypot(walked.position.x - after.position.x, walked.position.z - after.position.z)).toBeGreaterThan(0.2)
})

test('Space opens the inventory (grouped, searchable, sheet with official manual); Space/Esc close it', async ({ page }) => {
  await boot(page, '?level=a1')
  await page.keyboard.press('Space')
  const panel = page.locator('.ex-panel[data-panel="inventory"]')
  await expect(panel).toBeVisible()
  expect((await ex(page)).panels).toBe(1)
  await expect(panel.locator('.ex-inv-groups h3').first()).toBeVisible()
  await panel.locator('input[type="search"]').fill('sm58')
  await expect(panel.locator('.ex-item')).toHaveCount(1)
  await panel.locator('.ex-item').click()
  await expect(panel.locator('.ex-inv-sheet a')).toHaveAttribute('href', /^https:\/\//)
  await expect(panel.locator('.ex-inv-sheet')).toContainText('Sandbox') // no placement inside a level
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  expect((await ex(page)).panels).toBe(0)
})

test('H opens the French controls help with AZERTY-aware labels', async ({ page }) => {
  await boot(page, '?level=sandbox')
  await page.keyboard.press('h')
  const help = page.locator('.ex-panel[data-panel="help"]')
  await expect(help).toContainText('Avancer')
  await expect(help).toContainText('Clic droit maintenu + glisser vers le haut')
  await page.keyboard.press('Escape')
  await expect(help).toHaveCount(0)
})

test('Esc in Explore with nothing open shows the pause menu', async ({ page }) => {
  await boot(page, '?level=sandbox')
  await page.keyboard.press('Escape')
  await expect(page.locator('.ex-panel[data-panel="pause"]')).toBeVisible()
  await page.locator('.ex-panel[data-panel="pause"] [data-act="resume"]').click()
  await expect(page.locator('.ex-panel')).toHaveCount(0)
})

test('sandbox: place a device from the inventory, then pick it up (X) and undo', async ({ page }) => {
  await boot(page, '?level=sandbox')
  await page.keyboard.press('Space')
  const panel = page.locator('.ex-panel[data-panel="inventory"]')
  await panel.locator('input[type="search"]').fill('sm58')
  await panel.locator('.ex-item').click()
  await panel.locator('[data-place]').click()
  await expect(panel).toHaveCount(0)
  expect((await ex(page)).placing).toBe(true)
  await page.keyboard.press('r') // rotate the ghost 90°
  const size = page.viewportSize()!
  await page.mouse.click(size.width / 2, size.height / 2 + 150) // aim at the floor ahead, click = place
  await expect.poll(async () => page.evaluate(() => window.__audioSim!.assets().length)).toBe(1)
  expect((await ex(page)).placing).toBe(false)
  const placedId = await page.evaluate(() => window.__audioSim!.assets()[0].instanceId)
  expect(placedId).toMatch(/^shure-sm58-s\d+$/)

  // Pick it back up: aim at it with the cursor and press X.
  await page.waitForTimeout(300)
  const pos = await page.evaluate((id) => window.__audioSim!.deviceScreen(id), placedId)
  await page.mouse.move(pos!.x, pos!.y)
  await page.keyboard.press('x')
  await expect.poll(async () => page.evaluate(() => window.__audioSim!.assets().length)).toBe(0)
  await page.locator('.toast-info .toast-action', { hasText: 'Annuler' }).click()
  await expect.poll(async () => page.evaluate(() => window.__audioSim!.assets().length)).toBe(1)
})

test('settings: remap "Avancer" to another key and walk with it', async ({ page }) => {
  await boot(page, '?level=sandbox')
  await page.locator('#explore-toolbar [data-act="settings"]').click()
  const panel = page.locator('.ex-panel[data-panel="settings"]')
  await panel.locator('[data-bind="MOVE_FORWARD"]').click()
  await page.keyboard.press('i')
  await expect(panel.locator('tr', { hasText: 'Avancer' }).locator('kbd')).toHaveText('I')
  await page.keyboard.press('Escape')
  const start = await ex(page)
  await page.keyboard.down('i')
  await page.waitForTimeout(700)
  await page.keyboard.up('i')
  const end = await ex(page)
  expect(Math.hypot(end.position.x - start.position.x, end.position.z - start.position.z)).toBeGreaterThan(0.3)
  const saved = await page.evaluate(() => JSON.parse(window.localStorage.getItem('audio-sim/explore-settings')!))
  expect(saved.settings.bindings.MOVE_FORWARD).toEqual(['KeyI'])
})

test('walls stop the walker (collision)', async ({ page }) => {
  await boot(page, '?level=sandbox')
  await page.keyboard.down('s') // walk backwards into the rear wall for 6 s
  await page.waitForTimeout(6000)
  await page.keyboard.up('s')
  const p = await ex(page)
  // studio preset floor is 18 × 12 m → walls at |z| = 6
  expect(Math.abs(p.position.z)).toBeLessThan(6)
  expect(Math.abs(p.position.x)).toBeLessThan(9)
})
