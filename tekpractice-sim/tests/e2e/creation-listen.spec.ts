import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Task 39 (CA-03, CA-26): Écoute › Lecture. The learner HEARS the rig through each powered speaker: the gate (playbackReady), the sound (levels read from
 * the AnalyserNodes, headless), mute and fader silence without gating, Stop frees everything, a local file never leaves the browser, the status
 * announcements, a held key is one press. The Chromium flag --autoplay-policy=no-user-gesture-required (playwright.config.ts) lets the headless
 * context start; the app still makes it inside the « Lecture » click.
 */
test.use({ viewport: { width: 1366, height: 768 } })

/** The reference template, with the power strip's mains cables it already holds; `powered` adds the two signal cables and playback-usb. */
const boot = async (page: Page, opts: { powered?: boolean } = {}): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 5)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  if (opts.powered === false) return
  const ok = await page.evaluate(() => {
    const c = window.__creation!
    return [
      c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } }).ok,
      c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-r' }, b: { instance: 'k12-d', port: 'in-line-a' } }).ok,
      c.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }).ok,
    ]
  })
  expect(ok).toEqual([true, true, true])
}
const set = (page: Page, control: string, value: boolean | string): Promise<boolean> =>
  page.evaluate(([c, v]) => window.__creation!.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: c as string, value: v as boolean | string }).ok, [control, value])
const ecoute = (page: Page) => page.getByRole('menuitem', { name: 'Écoute', exact: true })
const item = (page: Page, name: string) => page.getByRole('menuitem', { name, exact: true })
const openEcoute = async (page: Page): Promise<void> => {
  await ecoute(page).click()
  await expect(page.locator('#cr-menu-ecoute-panel')).toBeVisible()
}
/** Choose an Écoute item from the menu (opens it, clicks it). */
const choose = async (page: Page, name: string): Promise<void> => {
  await openEcoute(page)
  await item(page, name).click()
}
const state = (page: Page) => page.evaluate(() => window.__creation!.audioState())
const levels = (page: Page) => page.evaluate(() => window.__creation!.audioLevels())
const stats = (page: Page) => page.evaluate(() => window.__creation!.audioStats())
const waitPlaying = (page: Page) => page.waitForFunction(() => window.__creation!.audioState().state === 'playing', null, { timeout: 15_000 })
const waitStopped = (page: Page) => page.waitForFunction(() => window.__creation!.audioState().state === 'stopped', null, { timeout: 10_000 })
/** Both speakers are heard (an analyser reads signal on each). */
const waitBothHeard = (page: Page) =>
  page.waitForFunction(() => {
    const l = window.__creation!.audioLevels()
    return (l['k12-g'] ?? 0) > 0 && (l['k12-d'] ?? 0) > 0
  }, null, { timeout: 10_000 })
const waitSilent = (page: Page) =>
  page.waitForFunction(() => {
    const l = window.__creation!.audioLevels()
    return Object.keys(l).length === 2 && Object.values(l).every((v) => v === 0)
  }, null, { timeout: 10_000 })
const play = async (page: Page): Promise<void> => {
  await choose(page, 'Lecture')
  await waitPlaying(page)
  await waitBothHeard(page)
}

/** A mono 16-bit PCM WAV of a sine, generated here (no asset): `seconds` long. */
function wav(seconds: number, rate = 22050, hz = 440, amplitude = 0.5): Buffer {
  const n = Math.floor(seconds * rate)
  const b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n * 2, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * 2, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * amplitude * 32767), 44 + i * 2)
  return b
}

test('(a) an unpowered console: « Lecture » is aria-disabled, focusable, described by the first reason; nothing audio is even fetched', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await boot(page)
  // the properties keep a floor from the start (creation.css owns it; nothing lazy is loaded yet)
  await expect(page.locator('.cr-props .cr-panel-body')).toHaveCSS('min-height', '120px')
  expect(await set(page, 'playback-usb', true)).toBe(true)
  expect(await set(page, 'power', false)).toBe(true) // the console is switched off: HOST_UNPOWERED
  await openEcoute(page)
  const lecture = item(page, 'Lecture')
  await expect(lecture).toHaveAttribute('aria-disabled', 'true')
  await expect(lecture).toHaveAccessibleDescription('La console n’est pas alimentée.')
  await expect(page.locator('#cr-menu-desc-play')).toBeVisible() // the reason is on screen too, not only announced
  await expect(page.locator('#cr-menu-desc-play')).toHaveText('La console n’est pas alimentée.')
  for (const name of ['Choisir un fichier audio…', 'Signal de test']) {
    await expect(item(page, name)).toHaveAttribute('aria-disabled', 'true')
    await expect(item(page, name)).toHaveAccessibleDescription('La console n’est pas alimentée.')
  }
  // still focusable (APG): the keyboard reaches it
  await item(page, 'Lecture').focus()
  await expect(lecture).toBeFocused()
  await lecture.click({ force: true })
  await page.keyboard.press('Enter')
  expect((await state(page)).state).toBe('stopped')
  expect(await stats(page)).toEqual({ contexts: { opened: 0, closed: 0 }, urls: { created: 0, revoked: 0 }, elements: { created: 0, removed: 0 } })
  await expect(page.getByTestId('listen-panel')).toHaveCount(0) // the lazy chunk was not asked for
  expect(requests.filter((u) => /listenController|engine|testSignal/.test(u))).toEqual([])
  // « Morceau » is left out: the songs list is empty by design
  await expect(page.getByRole('menuitem', { name: 'Morceau' })).toHaveCount(0)
})

