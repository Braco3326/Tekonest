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
/** The record is written WITH the answer and only once the room is open (ruling R-B): a read right after « the room is open » polls. */
const recordIs = (page: Page, match: Record<string, unknown>) => expect.poll(async () => JSON.parse((await record(page)) ?? 'null')).toMatchObject(match)

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
    // a profile chosen and the offer not answered writes NOTHING (ruling R-B): leaving mid-way asks again next time
    expect(await record(page)).toBeNull()
    // the covered panels stay inert on the offer stage too
    expect(await inertCovers(page)).toEqual([true, true, true])
  })
}

test('clicking a profile button does the same as its key', async ({ page }) => {
  await openFresh(page)
  await profileButton(page, 'J’étudie le son').click()
  await expect(skipButton(page)).toBeFocused()
  expect(await record(page)).toBeNull()
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
  await recordIs(page, { profile: 'decouvre', offer: 'taken', request: 1 })
  expect(await inertCovers(page)).toEqual([false, false, false])
})

test('« Passer, je connais »: the neutral room opens, the offer is stored as skipped, no tutorial is requested', async ({ page }) => {
  await openFresh(page)
  await page.keyboard.press('2')
  await skipButton(page).click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await expect(page.getByTestId('place-picker')).toBeHidden()
  await recordIs(page, { profile: 'etudie', offer: 'skipped', request: 0 })
})

