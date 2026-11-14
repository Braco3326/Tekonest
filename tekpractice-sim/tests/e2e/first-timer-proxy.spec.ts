/**
 * T7.2: the scripted route with per-step checks (onboarding packs, plan T7.2, spec 1 and 11.8; the errata of the spec override older text).
 *
 * WHAT THIS IS NOT. It is not a measure of a person. « A complete beginner reaches a first sound in 3 minutes » can only be settled by people (spec 1:
 * five first-timers per package, unaided, timed by the founder). This file counts what a FIRST-TIMER ROUTE COSTS when the route is already known: the
 * actions (clicks, wheel turns, keys) from landing on a package address to the first sound, and the words that route puts in front of the learner. Every
 * time it prints is a « floor for a known route »: a script that knows where everything is, never hesitates, never misreads. A real learner is slower.
 *
 * WHAT IT PROVES. That the tutorial LEADS, not that the script is lucky: at every step the card says « Étape k sur n » and Oscar's bubble says the same
 * step, and the script's next click is the centre of the guide's ring, after checking that the ring is visible, has stopped moving, and that the point
 * under its centre is the thing it rings (an enabled control, or the 3D view for a device), not Oscar, the step card or a dead area. Clicks the ring cannot
 * show by design are named: the drop of a device on the floor (any free floor point of the 3D view), the choice of the port in « Connecter à… » (the first
 * option under the device the bubble names) and, on the port-click route, the two port clicks. Everything else the learner had to find without the ring
 * is an UNLED action: the script does what a learner would do (turn the wheel over Propriétés to the button the bubble names, « Vue d'ensemble » when the
 * device is out of the 3D view or hidden behind a panel, « Inventaire » in an open « Matériel » menu, « Fermer » on the drawer that covers a port), counts
 * it, and lists it. The LED test pins that list exactly (KNOWN_UNLED): green while the known gaps stand, red the day one is fixed (remove its entry) or a
 * new one appears. A step that still does not come after a few clicks is a dead end: the walk fails.
 * The first sound is read from the app's own state after the last action (`audioState()`: playing, the test signal, speaker voices), never from real audio.
 *
 * Routes (1366 x 768, profile « Je découvre », « Faire le tutoriel »):
 *   dialog route (packages 1 to 4): the ten steps, every cable through Propriétés › « Connecter à… » (the route the ring follows, spec 6.3).
 *   port-click route (packages 1 to 4): the same, but each cable by a click on the source port then on the destination port in the 3D view. The 3D
 *     connectors have no DOM, so this route's only « eyes » are two readers of the debug hook (`design()` for the instance ids, `portScreen()` for where a
 *     port is drawn). They cannot act; the source scan below allows them in the port block only.
 *   model route (package 5): the playable model opens cabled and powered; the first sound is step 1 (Écoute › Signal de test). After the first sound the
 *     run goes on through « débrancher » and « rebrancher » and asserts the SIMULATION's voice count (two, one, two; spec 11.8), never shown or said.
 *
 * Budgets (plan T7.2): the dialog route <= 34 actions for packages 1 to 3 (the arithmetic of spec 1: 28 to 34; the plan names the packages). Package 4
 * (the drawer closes after each placement), package 5 and the port-click route: the count of the first green run is recorded (`MEASURED`) and held at
 * measured + 10 %, only ever lowered. Words <= 200 across bubble, card and checklist on every route.
 *
 * Reading model (spec 11.8; a model, never a measure): 0.3 s per word, at least 2 s per bubble that shows new words, 1 s per step-card change, 1.5 s per
 * action. The `PROXY` line of each walk gives the machine time of the script (landing to first sound) plus that modelled time: the « floor for a known
 * route ». No minutes figure is shown in the UI (spec 9); this one goes to the ledger only.
 *
 * How words are counted: every DISTINCT line the route shows in Oscar's bubble, on the step card (its counter and closing lines) and in the checklist (docked
 * or open), counted once, read when the step's ring has settled. The two progress counters (the bubble's « Parcours « Premiers pas » : étape k sur n. »
 * and the card's « Étape k sur n ») are counted once each per route: the learner reads the pattern once, then only the digit, and the model charges every
 * card change 1 s. The raw count of every distinct line (counters included) is printed beside it.
 * G14e (review S4): the sampled reads (each step once the ring has settled, and the end) are no longer the only source: an init script (`watchLines`) keeps a
 * MutationObserver on Oscar's bubble, the step card, the checklist and the dialogs from the first load, and every distinct line that was ever SHOWN there is
 * added to the route at the end (`PROXY-MISSED` lists the lines the sampled reads had missed). So the count is the lines shown, not a lower bound. The
 * « counter once » rule is this file's reading of spec 11.8 (the spec says « Words <= 200 », not how a repeated counter counts): it is NOT in the spec, the count
 * without it is printed as `wordsNoCounterRule` and annotated, and the rule needs an erratum or must go (a controller call, report G14e).
 *
 * No waiting on wall-clock time: every wait is a state wait (a web-first assertion, `expect.poll`, `waitFor`); the ring's « stopped moving » is a sampling of
 * its box (two equal reads 300 ms apart), as `settledIcon` in onboardingKit.ts. Three patience windows, each a state wait with a timeout: a missing ring
 * (RING_BACK_MS) and a ring whose centre is not yet its target (the guide re-reads the page every few seconds) before a remedy or a failure, and the sound
 * after « Signal de test » (SOUND_MS). So the machine time of a route with unled steps includes up to 15 s per missing ring: the floor's machine part is the
 * script's, not a learner's search time. One walk per route (a serial group), then one test per claim.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Browser, Page } from '@playwright/test'
import { DESIGN_IDS, packageById, type DesignId, type StepId } from '../../src/design/packages'
import { COPY } from '../../src/creation/copy'
import { expect, openFresh, PROFILES, start, test, waitStartScreen, waitStep } from './onboardingKit'

const VIEWPORT = { width: 1366, height: 768 }
test.use({ viewport: VIEWPORT })
test.describe.configure({ mode: 'parallel' })

type RouteKind = 'dialog' | 'port' | 'model'
/** Spec 1: the arithmetic of the dialog route with this tutorial is 28 to 34 actions (plan T7.2: packages 1 to 3). */
const DIALOG_BUDGET_ARITHMETIC = 34
/**
 * The measured action counts (plan T7.2: recorded once, then held at measured + 10 %, only ever lowered). Key = `${route} ${package}`. First recorded on
 * HEAD 584bdb5 (report G14c: dialog 4 = 38, port 30 / 29 / 29 / 31, model 4); lowered after the G14c fix round where the fixes removed actions (dialog 4:
 * 38 -> 35, no more « Inventaire » found by hand). Unled actions are included (they are actions the learner makes).
 */
const MEASURED: Record<string, number> = { 'dialog 4': 35, 'port 1': 30, 'port 4': 31, 'model 5': 4 }
/**
 * G14e (review S3): routes whose count cannot be measured today, with why. Port-click 2 and 3 do not reach the first sound (PARKED_ROUTES): their 29 of the
 * first G14c run were counted before the camera change of the G14c fix round and are not a measure of the route as it is; they are recorded again the day the
 * route goes through.
 */
const NOT_MEASURABLE: Record<string, string> = { 'port 2': 'parked: the walk does not reach the first sound', 'port 3': 'parked: the walk does not reach the first sound' }
const WORD_BUDGET = 200
/**
 * The checklist's own words per route (controller ruling, G14c fix f: the route's 200 counts bubble, card and dialog; the checklist docked in Projet, package
 * 2's main presenter, is measured apart and held at measured + 10 %). The chip packages never open it on these routes: 0.
 */
const MEASURED_CHECKLIST: Record<string, number> = { 'dialog 1': 0, 'dialog 2': 129, 'dialog 3': 0, 'dialog 4': 0, 'port 1': 0, 'port 2': 129, 'port 3': 0, 'port 4': 0, 'model 5': 0 }
const actionBudget = (route: RouteKind, id: DesignId): number | undefined => (route === 'dialog' && id <= 3 ? DIALOG_BUDGET_ARITHMETIC : MEASURED[`${route} ${id}`] === undefined ? undefined : Math.floor(MEASURED[`${route} ${id}`] * 1.1))

