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
function wav(seconds: number, rate = 22050, hz = 440): Buffer {
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
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 0.5 * 32767), 44 + i * 2)
  return b
}

test('(a) an unpowered console: « Lecture » is aria-disabled, focusable, described by the first reason; nothing audio is even fetched', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await boot(page)
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
  await expect(page.getByTestId('listen-state')).toHaveText('Lecture en cours : signal de test.')
  await expect(page.getByTestId('listen-meters').locator('li')).toHaveCount(2)
  await expect(page.getByTestId('listen-meters').locator('li[data-instance="k12-g"]')).toContainText(/QSC K12\.2 \(k12-g\) : niveau −?\d+,\d dBFS, gain −?\d+,\d dB, retard 0,0 ms, pan gauche \d+ %/)
  await expect(page.getByTestId('listen-meters').locator('li[data-instance="k12-d"]')).toContainText(/pan droite \d+ %/)
  await expect(page.getByTestId('listen-simple')).toHaveText(/^Simulation simple : .*Ni acoustique de salle, ni réponse en fréquence, ni réflexions, ni diaphonie\.$/)
  await expect(page.getByTestId('listen-volume')).toContainText('Le volume démarre bas')
  await expect(page.getByTestId('listen-local')).toContainText('ni envoyé ni enregistré')
  await expect(page.getByTestId('listen-panel')).not.toContainText(/NaN|Infinity|undefined/)
  await expect(page.getByRole('status')).toHaveText('Lecture en cours : signal de test.')
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
  await expect(page.getByTestId('listen-meters').locator('li[data-instance="k12-g"]')).toContainText('niveau silence, gain silence')
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
  await expect(page.getByRole('status')).toHaveText('Lecture arrêtée. La console n’est pas alimentée.')
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
  expect(body.height).toBeGreaterThanOrEqual(115) // the selection's properties are still usable
  expect(viewport.width / 1366).toBeGreaterThanOrEqual(0.6)
  expect(listen.x).toBeGreaterThanOrEqual(viewport.x + viewport.width - 1)
  // the block never grows past its share, and scrolls inside itself
  const pr = (await page.locator('.cr-props').boundingBox())!
  expect(listen.height).toBeLessThanOrEqual(pr.height * 0.34 + 1)
  await choose(page, 'Stop')
  await waitStopped(page)
})
