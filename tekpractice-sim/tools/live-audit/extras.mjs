/* eslint-env node */
// Extra live checks: keyboard-only path (CA-01 / CA-02 / Échap / reduced motion / focus ring), touch 400×800,
// axe on the main screens, a 3-minute legacy session, HTTP behaviour, transfer sizes, the bundle grep, the site page.
import { ORIGIN, URL_APP, URL_PAGE, SHOTS, launch, instrument, recorder, saveResults, settle, sleep, honesty, axe, transferMeter } from './lib.mjs'
import { pathToFileURL } from 'node:url'
import { summarise } from './ca.mjs'

const C = (page, fn, arg) => page.evaluate(fn, arg)
const shot = (page, name, full = false) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full })

/** Counts WebGL draw calls per frame for any page (legacy too): installed before the page scripts. */
const DRAW_SPY = () => {
  window.__draws = 0
  for (const P of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!P) continue
    for (const m of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const o = P.prototype[m]
      if (!o) continue
      P.prototype[m] = function (...a) { window.__draws++; return o.apply(this, a) }
    }
  }
}
const drawsOver = async (page, ms) => {
  const a = await C(page, () => window.__draws)
  await sleep(ms)
  return (await C(page, () => window.__draws)) - a
}

const activeInfo = () => {
  const e = document.activeElement
  if (!e) return null
  const cs = getComputedStyle(e)
  const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none')
  return {
    tag: e.tagName.toLowerCase(),
    id: e.id || undefined,
    role: e.getAttribute('role') || undefined,
    testid: e.getAttribute('data-testid') || e.closest('[data-testid]')?.getAttribute('data-testid') || undefined,
    name: (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50),
    focusVisible: e.matches(':focus-visible'),
    ring,
  }
}

