/**
 * Task 17 screenshots, on demand only (never in the normal suite, so e2e runs never rewrite
 * committed files). PowerShell:
 *   $env:CUBE_SCREENS = '1';      npx playwright test tests/e2e/creation-cube-screens.spec.ts   → test-results/screens/
 *   $env:CUBE_SCREENS = 'commit'; npx playwright test tests/e2e/creation-cube-screens.spec.ts   → also docs/creative/screens/
 */
import { expect, test, type Page } from '@playwright/test'

const MODE = process.env.CUBE_SCREENS
test.skip(!MODE, 'screenshots on demand: set CUBE_SCREENS')
test.use({
  viewport: { width: 1366, height: 768 },
  // The real GPU when there is one: headless SwiftShader renders at 1/1.5 scale (software GL), blurrier than users see.
  launchOptions: { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] },
})

const OUT = 'test-results/screens'
const DOCS = 'docs/creative/screens'

const boot = async (page: Page): Promise<void> => {
  page.on('console', (m) => m.text().includes('[render]') && console.log(m.text()))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(800)
}

/** The cube square and a margin around it, for close-up checks (labels, accents, hover). */
const cubeClip = async (page: Page) => {
  const r = await page.evaluate(() => window.__creation!.cubeRect())
  return { x: r.x - 16, y: r.y - 16, width: r.width + 32, height: r.height + 32 }
}

test('cube screenshots (idle, hover edge, every face, corners)', async ({ page }) => {
  await boot(page)
  // the place's own opening pose
  await page.mouse.move(700, 500)
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/task-17-cube-idle.png` })
  await page.screenshot({ path: `${OUT}/task-17-cube-idle-zoom.png`, clip: await cubeClip(page) })
  if (MODE === 'commit') await page.screenshot({ path: `${DOCS}/task-17-cube-idle.png` })

  // hover the top-front edge from the place's pose
  const r = await page.evaluate(() => window.__creation!.cubeRect())
  const edge = await page.evaluate((rr) => {
    const c = window.__creation!
    for (let y = rr.y + 2; y < rr.y + rr.height; y += 2)
      for (let x = rr.x + 2; x < rr.x + rr.width; x += 2) if (c.cubeZoneAt(x, y) === 'dessus-face') return { x, y }
    return null
  }, r)
  expect(edge).not.toBeNull()
  // the middle of that patch: scan its extent on the row found
  await page.mouse.move(edge!.x + 20, edge!.y + 3)
  await expect.poll(() => page.evaluate(() => window.__creation!.cubeHover())).toBe('dessus-face')
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/task-17-cube-hover-edge.png` })
  await page.screenshot({ path: `${OUT}/task-17-cube-hover-edge-zoom.png`, clip: await cubeClip(page) })
  if (MODE === 'commit') await page.screenshot({ path: `${DOCS}/task-17-cube-hover-edge.png` })
  await page.mouse.move(700, 500)

  for (const id of ['face', 'arriere', 'droite', 'gauche', 'dessus', 'dessous', 'dessus-face-droite', 'dessous-arriere-gauche', 'dessus-arriere']) {
    await page.evaluate((z) => window.__creation!.cubeZoneScreenPoint(z), id)
    await page.waitForTimeout(250)
    await page.screenshot({ path: `${OUT}/task-17-cube-${id}-zoom.png`, clip: await cubeClip(page) })
  }
  await page.screenshot({ path: `${OUT}/task-17-cube-last-full.png` })

  // hover at the centre of a few poses: the patch covers its zone on every face it touches
  for (const id of ['dessus-face', 'dessus-face-droite', 'face-droite']) {
    const pt = await page.evaluate((z) => window.__creation!.cubeZoneScreenPoint(z), id)
    await page.mouse.move(pt!.x, pt!.y)
    await expect.poll(() => page.evaluate(() => window.__creation!.cubeHover())).toBe(id)
    await page.waitForTimeout(150)
    await page.screenshot({ path: `${OUT}/task-17-cube-hover-${id}-zoom.png`, clip: await cubeClip(page) })
    await page.mouse.move(700, 500)
  }

  // a selected device: the Ambre stroke stays in the room, none in the cube
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('dessus-face-droite'))
  // 1600 px: the 130 px cube
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/task-17-cube-1600.png` })
  // panel folded: the cube follows the viewport's corner
  await page.getByRole('button', { name: 'Replier le panneau Projet' }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/task-17-cube-tree-folded.png` })
})