/**
 * The places where the ring did not show the next action, per route, pinned exactly (an entry fails the day its gap is fixed or a new gap appears). Key =
 * `${route} ${package}`. The G14c fix round removed every gap of the dialog routes and of package 5 (the Propriétés fold, the camera on the mic at step 6, the
 * « Inventaire » item of package 4). What stands is on the port-click route, which the tutorial does not lead for cables (spec 6.3), PARKED (report
 * G14c-fix, item e): with the drawer open a console port lies under it (package 1), or, once the camera has gone to the step's mic, off the view (2, 3).
 */
const DRAWER = (k: number, step: string, port: string): string => `step ${k} (${step}, port-click): the port ${port} is under the open inventory drawer`
/**
 * Whole routes PARKED (report G14c-fix, item e): the walk itself does not reach the first sound. Port-click route, packages 2 and 3: a port click on the console
 * lands on another of its connectors and is refused. G14e measured WHERE, in 6 walks (report G14e): at step 5 (micro-console), the click on the console's in-mic-1
 * after the « Vue d'ensemble » remedy (« Connexion refusée : Prise déjà utilisée » or « … : Connecteurs incompatibles »), 3 times; at step 8 (courant-console), the
 * click on the console's power-in once the drawer is closed (« Connexion refusée : Connecteurs incompatibles »), 3 times. (G14c-fix had named the strip's out-1:
 * the status line read after each click shows it is the console's power-in, the first click of the cable.) Not a tutorial step (the tutorial leads the dialog
 * route); a design call on the port-click route.
 */
const PARKED_REASON = 'G14c-fix e, re-measured G14e: port-click route, a port click on the console lands on another of its connectors and is refused (step 5 in-mic-1, or step 8 power-in)'
/**
 * G14e (review S1): a parked route is no longer « any failure anywhere ». Its walk is run, its error caught, and the PARKED test asserts that the error IS one of the
 * known refusals (`portCable` throws `REFUSED` with the status bar's own text when a port click is refused). Any other failure, at any other step or port, or no
 * failure at all, turns the PARKED test red; the route's other claims are skipped (they cannot be read off a walk that did not reach the sound).
 */
const PARKED_ERROR = (id: DesignId): RegExp =>
  new RegExp(
    `^REFUSED package ${id} step (5 \\(micro-console, port-click\\): the click on yamaha-ql1 in-mic-1|8 \\(courant-console, port-click\\): the click on yamaha-ql1 power-in) was refused: « Connexion refusée : (Prise déjà utilisée|Connecteurs incompatibles) »`,
  )
const PARKED_ROUTES: Record<string, { reason: string; error: RegExp }> = {
  'port 2': { reason: PARKED_REASON, error: PARKED_ERROR(2) },
  'port 3': { reason: PARKED_REASON, error: PARKED_ERROR(3) },
}
const KNOWN_UNLED: Record<string, string[]> = {
  'port 1': [DRAWER(5, 'micro-console', 'yamaha-ql1 in-mic-1'), DRAWER(8, 'courant-console', 'yamaha-ql1 power-in')],
}
/**
 * Word counts over 200 that a known finding explains (report G14c-fix, re-measured G14e). G14e (review S2): no `test.fail`. A route listed here is asserted
 * over 200 (the finding still stands: the day it is back under, the test is red and the entry goes) AND under its measured ceiling (it may not grow unseen).
 */
/**
 * G14e, re-measured with the line observer (S4): the sampled reads had missed one bubble line on every ten-step route, « Hors de vue pour le moment : le bouton
 * « Vue d’ensemble » (⌂) montre toute la pièce. » (14 words, oscar.notOnScreen), shown for a moment while the camera brings the step's device into view. Dialog
 * routes 280 -> 294; port-click routes 189 -> 203, over the 200 now.
 */
const DIALOG_TEXT =
  'the four « Connecter à… » dialogs add 91 words (their body read whole once, 17 words of keyboard instructions, then the port it starts from each time, plus the device group and the option chosen) and the bubble’s « Hors de vue pour le moment… » line 14; without them the route is 189. COPY connect.* and oscar.notOnScreen are not this task’s (tekuxwriter call)'
const NOT_ON_SCREEN_TEXT =
  'the bubble’s « Hors de vue pour le moment : le bouton « Vue d’ensemble » (⌂) montre toute la pièce. » (14 words, oscar.notOnScreen), shown for a moment while the camera brings the step’s device into view; without it the route is 189'
const KNOWN_WORDS: Record<string, { finding: string; ceiling: number }> = {
  'dialog 1': { finding: DIALOG_TEXT, ceiling: 294 },
  'dialog 2': { finding: DIALOG_TEXT, ceiling: 294 },
  'dialog 3': { finding: DIALOG_TEXT, ceiling: 294 },
  'dialog 4': { finding: DIALOG_TEXT, ceiling: 294 },
  'port 1': { finding: NOT_ON_SCREEN_TEXT, ceiling: 203 },
  'port 4': { finding: NOT_ON_SCREEN_TEXT, ceiling: 203 },
}

const stepsOf = (id: DesignId): readonly StepId[] => packageById(id).pacing.steps
const onModel = (id: DesignId): boolean => packageById(id).layout.start === 'playable-model'

// ── what the route reads ────────────────────────────────────────────────────────────────────────────────────────────────────────

const wordsIn = (s: string): number => s.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length
/** The progress counters (counted once per route each, see the header). */
const COUNTER = /^(Parcours « [^»]+ » : étape \d+ sur \d+\.|Étape \d+ sur \d+)$/
const counterKind = (line: string): string => line.split(' ')[0]

/** Where a line was read. The route's 200 counts bubble, card and dialog (the connect dialog's own text); the docked checklist has its own budget. */
type Presenter = 'bubble' | 'card' | 'dialog' | 'checklist'
/** « Connecter à… »'s body, a template around the port it starts from: read whole once, then only its port (the instructions are the same). */
const DIALOG_BODY = new RegExp(
  '^' +
    (COPY.connect?.body ?? '')
      .split('{port}')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('(.+?)') +
    '$',
)

interface Route {
  kind: RouteKind
  id: DesignId
  actions: string[]
  /** Every distinct line read, with the presenter it came from. */
  lines: Map<string, Presenter>
  /** Modelled reading time so far (s), without the actions and the card changes. */
  readingS: number
  cardChanges: number
  /** The actions the ring did not show (see `lookForIt`): each is a place where the tutorial did not lead. */
  unled: string[]
  t0: number
}
const newRoute = (kind: RouteKind, id: DesignId): Route => ({ kind, id, actions: [], lines: new Map(), readingS: 0, cardChanges: 0, unled: [], t0: Date.now() })

