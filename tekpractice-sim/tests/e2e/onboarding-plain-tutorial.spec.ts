/**
 * Mission 1, the plain tutorial « Premiers pas » end to end on the PRODUCT build (spec 4 and 7). `?design=2` opens design 2, the goal screens, then the offer
 * (« Faire le tutoriel », four steps); the answer lands in the first room (the empty neutral room) with the coach card in the reserved tutorial row, and the four steps
 * are completed with the REAL interface only (the inventory drawer, a drop in the 3D view, the Projet tree, « Connecter à… », the power helper of the checklist, the
 * « Lecture console » control and Écoute › Signal de test): no debug-hook intent. No assistant node, no account UI, no console error, no request to an accounts host and no
 * accounts chunk; an exam address shows none of it. Founder’s order 2026-11-16 (classic look): the product has no default package any more, so the tutorial is
 * dormant on a plain address and every test below asks for design 2 by its address.
 *
 * Named onboarding-plain-tutorial (tests/e2e/onboarding-tutorial.spec.ts is the guide's own tutorial on the all-on build). Runs against a build made WITHOUT the all-on
 * table, like tests/e2e/onboarding-goals.spec.ts: `npx vite build --outDir dist-product`, `npx vite preview --outDir dist-product --port 4393`, E2E_PRODUCT_URL.
 */
import { expect, test, type Page } from '@playwright/test'
import treeJson from '../../content/onboarding/goal-tree.json'

const PRODUCT = process.env.E2E_PRODUCT_URL
test.skip(!PRODUCT, 'needs E2E_PRODUCT_URL: a preview of a build made without TP_TEST_FEATURES (npx vite build --outDir dist-product)')
test.use({ baseURL: PRODUCT, viewport: { width: 1366, height: 768 } })
test.describe.configure({ timeout: 120_000 })

interface Node { id: string; label: string; rooms: string[]; children: Node[] }
const tree = treeJson as unknown as { goals: Node[] }
/** A level-2 choice with no sub-choices: the goal screens end on screen 2. */
const END2 = tree.goals.flatMap((g) => g.children).find((c) => c.children.length === 0 && c.rooms.length > 0)!
const GOAL = tree.goals.find((g) => g.children.includes(END2))!
const KEY = 'audio-sim/creation-onboarding.v1'

const card = (page: Page) => page.getByTestId('plain-tutorial')
const count = (page: Page) => page.getByTestId('plain-tutorial-count')
const record = async (page: Page) => JSON.parse((await page.evaluate((k) => window.localStorage.getItem(k), KEY)) ?? 'null')
const design = (page: Page) => page.evaluate(() => (window as unknown as { __creation: { design(): { rig: { instances: { instanceId: string; deviceId: string }[] } } } }).__creation.design())
const assistantNodes = (page: Page): Promise<number> => page.locator('.oscar-icon, [data-oscar-root], .oscar-guide, .oscar-live, .oscar-bubble').count()

function watch(page: Page): { errors: () => string[]; requests: () => string[] } {
  const errors: string[] = []
  const requests: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('request', (r) => requests.push(r.url()))
  return { errors: () => errors, requests: () => requests }
}
/** Nothing of the accounts: no request to a Supabase host, no accounts chunk, no account words on the page. */
async function noAccounts(page: Page, requests: string[]): Promise<void> {
  expect(requests.filter((u) => /supabase/i.test(u)), 'a request to an accounts host').toEqual([])
  expect(requests.filter((u) => /\/assets\/[^/]*(account|supabase)[^/]*\.js/i.test(u)), 'an accounts chunk was fetched').toEqual([])
  const text = await page.evaluate(() => document.body.innerText)
  expect(text).not.toMatch(/Enregistrez votre travail|Créer un compte|Se connecter|Mon compte/)
  expect(await page.evaluate(() => Object.keys(window.localStorage).filter((k) => /account|supabase|sb-/i.test(k)))).toEqual([])
}

async function openFresh(page: Page, query = '?design=2'): Promise<void> {
  await page.goto('/' + query)
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!(window as unknown as { __creation?: unknown }).__creation)
}

