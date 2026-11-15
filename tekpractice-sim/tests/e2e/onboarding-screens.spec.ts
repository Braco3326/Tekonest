/**
 * Screens of the five design packages for the founder to look at (onboarding packs, plan T4, spec 12): 1366 x 768, one start screen and one room per package, written to
 * test-results/screens/pkg-<n>-start.png, pkg-<n>-room.png and pkg-<n>-connect.png (git-ignored; Playwright empties test-results at the start of each run, so run this file LAST).
 * OFF unless `ONBOARDING_SCREENS=1` (it asserts nothing, so baselines skip it): `$env:ONBOARDING_SCREENS='1'; $env:E2E_PORT='4391'; npx.cmd playwright test onboarding-screens` after a fresh build.
 * The room is the neutral room opened through « Je découvre » + « Passer »: the panels are the package's own, the drawer is open on Consoles, a QL1, an SM58 and a K12.2
 * stand on the floor and the QL1 is selected. Nothing is asserted but that the page drew (the colours are measured in onboarding-contrast.spec.ts).
 */
import { mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { answerFirstQuestion } from './onboardingKit'
import { DESIGN_IDS, packageById } from '../../src/design/packages'

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

    await answerFirstQuestion(page, '1') // package 2 asks the goal screens (mission 1): the goal of that profile there
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
    // T6.3: the first room of a package that starts on the playable model already holds these devices (the SPAWNs above are refused) and its two line cables: unplug them, so the QL1's
    // « Connecter à… » row below exists (setup only)
    if (packageById(id).layout.start === 'playable-model')
      await page.evaluate(() => {
        for (const [k, port] of [['k12-g', 'out-main-l'], ['k12-d', 'out-main-r']] as const) window.__creation!.dispatch({ type: 'UNPLUG', a: { instance: 'ql1', port }, b: { instance: k, port: 'in-line-a' } })
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

// T6.1: the step card at 1366 x 768 in every package, for the founder to look at: the tutorial taken, the console placed, the mic step passed (a « passée » mark and its key), the speaker
// placed, step 4 current. Written to test-results/screens/pkg-<n>-card.png. Nothing is asserted but that the card drew.
for (const id of DESIGN_IDS) {
  test(`package ${id}: the tutorial step card at 1366 x 768`, async ({ page }) => {
    mkdirSync(OUT, { recursive: true })
    await page.goto(`/?design=${id}`)
    await page.evaluate(() => window.localStorage.clear())
    await page.reload()
    await page.waitForFunction(() => !!window.__creation)
    await answerFirstQuestion(page, '1', 'click')
    await page.getByTestId('start-screen').getByRole('button', { name: /^Faire le tutoriel/ }).click()
    await page.waitForFunction(() => window.__creation!.place() === 'blank')
    await expect(page.getByTestId('tutorial-card')).toBeVisible({ timeout: 10_000 })
    if (packageById(id).layout.start === 'playable-model') {
      // T6.3: the first room is the playable model, step 1 of 3 (Écoute): pkg-<n>-model.png
      await expect(page.getByTestId('tutorial-step-count')).toHaveText('Étape 1 sur 3', { timeout: 10_000 })
      await page.waitForFunction(() => !window.__creation!.cameraMoving() && window.__creation!.modelsPending() === 0)
      await page.waitForTimeout(900)
      await page.screenshot({ path: `${OUT}/pkg-${id}-model.png` })
      return
    }
    const place = (device: string, instance: string, x: number) =>
      page.evaluate(([d, i, px]) => void window.__creation!.dispatch({ type: 'SPAWN', deviceId: d, instanceId: i, position: [px, 0, 0], rotationY: 0 } as never), [device, instance, x] as const)
    await place('yamaha-ql1', 'ql1', 0)
    await expect(page.getByTestId('tutorial-step-count')).toHaveText('Étape 2 sur 10', { timeout: 10_000 })
    await page.locator('.oscar-chips').getByRole('button', { name: 'Passer cette étape', exact: true }).click()
    await place('qsc-k12-2', 'k12', -1)
    await expect(page.getByTestId('tutorial-step-count')).toHaveText('Étape 4 sur 10', { timeout: 10_000 })
    await page.waitForFunction(() => !window.__creation!.cameraMoving() && window.__creation!.modelsPending() === 0)
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${OUT}/pkg-${id}-card.png` })
  })
}

// T6.2: package 2's docked checklist (a blocked bench, so every state shows) and package 2 / 3 menus (the shortcut beside the label, or at the end of the row): pkg-2-dock.png, pkg-2-menu.png,
// pkg-3-menu.png. Nothing is asserted but that the page drew.
for (const id of [2, 3] as const) {
  test(`package ${id}: ${id === 2 ? 'the docked checklist and the menu' : 'the menu'} at 1366 x 768`, async ({ page }) => {
    mkdirSync(OUT, { recursive: true })
    await page.goto(`/?design=${id}`)
    await page.evaluate(() => window.localStorage.clear())
    await page.reload()
    await page.waitForFunction(() => !!window.__creation)
    await answerFirstQuestion(page, '1') // package 2 asks the goal screens (mission 1): the goal of that profile there
    await page.getByRole('button', { name: 'Passer, je connais', exact: true }).click()
    await page.waitForFunction(() => window.__creation!.place() === 'blank')
    await page.evaluate(() => {
      const c = window.__creation!
      c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 0], rotationY: 0 } as never)
      c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12', position: [-1, 0, 0], rotationY: 0 } as never)
      c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12', port: 'in-line-a' } } as never)
    })
    await page.waitForFunction(() => !window.__creation!.cameraMoving() && window.__creation!.modelsPending() === 0)
    await page.waitForTimeout(600)
    if (id === 2) await page.screenshot({ path: `${OUT}/pkg-2-dock.png` })
    await page.locator('#cr-menu-projet').click()
    await page.screenshot({ path: `${OUT}/pkg-${id}-menu.png`, clip: { x: 0, y: 0, width: 760, height: 330 } })
  })
}

// T6.4: the entrepreneur's card after the first sound (profile 3), at 1366 x 768, in a dark package (1), the Papier sheet (3) and the model package (5): pkg-<n>-gear.png.
// The sound plays (the test signal through the real menu). Nothing is asserted but that the card drew.
for (const id of [1, 3, 5] as const) {
  test(`package ${id}: the entrepreneur's card after the first sound at 1366 x 768`, async ({ page }) => {
    mkdirSync(OUT, { recursive: true })
    await page.goto(`/?design=${id}`)
    await page.evaluate(() => window.localStorage.clear())
    await page.reload()
    await page.waitForFunction(() => !!window.__creation)
    await page.getByTestId('start-screen').waitFor()
    await page.keyboard.press('3')
    await page.getByRole('button', { name: 'Passer, je connais', exact: true }).click()
    await page.waitForFunction(() => window.__creation!.place() === 'blank')
    if ((await page.evaluate(() => window.__creation!.design().rig.instances.length)) === 0)
      await page.evaluate(() => {
        const c = window.__creation!
        for (const i of [
          { type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 0] },
          { type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12', position: [-1, 0, 0] },
          { type: 'SPAWN', deviceId: 'multiprise-secteur', instanceId: 'strip', position: [0.4, 0, 0] },
          { type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12', port: 'in-line-a' } },
          { type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true },
          { type: 'CONNECT', a: { instance: 'strip', port: 'out-1' }, b: { instance: 'ql1', port: 'power-in' } },
          { type: 'CONNECT', a: { instance: 'strip', port: 'out-2' }, b: { instance: 'k12', port: 'power-in' } },
        ])
          c.dispatch(i as never)
      })
    await page.waitForFunction(() => !window.__creation!.cameraMoving() && window.__creation!.modelsPending() === 0)
    await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Signal de test', exact: true }).click()
    await page.waitForFunction(() => window.__creation!.audioState().state === 'playing', null, { timeout: 15_000 })
    await expect(page.getByTestId('own-gear')).toBeVisible()
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${OUT}/pkg-${id}-gear.png` })
  })
}