/** What Oscar's bubble, the step card (counter and closing lines) and the checklist show now (visible text only). */
const presenters = (page: Page) =>
  page.evaluate(() => {
    const shown = (el: Element | null): el is HTMLElement => el instanceof HTMLElement && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && el.closest('[hidden]') === null
    const lines = (sel: string): string[] => [...document.querySelectorAll(sel)].filter(shown).map((e) => (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim()).filter((t) => t !== '')
    const checklist = document.querySelector('[data-testid="checklist"]')
    return {
      bubble: lines('.oscar-bubble .oscar-live .oscar-sub, .oscar-bubble .oscar-live .oscar-line'),
      card: lines('[data-testid="tutorial-step-count"], [data-testid="tutorial-closing"] p, [data-testid="tutorial-closing"] li'),
      checklist: shown(checklist) ? checklist.innerText.split('\n').map((t) => t.replace(/\s+/g, ' ').trim()).filter((t) => t !== '') : [],
    }
  })

/** The presenters the observer watches (the same selectors as `presenters`, plus the dialogs' title and body; the options are read by `chooseIn`, only the one chosen). */
const WATCHED = {
  bubble: '.oscar-bubble .oscar-live .oscar-sub, .oscar-bubble .oscar-live .oscar-line',
  card: '[data-testid="tutorial-step-count"], [data-testid="tutorial-closing"] p, [data-testid="tutorial-closing"] li',
  dialog: '[role="dialog"] .cr-dialog-title, [role="dialog"] .cr-dialog-body',
}
/**
 * G14e (review S4): from the first load, a MutationObserver on the page records every distinct line that is ever SHOWN in the bubble, on the card, in the
 * checklist and in a dialog's title and body (`window.__shownLines`, in the order shown). A DOM reader in the page, set before the app runs: it never acts.
 */
const watchLines = (page: Page): Promise<unknown> =>
  page.addInitScript((sel) => {
    const w = window as unknown as { __shownLines: [string, string][] }
    w.__shownLines = []
    const seen = new Set<string>()
    const shown = (el: Element | null): el is HTMLElement => el instanceof HTMLElement && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && el.closest('[hidden]') === null
    const note = (at: string, t: string): void => {
      const line = t.replace(/\s+/g, ' ').trim()
      if (line === '' || seen.has(line)) return
      seen.add(line)
      w.__shownLines.push([at, line])
    }
    const collect = (): void => {
      for (const [at, s] of Object.entries(sel)) for (const e of document.querySelectorAll(s)) if (shown(e)) note(at, e.innerText)
      const list = document.querySelector('[data-testid="checklist"]')
      if (shown(list)) for (const t of list.innerText.split('\n')) note('checklist', t)
    }
    let queued = false
    const schedule = (): void => {
      if (queued) return
      queued = true
      setTimeout(() => {
        queued = false
        collect()
      }, 0)
    }
    const start = (): void => new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'class', 'style', 'open'] })
    if (document.documentElement) start()
    else document.addEventListener('DOMContentLoaded', start)
  }, WATCHED)

/** Reads the presenters into the route: new lines are words to read (the model: at least 2 s for a bubble with new words, 0.3 s per word elsewhere). */
async function read(page: Page, r: Route): Promise<void> {
  const p = await presenters(page)
  let bubbleNew = 0
  for (const [where, list] of [['bubble', p.bubble], ['card', p.card], ['checklist', p.checklist]] as const)
    for (const line of list) {
      if (r.lines.has(line)) continue
      const counted = COUNTER.test(line) && [...r.lines.keys()].some((l) => COUNTER.test(l) && counterKind(l) === counterKind(line)) ? 0 : wordsIn(line)
      r.lines.set(line, where)
      if (where === 'bubble') bubbleNew += counted
      else r.readingS += 0.3 * counted
    }
  if (bubbleNew > 0) r.readingS += Math.max(2, 0.3 * bubbleNew)
}
/**
 * Words of the route: `counted` = bubble, card and dialog (each counter once; the dialog's body whole once, then only its port), `checklist` = the docked or
 * opened checklist's distinct lines (its own budget, controller ruling G14c fix f), `raw` = every distinct line of every presenter.
 */
function words(r: Route): { counted: number; checklist: number; raw: number; noCounterRule: number } {
  let counted = 0
  let checklist = 0
  let raw = 0
  let repeatedCounters = 0
  const seen = new Set<string>()
  let bodyRead = false
  for (const [line, at] of r.lines) {
    raw += wordsIn(line)
    if (at === 'checklist') {
      checklist += wordsIn(line)
      continue
    }
    if (COUNTER.test(line)) {
      if (seen.has(counterKind(line))) {
        repeatedCounters += wordsIn(line)
        continue
      }
      seen.add(counterKind(line))
    }
    const body = at === 'dialog' ? DIALOG_BODY.exec(line) : null
    if (body !== null && bodyRead) {
      counted += wordsIn(body[1])
      continue
    }
    if (body !== null) bodyRead = true
    counted += wordsIn(line)
  }
  return { counted, checklist, raw, noCounterRule: counted + repeatedCounters }
}
/** A line read in a dialog (no bubble minimum: 0.3 s per new word). */
function readLine(r: Route, line: string, at: Presenter): void {
  const t = line.replace(/\s+/g, ' ').trim()
  if (t === '' || r.lines.has(t)) return
  r.lines.set(t, at)
  r.readingS += 0.3 * wordsIn(t)
}

// ── what the screen offers ──────────────────────────────────────────────────────────────────────────────────────────────────────

interface Hit {
  kind: 'view' | 'control' | 'guide' | 'card' | 'other' | 'none'
  name: string
  disabled: boolean
  /** The control is a menu-bar button whose menu is open. */
  menuOpen: boolean
  /** The control is in the inventory drawer. */
  inDrawer: boolean
}
/** What a click at (x, y) would land on: the 3D view, a control (enabled or not), or something that is not the target (Oscar, the card, a dead area). */
const hitAt = (page: Page, x: number, y: number): Promise<Hit> =>
  page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      const name = (e: Element): string => (e.getAttribute('aria-label') ?? (e as HTMLElement).innerText ?? e.tagName).replace(/\s+/g, ' ').trim().slice(0, 50)
      const plain = { disabled: false, menuOpen: false, inDrawer: false }
      if (el === null) return { kind: 'none' as const, name: '', ...plain }
      if (el.closest('[data-oscar-root], .oscar-guide') !== null) return { kind: 'guide' as const, name: name(el), ...plain }
      if (el.closest('[data-testid="tutorial-slot"], [data-testid="gear-slot"]') !== null) return { kind: 'card' as const, name: name(el), ...plain }
      if (el.id === 'renderCanvas') return { kind: 'view' as const, name: 'the 3D view', ...plain }
      const inDrawer = el.closest('[data-testid="inventory-drawer"]') !== null
      const c = el.closest('button, a[href], input, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [role="checkbox"], [data-testid="inventory-item"]')
      if (c === null) return { kind: 'other' as const, name: `${el.tagName.toLowerCase()} ${name(el)}`, ...plain, inDrawer }
      return {
        kind: 'control' as const,
        name: name(c),
        disabled: c.matches(':disabled') || c.getAttribute('aria-disabled') === 'true',
        menuOpen: c.closest('.cr-menu-top, [role="menubar"]') !== null && c.getAttribute('aria-expanded') === 'true',
        inDrawer,
      }
    },
    { x, y },
  )

const ring = (page: Page) => page.locator('.oscar-ring:not(.oscar-ring-drop)')
type Box = { x: number; y: number; width: number; height: number }
const boxKey = (b: Box | null): string => (b === null ? '' : [b.x, b.y, b.width, b.height].map(Math.round).join(','))
const centreOf = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })
const ringShown = (page: Page, ms: number): Promise<boolean> =>
  ring(page)
    .waitFor({ state: 'visible', timeout: ms })
    .then(
      () => true,
      () => false,
    )

/** The ring is visible and has stopped moving (two equal reads 300 ms apart: a sampling, not a sleep). Returns its box. */
async function settledRing(page: Page, label: string): Promise<Box> {
  await expect(ring(page), `${label}: the guide rings what to do next`).toBeVisible({ timeout: 20_000 })
  let last = ''
  const trail: string[] = []
  const settled = await expect
    .poll(
      async () => {
        const now = boxKey(await ring(page).boundingBox())
        const stable = now !== '' && now === last
        last = now
        trail.push(now || 'hidden')
        if (!stable) await page.waitForTimeout(300)
        return stable
      },
      { timeout: 20_000 },
    )
    .toBe(true)
    .then(
      () => true,
      () => false,
    )
  expect(settled, `${label}: the ring never stopped moving (last boxes: ${trail.slice(-8).join(' | ')})`).toBe(true)
  return (await ring(page).boundingBox())!
}

/** Records an action the ring did not show. */
const unled = (r: Route, label: string, action: string, why: string): void => {
  r.actions.push(`${label}: UNLED ${action}`)
  r.unled.push(`step ${label.match(/step (\d+ \([^)]*\))/)?.[1] ?? label}: ${why}`)
}
/**
 * A click on a control the learner found without the ring (a remedy): at its centre, or, when something covers the centre, at the first visible point of
 * its box (a learner clicks the part of a label they can see). Returns a note when the centre was covered (by Oscar, say): that is part of the finding.
 * No visible point at all fails.
 */
