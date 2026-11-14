/**
 * T7.1c: the keyboard-only first sound, per package, and the runtime honesty scan (onboarding packs, plan T7.1c, spec 4.3 and 11.11; the errata of the spec override older text).
 *
 * T7.1c (N9, G14e: the plan calls it « 11.6 », but spec 11.6 is the 24 px silhouette; the keys are those of spec 4.3): for each package a learner who never touches the mouse reaches a first sound with the REAL controls: the start screen (a profile key, Entrée on the tutorial), the inventory drawer (its
 * filter field, Entrée to choose, Entrée to drop), the 3D view's `]` to select a device, Propriétés (unfolded with Entrée where the package folds it), « Connecter à… » (type, Entrée), the
 * « Lecture console » row (Espace), the menu bar (arrows, Entrée) to Écoute › Signal de test. The route fills nothing, focuses nothing and dispatches nothing from the page (the vitest
 * tests/creation/keyboardOnboardingSpec.test.ts reads the text between the KEYBOARD ONLY markers and fails on any pointer call, programmatic focus, fill or dispatch), and an init script counts every
 * pointer event the page receives: the count must be 0 at the end. The sound is asserted on the engine's own state (`audioState`: playing, the test signal, a voice on the speaker).
 * Package 5 opens its playable model, so its route is the start screen and Écoute › Signal de test; the unplug and replug steps are not part of « a first sound ».
 *
 * 11.11: a runtime scan of everything the learner can read: visible text, `aria-label`, `title` and `placeholder`, at the start screen (both stages), at EVERY tutorial step of each package, on the
 * closing card, on the open checklist, in the Aide menu and, for the entrepreneur, on the gear row. Two scopes, as in tests/creation/honestyLists.ts (the shared list): the families that apply
 * to every string on the page, and the learner families (figures, success and school, Oscar's voice) on the onboarding surfaces only (the app's own panels carry « 230 V », « dB »). On top of the
 * list: « vous » only (no tutoiement), no unverified audio claim, no digit on the venue cards. Every rule is proven able to fail on a crafted string, and the scan is proven not vacuous.
 */
import type { Page } from '@playwright/test'
import { DESIGN_IDS, packageById, type DesignId } from '../../src/design/packages'
import { FAMILIES, NAMES, offends } from '../creation/honestyLists'
import { readFileSync } from 'node:fs'
import { act, connect, enter, expect, noteRetry, openFresh, openRequests, PROFILES, stallOf, start, STEP_INTENTS, test, testSignal, waitStartScreen, waitStep } from './onboardingKit'

test.use({ viewport: { width: 1366, height: 768 } })
/**
 * Two retries for this file only. The route and the scan start a SOUND, which needs lazy chunks (the listen controller, songs, coverage sources) and the Draco wasm for the models. Under six parallel
 * browsers all fetching from ONE `vite preview` process a request now and then hangs: in the PAGE-DIAG lines of the failed attempts fonts, the listen controller chunk and `draco_decoder_gltf.wasm` were
 * still open 20 to 38 s after they were asked for (no failed request, no console error), and `modelsPending() > 0` after 60 s or no `playing` 30 s after Entrée followed. The same route passes 14 of 14 in
 * isolation. A hung request is not something a longer state wait cures, so a failed attempt is run again from the start (fresh worker, fresh storage); the runner reports it as `flaky`, never hidden.
 */
test.describe.configure({ mode: 'parallel', retries: 2 })

// ── T7.1c KEYBOARD ONLY: BEGIN (read by tests/creation/keyboardOnboardingSpec.test.ts: no pointer call, no programmatic focus, fill or dispatch between the markers) ──

const onModel = (id: DesignId): boolean => packageById(id).layout.start === 'playable-model'
const stepsOf = (id: DesignId): number => packageById(id).pacing.steps.length

/** Counts every pointer event the page receives (a keyboard press makes none): a route that reaches for the mouse is caught from inside the page. */
const countPointerEvents = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { __pointerEvents: number }
    w.__pointerEvents = 0
    for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'wheel']) window.addEventListener(type, () => void (w.__pointerEvents += 1), true)
  })
const pointerEvents = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as { __pointerEvents: number }).__pointerEvents)

