import { expect, test, type Page } from '@playwright/test'

/**
 * Task 39 review (Important 3): the other listen specs run Chromium with --autoplay-policy=no-user-gesture-required (playwright.config.ts), which hides
 * whether the context made by a click starts under the REAL policy. This file launches Chromium WITHOUT that flag: the AudioContext is made inside the
 * click / key press on the menu item (src/creation/boot.ts: `contextForClick`), before the lazy chunk is fetched, and must run and make sound.
 */
test.use({ viewport: { width: 1366, height: 768 }, launchOptions: { args: [] } })

const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 5)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
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
const waitHeard = (page: Page) =>
  page.waitForFunction(() => {
    const l = window.__creation!.audioLevels()
    return (l['k12-g'] ?? 0) > 0 && (l['k12-d'] ?? 0) > 0
  }, null, { timeout: 15_000 })

/**
 * FINDING (recorded in the task report): headless Chromium started without the flag still lets a context made outside any gesture run (Playwright's own
 * navigation counts as user activation), so this file cannot SHOW the policy blocking a late context. What it can prove, and does, is where the context is made:
 * every AudioContext the app constructs is constructed synchronously inside the click / key task (a timer scheduled at the start of that task has not fired yet),
 * i.e. before the lazy chunk's `await import()`. The `await` continuation is a later task, where Safari would refuse to start the context.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __ctxLog: { inGestureTask: boolean }[] }
    w.__ctxLog = []
    let inGestureTask = false
    for (const t of ['click', 'keydown']) addEventListener(t, () => { inGestureTask = true; setTimeout(() => { inGestureTask = false }, 0) }, true)
    const Orig = window.AudioContext
    window.AudioContext = class extends Orig {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args)
        w.__ctxLog.push({ inGestureTask })
      }
    }
  })
})
const ctxLog = (page: Page) => page.evaluate(() => (window as unknown as { __ctxLog: { inGestureTask: boolean }[] }).__ctxLog)

test('a real mouse click on « Lecture » makes the context in the gesture and both speakers are heard (no autoplay flag)', async ({ page }) => {
  await boot(page)
  await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Lecture', exact: true }).click()
  await page.waitForFunction(() => window.__creation!.audioState().state === 'playing', null, { timeout: 15_000 })
  await waitHeard(page)
  expect((await page.evaluate(() => window.__creation!.audioStats())).contexts).toEqual({ opened: 1, closed: 0 }) // ONE context, the click's
  expect(await ctxLog(page)).toEqual([{ inGestureTask: true }]) // constructed in the click's task, before the chunk was awaited
  const peaks = await page.evaluate(() => window.__creation!.audioPeaks())
  expect(peaks.output).toBeGreaterThan(0)
  await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Stop', exact: true }).click()
  await page.waitForFunction(() => window.__creation!.audioState().state === 'stopped')
})

test('the keyboard (Entrée on the menu item) is a gesture too', async ({ page }) => {
  await boot(page)
  await page.getByRole('menuitem', { name: 'Écoute', exact: true }).focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Lecture', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => window.__creation!.audioState().state === 'playing', null, { timeout: 15_000 })
  await waitHeard(page)
  expect((await page.evaluate(() => window.__creation!.audioStats())).contexts.opened).toBe(1)
  expect(await ctxLog(page)).toEqual([{ inGestureTask: true }])
})

test('« Signal de test » and the file chooser also make their context in the click', async ({ page }) => {
  await boot(page)
  await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Signal de test', exact: true }).click()
  await page.waitForFunction(() => window.__creation!.audioState().state === 'playing', null, { timeout: 15_000 })
  await waitHeard(page)
  await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Stop', exact: true }).click()
  await page.waitForFunction(() => window.__creation!.audioState().state === 'stopped')
  await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('menuitem', { name: 'Choisir un fichier audio…', exact: true }).click()])
  // the context was made by the menu click and waits for the file: opened 2 (the test signal's, closed, and this one)
  expect((await page.evaluate(() => window.__creation!.audioStats())).contexts.opened).toBe(2)
  const n = 22050
  const b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n * 2, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(22050, 24)
  b.writeUInt32LE(44100, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / 22050) * 16000), 44 + i * 2)
  await chooser.setFiles({ name: 'tone.wav', mimeType: 'audio/wav', buffer: b })
  await page.waitForFunction(() => window.__creation!.audioState().sourceName === 'fichier tone.wav', null, { timeout: 15_000 })
  await page.waitForFunction(() => window.__creation!.audioState().state === 'stopped', null, { timeout: 15_000 }) // it lasts 1 s
  await page.waitForFunction(() => {
    const s = window.__creation!.audioStats()
    return s.contexts.opened === s.contexts.closed
  }, null, { timeout: 5000 })
  expect((await page.evaluate(() => window.__creation!.audioStats())).contexts).toEqual({ opened: 2, closed: 2 })
  expect(await ctxLog(page)).toEqual([{ inGestureTask: true }, { inGestureTask: true }]) // the test signal's and the file chooser's, each in its own click
})
