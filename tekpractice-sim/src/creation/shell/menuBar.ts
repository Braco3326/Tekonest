/**
 * Renders the `MenuDef[]` model as a WAI-ARIA menubar (Task 7):
 * - top items: role="menuitem", aria-haspopup="menu", roving tabindex (one tab stop);
 *   Left/Right move (wrap), Home/End, Down/Enter/Space open on the first item, Up on the last;
 * - open menu: Up/Down move (wrap), Home/End, Enter/Space run the item, Esc closes and returns
 *   focus to its top item, Left/Right open the neighbour menu; focus leaving the menu (Tab,
 *   never intercepted) closes it.
 * Disabled items stay focusable with aria-disabled (APG). The panel is rebuilt on every open,
 * so enabled states and shortcut labels are always current.
 */
import type { MenuDef, MenuItem } from './menuModel'

export interface MenuBarHandle {
  close(): void
  dispose(): void
}

export function mountMenuBar(bar: HTMLElement, menus: () => MenuDef[]): MenuBarHandle {
  const doc = bar.ownerDocument
  const defs = menus()
  const tops: HTMLButtonElement[] = []
  const panels: HTMLElement[] = []
  let openIndex = -1

  defs.forEach((def, i) => {
    const wrap = doc.createElement('div')
    wrap.className = 'cr-menu'
    wrap.setAttribute('role', 'none')
    const top = doc.createElement('button')
    top.type = 'button'
    top.className = 'cr-menu-top'
    top.id = `cr-menu-${def.id}`
    top.textContent = def.label
    top.setAttribute('role', 'menuitem')
    top.setAttribute('aria-haspopup', 'menu')
    top.setAttribute('aria-expanded', 'false')
    top.setAttribute('aria-controls', `cr-menu-${def.id}-panel`)
    top.tabIndex = i === 0 ? 0 : -1
    top.dataset.menu = def.id
    const panel = doc.createElement('div')
    panel.className = 'cr-menu-panel'
    panel.id = `cr-menu-${def.id}-panel`
    panel.setAttribute('role', 'menu')
    panel.setAttribute('aria-labelledby', top.id)
    panel.hidden = true
    wrap.append(top, panel)
    bar.appendChild(wrap)
    tops.push(top)
    panels.push(panel)

    top.addEventListener('click', () => (openIndex === i ? close(true) : open(i, 'first')))
    top.addEventListener('pointerenter', () => {
      if (openIndex >= 0 && openIndex !== i) open(i, 'none')
    })
    top.addEventListener('keydown', (e) => onTopKey(e, i))
    panel.addEventListener('keydown', (e) => onPanelKey(e, i))
    // Focus leaving the open menu (the browser moving it on the focus key, which is
    // never intercepted) closes it; back to its own top item = that item's click toggles.
    panel.addEventListener('focusout', (e: FocusEvent) => {
      const to = e.relatedTarget as Node | null
      if (openIndex === i && to !== top && !panel.contains(to)) close(false)
    })
  })

  const rove = (i: number): void => {
    tops.forEach((t, k) => (t.tabIndex = k === i ? 0 : -1))
    tops[i].focus()
  }
  const items = (i: number): HTMLButtonElement[] => Array.from(panels[i].querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))

  function render(i: number): void {
    const def = menus()[i]
    const panel = panels[i]
    panel.replaceChildren()
    const add = (item: MenuItem): void => {
      const b = doc.createElement('button')
      b.type = 'button'
      b.className = 'cr-menu-item'
      b.setAttribute('role', 'menuitem')
      b.tabIndex = -1
      b.dataset.item = item.id
      const label = doc.createElement('span')
      label.textContent = item.label
      b.appendChild(label)
      if (item.shortcut) {
        const k = doc.createElement('span')
        k.className = 'cr-shortcut'
        k.textContent = item.shortcut
        b.appendChild(k)
      }
      const enabled = item.enabled()
      if (!enabled) b.setAttribute('aria-disabled', 'true')
      b.addEventListener('click', () => activate(item))
      b.addEventListener('pointerenter', () => b.focus())
      panel.appendChild(b)
      // Submenus are not used yet: children render flat, after their parent.
      for (const c of item.children ?? []) add(c)
    }
    for (const item of def.items) add(item)
  }

  function activate(item: MenuItem): void {
    if (!item.enabled()) return
    close(true)
    item.run()
  }

  function open(i: number, focus: 'first' | 'last' | 'none'): void {
    if (openIndex >= 0 && openIndex !== i) hide(openIndex)
    openIndex = i
    render(i)
    panels[i].hidden = false
    tops[i].setAttribute('aria-expanded', 'true')
    tops.forEach((t, k) => (t.tabIndex = k === i ? 0 : -1))
    const list = items(i)
    if (focus === 'first') list[0]?.focus()
    else if (focus === 'last') list[list.length - 1]?.focus()
    else tops[i].focus()
  }

  function hide(i: number): void {
    panels[i].hidden = true
    tops[i].setAttribute('aria-expanded', 'false')
  }

  function close(returnFocus: boolean): void {
    if (openIndex < 0) return
    const i = openIndex
    hide(i)
    openIndex = -1
    if (returnFocus) tops[i].focus()
  }

  function onTopKey(e: KeyboardEvent, i: number): void {
    const n = tops.length
    let handled = true
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowLeft': {
        const j = (i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n
        if (openIndex >= 0) open(j, 'none')
        else rove(j)
        break
      }
      case 'Home':
        rove(0)
        break
      case 'End':
        rove(n - 1)
        break
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        open(i, 'first')
        break
      case 'ArrowUp':
        open(i, 'last')
        break
      case 'Escape':
        if (openIndex >= 0) close(true)
        else handled = false
        break
      default:
        handled = false
    }
    if (handled) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  function onPanelKey(e: KeyboardEvent, i: number): void {
    const list = items(i)
    const at = list.indexOf(doc.activeElement as HTMLButtonElement)
    const n = tops.length
    let handled = true
    switch (e.key) {
      case 'ArrowDown':
        list[(at + 1) % list.length]?.focus()
        break
      case 'ArrowUp':
        list[(at - 1 + list.length) % list.length]?.focus()
        break
      case 'Home':
        list[0]?.focus()
        break
      case 'End':
        list[list.length - 1]?.focus()
        break
      case 'ArrowRight':
        open((i + 1) % n, 'first')
        break
      case 'ArrowLeft':
        open((i - 1 + n) % n, 'first')
        break
      case 'Enter':
      case ' ': {
        const def = menus()[i]
        const flat = (xs: MenuItem[]): MenuItem[] => xs.flatMap((x) => [x, ...flat(x.children ?? [])])
        const item = flat(def.items).find((x) => x.id === list[at]?.dataset.item)
        if (item) activate(item)
        break
      }
      case 'Escape':
        close(true)
        break
      default:
        handled = false
    }
    if (handled) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  // A click or focus outside the menubar closes the open menu.
  const onOutside = (e: Event): void => {
    if (openIndex >= 0 && !bar.contains(e.target as Node)) close(false)
  }
  doc.addEventListener('pointerdown', onOutside, true)
  doc.addEventListener('focusin', onOutside)

  return {
    close: () => close(false),
    dispose() {
      doc.removeEventListener('pointerdown', onOutside, true)
      doc.removeEventListener('focusin', onOutside)
      bar.replaceChildren()
    },
  }
}
