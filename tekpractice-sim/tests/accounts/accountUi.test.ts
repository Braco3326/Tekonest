// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type AccountUiDeps, type AccountUiHandle, mountAccountUi } from '../../src/accounts/accountUi'
import { type FakeService, createFakeService } from '../../src/accounts/fakeService'
import { normaliseProfile } from '../../src/accounts/profileModel'

const SCHOOLS = [
  { id: 'ecole.avignon-universite-avignon', name: 'Avignon Université', cities: ['Avignon'] },
  { id: 'ecole.lycee-x', name: 'Lycée X' },
]
const STUDY_GOAL = 'etudie.bts-mav-son'
const OTHER_GOAL = 'decouvre.curieux'
const NOW = new Date('2026-11-15T10:00:00.000Z')

const ALLOWED_FIELD_NAMES = new Set(['consent', 'ageRange', 'parentConfirmation', 'email', 'password', 'firstName', 'region', 'school', 'schoolOther'])

let trigger: HTMLButtonElement
let fake: FakeService
let handle: AccountUiHandle

const dialog = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`)
const anyDialog = (): HTMLElement | null => document.querySelector('[role="dialog"]')
const q = <T extends HTMLElement>(box: HTMLElement, sel: string): T | null => box.querySelector<T>(sel)
const button = (box: HTMLElement, label: string): HTMLButtonElement => {
  const b = [...box.querySelectorAll('button')].find((x) => x.textContent === label)
  if (!b) throw new Error('no button « ' + label + ' » in ' + box.dataset.testid)
  return b
}
const waitFor = (id: string): Promise<HTMLElement> => vi.waitFor(() => {
  const d = dialog(id)
  if (!d) throw new Error('dialog ' + id + ' not open; open: ' + (anyDialog()?.dataset.testid ?? 'none'))
  return d
})
const type = (input: HTMLInputElement, value: string): void => {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
const choose = (select: HTMLSelectElement, value: string): void => {
  select.value = value
  select.dispatchEvent(new Event('change', { bubbles: true }))
}
const escape = (box: HTMLElement): void => {
  box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
}
const alertText = (box: HTMLElement): string => box.querySelector('[role="alert"]')?.textContent ?? ''
const fieldNames = (box: HTMLElement): string[] => [...box.querySelectorAll<HTMLInputElement>('input[name], select[name]')].map((i) => i.name)

async function mount(over: Partial<AccountUiDeps> = {}): Promise<void> {
  handle = await mountAccountUi({ service: fake, schools: SCHOOLS, now: () => NOW, getGoal: () => STUDY_GOAL, parent: document.body, ...over })
}

/** Consent ticked and sent. */
async function passConsent(): Promise<HTMLElement> {
  const c = await waitFor('acc-consent')
  q<HTMLInputElement>(c, '[name=consent]')!.click()
  button(c, 'Continuer').click()
  return waitFor('acc-signup')
}

/** Fill the sign-up form with an age range and valid credentials. */
function fillSignUp(box: HTMLElement, age: string, email = 'sam@example.org'): void {
  choose(q<HTMLSelectElement>(box, '[name=ageRange]')!, age)
  type(q<HTMLInputElement>(box, '[name=email]')!, email)
  type(q<HTMLInputElement>(box, '[name=password]')!, 'motdepasse1')
}

beforeEach(() => {
  document.body.innerHTML = '<button id="trigger">Compte</button>'
  trigger = document.getElementById('trigger') as HTMLButtonElement
  trigger.focus()
  fake = createFakeService()
  history.replaceState({}, '', '/')
})

afterEach(() => {
  handle?.dispose()
  document.body.innerHTML = ''
})

describe('mounting', () => {
  it('shows nothing and calls nothing until an open method is used', async () => {
    await mount()
    expect(anyDialog()).toBeNull()
    expect(fake.state.users.size).toBe(0)
    expect(fake.state.googleStarted).toBe(0)
  })

  it('forwards sign-in and sign-out to onAccountChange', async () => {
    const seen: (string | null)[] = []
    await mount({ onAccountChange: (u) => seen.push(u?.email ?? null) })
    await fake.signUpEmail('a@b.co', 'motdepasse1')
    await fake.signOut()
    expect(seen).toEqual(['a@b.co', null])
  })
})

describe('consent first', () => {
  it('opens an accessible dialog with the privacy text visible and an unticked box', async () => {
    await mount()
    void handle.openSignUp()
    const c = await waitFor('acc-consent')
    expect(c.getAttribute('role')).toBe('dialog')
    expect(c.getAttribute('aria-modal')).toBe('true')
    const title = document.getElementById(c.getAttribute('aria-labelledby') ?? '')
    expect(title?.textContent).toBe('Créer votre compte')
    expect(q(c, '.acc-notice')?.textContent).toContain('[responsable de traitement à compléter]')
    expect(c.textContent).toContain('à valider')
    const box = q<HTMLInputElement>(c, '[name=consent]')!
    expect(box.type).toBe('checkbox')
    expect(box.checked).toBe(false)
  })

  it('does not move on without the consent, and says why', async () => {
    await mount()
    void handle.openSignUp()
    const c = await waitFor('acc-consent')
    button(c, 'Continuer').click()
    expect(dialog('acc-consent')).not.toBeNull()
    expect(dialog('acc-signup')).toBeNull()
    expect(alertText(c)).toMatch(/consentement est nécessaire/)
    expect(document.activeElement).toBe(q(c, '[name=consent]'))
  })

  it('ticking the box lets the learner on to the sign-up form', async () => {
    await mount()
    void handle.openSignUp()
    const s = await passConsent()
    expect(s.dataset.testid).toBe('acc-signup')
  })

  it('« Annuler » closes it and nothing was created', async () => {
    await mount()
    void handle.openSignUp()
    const c = await waitFor('acc-consent')
    button(c, 'Annuler').click()
    await vi.waitFor(() => expect(anyDialog()).toBeNull())
    expect(fake.state.users.size).toBe(0)
  })
})

describe('under-15 gate', () => {
  it('shows the parent box only for « moins de 15 ans »', async () => {
    await mount()
    void handle.openSignUp()
    const s = await passConsent()
    expect(q(s, '[name=parentConfirmation]')).toBeNull()
    choose(q<HTMLSelectElement>(s, '[name=ageRange]')!, '-15')
    expect(q(s, '[name=parentConfirmation]')).not.toBeNull()
    choose(q<HTMLSelectElement>(s, '[name=ageRange]')!, '18-21')
    expect(q(s, '[name=parentConfirmation]')).toBeNull()
  })

  it('creates no account and starts no Google flow without the parent confirmation', async () => {
    await mount()
    void handle.openSignUp()
    const s = await passConsent()
    fillSignUp(s, '-15')
    expect(q(s, '.acc-note')?.textContent).toMatch(/parent ou d’un tuteur/)
    button(s, 'Créer le compte').click()
    await Promise.resolve()
    expect(fake.state.users.size).toBe(0)
    expect(alertText(s)).toMatch(/ne peut pas être créé/)
    button(s, 'Continuer avec Google').click()
    await Promise.resolve()
    expect(fake.state.googleStarted).toBe(0)
  })

  it('with the parent confirmation the account is created', async () => {
    await mount()
    void handle.openSignUp()
    const s = await passConsent()
    fillSignUp(s, '-15')
    q<HTMLInputElement>(s, '[name=parentConfirmation]')!.click()
    expect(q(s, '.acc-note')?.textContent).toBe('')
    button(s, 'Créer le compte').click()
    await waitFor('acc-profile')
    expect(fake.state.users.size).toBe(1)
  })

  it('requires an age range before anything is created', async () => {
    await mount()
    void handle.openSignUp()
    const s = await passConsent()
    type(q<HTMLInputElement>(s, '[name=email]')!, 'sam@example.org')
    type(q<HTMLInputElement>(s, '[name=password]')!, 'motdepasse1')
    button(s, 'Créer le compte').click()
    await Promise.resolve()
    expect(alertText(s)).toMatch(/tranche d’âge/)
    expect(fake.state.users.size).toBe(0)
  })
})

describe('sign-up form', () => {
  it('refuses a bad e-mail or a short password in place', async () => {
    await mount()
    void handle.openSignUp()
    const s = await passConsent()
    choose(q<HTMLSelectElement>(s, '[name=ageRange]')!, '22-25')
    type(q<HTMLInputElement>(s, '[name=email]')!, 'pas-un-email')
    type(q<HTMLInputElement>(s, '[name=password]')!, 'motdepasse1')
    button(s, 'Créer le compte').click()
    expect(alertText(s)).toMatch(/adresse e-mail/)
    type(q<HTMLInputElement>(s, '[name=email]')!, 'sam@example.org')
    type(q<HTMLInputElement>(s, '[name=password]')!, 'court')
    button(s, 'Créer le compte').click()
    expect(alertText(s)).toMatch(/au moins 8 caractères/)
    expect(fake.state.users.size).toBe(0)
  })

  it('shows the provider failure in French (address already used)', async () => {
    await fake.signUpEmail('sam@example.org', 'motdepasse1')
    await fake.signOut()
    await mount()
    void handle.openSignUp()
    const s = await passConsent()
    fillSignUp(s, '22-25')
    button(s, 'Créer le compte').click()
    await vi.waitFor(() => expect(alertText(s)).toMatch(/déjà utilisée/))
    expect(dialog('acc-signup')).not.toBeNull()
  })

  it('starts the Google flow once the gate is passed', async () => {
    await mount()
    void handle.openSignUp()
    const s = await passConsent()
    choose(q<HTMLSelectElement>(s, '[name=ageRange]')!, '26-30')
    button(s, 'Continuer avec Google').click()
    await vi.waitFor(() => expect(fake.state.googleStarted).toBe(1))
  })

  it('with e-mail confirmation on, tells the learner to check the mailbox', async () => {
    fake = createFakeService({ emailConfirmation: true })
    await mount()
    void handle.openSignUp()
    const s = await passConsent()
    fillSignUp(s, '22-25')
    button(s, 'Créer le compte').click()
    const info = await waitFor('acc-confirm')
    expect(info.textContent).toMatch(/boîte mail/)
  })

  it('the password field is a password field with the right autocomplete', async () => {
    await mount()
    void handle.openSignUp()
    const s = await passConsent()
    const p = q<HTMLInputElement>(s, '[name=password]')!
    expect(p.type).toBe('password')
    expect(p.getAttribute('autocomplete')).toBe('new-password')
  })
})

describe('profile form: fields per age and goal', () => {
  async function toProfile(age: string, over: Partial<AccountUiDeps> = {}, confirm = false): Promise<HTMLElement> {
    await mount(over)
    void handle.openSignUp()
    const s = await passConsent()
    fillSignUp(s, age)
    if (confirm) q<HTMLInputElement>(s, '[name=parentConfirmation]')!.click()
    button(s, 'Créer le compte').click()
    return waitFor('acc-profile')
  }

  it('under 15 without confirmation: only the age range, the goal and the parent box', async () => {
    // The parent box was ticked at sign-up; untick it here to see the locked profile.
    const p = await toProfile('-15', {}, true)
    expect(fieldNames(p)).toEqual(['ageRange', 'parentConfirmation', 'firstName', 'region', 'school'])
    q<HTMLInputElement>(p, '[name=parentConfirmation]')!.click()
    expect(fieldNames(p)).toEqual(['ageRange', 'parentConfirmation'])
    expect(q(p, '[data-field=goal]')).not.toBeNull()
    button(p, 'Enregistrer').click()
    expect(alertText(p)).toMatch(/ne peut pas être créé/)
    expect(fake.state.profiles.size).toBe(0)
  })

  it('15 and over: first name and region; no parent box', async () => {
    const p = await toProfile('22-25', { getGoal: () => OTHER_GOAL })
    expect(fieldNames(p)).toEqual(['ageRange', 'firstName', 'region'])
  })

  it('a study goal adds the school dropdown, fed by the schools dependency, with « Autre établissement »', async () => {
    const p = await toProfile('22-25')
    expect(fieldNames(p)).toEqual(['ageRange', 'firstName', 'region', 'school'])
    const select = q<HTMLSelectElement>(p, '[name=school]')!
    expect([...select.options].map((o) => o.text)).toEqual(['Choisissez votre établissement…', 'Avignon Université (Avignon)', 'Lycée X', 'Autre établissement'])
    expect(q(p, '[name=schoolOther]')).toBeNull()
    choose(select, '__other')
    const other = q<HTMLInputElement>(p, '[name=schoolOther]')!
    expect(other.maxLength).toBe(80)
  })

  it('never shows a birthdate, phone, employer or address field, whatever the age', async () => {
    for (const age of ['-15', '15-17', '41+']) {
      document.body.innerHTML = '<button id="trigger">Compte</button>'
      fake = createFakeService()
      const p = await toProfile(age, {}, age === '-15')
      for (const n of fieldNames(p)) expect(ALLOWED_FIELD_NAMES.has(n), n).toBe(true)
      handle.dispose()
    }
    const c = document.body
    expect(c.querySelector('input[type=tel], input[type=date], [name=employer], [name=phone], [name=address], [name=birthdate]')).toBeNull()
  })

  it('shows the goal read-only, with its label when the integrator gives one', async () => {
    const p = await toProfile('22-25', { describeGoal: (g) => (g === STUDY_GOAL ? 'BTS Métiers de l’audiovisuel, son' : null) })
    expect(q(p, '[data-field=goal]')?.textContent).toContain('BTS Métiers de l’audiovisuel, son')
  })

  it('saves the profile with the goal id and a list school, then shows « Mon compte »', async () => {
    const p = await toProfile('22-25')
    type(q<HTMLInputElement>(p, '[name=firstName]')!, '  Sam ')
    type(q<HTMLInputElement>(p, '[name=region]')!, 'Vaucluse')
    choose(q<HTMLSelectElement>(p, '[name=school]')!, 'ecole.avignon-universite-avignon')
    button(p, 'Enregistrer').click()
    const account = await waitFor('acc-account')
    const stored = [...fake.state.profiles.values()][0]
    expect(stored).toMatchObject({
      ageRange: '22-25',
      goal: STUDY_GOAL,
      firstName: 'Sam',
      region: 'Vaucluse',
      school: 'ecole.avignon-universite-avignon',
      parentalConfirmation: false,
      consentAt: NOW.toISOString(),
    })
    expect(Object.keys(stored).sort()).toEqual(['ageRange', 'consentAt', 'firstName', 'goal', 'parentalConfirmation', 'region', 'school'])
    expect(account.textContent).toContain('sam@example.org')
    expect(account.textContent).toContain('Avignon Université')
  })

  it('stores a typed school as autre: plus the text, and asks for the name when « Autre » is empty', async () => {
    const p = await toProfile('22-25')
    choose(q<HTMLSelectElement>(p, '[name=school]')!, '__other')
    button(p, 'Enregistrer').click()
    expect(alertText(p)).toMatch(/nom de votre établissement/)
    expect(fake.state.profiles.size).toBe(0)
    type(q<HTMLInputElement>(p, '[name=schoolOther]')!, 'Lycée Pasteur')
    button(p, 'Enregistrer').click()
    await waitFor('acc-account')
    expect([...fake.state.profiles.values()][0].school).toBe('autre:Lycée Pasteur')
  })

  it('does not keep a school when the goal is not a study goal', async () => {
    const p = await toProfile('22-25', { getGoal: () => OTHER_GOAL })
    button(p, 'Enregistrer').click()
    await waitFor('acc-account')
    expect([...fake.state.profiles.values()][0].school).toBeNull()
  })

  it('« Plus tard » leaves without a profile', async () => {
    const p = await toProfile('22-25')
    button(p, 'Plus tard').click()
    await vi.waitFor(() => expect(anyDialog()).toBeNull())
    expect(fake.state.profiles.size).toBe(0)
  })
})

describe('log-in', () => {
  it('says a wrong password in French and stays', async () => {
    await fake.signUpEmail('sam@example.org', 'motdepasse1')
    await fake.signOut()
    await mount()
    void handle.openLogIn()
    const d = await waitFor('acc-login')
    type(q<HTMLInputElement>(d, '[name=email]')!, 'sam@example.org')
    type(q<HTMLInputElement>(d, '[name=password]')!, 'mauvais-mot-de-passe')
    button(d, 'Se connecter').click()
    await vi.waitFor(() => expect(alertText(d)).toMatch(/incorrect/))
    expect(await fake.currentUser()).toBeNull()
  })

  it('logs in and shows « Mon compte » with the stored profile', async () => {
    await fake.signUpEmail('sam@example.org', 'motdepasse1')
    const r = normaliseProfile({ ageRange: '22-25', firstName: 'Sam', consentAt: NOW.toISOString() })
    if (!r.ok) throw new Error('fixture')
    await fake.saveProfile(r.profile)
    await fake.signOut()
    await mount()
    void handle.openLogIn()
    const d = await waitFor('acc-login')
    type(q<HTMLInputElement>(d, '[name=email]')!, 'sam@example.org')
    type(q<HTMLInputElement>(d, '[name=password]')!, 'motdepasse1')
    button(d, 'Se connecter').click()
    const a = await waitFor('acc-account')
    expect(a.textContent).toContain('Sam')
    expect(a.textContent).toContain('22 à 25 ans')
  })

  it('can switch to sign-up and back', async () => {
    await mount()
    void handle.openLogIn()
    const d = await waitFor('acc-login')
    button(d, 'Pas encore de compte ? Créer un compte').click()
    await waitFor('acc-consent')
  })
})

describe('« Mon compte »', () => {
  async function signedInWithProfile(): Promise<void> {
    await fake.signUpEmail('sam@example.org', 'motdepasse1')
    const r = normaliseProfile({ ageRange: '22-25', goal: STUDY_GOAL, firstName: 'Sam', school: 'autre:Lycée Pasteur', consentAt: NOW.toISOString() }, { isStudent: true })
    if (!r.ok) throw new Error('fixture')
    await fake.saveProfile(r.profile)
  }

  it('open() on a signed-in learner shows the account, with the privacy text one click away', async () => {
    await signedInWithProfile()
    await mount()
    void handle.open()
    const a = await waitFor('acc-account')
    expect(a.textContent).toContain('Lycée Pasteur')
    expect(q(a, 'details')?.textContent).toContain('Vos données')
    expect(() => button(a, 'Se déconnecter')).not.toThrow()
    expect(() => button(a, 'Supprimer mon compte')).not.toThrow()
  })

  it('« Se déconnecter » signs out', async () => {
    await signedInWithProfile()
    await mount()
    void handle.open()
    const a = await waitFor('acc-account')
    button(a, 'Se déconnecter').click()
    await vi.waitFor(() => expect(anyDialog()).toBeNull())
    expect(await fake.currentUser()).toBeNull()
    expect(fake.state.profiles.size).toBe(1) // signing out keeps the account
  })

  it('« Supprimer mon compte » asks first, says it cannot be undone, and « Annuler » changes nothing', async () => {
    await signedInWithProfile()
    await mount()
    void handle.open()
    const a = await waitFor('acc-account')
    button(a, 'Supprimer mon compte').click()
    const c = await waitFor('acc-delete')
    expect(c.textContent).toMatch(/ne peut pas être annulée/)
    expect(document.activeElement).toBe(button(c, 'Annuler'))
    button(c, 'Annuler').click()
    await vi.waitFor(() => expect(anyDialog()).toBeNull())
    expect(fake.state.users.size).toBe(1)
    expect(await fake.currentUser()).not.toBeNull()
  })

  it('confirming deletes the profile and the user and signs out', async () => {
    await signedInWithProfile()
    const seen: (string | null)[] = []
    await mount({ onAccountChange: (u) => seen.push(u?.email ?? null) })
    void handle.open()
    const a = await waitFor('acc-account')
    button(a, 'Supprimer mon compte').click()
    const c = await waitFor('acc-delete')
    button(c, 'Supprimer définitivement').click()
    const done = await waitFor('acc-deleted')
    expect(done.textContent).toMatch(/supprimé/)
    expect(fake.state.users.size).toBe(0)
    expect(fake.state.profiles.size).toBe(0)
    expect(await fake.currentUser()).toBeNull()
    expect(seen[seen.length - 1]).toBeNull()
  })

  it('says so when the deletion fails, and the account stays', async () => {
    await signedInWithProfile()
    fake.state.offline = true
    await mount()
    void handle.open()
    const a = await waitFor('acc-account')
    button(a, 'Supprimer mon compte').click()
    const c = await waitFor('acc-delete')
    button(c, 'Supprimer définitivement').click()
    const err = await waitFor('acc-error')
    expect(err.textContent).toMatch(/connexion a échoué/)
    expect(fake.state.users.size).toBe(1)
  })

  it('a signed-in learner with no profile is taken to consent then the profile form', async () => {
    await fake.signUpEmail('sam@example.org', 'motdepasse1')
    await mount()
    void handle.open()
    const c = await waitFor('acc-consent')
    expect(q(c, 'button.acc-link')).toBeNull() // no « se connecter » link: already signed in
    q<HTMLInputElement>(c, '[name=consent]')!.click()
    button(c, 'Continuer').click()
    await waitFor('acc-profile')
  })
})

describe('coming back from the sign-in redirect', () => {
  it('resumes the profile step by itself when the URL carries a sign-in code and there is no profile', async () => {
    history.replaceState({}, '', '/?code=abc123')
    await fake.signUpEmail('sam@example.org', 'motdepasse1')
    await mount()
    await waitFor('acc-consent')
  })

  it('does nothing by itself on a plain address', async () => {
    await fake.signUpEmail('sam@example.org', 'motdepasse1')
    await mount()
    await Promise.resolve()
    expect(anyDialog()).toBeNull()
  })
})

describe('keyboard, focus and one dialog at a time', () => {
  it('Escape closes a dialog and focus returns to the control that opened it', async () => {
    await mount()
    trigger.focus()
    void handle.openSignUp()
    const c = await waitFor('acc-consent')
    expect(c.contains(document.activeElement)).toBe(true)
    escape(c)
    await vi.waitFor(() => expect(anyDialog()).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })

  it('Escape works on every dialog of the path and creates nothing', async () => {
    await mount()
    void handle.openSignUp()
    const s = await passConsent()
    escape(s)
    await vi.waitFor(() => expect(anyDialog()).toBeNull())
    expect(document.activeElement).toBe(trigger)
    expect(fake.state.users.size).toBe(0)
  })

  it('Escape on « Mon compte » closes it and keeps the session', async () => {
    await fake.signUpEmail('sam@example.org', 'motdepasse1')
    const r = normaliseProfile({ ageRange: '22-25', consentAt: NOW.toISOString() })
    if (!r.ok) throw new Error('fixture')
    await fake.saveProfile(r.profile)
    await mount()
    void handle.open()
    const a = await waitFor('acc-account')
    escape(a)
    await vi.waitFor(() => expect(anyDialog()).toBeNull())
    expect(await fake.currentUser()).not.toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('keeps focus inside with two edge sentinels, and makes the page behind inert', async () => {
    await mount()
    void handle.openSignUp()
    const c = await waitFor('acc-consent')
    expect(c.querySelectorAll('[data-sentinel]').length).toBe(2)
    expect((trigger as HTMLElement & { inert?: boolean }).inert).toBe(true)
  })

  it('opening twice does not stack dialogs', async () => {
    await mount()
    void handle.openSignUp()
    void handle.openSignUp()
    void handle.open()
    await waitFor('acc-consent')
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1)
  })

  it('every dialog speaks French « vous », never the first person', async () => {
    await mount()
    void handle.openSignUp()
    const c = await waitFor('acc-consent')
    const texts = [c.textContent ?? '']
    q<HTMLInputElement>(c, '[name=consent]')!.click()
    button(c, 'Continuer').click()
    texts.push((await waitFor('acc-signup')).textContent ?? '')
    for (const t of texts) {
      const plain = t.replace(/«[^»]*»/g, '')
      expect(plain).not.toMatch(/(^|[\s(])(je|j’|mon|ma|mes|moi|nous|notre|nos)(\s|$|’)/i)
      expect(plain).toMatch(/votre|vous/i)
    }
  })
})
