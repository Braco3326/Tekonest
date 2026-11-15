// @vitest-environment jsdom
/**
 * Accounts in Mode Création (mission 1, spec 5; src/creation/onboarding/accountWiring.ts): the dialogs load only when asked (or on a sign-in redirect), the card
 * « Enregistrez votre travail » shows once after its moment, never in an exam, waits while the tutorial's card holds the row, opens sign-up, and is remembered as dismissed.
 * The menu entries « Mon compte » / « Se connecter » exist only where the page registered them. The switch-off side (no chunk, no request) is the product e2e.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { hasAuthRedirect, wireAccounts, type AccountWiringDeps } from '../../src/creation/onboarding/accountWiring'
import { createOnboardingStore, ONBOARDING_KEY, type StorageLike } from '../../src/creation/onboarding/state'
import { openTutorialSlot, closeTutorialSlot } from '../../src/design/tutorialSlot'
import { buildMenus } from '../../src/creation/shell/menuModel'
import { History } from '../../src/creation/history'

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}
const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

let log: string[]
let practice: boolean
let place: boolean
let storage: ReturnType<typeof memoryStorage>
let loads: number
let changed: (() => void) | null
function harness(over: Partial<AccountWiringDeps> = {}) {
  const deps: AccountWiringDeps = {
    doc: document,
    store: createOnboardingStore(storage),
    practiceNow: () => practice,
    placeOpen: () => place,
    getGoal: () => 'etudie.bts-mav-son',
    returnFocus: () => void log.push('focus'),
    loadUi: async () => {
      loads++
      return {
        mountAccountUi: async (d) => {
          log.push(`mount:${d.schools.length}:${d.getGoal?.()}`)
          changed = () => d.onAccountChange?.({ id: 'u1', email: 'a@b.c' } as never)
          return { open: async () => void log.push('open'), openSignUp: async () => void log.push('signup'), openLogIn: async () => void log.push('login'), openAccount: async () => undefined, dispose: () => undefined }
        },
      }
    },
    loadSchools: async () => [{ id: 'ecole.x', name: 'X' }],
    ...over,
  }
  return wireAccounts(deps)
}
const card = (): HTMLElement | null => document.querySelector('[data-testid="account-prompt"]')

beforeEach(() => {
  document.body.innerHTML = '<div data-testid="creation-root" class="cr"></div>'
  log = []
  practice = true
  place = true
  storage = memoryStorage()
  loads = 0
  changed = null
})

describe('the dialogs are lazy', () => {
  it('nothing is loaded until the learner asks; « Mon compte » and « Se connecter » load them once, with the schools and the goal', async () => {
    const a = harness()
    await flush()
    expect(loads).toBe(0)
    await a.open()
    await a.logIn()
    expect(loads).toBe(1)
    expect(log).toEqual(['mount:1:etudie.bts-mav-son', 'open', 'login'])
  })
  it('a sign-in redirect in the address mounts them at once; signedIn follows the dialogs', async () => {
    expect(hasAuthRedirect('?code=abc', '')).toBe(true)
    expect(hasAuthRedirect('', '#access_token=x&y=1')).toBe(true)
    expect(hasAuthRedirect('?design=2', '')).toBe(false)
    const a = harness({ mountNow: true })
    await flush()
    expect(loads).toBe(1)
    expect(a.signedIn).toBe(false)
    changed!()
    expect(a.signedIn).toBe(true)
  })
})

describe('the card « Enregistrez votre travail »', () => {
  it('is not there before its moment; then shows once in the reserved row, a labelled region with three buttons; no storage key is written by showing it', () => {
    const a = harness()
    a.refresh()
    expect(card()).toBeNull()
    a.promptDue()
    expect(card()).not.toBeNull()
    expect(card()!.getAttribute('aria-label')).toBe('Enregistrer votre travail')
    expect(card()!.textContent).toContain('Enregistrez votre travail')
    expect([...card()!.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Créer un compte', 'Se connecter', 'Fermer'])
    expect(storage.data.size).toBe(0)
  })
  it('« Créer un compte » opens sign-up and dismisses it for good (remembered in the record)', async () => {
    const a = harness()
    a.promptDue()
    ;(document.querySelector('[data-testid="account-prompt-signup"]') as HTMLButtonElement).click()
    await flush()
    expect(card()).toBeNull()
    expect(log).toContain('signup')
    expect(JSON.parse(storage.data.get(ONBOARDING_KEY)!)).toMatchObject({ accountPrompt: 'dismissed' })
    const again = harness()
    again.promptDue()
    expect(card()).toBeNull()
  })
  it('« Fermer » dismisses it and gives the focus back; nothing is loaded', () => {
    const a = harness()
    a.promptDue()
    ;(document.querySelector('[data-testid="account-prompt-dismiss"]') as HTMLButtonElement).click()
    expect(card()).toBeNull()
    expect(log).toEqual(['focus'])
    expect(loads).toBe(0)
  })
  it('never on an exam address (read live), nor with no place open', () => {
    practice = false
    const a = harness()
    a.promptDue()
    expect(card()).toBeNull()
    practice = true
    place = false
    a.refresh()
    expect(card()).toBeNull()
    place = true
    a.refresh()
    expect(card()).not.toBeNull()
    practice = false
    a.refresh()
    expect(card()).toBeNull()
  })
  it('waits while the tutorial’s card holds the row, and shows once it has left', () => {
    openTutorialSlot(document)
    const a = harness()
    a.promptDue()
    expect(card()).toBeNull()
    closeTutorialSlot(document)
    a.refresh()
    expect(card()).not.toBeNull()
  })
  it('without the onboarding record (no onboarding on this address): no card', () => {
    const a = harness({ store: null })
    a.promptDue()
    expect(card()).toBeNull()
  })
})

describe('the menu entries', () => {
  const menus = (actions: Record<string, () => void>, signedIn = false) =>
    buildMenus({ history: new History({ subscribe: () => () => undefined } as never), actions, bindingLabel: () => undefined, accountSignedIn: () => signedIn })
      .find((m) => m.id === 'projet')!
      .items.map((i) => i.label)
  it('are absent where the page registered none (the product: the switch is off)', () => {
    expect(menus({})).not.toContain('Mon compte')
    expect(menus({})).not.toContain('Se connecter')
  })
  it('« Mon compte » and « Se connecter » while signed out; « Mon compte » alone once signed in', () => {
    const noop = (): void => undefined
    expect(menus({ account: noop, 'sign-in': noop }).slice(-2)).toEqual(['Mon compte', 'Se connecter'])
    expect(menus({ account: noop, 'sign-in': noop }, true).slice(-1)).toEqual(['Mon compte'])
    expect(menus({ account: noop, 'sign-in': noop }, true)).not.toContain('Se connecter')
  })
})
