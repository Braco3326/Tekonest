/**
 * T7.1a: parity and journeys (onboarding packs, plan T7.1a, spec 11.1 and 11.10; the errata of the spec override older text).
 *
 *  1. DOM PARITY (11.1): the five packages put the same landmarks and the same `data-testid` set on the page at the start screen (profile stage, offer stage), in the workspace
 *     and with the tutorial running (the tutorial slot is in all five). The ONE declared difference is the checklist's list: package 2 docks it in the Projet panel and the other
 *     four open it from the status bar chip (spec 7.2, ADR 0019); its ids are left out of the comparison and the test proves that exclusion hides nothing else (the chip packages
 *     have none of them, package 2 has them). The comparer is proven able to fail: the plain address (no `?design`) must differ from `?design=1`.
 *  2. THE FOUR PROFILES on package 1, each reaching a first sound: the offer button that holds the focus is the one spec 3 names, the first room opens with the profile's inventory tab and
 *     panels, the record carries the profile and the answer, the tutorial's ten steps run to a real « Signal de test », and only the entrepreneur gets the own-gear row.
 *  3. ABSENCE (11.10): an exam address (any `mode` parameter, whatever its value or case, `?design=1&MODE=practice` included) shows no onboarding, no look, no Oscar, no step card, no slot and
 *     no gear row, whatever the storage says; `?oscar=0` shows no Oscar, no offer, no step card and no « Premiers pas » but keeps the profile choice, the look and the gear row (the erratum of
 *     the T2 fix round: they do not come from the guide). Each negative test is paired with a positive control that runs the same actions on `?design=1` and sees every one of those things.
 */
import type { Page } from '@playwright/test'
import { COPY } from '../../src/creation/copy'
import { DESIGN_IDS, packageById, type DesignId } from '../../src/design/packages'
import { quietWindow } from './waits'
import { act, connect, enter, expect, test, GUIDE_KEY, loadFresh, ONBOARDING_KEY, openFresh, PROFILES, spawn, start, STEP_INTENTS, testSignal, waitStartScreen, waitStep } from './onboardingKit'

test.use({ viewport: { width: 1366, height: 768 } })
test.describe.configure({ mode: 'parallel' })

/** The period at which a snapshot is repeated until it stops changing (a sampling period, waits.ts). */
const SAMPLE_MS = 300
const oscarIcon = (page: Page) => page.locator('.oscar-icon')
const ownGear = (page: Page) => page.getByTestId('own-gear')

// ── 1. DOM parity ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