/** Matériel › Inventaire, the tab, the device's card, then a click on the floor of the 3D view (the device follows the pointer until it is dropped). */
async function placeFromDrawer(page: Page, tab: string, deviceId: string, at: [number, number]): Promise<void> {
  const before = (await design(page)).rig.instances.length
  // the goal's profile may have opened the drawer with the first room already: Inventaire toggles it, so it is asked only when the drawer is closed
  if (!(await page.getByTestId('inventory-drawer').isVisible())) {
    await page.getByRole('menuitem', { name: 'Matériel', exact: true }).click()
    await page.getByRole('menuitem', { name: /^Inventaire/ }).click()
  }
  await expect(page.getByTestId('inventory-drawer')).toBeVisible()
  await page.getByRole('tab', { name: tab, exact: true }).click()
  await page.locator(`[data-testid="inventory-item"][data-device-id="${deviceId}"]`).click()
  const view = (await page.getByTestId('viewport').boundingBox())!
  const x = view.x + view.width * at[0]
  const y = view.y + view.height * at[1]
  await page.mouse.move(x, y, { steps: 4 })
  await page.mouse.click(x, y)
  await expect.poll(async () => (await design(page)).rig.instances.length).toBe(before + 1)
}
const instanceOf = async (page: Page, deviceId: string): Promise<string> => (await design(page)).rig.instances.find((i) => i.deviceId === deviceId)!.instanceId

/** The Projet tree: « Matériel » opened, then the device's row (a click selects it; the Propriétés panel follows). */
async function selectInTree(page: Page, label: RegExp): Promise<void> {
  const tree = page.getByRole('tree', { name: 'Projet' })
  const item = tree.getByRole('treeitem', { name: label })
  if (!(await item.isVisible())) await tree.getByRole('treeitem', { name: /^Matériel/ }).click()
  await item.click()
}

