/* eslint-env node */
// Third pass: the 3D patch with the target brought into view by the user's own means (Alt+H, wheel, orbit drag on empty floor),
// a deliberate refused connection in 3D (R2 out-main-l → in-mic-2) read at the port, then undo / redo on that cable.
import { URL_APP, SHOTS, launch, instrument, recorder, saveResults, settle, sleep } from './lib.mjs'
import { pathToFileURL } from 'node:url'
import { summarise } from './ca.mjs'

const W = { width: 1366, height: 768 }
const C = (page, fn, arg) => page.evaluate(fn, arg)
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` })
const nConn = async (page) => (await C(page, () => window.__creation.design())).rig.connections.length

export async function runCA3() {
  const browser = await launch()
  const ctx = await browser.newContext({ viewport: W, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const log = instrument(page, 'ca3-1366')
  const { steps, step } = recorder()
  await page.goto(URL_APP)
  await page.waitForFunction(() => !!window.__creation, null, { timeout: 30000 })
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation.place() === 'room:concert-hall-medium' && window.__creation.design().rig.instances.length === 5, null, { timeout: 60000 })
  await page.waitForFunction(() => window.__creation.modelsPending() === 0, null, { timeout: 60000 })
  await settle(page)
  const vp = await page.getByTestId('viewport').boundingBox()
  const clear = async (b) => {
    if (!b) return false
    const r = await C(page, () => window.__creation.cubeRect())
    const inCube = b.x >= r.x - 4 && b.x <= r.x + r.width + 4 && b.y >= r.y - 4 && b.y <= r.y + r.height + 30
    return !inCube && b.x > vp.x + 10 && b.x < vp.x + vp.width - 10 && b.y > vp.y + 10 && b.y < vp.y + vp.height - 10
  }
  const selectDev = async (id) => {
    await page.locator('#renderCanvas').focus()
    for (let i = 0; i < 8 && (await C(page, () => window.__creation.selection())) !== id; i++) await page.keyboard.press(']')
    await page.waitForFunction(() => !window.__creation.cameraMoving(), null, { timeout: 10000 })
    await settle(page)
  }
  const portPt = (inst, port) => C(page, ([i, p]) => window.__creation.portScreen({ instance: i, port: p }), [inst, port])
  const hitAt = (b) => C(page, ([x, y]) => window.__creation.portAtPoint(x, y), [b.x - vp.x, b.y - vp.y])

  await step('CA-09.patch3D', async () => {
    const before = await nConn(page)
    await selectDev('ql1')
    const a = await portPt('ql1', 'out-main-l')
    await page.mouse.click(a.x, a.y)
    await sleep(300)
    const pending1 = await C(page, () => window.__creation.patchPending())
    const log = []
    // 1) Alt+H: the overview
    await page.keyboard.press('Alt+h')
    await sleep(700)
    let b = await portPt('k12-g', 'in-line-a')
    log.push({ after: 'Alt+H', b, clear: await clear(b), hit: b ? await hitAt(b) : null, pending: !!(await C(page, () => window.__creation.patchPending())) })
    // 2) wheel zoom in toward the speaker if needed
    for (let i = 0; i < 6 && !((await clear(b)) && (await hitAt(b))?.port === 'in-line-a'); i++) {
      // orbit with a drag that starts on empty floor near the bottom of the view
      await page.mouse.move(vp.x + vp.width * 0.5, vp.y + vp.height * 0.92)
      await page.mouse.down()
      await page.mouse.move(vp.x + vp.width * 0.5 + 60, vp.y + vp.height * 0.92, { steps: 6 })
      await page.mouse.up()
      await sleep(400)
      b = await portPt('k12-g', 'in-line-a')
      log.push({ after: 'orbit drag', b, clear: await clear(b), hit: b ? await hitAt(b) : null, pending: !!(await C(page, () => window.__creation.patchPending())) })
    }
    await shot(page, 'ca3-09-before-second-click')
    await page.mouse.click(b.x, b.y)
    await sleep(600)
    const status = await page.getByRole('status').first().innerText().catch(() => '')
    await shot(page, 'ca3-09-patched-3d')
    return { before, after: await nConn(page), pending1, log, status }
  })

  await step('undoRedo', async () => {
    await page.locator('#renderCanvas').focus()
    const a = await nConn(page)
    await page.keyboard.press('Control+z'); await sleep(300)
    const b = await nConn(page)
    await page.keyboard.press('Control+y'); await sleep(300)
    const c = await nConn(page)
    await page.keyboard.press('Control+z'); await sleep(300)
    await page.keyboard.press('Control+Shift+z'); await sleep(300)
    return { connections: [a, b, c, await nConn(page)], status: await page.getByRole('status').first().innerText().catch(() => '') }
  })

  await step('CA-15.refused3D', async () => {
    await page.keyboard.press('Escape')
    await selectDev('ql1')
    const a = await portPt('ql1', 'out-main-r')
    const b = await portPt('ql1', 'in-mic-2')
    await page.mouse.click(a.x, a.y)
    await sleep(300)
    await page.mouse.click(b.x, b.y)
    await sleep(500)
    const alerts = await page.getByRole('alert').allInnerTexts()
    const portErr = await page.getByTestId('port-error').allInnerTexts().catch(() => [])
    const status = await page.getByRole('status').first().innerText().catch(() => '')
    const signal = await page.getByTestId('signal-status').innerText()
    await shot(page, 'ca3-15-refused-at-port')
    return { a, b, alerts, portErr, status, signal, conns: await nConn(page) }
  })
  await browser.close()
  saveResults('ca3', { steps, log: summarise(log) })
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) await runCA3()
