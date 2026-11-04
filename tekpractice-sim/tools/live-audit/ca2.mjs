/* eslint-env node */
// Second pass on the steps that need care: 3D patch avoiding the cube, the refused connection (R3), drag of a floor device
// and of a stand device, undo / redo on a known step, placement at 30 % / 70 % from the home view, cable colours.
import { URL_APP, SHOTS, launch, instrument, recorder, saveResults, settle, sleep, axe } from './lib.mjs'
import { pathToFileURL } from 'node:url'
import { summarise } from './ca.mjs'

const W = { width: 1366, height: 768 }
const C = (page, fn, arg) => page.evaluate(fn, arg)
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` })
const design = (page) => C(page, () => window.__creation.design())
const nConn = async (page) => (await design(page)).rig.connections.length

export async function runCA2() {
  const browser = await launch()
  const ctx = await browser.newContext({ viewport: W, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const log = instrument(page, 'ca2-1366')
  const { steps, step } = recorder()
  const axes = []
  await page.goto(URL_APP)
  await page.waitForFunction(() => !!window.__creation, null, { timeout: 30000 })
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation.place() === 'room:concert-hall-medium' && window.__creation.design().rig.instances.length === 5, null, { timeout: 60000 })
  await page.waitForFunction(() => window.__creation.modelsPending() === 0, null, { timeout: 60000 })
  await settle(page)

  const inCube = async (p) => C(page, (q) => { const r = window.__creation.cubeRect(); return q.x >= r.x - 4 && q.x <= r.x + r.width + 4 && q.y >= r.y - 4 && q.y <= r.y + r.height + 30 }, p)
  const selectDev = async (id) => {
    await page.locator('#renderCanvas').focus()
    for (let i = 0; i < 8 && (await C(page, () => window.__creation.selection())) !== id; i++) await page.keyboard.press(']')
    await page.waitForFunction(() => !window.__creation.cameraMoving(), null, { timeout: 10000 })
    await settle(page)
  }
  await step('ports', async () => ({ ql1: await C(page, () => window.__creation.devicePorts('ql1')), k12: await C(page, () => window.__creation.devicePorts('k12-g')) }))

  await step('CA-09.patchMouse', async () => {
    const before = await nConn(page)
    await selectDev('ql1')
    const a = await C(page, () => window.__creation.portScreen({ instance: 'ql1', port: 'out-main-l' }))
    await page.mouse.click(a.x, a.y)
    await sleep(300)
    const pending = await C(page, () => window.__creation.patchPending())
    let b = await C(page, () => window.__creation.portScreen({ instance: 'k12-g', port: 'in-line-a' }))
    const firstUnderCube = await inCube(b)
    const tries = []
    // A person turns the view until the target is clear: arrow keys orbit the canvas (keeps the cable in hand).
    for (let i = 0; i < 16; i++) {
      b = await C(page, () => window.__creation.portScreen({ instance: 'k12-g', port: 'in-line-a' }))
      const vp = await page.getByTestId('viewport').boundingBox()
      const ok = b && b.x > vp.x + 10 && b.x < vp.x + vp.width - 10 && b.y > vp.y + 10 && b.y < vp.y + vp.height - 10 && !(await inCube(b))
      const hit = b ? await C(page, ([x, y, vx, vy]) => window.__creation.portAtPoint(x - vx, y - vy), [b.x, b.y, vp.x, vp.y]) : null
      tries.push({ b, ok, hit })
      if (ok && hit && hit.instance === 'k12-g' && hit.port === 'in-line-a') break
      await page.keyboard.press(i < 8 ? 'ArrowLeft' : 'ArrowDown')
      await sleep(250)
    }
    await page.mouse.click(b.x, b.y)
    await sleep(500)
    const status = await page.getByRole('status').first().innerText().catch(() => '')
    await shot(page, 'ca2-09-patched-3d')
    const after = await nConn(page)
    return { before, after, pending, firstTargetUnderCube: firstUnderCube, triesNeeded: tries.length, lastTry: tries[tries.length - 1], status }
  })

  await step('undoRedo', async () => {
    await page.locator('#renderCanvas').focus()
    const a = await nConn(page)
    await page.keyboard.press('Control+z')
    await sleep(300)
    const b = await nConn(page)
    await page.keyboard.press('Control+y')
    await sleep(300)
    const c = await nConn(page)
    await page.keyboard.press('Control+z')
    await sleep(300)
    await page.keyboard.press('Control+Shift+z')
    await sleep(300)
    return { connections: [a, b, c], afterCtrlShiftZ: await nConn(page) }
  })

  await page.keyboard.press('Alt+h')
  await sleep(600)
  await step('CA-15.wrongConnection', async () => {
    await selectDev('ql1')
    const ports = await C(page, () => window.__creation.devicePorts('ql1'))
    const ins = ports.filter((p) => /^in-mic-\d+$/.test(p)).slice(1, 3)
    const vp = await page.getByTestId('viewport').boundingBox()
    const pa = await C(page, (p) => window.__creation.portScreen({ instance: 'ql1', port: p }), ins[0])
    const pb = await C(page, (p) => window.__creation.portScreen({ instance: 'ql1', port: p }), ins[1])
    await page.mouse.click(pa.x, pa.y)
    await sleep(300)
    const pend = await C(page, () => window.__creation.patchPending())
    await page.mouse.click(pb.x, pb.y)
    await sleep(700)
    const alerts = await page.getByRole('alert').allInnerTexts()
    const status = await page.getByRole('status').first().innerText().catch(() => '')
    const signal = await page.getByTestId('signal-status').innerText()
    const extra = await page.getByTestId('signal-extra').innerText().catch(() => '')
    await shot(page, 'ca2-15-wrong-connection')
    if (await C(page, () => window.__creation.patchPending())) await page.keyboard.press('Escape')
    return { ports: ins, pend, pa, pb, vp, alerts, status, signal, extra, english: /MISMATCH|Signal flows/i.test(alerts.join(' ') + status) }
  })
  await step('errorList', async () => {
    await page.getByTestId('signal-status').click()
    const dlg = page.getByRole('dialog', { name: 'Erreurs et avertissements' })
    await dlg.waitFor({ timeout: 5000 })
    const rows = await dlg.locator('.cr-errlist-row').allInnerTexts()
    axes.push(await axe(page, ['[data-testid="error-list"]', '[data-testid="status-bar"]'], 'error-list-1366-with-row'))
    await shot(page, 'ca2-15b-error-list')
    await page.keyboard.press('Escape')
    await sleep(10500)
    await page.getByTestId('signal-status').click()
    const later = await dlg.locator('.cr-errlist-row').count()
    await page.keyboard.press('Escape')
    return { rows: rows.map((r) => r.replace(/\s+/g, ' ')), rowsAfter10s: later }
  })

  await step('CA-19.colours', async () => {
    const keys = await C(page, () => window.__creation.design().rig.connections.map((k) => { const x = `${k.a.instance} ${k.a.port}`, y = `${k.b.instance} ${k.b.port}`; return x <= y ? `${x}|${y}` : `${y}|${x}` }))
    const out = {}
    for (const k of keys) out[k] = await C(page, (x) => window.__creation.cableColor(x), k)
    return out
  })
  await page.keyboard.press('Alt+h')
  await sleep(600)
  await shot(page, 'ca2-19-overview-cables')

  const drag = async (id) => {
    await selectDev(id)
    const p0 = (await design(page)).placements.find((p) => p.instanceId === id)
    const cab0 = await C(page, () => window.__creation.cableCenters())
    const s = await C(page, (i) => window.__creation.deviceScreen(i), id)
    const vp = await page.getByTestId('viewport').boundingBox()
    const pick = await C(page, ([x, y]) => window.__creation.pickAt(x, y), [s.x - vp.x, s.y - vp.y])
    const h0 = await C(page, () => window.__creation.historySize())
    await page.mouse.move(s.x, s.y)
    await page.mouse.down()
    await page.mouse.move(s.x + 40, s.y + 5, { steps: 6 })
    const leases = await C(page, () => window.__creation.leases())
    await page.mouse.move(s.x + 90, s.y + 10, { steps: 6 })
    await page.mouse.up()
    await sleep(500)
    const p1 = (await design(page)).placements.find((p) => p.instanceId === id)
    const cab1 = await C(page, () => window.__creation.cableCenters())
    const moved = cab0.filter((c, i) => c && cab1[i] && Math.hypot(c[0] - cab1[i][0], c[2] - cab1[i][2]) > 0.05).length
    return { pickAtStart: pick, leasesMid: leases, before: p0.position_m, after: p1.position_m, mount: p1.mount, history: [h0, await C(page, () => window.__creation.historySize())], cablesThatMoved: moved, status: await page.getByRole('status').first().innerText().catch(() => '') }
  }
  await step('CA-10.dragFloor.ql1', () => drag('ql1'))
  await step('CA-10.dragStand.k12', () => drag('k12-g'))
  await step('CA-10.dragFloor.mains', () => drag('mains'))

  await page.keyboard.press('Escape')
  await page.keyboard.press('Alt+h')
  await sleep(600)
  await step('CA-12+27.place', async () => {
    const vp = await page.getByTestId('viewport').boundingBox()
    const res = []
    for (const fx of [0.3, 0.7]) {
      await page.keyboard.press('Escape')
      await page.locator('#renderCanvas').focus()
      await page.keyboard.press('Alt+h')
      await sleep(500)
      await page.keyboard.press('Space')
      await page.getByRole('tab', { name: 'Micros' }).click()
      await page.locator('[data-testid="inventory-item"][data-device-id="shure-sm58"]').click()
      await sleep(400)
      const x = vp.x + vp.width * fx, y = vp.y + vp.height * 0.7
      await page.mouse.move(x - 20, y - 20)
      await page.mouse.move(x, y, { steps: 5 })
      await sleep(300)
      const n0 = (await design(page)).placements.length
      const floor = await C(page, ([a, b]) => window.__creation.floorPoint(a, b), [x, y])
      if (fx === 0.3) await shot(page, 'ca2-12-ghost-orbit')
      const view = await C(page, () => window.__creation.view())
      await page.mouse.click(x, y)
      await sleep(500)
      const d = await design(page)
      const last = d.placements[d.placements.length - 1]
      res.push({ fx, view, floor, placed: d.placements.length - n0, dropped: last.position_m, dist: floor ? +Math.hypot(last.position_m[0] - floor[0], last.position_m[2] - floor[2]).toFixed(3) : null })
    }
    return res
  })
  await shot(page, 'ca2-27-drops')
  await browser.close()
  const out = { steps, axes, log: summarise(log) }
  saveResults('ca2', out)
  return out
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await runCA2()
