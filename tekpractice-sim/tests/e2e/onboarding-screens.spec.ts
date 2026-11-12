/**
 * Screens of the five design packages for the founder to look at (onboarding packs, plan T4, spec 12): 1366 x 768, one start screen and one room per package, written to
 * test-results/screens/pkg-<n>-start.png, pkg-<n>-room.png and pkg-<n>-connect.png (git-ignored; Playwright empties test-results at the start of each run, so run this file LAST).
 * OFF unless `ONBOARDING_SCREENS=1` (it asserts nothing, so baselines skip it): `$env:ONBOARDING_SCREENS='1'; $env:E2E_PORT='4391'; npx.cmd playwright test onboarding-screens` after a fresh build.
 * The room is the neutral room opened through « Je découvre » + « Passer »: the panels are the package's own, the drawer is open on Consoles, a QL1, an SM58 and a K12.2
 * stand on the floor and the QL1 is selected. Nothing is asserted but that the page drew (the colours are measured in onboarding-contrast.spec.ts).
 */
import { mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { DESIGN_IDS } from '../../src/design/packages'

test.use({ viewport: { width: 1366, height: 768 } })
test.skip(process.env.ONBOARDING_SCREENS !== '1', 'screens for the founder: set ONBOARDING_SCREENS=1')
const OUT = 'test-results/screens'

for (const id of DESIGN_IDS) {
  test(`package ${id}: start screen and room at 1366 x 768`, async ({ page }) => {
    mkdirSync(OUT, { recursive: true })
    await page.goto(`/?design=${id}`)
    await page.evaluate(() => window.localStorage.clear())
    await page.reload()
    await page.waitForFunction(() => !!window.__creation)
    await page.getByTestId('start-screen').waitFor()
    await page.screenshot({ path: `${OUT}/pkg-${id}-start.png` })

    await page.keyboard.press('1')
    await page.getByRole('button', { name: 'Passer, je connais', exact: true }).click()
    await page.waitForFunction(() => window.__creation!.place() === 'blank')
    await expect(page.getByTestId('inventory-drawer')).toHaveAttribute('data-open', 'true')
    await page.evaluate(() => {
      const c = window.__creation!
      c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 0], rotationY: 0 })
      c.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58', position: [0.8, 0, 0], rotationY: 0 })
      c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12', position: [-1, 0, 0], rotationY: 0 })
      c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12b', position: [-2, 0, 0], rotationY: 0 })
      c.frameDevice('ql1')
    })
    await page.waitForFunction(() => !window.__creation!.cameraMoving() && window.__creation!.modelsPending() === 0)
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/pkg-${id}-room.png` })

    // « Connecter à… »: the active option and a hovered one (T4 fix round 2: the wash of a hovered / selected row must be visibly distinct from the list on every package)
    if ((await page.getByTestId('props-collapse').getAttribute('aria-expanded')) !== 'true') await page.getByTestId('props-collapse').click()
    const connect = page.locator('[data-testid="properties-content"] [data-key="connect:out-main-l"]')
    await connect.scrollIntoViewIfNeeded()
    await connect.click()
    await page.locator('.cr-connect-opt').first().waitFor()
    if ((await page.locator('.cr-connect-opt').count()) > 1) await page.locator('.cr-connect-opt').nth(1).hover()
    await page.screenshot({ path: `${OUT}/pkg-${id}-connect.png` })
  })
}