async function clickControl(page: Page, label: string, b: Box): Promise<string> {
  const points = [[0.5, 0.5], [0.2, 0.5], [0.8, 0.5], [0.5, 0.25], [0.5, 0.75], [0.1, 0.5], [0.9, 0.5]] as const
  const centre = await hitAt(page, b.x + b.width / 2, b.y + b.height / 2)
  for (const [fx, fy] of points) {
    const x = b.x + b.width * fx
    const y = b.y + b.height * fy
    if ((await hitAt(page, x, y)).kind !== 'control') continue
    await page.mouse.click(x, y)
    if (centre.kind !== 'control') console.log(`PROXY-NOTE ${label}: the centre is under ${centre.kind} « ${centre.name} »`)
    return centre.kind === 'control' ? '' : centre.kind === 'guide' ? ' (its centre is under Oscar)' : ' (its centre is covered)'
  }
  throw new Error(`${label}: the control is covered by ${centre.kind} « ${centre.name} » at every point tried`)
}

/**
 * The Propriétés button each step's bubble names: where a learner looks when the ring is gone because its target is below the panel's fold.
 */
const PROPS = '[data-testid="properties-content"]'
const NAMED: Partial<Record<StepId, { target: string; what: string }>> = {
  'console-enceinte': { target: `${PROPS} [data-key="connect:out-main-l"]`, what: '« Connecter à… » of the main output' },
  'micro-console': { target: `${PROPS} [data-key="connect:out-xlr"]`, what: '« Connecter à… » of the mic output' },
  'courant-console': { target: `${PROPS} [data-key="connect:power-in"]`, what: '« Connecter à… » of the mains inlet' },
  'courant-enceinte': { target: `${PROPS} [data-key="connect:power-in"]`, what: '« Connecter à… » of the mains inlet' },
  'lecture-console': { target: `${PROPS} [data-key="ctl:playback-usb"]`, what: '« Lecture console »' },
  debrancher: { target: `${PROPS} [data-key^="unplug:out-main"]`, what: '« Débrancher » of a main output' },
  rebrancher: { target: `${PROPS} [data-key^="connect:out-main"]`, what: '« Connecter à… » of the freed main output' },
}

/** The wheel over Propriétés until the button the bubble names is in view (one gesture, one action). False when it is not in Propriétés or already in view. */
async function scrollToIt(page: Page, r: Route, label: string, step: StepId): Promise<boolean> {
  const named = NAMED[step]
  if (named === undefined) return false
  const target = page.locator(named.target).first()
  if ((await target.count()) === 0) return false
  const inView = async (): Promise<boolean> => {
    const b = await target.boundingBox()
    return b !== null && b.y >= 0 && b.y + b.height <= VIEWPORT.height && (await hitAt(page, centreOf(b).x, centreOf(b).y)).kind === 'control'
  }
  if (await inView()) return false
  const panel = (await page.getByTestId('properties-content').boundingBox())!
  await page.mouse.move(panel.x + panel.width / 2, panel.y + Math.min(panel.height / 2, 200))
  for (let i = 0; i < 12 && !(await inView()); i++) {
    const before = boxKey(await target.boundingBox())
    await page.mouse.wheel(0, 200)
    await expect.poll(async () => boxKey(await target.boundingBox()), { timeout: 5_000 }).not.toBe(before) // the panel answered the wheel (a state read)
  }
  expect(await inView(), `${label}: ${named.what} never came into view by scrolling Propriétés`).toBe(true)
  unled(r, label, `wheel over Propriétés to ${named.what}`, `${named.what} is below the fold of Propriétés: no ring`)
  return true
}

/** « Vue d'ensemble » in the view cube: the whole room, so the device the step names is on screen again. */
async function overview(page: Page, r: Route, label: string, why: string): Promise<boolean> {
  const home = page.getByRole('button', { name: 'Vue d’ensemble', exact: true })
  if (!(await home.isVisible())) return false
  const note = await clickControl(page, `${label} « Vue d'ensemble »`, (await home.boundingBox({ timeout: 10_000 }))!)
  unled(r, label, '« Vue d’ensemble »', `${why}; « Vue d’ensemble »${note}`)
  return true
}

/**
 * The ring is gone and does not come back after a state wait, or the thing under its centre is not what it rings: what a learner does to find what the
 * bubble names. Each remedy is UNLED (counted and listed). False when no remedy applies (the walk then fails on the missing or covered ring).
 */
async function lookForIt(page: Page, r: Route, label: string, step: StepId, attempt: Set<string>): Promise<boolean> {
  if (!(await ring(page).isVisible())) {
    if (await ringShown(page, RING_BACK_MS)) return true // it came back on its own (the guide re-reads the page every few seconds)
    if (await scrollToIt(page, r, label, step)) return true
    if (attempt.has('overview')) return false
    attempt.add('overview')
    // the device is out of the 3D view (the camera stayed on the device selected before; Oscar says « Cet élément n'est pas visible à l'écran »)
    return overview(page, r, label, 'the device the step names is out of the 3D view: no ring')
  }
  const { hit } = await ringTarget(page, label)
  if (hit.kind === 'control' && hit.menuOpen) {
    // the ring stays on the menu-bar button whose menu is open (« Matériel »): the learner reads step 1's « Ouvrez Matériel, puis Inventaire »
    const item = page.getByRole('menuitem', { name: /^Inventaire/ })
    if (!(await item.isVisible()) || attempt.has('menu')) return false
    attempt.add('menu')
    const note = await clickControl(page, `${label} « Inventaire »`, (await item.boundingBox({ timeout: 10_000 }))!)
    unled(r, label, '« Inventaire » in the open menu', `the ring stays on « ${hit.name} » with its menu open: « Inventaire » is not ringed${note}`)
    return true
  }
  if (hit.kind === 'other' || hit.kind === 'none') {
    // the ring is on a device the panels hide (its point is under a side panel): the whole room brings it into the view
    if (attempt.has('overview')) return false
    attempt.add('overview')
    console.log(`PROXY-NOTE ${label}: the ring's centre is under « ${hit.name} »`)
    return overview(page, r, label, `the ring's centre is on a panel over the device: no reachable ring`)
  }
  return false
}

/**
 * The settled ring and what is under its centre. When that is not the thing it rings (a list's padding while the drawer lays out, a panel), the guide may
 * still catch up (it re-reads the page every few seconds): that is waited for as a state, up to RING_BACK_MS, before the caller judges it.
 */
async function ringTarget(page: Page, label: string): Promise<{ b: Box; hit: Hit }> {
  let b = await settledRing(page, label)
  let hit = await hitAt(page, centreOf(b).x, centreOf(b).y)
  if (hit.kind === 'view' || hit.kind === 'control') return { b, hit }
  const caughtUp = await expect
    .poll(
      async () => {
        const now = await ring(page).boundingBox()
        if (now === null) return false
        const h = await hitAt(page, centreOf(now).x, centreOf(now).y)
        return h.kind === 'view' || h.kind === 'control'
      },
      { timeout: RING_BACK_MS },
    )
    .toBe(true)
    .then(
      () => true,
      () => false,
    )
  if (caughtUp && (await ring(page).isVisible())) {
    b = await settledRing(page, label)
    hit = await hitAt(page, centreOf(b).x, centreOf(b).y)
  }
  return { b, hit }
}

/** A click on the centre of the ring, checked first: the 3D view or an enabled control (a greyed control is waited for as a state, then must be enabled). */
async function clickRing(page: Page, r: Route, label: string): Promise<string> {
  const { b, hit } = await ringTarget(page, label)
  const { x, y } = centreOf(b)
  expect(['view', 'control'], `${label}: under the ring's centre (${Math.round(x)}, ${Math.round(y)}) is ${hit.kind} « ${hit.name} », not the thing it rings`).toContain(hit.kind)
  if (hit.kind === 'control') await expect.poll(async () => (await hitAt(page, x, y)).disabled, { message: `${label}: « ${hit.name} » stays disabled`, timeout: 30_000 }).toBe(false)
  await page.mouse.click(x, y)
  r.actions.push(`${label}: ring -> ${hit.kind === 'view' ? 'the 3D view' : `« ${hit.name} »`}`)
  return boxKey(b)
}

