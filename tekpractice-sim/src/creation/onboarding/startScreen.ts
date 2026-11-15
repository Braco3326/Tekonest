/**
 * The start screen of the first visit (onboarding packs, plan T2.3, spec 4.2 and 4.3). DOM only, self-contained: it owns the panel and its two stages,
 * and reports what the learner answered; it does not store anything, open any place, or touch `inert` of the page (the place picker, whose stage it
 * is, owns `inert`: `setInert` only closes the panel itself, like the picker's own head and scroll while its confirm dialog is open).
 *
 * - Profile stage: four large EQUAL buttons by situation (keys 1 to 4, read by position so AZERTY works), « Tous les lieux ». Échap = « Tous les lieux ».
 * - Offer stage (same panel, same heading): two EQUAL buttons « Faire le tutoriel (conseillé · {n} étapes, à votre rythme) » and « Passer, je connais ».
 *   The focus is on the one the profile names (`offerFocus`); Échap = « Passer, je connais ». With `offerAllowed: false` (the guide is not on this
 *   address) a profile choice is final: no offer.
 * - The panel handles its own keys: the picker's Échap is gated on `closable`, which is false on a first visit.
 * - Goal stage (mission 1, spec 1.2; only with `goals`, a tree): it REPLACES the profile stage. Screen 1 lists the five goals (keys 1 to 5), screen 2 the children
 *   of the chosen goal, screen 3 the children of the chosen level-2 node when it has any (goalSteps.ts). Screen 1 has « Passer » and « Tous les lieux » (Échap =
 *   « Tous les lieux », as on the profile stage); screens 2 and 3 have « Retour » (Échap too) and « Passer ». A screen's first button takes the focus; « Retour »
 *   puts it back on the button chosen there. The answer (or « Passer », no goal) then goes to the offer stage like a profile, or straight to `onResult`.
 *   Every label comes from the tree, never from here.
 */
import { COPY } from '../copy'
import { PROFILES, profileById, profileByKey, type ProfilePreset } from './profiles'
import { findGoal, type GoalChoice, type GoalTree } from './goalTree'
import { GOAL_SCREEN_FIRST, goalBack, goalOptionByKey, goalOptions, goalPathLabel, goalPick, goalScreenNumber, type GoalScreen } from './goalSteps'
import type { OfferAnswer, ProfileId } from './state'

export type StartResult =
  /** « Tous les lieux » or Échap on the profile stage. */
  | { kind: 'all-places' }
  /** Échap on the offer stage when the screen was reopened by the chip (`offerEscape: 'leave'`): nothing was answered, nothing changes. */
  | { kind: 'leave' }
  /**
   * A profile was chosen; `offer` is the answer to the offer, or null when no offer was made. On the goal stage `goal` is the answer (null = « Passer ») and `profile`
   * the one its goal maps to (null with no goal); on the profile stage `goal` is absent.
   */
  | { kind: 'chosen'; profile: ProfileId | null; offer: OfferAnswer | null; goal?: GoalChoice | null }

export interface StartScreenDeps {
  doc: Document
  /** Where the panel lives (the picker's `section`). */
  parent: HTMLElement
  /** Steps of the tutorial of the active package: the offer says how many. */
  stepCount: number
  /** The guide can run on this address: when false, a profile choice is final. */
  offerAllowed: boolean
  /** The learner is done with the start screen. */
  onResult(r: StartResult): void
  profiles?: readonly ProfilePreset[]
  /** The goal tree (mission 1): given, the goal stage replaces the profile stage. */
  goals?: GoalTree | null
}

export interface StartScreen {
  readonly el: HTMLElement
  /** The heading's id: the picker's `section` is named by it while the start stage shows. */
  readonly titleId: string
  /** `goal`: one of the goal screens (`goalScreen` says which). */
  readonly stage: 'profile' | 'goal' | 'offer' | null
  /** The goal screen showing (1, 2 or 3), or null off the goal stage. */
  readonly goalScreen: 1 | 2 | 3 | null
  /**
   * Show the profile stage (the focus goes to its first button), or, with `offerFor`, the offer stage of that stored profile directly (a profile whose offer
   * was never answered). `offerEscape`: what Échap does on the offer stage, « Passer, je connais » (`'skip'`, a first visit) or leaving with no change (`'leave'`, reopened
   * by the chip). A pick in flight (`setBusy`) is not reset by opening again.
   */
  open(o?: { offerFor?: ProfileId; offerGoal?: GoalChoice | null; offerEscape?: 'skip' | 'leave' }): void
  /** The focus goes to where the current stage starts it (the skip link lands here while the screen covers the page). */
  focus(): void
  close(): void
  setInert(on: boolean): void
  /** A chosen room is opening: answers are ignored. */
  setBusy(on: boolean): void
}