export async function runKeyboard() {
  const browser = await launch()
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const log = instrument(page, 'keyboard')
  const { steps, step } = recorder()
  await page.goto(URL_APP)
  await page.waitForFunction(() => !!window.__creation, null, { timeout: 30000 })
  await page.getByTestId('place-picker').waitFor()
  const inside = (sel) => C(page, (s) => document.activeElement?.closest(s) != null, sel)
  const tabTo = async (sel, max = 120, back = false) => {
    for (let i = 0; i < max; i++) {
      if (await inside(sel)) return i
      await page.keyboard.press(back ? 'Shift+Tab' : 'Tab')
    }
    throw new Error(`Tab never reached ${sel}`)
  }

  await step('CA-01.tabOrderPicker', async () => {
    const seq = []
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab')
      seq.push(await C(page, activeInfo))
    }
    await shot(page, 'kb-01-tab-picker')
    return { first: seq[0], seq, noRing: seq.filter((s) => s && !s.ring).map((s) => s.name || s.tag) }
  })
  await page.reload()
  await page.waitForFunction(() => !!window.__creation, null, { timeout: 30000 })
  await page.getByTestId('place-picker').waitFor()

  await step('CA-02.keyboardPatch', async () => {
    const n = await tabTo('[data-testid="template-grid"]', 15)
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => window.__creation.place() === 'room:concert-hall-medium' && window.__creation.design().rig.instances.length === 5, null, { timeout: 60000 })
    const canvasFocused = await C(page, () => document.activeElement?.id === 'renderCanvas')
    await tabTo('[data-testid="project-tree"]', 15, true)
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    for (let i = 0; i < 6; i++) {
      if ((await C(page, () => document.activeElement?.textContent ?? '')).includes('(ql1)')) break
      await page.keyboard.press('ArrowDown')
    }
    await page.keyboard.press('Enter')
    const sel = await C(page, () => window.__creation.selection())
    const tabsToConnect = await tabTo('[data-key="connect:out-main-l"]')
    await page.keyboard.press('Enter')
    await page.getByRole('dialog', { name: 'Connecter à…' }).waitFor()
    await page.keyboard.type('k12-g')
    await sleep(200)
    await page.keyboard.press('Enter')
    await sleep(300)
    await tabTo('[data-key="connect:out-main-r"]', 8)
    await page.keyboard.press('Enter')
    await page.keyboard.type('k12-d in-line-a')
    await sleep(200)
    await page.keyboard.press('Enter')
    await sleep(300)
    const d = await C(page, () => window.__creation.design())
    await shot(page, 'kb-02-patched-by-keyboard')
    return { tabsToTemplate: n, canvasFocusedAfterOpen: canvasFocused, selected: sel, tabsToConnect, connections: d.rig.connections.length, signal: await page.getByTestId('signal-status').innerText(), ring: await C(page, activeInfo) }
  })

  await step('keyboard.placeDevice', async () => {
    await tabTo('#renderCanvas', 80)
    const n0 = (await C(page, () => window.__creation.design())).rig.instances.length
    await page.keyboard.press('Space')
    await page.getByTestId('inventory-drawer').waitFor()
    const tabFocused = await C(page, activeInfo)
    await page.keyboard.type('sm58')
    await sleep(300)
    await page.keyboard.press('Enter')
    await sleep(300)
    const placing = await C(page, () => window.__creation.placing())
    await page.keyboard.press('r')
    await page.keyboard.press('Enter')
    await sleep(400)
    const n1 = (await C(page, () => window.__creation.design())).rig.instances.length
    return { tabFocused, placing, before: n0, after: n1, status: await page.getByRole('status').first().innerText() }
  })

  await step('escape', async () => {
    const r = {}
    await page.locator('#renderCanvas').focus()
    await page.keyboard.press('Space')
    await page.getByTestId('inventory-drawer').waitFor()
    await page.keyboard.press('Escape')
    await sleep(300)
    r.drawerClosed = !(await page.getByTestId('inventory-drawer').isVisible().catch(() => false))
    r.focusAfterDrawer = await C(page, activeInfo)
    await page.keyboard.press(']')
    r.selected = await C(page, () => window.__creation.selection())
    await page.keyboard.press('Escape')
    r.afterEsc = await C(page, () => window.__creation.selection())
    await page.getByRole('menuitem', { name: 'Écoute', exact: true }).focus()
    await page.keyboard.press('ArrowDown')
    r.menuOpen = await page.getByRole('menu').count()
    await page.keyboard.press('Escape')
    r.menuAfterEsc = await page.getByRole('menu').count()
    r.focusAfterMenu = await C(page, activeInfo)
    await page.locator('#renderCanvas').focus()
    await page.keyboard.press('h')
    await sleep(300)
    r.helpDialog = await page.getByRole('dialog').allInnerTexts().then((t) => t.map((x) => x.slice(0, 60)))
    await page.keyboard.press('Escape')
    r.helpAfterEsc = await page.getByRole('dialog').count()
    return r
  })

  await step('arrowsOrbit', async () => {
    await page.locator('#renderCanvas').focus()
    const a = await C(page, () => window.__creation.camera())
    await page.keyboard.press('ArrowLeft'); await sleep(300)
    const b = await C(page, () => window.__creation.camera())
    // with a cable in hand (mouse click on a port of the selected QL1)
    await page.keyboard.press('Escape')
    for (let i = 0; i < 8 && (await C(page, () => window.__creation.selection())) !== 'ql1'; i++) await page.keyboard.press(']')
    await settle(page)
    const p = await C(page, () => window.__creation.portScreen({ instance: 'ql1', port: 'out-mix-1' }))
    await page.mouse.click(p.x, p.y)
    await sleep(300)
    const pend = await C(page, () => window.__creation.patchPending())
    const focus = await C(page, activeInfo)
    const c = await C(page, () => window.__creation.camera())
    await page.keyboard.press('ArrowLeft'); await sleep(300)
    await page.keyboard.press('ArrowLeft'); await sleep(300)
    const d = await C(page, () => window.__creation.camera())
    await page.keyboard.press('Escape')
    return { idleTurn: +(b.alpha - a.alpha).toFixed(3), pending: pend, focusWithCable: focus, cableTurn: +(d.alpha - c.alpha).toFixed(3) }
  })

  await step('reducedMotion', async () => {
    const flight = async () => {
      await page.locator('#renderCanvas').focus()
      await page.keyboard.press('Alt+h')
      await sleep(800)
      await page.keyboard.press('v')
      await page.keyboard.press('Control+End')
      const t = Date.now()
      await page.keyboard.press('Enter')
      let moving = true
      while (moving && Date.now() - t < 5000) { moving = await C(page, () => window.__creation.cameraMoving()); if (moving) await sleep(30) }
      return Date.now() - t
    }
    const reduce = await flight()
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const normal = await flight()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const drawerT = await C(page, () => { const e = document.querySelector('[data-testid="inventory-drawer"]'); return e ? getComputedStyle(e).transitionDuration : null })
    return { msReduce: reduce, msNormal: normal, drawerTransition: drawerT }
  })
  await browser.close()
  saveResults('keyboard', { steps, log: summarise(log) })
}

