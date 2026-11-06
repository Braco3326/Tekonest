import { test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

/**
 * Look audit (a tool, NOT a gate: it skips itself unless AUDIT_OUT is set): puts each shipped device alone on the blank place of Mode Création,
 * selects it (the camera flies to it), deselects it (no outline, no port discs), and saves a screenshot of the 3D view from the rear (the default
 * framing) and from the front, so a model can be judged under the engine's own lighting next to its reference photo.
 *
 *   AUDIT_OUT=<folder> [AUDIT_IDS=id1,id2] [AUDIT_ZOOM=0.5] [E2E_PORT=4181] npx playwright test tests/e2e/look-audit.spec.ts
 *
 * AUDIT_ZOOM (default 1) scales the framing distance: 0.5 is a 2x close-up. Each device is shot from its four sides: <id>_v0 (the default rear
 * framing), _v1, _v2 (front), _v3.
 *
 * Needs a built `dist/` (npx vite build). With E2E_PORT it serves dist itself on that port instead of reusing a server on 4173.
 */
test.use({ viewport: { width: 1280, height: 720 } })
test.setTimeout(300_000)

const OUT = process.env.AUDIT_OUT
const ZOOM = Number(process.env.AUDIT_ZOOM ?? 1)
const IDS = (
  process.env.AUDIT_IDS ??
  'yamaha-ql1,yamaha-rio3224-d2,shure-sm58,shure-sm57,qsc-k12-2,yamaha-dbr12,km-210-9,axia-iq,ev-re20,yellowtec-mika,yellowtec-litt,genelec-8030c,playout-pc,aeta-scoop5-s,aeta-scoopy-plus-s,ev-re50,avid-protools-hdx,avid-hd-io,focusrite-isa-one,grace-m905,neumann-u87-ai,switchcraft-studiopatch-9625,antelope-ocx-hd,mogami-gold-db25-xlrm'
).split(',')

const settle = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0, null, { timeout: 30_000 })
  await page.waitForFunction(() => !window.__creation!.cameraMoving(), null, { timeout: 30_000 })
  await page.waitForTimeout(400)
}

test('look audit', async ({ page }) => {
  test.skip(!OUT, 'a tool: set AUDIT_OUT=<folder> to run it')
  mkdirSync(OUT!, { recursive: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  const report: string[] = []
  for (const id of IDS) {
    const instanceId = `audit-${id}`
    const r = await page.evaluate(
      ({ id, instanceId }) => window.__creation!.dispatch({ type: 'SPAWN', deviceId: id, instanceId, position: [0, 0, 0], rotationY: 0, mount: 'floor' } as never),
      { id, instanceId },
    )
    if (!(r as { ok: boolean }).ok) {
      report.push(`${id}: SPAWN refused ${JSON.stringify(r).slice(0, 120)}`)
      continue
    }
    await settle(page)
    await page.evaluate((i) => window.__creation!.frameDevice(i), instanceId)
    await settle(page)
    await page.evaluate(() => window.__creation!.frameDevice(null))
    if (ZOOM !== 1) await page.evaluate((z) => window.__creation!.setCameraRadius(window.__creation!.camera()!.radius * z), ZOOM)
    for (let v = 0; v < 4; v++) {
      await page.waitForTimeout(v === 0 ? 700 : 600)
      await page.locator('#renderCanvas').screenshot({ path: `${OUT}/${id}_v${v}.png` })
      await page.evaluate(() => window.__creation!.turnCamera(Math.PI / 2))
    }
    await page.evaluate((i) => window.__creation!.dispatch({ type: 'REMOVE', instanceId: i } as never), instanceId)
    report.push(`${id}: ok`)
  }
  console.log(report.join('\n'))
})
