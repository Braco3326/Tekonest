/**
 * The start screen of the first visit (onboarding packs, plan T2.3, spec 4): a stage of the place picker, only under `?design=1..5`.
 * Driven on `/?design=1` with an empty storage (a fresh Playwright context is one). Without `?design` the picker is today's, unchanged.
 *
 * What is pinned here: four equal profile buttons + « Tous les lieux »; keys 1 to 4; the offer (two equal buttons, « conseillé », « étapes, à votre
 * rythme », no duration); the focus per profile; Échap on each stage (red before T2.3: the picker's Échap is gated on `closable`, which is false on a
 * first visit); the covered panels inert while the screen is open and not inert after « Tous les lieux » + a card; the stored record; blocked storage;
 * three viewports; axe; Oscar's icon never rests on the buttons.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { quietWindow } from './waits'

const KEY = 'audio-sim/creation-onboarding.v1'
const PROFILES = [
  { key: '1', label: 'Je découvre', id: 'decouvre', focus: 'tutorial' },
  { key: '2', label: 'J’étudie le son', id: 'etudie', focus: 'skip' },
  { key: '3', label: 'Je monte un projet', id: 'projet', focus: 'tutorial' },
  { key: '4', label: 'Je travaille dans le son', id: 'metier', focus: 'skip' },
] as const

const start = (page: Page) => page.getByTestId('start-screen')
const profileButton = (page: Page, label: string) => start(page).getByRole('button', { name: label, exact: true })
const tutorialButton = (page: Page) => start(page).getByRole('button', { name: /^Faire le tutoriel/ })
const skipButton = (page: Page) => start(page).getByRole('button', { name: 'Passer, je connais', exact: true })
const allPlaces = (page: Page) => start(page).getByRole('button', { name: 'Tous les lieux', exact: true })
const record = (page: Page) => page.evaluate((k) => window.localStorage.getItem(k), KEY)

/** Open the game with a clean slate (storage emptied, then reloaded), under a design package. */
async function openFresh(page: Page, query = '?design=1'): Promise<void> {
  await page.goto('/' + query)
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await expect(page.getByTestId('place-picker')).toBeVisible()
}

type Box = { x: number; y: number; width: number; height: number }
async function boxes(page: Page, names: (string | RegExp)[]): Promise<Box[]> {
  const out: Box[] = []
  for (const n of names) out.push((await start(page).getByRole('button', { name: n }).boundingBox())!)
  return out
}
const equalSize = (bs: Box[]): void => {
  for (const b of bs) {
    expect(Math.abs(b.width - bs[0].width), 'width within 1 px').toBeLessThanOrEqual(1)
    expect(Math.abs(b.height - bs[0].height), 'height within 1 px').toBeLessThanOrEqual(1)
  }
}
const inertCovers = (page: Page): Promise<boolean[]> =>
  page.evaluate(() => ['project-tree', 'viewport', 'properties'].map((id) => !!document.querySelector(`[data-testid="${id}"]`)!.closest('[inert]')))

test.use({ viewport: { width: 1366, height: 768 } })

test('profile stage: a title, the reassurance line, four equal buttons by situation, « Tous les lieux »; the place grids are not shown', async ({ page }) => {
  await openFresh(page)
  await expect(start(page)).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Bienvenue : quelle est votre situation ?' })).toBeVisible()
  await expect(start(page)).toContainText('Vous pourrez changer de profil à tout moment.')
  for (const p of PROFILES) await expect(profileButton(page, p.label)).toBeVisible()
  await expect(allPlaces(page)).toBeVisible()
  equalSize(await boxes(page, PROFILES.map((p) => p.label)))
  // the grids and the head of the picker are behind the start stage, not beside it
  await expect(page.getByTestId('place-grid')).toBeHidden()
  await expect(page.getByTestId('template-grid')).toBeHidden()
  await expect(page.getByTestId('place-picker-close')).toBeHidden()
  // the section is named by the start title while the stage shows
  expect(await page.getByTestId('place-picker').getAttribute('aria-labelledby')).toBe(await page.getByRole('heading', { level: 2, name: /situation/ }).getAttribute('id'))
  // nothing is asked of storage yet: no record until an answer
  expect(await record(page)).toBeNull()
  expect(await page.evaluate(() => window.__creation!.place())).toBeNull()
})