export async function runTouch() {
  const browser = await launch()
  const ctx = await browser.newContext({ viewport: { width: 400, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const log = instrument(page, 'touch-400')
  const { steps, step } = recorder()
  const axes = []
  const targets = () =>
    C(page, () => {
      const sel = 'button, a[href], [role=menuitem], [role=menuitemcheckbox], [role=option], [role=tab], [role=treeitem], input, select, [role=gridcell], [role=switch]'
      const els = [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth })
      const small24 = els.filter((e) => { const r = e.getBoundingClientRect(); return r.width < 24 || r.height < 24 })
      const small44 = els.filter((e) => { const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44 })
      const d = (e) => { const r = e.getBoundingClientRect(); return `${(e.getAttribute('aria-label') || e.textContent || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 28)} ${Math.round(r.width)}x${Math.round(r.height)}` }
      return { coarse: matchMedia('(pointer: coarse)').matches, visible: els.length, under24: small24.length, under24List: small24.slice(0, 12).map(d), under44: small44.length, under44Sample: small44.slice(0, 10).map(d), hScroll: document.documentElement.scrollWidth > innerWidth, scrollW: document.documentElement.scrollWidth }
    })
  await page.goto(URL_APP)
  await page.waitForFunction(() => !!window.__creation, null, { timeout: 30000 })
  await page.getByTestId('place-picker').waitFor()
  await sleep(800)
  await shot(page, 'touch-01-picker')
  await step('picker.targets', targets)
  axes.push(await axe(page, null, 'picker-400-touch'))
  await step('template.tap', async () => {
    await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).tap()
    await page.waitForFunction(() => window.__creation.design().rig.instances.length === 5, null, { timeout: 60000 })
    await page.waitForFunction(() => window.__creation.modelsPending() === 0, null, { timeout: 60000 })
    await settle(page)
    await shot(page, 'touch-02-loaded')
    return { vp: await page.getByTestId('viewport').boundingBox().catch(() => null) }
  })
  await step('loaded.targets', targets)
  axes.push(await axe(page, null, 'loaded-400-touch'))
  await step('drawer.touch', async () => {
    await page.getByRole('menuitem', { name: 'Matériel', exact: true }).tap()
    await page.getByRole('menuitem', { name: /^Inventaire/ }).tap()
    await page.getByTestId('inventory-drawer').waitFor({ timeout: 10000 })
    await sleep(400)
    await shot(page, 'touch-03-drawer')
    const box = await page.getByTestId('inventory-drawer').boundingBox()
    const t = await targets()
    // tap an item: a ghost follows; a tap on the floor drops (Task 43b)
    const n0 = (await C(page, () => window.__creation.design())).rig.instances.length
    await page.getByRole('tab', { name: 'Micros' }).tap()
    await page.locator('[data-testid="inventory-item"][data-device-id="shure-sm58"]').tap()
    await sleep(400)
    const placing = await C(page, () => window.__creation.placing())
    const vp = await page.getByTestId('viewport').boundingBox()
    await page.touchscreen.tap(vp.x + vp.width * 0.5, vp.y + vp.height * 0.7)
    await sleep(500)
    const n1 = (await C(page, () => window.__creation.design())).rig.instances.length
    const cancel = await page.getByRole('button', { name: /Annuler la pose/ }).count()
    await shot(page, 'touch-04-after-tap-drop')
    return { box, targets: t, placing, before: n0, after: n1, cancelButtonVisible: cancel }
  })
  axes.push(await axe(page, null, 'after-drawer-400-touch'))
  await step('listen.touch', async () => {
    // the Écoute block on a phone layout
    await page.getByRole('menuitem', { name: 'Écoute', exact: true }).tap()
    const items = await page.getByRole('menu').last().getByRole('menuitem').allInnerTexts()
    await shot(page, 'touch-05-ecoute-menu')
    await page.keyboard.press('Escape')
    return { items: items.map((s) => s.replace(/\s+/g, ' ')) }
  })
  await browser.close()
  saveResults('touch', { steps, axes, log: summarise(log) })
}

export async function runAxeScreens() {
  const browser = await launch()
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const axes = []
  const texts = {}
  await page.goto(URL_APP)
  await page.waitForFunction(() => !!window.__creation, null, { timeout: 30000 })
  await page.getByTestId('place-picker').waitFor()
  await sleep(800)
  axes.push(await axe(page, null, 'picker-1366'))
  texts.picker = honesty(await page.evaluate(() => document.body.innerText))
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation.design().rig.instances.length === 5, null, { timeout: 60000 })
  await settle(page)
  axes.push(await axe(page, null, 'loaded-1366'))
  texts.loaded = honesty(await page.evaluate(() => document.body.innerText))
  // help overlay text
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('h')
  await sleep(300)
  texts.helpDialogs = await page.getByRole('dialog').count()
  if (texts.helpDialogs) axes.push(await axe(page, '[role=dialog]', 'help-1366'))
  await shot(page, 'axe-help')
  await page.keyboard.press('Escape')
  await page.getByRole('menuitem', { name: 'Aide', exact: true }).click()
  texts.aideItems = await page.getByRole('menu').last().getByRole('menuitem').evaluateAll((els) => els.map((e) => ({ t: e.textContent.trim().replace(/\s+/g, ' '), disabled: e.getAttribute('aria-disabled') })))
  await page.keyboard.press('Escape')
  // arrows held 400 ms (Babylon reads keys down per frame) vs tapped
  await page.locator('#renderCanvas').focus()
  const a0 = await C(page, () => window.__creation.camera().alpha)
  await page.keyboard.press('ArrowLeft')
  await sleep(300)
  const a1 = await C(page, () => window.__creation.camera().alpha)
  await page.keyboard.down('ArrowLeft'); await sleep(400); await page.keyboard.up('ArrowLeft')
  await sleep(300)
  const a2 = await C(page, () => window.__creation.camera().alpha)
  texts.arrows = { tapTurn: +(a1 - a0).toFixed(4), holdTurn: +(a2 - a1).toFixed(4) }
  // every menu open, its text
  for (const m of ['Projet', 'Lieu', 'Matériel', 'Câblage', 'Écoute', 'Vue', 'Aide']) {
    await page.getByRole('menuitem', { name: m, exact: true }).click()
    texts['menu-' + m] = { text: (await page.getByRole('menu').last().innerText()).replace(/\s+/g, ' '), honesty: honesty(await page.getByRole('menu').last().innerText()) }
    await page.keyboard.press('Escape')
  }
  // coverage « estimation » popover text
  await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: /Couverture/ }).or(page.getByRole('menuitem', { name: /Couverture/ })).first().click()
  await page.waitForFunction(() => ['ready', 'blocked', 'empty', 'silent'].includes(window.__creation.coverage().status) || window.__creation.coverage().message, null, { timeout: 60000 }).catch(() => {})
  await sleep(1500)
  texts.coverageBlocked = { status: await C(page, () => window.__creation.coverage().status), text: (await page.getByTestId('coverage-panel').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 600) }
  await page.getByTestId('coverage-chip').click().catch(() => {})
  await sleep(300)
  texts.coveragePopover = (await page.getByTestId('coverage-popover').innerText().catch(() => '')).replace(/\s+/g, ' ')
  axes.push(await axe(page, '[data-testid="coverage-panel"]', 'coverage-panel-blocked-popover-1366'))
  await page.keyboard.press('Escape')
  // listen limits disclosure text
  const more = page.getByTestId('listen-limits-title')
  if (await more.count()) { await more.click().catch(() => {}); texts.listenLimits = (await page.getByTestId('listen-limits').innerText().catch(() => '')).replace(/\s+/g, ' ') }
  texts.fullDom = honesty(await page.evaluate(() => document.body.innerText))
  texts.listenSimpleOnScreen = await page.getByTestId('listen-simple').innerText().catch(() => null)
  await browser.close()
  saveResults('axeScreens', { axes, texts })
}