interface Snap {
  ids: string[]
  landmarks: string[]
}
/** The `data-testid` values and the landmarks (tag, role, accessible name) of the whole page, Oscar's widget included (it is part of the page in every package). */
const snap = (page: Page): Promise<Snap> =>
  page.evaluate(() => {
    const ids = [...new Set([...document.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')!))].sort()
    const LANDMARKS = 'main, nav, aside, header, footer, section, [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"], [role="region"], [role="status"], [role="alert"], [role="dialog"], [role="menubar"], [role="toolbar"], [role="tree"], [role="group"]'
    const nameOf = (e: Element): string => {
      const by = e.getAttribute('aria-labelledby')
      if (by) return by.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join(' ')
      return e.getAttribute('aria-label') ?? ''
    }
    const landmarks = [...new Set([...document.querySelectorAll(LANDMARKS)].map((e) => `${e.tagName.toLowerCase()}[${e.getAttribute('role') ?? ''}] "${nameOf(e)}"`))].sort()
    return { ids, landmarks }
  })

/** Declared difference: the checklist's LIST (docked in package 2, a chip pop-over elsewhere). The chip itself is on every page and stays compared. */
const CHECKLIST_LIST = /^checklist(?!-chip$)/
const listIds = (s: Snap): string[] => s.ids.filter((i) => CHECKLIST_LIST.test(i))
const LIST_LANDMARK = (l: string): boolean => l.includes(`"${COPY.checklist!.title}"`)
const compared = (s: Snap): Snap => ({ ids: s.ids.filter((i) => !CHECKLIST_LIST.test(i)), landmarks: s.landmarks.filter((l) => !LIST_LANDMARK(l)) })
/** What one snapshot has that the other has not: readable on failure. */
const diff = (a: Snap, b: Snap): string[] => [
  ...a.ids.filter((i) => !b.ids.includes(i)).map((i) => `testid ${i}: only in the first`),
  ...b.ids.filter((i) => !a.ids.includes(i)).map((i) => `testid ${i}: only in the second`),
  ...a.landmarks.filter((i) => !b.landmarks.includes(i)).map((i) => `landmark ${i}: only in the first`),
  ...b.landmarks.filter((i) => !a.landmarks.includes(i)).map((i) => `landmark ${i}: only in the second`),
]

/**
 * A snapshot once the page has stopped changing: lazy chunks (the drawer, the start screen, Oscar) land at different moments under load, and a snapshot taken between two of
 * them would differ between packages for no reason of theirs. A state wait: three snapshots in a row, 300 ms apart, are equal.
 */
async function stableSnap(page: Page): Promise<Snap> {
  let last = ''
  let same = 0
  let now: Snap = await snap(page)
  await expect
    .poll(
      async () => {
        now = await snap(page)
        const key = JSON.stringify(now)
        same = key === last ? same + 1 : 0
        last = key
        await page.waitForTimeout(SAMPLE_MS) // the sampling period
        return same
      },
      { timeout: 15_000, message: 'the page never stopped changing' },
    )
    .toBeGreaterThanOrEqual(2)
  return now
}

/** Oscar mounts after the creation boot (a lazy chunk): wait for him, or a snapshot taken early would miss his landmark in some packages and not in others. */
const withOscar = async (page: Page): Promise<void> => {
  try {
    await expect(oscarIcon(page)).toBeVisible({ timeout: 15_000 })
  } catch (e) {
    const d = await page.evaluate(() => ({ guideNodes: document.querySelectorAll('.oscar-guide, [data-oscar-root]').length, icons: document.querySelectorAll('.oscar-icon').length, hook: !!window.__creation, place: window.__creation?.place() ?? null, url: location.search, html: document.documentElement.className }))
    throw new Error(`Oscar never showed: ${JSON.stringify(d)}`)
  }
}

/** The workspace with an EMPTY bench in every package: a stored profile (answered, tutorial skipped) and the neutral room chosen by the app's own hook. Package 5's start screen would open its model instead. */
async function emptyWorkspace(page: Page, query: string): Promise<void> {
  await loadFresh(page, query, { [ONBOARDING_KEY]: JSON.stringify({ v: 1, profile: 'decouvre', offer: 'skipped', request: 0, shown: [] }) })
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank' && window.__creation!.modelsPending() === 0)
}

test('DOM parity (11.1): the same landmarks and test ids in all five packages at the start screen (both stages), in the workspace and with the tutorial running', async ({ page }) => {
  test.setTimeout(240_000)
  const byKind: Record<'profile stage' | 'offer stage' | 'workspace' | 'tutorial running', Snap[]> = { 'profile stage': [], 'offer stage': [], workspace: [], 'tutorial running': [] }
  for (const id of DESIGN_IDS) {
    await openFresh(page, `?design=${id}`)
    await waitStartScreen(page)
    await withOscar(page)
    byKind['profile stage'].push(await stableSnap(page))
    await page.keyboard.press('1')
    await expect(start(page).getByRole('button', { name: /^Faire le tutoriel/ })).toBeVisible()
    byKind['offer stage'].push(await stableSnap(page))

    await emptyWorkspace(page, `?design=${id}`)
    await withOscar(page)
    byKind.workspace.push(await stableSnap(page))

    await enter(page, id, { tutorial: true })
    await withOscar(page)
    await expect(page.getByTestId('tutorial-slot')).toBeVisible()
    byKind['tutorial running'].push(await stableSnap(page))
  }
  for (const [kind, snaps] of Object.entries(byKind)) {
    // the comparer's own input is not empty: the slot, the chip, the shell
    expect(snaps[0].ids.length, `${kind}: the snapshot holds test ids`).toBeGreaterThan(20)
    expect(snaps[0].landmarks.length, `${kind}: the snapshot holds landmarks`).toBeGreaterThan(8)
    for (let i = 1; i < snaps.length; i++) expect(diff(compared(snaps[0]), compared(snaps[i])), `${kind}: package 1 against package ${DESIGN_IDS[i]}`).toEqual([])
  }
  // the tutorial slot and its card are in all five (the spec's own parenthesis)
  for (const [i, s] of byKind['tutorial running'].entries()) for (const want of ['tutorial-slot', 'tutorial-card', 'tutorial-step-count', 'tutorial-skip']) expect(s.ids, `package ${DESIGN_IDS[i]} has ${want}`).toContain(want)
  // the exclusion hides only the declared difference: the chip packages have no list in the workspace, the panel package has one
  for (const [i, id] of DESIGN_IDS.entries()) {
    const docked = packageById(id).layout.checklist === 'panel'
    expect(listIds(byKind.workspace[i]).length > 0, `package ${id}: the checklist list is docked in the workspace only for a 'panel' package`).toBe(docked)
    expect(byKind.workspace[i].landmarks.some(LIST_LANDMARK), `package ${id}: its landmark too`).toBe(docked)
  }
})

test('the comparer can fail: the plain address (no ?design) and ?design=1 do not carry the same workspace (the chip, the start screen)', async ({ page }) => {
  await emptyWorkspace(page, '')
  const plain = await snap(page)
  await emptyWorkspace(page, '?design=1')
  await withOscar(page)
  const design1 = await snap(page)
  const d = diff(compared(plain), compared(design1))
  expect(d, 'the comparison sees what ?design adds').toContain('testid profile-chip: only in the second')
  expect(d.length).toBeGreaterThan(0)
})

// ── 2. The four profiles, package 1 ───────────────────────────────────────────────────────────────────────────────────────────

for (const p of PROFILES) {
  test(`profile ${p.key} « ${p.label} » on package 1: the offer focuses ${p.focus === 'tutorial' ? '« Faire le tutoriel »' : '« Passer, je connais »'}; the tutorial reaches a real first sound${p.id === 'projet' ? ' and the own-gear row' : ' and no own-gear row'}`, async ({ page }) => {
    test.setTimeout(120_000)
    await openFresh(page, '?design=1')
    await waitStartScreen(page)
    await page.keyboard.press(p.key)
    const wanted = p.focus === 'tutorial' ? start(page).getByRole('button', { name: /^Faire le tutoriel/ }) : start(page).getByRole('button', { name: 'Passer, je connais', exact: true })
    await expect(wanted, 'spec 3: the offer button that holds the focus').toBeFocused()
    await start(page).getByRole('button', { name: /^Faire le tutoriel/ }).click()
    await page.waitForFunction(() => window.__creation?.place() === 'blank')
    await expect(page.getByTestId('tutorial-card')).toBeVisible({ timeout: 10_000 })
    // the record carries the profile WITH the answer (T2 fix round, ruling R-B)
    await expect.poll(() => page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? 'null'), ONBOARDING_KEY)).toMatchObject({ v: 1, profile: p.id, offer: 'taken', request: 1 })
    // the first room opens with the profile's inventory tab (spec 3: consoles for the four) and the chip names the profile; the drawer is a lazy chunk: wait for its state first
    await expect(page.getByTestId('inventory-drawer')).toHaveAttribute('data-open', 'true', { timeout: 15_000 })
    await expect(page.getByTestId('inventory-drawer').getByRole('tab', { selected: true })).toHaveText('Consoles')
    await expect(page.getByTestId('profile-chip')).toHaveText(`Profil : ${p.label} · changer`)
    // the profile decides the panels where it names them: 2 and 4 open both, 1 and 3 leave them to the package (package 1: folded)
    const panels = await page.evaluate(() => ({ tree: document.querySelector('.cr')!.getAttribute('data-tree'), props: document.querySelector('.cr')!.getAttribute('data-props') }))
    expect(panels, 'profile panels at 1366 x 768').toEqual(p.focus === 'skip' ? { tree: 'open', props: 'open' } : { tree: 'collapsed', props: 'collapsed' })
    // the ten steps, each completed by the bench change it waits for (a state wait on the card), then the real menu route to the test signal
    await waitStep(page, 1, 10)
    for (const [k, intents] of STEP_INTENTS.entries()) {
      await act(page, [...intents])
      await waitStep(page, k + 2, 10)
    }
    await expect(page.getByTestId('own-gear'), 'no gear row before a sound').toHaveCount(0)
    await testSignal(page)
    await expect(page.getByTestId('tutorial-closing')).toBeVisible({ timeout: 10_000 })
    await expect.poll(() => page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? 'null')?.status, GUIDE_KEY)).toBe('done')
    if (p.id === 'projet') {
      await expect(ownGear(page)).toBeVisible()
      await expect(page.locator('.cr')).toHaveAttribute('data-gear', 'on')
    } else {
      await quietWindow(page, 1000) // a quiet window: the card is not merely late
      await expect(ownGear(page)).toHaveCount(0)
      expect(await page.locator('.cr').getAttribute('data-gear')).toBeNull()
    }
  })

  test(`profile ${p.key} « ${p.label} » on package 1, tutorial declined: the room opens with no card and no slot, and the bench the app's own hook builds plays through the real Écoute menu`, async ({ page }) => {
    test.setTimeout(90_000)
    await enter(page, 1, { profile: p.key, tutorial: false })
    await expect(page.getByTestId('tutorial-slot')).toHaveCount(0)
    await expect(page.getByTestId('inventory-drawer').getByRole('tab', { selected: true })).toHaveText('Consoles')
    await expect.poll(() => page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? 'null'), ONBOARDING_KEY)).toMatchObject({ profile: p.id, offer: 'skipped', request: 0 })
    // the checklist chip is the learner's answer to « why do I hear nothing » on the empty bench; it leaves when the bench plays
    await expect(page.getByTestId('checklist-chip')).toBeVisible()
    await act(page, [spawn('yamaha-ql1', 'ql1', 0), spawn('qsc-k12-2', 'k12', -1), spawn('multiprise-secteur', 'strip', 0.4), connect('ql1', 'out-main-l', 'k12', 'in-line-a'), ...STEP_INTENTS[5], ...STEP_INTENTS[7], ...STEP_INTENTS[8]])
    await expect(page.getByTestId('checklist-chip')).toBeHidden() // playback is ready: the chip leaves
    await testSignal(page)
    if (p.id === 'projet') await expect(ownGear(page)).toBeVisible()
    else {
      await quietWindow(page, 1000) // a quiet window: the row is not merely late
      await expect(ownGear(page)).toHaveCount(0)
    }
  })
}

