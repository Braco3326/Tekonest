/**
 * Task 37 screenshots, on demand only (never in the normal suite, so e2e runs never rewrite committed files). PowerShell:
 *   $env:COVERAGE_SCREENS = '1';      npx playwright test tests/e2e/creation-coverage-screens.spec.ts   → test-results/screens/
 *   $env:COVERAGE_SCREENS = 'commit'; npx playwright test tests/e2e/creation-coverage-screens.spec.ts   → also docs/creative/screens/
 * The speaker-front shots are the evidence of the .glb front check (ADR-0015, docs/CREATIVE-MODE-LOG.md L30): a K12.2 at yaw 0 seen from
 * above and from +z (the audience), with the aim line of its acoustic axis and the connector markers.
 */
import { test, type Page } from '@playwright/test'

const MODE = process.env.COVERAGE_SCREENS
test.skip(!MODE, 'screenshots on demand: set COVERAGE_SCREENS')
test.use({ viewport: { width: 1366, height: 768 }, launchOptions: { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] } })

const OUT = 'test-results/screens'
const DOCS = 'docs/creative/screens'

const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 5)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } })
    c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-r' }, b: { instance: 'k12-d', port: 'in-line-a' } })
    c.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true })
  })
  await page.getByRole('menuitem', { name: 'Écoute' }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Couverture' }).click()
  await page.waitForFunction(() => window.__creation!.coverage().status === 'ready' && !window.__creation!.coverage().pending)
  await page.evaluate(() => document.fonts.ready)
}
const shot = async (page: Page, name: string): Promise<void> => {
  await page.mouse.move(1300, 420)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  if (MODE === 'commit') await page.screenshot({ path: `${DOCS}/${name}.png` })
}

test('coverage screenshots', async ({ page }) => {
  await boot(page)
  const m = await page.evaluate(() => {
    const h = (sel: string): number => Math.round(document.querySelector(sel)!.getBoundingClientRect().height)
    return { propsBody: h('.cr-props .cr-panel-body'), coverage: h('.cr-cov'), coverageScroll: Math.round(document.querySelector('.cr-cov')!.scrollHeight), cableLegend: h('.cr-legend'), aside: h('.cr-props') }
  })
  console.log('[measure 1366x768, coverage open, caveat shown]', JSON.stringify(m))
  await shot(page, 'task-37-coverage-1366')
  // the click-to-pin state and the chip pop-over
  await page.getByRole('button', { name: 'Épingler Régie' }).click()
  await page.getByTestId('coverage-chip').click()
  await shot(page, 'task-37-coverage-pinned-1366')
})

test('speaker front shots: a K12.2 at yaw 0, from above and from the audience side', async ({ page }) => {
  await boot(page)
  await page.getByTestId('coverage-chip').scrollIntoViewIfNeeded()
  await page.locator('#renderCanvas').focus()
  for (let i = 0; i < 8 && (await page.evaluate(() => window.__creation!.selection())) !== 'k12-g'; i++) await page.keyboard.press(']')
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('dessus'))
  await page.waitForTimeout(400)
  await shot(page, 'task-37-speaker-front-top')
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('face-gauche'))
  await page.waitForTimeout(400)
  await shot(page, 'task-37-speaker-front-from-audience')
})
