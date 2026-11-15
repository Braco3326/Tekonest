/**
 * Mission 1, end to end on the PRODUCT build (spec 1 and 7): the plain address opens design 2, the goal screens replace the four profiles (screen 1: the five goals,
 * keys 1 to 5; screen 2: the goal's choices; screen 3 only when the chosen one has any), « Retour », « Passer », the picker shows the goal's rooms with « Tous les
 * lieux » always there, the empty state with its two buttons, and the chip « But : X · changer » reopens the screens. No assistant, no account UI, no console error;
 * an exam address keeps no package and no goal screen; `?design=1` keeps its profiles.
 * Mission 1 part C (decision): the product now offers the plain tutorial after the goal screens, and once the offer is answered the FIRST room opens (the empty neutral
 * room); the goal's filtered picker is then reached from Lieu › Choisir un lieu… (tests/e2e/onboarding-plain-tutorial.spec.ts has the tutorial itself).
 *
 * It runs against a build made WITHOUT the all-on table (like tests/e2e/product-build.spec.ts): `npx vite build --outDir dist-product`, served by
 * `npx vite preview --outDir dist-product --port 4393`, address in E2E_PRODUCT_URL. The labels are read from the tree file, never written here (the tree is a draft).
 */
import { expect, test, type Page } from '@playwright/test'
import treeJson from '../../content/onboarding/goal-tree.json'

const PRODUCT = process.env.E2E_PRODUCT_URL
test.skip(!PRODUCT, 'needs E2E_PRODUCT_URL: a preview of a build made without TP_TEST_FEATURES (npx vite build --outDir dist-product)')
test.use({ baseURL: PRODUCT, viewport: { width: 1366, height: 768 } })
test.describe.configure({ timeout: 90_000 })

interface Node { id: string; label: string; rooms: string[]; children: Node[] }
const tree = treeJson as unknown as { goals: Node[] }
const find = (id: string): Node => {
  let level = tree.goals
  let hit: Node | undefined
  const parts = id.split('.')
  for (let i = 0; i < parts.length; i++) {
    hit = level.find((n) => n.id === parts.slice(0, i + 1).join('.'))!
    level = hit.children
  }
  return hit!
}
const KEY = 'audio-sim/creation-onboarding.v1'
/** A goal with a level-2 choice that has level-3 choices, and one of those with rooms of its own. */
const GOAL = tree.goals.find((g) => g.children.some((c) => c.children.length > 0))!
const SUB = GOAL.children.find((c) => c.children.length > 0)!
const LEAF = SUB.children.find((c) => c.rooms.length > 0)!
/** A level-2 choice with no children: screen 3 is skipped. */
const END2 = tree.goals.flatMap((g) => g.children).find((c) => c.children.length === 0 && c.rooms.length > 0)!
/** A node with rooms of its own, none of them the place of a template (the type filter does not hide templates, so the empty state needs none). */
const NO_TEMPLATE = tree.goals.flatMap((g) => g.children.flatMap((c) => [c, ...c.children])).find((n) => n.rooms.length > 0 && !n.rooms.includes('concert-hall-medium'))!

const goalScreen = (page: Page) => page.getByTestId('goal-screen')
const goalButton = (page: Page, label: string) => goalScreen(page).getByRole('button', { name: label, exact: true })
const heading = (page: Page) => page.getByTestId('start-screen').getByRole('heading', { level: 2 })
const record = async (page: Page) => JSON.parse((await page.evaluate((k) => window.localStorage.getItem(k), KEY)) ?? 'null')
const shownPlaces = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="place-grid"] [role=option]')].filter((e) => !e.hidden).map((e) => e.dataset.place))
const shownTemplates = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="template-grid"] [role=option]')].filter((e) => !e.hidden && !e.closest('[hidden]')).map((e) => e.dataset.place))

function errorsOf(page: Page): () => string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return () => errors
}