// ── 3. Absence on exam addresses and with ?oscar=0 (11.10), each against a positive control ───────────────────────────────────

type Presence = {
  startScreen: boolean
  offerInPage: boolean
  profileChip: boolean
  oscarIcon: boolean
  oscarRoot: boolean
  tutorialSlot: boolean
  tutorialCard: boolean
  gearRow: boolean
  premiersPas: boolean
  practiceClass: boolean
  lookAttributes: boolean
  roleColoursAreThePlainMap: boolean
  guideRequests: string[]
}
const GUIDE_ASSET = /\/assets\/(mount|creationBridge|theme|guide|stepCard|tutorial)-[\w-]+\.(js|css)$/

/** What the page shows right now. Read AFTER the actions of the case (a quiet window included), so a late mount would be seen. */
async function presence(page: Page, requests: string[]): Promise<Presence> {
  const html = await page.evaluate(() => {
    const h = document.documentElement
    return {
      practiceClass: h.classList.contains('cr-practice'),
      lookAttributes: ['data-surface', 'data-density', 'data-drawer', 'data-shortcuts'].every((a) => h.hasAttribute(a)),
      roleColoursAreThePlainMap: h.style.getPropertyValue('--cr-role-focus') === '#DD9349' && h.style.getPropertyValue('--cr-role-surface') === '#1C191D',
      oscarRoot: document.querySelectorAll('.oscar-guide, [data-oscar-root]').length > 0,
      offerInPage: /Faire le tutoriel|Passer, je connais/.test(document.body.textContent ?? ''),
    }
  })
  await page.locator('#cr-menu-aide').click()
  const premiersPas = (await page.getByRole('menuitem', { name: TUTORIAL_ITEMS }).count()) > 0
  await page.keyboard.press('Escape')
  return {
    startScreen: (await start(page).count()) > 0 && (await start(page).isVisible()),
    offerInPage: html.offerInPage,
    profileChip: (await page.getByTestId('profile-chip').count()) > 0,
    oscarIcon: (await oscarIcon(page).count()) > 0,
    oscarRoot: html.oscarRoot,
    tutorialSlot: (await page.getByTestId('tutorial-slot').count()) > 0 || (await page.locator('.cr[data-tutorial]').count()) > 0,
    tutorialCard: (await page.getByTestId('tutorial-card').count()) > 0,
    gearRow: (await page.getByTestId('gear-slot').count()) > 0 || (await page.locator('.cr[data-gear]').count()) > 0,
    premiersPas,
    practiceClass: html.practiceClass,
    lookAttributes: html.lookAttributes,
    roleColoursAreThePlainMap: html.roleColoursAreThePlainMap,
    guideRequests: requests.filter((u) => GUIDE_ASSET.test(u)).map((u) => u.split('/').pop()!),
  }
}
/** Aide's tutorial entries: « Premiers pas » before a run, « Reprendre à l’étape k » and « Recommencer le tutoriel » during and after one. */
const TUTORIAL_ITEMS = /Premiers pas|Reprendre à l’étape|Recommencer/
const watchRequests = (page: Page): string[] => {
  const urls: string[] = []
  page.on('request', (r) => urls.push(new URL(r.url()).pathname))
  return urls
}