const focusedIn = (page: Page, selector: string): Promise<boolean> => page.evaluate((s) => document.activeElement?.closest(s) != null, selector)
/** Tab (or Shift+Tab) until the focus is inside `selector`; fails with the focus trail's last stop when it never gets there. */
async function tabTo(page: Page, selector: string, o: { max?: number; back?: boolean } = {}): Promise<void> {
  const max = o.max ?? 120
  for (let i = 0; i < max; i++) {
    if (await focusedIn(page, selector)) return
    await page.keyboard.press(o.back ? 'Shift+Tab' : 'Tab')
  }
  const at = await page.evaluate(() => `${document.activeElement?.tagName}#${document.activeElement?.id} ${document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.slice(0, 30)}`)
  expect(await focusedIn(page, selector), `Tab never reached ${selector} in ${max} presses (stopped at ${at})`).toBe(true)
}
const instanceOf = (page: Page, deviceId: string): Promise<string | undefined> => page.evaluate((d) => window.__creation!.design().rig.instances.find((i) => i.deviceId === d)?.instanceId, deviceId)
const benchSize = (page: Page): Promise<number> => page.evaluate(() => window.__creation!.design().rig.instances.length)

/** Chooses a device in the inventory drawer and drops it: the drawer's filter field is reached with Tab when the drawer is open, or opened with Espace from the 3D view when it is shut. */
async function placeByKeys(page: Page, filter: string, deviceId: string): Promise<void> {
  const before = await benchSize(page)
  const drawer = page.getByTestId('inventory-drawer')
  if ((await drawer.getAttribute('data-open')) === 'true') await tabTo(page, '#cr-inv-filter')
  else {
    await tabTo(page, '#renderCanvas', { back: true })
    await page.keyboard.press('Space')
    await expect(drawer).toHaveAttribute('data-open', 'true')
  }
  await page.keyboard.press('Control+a')
  await page.keyboard.type(filter)
  // the list is filtered a moment after the typing: wait until the first match is the device asked for, or Entrée would choose whatever was listed before
  await expect(drawer.getByTestId('inventory-item').first()).toHaveAttribute('data-device-id', deviceId)
  await page.keyboard.press('Enter') // chooses the first match: a ghost follows the 3D view
  await expect.poll(() => page.evaluate(() => window.__creation!.placing())).toBe(true)
  await page.keyboard.press('Enter') // drops it where the ghost stands
  await expect.poll(() => benchSize(page)).toBe(before + 1)
}
/** `]` on the 3D view cycles the selection through the devices. */
async function selectByKeys(page: Page, deviceId: string): Promise<void> {
  const want = await instanceOf(page, deviceId)
  expect(want, `${deviceId} is on the bench`).toBeDefined()
  await tabTo(page, '#renderCanvas', { back: true })
  for (let i = 0; i < 8 && (await page.evaluate(() => window.__creation!.selection())) !== want; i++) await page.keyboard.press(']')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe(want)
}
/** Propriétés folded (package 1 and 3 start with it folded, a narrow window folds it): its toggle is a button, Entrée unfolds it. */
async function unfoldProperties(page: Page): Promise<void> {
  if ((await page.getByTestId('props-collapse').getAttribute('aria-expanded')) === 'true') return
  await tabTo(page, '[data-testid="props-collapse"]')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('props-collapse')).toHaveAttribute('aria-expanded', 'true')
}
/** Select `fromDevice`, then Propriétés › « Connecter à… » on `fromPort`: type `filter`, Entrée on the single option. */
async function connectByKeys(page: Page, fromDevice: string, fromPort: string, filter: string): Promise<void> {
  const before = await page.evaluate(() => window.__creation!.design().rig.connections.length)
  await selectByKeys(page, fromDevice)
  await unfoldProperties(page)
  await tabTo(page, `[data-key="connect:${fromPort}"]`)
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Connecter à…' })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Filtrer' })).toBeFocused()
  await page.keyboard.type(filter)
  const option = dialog.getByRole('option')
  await expect(option).toHaveCount(1)
  // Entrée acts on the active option: wait until the combobox points at it
  await expect(page.getByRole('combobox', { name: 'Filtrer' })).toHaveAttribute('aria-activedescendant', (await option.getAttribute('id'))!)
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  await expect.poll(() => page.evaluate(() => window.__creation!.design().rig.connections.length)).toBe(before + 1)
}
/** The menu bar by keys: Tab into it, ArrowRight to « Écoute », ArrowDown to « Signal de test », Entrée. Resolves when the engine says the test signal plays. */
async function testSignalByKeys(page: Page): Promise<void> {
  // the sound starts once the scene's models are in (measured: 1 to 2 s after Entrée with the models still loading, more under load, with the status line saying « Prêt » meanwhile): wait for the state, then ask
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0, null, { timeout: 60_000 })
  await tabTo(page, '.cr-menu-top', { back: true })
  for (let i = 0; i < 8 && (await page.evaluate(() => document.activeElement?.id)) !== 'cr-menu-ecoute'; i++) await page.keyboard.press('ArrowRight')
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('cr-menu-ecoute')
  await page.keyboard.press('ArrowDown')
  for (let i = 0; i < 8 && !/Signal de test/.test((await page.evaluate(() => document.activeElement?.textContent)) ?? ''); i++) await page.keyboard.press('ArrowDown')
  expect(await page.evaluate(() => document.activeElement?.textContent)).toMatch(/Signal de test/)
  // Entrée on a greyed item does nothing: the item is enabled once the bench can play (a state, not a delay)
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-disabled'))).not.toBe('true')
  await page.keyboard.press('Enter')
  const played = await page.waitForFunction(() => window.__creation!.audioState().state === 'playing' && window.__creation!.audioState().source === 'test', null, { timeout: 20_000 }).then(() => true, () => false)
  if (!played) {
    const d = await page.evaluate(() => ({ active: `${document.activeElement?.tagName}#${document.activeElement?.id} ${(document.activeElement?.textContent ?? '').slice(0, 30)}`, menuOpen: document.querySelector('#cr-menu-ecoute')?.getAttribute('aria-expanded'), audio: window.__creation!.audioState().state, source: window.__creation!.audioState().source, status: document.querySelector('.cr-status-msg')?.textContent, pending: window.__creation!.modelsPending() }))
    throw new Error(`Signal de test never played after Entrée: ${JSON.stringify(d)}`)
  }
}

