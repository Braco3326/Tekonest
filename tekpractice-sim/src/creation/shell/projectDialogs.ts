/**
 * Projet dialogs (Task 13, C16): the project name (Ctrl+S the first time,
 * « Enregistrer sous… ») and « Ouvrir… ». Same modal contract as the place
 * dialog: role="dialog" + aria-modal, the page behind `inert`, focus kept in
 * by two edge sentinels (the focus key itself is never intercepted), Esc =
 * cancel, focus given back on close. Square corners, Nuit / Papier / Ambre.
 *
 * The name field sits in a <form>: Enter submits natively (no click needed);
 * Ctrl+S inside the dialog submits too, never the browser's save dialog.
 */
import { COPY } from '../copy'

const P = (): Readonly<Record<string, string>> => COPY.project!

const BUTTON = 'padding:8px 14px;font:inherit;cursor:pointer;border:1px solid #DD9349;'
const PRIMARY = BUTTON + 'background:#DD9349;color:#131114;'
const SECONDARY = BUTTON + 'background:transparent;color:#F3EDE3;'

let open: { close(): void } | null = null

interface ModalParts {
  box: HTMLElement
  /** Where focus lands when the dialog opens. */
  first: HTMLElement
  /** The focus trap's ends. */
  edges(): [HTMLElement, HTMLElement]
}

/** A modal shell; `build` fills it and returns its focus targets. Resolves `cancel` on Esc. */
function modal<T>(o: { id: string; title: string; cancel: T; build(box: HTMLElement, done: (v: T) => void): Omit<ModalParts, 'box'> }): Promise<T> {
  open?.close()
  const back = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const overlay = document.createElement('div')
  overlay.className = 'cr-dialog-overlay'
  overlay.style.cssText = 'position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(19,17,20,0.6);'
  const box = document.createElement('div')
  box.className = 'cr-dialog'
  box.dataset.testid = o.id
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-modal', 'true')
  box.setAttribute('aria-labelledby', `${o.id}-title`)
  box.style.cssText =
    'background:#131114;color:#F3EDE3;border:1px solid #612D45;border-radius:0;padding:24px;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;font-family:"IBM Plex Sans",system-ui,sans-serif;'
  const h = document.createElement('h2')
  h.id = `${o.id}-title`
  h.textContent = o.title
  h.style.cssText = 'margin:0 0 12px;font-size:20px;'
  box.appendChild(h)

  return new Promise<T>((resolve) => {
    const inerted: { el: HTMLElement; was: boolean }[] = []
    const close = (v: T): void => {
      if (open !== handle) return
      open = null
      for (const { el, was } of inerted) el.inert = was
      overlay.remove()
      back?.focus()
      resolve(v)
    }
    const handle = { close: () => close(o.cancel) }
    open = handle
    const parts = o.build(box, close)
    box.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close(o.cancel)
      }
    })
    const sentinel = (to: () => HTMLElement): HTMLSpanElement => {
      const s = document.createElement('span')
      s.tabIndex = 0
      s.dataset.sentinel = ''
      s.addEventListener('focus', () => to().focus())
      return s
    }
    box.prepend(sentinel(() => parts.edges()[1]))
    box.append(sentinel(() => parts.edges()[0]))
    overlay.appendChild(box)
    document.body.appendChild(overlay)
    for (let node: HTMLElement | null = overlay; node && node !== document.documentElement; node = node.parentElement)
      for (const sib of Array.from(node.parentElement?.children ?? []))
        if (sib !== node && sib instanceof HTMLElement && sib.tagName !== 'SCRIPT') {
          inerted.push({ el: sib, was: sib.inert })
          sib.inert = true
        }
    parts.first.focus()
  })
}

const button = (label: string, primary: boolean, type: 'button' | 'submit' = 'button'): HTMLButtonElement => {
  const b = document.createElement('button')
  b.type = type
  b.textContent = label
  b.style.cssText = primary ? PRIMARY : SECONDARY
  return b
}

/** The project name; null when cancelled. Trimmed; an empty name is refused in place (said, not saved). */
export function openNameDialog(o: { saveAs: boolean; initial: string }): Promise<string | null> {
  return modal<string | null>({
    id: 'cr-name-dialog',
    title: o.saveAs ? P().nameTitleAs! : P().nameTitle!,
    cancel: null,
    build(box, done) {
      const form = document.createElement('form')
      form.noValidate = true
      const label = document.createElement('label')
      label.htmlFor = 'cr-name-field'
      label.textContent = P().nameLabel!
      label.style.cssText = 'display:block;margin:0 0 6px;'
      const field = document.createElement('input')
      field.id = 'cr-name-field'
      field.type = 'text'
      field.autocomplete = 'off'
      field.maxLength = 60
      field.value = o.initial
      field.style.cssText = 'display:block;width:100%;box-sizing:border-box;padding:8px;font:inherit;background:#1e1a1f;color:#F3EDE3;border:1px solid #F3EDE3;border-radius:0;'
      const error = document.createElement('p')
      error.id = 'cr-name-error'
      error.setAttribute('role', 'alert')
      error.style.cssText = 'margin:6px 0 0;color:#F3EDE3;font-size:14px;'
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;'
      const ok = button(P().nameSubmit!, true, 'submit')
      const cancel = button(P().nameCancel!, false)
      cancel.addEventListener('click', () => done(null))
      row.append(ok, cancel)
      form.append(label, field, error, row)
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

/** « Ouvrir… »: one button per saved project (Enter / click opens it); null when cancelled. */
export function openProjectList(projects: { name: string; savedAt: string }[]): Promise<string | null> {
  return modal<string | null>({
    id: 'cr-open-dialog',
    title: P().openTitle!,
    cancel: null,
    build(box, done) {
      const hint = document.createElement('p')
      hint.id = 'cr-open-hint'
      hint.textContent = projects.length ? P().openHint! : P().openEmpty!
      hint.style.cssText = 'margin:0 0 12px;'
      box.setAttribute('aria-describedby', hint.id)
      const list = document.createElement('ul')
      list.style.cssText = 'list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;'
      const items = projects.map((p) => {
        const li = document.createElement('li')
        const b = document.createElement('button')
        b.type = 'button'
        const date = formatDate(p.savedAt)
        b.setAttribute('aria-label', P().openItem!.replace('{name}', p.name).replace('{date}', date))
        b.style.cssText =
          'display:flex;justify-content:space-between;gap:12px;width:100%;text-align:left;padding:8px 10px;font:inherit;cursor:pointer;background:transparent;color:#F3EDE3;border:1px solid #612D45;'
        const n = document.createElement('span')
        n.textContent = p.name
        const t = document.createElement('span')
        t.textContent = date
        t.style.cssText = 'opacity:0.85;font-variant-numeric:tabular-nums;'
        b.append(n, t)
        b.addEventListener('click', () => done(p.name))
        // Up / Down move between rows (Tab still works).
        b.addEventListener('keydown', (e) => {
          const i = items.indexOf(b)
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus()
          }
        })
        li.appendChild(b)
        list.appendChild(li)
        return b
      })
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;gap:8px;margin-top:16px;'
      const cancel = button(P().nameCancel!, !projects.length)
      cancel.addEventListener('click', () => done(null))
      row.appendChild(cancel)
      box.append(hint, list, row)
      return { first: items[0] ?? cancel, edges: () => [items[0] ?? cancel, cancel] }
    },
  })
}