test('the focus starts on the first profile button; Tab reaches the four buttons then « Tous les lieux »; Enter takes the focused one', async ({ page }) => {
  await openFresh(page)
  await expect(profileButton(page, PROFILES[0].label)).toBeFocused()
  for (const p of PROFILES.slice(1)) {
    await page.keyboard.press('Tab')
    await expect(profileButton(page, p.label)).toBeFocused()
  }
  await page.keyboard.press('Tab')
  await expect(allPlaces(page)).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(profileButton(page, PROFILES[0].label)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(tutorialButton(page)).toBeVisible() // the offer
})

for (const p of PROFILES) {
  test(`key ${p.key} chooses « ${p.label} »: the offer shows two equal buttons, the focus is on ${p.focus === 'tutorial' ? '« Faire le tutoriel »' : '« Passer, je connais »'}`, async ({ page }) => {
    await openFresh(page)
    await page.keyboard.press(p.key)
    await expect(tutorialButton(page)).toBeVisible()
    await expect(skipButton(page)).toBeVisible()
    // the offer replaces the profile buttons on the same screen; the profile is named
    await expect(profileButton(page, p.label)).toBeHidden()
    await expect(start(page)).toContainText(p.label)
    await expect(p.focus === 'tutorial' ? tutorialButton(page) : skipButton(page)).toBeFocused()
    equalSize(await boxes(page, [/^Faire le tutoriel/, 'Passer, je connais']))
    // the wording: advised, steps at the learner's pace, no duration anywhere
    const text = (await start(page).innerText()).replace(/\s+/g, ' ')
    expect(text).toMatch(/Faire le tutoriel \(conseillé · \d+ étapes, à votre rythme\)/)
    expect(text).not.toMatch(/\d\s*(?:s|sec|mn|min|minutes?)\b|minute/i)
    // the choice is stored at once (a reload then shows today's picker, the learner was asked)
    expect(JSON.parse((await record(page))!)).toMatchObject({ v: 1, profile: p.id, offer: null, request: 0 })
    // the covered panels stay inert on the offer stage too
    expect(await inertCovers(page)).toEqual([true, true, true])
  })
}

test('clicking a profile button does the same as its key', async ({ page }) => {
  await openFresh(page)
  await profileButton(page, 'J’étudie le son').click()
  await expect(skipButton(page)).toBeFocused()
  expect(JSON.parse((await record(page))!).profile).toBe('etudie')
})

test('the skip link « Aller à la vue 3D » lands inside the start screen while it covers the page (the grids behind it are hidden)', async ({ page }) => {
  await openFresh(page)
  await page.getByTestId('skip-link').focus()
  await page.keyboard.press('Enter')
  await expect(profileButton(page, PROFILES[0].label)).toBeFocused()
  await page.keyboard.press('2')
  await page.getByTestId('skip-link').focus()
  await page.keyboard.press('Enter')
  await expect(skipButton(page)).toBeFocused() // the offer stage: the button its profile names
})

test('« Faire le tutoriel »: the neutral room opens, the offer is stored as taken, the request goes to 1, the start screen is gone', async ({ page }) => {
  await openFresh(page)
  await page.keyboard.press('1')
  await tutorialButton(page).click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await expect(page.getByTestId('place-picker')).toBeHidden()
  await expect(page.locator('#renderCanvas')).toBeFocused()
  expect(JSON.parse((await record(page))!)).toMatchObject({ profile: 'decouvre', offer: 'taken', request: 1 })
  expect(await inertCovers(page)).toEqual([false, false, false])
})

test('« Passer, je connais »: the neutral room opens, the offer is stored as skipped, no tutorial is requested', async ({ page }) => {
  await openFresh(page)
  await page.keyboard.press('2')
  await skipButton(page).click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await expect(page.getByTestId('place-picker')).toBeHidden()
  expect(JSON.parse((await record(page))!)).toMatchObject({ profile: 'etudie', offer: 'skipped', request: 0 })
})

test('Échap on the profile stage = « Tous les lieux »: the place grids show, the picker stays open (nothing to go back to), the record says no profile', async ({ page }) => {
  await openFresh(page)
  await page.keyboard.press('Escape')
  await expect(start(page)).toBeHidden()
  await expect(page.getByTestId('place-picker')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Choisir un lieu' })).toBeVisible()
  await expect(page.getByTestId('place-grid').getByRole('option')).toHaveCount(36)
  await expect(page.getByTestId('place-picker-close')).toBeHidden() // not closable: no place is on screen
  await expect(page.getByTestId('place-grid').locator('[aria-selected="true"]')).toBeFocused()
  expect(JSON.parse((await record(page))!)).toMatchObject({ profile: null, offer: null })
  expect(await page.evaluate(() => window.__creation!.place())).toBeNull()
  // and Échap in the grids does nothing more (the picker is still the start screen of the project)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('place-picker')).toBeVisible()
})

test('Échap on the offer stage = « Passer, je connais »', async ({ page }) => {
  await openFresh(page)
  await page.keyboard.press('3')
  await expect(tutorialButton(page)).toBeFocused()
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await expect(page.getByTestId('place-picker')).toBeHidden()
  expect(JSON.parse((await record(page))!)).toMatchObject({ profile: 'projet', offer: 'skipped', request: 0 })
})

test('« Tous les lieux » by click, then a card: the grids work as today, the covered panels are inert until the card opens, then free', async ({ page }) => {
  await openFresh(page)
  expect(await inertCovers(page)).toEqual([true, true, true])
  await allPlaces(page).click()
  await expect(page.getByTestId('place-grid')).toBeVisible()
  expect(await inertCovers(page)).toEqual([true, true, true]) // still one owner, still inert
  await page.locator('[data-place="set:plateau"]').click()
  await page.waitForFunction(() => window.__creation!.place() === 'set:plateau')
  await expect(page.getByTestId('place-picker')).toBeHidden()
  expect(await inertCovers(page)).toEqual([false, false, false])
  await expect(page.locator('#renderCanvas')).toBeFocused()
})

test('the start panel is inert while the « Salle vide / Avec le matériel » dialog is open, and the dialog still works', async ({ page }) => {
  await openFresh(page)
  await allPlaces(page).click()
  await page.locator('[data-place="room:radio-talk-studio-medium"]').click()
  await expect(page.getByTestId('place-mode-dialog')).toBeVisible()
  expect(await page.evaluate(() => (document.querySelector('[data-testid="start-screen"]') as HTMLElement).inert)).toBe(true)
  expect(await page.evaluate(() => (document.querySelector('.cr-pick-head') as HTMLElement).inert)).toBe(true)
  await page.keyboard.press('Escape') // closes the dialog only
  await expect(page.getByTestId('place-mode-dialog')).toBeHidden()
  expect(await page.evaluate(() => (document.querySelector('[data-testid="start-screen"]') as HTMLElement).inert)).toBe(false)
  await expect(page.getByTestId('place-picker')).toBeVisible()
})

test('answered once, no autosave: the next visit shows today\'s picker, not the start screen (skip never re-nags)', async ({ page }) => {
  // Only the record decides here, so no room is ever opened (a room open at reload time is kept by the autosave's flush).
  await openFresh(page)
  await page.keyboard.press('2') // a profile chosen, the offer not answered yet: the record is written at once
  expect(JSON.parse((await record(page))!)).toMatchObject({ profile: 'etudie', offer: null })
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await expect(page.getByRole('heading', { name: 'Choisir un lieu' })).toBeVisible()
  await expect(start(page)).toHaveCount(0)
  // the answered offers (what the skip and the tutorial write) are records too
  for (const offer of ['skipped', 'taken']) {
    await page.evaluate(([k, o]) => window.localStorage.setItem(k, JSON.stringify({ v: 1, profile: 'etudie', offer: o, request: o === 'taken' ? 1 : 0, shown: [] })), [KEY, offer])
    await page.reload()
    await page.waitForFunction(() => !!window.__creation)
    await expect(page.getByRole('heading', { name: 'Choisir un lieu' }), offer).toBeVisible()
    await expect(start(page), offer).toHaveCount(0)
  }
})

test('an autosave wins over everything: the reload reopens the room, no start screen, no picker', async ({ page }) => {
  await openFresh(page)
  await page.keyboard.press('2')
  await skipButton(page).click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] }))
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('audio-sim/creation.v1') !== null)).toBe(true)
  await page.reload()
  await page.waitForFunction(() => !!window.__creation && window.__creation.place() === 'blank')
  await expect(page.getByTestId('place-picker')).toBeHidden()
  await expect(start(page)).toHaveCount(0)
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(1)
})