/**
 * The start screen by keys: the focus is on the first profile button, « 1 » chooses « Je découvre », the focus is on « Faire le tutoriel », Entrée takes it, the room opens with the focus on the 3D
 * view and the card up. A first visit from an empty storage, so a stalled load (no Oscar, no card: see `loadFresh` in onboardingKit.ts) is answered by doing it again, printed, up to twice.
 */
async function startByKeys(page: Page, id: DesignId): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const open = openRequests(page)
    try {
      await openFresh(page, `?design=${id}`)
      await expect(page.getByTestId('start-screen').getByRole('button', { name: PROFILES[0].label, exact: true })).toBeFocused({ timeout: 30_000 })
      await page.keyboard.press('1')
      await expect(page.getByTestId('start-screen').getByRole('button', { name: /^Faire le tutoriel/ })).toBeFocused()
      await page.keyboard.press('Enter')
      await page.waitForFunction(() => window.__creation?.place() === 'blank')
      await expect(page.getByTestId('tutorial-card')).toBeVisible({ timeout: 20_000 })
      await expect(page.locator('#renderCanvas')).toBeFocused() // the room opens with the focus on the 3D view
      return
    } catch (e) {
      // G14e (C3): again only on a stall (the kit's `stallOf`), and visibly
      const stall = stallOf(e, open)
      if (stall === null || attempt >= 3) throw e
      noteRetry(`the keyboard start on package ${id} (attempt ${attempt}): ${(e as Error).message.slice(0, 90).split('\n')[0]}; stalled: ${JSON.stringify(stall.slice(0, 6))}`)
    } finally {
      open.stop()
    }
  }
}