test('Échap on the profile stage = « Tous les lieux »: the place grids show, the picker stays open (nothing to go back to), nothing is written', async ({ page }) => {
  await openFresh(page)
  await page.keyboard.press('Escape')
  await expect(start(page)).toBeHidden()
  await expect(page.getByTestId('place-picker')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Choisir un lieu' })).toBeVisible()
  await expect(page.getByTestId('place-grid').getByRole('option')).toHaveCount(36)
  await expect(page.getByTestId('place-picker-close')).toBeHidden() // not closable: no place is on screen
  await expect(page.getByTestId('place-grid').locator('[aria-selected="true"]')).toBeFocused()
  expect(await record(page)).toBeNull() // nothing answered, nothing written: the next normal visit asks again
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
  await recordIs(page, { profile: 'projet', offer: 'skipped', request: 0 })
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

test('leaving mid-way writes nothing and asks again; an answered offer is not asked again (skip never re-nags)', async ({ page }) => {
  // Only the record decides here, so no room is ever opened (a room open at reload time is kept by the autosave's flush).
  await openFresh(page)
  await page.keyboard.press('2') // a profile chosen, the offer not answered yet: nothing is written
  expect(await record(page)).toBeNull()
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await expect(start(page)).toBeVisible() // asked again (profile stage)
  await expect(profileButton(page, PROFILES[0].label)).toBeVisible()
  // the answered offers (what the skip and the tutorial write) are records: the picker, no start screen
  for (const offer of ['skipped', 'taken']) {
    await page.evaluate(([k, o]) => window.localStorage.setItem(k, JSON.stringify({ v: 1, profile: 'etudie', offer: o, request: o === 'taken' ? 1 : 0, shown: [] })), [KEY, offer])
    await page.reload()
    await page.waitForFunction(() => !!window.__creation)
    await expect(page.getByRole('heading', { name: 'Choisir un lieu' }), offer).toBeVisible()
    await expect(start(page), offer).toHaveCount(0)
  }
})

test('a profile chosen on ?oscar=0 (offer never made) gets the OFFER for that profile on the next address where the tutorial is allowed; where it is not, the picker', async ({ page }) => {
  await openFresh(page, '?design=1&oscar=0')
  await page.keyboard.press('3') // final on this address: the room opens, the profile is written, no offer
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await recordIs(page, { profile: 'projet', offer: null, request: 0 })
  // another visit with no project kept (the autosave is cleared, the record stays)
  await page.evaluate(() => window.localStorage.removeItem('audio-sim/creation.v1'))
  await page.goto('/?design=1&oscar=0')
  await page.evaluate(() => window.localStorage.removeItem('audio-sim/creation.v1'))
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await expect(page.getByRole('heading', { name: 'Choisir un lieu' }), 'still ?oscar=0: no offer, the picker').toBeVisible()
  await page.goto('/?design=1')
  await page.evaluate(() => window.localStorage.removeItem('audio-sim/creation.v1'))
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await expect(start(page)).toBeVisible()
  await expect(tutorialButton(page)).toBeVisible() // the offer stage, not the profile stage
  await expect(start(page)).toContainText('Je monte un projet') // for the stored profile
  await expect(tutorialButton(page)).toBeFocused() // projet: the focus is on the tutorial
  await expect(profileButton(page, PROFILES[0].label)).toBeHidden()
  await skipButton(page).click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await recordIs(page, { profile: 'projet', offer: 'skipped', request: 0 })
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
  await skipButton(page).click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await recordIs(page, { v: 1, profile: 'metier', offer: 'skipped', request: 0, shown: [] })
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

// ── T2.4a / T2.4b: the profile is applied to the neutral room; the chip; the offer only where the guide may run; the double answer.
const root = (page: Page) => page.getByTestId('creation-root')
const panels = (page: Page) => root(page).evaluate((r) => ({ tree: (r as HTMLElement).dataset.tree, props: (r as HTMLElement).dataset.props }))
const drawer = (page: Page) => page.getByTestId('inventory-drawer')
const chip = (page: Page) => page.getByTestId('profile-chip')
const onboarding = (page: Page) => page.evaluate(() => window.__creation!.onboarding())

test('profile 2 + « Passer, je connais »: the neutral room, both side panels open, the drawer open on Consoles, the focus left on the 3D view', async ({ page }) => {
  await openFresh(page)
  await page.keyboard.press('2')
  await skipButton(page).click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await expect(page.getByTestId('place-picker')).toBeHidden()
  await expect.poll(() => panels(page)).toEqual({ tree: 'open', props: 'open' })
  await expect(drawer(page)).toHaveAttribute('data-open', 'true')
  await expect(drawer(page).getByRole('tab', { name: 'Consoles' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#renderCanvas')).toBeFocused() // spec 4.3: after the offer the canvas has the focus
  expect(await inertCovers(page)).toEqual([false, false, false])
})

test('a profile that leaves the panels to the package takes the package layout: package 1 folds both, package 2 opens both (the drawer is on Consoles in both)', async ({ page }) => {
  for (const [query, want] of [
    ['?design=1', { tree: 'collapsed', props: 'collapsed' }],
    ['?design=2', { tree: 'open', props: 'open' }],
  ] as const) {
    await openFresh(page, query)
    await page.keyboard.press('1')
    await skipButton(page).click()
    await page.waitForFunction(() => window.__creation!.place() === 'blank')
    await expect.poll(() => panels(page), query).toEqual(want)
    await expect(drawer(page), query).toHaveAttribute('data-open', 'true')
    await expect(drawer(page).getByRole('tab', { name: 'Consoles' }), query).toHaveAttribute('aria-selected', 'true')
  }
})

test('reload with the project kept: no start screen, the room is back, and the chip « Profil : J’étudie le son · changer » names the profile', async ({ page }) => {
  await openFresh(page)
  await expect(chip(page)).toHaveText('Choisir un profil') // nothing stored yet: the chip opens the profile stage
  await page.keyboard.press('2')
  await skipButton(page).click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await expect(chip(page)).toHaveText('Profil : J’étudie le son · changer')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] }))
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('audio-sim/creation.v1') !== null)).toBe(true)
  await page.reload()
  await page.waitForFunction(() => !!window.__creation && window.__creation.place() === 'blank')
  await expect(start(page)).toHaveCount(0)
  await expect(page.getByTestId('place-picker')).toBeHidden()
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(1)
  await expect(chip(page)).toBeVisible()
  await expect(chip(page)).toHaveText('Profil : J’étudie le son · changer')
  expect((await onboarding(page)).chip).toBe('Profil : J’étudie le son · changer')
})

test('the chip over a kept project reopens the start stage; a new profile is applied WITHOUT replacing the room, the picker closes, and « Tous les lieux » closes back to the project', async ({ page }) => {
  await openFresh(page)
  await page.keyboard.press('1')
  await skipButton(page).click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await expect(chip(page)).toHaveText('Profil : Je découvre · changer')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] }))
  await chip(page).click()
  await expect(start(page)).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: /situation/ })).toBeVisible()
  // « Tous les lieux » over a project: the grids close back to the project (Échap)
  await allPlaces(page).click()
  await expect(page.getByTestId('place-grid')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('place-picker')).toBeHidden()
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(1)
  // again, and choose the engineer: skipped, both panels open, same room, same device
  await chip(page).click()
  await page.keyboard.press('4')
  await skipButton(page).click()
  await expect(page.getByTestId('place-picker')).toBeHidden()
  await expect(chip(page)).toHaveText('Profil : Je travaille dans le son · changer')
  expect(await page.evaluate(() => ({ place: window.__creation!.place(), n: window.__creation!.design().rig.instances.length }))).toEqual({ place: 'blank', n: 1 })
  await expect.poll(() => panels(page)).toEqual({ tree: 'open', props: 'open' })
  await expect(page.locator('#renderCanvas')).toBeFocused()
  await recordIs(page, { profile: 'metier', offer: 'skipped' })
})

