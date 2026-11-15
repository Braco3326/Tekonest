/**
 * A confirmation INSIDE the 2D schema page (stage 2: « Envoyer dans la scène 3D », « Remplacer le matériel ? »).
 *
 * The page is itself the one Mode Création modal (src/creation/shell/modal.ts), and that modal holds one dialog at a time: a second `openModal` would close
 * the page. So this is the same pattern drawn inside it: the `.cr-dialog` box and its `modalButton` / `modalRow` buttons, role="dialog" + aria-modal,
 * labelled by its h2 and described by its text, the page's other parts `inert` while it is open (each one's own state restored), so the page's focus
 * sentinels keep the focus in it; Échap = `cancel` and never reaches the page (which would close); the first choice is the primary button and has the focus.
 */
import { modalButton, modalRow } from '../creation/shell/modal'

export interface InPageChoice<T extends string> {
  /** Element id prefix (`<id>-title`, `<id>-body`); also the box's data-testid. */
  id: string
  title: string
  /** Paragraphs under the title (the dialog's description). */
  body: readonly string[]
  choices: readonly { id: T; label: string }[]
  /** What Échap resolves. */
  cancel: T
}

export function choiceInPage<T extends string>(doc: Document, host: HTMLElement, cover: readonly HTMLElement[], o: InPageChoice<T>): Promise<T> {
  const overlay = doc.createElement('div')
  overlay.className = 'cr-dialog-overlay p2d-confirm-overlay'
  const box = doc.createElement('div')
  box.className = 'cr-dialog p2d-confirm'
  box.dataset.testid = o.id
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-modal', 'true')
  box.setAttribute('aria-labelledby', `${o.id}-title`)
  const h = doc.createElement('h2')
  h.id = `${o.id}-title`
  h.className = 'cr-dialog-title'
  h.textContent = o.title
  box.append(h)
  const body = doc.createElement('div')
  body.id = `${o.id}-body`
  for (const line of o.body) {
    const p = doc.createElement('p')
    p.className = 'cr-dialog-body'
    p.textContent = line
    body.append(p)
  }
  box.append(body)
  box.setAttribute('aria-describedby', body.id)
  overlay.append(box)

  return new Promise<T>((resolve) => {
    const was = cover.map((el) => ({ el, inert: el.inert }))
    let open = true
    const done = (v: T): void => {
      if (!open) return
      open = false
      for (const w of was) w.el.inert = w.inert
      overlay.remove()
      resolve(v)
    }
    const buttons = o.choices.map(({ id, label }, i) => {
      const b = modalButton(label, i === 0)
      b.dataset.choice = id
      b.addEventListener('click', () => done(id))
      return b
    })
    box.append(modalRow(...buttons))
    box.addEventListener('keydown', (e: KeyboardEvent) => {
      // nothing typed in the confirmation reaches the page (its Échap closes it, its Ctrl+Z undoes the plan)
      e.stopPropagation()
      if (e.key === 'Escape') {
        e.preventDefault()
        done(o.cancel)
      }
    })
    for (const w of was) w.el.inert = true
    host.append(overlay)
    buttons[0]?.focus()
  })
}