for (const id of DESIGN_IDS) {
  test(`package ${id}: a keyboard-only learner reaches a first sound (${onModel(id) ? 'the playable model: start screen, then Écoute › Signal de test' : 'start screen, four devices, four cables, « Lecture console », Écoute › Signal de test'})`, async ({ page }) => {
    test.setTimeout(240_000)
    await countPointerEvents(page)
    await startByKeys(page, id)

    if (!onModel(id)) {
      // the tutorial's own order (a learner who follows it): console, mic, speaker, the two signal cables, « Lecture console », strip, the two power cables
      await placeByKeys(page, 'QL1', 'yamaha-ql1')
      await placeByKeys(page, 'SM58', 'shure-sm58')
      await placeByKeys(page, 'K12', 'qsc-k12-2')
      await connectByKeys(page, 'yamaha-ql1', 'out-main-l', 'in-line-a') // console to speaker
      await connectByKeys(page, 'shure-sm58', 'out-xlr', 'in-mic-1') // mic to console
      // « Lecture console »: the console's row in Propriétés, Espace
      await selectByKeys(page, 'yamaha-ql1')
      await unfoldProperties(page)
      await tabTo(page, '[data-key="ctl:playback-usb"]')
      await page.keyboard.press('Space')
      await placeByKeys(page, 'multiprise', 'multiprise-secteur')
      await connectByKeys(page, 'multiprise-secteur', 'out-1', 'QL1 power-in')
      await connectByKeys(page, 'multiprise-secteur', 'out-2', 'K12 power-in')
      // nothing plays until the learner asks for the sound. N10 (G14e): held over a window (2 s after the last cable, the state watched), not the first read of a poll
      const playedAlone = await page.waitForFunction(() => window.__creation!.audioState().state === 'playing', null, { timeout: 2_000 }).then(() => true, () => false)
      expect(playedAlone, 'the bench is complete and nothing plays before « Signal de test »').toBe(false)
    }
    await testSignalByKeys(page)

    const sound = await page.evaluate(() => {
      const a = window.__creation!.audioState()
      return { state: a.state, source: a.source, voices: a.voices.map((v) => v.instanceId) }
    })
    expect(sound.state).toBe('playing')
    expect(sound.source).toBe('test')
    expect(sound.voices.length, 'a speaker carries the test signal').toBeGreaterThanOrEqual(1)
    if (onModel(id)) await waitStep(page, 2, stepsOf(id))
    else await expect(page.getByTestId('tutorial-closing'), 'the tutorial ends on the sound').toBeVisible({ timeout: 10_000 })
    expect(await pointerEvents(page), 'the page received no pointer event: the mouse was never used').toBe(0)
  })
}
// ── T7.1c KEYBOARD ONLY: END ──────────────────────────────────────────────────────────────────────────────────────────────────

test('the pointer counter works: one mouse click is counted (so a count of 0 above means something)', async ({ page }) => {
  await countPointerEvents(page)
  await openFresh(page, '?design=1')
  expect(await pointerEvents(page)).toBe(0)
  await page.mouse.click(400, 400)
  expect(await pointerEvents(page)).toBeGreaterThan(0)
})

// ── 11.11 runtime honesty scan ───────────────────────────────────────────────────────────────────────────────────────────────

interface Seen {
  /** `text`, `aria-label`, `title` or `placeholder`. */
  kind: string
  text: string
  /** The learner's own surface (start screen, step card, Oscar, checklist, gear row, chips, Aide): the learner families apply. */
  learner: boolean
  where: string
}
const LEARNER_SURFACES = ['[data-testid="start-screen"]', '[data-testid="tutorial-slot"]', '[data-testid="gear-slot"]', '[data-testid="checklist"]', '.oscar-guide', '[data-oscar-root]', '#cr-menu-aide-panel', '[data-testid="profile-chip"]', '[data-testid="checklist-chip"]']