/**
 * How long a missing ring is waited for (a state wait) before the learner's remedy: the guide re-reads the page every 5 s (its obstacle and anchor resync), so
 * two re-reads and a margin; on six parallel browsers a re-read and the sound's start come seconds late (G14a « Environment stalls »).
 */
const RING_BACK_MS = 15_000
/** How long the sound may take to start after « Signal de test » (the same 45 s as the first-sound read below would allow, state wait). */
const SOUND_MS = 45_000
const menuOpen = async (page: Page): Promise<boolean> => (await page.locator('.cr-menu-top[aria-expanded="true"]').count()) > 0

/**
 * Clicks what the ring shows until `done` holds (at most `max` clicks on the ring: more is a dead end). Before each click, a missing or unreachable ring
 * gets the learner's remedy (`lookForIt`, UNLED). After each click the page must answer: `done`, the ring moved, or a menu opened (a state wait).
 */
async function followRing(page: Page, r: Route, label: string, step: StepId, done: () => Promise<boolean>, max = 4): Promise<void> {
  const tried = new Set<string>()
  for (let i = 0; i < max; i++) {
    if (await done()) return
    for (let k = 0; k < 3 && (await lookForIt(page, r, label, step, tried)); k++) if (await done()) return
    if (await done()) return
    const before = await clickRing(page, r, `${label} (click ${i + 1})`)
    await expect
      .poll(async () => (await done()) || boxKey(await ring(page).boundingBox()) !== before || (await menuOpen(page)), { message: `${label}: the click on the ring changed nothing`, timeout: 20_000 })
      .toBe(true)
    // the ring went away with the click (« Signal de test » closes its menu; the sound starts once the scene's models are in, seconds later under load):
    // the step's own completion, or the ring back, is waited for as a state before anything else is tried
    if (/« Signal de test »$/.test(r.actions[r.actions.length - 1])) {
      // the learner asked for the sound: they wait for it (the ring goes back to « Écoute » while the scene's models land, seconds under load)
      await expect.poll(done, { message: `${label}: the test signal never started after « Signal de test »`, timeout: SOUND_MS }).toBe(true)
      return
    }
    if (!(await done()) && !(await ring(page).isVisible())) await expect.poll(async () => (await done()) || (await ring(page).isVisible()), { timeout: RING_BACK_MS }).toBe(true).catch(() => undefined)
  }
  expect(await done(), `${label}: ${max} clicks on what the ring showed and still not there (a dead end)`).toBe(true)
}

/** The step has moved on: the card's counter or Oscar's bubble no longer says step k (the card can follow the guide by a moment). */
const movedOn = (page: Page, k: number, n: number) => async (): Promise<boolean> => {
  if (await page.getByTestId('tutorial-closing').isVisible()) return true
  const card = (await page.getByTestId('tutorial-step-count').textContent()) ?? ''
  const live = (await page.locator('.oscar-live').textContent()) ?? ''
  return card !== `Étape ${k} sur ${n}` || !live.includes(`étape ${k} sur ${n}`)
}
const placing = (page: Page) => page.getByTestId('status-snapping').isVisible()

/**
 * Free floor points of the 3D view (shares of `.cr-viewport`), in the order the script drops devices: apart from each other, in the lower half of the
 * view (the floor of the first room's framing). The first one whose point is the 3D view itself (not Oscar, not a panel) is used.
 */
const FLOOR = [
  [0.5, 0.62],
  [0.3, 0.72],
  [0.7, 0.72],
  [0.5, 0.84],
  [0.2, 0.86],
  [0.8, 0.86],
] as const

/** Drops the device in hand on a free floor point (the click the ring cannot show). */
async function drop(page: Page, r: Route, label: string, used: Set<number>): Promise<void> {
  const view = (await page.locator('.cr-viewport').boundingBox())!
  for (let i = 0; i < FLOOR.length; i++) {
    if (used.has(i)) continue
    const x = view.x + view.width * FLOOR[i][0]
    const y = view.y + view.height * FLOOR[i][1]
    if ((await hitAt(page, x, y)).kind !== 'view') continue
    used.add(i)
    await page.mouse.move(x, y, { steps: 4 }) // the ghost follows the pointer (a move is not an action)
    await page.mouse.click(x, y)
    r.actions.push(`${label}: drop on the floor (${FLOOR[i].join(', ')})`)
    return
  }
  throw new Error(`${label}: no free floor point left in the view`)
}

/** In « Connecter à… »: the first option under the device the bubble names (the choice the ring cannot show). */
async function chooseIn(page: Page, r: Route, label: string, device: RegExp): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Connecter à…' })
  await expect(dialog, `${label}: « Connecter à… » is open`).toBeVisible()
  const group = dialog.getByRole('group').filter({ has: page.locator('.cr-connect-group-title', { hasText: device }) }).first()
  const option = group.getByRole('option').first()
  await expect(option, `${label}: the dialog offers a port of ${device}`).toBeVisible()
  // what the learner reads to choose: the title, the body (the port it starts from), the group of the device the bubble names, the option
  for (const sel of ['.cr-dialog-title', '.cr-dialog-body']) for (const t of await dialog.locator(sel).allInnerTexts()) readLine(r, t, 'dialog')
  readLine(r, await group.locator('.cr-connect-group-title').innerText(), 'dialog')
  readLine(r, await option.innerText(), 'dialog')
  const name = (await option.getAttribute('aria-label')) ?? ''
  await option.click()
  r.actions.push(`${label}: dialog option « ${name} »`)
  await expect(dialog).toBeHidden()
}

/** The device each cable step's bubble names (the dialog group to choose in). */
const GROUP: Partial<Record<StepId, RegExp>> = {
  'console-enceinte': /K12/,
  'micro-console': /QL1/,
  'courant-console': /[Mm]ultiprise/,
  'courant-enceinte': /[Mm]ultiprise/,
  rebrancher: /K12/,
}
/** The cables of the port-click route, by step: (device, port) to (device, port), the tutorial's own pair ends (src/guide/tutorial.ts PAIR_ENDS). */
const PORTS: Partial<Record<StepId, { from: [string, string]; to: [string, string] }>> = {
  'console-enceinte': { from: ['yamaha-ql1', 'out-main-l'], to: ['qsc-k12-2', 'in-line-a'] },
  'micro-console': { from: ['shure-sm58', 'out-xlr'], to: ['yamaha-ql1', 'in-mic-1'] },
  'courant-console': { from: ['yamaha-ql1', 'power-in'], to: ['multiprise-secteur', 'out-1'] },
  'courant-enceinte': { from: ['qsc-k12-2', 'power-in'], to: ['multiprise-secteur', 'out-2'] },
}
const PLACE: readonly StepId[] = ['console', 'micro', 'enceinte', 'multiprise']

type Cable = (k: number, step: StepId) => Promise<void>

// ── ROUTE: BEGIN (read by the source scan below: no debug-hook use between these markers, except the port-click route's two readers in its own block) ──

/** Landing on the package address, the start screen: « Je découvre », then « Faire le tutoriel » (two clicks), each checked as offered. */
async function landAndStart(page: Page, r: Route): Promise<void> {
  const n = stepsOf(r.id).length
  const profile = start(page).getByRole('button', { name: PROFILES[0].label, exact: true })
  await expect(profile, 'the start screen offers the profiles').toBeVisible()
  await profile.click()
  r.actions.push('start screen: « Je découvre »')
  const offer = start(page).getByRole('button', { name: /^Faire le tutoriel/ })
  await expect(offer, 'the offer names the run length').toContainText(`${n} étapes`)
  await expect(offer).toBeEnabled()
  await offer.click()
  r.actions.push('start screen: « Faire le tutoriel »')
  await expect(page.getByTestId('tutorial-card'), 'the tutorial runs').toBeVisible({ timeout: 20_000 })
}