test('a corrupt record is replaced: the start screen shows, and the next answer writes a valid record', async ({ page }) => {
  await page.goto('/?design=1')
  await page.evaluate((k) => window.localStorage.setItem(k, '{"v":1,"profile":"expert"'), KEY)
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await expect(start(page)).toBeVisible()
  await page.keyboard.press('4')
  expect(JSON.parse((await record(page))!)).toMatchObject({ v: 1, profile: 'metier', offer: null, request: 0, shown: [] })
})

test('blocked storage: the start screen shows and works in memory (0 page errors); nothing is stored', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked')
      },
    }),
  )
  await page.goto('/?design=1')
  await page.waitForFunction(() => !!window.__creation)
  await expect(start(page)).toBeVisible()
  await page.keyboard.press('1')
  await expect(tutorialButton(page)).toBeFocused()
  await tutorialButton(page).click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await quietWindow(page, 600) // nothing may throw after the room opens (the autosave is off, the record is in memory)
  expect(errors).toEqual([])
})

test('no ?design: today\'s picker, no start screen in the page at all', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await expect(page.getByRole('heading', { name: 'Choisir un lieu' })).toBeVisible()
  await expect(page.getByTestId('place-grid').getByRole('option')).toHaveCount(36)
  await expect(page.getByText('Tous les lieux', { exact: true })).toHaveCount(0)
  await expect(page.getByTestId('start-screen')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-design'))).toBe(false)
  await page.keyboard.press('Escape') // not closable: nothing happens
  await expect(page.getByTestId('place-picker')).toBeVisible()
  expect(await page.evaluate(() => window.localStorage.getItem('audio-sim/creation-onboarding.v1'))).toBeNull()
})

