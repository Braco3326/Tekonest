import { modalButton, modalRow, openModal } from '../creation/shell/modal'
import './accountUi.css'
import { type AccountService, type AccountUser, failingService, failureMessage } from './accountService'
import { AGE_RANGES, type AgeRange, ageRangeLabel, isAgeRange } from './ageRange'
import { CONSENT_TEXT, PARENT_CONFIRMATION_TEXT, PRIVACY_POLICY_LINK, PRIVACY_POLICY_URL, PRIVACY_SECTIONS, PRIVACY_TITLE, headingOf } from './consentCopy'
import { canCreateAccount, fieldsFor, isStudentGoal, needsParentConfirmation } from './fieldsFor'
import { LIMITS, OTHER_SCHOOL_PREFIX, type Profile, normaliseProfile, validateCredentials } from './profileModel'

/**
 * The account dialogs. Everything here is lazy (this module and its CSS are one chunk; the Supabase adapter is a second one, loaded with
 * a dynamic import() only when no service is injected). The integrator calls `mountAccountUi(deps)` only when `FEATURES.accounts` is on.
 *
 * Built on the shared Mode Création modal (../creation/shell/modal.ts): role="dialog", labelled, focus trap, Escape, focus returned.
 * All text is French, « vous », never the first person. A control that cannot be used yet is not silently disabled: pressing it says why,
 * in place (same convention as the project-name dialog).
 *
 * Order of the sign-up path: consent (unticked box, the privacy text visible) -> sign-up form (age range, parent confirmation under 15,
 * e-mail, password, Google) -> profile form (only the fields `fieldsFor` allows). The age gate sits BEFORE any account is created.
 */

/** One school of the list that feeds the school dropdown (content/onboarding/schools.json, supplied by the integrator). */
export interface SchoolOption {
  id: string
  name: string
  cities?: string[]
}

export interface AccountUiDeps {
  /** Tests inject the in-memory fake. In production leave it out: the Supabase adapter is then loaded with a dynamic import(). */
  service?: AccountService
  /**
   * The schools offered to students (a goal id starting with `etudie`), next to « Autre établissement ». Required: pass the parsed
   * content/onboarding/schools.json, or an empty array (then only « Autre établissement » is offered).
   */
  schools: readonly SchoolOption[]
  /** The learner's stored goal: ONE goal-tree node id (such as `etudie.bts-mav-son`), read when a form opens; null = the goal screens were skipped. */
  getGoal?: () => string | null
  /** A French label for a goal id, shown read-only in the profile form and « Mon compte ». Optional (the id is shown otherwise). */
  describeGoal?: (goalId: string) => string | null
  /** Where dialogs are mounted (default: document.body). */
  parent?: HTMLElement
  /** The current time; replaceable in tests. */
  now?: () => Date
  /** Called with the user on every sign-in and sign-out (for a header chip, a save-your-work card, ...). */
  onAccountChange?: (user: AccountUser | null) => void
}

export interface AccountUiHandle {
  /** The right dialog for the situation: « Mon compte » when signed in, the consent then sign-up path otherwise. */
  open(): Promise<void>
  /** Consent, then sign-up. */
  openSignUp(): Promise<void>
  /** Log-in. */
  openLogIn(): Promise<void>
  /** « Mon compte » (or the profile form when signed in without a profile). */
  openAccount(): Promise<void>
  /** Stops reporting auth changes. Open dialogs close with Escape as usual. */
  dispose(): void
}