/** One tutorial step, led by the ring: checked as shown (card and bubble), read, done, and checked as completed. */
async function doStep(page: Page, r: Route, k: number, step: StepId, used: Set<number>, cable: Cable): Promise<void> {
  const n = stepsOf(r.id).length
  const label = `package ${r.id} step ${k} (${step})`
  await waitStep(page, k, n) // the card AND Oscar's bubble say step k
  // the learner reads once the guide has settled on the step (its ring at rest; a missing ring is the business of the step below)
  if (await ringShown(page, 8_000)) await settledRing(page, label)
  await read(page, r)
  const advanced = movedOn(page, k, n)
  if (PLACE.includes(step)) {
    await followRing(page, r, label, step, () => placing(page)) // the tab, then the card: the device follows the pointer
    await drop(page, r, label, used)
  } else if (GROUP[step] !== undefined) {
    await cable(k, step)
  } else {
    // « Lecture console », Écoute › Signal de test, « Débrancher » (after « Signal de test » `followRing` waits for the sound itself, see there)
    await followRing(page, r, label, step, advanced)
  }
  await expect.poll(advanced, { message: `${label}: the step never completed`, timeout: 30_000 }).toBe(true)
  r.cardChanges++
}

/** The dialog route's cable: the ring (the device, then « Connecter à… »), then the option under the device the bubble names. */
const dialogCable =
  (page: Page, r: Route): Cable =>
  async (k, step) => {
    const label = `package ${r.id} step ${k} (${step})`
    const dialog = page.getByRole('dialog', { name: 'Connecter à…' })
    await followRing(page, r, label, step, () => dialog.isVisible())
    await chooseIn(page, r, label, GROUP[step]!)
  }

/** The ten-step route (packages 1 to 4) up to the action that starts the first sound. */
async function tenSteps(page: Page, r: Route, cable: Cable): Promise<void> {
  await landAndStart(page, r)
  const used = new Set<number>()
  const steps = stepsOf(r.id)
  for (let k = 1; k <= steps.length; k++) await doStep(page, r, k, steps[k - 1], used, cable)
}

// ── PORT EYES: BEGIN (the only debug-hook use allowed in the route: `design()` and `portScreen()`, readers) ──
/**
 * The port-click route's cable: a click on the source port, then on the destination port, in the 3D view (no dialog). A port under the open inventory
 * drawer: the learner closes the drawer first (« Fermer », UNLED).
 */
const portCable =
  (page: Page, r: Route): Cable =>
  async (k, step) => {
    const label = `package ${r.id} step ${k} (${step}, port-click)`
    await settledRing(page, label) // the guide shows this step (it rings the source device)
    const cable = PORTS[step]!
    for (const [deviceId, port] of [cable.from, cable.to]) {
      const where = () =>
        page.evaluate(
          ([d, p]) => {
            const inst = window.__creation!.design().rig.instances.find((i) => i.deviceId === d)
            return inst === undefined ? null : window.__creation!.portScreen({ instance: inst.instanceId, port: p })
          },
          [deviceId, port],
        )
      let at = await where()
      expect(at, `${label}: ${deviceId} ${port} is drawn on screen`).not.toBeNull()
      let hit = await hitAt(page, at!.x, at!.y)
      if (hit.inDrawer) {
        const close = page.getByTestId('inventory-close')
        const note = await clickControl(page, `${label} drawer « Fermer »`, (await close.boundingBox({ timeout: 10_000 }))!)
        unled(r, label, 'drawer « Fermer »', `the port ${deviceId} ${port} is under the open inventory drawer${note}`)
        await expect(page.getByTestId('inventory-drawer')).not.toHaveAttribute('data-open', 'true')
        at = await where()
        hit = await hitAt(page, at!.x, at!.y)
      }
      if (hit.kind === 'none' || hit.kind === 'other') {
        // the port is off the 3D view, or under a side panel (the camera went to the step's other device): the whole room first (UNLED)
        if (await overview(page, r, label, `the port ${deviceId} ${port} is off the 3D view`)) {
          await expect.poll(async () => (await hitAt(page, (await where())!.x, (await where())!.y)).kind, { timeout: RING_BACK_MS }).toBe('view').catch(() => undefined)
          at = await where()
          hit = await hitAt(page, at!.x, at!.y)
        }
      }
      expect(hit.kind, `${label}: the port ${deviceId} ${port} at (${Math.round(at!.x)}, ${Math.round(at!.y)}) is covered by ${hit.kind} « ${hit.name} »`).toBe('view')
      const statusNow = async (): Promise<string> => ((await page.locator('.cr-status-msg').textContent()) ?? '').replace(/\s+/g, ' ').trim()
      const before = await statusNow()
      await page.mouse.click(at!.x, at!.y)
      r.actions.push(`${label}: port ${deviceId} ${port}`)
      // S1: a refused click is named with the status bar's own text (what the learner reads), so a parked route fails on THIS, never on whatever comes next.
      // The status line answers a click (a state wait, up to 3 s; a click that changes nothing there goes on)
      await expect.poll(statusNow, { timeout: 3_000 }).not.toBe(before).catch(() => undefined)
      const status = await statusNow()
      if (/refusé/i.test(status)) throw new Error(`REFUSED ${label}: the click on ${deviceId} ${port} was refused: « ${status} » (status before the click: « ${before} »; the last actions: ${r.actions.slice(-4).join(" | ")})`)
    }
  }
// ── PORT EYES: END ──

/** The model route (package 5) up to the action that starts the first sound: the start screen, then step 1 (Écoute › Signal de test). */
async function modelFirstSound(page: Page, r: Route): Promise<void> {
  await landAndStart(page, r)
  await doStep(page, r, 1, stepsOf(r.id)[0], new Set(), dialogCable(page, r))
}

// ── ROUTE: END ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

interface Walk {
  route: Route
  voices: string[]
  closing: boolean
  line: Record<string, unknown>
  words: { counted: number; checklist: number; raw: number; noCounterRule: number }
  /** Package 5 after the first sound: the voice counts after « débrancher » and « rebrancher », the closing card, the unled actions. */
  after?: { unplugged: number; replugged: number; closing: boolean; unled: string[]; actions: string[] }
}

/** The `PROXY` line (the ledger's « floor for a known route »). */
async function summary(page: Page, r: Route): Promise<Pick<Walk, 'line' | 'words'>> {
  const machineS = (Date.now() - r.t0) / 1000
  await read(page, r) // what the first sound shows (the closing lines, Oscar's last bubble)
  // S4: every line the observer saw shown that the sampled reads missed (a bubble that changed between two reads, a line shown for a moment)
  const shownLines = await page.evaluate(() => (window as unknown as { __shownLines?: [string, string][] }).__shownLines ?? null)
  expect(shownLines, 'the line observer ran on this page').not.toBeNull()
  const missed = shownLines!.filter(([, t]) => !r.lines.has(t))
  for (const [at, t] of missed) {
    r.lines.set(t, at as Presenter)
    r.readingS += at === 'bubble' ? Math.max(2, 0.3 * wordsIn(t)) : 0.3 * wordsIn(t)
  }
  console.log('PROXY-MISSED', r.kind, r.id, JSON.stringify(missed))
  const w = words(r)
  const modelledS = r.readingS + r.cardChanges * 1 + r.actions.length * 1.5
  const line = {
    route: r.kind,
    package: r.id,
    actions: r.actions.length,
    unled: r.unled.length,
    words: w.counted,
    wordsNoCounterRule: w.noCounterRule,
    wordsRaw: w.raw,
    missedBySampling: missed.length,
    checklistWords: w.checklist,
    byPresenter: Object.fromEntries((['bubble', 'card', 'dialog', 'checklist'] as const).map((p) => [p, [...r.lines].filter(([, at]) => at === p).reduce((s, [l]) => s + wordsIn(l), 0)])),
    cardChanges: r.cardChanges,
    machineS: Math.round(machineS * 10) / 10,
    modelledS: Math.round(modelledS * 10) / 10,
    floorForAKnownRouteS: Math.round((machineS + modelledS) * 10) / 10,
  }
  console.log('PROXY', JSON.stringify(line))
  console.log('PROXY-ACTIONS', r.kind, r.id, JSON.stringify(r.actions))
  console.log('PROXY-LINES', r.kind, r.id, JSON.stringify([...r.lines.keys()]))
  console.log('PROXY-UNLED', r.kind, r.id, JSON.stringify(r.unled))
  // PROXY_OUT (a folder, optional): the whole walk as JSON, for the report (the console wraps long lines)
  if (process.env.PROXY_OUT) writeFileSync(join(process.env.PROXY_OUT, `proxy-${r.kind}-${r.id}-${Date.now()}.json`), JSON.stringify({ line, actions: r.actions, unled: r.unled, lines: [...r.lines] }, null, 1))
  return { line, words: w }
}

