/**
 * Task 18 screenshots, on demand only (never in the normal suite, so e2e runs never rewrite
 * committed files). PowerShell:
 *   $env:VIEWS_SCREENS = '1';      npx playwright test tests/e2e/creation-views-screens.spec.ts   → test-results/screens/
 *   $env:VIEWS_SCREENS = 'commit'; npx playwright test tests/e2e/creation-views-screens.spec.ts   → also docs/creative/screens/
 */
import { expect, test, type Page } from '@playwright/test'

const MODE = process.env.VIEWS_SCREENS
test.skip(!MODE, 'screenshots on demand: set VIEWS_SCREENS')
test.use({
  viewport: { width: 1366, height: 768 },
  // The real GPU when there is one (as the Task 17 screens): SwiftShader renders blurrier than users see.
  launchOptions: { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] },
})

const OUT = 'test-results/screens'
const DOCS = 'docs/creative/screens'

const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 4] }))
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(800)
}

test('views screenshots (V picker, Vue › Vues submenu)', async ({ page }) => {
  await boot(page)
  // the pointer rests on the empty Propriétés panel: no hover style in the shots (review Fix 1)
  const away = () => page.mouse.move(1300, 420)
  await away()

  // V picker from the canvas, focus moved one step (focused cell + the « current » mark both show)
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('dessus-face'))
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('v')
  await expect(page.getByRole('dialog', { name: 'Choisir une vue' })).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/task-18-view-picker.png` })
  if (MODE === 'commit') await page.screenshot({ path: `${DOCS}/task-18-view-picker.png` })
  await page.keyboard.press('Escape')

  // Vue › Vues by keyboard, focus a few items down (a group change visible)
  await page.locator('#cr-menu-projet').focus()
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowRight')
  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/task-18-vue-menu-views.png` })
  if (MODE === 'commit') await page.screenshot({ path: `${DOCS}/task-18-vue-menu-views.png` })
  // pointer hover on a corner item
  await page.getByRole('menuitem', { name: 'Dessus · Arrière · Droite', exact: true }).hover()
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${OUT}/task-18-vue-menu-hover.png` })
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')

  // 1100 px (1366 at 125 % zoom ≈ 1093): the submenu slides left, never off-screen (review Fix 1)
  await page.setViewportSize({ width: 1100, height: 768 })
  await page.mouse.move(1000, 700)
  await page.locator('#cr-menu-vue').focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('End')
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/task-18-vue-menu-views-1100.png` })
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')

  // narrow window: the picker still fits (no page scroll)
  await page.setViewportSize({ width: 900, height: 640 })
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('v')
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/task-18-view-picker-900.png` })
  expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0])
})
