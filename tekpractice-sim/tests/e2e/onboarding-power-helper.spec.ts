/**
 * The power helper « Je branche pour vous (dans le simulateur) » in the browser (onboarding packs, plan T3.3 and T3.4, spec 6.5). A button on the « Alimentation »
 * row of the checklist « Pourquoi je n’entends rien ? », under `?design` on a practice address only. The bench is set up through the page's own intents
 * (`window.__creation.dispatch`, the UI's history path); the helper itself is clicked in the real list, Ctrl+Z is the real key.
 *
 * Pinned: outside a tutorial run (here `?oscar=0`: the checklist and its button work without the guide) the button is enabled once a strip is placed and says
 * what it cables; one click cables the console and the speaker (nothing placed, nothing switched), the status line lists exactly what was added, one Ctrl+Z
 * removes both cables; nothing without a strip; nothing offered at project open (no cable added by itself, the list stays closed); in a tutorial run the button
 * is disabled with its reason; no button at all on an exam address or without `?design`.
 */
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1366, height: 768 } })

const start = (page: Page) => page.getByTestId('start-screen')
const helper = (page: Page) => page.getByTestId('checklist-power')
const note = (page: Page) => page.getByTestId('checklist-power-note')
const chip = (page: Page) => page.getByTestId('checklist-chip')
const statusMsg = (page: Page) => page.locator('.cr-status-msg')
const design = (page: Page) => page.evaluate(() => window.__creation!.design())
const mainsCables = async (page: Page) => (await design(page)).rig.connections.filter((c) => c.a.port === 'power-in' || c.b.port === 'power-in')

/** A clean slate under `query`, then profile « J’étudie le son » (key 2, once the start screen holds the focus) and, where the offer exists, « Passer, je connais ». */
async function openRoom(page: Page, query: string): Promise<void> {
  await page.goto('/' + query)
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await expect(start(page).getByRole('button', { name: 'Je découvre', exact: true })).toBeFocused()
  await page.keyboard.press('2')
  if (!query.includes('oscar=0')) await start(page).getByRole('button', { name: 'Passer, je connais', exact: true }).click()
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
}
const act = (page: Page, intents: unknown[]) =>
  page.evaluate((list) => {
    for (const i of list) {
      const r = window.__creation!.dispatch(i as never)
      if (!r.ok) throw new Error('refused: ' + JSON.stringify(i))
    }
  }, intents)
const spawn = (deviceId: string, instanceId: string, x: number) => ({ type: 'SPAWN', deviceId, instanceId, position: [x, 0, 0] })
const connect = (a: string, ap: string, b: string, bp: string) => ({ type: 'CONNECT', a: { instance: a, port: ap }, b: { instance: b, port: bp } })
const BENCH = [
  spawn('yamaha-ql1', 'ql1', 0),
  spawn('shure-sm58', 'sm58', 0.8),
  spawn('qsc-k12-2', 'k12', -1),
  connect('ql1', 'out-main-l', 'k12', 'in-line-a'),
  { type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true },
]
const STRIP = [spawn('multiprise-secteur', 'strip', 0.4)]
async function openList(page: Page): Promise<void> {
  await expect(chip(page)).toBeVisible()
  if ((await chip(page).getAttribute('aria-expanded')) !== 'true') await chip(page).click()
  await expect(page.getByTestId('checklist')).toBeVisible()
}

