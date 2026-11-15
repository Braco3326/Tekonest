/**
 * Accounts in Mode Création (mission 1, spec 5), behind the `accounts` switch. boot.ts imports this module only when `FEATURES.accounts` is on (a constant, so a product build with
 * the switch off drops the import and never emits, fetches or runs any of it: no menu entry, no card, no storage key, no request).
 *
 * - The dialogs (src/accounts/accountUi.ts) and the schools list are LAZY: they are fetched the first time the learner asks (« Mon compte », « Se connecter », the card's buttons),
 *   or at boot only when the address carries a sign-in redirect (`code=`, `access_token=`), which the dialogs must finish. Nothing is shown or sent before that.
 * - The card « Enregistrez votre travail »: quiet, shown ONCE (any of its buttons dismisses it for good: `accountPrompt: 'dismissed'` in the onboarding record) after the plain
 *   tutorial ends or the first sound, whichever comes first; never in an exam (practice address only, read live); it opens sign-up. It takes the tutorial's reserved row
 *   (src/design/tutorialSlot.ts) only while that row is free: during a tutorial it waits until the tutorial's card has left.
 * The two build-time Supabase variables (docs/accounts.md) are read by the adapter alone, from `import.meta.env`; nothing is committed and nothing here reads them.
 */
import type { AccountUiHandle, mountAccountUi, SchoolOption } from '../../accounts/accountUi'
import { COPY } from '../copy'
import { closeTutorialSlot, openTutorialSlot, tutorialSlotOf } from '../../design/tutorialSlot'
import type { OnboardingStore } from './state'
import './plainTutorial.css'

export const ACCOUNT_PROMPT_TESTID = 'account-prompt'

export interface AccountWiringDeps {
  doc: Document
  /** The onboarding record (the dismissal is remembered there); null = no onboarding on this address, so no card. */
  store: Pick<OnboardingStore, 'read' | 'dispatch'> | null
  /** The address is a practice one NOW (an exam address never shows the card). */
  practiceNow(): boolean
  placeOpen(): boolean
  /** The learner's goal (one goal-tree node id) or null. */
  getGoal(): string | null
  describeGoal?(id: string): string | null
  /** The place picker's covers: the card's slot is inert under the picker. */
  covers?: HTMLElement[]
  covered?(): boolean
  returnFocus(): void
  /** Sign-in state changed (the menu reads `signedIn()` when it opens). */
  onAccountChange?(): void
  /** Mount at once (a sign-in redirect is in the address). */
  mountNow?: boolean
  /** Tests: the dialogs module and the schools. */
  loadUi?(): Promise<{ mountAccountUi: typeof mountAccountUi }>
  loadSchools?(): Promise<readonly SchoolOption[]>
}

export interface AccountWiring {
  readonly signedIn: boolean
  /** « Mon compte »: the account, or sign-up while signed out. */
  open(): Promise<void>
  /** « Se connecter ». */
  logIn(): Promise<void>
  /** A moment for the card came (the plain tutorial ended, or the first sound): it shows now or as soon as the row is free. */
  promptDue(): void
  /** The page changed (the tutorial's card left, a place opened, the address changed): the card may show, or must hide. */
  refresh(): void
  readonly promptShown: boolean
}

/** The address carries a sign-in redirect the dialogs must finish. */
export const hasAuthRedirect = (search: string, hash: string): boolean => /[?&#](code|access_token)=/.test(search + hash)

export function wireAccounts(d: AccountWiringDeps): AccountWiring {
  const AP = (): Readonly<Record<string, string>> => COPY.accountPrompt!
  let signed = false
  let ui: Promise<AccountUiHandle | null> | null = null
  const mount = (): Promise<AccountUiHandle | null> =>
    (ui ??= (async () => {
      try {
        const [{ mountAccountUi: mountUi }, schools] = await Promise.all([
          (d.loadUi ?? (() => import('../../accounts/accountUi')))(),
          (d.loadSchools ?? (async () => ((await import('../../../content/onboarding/schools.json')).default as { schools: SchoolOption[] }).schools))(),
        ])
        return await mountUi({
          schools,
          getGoal: d.getGoal,
          ...(d.describeGoal ? { describeGoal: d.describeGoal } : {}),
          onAccountChange: (user) => {
            signed = user !== null
            d.onAccountChange?.()
          },
        })
      } catch (e) {
        console.warn('[creation] accounts unavailable', e)
        ui = null // the next ask tries again
        return null
      }
    })())
  if (d.mountNow) void mount()

  let due = false
  let slot: HTMLElement | null = null
  const dismissed = (): boolean => d.store?.read()?.accountPrompt === 'dismissed'
  const hide = (): void => {
    if (slot === null) return
    const gone = slot
    closeTutorialSlot(d.doc)
    gone.remove()
    if (d.covers) {
      const at = d.covers.indexOf(gone)
      if (at >= 0) d.covers.splice(at, 1)
    }
    slot = null
  }
  const dismiss = (): void => {
    due = false
    d.store?.dispatch({ type: 'accountPrompt', value: 'dismissed' })
    hide()
    d.returnFocus()
  }
  const show = (): void => {
    const s = openTutorialSlot(d.doc)
    if (s === null) return
    slot = s
    slot.inert = d.covered?.() === true
    d.covers?.push(slot)
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
      const e = d.doc.createElement(tag)
      e.className = cls
      if (text !== undefined) e.textContent = text
      return e
    }
    const card = el('section', 'tp-coach tp-account')
    card.dataset.testid = ACCOUNT_PROMPT_TESTID
    card.setAttribute('aria-label', AP().region!)
    const title = el('p', 'tp-coach-count', AP().title)
    const line = el('p', 'tp-coach-text', AP().line)
    const actions = el('div', 'tp-coach-actions')
    const btn = (label: string, testid: string, run: () => void): HTMLButtonElement => {
      const b = el('button', 'tp-coach-btn', label)
      b.type = 'button'
      b.dataset.testid = testid
      b.addEventListener('click', run)
      return b
    }
    actions.append(
      btn(AP().signUp!, 'account-prompt-signup', () => {
        dismiss()
        void mount().then((h) => h?.openSignUp())
      }),
      btn(AP().logIn!, 'account-prompt-login', () => {
        dismiss()
        void mount().then((h) => h?.openLogIn())
      }),
      btn(AP().dismiss!, 'account-prompt-dismiss', dismiss),
    )
    card.append(title, line, actions)
    slot.append(card)
  }
  const refresh = (): void => {
    const may = d.store !== null && due && !dismissed() && !signed && d.practiceNow() && d.placeOpen()
    if (!may) return hide()
    if (slot !== null) return
    if (tutorialSlotOf(d.doc) !== null) return // the tutorial's card holds the row: the card waits for it to leave
    show()
  }
  return {
    get signedIn() {
      return signed
    },
    open: async () => void (await mount())?.open(),
    logIn: async () => void (await mount())?.openLogIn(),
    promptDue() {
      if (dismissed()) return
      due = true
      refresh()
    },
    refresh,
    get promptShown() {
      return slot !== null
    },
  }
}