/** The first sound, read from the app's own state AFTER the last action: playing, the test signal; returns the speaker voices. */
async function firstSound(page: Page): Promise<string[]> {
  await page.waitForFunction(() => window.__creation!.audioState().state === 'playing' && window.__creation!.audioState().source === 'test', null, { timeout: SOUND_MS })
  return page.evaluate(() => window.__creation!.audioState().voices.map((v) => v.instanceId))
}

/** One walk: a fresh first visit on the package address, the route to the first sound, the summary; package 5 goes on through its last two steps. */
async function walk(browser: Browser, kind: RouteKind, id: DesignId): Promise<Walk> {
  const ctx = await browser.newContext({ viewport: VIEWPORT })
  const page = await ctx.newPage()
  try {
    await watchLines(page)
    await openFresh(page, `?design=${id}`)
    await waitStartScreen(page)
    const r = newRoute(kind, id)
    if (kind === 'model') await modelFirstSound(page, r)
    else await tenSteps(page, r, kind === 'port' ? portCable(page, r) : dialogCable(page, r))
    const voices = await firstSound(page)
    const closing = await page.getByTestId('tutorial-closing').isVisible()
    const out: Walk = { route: r, voices, closing, ...(await summary(page, r)) }
    if (kind === 'model') {
      // after the first sound (not in its budget): the two steps of the model, led by the ring, and the SIMULATION's voices
      const after = newRoute('model', id)
      const voiceCount = () => page.evaluate(() => window.__creation!.audioState().voices.length)
      await doStep(page, after, 2, stepsOf(id)[1], new Set(), dialogCable(page, after))
      await expect.poll(voiceCount, { message: '« débrancher »: one voice fewer' }).toBeLessThan(voices.length)
      const unplugged = await voiceCount()
      await doStep(page, after, 3, stepsOf(id)[2], new Set(), dialogCable(page, after))
      await expect.poll(voiceCount, { message: '« rebrancher »: the voices again' }).toBe(voices.length)
      out.after = { unplugged, replugged: await voiceCount(), closing: await page.getByTestId('tutorial-closing').isVisible(), unled: after.unled, actions: after.actions }
      console.log('PROXY-AFTER', id, JSON.stringify(out.after))
      if (process.env.PROXY_OUT) writeFileSync(join(process.env.PROXY_OUT, `proxy-after-${id}-${Date.now()}.json`), JSON.stringify(out.after, null, 1))
    }
    return out
  } finally {
    await ctx.close()
  }
}

const ROUTES: { kind: RouteKind; id: DesignId }[] = [
  ...DESIGN_IDS.filter((id) => !onModel(id)).flatMap((id) => [
    { kind: 'dialog' as const, id },
    { kind: 'port' as const, id },
  ]),
  ...DESIGN_IDS.filter(onModel).map((id) => ({ kind: 'model' as const, id })),
]

for (const { kind, id } of ROUTES) {
  const key = `${kind} ${id}`
  const parked = PARKED_ROUTES[key]
  test.describe(`package ${id}, ${kind} route`, () => {
    test.describe.configure({ mode: 'default' })
    let w: Walk | null = null
    /** S1: the walk's own error on a parked route (null when it went through). */
    let walkError: string | null = null
    test.beforeAll(async ({ browser }, testInfo) => {
      testInfo.setTimeout(480_000)
      if (parked === undefined) w = await walk(browser, kind, id)
      else
        w = await walk(browser, kind, id).catch((e: Error) => {
          walkError = e.message
          return null
        })
    })

    if (parked !== undefined)
      test(`PARKED: the walk stops at the known place and only there (${parked.reason})`, () => {
        expect(walkError, `${key}: the parked route reached the first sound: the parking is over, remove its PARKED_ROUTES entry and record its counts`).not.toBeNull()
        expect(walkError!, `${key}: the walk failed somewhere else than the known step-8 refusal`).toMatch(parked.error)
      })
    /** The route's claims, read off a walk that reached the first sound; on a parked route there is none to read. */
    const claim = (title: string, body: () => void): void =>
      test(title, () => {
        test.skip(parked !== undefined, `${key} is parked (${parked?.reason}); its PARKED test pins the failure`)
        body()
      })

    claim(`FIRST SOUND: landing to the test signal playing on a speaker, read from the app's state after the last action`, () => {
      expect(w!.voices.length, 'speaker voices').toBeGreaterThanOrEqual(onModel(id) ? 2 : 1)
      if (!onModel(id)) expect(w!.closing, 'the tutorial ends on the sound (closing card)').toBe(true)
      test.info().annotations.push({ type: 'floor for a known route', description: JSON.stringify(w!.line) })
    })

    const budget = actionBudget(kind, id)
    claim(`ACTIONS: at most ${budget ?? (NOT_MEASURABLE[key] ? `(not measurable: ${NOT_MEASURABLE[key]})` : '(not recorded yet)')} from landing to the first sound`, () => {
      const n = w!.route.actions.length
      expect(budget, `no recorded count for the ${key} route: the first green run measured ${n}; record it in MEASURED`).toBeDefined()
      expect(n, `${key}: ${w!.route.actions.join(' | ')}`).toBeLessThanOrEqual(budget!)
    })

    const known = KNOWN_WORDS[key]
    claim(`WORDS: at most ${WORD_BUDGET} on bubble, card and dialog${known ? ` [known finding: over ${WORD_BUDGET}, held at <= ${known.ceiling}]` : ''}`, () => {
      const why = `${key}: words ${w!.words.counted} (without the counter rule ${w!.words.noCounterRule}, raw ${w!.words.raw}); lines: ${[...w!.route.lines.keys()].join(' / ')}`
      test.info().annotations.push({ type: 'words', description: JSON.stringify({ counted: w!.words.counted, noCounterRule: w!.words.noCounterRule, raw: w!.words.raw }) })
      if (known === undefined) expect(w!.words.counted, why).toBeLessThanOrEqual(WORD_BUDGET)
      else {
        // S2: the finding stands (still over 200: the day it is not, the entry goes) and the count may not grow past what was measured
        expect(w!.words.counted, `${why}\nthe known finding is gone: remove the KNOWN_WORDS entry (${known.finding})`).toBeGreaterThan(WORD_BUDGET)
        expect(w!.words.counted, `${why}\nover the measured ceiling of the known finding`).toBeLessThanOrEqual(known.ceiling)
      }
    })

    const checklistBudget = MEASURED_CHECKLIST[key] === undefined ? undefined : Math.floor(MEASURED_CHECKLIST[key] * 1.1)
    claim(`CHECKLIST: the docked or opened checklist's own words, at most ${checklistBudget ?? '(not recorded yet)'} (measured + 10 %, counted apart from the 200)`, () => {
      expect(checklistBudget, `no recorded checklist count for ${key}: measured ${w!.words.checklist}`).toBeDefined()
      expect(w!.words.checklist).toBeLessThanOrEqual(checklistBudget!)
    })

    if (kind !== 'model')
      claim('STEP 10: once the bench can play, Écoute’s sentence names no checklist (W1: the runtime sees the new bench before the event that ends step 9)', () => {
        const ecoute = [...w!.route.lines.keys()].filter((l) => l.startsWith(COPY.tutorial!.ecoute!))
        expect(ecoute, 'the step 10 sentence was read').not.toEqual([])
        for (const l of ecoute) expect(l).toBe(COPY.tutorial!.ecoute)
      })

    claim(`LED: every action but the drop, the dialog's choice and the port clicks was where the ring showed${KNOWN_UNLED[key] ? ' [known gaps pinned]' : ''}`, () => {
      expect(w!.route.unled, `${key}: actions the ring did not show`).toEqual(KNOWN_UNLED[key] ?? [])
    })

    if (kind === 'model')
      claim('AFTER THE FIRST SOUND: « débrancher » drops one voice of the simulation, « rebrancher » brings it back, the run closes, led by the ring', () => {
        const a = w!.after!
        expect(a.unplugged, 'voices after « débrancher »').toBe(w!.voices.length - 1)
        expect(a.replugged, 'voices after « rebrancher »').toBe(w!.voices.length)
        expect(a.closing, 'the closing card').toBe(true)
        expect(a.unled, 'actions the ring did not show after the first sound').toEqual(KNOWN_UNLED[`${key} after`] ?? [])
      })
  })
}