test('(b) powered + playback on: « Lecture » is enabled; one click, then BOTH speakers are heard; the mix comes from the geometry', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await boot(page)
  await openEcoute(page)
  const lecture = item(page, 'Lecture')
  await expect(lecture).not.toHaveAttribute('aria-disabled', 'true')
  expect(requests.filter((u) => /listenController[^/]*.js$/.test(u))).toEqual([]) // lazy: nothing yet
  await lecture.click()
  await waitPlaying(page)
  expect(requests.filter((u) => /listenController[^/]*.js$/.test(u))).toHaveLength(1) // fetched by the click
  await waitBothHeard(page)
  const l = await levels(page)
  expect(l['k12-g']).toBeGreaterThan(0)
  expect(l['k12-d']).toBeGreaterThan(0)
  expect(Object.keys(l).sort()).toEqual(['k12-d', 'k12-g'])
  const s = await state(page)
  expect(s).toMatchObject({ state: 'playing', source: 'test', sourceName: 'signal de test', lease: true, loop: true })
  expect(await page.evaluate(() => window.__creation!.leases())).toContain('meters')
  // The mix: Régie, facing the stage: k12-g (world +x) on the left, k12-d on the right; equidistant → no delay; gains > 0
  const g = s.voices.find((v) => v.instanceId === 'k12-g')!
  const d = s.voices.find((v) => v.instanceId === 'k12-d')!
  expect(g.pan).toBeLessThan(0)
  expect(d.pan).toBeGreaterThan(0)
  expect(g.channels).toEqual(['L'])
  expect(d.channels).toEqual(['R'])
  expect(g.gain).toBeGreaterThan(0)
  expect(Math.abs(g.gain - d.gain)).toBeLessThan(1e-9)
  expect(g.delayS).toBeCloseTo(0, 9)
  // The menu now says Stop; the block is on the Propriétés side with the numbers as text
  await openEcoute(page)
  await expect(item(page, 'Stop')).toBeVisible()
  await expect(item(page, 'Lecture')).toHaveCount(0)
  await page.keyboard.press('Escape')
  const panel = page.getByTestId('listen-panel')
  await expect(panel).toBeVisible()
  const p = (await panel.boundingBox())!
  const v = (await page.getByTestId('viewport').boundingBox())!
  expect(p.x).toBeGreaterThanOrEqual(v.x + v.width - 1) // right of the viewport: never over the 3D view
  await expect(page.getByTestId('listen-state')).toHaveText('Lecture en cours : signal de test (simulation simple).')
  await expect(page.getByTestId('listen-meters').locator('li')).toHaveCount(2)
  await expect(page.getByTestId('listen-meters').locator('li[data-instance="k12-g"]')).toContainText(/QSC K12\.2 \(k12-g\) : niveau de sortie −?\d+,\d dBFS, gain 0,0 dB, retard 0,0 ms, pan gauche \d+ %/)
  await expect(page.getByTestId('listen-meters').locator('li[data-instance="k12-d"]')).toContainText(/pan droite \d+ %/)
  await expect(page.getByTestId('listen-simple')).toHaveText(/^Simulation simple : .*Ni acoustique de salle, ni réponse en fréquence, ni réflexions, ni diaphonie\.$/)
  await expect(page.getByTestId('listen-simple')).toContainText('Le volume est normalisé')
  await expect(page.getByTestId('listen-volume')).toContainText('Le volume démarre bas')
  await expect(page.getByTestId('listen-local')).toContainText('ni envoyé ni enregistré')
  await expect(page.getByTestId('listen-panel')).not.toContainText(/NaN|Infinity|undefined/)
  await expect(page.getByRole('status')).toHaveText('Lecture en cours : signal de test (simulation simple).')
  expect((await stats(page)).contexts).toEqual({ opened: 1, closed: 0 })
  // No new control animates, even under the reduced-motion rule
  for (const id of ['listen-transport', 'listen-toggle']) expect(await page.getByTestId(id).evaluate((e) => getComputedStyle(e).transitionProperty), id).toBe('none')
  const axe = await new AxeBuilder({ page }).include('[data-testid="listen-panel"]').analyze()
  expect(axe.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')).toEqual([])
})

test('(c) mute and the fader silence the speakers (levels exactly 0) but never stop the playback; un-mute brings the sound back', async ({ page }) => {
  await boot(page)
  await play(page)
  expect(await set(page, 'mute-master', true)).toBe(true)
  await waitSilent(page) // the analysers read exactly 0 once the ramp has settled
  expect((await state(page)).voices.map((v) => v.gain)).toEqual([0, 0])
  expect((await state(page)).state).toBe('playing') // mute never gates
  await openEcoute(page)
  await expect(item(page, 'Stop')).not.toHaveAttribute('aria-disabled', 'true') // « Lecture » stays on
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('listen-silent')).toBeVisible()
  await expect(page.getByTestId('listen-silent')).toContainText('mute')
  await expect(page.getByTestId('listen-meters').locator('li[data-instance="k12-g"]')).toContainText('niveau de sortie silence, gain silence')
  expect(await page.evaluate(() => window.__creation!.leases())).toContain('meters')
  expect(await set(page, 'mute-master', false)).toBe(true)
  await waitBothHeard(page)
  await expect(page.getByTestId('listen-silent')).toBeHidden()
  // the fader at −inf is silence too
  expect(await set(page, 'fader-master', '-inf')).toBe(true)
  await waitSilent(page)
  expect((await state(page)).state).toBe('playing')
  expect(await set(page, 'fader-master', '0')).toBe(true)
  await waitBothHeard(page)
})

