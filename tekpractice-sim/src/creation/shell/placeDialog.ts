/**
 * « Changer de lieu » dialog (C3): shown when the rig has gear. Modal
 * (role="dialog", aria-modal), the page behind it `inert`, focus kept on
 * its buttons by two edge sentinels (the focus key itself is never intercepted), Esc = Annuler, focus given back to where it was. Square corners, Nuit / Papier / Ambre.
 */
import { COPY } from '../copy'

export type PlaceChoice = 'keep' | 'empty' | 'cancel'

let open: { close(c: PlaceChoice): void } | null = null

export function openPlaceDialog(parent: HTMLElement = document.body): Promise<PlaceChoice> {
  open?.close('cancel') // one dialog at a time: a new request replaces the old one
  const back = document.activeElement instanceof HTMLElement ? document.activeElement : null

  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(19,17,20,0.6);'
  const box = document.createElement('div')
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-modal', 'true')
  box.setAttribute('aria-labelledby', 'cr-place-dialog-title')
  box.setAttribute('aria-describedby', 'cr-place-dialog-body')
  box.style.cssText =
    'background:#131114;color:#F3EDE3;border:1px solid #612D45;border-radius:0;padding:24px;max-width:420px;font-family:"IBM Plex Sans",system-ui,sans-serif;'
  const title = document.createElement('h2')
  title.id = 'cr-place-dialog-title'
  title.textContent = COPY.place!.dialogTitle!
  title.style.cssText = 'margin:0 0 8px;font-size:20px;'
  const body = document.createElement('p')
  body.id = 'cr-place-dialog-body'
  body.textContent = COPY.place!.dialogBody!
  body.style.cssText = 'margin:0 0 16px;'
  const row = document.createElement('div')
  row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;'

  return new Promise<PlaceChoice>((resolve) => {
    // Everything behind the dialog is inert while it is open (siblings of the
    // overlay up to <body>); each element's own inert state is restored on close.
    const inerted: { el: HTMLElement; was: boolean }[] = []
    const makeInert = (): void => {
      for (let node: HTMLElement | null = overlay; node && node !== document.documentElement; node = node.parentElement)
        for (const sib of Array.from(node.parentElement?.children ?? []))
          if (sib !== node && sib instanceof HTMLElement && sib.tagName !== 'SCRIPT') {
            inerted.push({ el: sib, was: sib.inert })
            sib.inert = true
          }
    }
    const close = (c: PlaceChoice): void => {
      if (open !== handle) return
      open = null
      for (const { el, was } of inerted) el.inert = was
      overlay.remove()
      back?.focus()
      resolve(c)
    }
    const handle = { close }
    open = handle

    const buttons = (['keep', 'empty', 'cancel'] as const).map((c) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = COPY.place![c]!
      b.style.cssText =
        'border-radius:0;padding:8px 14px;font:inherit;cursor:pointer;border:1px solid #DD9349;' +
        (c === 'keep' ? 'background:#DD9349;color:#131114;' : 'background:transparent;color:#F3EDE3;')
      b.addEventListener('click', () => close(c))
      row.appendChild(b)
      return b
    })
    box.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close('cancel')
      }
    })
    // Focus trap without taking the focus key (C10): the browser moves focus as
    // usual; landing on an edge sentinel sends it round to the other end.
    const sentinel = (to: () => HTMLButtonElement): HTMLSpanElement => {
      const s = document.createElement('span')
      s.tabIndex = 0
      s.dataset.sentinel = ''
      s.addEventListener('focus', () => to().focus())
      return s
    }
    box.append(sentinel(() => buttons[buttons.length - 1]), title, body, row, sentinel(() => buttons[0]))
    overlay.appendChild(box)
    parent.appendChild(overlay)
    makeInert()
    buttons[0].focus()
  })
}