/** What a practice address with `?design` shows once a profile 3 learner has run the tutorial and a sound plays. Every field is a thing the absent cases must NOT have (the plain-map flag is the reverse). */
const SHOWN: Presence = {
  startScreen: false, // answered by now; the start screen itself is asserted at the boot of the control below
  offerInPage: true, // the answered start screen stays in the page, hidden (the control asserts it visible at the boot)
  profileChip: true,
  oscarIcon: true,
  oscarRoot: true,
  tutorialSlot: true,
  tutorialCard: true,
  gearRow: true,
  premiersPas: true,
  practiceClass: true,
  lookAttributes: true,
  roleColoursAreThePlainMap: false, // package 3, the control's package: its map is not today's
  guideRequests: expect.arrayContaining([expect.stringMatching(/^mount-/), expect.stringMatching(/^creationBridge-/)]) as unknown as string[],
}

/** Seeds what would switch the onboarding on if a gate leaked: a profile that has answered the offer and asked for a tutorial, and a guide record that is running. */
async function seed(page: Page, query: string): Promise<void> {
  await page.goto('/' + query)
  await page.evaluate(
    ([ok, onboarding, gk, guide]) => {
      window.localStorage.clear()
      window.localStorage.setItem(ok, onboarding)
      window.localStorage.setItem(gk, guide)
    },
    [ONBOARDING_KEY, JSON.stringify({ v: 1, profile: 'projet', offer: 'taken', request: 1, shown: [] }), GUIDE_KEY, JSON.stringify({ v: 1, handledRequest: 0, step: 'console', k: 1, n: 10, status: 'running', early: [], shown: [], passed: [], helper: false })] as const,
  )
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
}
/** The same bench and the same real sound on every address: a place (picker card or the stored profile's picker), the five-device bench, Écoute > Signal de test. */
async function benchAndSound(page: Page): Promise<void> {
  if (await page.getByTestId('place-picker').isVisible()) await page.locator('[data-place="blank"]').click()
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
  await act(page, [spawn('yamaha-ql1', 'ql1', 0), spawn('qsc-k12-2', 'k12', -1), spawn('multiprise-secteur', 'strip', 0.4), connect('ql1', 'out-main-l', 'k12', 'in-line-a'), ...STEP_INTENTS[5], ...STEP_INTENTS[7], ...STEP_INTENTS[8]])
  await testSignal(page)
}