test('(d) Stop: the lease and the loop are released, the context is closed, and the page is idle again (0 renders in 2 s)', async ({ page }) => {
  await boot(page)
  await play(page)
  // while playing the scheduler really renders (the lease holds frames)
  const r0 = await page.evaluate(() => window.__creation!.renders())
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => window.__creation!.renders())).toBeGreaterThan(r0)
  await choose(page, 'Stop')
  await waitStopped(page)
  await page.waitForFunction(() => !window.__creation!.leases().includes('meters'))
  expect(await state(page)).toMatchObject({ state: 'stopped', lease: false, loop: false, source: null, voices: [] })
  expect(await levels(page)).toEqual({})
  await expect(page.getByRole('status')).toHaveText('Lecture arrêtée.')
  // the engine fades out then releases itself: every context opened is closed
  await page.waitForFunction(() => {
    const s = window.__creation!.audioStats()
    return s.contexts.opened === s.contexts.closed && window.__creation!.audioState().retiring === 0
  }, null, { timeout: 5000 })
  expect((await stats(page)).contexts).toEqual({ opened: 1, closed: 1 })
  // idle: wait on a real signal (the last frame drawn), then watch 2 s
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __idle?: { n: number; t: number } }
      const n = window.__creation!.renders()
      const now = performance.now()
      if (!w.__idle || w.__idle.n !== n) {
        w.__idle = { n, t: now }
        return false
      }
      return now - w.__idle.t > 400 // the render count has not moved for 400 ms: the last frame is drawn
    },
    null,
    { timeout: 10_000, polling: 100 }
  )
  const before = await page.evaluate(() => window.__creation!.renders())
  await page.waitForTimeout(2000)
  expect(await page.evaluate(() => window.__creation!.renders())).toBe(before)
  // and it can be started again: a fresh context
  await play(page)
  expect((await stats(page)).contexts).toEqual({ opened: 2, closed: 1 })
  await choose(page, 'Stop')
  await waitStopped(page)
})

test('(e) the chain turning invalid while playing stops it, said with the reason; a place change stops it too, and nothing is left open', async ({ page }) => {
  await boot(page)
  await play(page)
  expect(await set(page, 'power', false)).toBe(true)
  await waitStopped(page)
  await expect(page.getByRole('status')).toContainText('Lecture arrêtée. La console n’est pas alimentée.') // with the lost « Micro OK », merged by the announcer
  expect(await page.evaluate(() => window.__creation!.leases())).not.toContain('meters')
  expect(await set(page, 'power', true)).toBe(true)
  await play(page)
  // a place change
  await page.evaluate(() => window.__creation!.choosePlace('room:church-worship-medium'))
  await waitStopped(page)
  await page.waitForFunction(() => window.__creation!.place() === 'room:church-worship-medium')
  expect(await page.evaluate(() => window.__creation!.leases())).not.toContain('meters')
  await page.waitForFunction(() => {
    const s = window.__creation!.audioStats()
    return s.contexts.opened === s.contexts.closed
  }, null, { timeout: 5000 })
  expect((await stats(page)).contexts).toEqual({ opened: 2, closed: 2 })
})

test('(f) « Choisir un fichier audio… »: a 1 s WAV made here plays through both speakers, never leaves the browser, and every URL / element is released', async ({ page }) => {
  const sent: { url: string; method: string; post: string | null }[] = []
  page.on('request', (r) => sent.push({ url: r.url(), method: r.method(), post: r.postData() }))
  await boot(page)
  const before = await page.evaluate(async () => ({ ls: JSON.stringify({ ...localStorage }), idb: (await indexedDB.databases()).map((d) => d.name) }))
  // a recorder in the page: the loudest each speaker was, and the element's src, sampled every 20 ms (the file lasts 1 s)
  await page.evaluate(() => {
    const seen: Record<string, number> = {}
    const w = window as unknown as { __seen: Record<string, number>; __src: string[] }
    w.__seen = seen
    w.__src = []
    setInterval(() => {
      for (const [k, v] of Object.entries(window.__creation!.audioLevels())) seen[k] = Math.max(seen[k] ?? 0, v)
      const a = document.querySelector<HTMLAudioElement>('[data-testid="listen-audio"]')
      if (a?.src && !w.__src.includes(a.src)) w.__src.push(a.src)
    }, 20)
  })
  await openEcoute(page)
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), item(page, 'Choisir un fichier audio…').click()])
  expect(await chooser.isMultiple()).toBe(false)
  await chooser.setFiles({ name: 'test-tone.wav', mimeType: 'audio/wav', buffer: wav(1) })
  await page.waitForFunction(() => window.__creation!.audioState().sourceName === 'fichier test-tone.wav', null, { timeout: 15_000 })
  // it ends by itself after ~1 s: « Lecture terminée. », everything released
  await waitStopped(page)
  await expect(page.getByRole('status')).toHaveText('Lecture terminée.')
  const seen = await page.evaluate(() => (window as unknown as { __seen: Record<string, number> }).__seen)
  expect(seen['k12-g']).toBeGreaterThan(0)
  expect(seen['k12-d']).toBeGreaterThan(0)
  const srcs = await page.evaluate(() => (window as unknown as { __src: string[] }).__src)
  expect(srcs).toHaveLength(1)
  expect(srcs[0]).toMatch(/^blob:/) // an object URL on a media element, nothing else
  await page.waitForFunction(() => {
    const s = window.__creation!.audioStats()
    return s.contexts.opened === s.contexts.closed && s.urls.created === s.urls.revoked && s.elements.created === s.elements.removed
  }, null, { timeout: 5000 })
  const st = await stats(page)
  expect(st.urls).toEqual({ created: 1, revoked: 1 })
  expect(st.elements).toEqual({ created: 1, removed: 1 })
  expect(await page.locator('[data-testid="listen-audio"]').count()).toBe(0) // the <audio> element is gone
  // S3: no request carries the file; no write to a store
  expect(sent.filter((r) => r.method !== 'GET' && r.method !== 'HEAD' && r.method !== 'OPTIONS')).toEqual([])
  expect(sent.filter((r) => r.post !== null)).toEqual([])
  // The media element reads its own object URL (a local GET of the page's blob, not the network); nothing else mentions the file
  expect(sent.filter((r) => /^blob:/.test(r.url) && (r.method !== 'GET' || r.post !== null || new URL(r.url.slice(5)).origin !== new URL(page.url()).origin))).toEqual([])
  expect(sent.filter((r) => /test-tone/.test(r.url) || /^data:audio/.test(r.url))).toEqual([])
  const after = await page.evaluate(async () => ({ ls: JSON.stringify({ ...localStorage }), idb: (await indexedDB.databases()).map((d) => d.name) }))
  expect(after.idb).toEqual(before.idb)
  expect(after.ls).not.toMatch(/test-tone|UklGR|RIFF/)
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0)
  // the page keeps no reference to the file: « Lecture » goes back to the test signal, it does not replay the file
  await choose(page, 'Lecture')
  await waitPlaying(page)
  expect((await state(page)).sourceName).toBe('signal de test')
  await choose(page, 'Stop')
  await waitStopped(page)
})