/** The offer that follows the goal screens: « Passer, je connais »; the first room (the empty neutral room) opens. */
async function skipOffer(page: Page): Promise<void> {
  await expect(page.getByTestId('start-screen').getByRole('heading', { level: 2 })).toHaveText('Un tutoriel pour votre premier son ?')
  await page.getByTestId('start-screen').getByRole('button', { name: 'Passer, je connais', exact: true }).click()
  await page.waitForFunction(() => (window as unknown as { __creation: { place(): string } }).__creation.place() === 'blank')
}
/** Lieu › Choisir un lieu…: the place picker over the open room. */
async function openPicker(page: Page): Promise<void> {
  await page.getByRole('menuitem', { name: 'Lieu', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Choisir un lieu…' }).click()
  await expect(page.getByTestId('place-grid')).toBeVisible()
}

async function openFresh(page: Page, query = '', seed?: unknown): Promise<void> {
  await page.goto('/' + query)
  await page.evaluate(([k, v]) => {
    window.localStorage.clear()
    if (v) window.localStorage.setItem(k as string, v as string)
  }, [KEY, seed === undefined ? null : JSON.stringify(seed)])
  await page.reload()
  await page.waitForFunction(() => !!(window as unknown as { __creation?: unknown }).__creation)
  await expect(page.getByTestId('place-picker')).toBeVisible()
}

test('the plain address opens design 2 and asks the five goals (keys 1 to 5), with « Passer » and « Tous les lieux »; no assistant, no account, no error', async ({ page }) => {
  const errors = errorsOf(page)
  await openFresh(page)
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-design'))).toBe('2')
  await expect(goalScreen(page)).toBeVisible()
  await expect(heading(page)).toHaveText('Bienvenue : que voulez-vous faire ?')
  for (const g of tree.goals) await expect(goalButton(page, g.label)).toBeVisible()
  await expect(goalScreen(page).locator('button[data-goal]')).toHaveCount(5)
  await expect(goalButton(page, tree.goals[0]!.label)).toBeFocused()
  await expect(goalScreen(page).getByRole('button', { name: 'Passer', exact: true })).toBeVisible()
  await expect(goalScreen(page).getByRole('button', { name: 'Tous les lieux', exact: true })).toBeVisible()
  await expect(goalScreen(page).getByRole('button', { name: 'Retour', exact: true })).toBeHidden()
  // the four profiles are not asked
  await expect(page.getByRole('button', { name: 'Je travaille dans le son', exact: true }).and(page.locator('[data-profile]'))).toHaveCount(0)
  await page.waitForTimeout(1500)
  const text = await page.evaluate(() => document.body.innerText)
  expect(text).not.toMatch(/Oscar/)
  expect(text).not.toMatch(/Enregistrez votre travail|Créer un compte|Se connecter/)
  expect(errors()).toEqual([])
})

test('keys and clicks through the three screens; « Retour » and Échap go back with the focus on the earlier choice; the picker then shows the rooms of the goal', async ({ page }) => {
  const errors = errorsOf(page)
  await openFresh(page)
  await expect(goalButton(page, tree.goals[0]!.label)).toBeFocused()
  await page.keyboard.press(String(tree.goals.indexOf(GOAL) + 1))
  await expect(heading(page)).toHaveText('Lequel vous correspond le mieux ?')
  await expect(goalScreen(page)).toContainText(`Votre choix : ${GOAL.label}`)
  await expect(goalButton(page, GOAL.children[0]!.label)).toBeFocused()
  await goalButton(page, SUB.label).click()
  await expect(heading(page)).toHaveText('Et dans ce domaine, lequel ?')
  await expect(goalScreen(page)).toContainText(`${GOAL.label} › ${SUB.label}`)
  // Échap = « Retour »: the focus comes back to the choice made there
  await page.keyboard.press('Escape')
  await expect(heading(page)).toHaveText('Lequel vous correspond le mieux ?')
  await expect(goalButton(page, SUB.label)).toBeFocused()
  await goalScreen(page).getByRole('button', { name: 'Retour', exact: true }).click()
  await expect(heading(page)).toHaveText('Bienvenue : que voulez-vous faire ?')
  await expect(goalButton(page, GOAL.label)).toBeFocused()
  // again, to the end
  await page.keyboard.press(String(tree.goals.indexOf(GOAL) + 1))
  await page.keyboard.press(String(GOAL.children.indexOf(SUB) + 1))
  await goalButton(page, LEAF.label).click()
  // the plain tutorial's offer, then the first room; the picker (Lieu) shows the rooms of the goal
  await expect(page.getByTestId('goal-screen')).toBeHidden()
  await skipOffer(page)
  expect(await record(page)).toMatchObject({ goal: { id: LEAF.id }, offer: 'skipped' })
  await openPicker(page)
  await expect(page.getByTestId('goal-filter-note')).toHaveText(`Lieux pour votre but : ${LEAF.label}`)
  expect((await shownPlaces(page)).sort()).toEqual(LEAF.rooms.map((r) => `room:${r}`).sort())
  for (const t of await shownTemplates(page)) expect(t).toMatch(/^template:/)
  // « Tous les lieux » is always there: every place, then back to the goal's
  const toggle = page.getByTestId('goal-filter-toggle')
  await expect(toggle).toHaveText('Tous les lieux')
  await toggle.click()
  expect((await shownPlaces(page)).length).toBeGreaterThan(LEAF.rooms.length)
  await expect(toggle).toHaveText('Lieux de votre but')
  await toggle.click()
  expect((await shownPlaces(page)).sort()).toEqual(LEAF.rooms.map((r) => `room:${r}`).sort())
  expect(errors()).toEqual([])
})

test('a level-2 choice with no sub-choices ends the way on screen 2; the record keeps its id and the profile of its goal', async ({ page }) => {
  await openFresh(page)
  const goal = tree.goals.find((g) => g.children.includes(END2))!
  await goalButton(page, goal.label).click()
  await goalButton(page, END2.label).click()
  await expect(goalScreen(page)).toBeHidden()
  await skipOffer(page)
  await openPicker(page)
  expect((await shownPlaces(page)).sort()).toEqual(END2.rooms.map((r) => `room:${r}`).sort())
  const r = await record(page)
  expect(r.goal).toEqual({ id: END2.id })
  expect(r.profile).toBe({ etudie: 'etudie', travaille: 'metier', reconversion: 'projet', passion: 'projet', decouvre: 'decouvre' }[goal.id])
})

test('« Passer »: no goal, every place, the chip says « Choisir un but », and nothing asks again on the next visit', async ({ page }) => {
  await openFresh(page)
  await goalScreen(page).getByRole('button', { name: 'Passer', exact: true }).click()
  await expect(goalScreen(page)).toBeHidden()
  await skipOffer(page)
  await openPicker(page)
  await expect(page.getByTestId('goal-filter-note')).toBeHidden()
  expect((await shownPlaces(page)).length).toBe(await page.locator('[data-testid="place-grid"] [role=option]').count())
  expect(await record(page)).toMatchObject({ goal: null, profile: null })
  await page.reload()
  await page.waitForFunction(() => !!(window as unknown as { __creation?: unknown }).__creation)
  await page.waitForTimeout(1000)
  await expect(goalScreen(page)).toBeHidden()
  await expect(page.getByText('Un tutoriel pour votre premier son ?')).toHaveCount(0)
  // the room comes back from the autosave, or the picker shows: either way nothing asks again
  if (await page.getByTestId('place-grid').isVisible()) await page.locator('[data-testid="place-grid"] [role=option]').first().click()
  await expect(page.getByTestId('profile-chip')).toHaveText('Choisir un but')
})

test('the chip « But : X · changer » once a room is open, and it reopens the goal screens', async ({ page }) => {
  // a record whose offer was answered (an unanswered one gets the offer first, as for a profile)
  await openFresh(page, '', { v: 1, profile: 'metier', offer: 'skipped', request: 0, shown: [], goal: { id: LEAF.id } })
  expect((await shownPlaces(page)).sort()).toEqual(LEAF.rooms.map((r) => `room:${r}`).sort())
  await page.locator('[data-testid="place-grid"] [role=option]:not([hidden])').first().click()
  const chip = page.getByTestId('profile-chip')
  await expect(chip).toHaveText(`But : ${find(LEAF.id).label} · changer`)
  await chip.click()
  await expect(goalScreen(page)).toBeVisible()
  await expect(heading(page)).toHaveText('Bienvenue : que voulez-vous faire ?')
  await expect(goalButton(page, tree.goals[0]!.label)).toBeFocused()
})

test('the empty state: no room of the goal for the chosen type says so, with « Voir tous les lieux » and « Changer de but »', async ({ page }) => {
  await openFresh(page, '', { v: 1, profile: 'metier', offer: 'skipped', request: 0, shown: [], goal: { id: NO_TEMPLATE.id } })
  // a type none of the goal's rooms has
  const type = await page.evaluate(() => {
    const shown = new Set([...document.querySelectorAll<HTMLElement>('[data-testid="place-grid"] [role=option]')].filter((e) => !e.hidden).map((e) => e.querySelector('.cr-card-type')?.textContent))
    return [...document.querySelectorAll<HTMLOptionElement>('[data-testid="place-filter"] option')].map((o) => o.value).find((v) => v !== '' && !shown.has(v))!
  })
  await page.getByTestId('place-filter').selectOption(type)
  const empty = page.getByTestId('goal-empty')
  await expect(empty).toBeVisible()
  await expect(empty).toContainText('Aucun lieu pour ce but pour l’instant')
  await empty.getByRole('button', { name: 'Voir tous les lieux', exact: true }).click()
  await expect(empty).toBeHidden()
  expect((await shownPlaces(page)).length).toBeGreaterThan(0)
  // back to the goal's rooms, same type: empty again, then « Changer de but »
  await page.getByTestId('goal-filter-toggle').click()
  await expect(empty).toBeVisible()
  await empty.getByRole('button', { name: 'Changer de but', exact: true }).click()
  await expect(goalScreen(page)).toBeVisible()
})

test('an exam address keeps no package and no goal screen; ?design=1 keeps its four profiles', async ({ page }) => {
  await openFresh(page, '?mode=exam')
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-design'))).toBeNull()
  await expect(goalScreen(page)).toHaveCount(0)
  await openFresh(page, '?design=1')
  await expect(page.getByTestId('start-screen').getByRole('button', { name: 'Je découvre', exact: true })).toBeVisible()
  await expect(goalScreen(page)).toHaveCount(0)
})
