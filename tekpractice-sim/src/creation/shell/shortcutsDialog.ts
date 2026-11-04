/**
 * The « Raccourcis clavier » dialog (night 2 wave 5, P2-1): the shared modal (`modal.ts`: focus kept in, Échap closes, focus goes back), the groups of `shortcutGroups` as
 * definition lists (the action, then its keys in <kbd>). The list scrolls inside the box on a short window, so it is itself a focus stop (a scroller must be reachable by keyboard).
 */
import { COPY } from '../copy'
import type { CreationBindings } from '../input/creationActions'
import { modalButton, modalRow, openModal } from './modal'
import { shortcutGroups } from './shortcutsModel'

export function openShortcutsDialog(bindings: CreationBindings): Promise<void> {
  const S = COPY.shortcuts!
  return openModal<void>({
    id: 'cr-shortcuts-dialog',
    title: S.title!,
    body: S.hint!,
    cancel: undefined,
    build(box, done) {
      const list = document.createElement('div')
      list.className = 'cr-shortcuts'
      list.dataset.testid = 'shortcuts-list'
      list.tabIndex = 0
      list.setAttribute('role', 'group')
      list.setAttribute('aria-labelledby', 'cr-shortcuts-dialog-title')
      for (const g of shortcutGroups(bindings)) {
        const h = document.createElement('h3')
        h.className = 'cr-shortcuts-h'
        h.textContent = g.title
        const dl = document.createElement('dl')
        dl.className = 'cr-shortcuts-dl'
        dl.dataset.group = g.id
        for (const r of g.rows) {
          const dt = document.createElement('dt')
          dt.textContent = r.name
          const dd = document.createElement('dd')
          dd.dataset.row = r.id
          for (const k of r.keys) {
            const kbd = document.createElement('kbd')
            kbd.textContent = k
            dd.appendChild(kbd)
          }
          dl.append(dt, dd)
        }
        list.append(h, dl)
      }
      const close = modalButton(S.close!, true)
      close.addEventListener('click', () => done())
      box.append(list, modalRow(close))
      return { first: close, edges: () => [list, close] }
    },
  })
}