test('(g) a held Entrée is ONE press: in the menu and on the block\'s button (an even number of keydowns would otherwise toggle back)', async ({ page }) => {
  await boot(page)
  await ecoute(page).focus()
  await page.keyboard.press('ArrowDown') // opens Écoute on « Lecture »
  await expect(item(page, 'Lecture')).toBeFocused()
  for (let i = 0; i < 4; i++) await page.keyboard.down('Enter') // the first is a press, the three others are auto-repeats
  await page.keyboard.up('Enter')
  await waitPlaying(page)
  await page.waitForTimeout(400)
  expect((await state(page)).state).toBe('playing')
  expect((await stats(page)).contexts.opened).toBe(1) // started once, not start / stop / start
  await expect(page.locator('#cr-menu-ecoute-panel')).toBeHidden()
  // the block's button: one Entrée = one toggle (Stop); its repeats must not start it again
  await page.getByTestId('listen-transport').focus()
  for (let i = 0; i < 4; i++) await page.keyboard.down('Enter')
  await page.keyboard.up('Enter')
  await waitStopped(page)
  await page.waitForTimeout(400)
  expect((await state(page)).state).toBe('stopped')
  expect((await stats(page)).contexts.opened).toBe(1)
})

test('(h) the block\'s button starts and stops the sound; it is aria-disabled with the reason when the chain cannot play', async ({ page }) => {
  await boot(page)
  await play(page)
  await set(page, 'power', false)
  await waitStopped(page)
  const btn = page.getByTestId('listen-transport')
  await expect(btn).toHaveText('Lecture')
  await expect(btn).toHaveAttribute('aria-disabled', 'true')
  await expect(btn).toHaveAccessibleDescription('La console n’est pas alimentée.')
  await expect(page.getByTestId('listen-reason')).toHaveText('La console n’est pas alimentée.')
  await btn.click({ force: true }) // aria-disabled is not « disabled »: the click lands and does nothing
  expect((await state(page)).state).toBe('stopped')
  await set(page, 'power', true)
  await expect(btn).not.toHaveAttribute('aria-disabled', 'true')
  await btn.click()
  await waitPlaying(page)
  await expect(btn).toHaveText('Stop')
  await btn.click()
  await waitStopped(page)
  await expect(btn).toHaveText('Lecture')
})

test('(i) the playback and the mic are announced once when they flip, not per store change', async ({ page }) => {
  await boot(page, { powered: false })
  await page.evaluate(() => {
    const said: string[] = []
    ;(window as unknown as { __said: string[] }).__said = said
    new MutationObserver(() => said.push(document.querySelector('.cr-status-msg')!.textContent ?? '')).observe(document.querySelector('.cr-status-msg')!, { childList: true, characterData: true, subtree: true })
  })
  const said = (): Promise<string[]> => page.evaluate(() => (window as unknown as { __said: string[] }).__said)
  // the rig becomes playable: « Lecture possible » (and the mic, cabled in the template, once the console plays)
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } })
    c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-r' }, b: { instance: 'k12-d', port: 'in-line-a' } })
  })
  expect((await said()).filter((t) => t.includes('Lecture possible'))).toEqual([]) // the source is still off: not yet
  expect(await set(page, 'playback-usb', true)).toBe(true)
  await expect(page.getByRole('status')).toContainText('Lecture possible')
  const flips = (await said()).filter((t) => t.includes('Lecture possible'))
  expect(flips).toHaveLength(1)
  // unrelated store changes do not repeat it
  await page.evaluate(() => {
    const c = window.__creation!
    const p = c.design().placements.find((x) => x.instanceId === 'sm58')!
    c.dispatch({ type: 'SET_POSE', instanceId: 'sm58', position: [p.position_m[0] + 0.5, p.position_m[1], p.position_m[2]], yawDeg: p.yawDeg, tiltDeg: p.tiltDeg ?? 0, mount: p.mount ?? 'stand' })
    c.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'mute-master', value: true })
    c.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'mute-master', value: false })
  })
  expect((await said()).filter((t) => t.includes('Lecture possible'))).toHaveLength(1)
  // the first reason, when it is lost
  expect(await set(page, 'playback-usb', false)).toBe(true)
  await expect(page.getByRole('status')).toContainText('La lecture console est coupée.')
  expect((await said()).filter((t) => t.includes('La lecture console est coupée.'))).toHaveLength(1)
  // the same reason again (a change that keeps it) is not repeated
  await set(page, 'mute-master', true)
  await set(page, 'mute-master', false)
  expect((await said()).filter((t) => t.includes('La lecture console est coupée.'))).toHaveLength(1)
})

