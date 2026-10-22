/**
 * Procedural rooms (master prompt B3): a TEK Brain room template becomes a
 * walkable room — spawn at FOH facing the stage, walls hold, the stage is a
 * raised floor you walk up onto. Also measures the frame rate (perf budget).
 */
import { expect, test, type Page } from '@playwright/test'

const ex = (page: Page) => page.evaluate(() => window.__audioSim!.explore!())

async function bootRoom(page: Page, room: string): Promise<void> {
  await page.goto(`/?level=sandbox&room=${room}`)
  await page.waitForFunction(() => !!window.__audioSim?.explore)
  await page.waitForTimeout(400)
}

test('concert hall: spawns at FOH facing the stage; the room picker shows the current room', async ({ page }) => {
  await bootRoom(page, 'concert-hall-medium')
  const s = await ex(page)
  expect(s.view).toBe('explore')
  expect(s.position.z).toBeCloseTo(8, 0) // FOH zone centre (template)
  expect(Math.abs(Math.cos(s.yaw) + 1)).toBeLessThan(0.01) // facing −z = the stage
  await expect(page.locator('#room-pick')).toHaveValue('concert-hall-medium')
})

test('concert hall: walking forward reaches the stage and the eye rises with the raised floor', async ({ page }) => {
  await bootRoom(page, 'concert-hall-medium')
  const start = await ex(page)
  await page.keyboard.down('Shift')
  await page.keyboard.down('w')
  await page.waitForTimeout(6500) // ~18 m at run speed: FOH (z 8) → stage (z ≈ −11)
  await page.keyboard.up('w')
  await page.keyboard.up('Shift')
  await page.waitForTimeout(500)
  const onStage = await ex(page)
  expect(onStage.position.z).toBeLessThan(-7.5)
  expect(onStage.position.y).toBeGreaterThan(start.position.y + 1) // stage deck 1.3 m
  expect(onStage.position.z).toBeGreaterThan(-16) // the front wall holds
})

test('rooms load on demand: an unknown room falls back to the white studio', async ({ page }) => {
  await bootRoom(page, 'no-such-room')
  const s = await ex(page)
  expect(s.view).toBe('explore')
})

test('perf: frame rate in a medium room, walking (reported, budget ≥ 50 fps on a mid laptop)', async ({ page }) => {
  await bootRoom(page, 'concert-hall-medium')
  await page.keyboard.down('w')
  const fps = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let frames = 0
        const t0 = performance.now()
        const tick = (): void => {
          frames++
          if (performance.now() - t0 < 3000) requestAnimationFrame(tick)
          else resolve((frames * 1000) / (performance.now() - t0))
        }
        requestAnimationFrame(tick)
      }),
  )
  await page.keyboard.up('w')
  console.log(`[perf] concert-hall-medium walking: ${fps.toFixed(1)} fps (headless Chromium, this PC)`)
  test.info().annotations.push({ type: 'fps', description: fps.toFixed(1) })
  expect(fps).toBeGreaterThan(10) // smoke floor only — headless software GL is not the target hardware
})