interface Ctx {
  deps: AccountUiDeps
  service: AccountService
  now(): Date
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Copy (French, « vous »)
// ---------------------------------------------------------------------------------------------------------------------------------
const T = {
  consentTitle: 'Créer votre compte',
  consentBody: 'Avant de créer votre compte, lisez comment vos données sont utilisées.',
  consentMissing: 'Cochez la case pour continuer : le consentement est nécessaire pour créer un compte.',
  continue: 'Continuer',
  cancel: 'Annuler',
  later: 'Plus tard',
  close: 'Fermer',
  haveAccount: 'Vous avez déjà un compte ? Se connecter',
  noAccount: 'Pas encore de compte ? Créer un compte',
  signUpTitle: 'Votre compte',
  signUpBody: 'Indiquez votre tranche d’âge, puis votre adresse e-mail et un mot de passe, ou continuez avec Google.',
  ageLabel: 'Votre tranche d’âge',
  agePlaceholder: 'Choisissez…',
  ageMissing: 'Choisissez votre tranche d’âge.',
  under15Gate:
    'Sans la confirmation d’un parent ou d’un tuteur, le compte ne peut pas être créé. Vous pouvez continuer à jouer sans compte : votre travail reste sur votre appareil.',
  email: 'Adresse e-mail',
  password: 'Mot de passe',
  passwordHint: 'Au moins 8 caractères.',
  createAccount: 'Créer le compte',
  google: 'Continuer avec Google',
  or: 'ou',
  confirmTitle: 'Vérifiez votre boîte mail',
  confirmBody:
    'Un message de confirmation vient d’être envoyé. Suivez le lien qu’il contient : vous reviendrez ici et pourrez terminer votre profil.',
  googleWait: 'Redirection vers Google…',
  profileTitle: 'Votre profil',
  profileBody: 'Ces informations restent sur votre compte. Les champs facultatifs peuvent rester vides.',
  firstName: 'Prénom (facultatif)',
  region: 'Ville ou région (facultatif)',
  school: 'Établissement (facultatif)',
  schoolPlaceholder: 'Choisissez votre établissement…',
  schoolOther: 'Autre établissement',
  schoolOtherLabel: 'Nom de votre établissement',
  schoolOtherMissing: 'Indiquez le nom de votre établissement, ou choisissez-en un dans la liste.',
  goalLabel: 'Votre but',
  noGoal: 'Aucun but choisi pour le moment.',
  save: 'Enregistrer',
  loginTitle: 'Se connecter',
  loginBody: 'Saisissez l’adresse e-mail et le mot de passe de votre compte.',
  login: 'Se connecter',
  accountTitle: 'Mon compte',
  signedInAs: 'Connecté(e) avec',
  noProfile: 'Aucun profil enregistré.',
  profileLoadFailed: 'Le profil n’a pas pu être chargé pour le moment.',
  dataDetails: 'Vos données et votre confidentialité',
  signOut: 'Se déconnecter',
  deleteAccount: 'Supprimer mon compte',
  deleteTitle: 'Supprimer votre compte ?',
  deleteBody:
    'Cette action est définitive et ne peut pas être annulée : votre profil et votre connexion seront effacés. Votre travail enregistré sur cet appareil est conservé.',
  deleteConfirm: 'Supprimer définitivement',
  deletedTitle: 'Compte supprimé',
  deletedBody: 'Votre compte a été supprimé. Votre travail enregistré sur cet appareil est conservé.',
  summary: { firstName: 'Prénom', age: 'Tranche d’âge', region: 'Ville ou région', school: 'Établissement', goal: 'But' },
} as const

// ---------------------------------------------------------------------------------------------------------------------------------
// Small DOM helpers
// ---------------------------------------------------------------------------------------------------------------------------------
let uid = 0
const nextId = (p: string): string => `${p}-${++uid}`

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

function errorBox(id: string): HTMLParagraphElement {
  const p = el('p', 'cr-dialog-error')
  p.id = id
  p.setAttribute('role', 'alert')
  return p
}

function say(box: HTMLElement, message: string, focus?: HTMLElement): void {
  box.textContent = message
  if (focus) {
    focus.setAttribute('aria-invalid', 'true')
    focus.focus()
  }
}

function clearInvalid(...inputs: HTMLElement[]): void {
  for (const i of inputs) i.removeAttribute('aria-invalid')
}

interface TextField {
  row: HTMLDivElement
  input: HTMLInputElement
}

function textField(label: string, name: string, o: { type?: string; autocomplete?: string; maxLength?: number; value?: string; hint?: string }): TextField {
  const id = nextId(`acc-${name}`)
  const row = el('div', 'acc-field')
  const l = el('label', 'cr-dialog-label', label)
  l.htmlFor = id
  const input = el('input', 'cr-dialog-input')
  input.id = id
  input.name = name
  input.type = o.type ?? 'text'
  input.setAttribute('autocomplete', o.autocomplete ?? 'off')
  if (o.maxLength) input.maxLength = o.maxLength
  input.value = o.value ?? ''
  row.append(l, input)
  if (o.hint) {
    const hint = el('p', 'acc-hint', o.hint)
    hint.id = `${id}-hint`
    input.setAttribute('aria-describedby', hint.id)
    row.append(hint)
  }
  return { row, input }
}

interface CheckField {
  row: HTMLDivElement
  input: HTMLInputElement
}

function checkField(label: string, name: string, checked = false): CheckField {
  const id = nextId(`acc-${name}`)
  const row = el('div', 'acc-check')
  const input = el('input')
  input.type = 'checkbox'
  input.id = id
  input.name = name
  input.checked = checked
  const l = el('label', undefined, label)
  l.htmlFor = id
  row.append(input, l)
  return { row, input }
}

interface AgeField {
  row: HTMLDivElement
  select: HTMLSelectElement
}

function ageField(value: AgeRange | null): AgeField {
  const id = nextId('acc-age')
  const row = el('div', 'acc-field')
  const l = el('label', 'cr-dialog-label', T.ageLabel)
  l.htmlFor = id
  const select = el('select', 'cr-dialog-input')
  select.id = id
  select.name = 'ageRange'
  const none = el('option', undefined, T.agePlaceholder)
  none.value = ''
  select.append(none)
  for (const r of AGE_RANGES) {
    const o = el('option', undefined, ageRangeLabel(r))
    o.value = r
    select.append(o)
  }
  select.value = value ?? ''
  row.append(l, select)
  return { row, select }
}

const ageOf = (select: HTMLSelectElement): AgeRange | null => (isAgeRange(select.value) ? select.value : null)

/** The paragraphs of a legal section as DOM: « - » lines become list items. */
function renderParagraphs(parent: HTMLElement, paragraphs: readonly string[]): void {
  let list: HTMLUListElement | null = null
  for (const p of paragraphs) {
    if (p.startsWith('- ')) {
      if (!list) {
        list = el('ul')
        parent.append(list)
      }
      list.append(el('li', undefined, p.slice(2)))
    } else {
      list = null
      parent.append(el('p', undefined, p))
    }
  }
}

function privacyNotice(): HTMLDivElement {
  const box = el('div', 'acc-notice')
  box.tabIndex = 0
  box.setAttribute('role', 'region')
  box.setAttribute('aria-label', PRIVACY_TITLE)
  for (const s of PRIVACY_SECTIONS) {
    box.append(el('h3', undefined, headingOf(s)))
    renderParagraphs(box, s.paragraphs)
  }
  return box
}

/** The visible link to the full public policy (a new tab: the dialog and the learner's work stay where they are). */
function policyLink(): HTMLParagraphElement {
  const p = el('p', 'acc-policy')
  const a = el('a', undefined, PRIVACY_POLICY_LINK)
  a.href = PRIVACY_POLICY_URL
  a.target = '_blank'
  a.rel = 'noopener'
  p.append(a)
  return p
}

const OTHER_VALUE = '__other'

interface SchoolField {
  row: HTMLDivElement
  select: HTMLSelectElement
  other: TextField
  /** The value to store (a list id, or autre: + text), null when empty; 'missing' when « Autre » is chosen with no name. */
  value(): string | null | 'missing'
}

/** The school dropdown (the list + « Autre établissement ») and, when « Autre » is chosen, a free-text field of 80 characters. */
function schoolField(schools: readonly SchoolOption[], current: string | null): SchoolField {
  const id = nextId('acc-school')
  const row = el('div', 'acc-field')
  const l = el('label', 'cr-dialog-label', T.school)
  l.htmlFor = id
  const select = el('select', 'cr-dialog-input')
  select.id = id
  select.name = 'school'
  const none = el('option', undefined, T.schoolPlaceholder)
  none.value = ''
  select.append(none)
  for (const s of schools) {
    const o = el('option', undefined, s.cities && s.cities.length > 0 ? `${s.name} (${s.cities.join(', ')})` : s.name)
    o.value = s.id
    select.append(o)
  }
  const other = el('option', undefined, T.schoolOther)
  other.value = OTHER_VALUE
  select.append(other)
  const text = textField(T.schoolOtherLabel, 'schoolOther', { autocomplete: 'organization', maxLength: LIMITS.school })
  if (current !== null && current.startsWith(OTHER_SCHOOL_PREFIX)) {
    select.value = OTHER_VALUE
    text.input.value = current.slice(OTHER_SCHOOL_PREFIX.length)
  } else if (current !== null && schools.some((s) => s.id === current)) {
    select.value = current
  }
  row.append(l, select)
  const sync = (): void => {
    if (select.value === OTHER_VALUE) {
      if (!text.row.isConnected) row.append(text.row)
    } else text.row.remove()
  }
  select.addEventListener('change', sync)
  sync()
  return {
    row,
    select,
    other: text,
    value() {
      if (select.value === '') return null
      if (select.value === OTHER_VALUE) {
        const v = text.input.value.trim()
        return v === '' ? 'missing' : OTHER_SCHOOL_PREFIX + v
      }
      return select.value
    },
  }
}

/** How a stored school reads in « Mon compte »: the list name, or the typed text. */
function schoolName(schools: readonly SchoolOption[], stored: string | null): string | null {
  if (stored === null) return null
  if (stored.startsWith(OTHER_SCHOOL_PREFIX)) return stored.slice(OTHER_SCHOOL_PREFIX.length)
  return schools.find((s) => s.id === stored)?.name ?? null
}

const draftLabel = (s: { paragraphs: string[]; mark: string }): string => `${s.paragraphs.join(' ')} (${s.mark})`

/** Runs `fn` with the given buttons marked busy; they come back whatever happens. */
async function busy<T2>(buttons: HTMLButtonElement[], fn: () => Promise<T2>): Promise<T2> {
  for (const b of buttons) {
    b.disabled = true
    b.setAttribute('aria-busy', 'true')
  }
  try {
    return await fn()
  } finally {
    for (const b of buttons) {
      b.disabled = false
      b.removeAttribute('aria-busy')
    }
  }
}

function openDialog<T2>(ctx: Ctx, o: { id: string; title: string; body?: string; cancel: T2; build(box: HTMLElement, done: (v: T2) => void): { first: HTMLElement; edges: () => [HTMLElement, HTMLElement] } }): Promise<T2> {
  return openModal<T2>({
    id: o.id,
    title: o.title,
    body: o.body,
    cancel: o.cancel,
    parent: ctx.deps.parent,
    build(box, done) {
      box.classList.add('acc-dialog')
      return o.build(box, done)
    },
  })
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------------------------------------------------------------

type ConsentResult = { consentAt: string } | 'login' | null

/** Consent first: the privacy text is visible, the box is unticked, nothing moves on without it. */
function consentDialog(ctx: Ctx, allowLogin: boolean): Promise<ConsentResult> {
  return openDialog<ConsentResult>(ctx, {
    id: 'acc-consent',
    title: T.consentTitle,
    body: T.consentBody,
    cancel: null,
    build(box, done) {
      const form = el('form')
      form.noValidate = true
      const notice = privacyNotice()
      const consent = checkField(draftLabel(CONSENT_TEXT), 'consent')
      const error = errorBox(nextId('acc-consent-error'))
      const next = modalButton(T.continue, true, 'submit')
      const cancel = modalButton(T.cancel, false)
      cancel.addEventListener('click', () => done(null))
      form.append(notice, policyLink(), consent.row, error, modalRow(next, cancel))
      let login: HTMLButtonElement | null = null
      if (allowLogin) {
        login = el('button', 'acc-link', T.haveAccount)
        login.type = 'button'
        login.addEventListener('click', () => done('login'))
        const p = el('p')
        p.append(login)
        form.append(p)
      }
      consent.input.addEventListener('change', () => {
        clearInvalid(consent.input)
        if (consent.input.checked) error.textContent = ''
      })
      form.addEventListener('submit', (e) => {
        e.preventDefault()
        if (!consent.input.checked) return say(error, T.consentMissing, consent.input)
        done({ consentAt: ctx.now().toISOString() })
      })
      box.append(form)
      const last = login ?? cancel
      return { first: consent.input, edges: () => [notice, last] }
    },
  })
}

type SignUpResult =
  | { kind: 'signed-in'; ageRange: AgeRange; parentConfirmed: boolean }
  | { kind: 'confirm-email' }
  | { kind: 'google' }
  | { kind: 'login' }
  | null

/** The age gate, the e-mail form and the Google button. No account is created before the gate is passed. */
function signUpDialog(ctx: Ctx): Promise<SignUpResult> {
  return openDialog<SignUpResult>(ctx, {
    id: 'acc-signup',
    title: T.signUpTitle,
    body: T.signUpBody,
    cancel: null,
    build(box, done) {
      const form = el('form')
      form.noValidate = true
      const age = ageField(null)
      const parent = checkField(draftLabel(PARENT_CONFIRMATION_TEXT), 'parentConfirmation')
      const gate = el('p', 'acc-note')
      gate.setAttribute('role', 'status')
      const email = textField(T.email, 'email', { type: 'email', autocomplete: 'email', maxLength: LIMITS.email })
      const password = textField(T.password, 'password', { type: 'password', autocomplete: 'new-password', maxLength: LIMITS.password, hint: T.passwordHint })
      const error = errorBox(nextId('acc-signup-error'))
      const submit = modalButton(T.createAccount, true, 'submit')
      const google = modalButton(T.google, false)
      google.classList.add('acc-google')
      const cancel = modalButton(T.cancel, false)
      cancel.addEventListener('click', () => done(null))
      const login = el('button', 'acc-link', T.haveAccount)
      login.type = 'button'
      login.addEventListener('click', () => done({ kind: 'login' }))
      const loginRow = el('p')
      loginRow.append(login)

      // The parent box exists only for the under-15 range; the note says why the account cannot be created yet.
      const refresh = (): void => {
        const range = ageOf(age.select)
        const under = range !== null && needsParentConfirmation(range)
        if (under) {
          if (!parent.row.isConnected) age.row.after(parent.row)
        } else {
          parent.row.remove()
          parent.input.checked = false
        }
        gate.textContent = range !== null && !canCreateAccount(range, parent.input.checked) ? T.under15Gate : ''
        clearInvalid(age.select, parent.input)
        error.textContent = ''
      }
      age.select.addEventListener('change', refresh)
      parent.input.addEventListener('change', refresh)

      /** The gate: an age range and, under 15, the parent confirmation. Returns the range, or says why not. */
      const passGate = (): AgeRange | null => {
        const range = ageOf(age.select)
        if (range === null) {
          say(error, T.ageMissing, age.select)
          return null
        }
        if (!canCreateAccount(range, parent.input.checked)) {
          say(error, T.under15Gate, parent.input)
          return null
        }
        return range
      }

      form.addEventListener('submit', (e) => {
        e.preventDefault()
        const range = passGate()
        if (range === null) return
        const v = validateCredentials(email.input.value, password.input.value, 'sign-up')
        if (!v.ok) {
          const first = v.errors[0]
          return say(error, first.message, first.field === 'email' ? email.input : password.input)
        }
        void busy([submit, google], async () => {
          const r = await ctx.service.signUpEmail(v.email, password.input.value)
          if (!r.ok) return say(error, failureMessage(r.reason))
          done(r.needsEmailConfirmation ? { kind: 'confirm-email' } : { kind: 'signed-in', ageRange: range, parentConfirmed: parent.input.checked })
        })
      })
      google.addEventListener('click', () => {
        if (passGate() === null) return
        void busy([submit, google], async () => {
          const r = await ctx.service.signInGoogle()
          if (!r.ok) return say(error, failureMessage(r.reason))
          say(error, '')
          done({ kind: 'google' })
        })
      })

      const orLine = el('p', 'acc-or', T.or)
      form.append(age.row, gate, email.row, password.row, policyLink(), error, modalRow(submit), orLine, google, modalRow(cancel), loginRow)
      box.append(form)
      return { first: age.select, edges: () => [age.select, login] }
    },
  })
}

interface ProfileDialogInput {
  consentAt: string
  ageRange?: AgeRange | null
  parentConfirmed?: boolean
  existing?: Profile | null
}

/** The profile form: exactly the fields `fieldsFor` allows for the chosen age range, recomputed as the learner changes it. */
function profileDialog(ctx: Ctx, input: ProfileDialogInput): Promise<'saved' | null> {
  const goal = ctx.deps.getGoal?.() ?? null
  return openDialog<'saved' | null>(ctx, {
    id: 'acc-profile',
    title: T.profileTitle,
    body: T.profileBody,
    cancel: null,
    build(box, done) {
      const ex = input.existing ?? null
      const form = el('form')
      form.noValidate = true
      const age = ageField(input.ageRange ?? ex?.ageRange ?? null)
      const goalRow = el('div', 'acc-field')
      goalRow.dataset.field = 'goal'
      goalRow.append(el('span', 'cr-dialog-label', T.goalLabel), el('p', 'acc-hint', goal === null ? T.noGoal : (ctx.deps.describeGoal?.(goal) ?? goal)))
      const parent = checkField(draftLabel(PARENT_CONFIRMATION_TEXT), 'parentConfirmation', input.parentConfirmed ?? ex?.parentalConfirmation ?? false)
      const firstName = textField(T.firstName, 'firstName', { autocomplete: 'given-name', maxLength: LIMITS.firstName, value: ex?.firstName ?? '' })
      const region = textField(T.region, 'region', { autocomplete: 'off', maxLength: LIMITS.region, value: ex?.region ?? '' })
      // The school is for study goals only (goal id starting with `etudie`).
      const isStudent = isStudentGoal(goal)
      const school = schoolField(ctx.deps.schools, ex?.school ?? null)
      const fieldsArea = el('div')
      const error = errorBox(nextId('acc-profile-error'))
      const submit = modalButton(T.save, true, 'submit')
      const later = modalButton(T.later, false)
      later.addEventListener('click', () => done(null))

      const rowsFor: Record<string, HTMLElement> = {
        ageRange: age.row,
        goal: goalRow,
        parentConfirmation: parent.row,
        firstName: firstName.row,
        region: region.row,
        school: school.row,
      }
      // Rows that are not allowed are taken out of the page (not just hidden): they cannot be focused, read or submitted.
      const refresh = (): void => {
        const range = ageOf(age.select)
        if (range === null) {
          fieldsArea.replaceChildren(age.row, goalRow)
          return
        }
        const fields = fieldsFor(range, { isStudent, parentConfirmed: parent.input.checked })
        fieldsArea.replaceChildren(...fields.map((f) => rowsFor[f]))
        clearInvalid(age.select, parent.input)
      }
      age.select.addEventListener('change', () => {
        refresh()
        error.textContent = ''
      })
      parent.input.addEventListener('change', () => {
        refresh()
        error.textContent = ''
      })
      refresh()

      form.addEventListener('submit', (e) => {
        e.preventDefault()
        const range = ageOf(age.select)
        if (range === null) return say(error, T.ageMissing, age.select)
        if (!canCreateAccount(range, parent.input.checked)) return say(error, T.under15Gate, parent.input)
        const schoolValue = school.value()
        const asked = fieldsFor(range, { isStudent, parentConfirmed: parent.input.checked }).includes('school')
        if (schoolValue === 'missing' && asked) return say(error, T.schoolOtherMissing, school.other.input)
        const r = normaliseProfile(
          {
            ageRange: range,
            goal,
            firstName: firstName.input.value,
            region: region.input.value,
            school: schoolValue === 'missing' ? null : schoolValue,
            parentalConfirmation: parent.input.checked,
            consentAt: ex?.consentAt ?? input.consentAt,
          },
          { isStudent }
        )
        if (!r.ok) {
          const first = r.errors[0]
          const target = first.field === 'firstName' ? firstName.input : first.field === 'region' ? region.input : first.field === 'school' ? school.select : first.field === 'ageRange' ? age.select : undefined
          return say(error, first.message, target)
        }
        void busy([submit], async () => {
          const saved = await ctx.service.saveProfile(r.profile)
          if (!saved.ok) return say(error, failureMessage(saved.reason))
          done('saved')
        })
      })

      form.append(fieldsArea, error, modalRow(submit, later))
      box.append(form)
      return { first: age.select, edges: () => [age.select, later] }
    },
  })
}

/** Log-in. */
function logInDialog(ctx: Ctx): Promise<'ok' | 'sign-up' | null> {
  return openDialog<'ok' | 'sign-up' | null>(ctx, {
    id: 'acc-login',
    title: T.loginTitle,
    body: T.loginBody,
    cancel: null,
    build(box, done) {
      const form = el('form')
      form.noValidate = true
      const email = textField(T.email, 'email', { type: 'email', autocomplete: 'email', maxLength: LIMITS.email })
      const password = textField(T.password, 'password', { type: 'password', autocomplete: 'current-password', maxLength: LIMITS.password })
      const error = errorBox(nextId('acc-login-error'))
      const submit = modalButton(T.login, true, 'submit')
      const google = modalButton(T.google, false)
      google.classList.add('acc-google')
      const cancel = modalButton(T.cancel, false)
      cancel.addEventListener('click', () => done(null))
      const create = el('button', 'acc-link', T.noAccount)
      create.type = 'button'
      create.addEventListener('click', () => done('sign-up'))
      const createRow = el('p')
      createRow.append(create)
      form.addEventListener('submit', (e) => {
        e.preventDefault()
        const v = validateCredentials(email.input.value, password.input.value, 'sign-in')
        if (!v.ok) {
          const first = v.errors[0]
          return say(error, first.message, first.field === 'email' ? email.input : password.input)
        }
        void busy([submit, google], async () => {
          const r = await ctx.service.signInEmail(v.email, password.input.value)
          if (!r.ok) return say(error, failureMessage(r.reason))
          done('ok')
        })
      })
      google.addEventListener('click', () => {
        void busy([submit, google], async () => {
          const r = await ctx.service.signInGoogle()
          if (!r.ok) return say(error, failureMessage(r.reason))
          say(error, T.googleWait)
        })
      })
      form.append(email.row, password.row, error, modalRow(submit), el('p', 'acc-or', T.or), google, modalRow(cancel), createRow)
      box.append(form)
      return { first: email.input, edges: () => [email.input, create] }
    },
  })
}

interface AccountView {
  user: AccountUser
  profile: Profile | null
  profileFailed: boolean
}

/** « Mon compte »: who is signed in, the profile, the privacy text, « Se déconnecter » and « Supprimer mon compte ». */
function accountDialog(ctx: Ctx, view: AccountView): Promise<'sign-out' | 'delete' | null> {
  return openDialog<'sign-out' | 'delete' | null>(ctx, {
    id: 'acc-account',
    title: T.accountTitle,
    cancel: null,
    build(box, done) {
      const who = el('p', undefined, `${T.signedInAs} : ${view.user.email ?? '—'}`)
      who.className = 'cr-dialog-body'
      box.append(who)
      const p = view.profile
      if (p) {
        const dl = el('dl', 'acc-summary')
        const add = (k: string, v: string | null): void => {
          if (v === null || v === '') return
          dl.append(el('dt', undefined, k), el('dd', undefined, v))
        }
        add(T.summary.firstName, p.firstName)
        add(T.summary.age, ageRangeLabel(p.ageRange))
        add(T.summary.region, p.region)
        add(T.summary.school, schoolName(ctx.deps.schools, p.school))
        add(T.summary.goal, p.goal === null ? null : (ctx.deps.describeGoal?.(p.goal) ?? p.goal))
        box.append(dl)
      } else {
        box.append(el('p', 'acc-hint', view.profileFailed ? T.profileLoadFailed : T.noProfile))
      }
      const details = el('details', 'acc-details')
      details.append(el('summary', undefined, T.dataDetails), privacyNotice())
      box.append(details, policyLink())
      const out = modalButton(T.signOut, true)
      const del = modalButton(T.deleteAccount, false)
      del.classList.add('acc-danger')
      const close = modalButton(T.close, false)
      out.addEventListener('click', () => done('sign-out'))
      del.addEventListener('click', () => done('delete'))
      close.addEventListener('click', () => done(null))
      box.append(modalRow(out, del, close))
      const summary = details.querySelector('summary') as HTMLElement
      return { first: out, edges: () => [summary, close] }
    },
  })
}

/** The deletion confirmation. Focus starts on « Annuler »: the safe answer is the one under the finger. */
function confirmDeleteDialog(ctx: Ctx): Promise<boolean> {
  return openDialog<boolean>(ctx, {
    id: 'acc-delete',
    title: T.deleteTitle,
    body: T.deleteBody,
    cancel: false,
    build(box, done) {
      const cancel = modalButton(T.cancel, true)
      const confirm = modalButton(T.deleteConfirm, false)
      confirm.classList.add('acc-danger')
      cancel.addEventListener('click', () => done(false))
      confirm.addEventListener('click', () => done(true))
      box.append(modalRow(cancel, confirm))
      return { first: cancel, edges: () => [cancel, confirm] }
    },
  })
}

/** A message with one « Fermer » button. */
function infoDialog(ctx: Ctx, id: string, title: string, body: string): Promise<void> {
  return openDialog<void>(ctx, {
    id,
    title,
    body,
    cancel: undefined,
    build(box, done) {
      const close = modalButton(T.close, true)
      close.addEventListener('click', () => done(undefined))
      box.append(modalRow(close))
      return { first: close, edges: () => [close, close] }
    },
  })
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Flows
// ---------------------------------------------------------------------------------------------------------------------------------

/** True when the page was just opened by a redirect back from the sign-in provider or from a confirmation e-mail. */
function looksLikeAuthReturn(): boolean {
  try {
    return /[?#&](code|access_token|error_description)=/.test(location.search + location.hash)
  } catch {
    return false
  }
}

async function loadAdapter(): Promise<AccountService> {
  try {
    // A separate chunk: the SDK is never fetched unless the account UI really mounts.
    const m = await import('./supabaseService')
    return m.createSupabaseService()
  } catch {
    return failingService('network')
  }
}

/**
 * Mounts the account UI and returns its handle. Call it only when `FEATURES.accounts` is on, and load this module with a dynamic
 * import() so it stays a lazy chunk. Nothing is shown and nothing is sent until one of the handle's `open*` methods is called
 * (the one exception: when the page is opened by the sign-in redirect and the signed-in user has no profile yet, the profile
 * step resumes by itself).
 */
export async function mountAccountUi(deps: AccountUiDeps): Promise<AccountUiHandle> {
  const returning = looksLikeAuthReturn()
  const service = deps.service ?? (await loadAdapter())
  const ctx: Ctx = { deps, service, now: deps.now ?? (() => new Date()) }
  let disposed = false
  const off = service.onAuthChange((u) => {
    if (!disposed) deps.onAccountChange?.(u)
  })

  let running: Promise<void> | null = null
  /** One flow at a time: pressing the entry twice does not stack dialogs. */
  const run = (fn: () => Promise<void>): Promise<void> => {
    if (disposed) return Promise.resolve()
    if (running) return running
    running = fn()
      .catch(() => undefined)
      .finally(() => {
        running = null
      })
    return running
  }

  /** Signed in but no profile: consent, then the profile form. */
  const completeProfile = async (): Promise<void> => {
    const consent = await consentDialog(ctx, false)
    if (consent === null || consent === 'login') return
    const saved = await profileDialog(ctx, { consentAt: consent.consentAt })
    if (saved === 'saved') await showAccount()
  }

  const showAccount = async (): Promise<void> => {
    const user = await service.currentUser()
    if (!user) return signUpPath()
    const lp = await service.loadProfile()
    if (lp.ok && lp.profile === null) return completeProfile()
    const choice = await accountDialog(ctx, { user, profile: lp.ok ? lp.profile : null, profileFailed: !lp.ok })
    if (choice === 'sign-out') {
      await service.signOut()
    } else if (choice === 'delete') {
      if (!(await confirmDeleteDialog(ctx))) return
      const r = await service.deleteAccount()
      if (!r.ok) return infoDialog(ctx, 'acc-error', T.deleteTitle, failureMessage(r.reason))
      await service.signOut() // idempotent: makes sure nothing of the session is left
      await infoDialog(ctx, 'acc-deleted', T.deletedTitle, T.deletedBody)
    }
  }

  const logInPath = async (): Promise<void> => {
    const r = await logInDialog(ctx)
    if (r === 'sign-up') return signUpPath()
    if (r === 'ok') return showAccount()
  }

  const signUpPath = async (): Promise<void> => {
    const user = await service.currentUser()
    if (user) return showAccount()
    const consent = await consentDialog(ctx, true)
    if (consent === null) return
    if (consent === 'login') return logInPath()
    const s = await signUpDialog(ctx)
    if (s === null || s.kind === 'google') return
    if (s.kind === 'login') return logInPath()
    if (s.kind === 'confirm-email') return infoDialog(ctx, 'acc-confirm', T.confirmTitle, T.confirmBody)
    const saved = await profileDialog(ctx, { consentAt: consent.consentAt, ageRange: s.ageRange, parentConfirmed: s.parentConfirmed })
    if (saved === 'saved') await showAccount()
  }

  const handle: AccountUiHandle = {
    open: () => run(async () => ((await service.currentUser()) ? showAccount() : signUpPath())),
    openSignUp: () => run(signUpPath),
    openLogIn: () => run(logInPath),
    openAccount: () => run(showAccount),
    dispose() {
      disposed = true
      off()
    },
  }

  if (returning) {
    void run(async () => {
      const user = await service.currentUser()
      if (!user) return
      const lp = await service.loadProfile()
      if (lp.ok && lp.profile === null) await completeProfile()
    })
  }
  return handle
}