test('Échap on the offer stage reopened by the chip leaves with NO change: the stored profile, the room, the panels and the drawer stay as they were', async ({ page }) => {
  await openFresh(page)
  await page.keyboard.press('1')
  await skipButton(page).click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await recordIs(page, { profile: 'decouvre' })
  const before = { record: await record(page), panels: await panels(page) }
  await chip(page).click()
  await page.keyboard.press('4')
  await expect(skipButton(page)).toBeFocused() // the offer for the engineer
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('place-picker')).toBeHidden()
  await expect(page.locator('#renderCanvas')).toBeFocused()
  expect({ record: await record(page), panels: await panels(page) }).toEqual(before)
  await expect(chip(page)).toHaveText('Profil : Je découvre · changer')
})

test('with a record and no autosave the picker shows today\'s grids and the chip reopens the start screen', async ({ page }) => {
  await openFresh(page)
  await page.evaluate(([k, r]) => window.localStorage.setItem(k, JSON.stringify(r)), [KEY, { v: 1, profile: 'projet', offer: 'skipped', request: 0, shown: [] }] as const)
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await expect(page.getByRole('heading', { name: 'Choisir un lieu' })).toBeVisible()
  await expect(chip(page)).toHaveText('Profil : Je monte un projet · changer')
  await chip(page).click()
  await expect(start(page)).toBeVisible()
  await expect(profileButton(page, PROFILES[0].label)).toBeFocused()
})

test('no ?design: no chip and the onboarding reader says so; leaving without a profile (« Tous les lieux ») keeps a « Choisir un profil » chip that reopens the profile stage', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await expect(chip(page)).toHaveCount(0)
  expect(await onboarding(page)).toMatchObject({ design: false, record: null, premiersPas: false, chip: null })
  await openFresh(page)
  await allPlaces(page).click()
  await expect(chip(page)).toHaveText('Choisir un profil')
  expect(await onboarding(page)).toMatchObject({ design: true, tutorialAllowed: true, premiersPas: true, chip: 'Choisir un profil', record: null })
  await chip(page).click()
  await expect(start(page)).toBeVisible()
  await expect(profileButton(page, PROFILES[0].label)).toBeFocused()
})

test('?design=1&oscar=0: the start stage shows the profile choice only, a choice is final (no offer in the page), the room opens with the profile, no « Premiers pas »', async ({ page }) => {
  await openFresh(page, '?design=1&oscar=0')
  expect(await onboarding(page)).toMatchObject({ design: true, tutorialAllowed: false, premiersPas: false })
  await expect(start(page)).toBeVisible()
  await page.keyboard.press('2')
  // no offer: the room opens at once
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await expect(page.getByText('Faire le tutoriel')).toHaveCount(0) // not in the page at all, not only hidden
  await expect(page.getByText('Passer, je connais')).toHaveCount(0)
  await expect(page.getByTestId('place-picker')).toBeHidden()
  await recordIs(page, { v: 1, profile: 'etudie', offer: null, request: 0, shown: [] })
  await expect.poll(() => panels(page)).toEqual({ tree: 'open', props: 'open' })
  await expect(drawer(page)).toHaveAttribute('data-open', 'true')
  await expect(chip(page)).toHaveText('Profil : J’étudie le son · changer')
  // reopened with the chip: still no offer, still final, and the stored profile is rewritten once, with the new choice
  await chip(page).click()
  await expect(start(page)).toBeVisible()
  await page.keyboard.press('4')
  await expect(start(page)).toBeHidden()
  await recordIs(page, { profile: 'metier', offer: null, request: 0 })
  await page.getByRole('menuitem', { name: 'Aide', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Premiers pas' })).toHaveCount(0)
})

test('?design=1&mode=exam (ruling R-A): the onboarding is OFF: today\'s picker, no start screen, no chip, no key written, no framing, no drawer or panel change, no « Premiers pas »', async ({ page }) => {
  await openFresh(page, '?design=1&mode=exam')
  await expect(page.getByRole('heading', { name: 'Choisir un lieu' })).toBeVisible()
  await expect(page.getByTestId('start-screen')).toHaveCount(0)
  await expect(chip(page)).toHaveCount(0)
  expect(await onboarding(page)).toMatchObject({ design: false, tutorialAllowed: false, premiersPas: false, record: null, chip: null })
  const panelsBefore = await panels(page)
  await page.locator('[data-place="blank"]').click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await expect(page.getByTestId('place-picker')).toBeHidden()
  expect(await record(page), 'no onboarding key').toBeNull()
  expect(await panels(page), 'the panels are not rearranged').toEqual(panelsBefore)
  await expect(drawer(page)).toHaveCount(0) // the drawer chunk is not even loaded
  await page.getByRole('menuitem', { name: 'Aide', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Premiers pas' })).toHaveCount(0)
})

test('the offer stage is a group named by its question and described by the profile: a screen reader hears them with the focused button', async ({ page }) => {
  await openFresh(page)
  await page.keyboard.press('2')
  const group = start(page).getByRole('group', { name: 'Un tutoriel pour votre premier son ?' })
  await expect(group).toBeVisible()
  await expect(group).toHaveAccessibleDescription(/Votre profil : J’étudie le son.*Des étapes courtes/s)
  await expect(group.getByRole('button')).toHaveCount(2)
  // package-neutral: the lead promises neither the empty room nor the cabling (review item 5)
  const text = (await start(page).innerText()).replace(/\s+/g, ' ')
  expect(text).toContain('Des étapes courtes, à faire vous-même, pour arriver à votre premier son. Il est conseillé à tout le monde.')
  expect(text).not.toMatch(/salle vide|brancher/i)
})

test('Aide › Premiers pas waits while the start screen shows (disabled, with its reason) and the chip does nothing then; a keypad key with NumLock off (End) is not the digit 1', async ({ page }) => {
  await openFresh(page)
  await page.getByRole('menuitem', { name: 'Aide', exact: true }).click()
  const item = page.getByRole('menuitem', { name: /Premiers pas/ })
  await expect(item).toHaveAttribute('aria-disabled', 'true')
  await expect(item).toContainText('Répondez d’abord à l’écran de départ.')
  await item.click({ force: true })
  expect(await page.evaluate(() => window.__creation!.place())).toBeNull()
  expect(await record(page)).toBeNull()
  await page.keyboard.press('Escape')
  await chip(page).click() // the stage it would open is already open: nothing changes
  await expect(profileButton(page, PROFILES[0].label)).toBeVisible()
  // NumLock off: the physical Numpad1 key reports key « End »: navigation, not a choice
  await page.locator('[data-testid="start-screen"]').evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { code: 'Numpad1', key: 'End', bubbles: true, cancelable: true })))
  await expect(profileButton(page, PROFILES[0].label)).toBeVisible()
  await expect(skipButton(page)).toBeHidden()
  await page.locator('[data-testid="start-screen"]').evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { code: 'Numpad1', key: '1', bubbles: true, cancelable: true })))
  await expect(tutorialButton(page)).toBeVisible() // NumLock on: the digit
})

