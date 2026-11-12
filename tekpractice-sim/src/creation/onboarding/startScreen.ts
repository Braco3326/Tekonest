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
 */
import { COPY } from '../copy'
import { PROFILES, profileByKey, type ProfilePreset } from './profiles'
import type { OfferAnswer, ProfileId } from './state'

export type StartResult =
  /** « Tous les lieux » or Échap on the profile stage. */
  | { kind: 'all-places' }
  /** A profile was chosen; `offer` is the answer to the offer, or null when no offer was made. */
  | { kind: 'chosen'; profile: ProfileId; offer: OfferAnswer | null }

export interface StartScreenDeps {
  doc: Document
  /** Where the panel lives (the picker's `section`). */
  parent: HTMLElement
  /** Steps of the tutorial of the active package: the offer says how many. */
  stepCount: number
  /** The guide can run on this address: when false, a profile choice is final. */
  offerAllowed: boolean
  /** The learner chose a profile (before the offer): the owner records it. */
  onProfile(id: ProfileId): void
  /** The learner is done with the start screen. */
  onResult(r: StartResult): void
  profiles?: readonly ProfilePreset[]
}

export interface StartScreen {
  readonly el: HTMLElement
  /** The heading's id: the picker's `section` is named by it while the start stage shows. */
  readonly titleId: string
  readonly stage: 'profile' | 'offer' | null
  /** Show the profile stage; the focus goes to its first button. */
  open(): void
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
  if (m) return m[1]
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

  // ── offer stage
  const offerStage = make(doc, 'div', 'cr-start-stage')
  offerStage.hidden = true
  const offerProfile = make(doc, 'p', 'cr-start-profile-name')
  const offerLead = make(doc, 'p', 'cr-pick-hint cr-start-lead', O().offerLead)
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

  root.append(title, lead, profileStage, offerStage)
  d.parent.appendChild(root)

  let stage: 'profile' | 'offer' | null = null
  let busy = false
  let chosen: ProfilePreset | null = null

  const show = (s: 'profile' | 'offer'): void => {
    stage = s
    profileStage.hidden = s !== 'profile'
    offerStage.hidden = s !== 'offer'
    title.textContent = s === 'profile' ? O().startTitle! : O().offerTitle!
    lead.hidden = s !== 'profile'
  }

  function choose(p: ProfilePreset): void {
    if (busy || stage !== 'profile') return
    chosen = p
    d.onProfile(p.id)
    if (!d.offerAllowed) return d.onResult({ kind: 'chosen', profile: p.id, offer: null })
    offerProfile.textContent = O().offerProfile!.replace('{profile}', O()[p.labelKey]!)
    show('offer')
    ;(p.offerFocus === 'tutorial' ? tutorial : skip).focus()
  }
  function answer(a: OfferAnswer): void {
    if (busy || stage !== 'offer' || !chosen) return
    d.onResult({ kind: 'chosen', profile: chosen.id, offer: a })
  }
  function leaveToPlaces(): void {
    if (busy || stage !== 'profile') return
    d.onResult({ kind: 'all-places' })
  }

  root.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      if (stage === 'profile') leaveToPlaces()
      else if (stage === 'offer') answer('skipped')
      return
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
    if (stage === 'offer' && chosen) (chosen.offerFocus === 'tutorial' ? tutorial : skip).focus()
    else buttons.get(profiles[0].id)?.focus()
  }

  return {
    el: root,
    titleId: title.id,
    get stage() {
      return stage
    },
    open() {
      chosen = null
      busy = false
      root.hidden = false
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