test('(j) « Micro OK » is announced when the mic reaches a powered console, and its loss with a reason', async ({ page }) => {
  await boot(page)
  await expect(page.getByTestId('status-mic')).toHaveText('Micro OK')
  expect(await set(page, 'power', false)).toBe(true)
  await expect(page.getByRole('status')).toContainText('Plus de Micro OK.')
  await expect(page.getByRole('status')).toContainText('La console n’est pas alimentée.')
  expect(await set(page, 'power', true)).toBe(true)
  await expect(page.getByRole('status')).toContainText('Lecture possible. Micro OK.')
})

test('(k) the sound follows the listener: the Régie facing the stage and the walk view both pan a speaker to the side it is DRAWN on', async ({ page }) => {
  await boot(page)
  const pan = async (id: string): Promise<number> => (await state(page)).voices.find((v) => v.instanceId === id)!.pan
  const drawnLeft = async (id: string): Promise<boolean> =>
    page.evaluate((i) => {
      const c = window.__creation!
      const at = c.design().placements.find((p) => p.instanceId === i)!.position_m
      const s = c.worldScreen([at[0], at[1], at[2]])!
      const r = document.getElementById('renderCanvas')!.getBoundingClientRect()
      return s.x < r.left + r.width / 2
    }, id)
  // the orbit camera stands on the Régie looking at the stage (key 1 = the Régie)
  await page.getByTestId('viewport').locator('canvas').focus()
  await page.keyboard.press('1')
  await page.waitForFunction(() => !window.__creation!.cameraMoving())
  await play(page)
  expect(await drawnLeft('k12-g')).toBe(true)
  expect(await pan('k12-g')).toBeLessThan(0)
  expect(await drawnLeft('k12-d')).toBe(false)
  expect(await pan('k12-d')).toBeGreaterThan(0)
  // the walk view: the sound now follows the walk camera; walking sideways changes the pan, the sign still follows the drawing
  await page.getByTestId('viewport').locator('canvas').focus()
  await page.keyboard.press('Shift+V')
  await page.waitForFunction(() => window.__creation!.view() === 'explore')
  await page.waitForFunction(() => window.__creation!.walkCamera() !== null)
  const w = (await page.evaluate(() => window.__creation!.walkCamera()))!
  await page.waitForFunction(
    (at) => {
      const s = window.__creation!.audioState()
      return s.voices.length === 2 && at !== undefined
    },
    w
  )
  const g0 = await pan('k12-g')
  expect(Math.sign(g0)).toBe((await drawnLeft('k12-g')) ? -1 : 1)
  // strafe: the listener moves, the pan of the nearer-side speaker changes within a few frames (no store change involved)
  await page.keyboard.down('KeyD')
  await page.waitForTimeout(700)
  await page.keyboard.up('KeyD')
  await page.waitForFunction((p0) => Math.abs(window.__creation!.audioState().voices.find((v) => v.instanceId === 'k12-g')!.pan - p0) > 0.01, g0, { timeout: 5000 })
  expect(Math.sign(await pan('k12-g'))).toBe((await drawnLeft('k12-g')) ? -1 : 1)
  await page.keyboard.press('Escape') // back to Orbit
  await choose(page, 'Stop')
  await waitStopped(page)
})

test('(l) « Signal de test » plays the generated signal; switching source swaps the engine and leaks nothing', async ({ page }) => {
  await boot(page)
  await choose(page, 'Signal de test')
  await waitPlaying(page)
  await waitBothHeard(page)
  expect((await state(page)).sourceName).toBe('signal de test')
  const chooserPromise = page.waitForEvent('filechooser')
  await choose(page, 'Choisir un fichier audio…')
  const chooser = await chooserPromise
  await chooser.setFiles({ name: 'long.wav', mimeType: 'audio/wav', buffer: wav(3) })
  await page.waitForFunction(() => window.__creation!.audioState().sourceName === 'fichier long.wav', null, { timeout: 10_000 })
  await choose(page, 'Stop')
  await waitStopped(page)
  await page.waitForFunction(() => {
    const s = window.__creation!.audioStats()
    return s.contexts.opened === s.contexts.closed && s.urls.created === s.urls.revoked && s.elements.created === s.elements.removed
  }, null, { timeout: 5000 })
  expect((await stats(page)).contexts).toEqual({ opened: 2, closed: 2 })
  expect(await page.evaluate(() => window.__creation!.leases())).not.toContain('meters')
})