test('no start screen on a legacy address or with ?design out of range', async ({ page }) => {
  for (const q of ['?design=0', '?design=6', '?design=1&design=2']) {
    await openFresh(page, q)
    await expect(page.getByRole('heading', { name: 'Choisir un lieu' }), q).toBeVisible()
    await expect(start(page), q).toHaveCount(0)
  }
})

for (const size of [
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 820, height: 1180 },
]) {
  test(`${size.width} x ${size.height}: both stages fit the screen, targets are large, buttons are equal, axe has no serious finding`, async ({ page }) => {
    await page.setViewportSize(size)
    await openFresh(page)
    const inView = async (names: string[]): Promise<void> => {
      for (const n of names) {
        const b = (await start(page).getByRole('button', { name: n }).boundingBox())!
        expect(b.x, n).toBeGreaterThanOrEqual(0)
        expect(b.y, n).toBeGreaterThanOrEqual(0)
        expect(b.x + b.width, n).toBeLessThanOrEqual(size.width)
        expect(b.y + b.height, n).toBeLessThanOrEqual(size.height)
        // the four profiles and the two answers are large targets; « Tous les lieux » keeps the shell's own button size
        expect(b.height, `${n} is a large target`).toBeGreaterThanOrEqual(n === 'Tous les lieux' ? 32 : 64)
      }
    }
    await inView([...PROFILES.map((p) => p.label), 'Tous les lieux'])
    equalSize(await boxes(page, PROFILES.map((p) => p.label)))
    const noScroll = await page.evaluate(() => {
      const s = document.querySelector('[data-testid="start-screen"]') as HTMLElement
      return s.scrollWidth <= s.clientWidth + 1
    })
    expect(noScroll).toBe(true)
    let axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'), 'profile stage').toEqual([])
    await page.keyboard.press('1')
    await expect(tutorialButton(page)).toBeVisible()
    await inView(['Passer, je connais', 'Faire le tutoriel (conseillé · 10 étapes, à votre rythme)'])
    equalSize(await boxes(page, [/^Faire le tutoriel/, 'Passer, je connais']))
    axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'), 'offer stage').toEqual([])
  })
}

test('Oscar\'s icon never rests on the start buttons (profile and offer stages, three viewports)', async ({ page }) => {
  for (const size of [
    { width: 1366, height: 768 },
    { width: 1024, height: 768 },
    { width: 820, height: 1180 },
  ]) {
    await page.setViewportSize(size)
    await openFresh(page)
    const icon = page.getByRole('button', { name: 'Oscar, assistant IA' })
    await expect(icon).toBeVisible()
    const clear = async (stage: string): Promise<void> => {
      await quietWindow(page, 900) // the guide re-reads the page's controls at most every 250 ms, then glides: the resting place, not a frame in flight
      const i = (await icon.boundingBox())!
      for (const b of await start(page).getByRole('button').all()) {
        const r = (await b.boundingBox())!
        const w = Math.min(i.x + i.width, r.x + r.width) - Math.max(i.x, r.x)
        const h = Math.min(i.y + i.height, r.y + r.height) - Math.max(i.y, r.y)
        expect(w > 0 && h > 0, `${size.width}x${size.height} ${stage}: icon on « ${await b.innerText()} »`).toBe(false)
      }
    }
    await clear('profile stage')
    await page.keyboard.press('2')
    await expect(skipButton(page)).toBeVisible()
    await clear('offer stage')
  }
})