test('positive control for 11.10: on ?design=3 a profile 3 learner who takes the tutorial and plays the test signal sees every one of the things the exam and ?oscar=0 cases must not (and the look)', async ({ page }) => {
  test.setTimeout(120_000)
  const req = watchRequests(page)
  await openFresh(page, '?design=3')
  await waitStartScreen(page)
  expect(await start(page).isVisible(), 'the start screen').toBe(true)
  await page.keyboard.press('3')
  await expect(start(page).getByRole('button', { name: /^Faire le tutoriel/ }), 'the offer is in the page').toBeVisible()
  await start(page).getByRole('button', { name: /^Faire le tutoriel/ }).click()
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
  await expect(oscarIcon(page)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('tutorial-card')).toBeVisible({ timeout: 10_000 })
  await act(page, [spawn('yamaha-ql1', 'ql1', 0), spawn('qsc-k12-2', 'k12', -1), spawn('multiprise-secteur', 'strip', 0.4), connect('ql1', 'out-main-l', 'k12', 'in-line-a'), ...STEP_INTENTS[5], ...STEP_INTENTS[7], ...STEP_INTENTS[8]])
  await testSignal(page)
  await expect(ownGear(page)).toBeVisible()
  expect(await presence(page, req)).toMatchObject(SHOWN)
})