test('(m) a file the browser cannot decode: said, nothing left running', async ({ page }) => {
  await boot(page)
  await openEcoute(page)
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), item(page, 'Choisir un fichier audio…').click()])
  await chooser.setFiles({ name: 'not-audio.wav', mimeType: 'audio/wav', buffer: Buffer.from('this is not a sound file at all') })
  await expect(page.getByRole('status')).toHaveText('Ce fichier n’a pas pu être lu. Essayez un fichier MP3, WAV ou OGG.', { timeout: 15_000 })
  expect((await state(page)).state).toBe('stopped')
  await page.waitForFunction(() => {
    const s = window.__creation!.audioStats()
    return s.contexts.opened === s.contexts.closed && s.urls.created === s.urls.revoked && s.elements.created === s.elements.removed
  }, null, { timeout: 5000 })
  expect(await page.evaluate(() => window.__creation!.leases())).not.toContain('meters')
})

test('(n) 1366×768 with the coverage AND the listening block open: the properties keep room, the viewport keeps ≥ 60 %, nothing overlays the 3D view', async ({ page }) => {
  await boot(page)
  await play(page)
  await ecoute(page).click()
  await page.getByRole('menuitemcheckbox', { name: 'Couverture' }).click()
  await page.waitForFunction(() => window.__creation!.coverage().status === 'ready' && !window.__creation!.coverage().pending, null, { timeout: 20_000 })
  await expect(page.getByTestId('listen-panel')).toBeVisible()
  await expect(page.getByTestId('coverage-panel')).toBeVisible()
  const body = (await page.locator('.cr-props .cr-panel-body').boundingBox())!
  const listen = (await page.getByTestId('listen-panel').boundingBox())!
  const viewport = (await page.getByTestId('viewport').boundingBox())!
  expect(body.height).toBeGreaterThanOrEqual(120) // the selection's properties are still usable (the floor is creation.css's)
  test.info().annotations.push({ type: 'measured', description: `properties body ${body.height.toFixed(1)} px, listen block ${listen.height.toFixed(1)} px, props column ${(await page.locator('.cr-props').boundingBox())!.height.toFixed(1)} px, viewport ${(viewport.width / 1366).toFixed(3)} of the width` })
  console.log(`[measured 1366x768, coverage + listen open] properties body ${body.height.toFixed(1)} px; listen block ${listen.height.toFixed(1)} px`)
  const props = (await page.locator('.cr-props').boundingBox())!
  for (const box of [listen, (await page.getByTestId('coverage-panel').boundingBox())!, body]) {
    expect(box.y).toBeGreaterThanOrEqual(props.y - 1) // both blocks stay inside the properties column
    expect(box.y + box.height).toBeLessThanOrEqual(props.y + props.height + 1)
    expect(box.x).toBeGreaterThanOrEqual(props.x - 1)
    expect(box.x + box.width).toBeLessThanOrEqual(props.x + props.width + 1)
  }
  expect(viewport.width / 1366).toBeGreaterThanOrEqual(0.6)
  expect(listen.x).toBeGreaterThanOrEqual(viewport.x + viewport.width - 1)
  // the block never grows past its share, and scrolls inside itself
  const pr = (await page.locator('.cr-props').boundingBox())!
  expect(listen.height).toBeLessThanOrEqual(pr.height * 0.34 + 1)
  await choose(page, 'Stop')
  await waitStopped(page)
})

test('(o) the ear height moves the listener: the voices follow it at once, without any change to the rig', async ({ page }) => {
  await boot(page)
  // an asymmetric rig, so that the loudness normalisation (the loudest speaker is unity) does not hide the change: k12-g close to the Régie, k12-d far away
  await page.evaluate(() => {
    const c = window.__creation!
    const p = c.design().placements.find((x) => x.instanceId === 'k12-g')!
    c.dispatch({ type: 'SET_POSE', instanceId: 'k12-g', position: [1, 0, 0], yawDeg: p.yawDeg, tiltDeg: p.tiltDeg ?? 0, mount: p.mount ?? 'stand' })
  })
  await play(page)
  const gain = async (): Promise<number> => (await state(page)).voices.find((v) => v.instanceId === 'k12-d')!.gain
  const seated = await gain()
  expect(seated).toBeLessThan(1) // k12-d is the quieter one
  const rig = await page.evaluate(() => JSON.stringify(window.__creation!.design()))
  await openEcoute(page)
  await page.getByRole('menuitemradio', { name: 'Hauteur d’oreille : debout 1,7 m' }).click()
  expect(await page.evaluate(() => window.__creation!.earHeight())).toBe(1.7)
  await page.waitForFunction((g0) => window.__creation!.audioState().voices.find((v) => v.instanceId === 'k12-d')!.gain !== g0, seated, { timeout: 5000 })
  const standing = await gain()
  expect(standing).not.toBe(seated)
  expect(Math.abs(standing - seated)).toBeLessThan(0.2) // a listener 0,5 m higher: a change of distance, not a different sound
  expect(await page.evaluate(() => JSON.stringify(window.__creation!.design()))).toBe(rig) // the rig did not change
  await choose(page, 'Stop')
  await waitStopped(page)
})

/** Largest sample of each speaker (after the master gain) and of the real output (after the limiter), recorded in the page every 20 ms. */
const recordPeaks = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const w = window as unknown as { __pk: { v: Record<string, number>; out: number; n: number } }
    w.__pk = { v: {}, out: 0, n: 0 }
    setInterval(() => {
      const p = window.__creation!.audioPeaks()
      for (const [k, x] of Object.entries(p.voices)) w.__pk.v[k] = Math.max(w.__pk.v[k] ?? 0, x)
      w.__pk.out = Math.max(w.__pk.out, p.output)
      w.__pk.n++
    }, 20)
  })
