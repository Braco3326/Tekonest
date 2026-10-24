/**
 * Projet dialogs (Task 13, C16): the project name (Ctrl+S the first time,
 * « Enregistrer sous… ») and « Ouvrir… ». The modal contract is `modal.ts`.
 *
 * The name field sits in a <form>: Enter submits natively (no click needed);
 * Ctrl+S inside the dialog submits too, never the browser's save dialog.
 */
import { COPY } from '../copy'
import { modalButton, modalRow, openModal } from './modal'

const P = (): Readonly<Record<string, string>> => COPY.project!

/** The project name; null when cancelled. Trimmed; an empty name is refused in place (said, not saved). */
export function openNameDialog(o: { saveAs: boolean; initial: string }): Promise<string | null> {
  return openModal<string | null>({
    id: 'cr-name-dialog',
    title: o.saveAs ? P().nameTitleAs! : P().nameTitle!,
    cancel: null,
    build(box, done) {
      const form = document.createElement('form')
      form.noValidate = true
      const label = document.createElement('label')
      label.htmlFor = 'cr-name-field'
      label.className = 'cr-dialog-label'
      label.textContent = P().nameLabel!
      const field = document.createElement('input')
      field.id = 'cr-name-field'
      field.className = 'cr-dialog-input'
      field.type = 'text'
      field.autocomplete = 'off'
      field.maxLength = 60
      field.value = o.initial
      const error = document.createElement('p')
      error.id = 'cr-name-error'
      error.className = 'cr-dialog-error'
      error.setAttribute('role', 'alert')
      const ok = modalButton(P().nameSubmit!, true, 'submit')
      const cancel = modalButton(P().nameCancel!, false)
      cancel.addEventListener('click', () => done(null))
      form.append(label, field, error, modalRow(ok, cancel))
      const submit = (): void => {
        const name = field.value.trim()
        if (!name) {
          field.setAttribute('aria-invalid', 'true')
          field.setAttribute('aria-describedby', error.id)
          error.textContent = P().nameEmpty!
          field.focus()
          return
        }
        done(name)
      }
      form.addEventListener('submit', (e) => {
        e.preventDefault()
        submit()
      })
      // Ctrl+S in the dialog = Enregistrer (never the browser's save dialog).
      form.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
          e.preventDefault()
          submit()
        }
      })
      field.addEventListener('input', () => {
        if (!field.value.trim()) return
        field.removeAttribute('aria-invalid')
        error.textContent = ''
      })
      box.appendChild(form)
      queueMicrotask(() => field.select())
      return { first: field, edges: () => [field, cancel] }
    },
  })
}

const formatDate = (iso: string): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * « Ouvrir… »: one button per saved project (Enter / click opens it); null
 * when cancelled. `unreadable`: the stored list could not be read (said, never
 * shown as « no project »).
 */
export function openProjectList(o: { projects: { name: string; savedAt: string }[]; unreadable?: boolean }): Promise<string | null> {
  const { projects } = o
  return openModal<string | null>({
    id: 'cr-open-dialog',
    title: P().openTitle!,
    body: o.unreadable ? P().openUnreadable! : projects.length ? P().openHint! : P().openEmpty!,
    cancel: null,
    build(box, done) {
      const list = document.createElement('ul')
      list.className = 'cr-project-list'
      const items = projects.map((p) => {
        const li = document.createElement('li')
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'cr-project-row'
        const date = formatDate(p.savedAt)
        b.setAttribute('aria-label', P().openItem!.replace('{name}', p.name).replace('{date}', date))
        const n = document.createElement('span')
        n.textContent = p.name
        const t = document.createElement('span')
        t.className = 'cr-project-date'
        t.textContent = date
        b.append(n, t)
        b.addEventListener('click', () => done(p.name))
        // Up / Down move between rows (Tab still works).
        b.addEventListener('keydown', (e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
          e.preventDefault()
          const i = items.indexOf(b)
          items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus()
        })
        li.appendChild(b)
        list.appendChild(li)
        return b
      })
      const cancel = modalButton(P().nameCancel!, !projects.length)
      cancel.addEventListener('click', () => done(null))
      if (items.length) box.appendChild(list)
      box.appendChild(modalRow(cancel))
      return { first: items[0] ?? cancel, edges: () => [items[0] ?? cancel, cancel] }
    },
  })
}