for (const query of ['?design=1&mode=exam', '?design=1&MODE=practice', '?design=3&mode=', '?design=2&Mode=exam', '?design=5&mode=practice', '?design=4&mode=exam&oscar=0']) {
  test(`${query}: an exam address shows no onboarding, no look, no Oscar, no step card, no slot, no gear row, even with a storage that asks for all of them`, async ({ page }) => {
    test.setTimeout(120_000)
    const req = watchRequests(page)
    await seed(page, query)
    await benchAndSound(page)
    await quietWindow(page, 3000) // a quiet window longer than the guide takes to mount (guide-creation.spec measures it): a late mount would show
    expect(await presence(page, req)).toEqual({
      startScreen: false,
      offerInPage: false,
      profileChip: false,
      oscarIcon: false,
      oscarRoot: false,
      tutorialSlot: false,
      tutorialCard: false,
      gearRow: false,
      premiersPas: false,
      practiceClass: false,
      lookAttributes: false,
      roleColoursAreThePlainMap: true,
      guideRequests: [],
    })
    // nothing was written on the way: the seeded records are exactly as they were (no request bumped, no step moved)
    expect(await page.evaluate((k) => window.localStorage.getItem(k), ONBOARDING_KEY)).toBe(JSON.stringify({ v: 1, profile: 'projet', offer: 'taken', request: 1, shown: [] }))
    expect(await page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? 'null'), GUIDE_KEY)).toMatchObject({ step: 'console', k: 1, status: 'running', handledRequest: 0 })
  })
}

for (const query of ['?design=1&oscar=0', '?design=3&oscar=0', '?design=5&oscar=0']) {
  test(`${query}: no Oscar, no offer, no step card, no slot, no « Premiers pas », no guide chunk; the profile choice, the look and the gear row stay (they are not the guide's)`, async ({ page }) => {
    test.setTimeout(120_000)
    const req = watchRequests(page)
    await openFresh(page, query)
    await waitStartScreen(page)
    expect(await start(page).isVisible(), 'the profile choice is there').toBe(true)
    await page.keyboard.press('3')
    // a choice is final here: the room opens at once, and there never was an offer to answer
    await page.waitForFunction(() => window.__creation?.place() === 'blank')
    await expect(page.getByTestId('profile-chip')).toHaveText('Profil : Je monte un projet · changer')
    // package 5 opens its model, the others the neutral room: give the sound a bench that plays in both
    if ((await page.evaluate(() => window.__creation!.design().rig.instances.length)) === 0) await benchAndSound(page)
    else await testSignal(page)
    await expect(ownGear(page)).toBeVisible()
    // a stored, running guide record must not wake a guide that may not run
    await page.evaluate(([gk, guide]) => window.localStorage.setItem(gk, guide), [GUIDE_KEY, JSON.stringify({ v: 1, handledRequest: 0, step: 'console', k: 1, n: 10, status: 'running', early: [], shown: [], passed: [], helper: false })] as const)
    await quietWindow(page, 3000) // a quiet window: a guide that may not run would have mounted by now
    expect(await presence(page, req)).toEqual({
      startScreen: false,
      offerInPage: false,
      profileChip: true,
      oscarIcon: false,
      oscarRoot: false,
      tutorialSlot: false,
      tutorialCard: false,
      gearRow: true,
      premiersPas: false,
      practiceClass: true,
      lookAttributes: true,
      // package 1's map is today's (Ambre focus on the panel surface); the others differ, and what the page writes must follow the package it is on
      roleColoursAreThePlainMap: ((c) => c.focus === '#DD9349' && c.surface === '#1C191D')(packageById(Number(new URLSearchParams(query).get('design')) as DesignId).colours),
      guideRequests: [],
    })
  })
}