const peaks = (page: Page) => page.evaluate(() => (window as unknown as { __pk: { v: Record<string, number>; out: number; n: number } }).__pk)
const dbfs = (x: number): number => 20 * Math.log10(x)

test('(p) LOUDNESS: the test signal at the Régie is audible and safe: each speaker and the real output peak between −30 and −6 dBFS (measured, post-master)', async ({ page }) => {
  await boot(page)
  await recordPeaks(page)
  await play(page)
  await page.waitForFunction(() => (window as unknown as { __pk: { n: number } }).__pk.n >= 200, null, { timeout: 15_000 }) // 4 s: the bursts and part of the pattern
  const pk = await peaks(page)
  const g = dbfs(pk.v['k12-g'])
  const d = dbfs(pk.v['k12-d'])
  const out = dbfs(pk.out)
  console.log(`[measured, test signal, Régie] k12-g ${g.toFixed(1)} dBFS, k12-d ${d.toFixed(1)} dBFS, output ${out.toFixed(1)} dBFS`)
  test.info().annotations.push({ type: 'measured', description: `test signal peaks: k12-g ${g.toFixed(1)}, k12-d ${d.toFixed(1)}, output ${out.toFixed(1)} dBFS` })
  for (const [name, v] of [['k12-g', g], ['k12-d', d], ['output', out]] as const) {
    expect(v, `${name} peak ${v.toFixed(1)} dBFS`).toBeGreaterThanOrEqual(-30)
    expect(v, `${name} peak ${v.toFixed(1)} dBFS`).toBeLessThanOrEqual(-6)
  }
  await choose(page, 'Stop')
  await waitStopped(page)
})

test('(q) LOUDNESS, worst case: a FULL-SCALE file stays under −6 dBFS at the output at unity, and under 0 dBFS with the fader at +10 dB (the limiter)', async ({ page }) => {
  await boot(page)
  await recordPeaks(page)
  await openEcoute(page)
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), item(page, 'Choisir un fichier audio…').click()])
  await chooser.setFiles({ name: 'full-scale.wav', mimeType: 'audio/wav', buffer: wav(6, 22050, 440, 1) })
  await page.waitForFunction(() => window.__creation!.audioState().state === 'playing', null, { timeout: 15_000 })
  await page.waitForFunction(() => (window as unknown as { __pk: { n: number } }).__pk.n >= 50 && (window as unknown as { __pk: { out: number } }).__pk.out > 0, null, { timeout: 15_000 })
  const unity = await peaks(page)
  console.log(`[measured, full-scale file, unity faders] k12-g ${dbfs(unity.v['k12-g']).toFixed(1)}, k12-d ${dbfs(unity.v['k12-d']).toFixed(1)}, output ${dbfs(unity.out).toFixed(1)} dBFS`)
  test.info().annotations.push({ type: 'measured', description: `full-scale file, unity: output ${dbfs(unity.out).toFixed(1)} dBFS` })
  expect(dbfs(unity.out)).toBeLessThanOrEqual(-6)
  expect(dbfs(unity.out)).toBeGreaterThanOrEqual(-30)
  // the fader at +10 dB: the limiter bounds the output
  await recordPeaks(page)
  expect(await set(page, 'fader-master', '+10')).toBe(true)
  await page.waitForFunction(() => (window as unknown as { __pk: { n: number } }).__pk.n >= 40, null, { timeout: 15_000 })
  const boost = await peaks(page)
  console.log(`[measured, full-scale file, fader +10 dB] k12-g ${dbfs(boost.v['k12-g']).toFixed(1)}, k12-d ${dbfs(boost.v['k12-d']).toFixed(1)}, output ${dbfs(boost.out).toFixed(1)} dBFS`)
  test.info().annotations.push({ type: 'measured', description: `full-scale file, fader +10 dB: output ${dbfs(boost.out).toFixed(1)} dBFS` })
  expect(boost.out).toBeLessThan(1) // never at or over full scale
  await choose(page, 'Stop')
  await waitStopped(page)
})