export async function runLegacy() {
  const browser = await launch()
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  await ctx.addInitScript(DRAW_SPY)
  const page = await ctx.newPage()
  const log = instrument(page, 'legacy-3min')
  const { steps, step } = recorder()
  const t0 = Date.now()
  await page.goto(URL_APP + '?legacy=1')
  await sleep(6000)
  await shot(page, 'legacy-01-open')
  await step('legacy.open', async () => ({ title: await page.title(), text: (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 800), hooks: await C(page, () => ({ audioSim: typeof window.__audioSim, creation: typeof window.__creation })) }))
  await step('legacy.passOnboarding', async () => {
    const skip = page.getByRole('button', { name: /Passer/ }).or(page.getByRole('link', { name: /Passer/ }))
    if (await skip.count()) await skip.first().click()
    await sleep(4000)
    await shot(page, 'legacy-02-after-skip')
    const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    return { url: page.url(), text: text.slice(0, 800), honesty: honesty(text) }
  })
  await step('legacy.sandbox', async () => {
    await page.goto(URL_APP + '?legacy=1&level=sandbox')
    await sleep(8000)
    await shot(page, 'legacy-03-sandbox')
    const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    return { text: text.slice(0, 600), honesty: honesty(text) }
  })
  await step('legacy.a1', async () => {
    await page.goto(URL_APP + '?legacy=1&level=a1')
    await sleep(8000)
    await shot(page, 'legacy-04-a1')
    const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    return { text: text.slice(0, 900), english: /First PA|vocal \+ guitar/.test(text), honesty: honesty(text) }
  })
  await step('legacy.idleDraws', async () => {
    await page.mouse.move(5, 5)
    await sleep(2000)
    const d = await drawsOver(page, 5000)
    return { drawCallsIn5s: d }
  })
  // keep the session going to 3 minutes with light interaction
  await step('legacy.session', async () => {
    const vp = page.viewportSize()
    let i = 0
    while (Date.now() - t0 < 180000) {
      await page.mouse.move(vp.width / 2, vp.height / 2)
      await page.mouse.down()
      await page.mouse.move(vp.width / 2 + 80, vp.height / 2, { steps: 8 })
      await page.mouse.up()
      await page.keyboard.press(i % 2 ? 'v' : 'h').catch(() => {})
      await sleep(400)
      await page.keyboard.press('Escape').catch(() => {})
      i++
      await sleep(8000)
    }
    return { loops: i, seconds: Math.round((Date.now() - t0) / 1000) }
  })
  await browser.close()
  saveResults('legacy', { steps, log: summarise(log) })
}

