/**
 * Task 20 visual check, on demand only (never in the normal suite). PowerShell:
 *   $env:POINTS_SCREENS = '1'; npx playwright test tests/e2e/creation-points-screens.spec.ts   → test-results/screens/
 * Per room: a top view with the listening points drawn as DOM dots (projected from their world
 * position at floor level: Régie must sit on the drawn foh zone), then the view from each point.
 */
import { test, type Page } from '@playwright/test'

test.skip(!process.env.POINTS_SCREENS, 'screenshots on demand: set POINTS_SCREENS')
test.use({
  viewport: { width: 1366, height: 768 },
  launchOptions: { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] },
})

const OUT = 'test-results/screens'
const ROOMS = ['concert-hall-medium', 'theatre-black-box-small', 'opera-house-pit-large']

const boot = async (page: Page, room: string): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate((r) => window.__creation!.choosePlace(`room:${r}`), room)
  await page.waitForFunction((r) => window.__creation!.place() === `room:${r}`, room)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(600)
  await page.mouse.move(1300, 420)
}

for (const room of ROOMS)
  test(`points: ${room}`, async ({ page }) => {
    await boot(page, room)
    await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('dessus'))
    // dolly out until the whole room is in the frame
    await page.mouse.move(650, 400)
    for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 400)
    await page.mouse.move(1300, 420)
    await page.waitForFunction(() => !window.__creation!.cameraMoving())
    await page.waitForTimeout(300)
    await page.evaluate(() => {
      const c = window.__creation!
      for (const p of c.listeningPoints()) {
        const s = c.worldScreen([p.position[0], p.position[1] - c.earHeight(), p.position[2]])
        if (!s) continue
        const d = document.createElement('div')
        d.className = 'pt-dot'
        d.textContent = `● ${p.label}`
        Object.assign(d.style, {
          position: 'fixed', left: `${s.x - 6}px`, top: `${s.y - 9}px`, color: '#00e0ff',
          font: '600 13px sans-serif', textShadow: '0 0 3px #000', pointerEvents: 'none', zIndex: '9999',
        })
        document.body.appendChild(d)
      }
    })
    await page.screenshot({ path: `${OUT}/points-${room}-top.png` })
    await page.evaluate(() => document.querySelectorAll('.pt-dot').forEach((d) => d.remove()))
    const n = (await page.evaluate(() => window.__creation!.listeningPoints())).length
    await page.locator('#renderCanvas').focus()
    for (let i = 1; i <= n; i++) {
      await page.keyboard.press(`Digit${i}`)
      await page.waitForTimeout(300)
      const id = await page.evaluate(() => window.__creation!.listenerPoint())
      await page.screenshot({ path: `${OUT}/points-${room}-${id}.png` })
    }
  })