test('?design=1&oscar=0 (no tutorial run): no button without a strip; with one, enabled and saying what it cables; one click cables both, the status line lists them, one Ctrl+Z removes both', async ({ page }) => {
  await openRoom(page, '?design=1&oscar=0')
  await act(page, BENCH)
  await openList(page)
  await expect(page.getByTestId('checklist-row-power')).toBeVisible()
  await expect(helper(page), 'no strip: the helper never places one').toHaveCount(0)
  await page.keyboard.press('Escape')
  await act(page, STRIP)
  await openList(page)
  await expect(helper(page)).toBeEnabled()
  await expect(helper(page)).toHaveText('Je branche pour vous (dans le simulateur)')
  await expect(note(page)).toHaveText('Relie à la multiprise posée : Yamaha QL1 (ql1), QSC K12.2 (k12). Rien n’est posé ni réglé.')
  await expect(page.getByTestId('checklist')).toContainText('Seul « Je branche pour vous » ajoute des câbles secteur')
  const before = await design(page)
  await helper(page).click()
  // the helper's sentence lists exactly the two cables added; the app's own playback line of that ONE change may come first (« Lecture possible. »), never an
  // in-between state (before History.doAll the line read « Une enceinte reçoit le signal mais n’est pas alimentée. » between the two cables)
  await expect(statusMsg(page)).toHaveText(/(^|\. )Branché au courant : Yamaha QL1 \(ql1\), QSC K12\.2 \(k12\)\. Ctrl\+Z pour annuler\.$/)
  await expect(statusMsg(page)).not.toContainText('pas alimentée')
  const after = await design(page)
  expect(await mainsCables(page)).toEqual([
    { a: { instance: 'strip', port: 'out-1' }, b: { instance: 'ql1', port: 'power-in' } },
    { a: { instance: 'strip', port: 'out-2' }, b: { instance: 'k12', port: 'power-in' } },
  ])
  // nothing placed, nothing switched
  expect(after.rig.instances).toEqual(before.rig.instances)
  expect(after.rig.controls).toEqual(before.rig.controls)
  expect(after.rig.connections.length).toBe(before.rig.connections.length + 2)
  await expect(page.getByTestId('status-playback')).toContainText('Lecture possible')
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+z')
  await expect.poll(() => mainsCables(page)).toEqual([])
  expect((await design(page)).rig.connections).toEqual(before.rig.connections)
})

test('never offered at project open: a project with a strip opens with no cable added and the list closed', async ({ page }) => {
  await openRoom(page, '?design=1&oscar=0')
  await act(page, [...BENCH, ...STRIP])
  const saved = await design(page)
  await page.reload()
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
  await page.waitForTimeout(800) // a poll of the bridge and the lazy chunk have run
  expect((await design(page)).rig.connections).toEqual(saved.rig.connections)
  await expect(page.getByTestId('checklist')).toHaveCount(0)
  await expect(chip(page)).toHaveAttribute('aria-expanded', 'false')
})

test('in a tutorial run the button is disabled with its visible reason; a click does nothing', async ({ page }) => {
  await page.goto('/?design=1')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await start(page).getByRole('button', { name: 'Je découvre', exact: true }).click()
  await start(page).getByRole('button', { name: /^Faire le tutoriel/ }).click()
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
  await expect(page.locator('.oscar-live')).toContainText('étape 1 sur 10', { timeout: 10_000 })
  await act(page, [...BENCH, connect('sm58', 'out-xlr', 'ql1', 'in-mic-1'), ...STRIP])
  await expect(page.locator('.oscar-live')).toContainText('étape 8 sur 10', { timeout: 10_000 })
  await openList(page)
  await expect(helper(page)).toBeDisabled()
  await expect(note(page)).toHaveText('Essayez d’abord de relier vous-même ; je pourrai brancher pour vous ensuite.')
  await expect(helper(page)).toHaveAttribute('aria-describedby', 'cr-checklist-power-note')
  await helper(page).click({ force: true })
  expect(await mainsCables(page)).toEqual([])
})

for (const query of ['?design=1&mode=exam', '/']) {
  test(`no helper at all on ${query === '/' ? 'the default address (no ?design)' : 'an exam address'}`, async ({ page }) => {
    await page.goto(query === '/' ? '/' : '/' + query)
    await page.evaluate(() => window.localStorage.clear())
    await page.reload()
    await page.waitForFunction(() => !!window.__creation)
    await page.evaluate(() => window.__creation!.choosePlace('blank'))
    await page.waitForFunction(() => window.__creation?.place() === 'blank')
    await act(page, [...BENCH, ...STRIP])
    await openList(page)
    await expect(page.getByTestId('checklist-row-power')).toBeVisible()
    await expect(helper(page)).toHaveCount(0)
    await expect(page.getByTestId('checklist')).toContainText('Rien n’est modifié ici')
  })
}