/** A 3-minute creation session with the draw spy: idle draw calls vs the app's render counter (cross-check of CA-18). */
export async function runCreationSession() {
  const browser = await launch()
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  await ctx.addInitScript(DRAW_SPY)
  const page = await ctx.newPage()
  const log = instrument(page, 'creation-3min')
  const meter = await transferMeter(page)
  const { steps, step } = recorder()
  const t0 = Date.now()
  await page.goto(URL_APP)
  await page.waitForFunction(() => !!window.__creation, null, { timeout: 30000 })
  await page.getByTestId('place-picker').waitFor()
  const tPicker = Date.now() - t0
  await sleep(2000)
  const firstLoad = [...meter.sizes.entries()]
  await step('firstLoad', async () => ({
    msToPicker: tPicker,
    requests: firstLoad.length,
    totalKB: Math.round(firstLoad.reduce((s, [, n]) => s + n, 0) / 1024),
    biggest: firstLoad.sort((a, b) => b[1] - a[1]).slice(0, 10).map(([u, n]) => `${Math.round(n / 1024)} KB ${u.replace(ORIGIN, '')}`),
  }))
  const tT = Date.now()
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation.design().rig.instances.length === 5, null, { timeout: 60000 })
  const msTemplate = Date.now() - tT
  await page.waitForFunction(() => window.__creation.modelsPending() === 0, null, { timeout: 60000 })
  const msModels = Date.now() - tT
  await settle(page)
  const afterTemplate = [...meter.sizes.entries()]
  await step('templateLoad', async () => ({
    msTemplate, msModels,
    requests: afterTemplate.length,
    totalKB: Math.round(afterTemplate.reduce((s, [, n]) => s + n, 0) / 1024),
    biggest: afterTemplate.sort((a, b) => b[1] - a[1]).slice(0, 12).map(([u, n]) => `${Math.round(n / 1024)} KB ${u.replace(ORIGIN, '')}`),
    glb: afterTemplate.filter(([u]) => /\.glb/.test(u)).map(([u, n]) => `${Math.round(n / 1024)} KB ${u.replace(ORIGIN, '')}`),
  }))
  await step('idleDraws', async () => {
    await page.mouse.move(3, 3)
    await settle(page)
    const r0 = await C(page, () => window.__creation.renders())
    const d = await drawsOver(page, 5000)
    const r1 = await C(page, () => window.__creation.renders())
    return { drawCallsIn5s: d, rendersIn5s: r1 - r0 }
  })
  await step('session', async () => {
    let i = 0
    const vp = await page.getByTestId('viewport').boundingBox()
    while (Date.now() - t0 < 180000) {
      for (const m of ['Projet', 'Lieu', 'Matériel', 'Câblage', 'Écoute', 'Vue', 'Aide'][i % 7] ? [['Projet', 'Lieu', 'Matériel', 'Câblage', 'Écoute', 'Vue', 'Aide'][i % 7]] : []) {
        await page.getByRole('menuitem', { name: m, exact: true }).click()
        await sleep(300)
        await page.keyboard.press('Escape')
      }
      await page.mouse.move(vp.x + vp.width / 2, vp.y + vp.height * 0.9)
      await page.mouse.down()
      await page.mouse.move(vp.x + vp.width / 2 + 60, vp.y + vp.height * 0.9, { steps: 6 })
      await page.mouse.up()
      await page.locator('#renderCanvas').focus()
      await page.keyboard.press(']')
      await sleep(600)
      await page.keyboard.press('Escape')
      i++
      await sleep(6000)
    }
    return { loops: i, seconds: Math.round((Date.now() - t0) / 1000) }
  })
  await browser.close()
  saveResults('creationSession', { steps, log: summarise(log) })
}