test('(r) under the place picker a valid chain still has « Lecture » off, and it says why', async ({ page }) => {
  await boot(page)
  await page.getByRole('menuitem', { name: 'Lieu', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Choisir un lieu…' }).click()
  await expect(page.getByTestId('place-picker')).toBeVisible()
  await openEcoute(page)
  await expect(item(page, 'Lecture')).toHaveAttribute('aria-disabled', 'true')
  await expect(item(page, 'Lecture')).toHaveAccessibleDescription('Indisponible pendant le choix du lieu.')
  await expect(page.locator('#cr-menu-desc-play')).toBeVisible()
})

test('(s) the sound stopping and the coverage emptying in ONE change are BOTH announced (the status line is one region where the last write used to win)', async ({ page }) => {
  await boot(page)
  await play(page) // the listen controller subscribed first…
  await ecoute(page).click()
  await page.getByRole('menuitemcheckbox', { name: 'Couverture' }).click() // …the coverage after it
  await page.waitForFunction(() => window.__creation!.coverage().status === 'ready' && !window.__creation!.coverage().pending, null, { timeout: 20_000 })
  await page.evaluate(() => {
    const said: string[] = []
    ;(window as unknown as { __said: string[] }).__said = said
    new MutationObserver(() => said.push(document.querySelector('.cr-status-msg')!.textContent ?? '')).observe(document.querySelector('.cr-status-msg')!, { childList: true, characterData: true, subtree: true })
  })
  expect(await set(page, 'power', false)).toBe(true)
  await waitStopped(page)
  const status = page.locator('.cr-status-msg')
  await expect(status).toContainText('Lecture arrêtée. La console n’est pas alimentée.')
  await expect(status).toContainText('Aucune enceinte audible')
  // …in ONE write: the region was never left holding only the second message
  const said = await page.evaluate(() => (window as unknown as { __said: string[] }).__said)
  expect(said.filter((t) => t.includes('Lecture arrêtée.') && t.includes('Aucune enceinte audible'))).toHaveLength(1)
  expect(said.filter((t) => t.includes('Aucune enceinte audible') && !t.includes('Lecture arrêtée.'))).toEqual([])
})

test('(t) the console BALANCE changes the sound and the coverage alike: G100 silences the right-fed speaker (meter 0) and takes it out of the coverage; C brings it back', async ({ page }) => {
  await boot(page)
  await play(page)
  await ecoute(page).click()
  await page.getByRole('menuitemcheckbox', { name: 'Couverture' }).click()
  await page.waitForFunction(() => window.__creation!.coverage().status === 'ready' && !window.__creation!.coverage().pending, null, { timeout: 20_000 })
  expect((await page.evaluate(() => window.__creation!.coverage().sources)).sort()).toEqual(['k12-d', 'k12-g'])
  expect(await set(page, 'balance-master', 'G100')).toBe(true)
  await page.waitForFunction(() => {
    const l = window.__creation!.audioLevels()
    return l['k12-d'] === 0 && (l['k12-g'] ?? 0) > 0
  }, null, { timeout: 10_000 })
  expect((await state(page)).state).toBe('playing') // the balance never gates
  expect((await state(page)).voices.find((v) => v.instanceId === 'k12-d')!.gain).toBe(0)
  await page.waitForFunction(() => window.__creation!.coverage().sources.join() === 'k12-g' && !window.__creation!.coverage().pending, null, { timeout: 10_000 })
  await expect(page.getByTestId('listen-meters').locator('li[data-instance="k12-d"]')).toContainText('niveau de sortie silence, gain silence')
  expect(await set(page, 'balance-master', 'C')).toBe(true)
  await waitBothHeard(page)
  await page.waitForFunction(() => window.__creation!.coverage().sources.length === 2 && !window.__creation!.coverage().pending, null, { timeout: 10_000 })
  // half way: G50 puts the right speaker at one half (−6 dB)
  expect(await set(page, 'balance-master', 'G50')).toBe(true)
  await page.waitForFunction(() => Math.abs((window.__creation!.audioState().voices.find((v) => v.instanceId === 'k12-d')?.gain ?? 0) - 0.5) < 1e-9, null, { timeout: 5000 })
  // the limits are said where the learner reads: the block carries every limit the ADR announces
  await expect(page.getByTestId('listen-limits')).toContainText('la moyenne de ses deux côtés')
  await expect(page.getByTestId('listen-limits')).toContainText('on n’écoute pas « depuis ici »')
  await expect(page.getByTestId('listen-simple')).toContainText('le fader, le mute et le balance de la console agissent sur le son')
  await choose(page, 'Stop')
  await waitStopped(page)
})

test('(u) a « Stop » shown in an open menu never starts a sound: the file ended while the menu was open', async ({ page }) => {
  await boot(page)
  await openEcoute(page)
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), item(page, 'Choisir un fichier audio…').click()])
  await chooser.setFiles({ name: 'short.wav', mimeType: 'audio/wav', buffer: wav(1) })
  await waitPlaying(page)
  await openEcoute(page)
  await expect(item(page, 'Stop')).toBeVisible() // rendered as « Stop »
  await waitStopped(page) // the file ends while the menu stays open
  const opened = (await stats(page)).contexts.opened
  await item(page, 'Stop').click()
  await page.waitForTimeout(600)
  expect((await state(page)).state).toBe('stopped')
  expect((await stats(page)).contexts.opened).toBe(opened) // nothing was started
})

test('(v) pulling one speaker\'s cable while playing: that speaker leaves the mix, the other goes on, the playback is not stopped', async ({ page }) => {
  await boot(page)
  await play(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'UNPLUG', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } }))
  await page.waitForFunction(() => window.__creation!.audioState().voices.map((v) => v.instanceId).join() === 'k12-d')
  expect((await state(page)).state).toBe('playing')
  await page.waitForFunction(() => (window.__creation!.audioLevels()['k12-d'] ?? 0) > 0)
  await page.waitForFunction(() => !('k12-g' in window.__creation!.audioLevels()), null, { timeout: 5000 }) // its chain is gone once the fade is done
  await choose(page, 'Stop')
  await waitStopped(page)
})

test('(w) the songs list is fetched when the learner reaches for Écoute, not at boot', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await boot(page)
  expect(requests.filter((u) => /\/songs-[^/]*\.js$/.test(u))).toEqual([])
  await ecoute(page).hover()
  await page.waitForFunction(() => performance.getEntriesByType('resource').some((e) => /\/songs-[^/]*\.js$/.test(e.name)), null, { timeout: 5000 })
  expect(requests.filter((u) => /\/songs-[^/]*\.js$/.test(u)).length).toBeGreaterThan(0)
  await ecoute(page).click()
  await expect(page.getByRole('menuitem', { name: 'Morceau' })).toHaveCount(0) // the list is empty: the group stays hidden
})