test('a double click on « Faire le tutoriel » raises the request once and opens the room once (G6 concern 5); so does Enter twice', async ({ page }) => {
  await openFresh(page)
  await page.keyboard.press('1')
  await tutorialButton(page).dblclick()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await expect(page.getByTestId('place-picker')).toBeHidden()
  await recordIs(page, { profile: 'decouvre', offer: 'taken', request: 1 })
  expect(JSON.parse((await record(page))!).request).toBe(1)
  expect(await page.evaluate(() => window.__creation!.scenes())).toBe(1)
  await openFresh(page)
  await page.keyboard.press('3')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await recordIs(page, { profile: 'projet', offer: 'taken', request: 1 })
})

for (const size of [
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 820, height: 1180 },
  { width: 375, height: 812 },
]) {
  test(`${size.width} x ${size.height}: the profile chip is in the status bar, inside the window, clear of the Signal button, with no serious axe finding`, async ({ page }) => {
    await page.setViewportSize(size)
    await openFresh(page)
    await page.keyboard.press('1')
    await skipButton(page).click()
    await page.waitForFunction(() => window.__creation!.place() === 'blank')
    await expect(chip(page)).toBeVisible()
    const rect = async (id: string) => (await page.getByTestId(id).boundingBox())!
    const c = await rect('profile-chip')
    const bar = await rect('status-bar')
    const sig = await rect('signal-status')
    expect(c.x, 'inside on the left').toBeGreaterThanOrEqual(0)
    expect(c.x + c.width, 'inside on the right').toBeLessThanOrEqual(size.width)
    expect(c.y, 'inside the status bar (top)').toBeGreaterThanOrEqual(bar.y - 1)
    expect(c.y + c.height, 'inside the status bar (bottom)').toBeLessThanOrEqual(bar.y + bar.height + 1)
    expect(c.height, 'a target of its own').toBeGreaterThanOrEqual(24)
    const overlap = Math.min(c.x + c.width, sig.x + sig.width) - Math.max(c.x, sig.x)
    expect(overlap, 'clear of the Signal button').toBeLessThanOrEqual(0)
    expect(sig.x + sig.width, 'the Signal button stays inside the window').toBeLessThanOrEqual(size.width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll').toBe(true)
    const axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
  })
}