const O = (): Readonly<Record<string, string>> => COPY.onboarding!

function make<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

/** The pressed digit by POSITION (`Digit1`, `Numpad1`): on AZERTY the unshifted key prints « & », not « 1 ». */
function digitOf(e: KeyboardEvent): string | null {
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)
  // A keypad key with NumLock off is End, the arrows, PageDown...: navigation, not a digit (its code is still Numpad1).
  if (m) return e.code.startsWith('Numpad') && !/^[0-9]$/.test(e.key) ? null : m[1]
  return /^[1-9]$/.test(e.key) ? e.key : null
}

export function mountStartScreen(d: StartScreenDeps): StartScreen {
  const { doc } = d
  const profiles = d.profiles ?? PROFILES
  const root = make(doc, 'div', 'cr-start')
  root.dataset.testid = 'start-screen'
  root.tabIndex = -1 // a click on empty space keeps the focus here, so the keys still reach the panel
  root.hidden = true

  const title = make(doc, 'h2', 'cr-pick-title cr-start-title', O().startTitle)
  title.id = 'cr-start-title'
  const lead = make(doc, 'p', 'cr-pick-hint cr-start-lead', O().startLead)

  // ── profile stage
  const profileStage = make(doc, 'div', 'cr-start-stage')
  const buttons = new Map<ProfileId, HTMLButtonElement>()
  const grid = make(doc, 'div', 'cr-start-profiles')
  for (const p of profiles) {
    const b = make(doc, 'button', 'cr-start-btn cr-start-profile')
    b.type = 'button'
    b.dataset.profile = p.id
    b.setAttribute('aria-keyshortcuts', p.key)
    // The key is shown for the sighted keyboard user; the name stays the situation alone (the key is in aria-keyshortcuts).
    const key = make(doc, 'span', 'cr-start-key', p.key)
    key.setAttribute('aria-hidden', 'true')
    b.append(key, make(doc, 'span', 'cr-start-label', O()[p.labelKey]))
    b.addEventListener('click', () => choose(p))
    buttons.set(p.id, b)
    grid.appendChild(b)
  }
  const allPlaces = make(doc, 'button', 'cr-btn cr-start-places', O().allPlaces)
  allPlaces.type = 'button'
  allPlaces.addEventListener('click', () => leaveToPlaces())
  profileStage.append(grid, allPlaces)

  // ── goal stage (mission 1): built only with a tree; its buttons are rebuilt for each screen
  const tree = d.goals ?? null
  const goalStage = make(doc, 'div', 'cr-start-stage')
  goalStage.hidden = true
  goalStage.dataset.testid = 'goal-screen'
  const goalPathLine = make(doc, 'p', 'cr-start-profile-name cr-start-goal-path')
  const goalGrid = make(doc, 'div', 'cr-start-profiles cr-start-goals')
  const goalNav = make(doc, 'div', 'cr-start-goal-nav')
  const goalBackBtn = make(doc, 'button', 'cr-btn', O().goalBack)
  goalBackBtn.type = 'button'
  goalBackBtn.dataset.testid = 'goal-back'
  const goalSkipBtn = make(doc, 'button', 'cr-btn', O().goalSkip)
  goalSkipBtn.type = 'button'
  goalSkipBtn.dataset.testid = 'goal-skip'
  const goalPlaces = make(doc, 'button', 'cr-btn', O().allPlaces)
  goalPlaces.type = 'button'
  goalBackBtn.addEventListener('click', () => back())
  goalSkipBtn.addEventListener('click', () => skipGoal())
  goalPlaces.addEventListener('click', () => leaveToPlaces())
  goalNav.append(goalBackBtn, goalSkipBtn, goalPlaces)
  goalStage.append(goalPathLine, goalGrid, goalNav)
  let goalAt: GoalScreen = GOAL_SCREEN_FIRST
  const goalButtons = new Map<string, HTMLButtonElement>()

  // ── offer stage
  const offerStage = make(doc, 'div', 'cr-start-stage')
  offerStage.hidden = true
  const offerProfile = make(doc, 'p', 'cr-start-profile-name')
  offerProfile.id = 'cr-start-offer-profile'
  const offerLead = make(doc, 'p', 'cr-pick-hint cr-start-lead', O().offerLead)
  offerLead.id = 'cr-start-offer-lead'
  // The focus lands on a button: a screen reader hears the group's name (the question) and its description (the profile, what the tutorial is) with it, not only the button.
  offerStage.setAttribute('role', 'group')
  offerStage.setAttribute('aria-labelledby', 'cr-start-title')
  offerStage.setAttribute('aria-describedby', 'cr-start-offer-profile cr-start-offer-lead')
  const offerRow = make(doc, 'div', 'cr-start-offer')
  const tutorial = make(doc, 'button', 'cr-start-btn cr-start-answer', O().offerTutorial!.replace('{n}', String(d.stepCount)))
  tutorial.type = 'button'
  tutorial.dataset.answer = 'tutorial'
  const skip = make(doc, 'button', 'cr-start-btn cr-start-answer', O().offerSkip)
  skip.type = 'button'
  skip.dataset.answer = 'skip'
  tutorial.addEventListener('click', () => answer('taken'))
  skip.addEventListener('click', () => answer('skipped'))
  offerRow.append(tutorial, skip)
  offerStage.append(offerProfile, offerLead, offerRow)

  // Where the guide may not run (`?oscar=0`, an exam address) the offer is not in the page at all, not only hidden.
  root.append(title, lead, tree ? goalStage : profileStage)
  if (d.offerAllowed) root.append(offerStage)
  d.parent.appendChild(root)

  let stage: 'profile' | 'goal' | 'offer' | null = null
  let busy = false
  let chosen: ProfilePreset | null = null
  /** The goal stage's answer waiting for the offer: the goal (null = « Passer »), its profile, and the label the offer names. */
  let chosenGoal: { goal: GoalChoice | null; profile: ProfileId | null; label: string | null } | null = null
  let offerEscape: 'skip' | 'leave' = 'skip'
  const firstStage = (): 'profile' | 'goal' => (tree ? 'goal' : 'profile')

  const titleOfGoal = (): string => {
    const n = goalScreenNumber(goalAt)
    return n === 1 ? O().goalTitle! : n === 2 ? O().goalSubTitle! : O().goalLeafTitle!
  }
  const show = (s: 'profile' | 'goal' | 'offer'): void => {
    stage = s
    profileStage.hidden = s !== 'profile'
    goalStage.hidden = s !== 'goal'
    offerStage.hidden = s !== 'offer'
    title.textContent = s === 'profile' ? O().startTitle! : s === 'goal' ? titleOfGoal() : O().offerTitle!
    lead.textContent = s === 'goal' ? O().goalLead! : O().startLead!
    lead.hidden = !(s === 'profile' || (s === 'goal' && goalScreenNumber(goalAt) === 1))
  }

  /** Draws the goal screen `at`; the focus goes to `focusId`'s button, else the first one. */
  function renderGoal(at: GoalScreen, focusId?: string): void {
    if (!tree) return
    goalAt = at
    goalButtons.clear()
    goalGrid.replaceChildren()
    for (const o of goalOptions(tree, at)) {
      const b = make(doc, 'button', 'cr-start-btn cr-start-profile cr-start-goal')
      b.type = 'button'
      b.dataset.goal = o.id
      b.setAttribute('aria-keyshortcuts', o.key)
      const key = make(doc, 'span', 'cr-start-key', o.key)
      key.setAttribute('aria-hidden', 'true')
      b.append(key, make(doc, 'span', 'cr-start-label', o.label))
      b.addEventListener('click', () => pickGoal(o.id))
      goalButtons.set(o.id, b)
      goalGrid.appendChild(b)
    }
    const n = goalScreenNumber(at)
    goalGrid.dataset.screen = String(n)
    goalPathLine.hidden = n === 1
    goalPathLine.textContent = n === 1 ? '' : O().goalPath!.replace('{path}', goalPathLabel(tree, at))
    goalBackBtn.hidden = n === 1
    goalPlaces.hidden = n !== 1
    show('goal')
    ;(goalButtons.get(focusId ?? '') ?? goalGrid.querySelector<HTMLButtonElement>('button'))?.focus()
  }
  function pickGoal(id: string): void {
    if (busy || stage !== 'goal' || !tree) return
    const m = goalPick(tree, goalAt, id)
    if (m.kind === 'screen') return renderGoal(m.screen)
    if (m.kind === 'chosen') endGoal({ goal: m.choice, profile: m.profile, label: m.label })
  }
  function back(): void {
    if (busy || stage !== 'goal') return
    const b = goalBack(goalAt)
    if (b) renderGoal(b.screen, b.focus)
  }
  function skipGoal(): void {
    if (busy || stage !== 'goal') return
    endGoal({ goal: null, profile: null, label: null })
  }
  function endGoal(g: { goal: GoalChoice | null; profile: ProfileId | null; label: string | null }): void {
    chosenGoal = g
    if (!d.offerAllowed) return d.onResult({ kind: 'chosen', profile: g.profile, offer: null, goal: g.goal })
    showGoalOffer()
  }
  /** The offer button that takes the focus after the goal stage: the profile's, « Faire le tutoriel » with no profile. */
  const goalOfferButton = (): HTMLButtonElement => (chosenGoal?.profile && profileById(chosenGoal.profile).offerFocus === 'skip' ? skip : tutorial)
  function showGoalOffer(): void {
    offerProfile.textContent = chosenGoal?.label ? O().offerGoal!.replace('{goal}', chosenGoal.label) : ''
    offerProfile.hidden = !chosenGoal?.label
    show('offer')
    goalOfferButton().focus()
  }

  function showOffer(p: ProfilePreset): void {
    chosen = p
    offerProfile.hidden = false
    offerProfile.textContent = O().offerProfile!.replace('{profile}', O()[p.labelKey]!)
    show('offer')
    ;(p.offerFocus === 'tutorial' ? tutorial : skip).focus()
  }
  function choose(p: ProfilePreset): void {
    if (busy || stage !== 'profile') return
    if (!d.offerAllowed) {
      chosen = p
      return d.onResult({ kind: 'chosen', profile: p.id, offer: null })
    }
    showOffer(p)
  }
  function answer(a: OfferAnswer): void {
    if (busy || stage !== 'offer') return
    if (chosenGoal) return d.onResult({ kind: 'chosen', profile: chosenGoal.profile, offer: a, goal: chosenGoal.goal })
    if (!chosen) return
    d.onResult({ kind: 'chosen', profile: chosen.id, offer: a })
  }
  function leaveToPlaces(): void {
    if (busy || stage !== firstStage() || (stage === 'goal' && goalScreenNumber(goalAt) !== 1)) return
    d.onResult({ kind: 'all-places' })
  }

  root.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      if (stage === 'profile') leaveToPlaces()
      else if (stage === 'goal') {
        if (goalScreenNumber(goalAt) === 1) leaveToPlaces()
        else back()
      } else if (stage === 'offer') {
        if (offerEscape === 'skip') answer('skipped')
        else if (!busy) d.onResult({ kind: 'leave' })
      }
      return
    }
    if (stage === 'goal' && tree) {
      const g = /^(?:Digit|Numpad)0$/.test(e.code) || e.key === '0' ? '0' : digitOf(e)
      const o = g ? goalOptionByKey(tree, goalAt, g) : undefined
      if (!o) return
      e.preventDefault()
      e.stopPropagation()
      return pickGoal(o.id)
    }
    if (stage !== 'profile') return
    const dg = digitOf(e)
    const p = dg ? profileByKey(dg) : undefined
    if (!p) return
    e.preventDefault()
    e.stopPropagation()
    choose(p)
  })

  function focusStage(): void {
    if (stage === 'offer' && chosenGoal) goalOfferButton().focus()
    else if (stage === 'offer' && chosen) (chosen.offerFocus === 'tutorial' ? tutorial : skip).focus()
    else if (stage === 'goal') goalGrid.querySelector<HTMLButtonElement>('button')?.focus()
    else buttons.get(profiles[0].id)?.focus()
  }

  return {
    el: root,
    titleId: title.id,
    get stage() {
      return stage
    },
    get goalScreen() {
      return stage === 'goal' ? goalScreenNumber(goalAt) : null
    },
    open(o) {
      chosen = null // a pick in flight (`busy`) is not reset by opening again: its answer would be asked twice
      chosenGoal = null
      offerEscape = o?.offerEscape ?? 'skip'
      root.hidden = false
      if (tree) {
        if (o?.offerFor && d.offerAllowed) {
          // a goal whose offer was never answered (a first visit where the tutorial was not allowed): the offer, naming the stored goal
          const node = o.offerGoal ? findGoal(tree, o.offerGoal.id) : null
          chosenGoal = { goal: o.offerGoal ?? null, profile: o.offerFor, label: node?.label ?? null }
          return showGoalOffer()
        }
        return renderGoal(GOAL_SCREEN_FIRST)
      }
      const again = o?.offerFor && d.offerAllowed ? profiles.find((p) => p.id === o.offerFor) : undefined
      if (again) return showOffer(again)
      show('profile')
      focusStage()
    },
    focus: focusStage,
    close() {
      root.hidden = true
      stage = null
    },
    setInert(on) {
      root.inert = on
    },
    setBusy(on) {
      busy = on
    },
  }
}