export async function runHttp() {
  const { steps, step } = recorder()
  const head = async (url, method = 'GET') => {
    const r = await fetch(url, { method, redirect: 'manual', headers: { 'user-agent': 'tekonest-live-audit (read-only)' } })
    const body = method === 'GET' ? await r.text() : ''
    const h = Object.fromEntries([...r.headers.entries()].filter(([k]) => ['content-type', 'cache-control', 'etag', 'cf-cache-status', 'age', 'location', 'content-length', 'x-content-type-options', 'content-security-policy', 'referrer-policy', 'permissions-policy', 'strict-transport-security', 'cross-origin-opener-policy', 'x-frame-options', 'server'].includes(k)))
    await sleep(300)
    return { status: r.status, h, bytes: body.length, start: body.slice(0, 80).replace(/\s+/g, ' ') }
  }
  const index = await fetch(URL_APP).then((r) => r.text())
  const assets = [...index.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
  await step('index', () => head(URL_APP))
  await step('index.noSlash', () => head(ORIGIN + '/tekpractice/jouer'))
  await step('index.html', () => head(URL_APP + 'index.html'))
  const js = assets.find((a) => /assets\/.*\.js$/.test(a))
  const css = assets.find((a) => /\.css$/.test(a))
  await step('hashedJs', () => head(new URL(js, URL_APP).href))
  if (css) await step('hashedCss', () => head(new URL(css, URL_APP).href))
  await step('missingJs', () => head(URL_APP + 'assets/main-DOESNOTEXIST.js'))
  await step('missingCss', () => head(URL_APP + 'assets/boot-DOESNOTEXIST.css'))
  await step('missingGlb', () => head(URL_APP + 'models/does-not-exist.glb'))
  await step('missingDraco', () => head(URL_APP + 'draco/does-not-exist.wasm'))
  await step('missingRoute', () => head(URL_APP + 'some/deep/route'))
  await step('missingSite', () => head(ORIGIN + '/this-page-does-not-exist'))
  await step('_headers', () => head(ORIGIN + '/_headers'))
  await step('_redirects', () => head(ORIGIN + '/_redirects'))
  await step('tekpracticePage', () => head(URL_PAGE))
  await step('indexAssets', async () => assets)
  saveResults('http', { steps })
}

/** Grep every same-origin JS file the sessions loaded for strings that must not ship. */
export async function runBundleGrep(urls) {
  const pats = { placeholder: /REMPLACER PAR OSCAR|À REMPLACER/g, english: /DIRECTION MISMATCH|Signal flows one way/g, cdn: /cdn\.babylonjs\.com/g, fontsCdn: /fonts\.googleapis|fonts\.gstatic/g, apiKey: /sk-ant-[A-Za-z0-9]/g, anthropicUrl: /api\.anthropic\.com/g }
  const hits = {}
  for (const u of urls) {
    const t = await fetch(u).then((r) => r.text())
    for (const [k, re] of Object.entries(pats)) {
      const m = t.match(re)
      if (m) (hits[k] ??= []).push(`${u.replace(ORIGIN, '')} ×${m.length}`)
    }
    await sleep(150)
  }
  saveResults('bundleGrep', { files: urls.length, hits })
}

export async function runSitePage() {
  const browser = await launch()
  const { steps, step } = recorder()
  const axes = []
  for (const vp of [{ width: 1366, height: 768, tag: '1366' }, { width: 400, height: 800, tag: '400', mobile: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, ...(vp.mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) })
    const page = await ctx.newPage()
    const log = instrument(page, 'site-' + vp.tag)
    await page.goto(URL_PAGE, { waitUntil: 'networkidle' })
    await sleep(1000)
    await shot(page, 'site-' + vp.tag, true)
    await step('site.' + vp.tag, async () => {
      const info = await C(page, () => ({
        title: document.title,
        h1: [...document.querySelectorAll('h1')].map((e) => e.innerText),
        links: [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.href, text: a.innerText.trim().replace(/\s+/g, ' ').slice(0, 60) })),
        brokenImgs: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
        imgs: document.images.length,
        hScroll: document.documentElement.scrollWidth > innerWidth,
        scrollW: document.documentElement.scrollWidth,
        text: document.body.innerText.replace(/\s+/g, ' '),
      }))
      return { ...info, text: info.text.slice(0, 3000), honesty: honesty(info.text), log: summarise(log) }
    })
    axes.push(await axe(page, null, 'site-' + vp.tag))
    await ctx.close()
  }
  // the links that point into the site / app: their status (one request each)
  const v = steps['site.1366']?.v
  if (v) {
    const uniq = [...new Set(v.links.map((l) => l.href.split('#')[0]).filter((h) => h.startsWith(ORIGIN)))]
    const out = {}
    for (const u of uniq) { const r = await fetch(u, { redirect: 'manual' }); out[u.replace(ORIGIN, '')] = r.status + (r.headers.get('location') ? ' → ' + r.headers.get('location') : ''); await sleep(250) }
    steps['site.linkStatus'] = { ok: true, v: out }
  }
  await browser.close()
  saveResults('site', { steps, axes })
}

const which = process.argv[2]
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const map = { keyboard: runKeyboard, touch: runTouch, axe: runAxeScreens, legacy: runLegacy, session: runCreationSession, http: runHttp, site: runSitePage }
  for (const k of which ? which.split(',') : Object.keys(map)) { console.log('== ' + k); await map[k]() }
}