// ── the source scan: the route never acts through the debug hook ─────────────────────────────────────────────────────────────

const SOURCE = readFileSync('tests/e2e/first-timer-proxy.spec.ts', 'utf8')
const between = (src: string, a: string, b: string): string => {
  const i = src.indexOf(a)
  const j = src.indexOf(b, i + a.length)
  return i < 0 || j < 0 ? '' : src.slice(i + a.length, j)
}
/** Where this scan starts: everything above it in the file is scanned, the helpers the route calls included (review S12). */
const SCAN_END = '// ── the source scan: the route never acts through the debug hook'
/**
 * G14e (review S12): the lines of this file, above the scan, that may name the debug hook, each with why (an allow-list, matched on the trimmed line). Any
 * other line that names `__creation` is an offender, wherever it sits (a helper above ROUTE: BEGIN included). The port block's two readers are checked by name.
 * Not scanned here: the kit's `openFresh` (onboardingKit.ts), whose boot wait reads `!!window.__creation` before the landing, and `waitStep`, a DOM read.
 */
const HOOK_ALLOWED: readonly { line: string; why: string }[] = [
  { line: "await page.waitForFunction(() => window.__creation!.audioState().state === 'playing' && window.__creation!.audioState().source === 'test', null, { timeout: SOUND_MS })", why: 'firstSound: the sound read AFTER the last action' },
  { line: 'return page.evaluate(() => window.__creation!.audioState().voices.map((v) => v.instanceId))', why: 'firstSound: the voices read AFTER the last action' },
  { line: 'const voiceCount = () => page.evaluate(() => window.__creation!.audioState().voices.length)', why: 'package 5 after the first sound: the simulation’s voice count (spec 11.8), a reader' },
]
/** The offenders of a source text: hook uses outside the allow-list and the port block, anything but the two readers in the port block, any action call. */
function hookUses(src: string): string[] {
  const eyes = between(src, '// ── PORT EYES: BEGIN', '// ── PORT EYES: END')
  const rest = eyes === '' ? src : src.replace(eyes, '')
  const allowed = new Set(HOOK_ALLOWED.map((a) => a.line))
  const code = (l: string): string => l.replace(/^\s*(\*|\/\*\*|\/\/).*$/, '').replace(/\s\/\/ .*$/, '')
  const out = rest
    .split('\n')
    .filter((l) => /__creation/.test(code(l)) && !allowed.has(l.trim()))
    .map((l) => `outside the port block and the allow-list: ${l.trim().slice(0, 100)}`)
  for (const m of eyes.matchAll(/__creation!?\.(\w+)/g)) if (!['design', 'portScreen'].includes(m[1])) out.push(`port block: ${m[0]}`)
  for (const l of src.split('\n'))
    for (const m of code(l).matchAll(/\b(dispatch|patchClick|choosePlace|requestPlace|setControlValue|frameDevice|setCameraRadius|turnCamera|undo|redo|dispatchEvent|insertText)\s*\(/g)) out.push(`an action call: ${m[0]}`)
  return out
}

test('SOURCE SCAN: the route and every helper it calls act only through the screen (the whole file above the scan; hook readers only where the allow-list says, after the first sound, and two in the port-click block)', () => {
  const scanned = SOURCE.slice(0, SOURCE.indexOf(SCAN_END))
  const route = between(SOURCE, '// ── ROUTE: BEGIN', '// ── ROUTE: END')
  expect(SOURCE.indexOf(SCAN_END), 'the scan marker is found').toBeGreaterThan(20_000)
  expect(route.length, 'the route markers are found and the route is not empty').toBeGreaterThan(2000)
  expect(scanned).toContain('portScreen')
  expect(hookUses(scanned)).toEqual([])
  // every allow-list line is really in the file (a stale entry allows nothing, but it would hide that the code moved)
  for (const a of HOOK_ALLOWED) expect(scanned.split('\n').map((l) => l.trim()), `allow-list: ${a.why}`).toContain(a.line)
  // the scan bites: a dispatch in the route, a hook call outside the port block, a third reader inside it, and a hook use in a HELPER above the route
  expect(hookUses(`${scanned}\nawait page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN' }))`).length).toBeGreaterThan(0)
  expect(hookUses(scanned.replace('async function landAndStart', 'const x = () => window.__creation!.selection()\nasync function landAndStart')).length).toBeGreaterThan(0)
  expect(hookUses(scanned.replace('window.__creation!.portScreen(', 'window.__creation!.pickAt(')).length).toBeGreaterThan(0)
  const helper = 'async function clickControl(page: Page, label: string, b: Box): Promise<string> {'
  expect(scanned).toContain(helper)
  expect(hookUses(scanned.replace(helper, `${helper}\n  await page.evaluate(() => window.__creation!.selection())`)), 'a hook reader in a helper above ROUTE: BEGIN').toHaveLength(1)
  expect(hookUses(scanned.replace(helper, `${helper}\n  await page.evaluate(() => document.querySelector('button')!.dispatchEvent(new MouseEvent('click')))`)).length, 'an in-page event in a helper').toBeGreaterThan(0)
})

test('MODEL: the word count and the reading model on a crafted route (counters once, distinct lines once, at least 2 s per bubble)', () => {
  const r = newRoute('dialog', 1)
  for (const [l, at] of [
    ['Parcours « Premiers pas » : étape 1 sur 10.', 'bubble'],
    ['Posez le micro.', 'bubble'],
    ['Étape 1 sur 10', 'card'],
    ['Parcours « Premiers pas » : étape 2 sur 10.', 'bubble'],
    ['Étape 2 sur 10', 'card'],
  ] as const)
    r.lines.set(l, at)
  expect(wordsIn('« Connecter à… » : la prise')).toBe(4)
  expect(words(r)).toEqual({ counted: 7 + 3 + 4, checklist: 0, raw: 7 + 3 + 4 + 7 + 4, noCounterRule: 7 + 3 + 4 + 7 + 4 })
  // the dialog's body: whole once, then only the port it starts from; the checklist apart
  const body = (port: string): string => (COPY.connect?.body ?? '').replace('{port}', port)
  const d = newRoute('dialog', 1)
  d.lines.set(body('QL1 (q) · out-main-l'), 'dialog')
  d.lines.set(body('SM58 (s) · out-xlr'), 'dialog')
  d.lines.set('Une source de lecture', 'checklist')
  expect(words(d)).toEqual({ counted: wordsIn(body('QL1 (q) · out-main-l')) + wordsIn('SM58 (s) · out-xlr'), checklist: 4, raw: wordsIn(body('QL1 (q) · out-main-l')) + wordsIn(body('SM58 (s) · out-xlr')) + 4, noCounterRule: wordsIn(body('QL1 (q) · out-main-l')) + wordsIn('SM58 (s) · out-xlr') })
})