/** Everything a learner can read on the page right now: the text of visible elements (the guide's live region included), `aria-label`, `title`, `placeholder`. */
const readPage = (page: Page): Promise<Seen[]> =>
  page.evaluate((surfaces) => {
    const out: { kind: string; text: string; learner: boolean; where: string }[] = []
    const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()
    const visible = (el: Element): boolean => {
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0 && el.closest('[hidden]') === null
    }
    const sel = surfaces.join(',')
    const where = (el: Element): string => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.split(/\s+/)[0] : ''}`
    for (const el of document.querySelectorAll('body *')) {
      if (['SCRIPT', 'STYLE', 'CANVAS', 'SVG', 'PATH', 'NOSCRIPT'].includes(el.tagName.toUpperCase())) continue
      if (!visible(el)) continue
      const learner = el.closest(sel) !== null
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join(' ')
      if (norm(own) !== '') out.push({ kind: 'text', text: norm(own), learner, where: where(el) })
      for (const a of ['aria-label', 'title', 'placeholder']) {
        const v = el.getAttribute(a)
        if (v && norm(v) !== '') out.push({ kind: a, text: norm(v), learner, where: where(el) })
      }
    }
    return out
  }, LEARNER_SURFACES)

/** « vous » only: the tu-forms of French. Pronouns and possessives, and the tutoiement imperatives of the verbs the tutorial uses (a sentence-initial imperative without the « -ez »). */
const TUTOIEMENT = /(?<![\p{L}-])(tu|toi|ton|ta|tes|t['’]|vas-y|fais)(?![\p{L}])|(?:^|[.!?:«]\s*)(pose|branche|relie|sélectionne|active|ouvre|clique|choisis|débranche|rebranche|essaie|regarde|vérifie|appuie|tape|connecte|règle|lance|reviens)(?![\p{L}])/iu
/** What the spec calls unverified: nothing is claimed about what is heard (the live audio reaction to an unplug, a mic, a speaker). Lexical, so the runtime scan can state it beyond honestyLists. */
const AUDIO_CLAIM = /vous (entendrez|entendez)|on (entend|n’entend)|se tait|devient muet|plus (aucun )?son\b|le son (s’arrête|disparaît|change)|ça (sonne|sonnera)|coupe le son/i

/**
 * The digits the spec allows in a learner string (spec 9: « any digit except « Étape {k} sur {n} » placeholders and the digits of catalog NAMES »): the step counter and its variants
 * (« étape 3 », « 10 étapes » on the offer, the screen-reader marks « Étape 2 : faite »), a device's instance id in parentheses (« Yamaha QL1 (ql1) », the checklist's « Aller à »), and the
 * key hint and the step mark when they are the whole text of their element (« 1 » on a profile button, « 7 » on the card). Nothing else: « 12 dB », « 48 V » and « 3 minutes » still trip.
 */
/** The catalog's device labels (« QSC K12.2 », « Shure SM58 »): names, never figures (spec 9). Longest first, so a label is removed whole. */
const DEVICE_LABELS: string[] = (JSON.parse(readFileSync('content/catalog.json', 'utf8')) as { devices: { label: string }[] }).devices.map((d) => d.label).sort((a, b) => b.length - a.length)
const PLACEHOLDER_DIGITS = [/[Éé]tapes? \d+(?: sur \d+)?/g, /\b\d+ étapes\b/g]
const DIGIT_ONLY_BY_CLASS = /^(?:span\.cr-start-key|span\.tp-sc-mark)$/
/**
 * G14e (review S8): a parenthesis is removed only when it holds the instance id of a device ON THE BENCH at the time of the read (`ids`, from `design()`), never any lowercase-and-digit token:
 * « (12) » or « (48v) » in a learner string still trips the figures family.
 */
const withoutPlaceholders = (s: Seen, ids: readonly string[]): string => {
  if (/^\d{1,2}$/.test(s.text) && DIGIT_ONLY_BY_CLASS.test(s.where)) return ''
  const named = DEVICE_LABELS.reduce((t, l) => t.split(l).join(''), s.text)
  const counters = PLACEHOLDER_DIGITS.reduce((t, re) => t.replace(re, ''), named)
  return ids.reduce((t, id) => t.split(`(${id})`).join(''), counters)
}

/** The families a string trips, plus the two rules of this file. `learner`: the learner families apply too. `ids`: the instance ids on the bench (S8). */
function violations(s: Seen, ids: readonly string[] = []): string[] {
  const bare = withoutPlaceholders(s, ids).replace(NAMES, '')
  const out = offends(bare, s.learner ? 'learner' : 'everywhere').map((f) => `banned family « ${f} »`)
  if (s.learner && TUTOIEMENT.test(bare)) out.push('tutoiement')
  if (s.learner && AUDIO_CLAIM.test(bare)) out.push('unverified audio claim')
  return out
}
const scanErrors = (label: string, seen: Seen[], ids: readonly string[]): string[] =>
  seen.flatMap((s) => {
    const v = violations(s, ids)
    return v.length ? [`${label} | ${s.kind} in ${s.where}: « ${s.text.slice(0, 140)} » -> ${v.join(', ')}`] : []
  })

test('the scan can fail: each rule trips on a crafted string, near misses pass, and the page reader sees text, aria-label, title and placeholder', async ({ page }) => {
  const trips = (text: string, learner = true, ids: readonly string[] = []): string[] => violations({ kind: 'text', text, learner, where: 'crafted' }, ids)
  // S8: an instance id in parentheses is a name only when that instance is on the bench; any other parenthesised figure trips
  expect(trips('Yamaha QL1 (ql1) : Aller à', true, ['ql1', 'k12']), 'an instance id of the bench is a name').toEqual([])
  expect(trips('Le micro (12) est prêt.', true, ['ql1']), 'a parenthesised figure is a figure').toContain('banned family « figures »')
  expect(trips('Réglez le gain (48v).', true, ['ql1']), 'a parenthesised figure with a unit is a figure').toContain('banned family « figures »')
  expect(trips('Console (ql1) : Aller à', true, []), 'an id that is not on the bench is not a name').toContain('banned family « figures »')
  expect(trips('Pose le micro sur la scène.'), 'tutoiement, imperative').toContain('tutoiement')
  expect(trips('Tu poses le micro.'), 'tutoiement, pronoun').toContain('tutoiement')
  expect(trips('Branche ton câble.'), 'tutoiement, possessive').toContain('tutoiement')
  expect(trips('Posez le micro sur la scène.')).toEqual([])
  expect(trips('Écoute'), 'a menu name is not an imperative').toEqual([])
  expect(trips('Dans ce simulateur, la multiprise est la source de courant.')).toEqual([])
  expect(trips('Débranchez le câble : l’enceinte se tait.'), 'an audio claim').toContain('unverified audio claim')
  expect(trips('Vous entendrez le signal.'), 'an audio claim').toContain('unverified audio claim')
  expect(trips('Ce parcours prépare au BTS.'), 'the shared list').toContain('banned family « success and school »')
  expect(trips('Le micro à 12 dB.'), 'figures, learner scope').toContain('banned family « figures »')
  expect(trips('Le micro à 12 dB.', false), 'figures do not apply to the app’s own panels').toEqual([])
  expect(trips('Risque de danger.', false), 'safety applies everywhere').toContain('banned family « safety and norms »')
  expect(FAMILIES.length).toBeGreaterThan(8)
  // the reader: a crafted page with each of the four places a string can hide
  await page.setContent(`<body><p>texte visible</p><button aria-label="nom accessible" title="info-bulle">x</button><input placeholder="indice"><p hidden>caché</p><p style="display:none">aussi caché</p></body>`)
  const seen = (await readPage(page)).map((s) => `${s.kind}:${s.text}`)
  expect(seen).toEqual(expect.arrayContaining(['text:texte visible', 'aria-label:nom accessible', 'title:info-bulle', 'placeholder:indice']))
  expect(seen).not.toContain('text:caché')
  expect(seen).not.toContain('text:aussi caché')
})

const PROFILE_3 = PROFILES[2]
for (const id of DESIGN_IDS) {
  test(`package ${id}: the start screen, every tutorial step (${stepsOf(id)}), the closing card, the checklist, Aide and the gear row show nothing the list bans`, async ({ page }) => {
    test.setTimeout(300_000)
    const errors: string[] = []
    const counts = { pages: 0, strings: 0, learnerStrings: 0, checklist: 0 }
    const scan = async (label: string): Promise<void> => {
      const ids = await page.evaluate(() => window.__creation?.design().rig.instances.map((i) => i.instanceId) ?? [])
      const seen = await readPage(page)
      counts.pages++
      counts.strings += seen.length
      counts.learnerStrings += seen.filter((s) => s.learner).length
      errors.push(...scanErrors(label, seen, ids))
    }
    // the start screen, both stages
    await openFresh(page, `?design=${id}`)
    await waitStartScreen(page)
    await expect(page.locator('.oscar-icon')).toBeVisible({ timeout: 15_000 })
    await scan(`package ${id} start screen, profile stage`)
    await page.keyboard.press(PROFILE_3.key)
    await expect(start(page).getByRole('button', { name: /^Faire le tutoriel/ })).toBeVisible()
    await scan(`package ${id} start screen, offer stage`)
    const open = openRequests(page)
    await start(page).getByRole('button', { name: /^Faire le tutoriel/ }).click()
    try {
      await page.waitForFunction(() => window.__creation?.place() === 'blank')
      await expect(page.getByTestId('tutorial-card')).toBeVisible({ timeout: 20_000 })
    } catch (e) {
      // a stalled load (no card): the same entry again from an empty storage (the start screens above are already scanned). G14e (C3): only on a stall, visibly
      const stall = stallOf(e, open)
      if (stall === null) throw e
      noteRetry(`the scan's entry on package ${id}: ${(e as Error).message.slice(0, 90).split('\n')[0]}; stalled: ${JSON.stringify(stall.slice(0, 6))}`)
      await enter(page, id, { profile: PROFILE_3.key, tutorial: true })
    } finally {
      open.stop()
    }
    // every step: the card and Oscar's bubble both say it, then the page is read
    const n = stepsOf(id)
    for (let k = 1; k <= n; k++) {
      if (k > 1) {
        if (onModel(id)) {
          if (k === 2) await testSignal(page)
          else await act(page, [{ type: 'UNPLUG', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } }])
        } else await act(page, [...STEP_INTENTS[k - 2]])
        await waitStep(page, k, n)
      }
      await expect(page.locator('.oscar-live')).toContainText(`étape ${k} sur ${n}`, { timeout: 15_000 })
      await scan(`package ${id} step ${k} of ${n}`)
      // G14e (review S9): the checklist, on every package, where the package says it is. A docked list (layout.checklist 'panel') is on every page read above and is asserted there; a
      // chip package opens it: at step 4 of the ten (the bench cannot play yet), and on the model at its last step, with the second line cable pulled too (the chip shows while the bench
      // cannot play) and put back after the read, so the step is unchanged.
      if (k === (onModel(id) ? n : 4)) {
        if (packageById(id).layout.checklist === 'panel') await expect(page.getByTestId('project-tree').getByTestId('checklist'), 'the docked checklist is on the page that was read').toBeVisible()
        else {
          const RIGHT = { a: { instance: 'ql1', port: 'out-main-r' }, b: { instance: 'k12-d', port: 'in-line-a' } }
          const pulled = onModel(id) && !(await page.getByTestId('checklist-chip').isVisible())
          if (pulled) await act(page, [{ type: 'UNPLUG', ...RIGHT }])
          await expect(page.getByTestId('checklist-chip'), 'the checklist chip shows (the bench cannot play)').toBeVisible()
          await page.getByTestId('checklist-chip').click()
          await expect(page.getByTestId('checklist')).toBeVisible()
          await scan(`package ${id} checklist open at step ${k}`)
          await page.keyboard.press('Escape')
          if (pulled) await act(page, [connect(RIGHT.a.instance, RIGHT.a.port, RIGHT.b.instance, RIGHT.b.port)])
        }
        counts.checklist++
      }
    }
    // Aide, with a tutorial running (« Reprendre à l’étape k », « Recommencer le tutoriel »)
    await page.locator('#cr-menu-aide').click()
    await expect(page.getByRole('menuitem', { name: /Reprendre à l’étape/ })).toBeVisible()
    await scan(`package ${id} Aide menu`)
    await page.keyboard.press('Escape')
    // the sound (the model's last step is the replug), the closing card, the gear row (profile 3 chose it)
    if (onModel(id)) await act(page, [connect('ql1', 'out-main-l', 'k12-g', 'in-line-a')])
    else await testSignal(page)
    await expect(page.getByTestId('tutorial-closing')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('own-gear')).toBeVisible()
    await scan(`package ${id} closing card and gear row`)
    // the gear row's cards carry no digit, in their text or their accessible name (spec 3)
    const venues = await page.getByTestId('own-gear-venue').evaluateAll((els) => els.map((e) => ({ text: e.textContent ?? '', label: e.getAttribute('aria-label') ?? '', title: e.getAttribute('title') ?? '' })))
    expect(venues.length).toBe(3)
    for (const v of venues) expect(`${v.text} ${v.label} ${v.title}`, 'no digit on a venue card').not.toMatch(/\d/)
    // the scan was not vacuous: it read pages with learner surfaces
    expect(counts.checklist, 'the checklist was read (docked or opened)').toBe(1)
    expect(counts.pages, 'pages read').toBeGreaterThanOrEqual(n + 4)
    expect(counts.strings, 'strings read').toBeGreaterThan(counts.pages * 40)
    expect(counts.learnerStrings, 'learner strings read').toBeGreaterThan(counts.pages * 5)
    expect(errors).toEqual([])
  })
}