test('?design=2: goal screens, « Faire le tutoriel », the first room with the card, four steps done with the real interface, then the sound; no assistant, no account, no error', async ({ page }) => {
  const seen = watch(page)
  await openFresh(page)
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-design'))).toBe('2')
  const goals = page.getByTestId('goal-screen')
  await goals.getByRole('button', { name: GOAL.label, exact: true }).click()
  await goals.getByRole('button', { name: END2.label, exact: true }).click()
  // the offer, with the plain tutorial's four steps
  const start = page.getByTestId('start-screen')
  await expect(start.getByRole('heading', { level: 2 })).toHaveText('Un tutoriel pour votre premier son ?')
  await expect(start).toContainText(`Votre but : ${END2.label}`)
  const take = start.getByRole('button', { name: 'Faire le tutoriel (conseillé · 4 étapes, à votre rythme)', exact: true })
  await expect(start.getByRole('button', { name: 'Passer, je connais', exact: true })).toBeVisible()
  await take.click()
  // decision: the first room (the empty neutral room), not the goal's filtered picker
  await page.waitForFunction(() => (window as unknown as { __creation: { place(): string } }).__creation.place() === 'blank')
  await expect(page.getByTestId('place-picker')).toBeHidden()
  await expect(card(page)).toBeVisible()
  await expect(count(page)).toHaveText('Étape 1 sur 4')
  await expect(page.getByTestId('plain-tutorial-text')).toContainText('Yamaha QL1')
  await expect(page.getByTestId('plain-tutorial-next')).toBeVisible()
  await expect(page.getByTestId('plain-tutorial-skip')).toHaveText('Passer le tutoriel')
  // said in the card's own polite region (the status line is « last write wins »: the drawer's « Prêt » lands on it right after)
  await expect(page.getByTestId('plain-tutorial-live')).toHaveAttribute('role', 'status')
  await expect(page.getByTestId('plain-tutorial-live')).toContainText('Tutoriel, étape 1 sur 4')
  // the card is in the reserved row, above the 3D view: it covers neither the view nor its cube
  const cardBox = (await card(page).boundingBox())!
  const view = (await page.getByTestId('viewport').boundingBox())!
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(view.y + 1)
  const cube = page.locator('[data-testid="view-cube"], .cr-cube').first()
  if (await cube.count()) {
    const c = (await cube.boundingBox())!
    expect(c.y >= cardBox.y + cardBox.height - 1 || c.y + c.height <= cardBox.y).toBe(true)
  }
  expect(await record(page)).toMatchObject({ goal: { id: END2.id }, offer: 'taken', plainTutorial: { step: 1, done: false } })

  // 1. the console
  await placeFromDrawer(page, 'Consoles', 'yamaha-ql1', [0.45, 0.62])
  await expect(count(page)).toHaveText('Étape 2 sur 4')
  // 2. a speaker
  await placeFromDrawer(page, 'Enceintes', 'qsc-k12-2', [0.25, 0.62])
  await expect(count(page)).toHaveText('Étape 3 sur 4')
  // 3. the cable: select the console, « Connecter à… » on a main output, the speaker's input
  const ql1 = await instanceOf(page, 'yamaha-ql1')
  await selectInTree(page, new RegExp(`^Yamaha QL1 \\(${ql1}\\)`))
  await page.getByRole('button', { name: 'Connecter à… (depuis out-main-l)' }).click()
  const dialog = page.getByRole('dialog', { name: 'Connecter à…' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('option', { name: /K12\.2.*in-line-a/ }).first().click()
  await expect(dialog).toBeHidden()
  await expect(count(page)).toHaveText('Étape 4 sur 4')
  // 4. the sound: a strip, the checklist's power helper, « Lecture console », Écoute › Signal de test
  await placeFromDrawer(page, 'Secteur', 'multiprise-secteur', [0.65, 0.62])
  await page.getByRole('button', { name: /Je branche pour vous/ }).first().click()
  await selectInTree(page, new RegExp(`^Yamaha QL1 \\(${ql1}\\)`))
  await page.getByTestId('properties').getByRole('button', { name: 'Lecture console' }).click()
  await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Signal de test', exact: true }).click()
  await expect(count(page)).toHaveText('Fin des étapes', { timeout: 20_000 })
  await expect(page.getByTestId('plain-tutorial-close')).toBeVisible()
  expect(await record(page)).toMatchObject({ plainTutorial: { step: 4, done: true } })
  await page.getByTestId('plain-tutorial-close').click()
  await expect(card(page)).toHaveCount(0)
  await expect(page.getByTestId('tutorial-slot')).toHaveCount(0)

  expect(await assistantNodes(page)).toBe(0)
  expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/Oscar/)
  await noAccounts(page, seen.requests())
  expect(seen.errors()).toEqual([])
})

test('« Passer » on the offer lands in the first room with no card; Aide › Premiers pas starts the card, « Passer le tutoriel » stops it, all by keyboard', async ({ page }) => {
  const seen = watch(page)
  await openFresh(page)
  await page.getByTestId('goal-screen').getByRole('button', { name: 'Passer', exact: true }).click()
  await page.getByTestId('start-screen').getByRole('button', { name: 'Passer, je connais', exact: true }).click()
  await page.waitForFunction(() => (window as unknown as { __creation: { place(): string } }).__creation.place() === 'blank')
  await expect(card(page)).toHaveCount(0)
  // Aide › Premiers pas (the guide's menu entry, shown for the plain tutorial)
  await page.getByRole('menuitem', { name: 'Aide', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Premiers pas', exact: true }).click()
  await expect(count(page)).toHaveText('Étape 1 sur 4')
  // « Étape suivante » by keyboard: the step is passed
  await page.getByTestId('plain-tutorial-next').focus()
  await page.keyboard.press('Enter')
  await expect(count(page)).toHaveText('Étape 2 sur 4')
  // Aide now offers « Reprendre à l’étape 2 », « Recommencer », « Passer le tutoriel »
  await page.getByRole('menuitem', { name: 'Aide', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Reprendre à l’étape 2', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByTestId('plain-tutorial-skip').focus()
  await page.keyboard.press('Space')
  await expect(card(page)).toHaveCount(0)
  await expect(page.locator('#renderCanvas')).toBeFocused()
  expect(await record(page)).toMatchObject({ plainTutorial: { step: 2, done: true } })
  // a reload does not bring it back
  await page.reload()
  await page.waitForFunction(() => !!(window as unknown as { __creation?: unknown }).__creation)
  await page.waitForTimeout(1500)
  await expect(card(page)).toHaveCount(0)
  expect(await assistantNodes(page)).toBe(0)
  await noAccounts(page, seen.requests())
  expect(seen.errors()).toEqual([])
})

test('an exam address shows none of it: no package, no goal screen, no offer, no card, no Premiers pas, no account UI', async ({ page }) => {
  const seen = watch(page)
  await openFresh(page, '?level=a1&mode=exam')
  await page.waitForTimeout(1500)
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-design'))).toBeNull()
  await expect(page.getByTestId('goal-screen')).toHaveCount(0)
  await expect(page.getByText('Un tutoriel pour votre premier son ?')).toHaveCount(0)
  // a room open: still no card
  await page.locator('[data-testid="place-grid"] [role=option]').first().click()
  await page.waitForTimeout(800)
  await expect(card(page)).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Aide', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Premiers pas' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  expect(await page.evaluate((k) => window.localStorage.getItem(k), KEY)).toBeNull()
  expect(await assistantNodes(page)).toBe(0)
  await noAccounts(page, seen.requests())
  expect(seen.errors()).toEqual([])
})

test('?oscar=0 keeps its meaning: the goal screens, no offer, no tutorial', async ({ page }) => {
  await openFresh(page, '?design=2&oscar=0')
  await page.getByTestId('goal-screen').getByRole('button', { name: 'Passer', exact: true }).click()
  await expect(page.getByText('Un tutoriel pour votre premier son ?')).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Aide', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Premiers pas' })).toHaveCount(0)
})
