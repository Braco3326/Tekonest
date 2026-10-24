/**
 * Dismissible notes in the 3D view (Task 12): non-blocking messages the
 * learner must see, not only the console — the gear a model has that the game
 * does not (L2), a place that fell back to the blank room. Bottom-left of the
 * viewport (the view cube owns the top-left), stacked, each with « Fermer la
 * note ». The status bar announces them (`role="status"`), so the notes
 * themselves are plain landmarks-free regions. No animation.
 */
import { COPY } from '../copy'

export interface Note {
  /** Replaces an open note with the same id. */
  id: string
  title: string
  body: string
  items?: string[]
  /** Named buttons under the body (Task 13: « Reprendre ici », « J’ai vérifié le fichier »). */
  actions?: { label: string; run(): void }[]
}

export interface Notes {
  show(n: Note): void
  dismiss(id: string): void
  clear(): void
}

export function mountNotes(doc: Document, parent: HTMLElement): Notes {
  const stack = doc.createElement('div')
  stack.className = 'cr-notes'
  stack.dataset.testid = 'notes'
  parent.appendChild(stack)
  const open = new Map<string, HTMLElement>()

  const dismiss = (id: string): void => {
    open.get(id)?.remove()
    open.delete(id)
  }
  return {
    show(n) {
      dismiss(n.id)
      const box = doc.createElement('section')
      box.className = 'cr-note'
      box.dataset.testid = `note-${n.id}`
      const titleId = `cr-note-${n.id}-title`
      box.setAttribute('aria-labelledby', titleId)
      const h = doc.createElement('h3')
      h.id = titleId
      h.className = 'cr-note-title'
      h.textContent = n.title
      const p = doc.createElement('p')
      p.className = 'cr-note-body'
      p.textContent = n.body
      const x = doc.createElement('button')
      x.type = 'button'
      x.className = 'cr-note-close'
      x.setAttribute('aria-label', COPY.note!.close!)
      x.title = COPY.note!.close!
      x.textContent = '×'
      x.addEventListener('click', () => dismiss(n.id))
      box.append(h, x, p)
      if (n.items?.length) {
        const ul = doc.createElement('ul')
        ul.className = 'cr-note-list'
        for (const it of n.items) {
          const li = doc.createElement('li')
          li.textContent = it
          ul.appendChild(li)
        }
        box.appendChild(ul)
      }
      if (n.actions?.length) {
        const row = doc.createElement('div')
        row.className = 'cr-note-actions'
        for (const a of n.actions) {
          const b = doc.createElement('button')
          b.type = 'button'
          b.className = 'cr-note-action'
          b.textContent = a.label
          b.addEventListener('click', () => a.run())
          row.appendChild(b)
        }
        box.appendChild(row)
      }
      stack.appendChild(box)
      open.set(n.id, box)
    },
    dismiss,
    clear() {
      for (const id of [...open.keys()]) dismiss(id)
    },
  }
}
