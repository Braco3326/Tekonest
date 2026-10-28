/**
 * The one Mode Création modal (Task 13 review): « Changer de lieu »,
 * « Remplacer le matériel ? », the project name, « Ouvrir… », the confirms.
 * - role="dialog" + aria-modal, labelled by its h2 (and described by `body` when given);
 * - everything behind it is `inert` (each element's own state restored on close);
 * - focus kept in by two edge sentinels: the focus key itself is never intercepted (C10);
 * - Esc = `cancel`; focus goes back where it was; a press on a non-control part (backdrop, title, text) does not take focus out of it;
 * - one dialog at a time: a new one closes the open one (which resolves its cancel).
 * Styled by `.cr-dialog*` classes in creation.css (`--cr-*` tokens, square corners).
 */
let open: { close(): void } | null = null

export interface ModalParts {
  /** Where focus lands when the dialog opens. */
  first: HTMLElement
  /** The first and last focusable controls (the sentinels send focus round). */
  edges(): [HTMLElement, HTMLElement]
}

export interface ModalOptions<T> {
  /** Element id prefix (`<id>-title`, `<id>-body`); also the box's data-testid. */
  id: string
  title: string
  /** A paragraph under the title, used as the dialog's description. */
  body?: string
  /** What Esc (or a replacing dialog) resolves. */
  cancel: T
  /** Fill the box (after the title / body); `done(v)` closes with `v`. */
  build(box: HTMLElement, done: (v: T) => void): ModalParts
  parent?: HTMLElement
}

export function openModal<T>(o: ModalOptions<T>): Promise<T> {
  const parent = o.parent ?? document.body
  open?.close()
  const back = document.activeElement instanceof HTMLElement ? document.activeElement : null

  const overlay = document.createElement('div')
  overlay.className = 'cr-dialog-overlay'
  const box = document.createElement('div')
  box.className = 'cr-dialog'
  box.dataset.testid = o.id
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-modal', 'true')
  box.setAttribute('aria-labelledby', `${o.id}-title`)
  const h = document.createElement('h2')
  h.id = `${o.id}-title`
  h.className = 'cr-dialog-title'
  h.textContent = o.title
  box.appendChild(h)
  if (o.body !== undefined) {
    const p = document.createElement('p')
    p.id = `${o.id}-body`
    p.className = 'cr-dialog-body'
    p.textContent = o.body
    box.appendChild(p)
    box.setAttribute('aria-describedby', p.id)
  }

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
    // A press on anything that is not a control (the backdrop, the title, the text, a heading, the padding) must not blur the
    // dialog to <body>: Échap (listened on the box) and the arrows would stop reaching it. Preventing the press's default keeps
    // focus where it is; the click still happens, and controls (and their labels) keep their normal press. Chosen over a
    // document-level Échap listener because it touches no key routing and changes nothing for a control; its one cost is that
    // a press on plain text no longer starts a text selection.
    overlay.addEventListener('mousedown', (e) => {
      const t = e.target
      if (!(t instanceof Element) || !t.closest('input, button, select, textarea, a, label, summary, [tabindex], [contenteditable]')) e.preventDefault()
    })
    parent.appendChild(overlay)
    // Everything behind the dialog: the overlay's siblings up to <body>.
    for (let node: HTMLElement | null = overlay; node && node !== document.documentElement; node = node.parentElement)
      for (const sib of Array.from(node.parentElement?.children ?? []))
        if (sib !== node && sib instanceof HTMLElement && sib.tagName !== 'SCRIPT') {
          inerted.push({ el: sib, was: sib.inert })
          sib.inert = true
        }
    parts.first.focus()
  })
}

/** A dialog button: the primary one is Ambre-filled. */
export function modalButton(label: string, primary: boolean, type: 'button' | 'submit' = 'button'): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = type
  b.textContent = label
  b.className = primary ? 'cr-dialog-btn cr-dialog-btn-primary' : 'cr-dialog-btn'
  return b
}

/** A row of buttons. */
export function modalRow(...buttons: HTMLElement[]): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'cr-dialog-row'
  row.append(...buttons)
  return row
}
