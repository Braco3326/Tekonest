/* eslint-env node */
// CA-01..CA-27 replay against production, mouse + keyboard on the real UI; window.__creation (shipped in the
// production bundle, checked at boot) is used as an ORACLE only (read state, screen points), never to act,
// except where a step says so (memory loop).
import { ORIGIN, URL_APP, SHOTS, launch, instrument, recorder, saveResults, settle, sleep, AUDIO_SPY, honesty, axe } from './lib.mjs'
import { pathToFileURL } from 'node:url'

const W = { width: 1366, height: 768 }
const C = (page, fn, arg) => page.evaluate(fn, arg)
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` })
const design = (page) => C(page, () => window.__creation.design())
const nConn = async (page) => (await design(page)).rig.connections.length
const nInst = async (page) => (await design(page)).rig.instances.length

export async function runCA() {
  const browser = await launch()
  const ctx = await browser.newContext({ viewport: W, reducedMotion: 'reduce', acceptDownloads: true })
  await ctx.addInitScript(AUDIO_SPY)
  const page = await ctx.newPage()
  const log = instrument(page, 'ca-1366')
  const { steps, step } = recorder()
  const texts = {}
  const axes = []
  const grab = async (name) => {
    await shot(page, name)
    texts[name] = honesty(await page.evaluate(() => document.body.innerText))
  }

  const t0 = Date.now()
  await page.goto(URL_APP)
  await step('boot.picker', async () => {
    await page.getByTestId('place-picker').waitFor({ state: 'visible', timeout: 30000 })
    return { msToPicker: Date.now() - t0, hook: await C(page, () => typeof window.__creation), title: await page.title() }
  })
  await page.waitForFunction(() => !!window.__creation, null, { timeout: 30000 })
  await C(page, () => { window.__noReload = 1 })
  await grab('ca-01-picker-1366')

  await step('CA-04.start', async () => ({
    heading: await page.getByRole('heading', { name: 'Choisir un lieu' }).isVisible(),
    places: await page.getByTestId('place-grid').getByRole('option').count(),
    templates: await page.getByTestId('template-grid').getByRole('option').allInnerTexts(),
    url: page.url(),
  }))

  await step('CA-21.look', async () =>
    C(page, () => {
      const f = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).fontFamily : null }
      const btns = [...document.querySelectorAll('button, [role=menuitem], [role=option]')].filter((e) => e.getBoundingClientRect().width > 0)
      const rounded = btns.filter((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius) > 2)
      const fonts = [...document.fonts].filter((x) => x.status === 'loaded').map((x) => `${x.family} ${x.weight}`)
      return {
        body: getComputedStyle(document.body).fontFamily,
        heading: f('h1, h2'),
        menubar: f('[role=menubar]'),
        bodyBg: getComputedStyle(document.body).backgroundColor,
        loadedFonts: [...new Set(fonts)],
        visibleControls: btns.length,
        roundedControls: rounded.length,
        roundedSample: rounded.slice(0, 5).map((e) => `${e.tagName}.${e.className} r=${getComputedStyle(e).borderTopLeftRadius} "${(e.textContent || '').trim().slice(0, 30)}"`),
      }
    })
  )

  await step('CA-13.pickerArrows', async () => {
    const first = page.getByTestId('place-grid').getByRole('option').first()
    await first.focus()
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowDown')
    await sleep(500)
    return { placeAfterArrows: await C(page, () => window.__creation.place()), reloaded: !(await C(page, () => window.__noReload === 1)) }
  })

  const tT = Date.now()
  await step('load.template', async () => {
    await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
    const dlg = page.getByTestId('place-mode-dialog')
    let dialog = false
    if (await dlg.isVisible({ timeout: 1500 }).catch(() => false)) {
      dialog = true
      await dlg.getByRole('radio', { name: 'Avec le matériel du modèle' }).check()
      await dlg.getByRole('button', { name: 'Ouvrir' }).click()
    }
    await page.waitForFunction(() => window.__creation.place() === 'room:concert-hall-medium' && window.__creation.design().rig.instances.length === 5, null, { timeout: 60000 })
    const msPlace = Date.now() - tT
    await page.waitForFunction(() => window.__creation.modelsPending() === 0, null, { timeout: 60000 })
    const msModels = Date.now() - tT
    const settleMs = await settle(page)
    const d = await design(page)
    return { dialog, msPlace, msModels, settleMs, instances: d.rig.instances.map((i) => `${i.instanceId}:${i.deviceId}`), connections: d.rig.connections.length, placementSample: d.placements[0] }
  })
  await grab('ca-02-template-loaded')

  await step('CA-26.firstView', async () =>
    C(page, () => {
      const c = window.__creation
      const r = c.cubeRect()
      return { centreZone: c.cubeZoneAt(r.x + r.width / 2, r.y + r.height / 2), camera: c.camera(), cube: r }
    })
  )

  await step('CA-06+08.layout', async () => {
    const vp = await page.getByTestId('viewport').boundingBox()
    const overlay = await C(page, () => {
      const v = document.querySelector('[data-testid="viewport"]').getBoundingClientRect()
      const canvas = document.querySelector('#renderCanvas')
      const hits = {}
      let n = 0, canvasHits = 0
      for (let y = v.top + 4; y < v.bottom; y += 12)
        for (let x = v.left + 4; x < v.right; x += 12) {
          n++
          const e = document.elementFromPoint(x, y)
          if (e === canvas) { canvasHits++; continue }
          const k = e ? `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${String(e.className).split(' ')[0]}` : 'null'
          hits[k] = (hits[k] ?? 0) + 1
        }
      return { samples: n, canvasShare: +(canvasHits / n).toFixed(3), others: Object.entries(hits).sort((a, b) => b[1] - a[1]).slice(0, 8) }
    })
    return { viewportShare: +((vp.width * vp.height) / (W.width * W.height)).toFixed(3), vp, overlay }
  })

  // CA-05: every cube zone by mouse. BFS over poses: map the cube (4 px grid), click each zone not yet proven, check the
  // centre of the cube then reads that zone (the camera went there).
  await step('CA-05.cube26', async () => {
    const proven = new Set()
    const failed = {}
    const seen = new Set()
    let clicks = 0
    const map = () =>
      C(page, () => {
        const c = window.__creation
        const r = c.cubeRect()
        const acc = {}
        for (let y = r.y + 2; y < r.y + r.height; y += 3)
          for (let x = r.x + 2; x < r.x + r.width; x += 3) {
            const z = c.cubeZoneAt(x, y)
            if (!z) continue
            ;(acc[z] ??= []).push([x, y])
          }
        const out = {}
        for (const [z, pts] of Object.entries(acc)) {
          const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
          out[z] = { n: pts.length, p: pts.reduce((b, p) => (Math.hypot(p[0] - cx, p[1] - cy) < Math.hypot(b[0] - cx, b[1] - cy) ? p : b)) }
        }
        return { r, out, centre: c.cubeZoneAt(r.x + r.width / 2, r.y + r.height / 2) }
      })
    let minArea = Infinity
    for (let round = 0; round < 80 && proven.size < 26; round++) {
      const m = await map()
      Object.keys(m.out).forEach((z) => seen.add(z))
      const todo = Object.entries(m.out).filter(([z]) => !proven.has(z) && z !== m.centre && (failed[z] ?? 0) < 2)
      if (!todo.length) {
        // nothing new from here: hop to any visible zone not equal to centre, preferring corners (3 parts)
        const hop = Object.keys(m.out).filter((z) => z !== m.centre).sort((a, b) => b.split('-').length - a.split('-').length)[round % 3] ?? null
        if (!hop) break
        await page.mouse.click(m.out[hop].p[0], m.out[hop].p[1]); clicks++
        await sleep(350)
        continue
      }
      const [z, { p, n }] = todo[0]
      minArea = Math.min(minArea, n * 9)
      await page.mouse.click(p[0], p[1]); clicks++
      await sleep(350)
      const after = (await map()).centre
      if (after === z) proven.add(z)
      else failed[z] = (failed[z] ?? 0) + 1
    }
    await page.keyboard.press('Alt+h').catch(() => {})
    return { proven: proven.size, provenList: [...proven].sort(), seen: seen.size, failed, clicks, smallestPatchPx2: minArea }
  })
  await shot(page, 'ca-05-cube-after')

  await step('CA-25.viewPicker', async () => {
    await page.locator('#renderCanvas').focus()
    await page.keyboard.press('v')
    const dlg = page.getByRole('dialog', { name: /Choisir une vue/ })
    await dlg.waitFor({ timeout: 5000 })
    const opts = await dlg.getByRole('option').count().catch(() => 0)
    const btns = await dlg.getByRole('button').count()
    const gridcells = await dlg.getByRole('gridcell').count()
    await shot(page, 'ca-25-view-picker')
    await page.keyboard.press('ArrowRight')
    const camBefore = await C(page, () => window.__creation.camera())
    await page.keyboard.press('Enter')
    await sleep(500)
    const camAfter = await C(page, () => window.__creation.camera())
    return { opts, btns, gridcells, moved: Math.abs(camBefore.alpha - camAfter.alpha) + Math.abs(camBefore.beta - camAfter.beta) > 0.01 }
  })
  await step('CA-25.vueMenu', async () => {
    await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
    const items = await page.getByRole('menu').getByRole('menuitem').allInnerTexts()
    const vues = page.getByRole('menuitem', { name: /^Vues/ })
    let sub = []
    if (await vues.count()) {
      await vues.first().click()
      await sleep(300)
      sub = await page.getByRole('menu').last().getByRole('menuitem').allInnerTexts()
    }
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
    return { items: items.map((s) => s.replace(/\s+/g, ' ')), subCount: sub.length, subSample: sub.slice(0, 30).map((s) => s.replace(/\s+/g, ' ')) }
  })

  await step('CA-20.topView', async () => {
    // Dessus via the view picker, by keyboard (Ctrl+Home = a pole per the spec)
    await page.locator('#renderCanvas').focus()
    await page.keyboard.press('v')
    await page.keyboard.press('Control+Home')
    await page.keyboard.press('Enter')
    await sleep(600)
    const cam = await C(page, () => window.__creation.camera())
    const pts = await C(page, () => {
      const c = window.__creation
      return Object.fromEntries(c.design().rig.instances.map((i) => [i.instanceId, c.deviceScreen(i.instanceId)]))
    })
    await shot(page, 'ca-20-top-view')
    await page.keyboard.press('Alt+h')
    await sleep(600)
    const home = await C(page, () => ({ cam: window.__creation.camera(), pts: Object.fromEntries(window.__creation.design().rig.instances.map((i) => [i.instanceId, window.__creation.deviceScreen(i.instanceId)])) }))
    await shot(page, 'ca-20-home-view')
    return { top: { cam, pts }, home }
  })

  await step('CA-07.labels', async () => {
    const rest = await C(page, () => window.__creation.visiblePortLabels())
    const domLabelsRest = await page.locator('[data-testid="port-label"]:not([hidden])').count()
    return { inSceneLabelPlanes: rest, domLabelsAtRest: domLabelsRest }
  })

  // ---- patch by mouse: select the QL1 by its 3D body? ']' cycles (the keyboard path), the oracle gives the port point.
  const selectDev = async (id) => {
    await page.locator('#renderCanvas').focus()
    for (let i = 0; i < 8 && (await C(page, () => window.__creation.selection())) !== id; i++) await page.keyboard.press(']')
    await page.waitForFunction(() => !window.__creation.cameraMoving(), null, { timeout: 10000 })
    await settle(page)
    return C(page, () => window.__creation.selection())
  }
  await step('CA-07.hover', async () => {
    await selectDev('ql1')
    const p = await C(page, () => window.__creation.portScreen({ instance: 'ql1', port: 'out-main-l' }))
    if (!p) return { port: null }
    await page.mouse.move(p.x - 60, p.y - 60)
    await page.mouse.move(p.x, p.y, { steps: 5 })
    await sleep(300)
    const labels = await page.locator('[data-testid="port-label"]:not([hidden])').allInnerTexts()
    await shot(page, 'ca-07-port-hover')
    return { port: p, labels, hitRadiusPx: await C(page, () => window.__creation.portHitRadiusPx({ instance: 'ql1', port: 'out-main-l' })), planes: await C(page, () => window.__creation.visiblePortLabels()) }
  })

  await step('CA-09.patchMouse', async () => {
    const before = await nConn(page)
    await selectDev('ql1')
    const a = await C(page, () => window.__creation.portScreen({ instance: 'ql1', port: 'out-main-l' }))
    await page.mouse.click(a.x, a.y)
    await sleep(300)
    const pending = await C(page, () => window.__creation.patchPending())
    const b = await C(page, () => window.__creation.portScreen({ instance: 'k12-g', port: 'in-line-a' }))
    const vp = await page.getByTestId('viewport').boundingBox()
    const onScreen = b && b.x > vp.x && b.x < vp.x + vp.width && b.y > vp.y && b.y < vp.y + vp.height
    if (onScreen) await page.mouse.click(b.x, b.y)
    await sleep(500)
    const status = await page.getByRole('status').first().innerText().catch(() => '')
    const after = await nConn(page)
    await shot(page, 'ca-09-patched-mouse')
    if (await C(page, () => window.__creation.patchPending())) await page.keyboard.press('Escape')
    return { before, after, pending, targetPoint: b, targetOnScreen: onScreen, status }
  })

  await step('CA-15.wrongConnection', async () => {
    await selectDev('ql1')
    const a = await C(page, () => window.__creation.portScreen({ instance: 'ql1', port: 'in-mic-2' }))
    const b = await C(page, () => window.__creation.portScreen({ instance: 'ql1', port: 'in-mic-3' }))
    await page.mouse.click(a.x, a.y)
    await sleep(250)
    await page.mouse.click(b.x, b.y)
    await sleep(600)
    const alerts = await page.getByRole('alert').allInnerTexts()
    const status = await page.getByRole('status').first().innerText().catch(() => '')
    const portErr = await page.getByTestId('port-error').allInnerTexts().catch(() => [])
    const signal = await page.getByTestId('signal-status').innerText()
    const extra = await page.getByTestId('signal-extra').innerText().catch(() => '')
    await grab('ca-15-wrong-connection')
    if (await C(page, () => window.__creation.patchPending())) await page.keyboard.press('Escape')
    return { alerts, status, portErr, signal, extra, english: /MISMATCH|Signal flows/i.test(alerts.join(' ') + status + portErr.join(' ')) }
  })

  await step('errorList', async () => {
    await page.getByTestId('signal-status').click()
    const dlg = page.getByRole('dialog', { name: 'Erreurs et avertissements' })
    await dlg.waitFor({ timeout: 5000 })
    const rows = await dlg.locator('.cr-errlist-row').allInnerTexts()
    axes.push(await axe(page, ['[data-testid="error-list"]', '[data-testid="status-bar"]'], 'error-list-1366'))
    await grab('ca-15b-error-list')
    await sleep(10500) // persistent, not a toast
    const still = await dlg.isVisible()
    await page.keyboard.press('Escape')
    const persistentAfter10s = await (async () => { await page.getByTestId('signal-status').click(); const n = await dlg.locator('.cr-errlist-row').count(); await page.keyboard.press('Escape'); return n })()
    return { rows: rows.map((r) => r.replace(/\s+/g, ' ')), stillOpenAfter10s: still, rowsAfter10s: persistentAfter10s, focusBack: await page.getByTestId('signal-status').evaluate((e) => e === document.activeElement) }
  })

  await step('CA-16.placeholder', async () => ({ inDom: /REMPLACER/.test(await page.evaluate(() => document.body.innerText)) }))

  // out-main-r by the « Connecter à… » dialog, mouse
  await step('connectDialog', async () => {
    await selectDev('ql1')
    const btn = page.getByRole('button', { name: 'Connecter à… (depuis out-main-r)' })
    await btn.scrollIntoViewIfNeeded()
    await btn.click()
    const dlg = page.getByRole('dialog', { name: 'Connecter à…' })
    await dlg.waitFor()
    await page.keyboard.type('k12-d in-line-a')
    await sleep(300)
    const count = await page.getByTestId('connect-count').innerText()
    await page.keyboard.press('Enter')
    await sleep(400)
    return { count, connections: await nConn(page), status: await page.getByRole('status').first().innerText() }
  })
  // left channel, if the 3D click did not land it
  await step('connectDialogL', async () => {
    const d = await design(page)
    if (d.rig.connections.some((c) => c.a.port === 'out-main-l' || c.b.port === 'out-main-l')) return { already: true }
    await selectDev('ql1')
    await page.getByRole('button', { name: 'Connecter à… (depuis out-main-l)' }).click()
    await page.keyboard.type('k12-g in-line-a')
    await sleep(300)
    await page.keyboard.press('Enter')
    await sleep(400)
    return { connections: await nConn(page) }
  })

  await step('playbackToggle', async () => {
    await selectDev('ql1')
    const t = page.locator('button.cr-toggle', { hasText: 'Lecture console' })
    await t.scrollIntoViewIfNeeded()
    const before = await t.innerText()
    await t.click()
    await sleep(500)
    return { before: before.replace(/\s+/g, ' '), after: (await t.innerText()).replace(/\s+/g, ' ') }
  })

  await step('CA-03.statusBar', async () => ({
    signal: await page.getByTestId('signal-status').innerText(),
    playback: await page.getByTestId('status-playback').innerText().catch(() => null),
    mic: await page.getByTestId('status-mic').innerText().catch(() => null),
    bar: (await page.getByTestId('status-bar').innerText()).replace(/\s+/g, ' '),
  }))
  await shot(page, 'ca-03-status-ready')

  await step('CA-03.listen', async () => {
    await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
    const menu = (await page.getByRole('menu').last().getByRole('menuitem').allInnerTexts()).map((s) => s.replace(/\s+/g, ' '))
    await page.getByRole('menuitem', { name: 'Signal de test', exact: true }).click()
    await page.waitForFunction(() => window.__creation.audioState().state === 'playing', null, { timeout: 20000 })
    await page.waitForFunction(() => { const l = window.__creation.audioLevels(); return (l['k12-g'] ?? 0) > 0 && (l['k12-d'] ?? 0) > 0 }, null, { timeout: 15000 }).catch(() => {})
    const ctxStates = await C(page, () => (window.__ctxs ?? []).map((c) => c.state))
    const levels = await C(page, () => window.__creation.audioLevels())
    const peaks = await C(page, () => window.__creation.audioPeaks())
    const st = await C(page, () => window.__creation.audioState())
    const panel = page.getByTestId('listen-panel')
    await panel.scrollIntoViewIfNeeded().catch(() => {})
    const simple = await page.getByTestId('listen-simple').innerText().catch(() => null)
    const panelText = (await panel.innerText().catch(() => '')).replace(/\s+/g, ' ')
    axes.push(await axe(page, '[data-testid="listen-panel"]', 'listen-panel-1366'))
    await grab('ca-03-listen-playing')
    return { menu, ctxStates, levels, peaks, state: st.state, sourceName: st.sourceName, voices: st.voices?.map((v) => ({ id: v.instanceId, pan: +v.pan.toFixed(2), gain: +v.gain.toFixed(3), ch: v.channels })), simple, panelText: panelText.slice(0, 900) }
  })
  await step('listen.stop', async () => {
    await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Stop', exact: true }).click()
    await page.waitForFunction(() => window.__creation.audioState().state === 'stopped', null, { timeout: 10000 })
    await sleep(800)
    return { stats: await C(page, () => window.__creation.audioStats()), ctxStates: await C(page, () => (window.__ctxs ?? []).map((c) => c.state)) }
  })

  await step('coverage', async () => {
    await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
    await page.getByRole('menuitemcheckbox', { name: /Couverture/ }).or(page.getByRole('menuitem', { name: /Couverture/ })).first().click()
    await page.waitForFunction(() => window.__creation.coverage().status === 'ready', null, { timeout: 60000 })
    const cov = await C(page, () => { const c = window.__creation.coverage(); return { status: c.status, points: c.points, step: c.step, stats: c.stats, sources: c.sources, spl: c.spl, worker: c.worker } })
    const panel = page.getByTestId('coverage-panel')
    await panel.scrollIntoViewIfNeeded().catch(() => {})
    const chip = await page.getByTestId('coverage-chip').innerText().catch(() => null)
    const text = (await panel.innerText().catch(() => '')).replace(/\s+/g, ' ')
    axes.push(await axe(page, '[data-testid="coverage-panel"]', 'coverage-panel-1366'))
    await grab('ca-coverage-on')
    return { cov, chip, text: text.slice(0, 900) }
  })

  await step('CA-18.idle', async () => {
    await page.mouse.move(5, 5)
    await settle(page)
    const r0 = await C(page, () => window.__creation.renders())
    const raf = await C(page, () => new Promise((res) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 5000) requestAnimationFrame(f); else res(n) }; requestAnimationFrame(f) }))
    const r1 = await C(page, () => window.__creation.renders())
    return { rendersIn5s: r1 - r0, renderFps: +((r1 - r0) / 5).toFixed(2), browserRafIn5s: raf, coverageOn: true }
  })
  await step('CA-18.orbitFps', async () => {
    const vp = await page.getByTestId('viewport').boundingBox()
    const r0 = await C(page, () => window.__creation.renders())
    const t = Date.now()
    await page.mouse.move(vp.x + vp.width * 0.5, vp.y + vp.height * 0.3)
    await page.mouse.down()
    for (let i = 0; i < 60; i++) await page.mouse.move(vp.x + vp.width * 0.5 + i * 4, vp.y + vp.height * 0.3, { steps: 1 })
    await page.mouse.up()
    const r1 = await C(page, () => window.__creation.renders())
    const s = (Date.now() - t) / 1000
    await page.keyboard.press('Alt+h').catch(() => {})
    return { renders: r1 - r0, seconds: s, fps: +((r1 - r0) / s).toFixed(1) }
  })

  await step('CA-19.cables', async () => {
    const toggle = page.getByTestId('cable-legend-toggle')
    await toggle.scrollIntoViewIfNeeded().catch(() => {})
    const expanded = await toggle.getAttribute('aria-expanded').catch(() => null)
    if (expanded === 'false') await toggle.click()
    const legend = await page.getByTestId('cable-legend-list').innerText().catch(() => null)
    const keys = await C(page, () => {
      const c = window.__creation
      return c.design().rig.connections.map((k) => `${k.a.instance}.${k.a.port}|${k.b.instance}.${k.b.port}`)
    })
    const colours = {}
    for (const k of keys) {
      for (const variant of [k, k.replace('|', '--'), k.replace('|', '->')]) {
        const col = await C(page, (x) => window.__creation.cableColor(x), variant)
        if (col) { colours[k] = col; break }
      }
    }
    return { legend: legend?.replace(/\s+/g, ' '), colours, centres: await C(page, () => window.__creation.cableCenters().filter(Boolean).length) }
  })

  await step('undoRedo', async () => {
    await page.locator('#renderCanvas').focus()
    const a = await nConn(page)
    const h = await C(page, () => window.__creation.historySize())
    await page.keyboard.press('Control+z')
    await sleep(300)
    const b = await nConn(page)
    const pb = await C(page, () => window.__creation.design().placements.length)
    await page.keyboard.press('Control+y')
    await sleep(300)
    const c = await nConn(page)
    return { history: h, connections: [a, b, c], placementsAfterUndo: pb }
  })

  await step('CA-10.dragMove', async () => {
    await selectDev('k12-g')
    const p0 = (await design(page)).placements.find((p) => p.instanceId === 'k12-g')
    const cab0 = await C(page, () => window.__creation.cableCenters())
    const s = await C(page, () => window.__creation.deviceScreen('k12-g'))
    const h0 = await C(page, () => window.__creation.historySize())
    await page.mouse.move(s.x, s.y)
    await page.mouse.down()
    await page.mouse.move(s.x + 70, s.y + 10, { steps: 8 })
    await page.mouse.up()
    await sleep(500)
    const p1 = (await design(page)).placements.find((p) => p.instanceId === 'k12-g')
    const cab1 = await C(page, () => window.__creation.cableCenters())
    const moved = cab0.filter((c, i) => c && cab1[i] && Math.hypot(c[0] - cab1[i][0], c[2] - cab1[i][2]) > 0.05).length
    return { before: p0, after: p1, history: [h0, await C(page, () => window.__creation.historySize())], cablesThatMoved: moved, sameId: !!p1 }
  })

  await step('CA-11.rotate', async () => {
    await selectDev('k12-g')
    const before = (await design(page)).placements.find((p) => p.instanceId === 'k12-g')
    await page.keyboard.press('r')
    await sleep(300)
    const after = (await design(page)).placements.find((p) => p.instanceId === 'k12-g')
    const props = (await page.getByTestId('properties').innerText()).replace(/\s+/g, ' ')
    return { before, after, propsHasTilt: /Inclinaison/.test(props), propsHasHeight: /Hauteur/.test(props), propsExcerpt: props.slice(0, 600) }
  })

  await step('CA-23.drawer', async () => {
    await page.locator('#renderCanvas').focus()
    await page.keyboard.press('Space')
    const dr = page.getByTestId('inventory-drawer')
    await dr.waitFor({ timeout: 10000 })
    const box = await dr.boundingBox()
    const tabs = await page.getByRole('tablist').getByRole('tab').allInnerTexts()
    const items = dr.getByTestId('inventory-item')
    const n = await items.count()
    const imgs = await dr.locator('[data-testid="inventory-item"] img').count()
    const modal = await dr.getAttribute('aria-modal')
    axes.push(await axe(page, '[data-testid="inventory-drawer"]', 'drawer-1366'))
    await grab('ca-23-drawer-open')
    return { box, tabs: tabs.map((t) => t.trim()), itemsInTab: n, imgs, ariaModal: modal, draggable: await items.first().getAttribute('draggable') }
  })
  await step('beta', async () => {
    const tab = page.getByRole('tab', { name: /Bêta/ })
    if (!(await tab.count())) return { betaTab: false }
    await tab.click()
    await sleep(1500)
    const items = page.getByTestId('inventory-item')
    const n = await items.count()
    const badges = await page.getByTestId('inventory-badge').allInnerTexts()
    await grab('ca-beta-tab')
    return { betaTab: true, items: n, badges: [...new Set(badges)], badgeCount: badges.length }
  })

  await step('CA-12+27.placeGhost', async () => {
    await page.getByRole('tab', { name: 'Micros' }).click()
    const before = await nInst(page)
    await page.locator('[data-testid="inventory-item"][data-device-id="shure-sm58"]').click()
    await sleep(400)
    const vp = await page.getByTestId('viewport').boundingBox()
    const res = []
    for (const fx of [0.3, 0.7]) {
      const x = vp.x + vp.width * fx, y = vp.y + vp.height * 0.62
      await page.mouse.move(x - 20, y - 20)
      await page.mouse.move(x, y, { steps: 5 })
      await sleep(300)
      const placing = await C(page, () => window.__creation.placing())
      const view = await C(page, () => window.__creation.view())
      if (fx === 0.3) await shot(page, 'ca-12-ghost')
      const floor = await C(page, ([a, b]) => window.__creation.floorPoint(a, b), [x, y])
      await page.mouse.click(x, y)
      await sleep(500)
      const d = await design(page)
      const last = d.placements[d.placements.length - 1]
      res.push({ fx, placing, view, floor, dropped: last.position_m, dist: floor ? +Math.hypot(last.position_m[0] - floor[0], last.position_m[2] - floor[2]).toFixed(3) : null })
      if (fx === 0.3) {
        await page.locator('#renderCanvas').focus()
        await page.keyboard.press('Space')
        await page.getByRole('tab', { name: 'Micros' }).click()
        await page.locator('[data-testid="inventory-item"][data-device-id="shure-sm58"]').click()
        await sleep(400)
      }
    }
    return { before, after: await nInst(page), res }
  })
  await shot(page, 'ca-27-dropped')

  await step('CA-14.autosave', async () => {
    await page.waitForFunction(() => /Enregistr/.test(document.querySelector('[data-testid="status-bar"]')?.innerText ?? ''), null, { timeout: 15000 }).catch(() => {})
    const bar = (await page.getByTestId('status-bar').innerText()).replace(/\s+/g, ' ')
    const n = await nInst(page)
    const c = await nConn(page)
    const title0 = await page.getByTestId('project-title').innerText().catch(() => null)
    await page.reload()
    await page.waitForFunction(() => !!window.__creation && window.__creation.place() !== null, null, { timeout: 60000 })
    await sleep(1500)
    const picker = await page.getByTestId('place-picker').isVisible().catch(() => false)
    const n2 = await nInst(page)
    const c2 = await nConn(page)
    await page.waitForFunction(() => window.__creation.modelsPending() === 0, null, { timeout: 60000 }).catch(() => {})
    await shot(page, 'ca-14-after-reload')
    return { bar, title0, before: { n, c }, after: { n: n2, c: c2, place: await C(page, () => window.__creation.place()) }, pickerShown: picker }
  })
  await C(page, () => { window.__noReload = 1 })

  await step('CA-14.ctrlS', async () => {
    await page.locator('#renderCanvas').focus()
    await page.keyboard.press('Control+s')
    const dlg = page.getByRole('dialog', { name: 'Enregistrer le projet' })
    await dlg.waitFor({ timeout: 5000 })
    await page.getByRole('textbox', { name: 'Nom du projet' }).fill('Audit en ligne')
    await page.keyboard.press('Enter')
    await sleep(600)
    const extra = await page.getByRole('dialog').count()
    if (extra) await page.keyboard.press('Enter')
    await sleep(400)
    return { title: await page.getByTestId('project-title').innerText().catch(() => null), dialogsLeft: await page.getByRole('dialog').count(), project: await C(page, () => window.__creation.project()) }
  })

  await step('CA-13.placeChange', async () => {
    const n0 = await nInst(page)
    await page.getByRole('menuitem', { name: 'Lieu', exact: true }).click()
    const items = (await page.getByRole('menu').last().getByRole('menuitem').allInnerTexts()).map((s) => s.replace(/\s+/g, ' '))
    await page.getByRole('menuitem', { name: /Choisir un lieu/ }).first().click()
    await page.getByTestId('place-picker').waitFor()
    await page.locator('[data-place="room:bar-club-stage-small"]').click()
    const dlg = page.getByRole('dialog').filter({ hasText: /Garder|lieu/ }).last()
    await dlg.waitFor({ timeout: 5000 })
    const dlgText = (await dlg.innerText()).replace(/\s+/g, ' ')
    await shot(page, 'ca-13-change-place-dialog')
    await dlg.getByRole('button', { name: /Garder/ }).or(dlg.getByRole('radio', { name: /Garder/ })).first().click()
    const ok = dlg.getByRole('button', { name: /Ouvrir|Changer|Valider/ })
    if (await ok.count()) await ok.first().click().catch(() => {})
    await page.waitForFunction(() => window.__creation.place() === 'room:bar-club-stage-small', null, { timeout: 30000 })
    await sleep(1000)
    await shot(page, 'ca-13-place-changed')
    const note = await page.getByTestId('notes').innerText().catch(() => '')
    return { menu: items, dlgText, kept: { before: n0, after: await nInst(page) }, noReload: await C(page, () => window.__noReload === 1), note: note.replace(/\s+/g, ' ').slice(0, 400) }
  })

  await step('export', async () => {
    await page.getByRole('menuitem', { name: 'Projet', exact: true }).click()
    const items = (await page.getByRole('menu').last().getByRole('menuitem').allInnerTexts()).map((s) => s.replace(/\s+/g, ' '))
    const exp = page.getByRole('menuitem', { name: /^Exporter(?! les données)/ })
    let download = null
    if (await exp.count()) {
      const enabled = (await exp.first().getAttribute('aria-disabled')) !== 'true'
      if (enabled) {
        const [d] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), exp.first().click()])
        download = d ? { name: d.suggestedFilename() } : 'no download event'
      } else download = 'disabled'
    }
    await page.keyboard.press('Escape')
    return { items, download }
  })

  // memory over 10 place changes (choosePlace: the picker path, empty rig) — the hook is used to drive the loop
  await step('perf.memory10', async () => {
    const cdp = await ctx.newCDPSession(page)
    const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize }
    const keys = await C(page, () => [...document.querySelectorAll('[data-place]')].map((e) => e.getAttribute('data-place')))
    const list = keys.length ? keys : ['room:concert-hall-medium', 'room:bar-club-stage-small', 'blank', 'set:plateau']
    const probe = () => C(page, () => ({ meshes: window.__creation.meshCount(), scenes: window.__creation.scenes(), listeners: window.__creation.liveListeners(), tn: window.__creation.transformNodeCount() }))
    await C(page, (k) => window.__creation.choosePlace(k), list[0])
    await settle(page)
    const h0 = await heap(); const s0 = await probe()
    const seq = []
    for (let i = 1; i <= 10; i++) {
      const k = list[i % Math.min(list.length, 6)]
      const t = Date.now()
      await C(page, (x) => window.__creation.choosePlace(x), k)
      seq.push({ k, ms: Date.now() - t })
      await settle(page, 15000)
    }
    await C(page, (k) => window.__creation.choosePlace(k), list[0])
    await settle(page)
    const h1 = await heap(); const s1 = await probe()
    return { heapMB: [+(h0 / 1e6).toFixed(1), +(h1 / 1e6).toFixed(1)], growthMB: +((h1 - h0) / 1e6).toFixed(1), before: s0, after: s1, seq }
  })

  await browser.close()
  const out = { steps, texts, axes, log: summarise(log) }
  saveResults('ca', out)
  return out
}

export function summarise(log) {
  const origin = ORIGIN
  return {
    tag: log.tag,
    console: log.console,
    pageErrors: log.pageErrors,
    thirdParty: log.responses.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:')).map((r) => r.url),
    bad: log.responses.filter((r) => r.status >= 400).map((r) => `${r.status} ${r.url}`),
    jsAsHtml: log.responses.filter((r) => /\.m?js(\?|$)/.test(r.url) && /html/.test(r.ct)).map((r) => r.url),
    draco: log.responses.filter((r) => /draco/i.test(r.url)).map((r) => `${r.status} ${r.ct} ${r.url}`),
    failed: log.failed,
    count: log.responses.length,
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await runCA()
