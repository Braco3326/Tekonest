/**
 * Renders the `MenuDef[]` model as a WAI-ARIA menubar (Task 7):
 * - top items: role="menuitem", aria-haspopup="menu", roving tabindex (one tab stop);
 *   Left/Right move (wrap), Home/End, Down/Enter/Space open on the first item, Up on the last;
 * - open menu: Up/Down move (wrap), Home/End, Enter/Space run the item, Esc closes and returns
 *   focus to its top item, Left/Right open the neighbour menu; focus leaving the menu (Tab,
 *   never intercepted) closes it.
 * - a submenu (an item with `children`, Task 18: Vue › Vues): aria-haspopup / aria-expanded on its
 *   item; → / Enter / Space open it on its first item, hover opens it; inside, Up/Down/Home/End move
 *   (wrap), ← / Esc close it back to its item, → opens the next menu, Enter/Space run; children
 *   sharing a `group` sit in a labelled role="group".
 * Disabled items stay focusable with aria-disabled (APG). The panel is rebuilt on every open,
 * so enabled states and shortcut labels are always current.
 */
import type { MenuDef, MenuItem } from './menuModel'

export interface MenuBarHandle {
  close(): void
  dispose(): void
}

/** A submenu keeps this far (CSS px) from the window edges. */
const MARGIN = 4

/** Optional hooks of the owner. `onTopIntent`: the learner reaches for a menu (pointer over its title, focus on it, or opening it): load what its items will need. */
export interface MenuBarHooks {
  onTopIntent?(menuId: MenuDef['id']): void
}

export function mountMenuBar(bar: HTMLElement, menus: () => MenuDef[], hooks: MenuBarHooks = {}): MenuBarHandle {
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
    top.addEventListener('focus', () => hooks.onTopIntent?.(def.id))
    top.addEventListener('pointerenter', () => {
      hooks.onTopIntent?.(def.id)
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
  /** The open menu's own items (not those of its submenu). */
  const items = (i: number): HTMLButtonElement[] =>
    Array.from(panels[i].querySelectorAll<HTMLButtonElement>(':scope > [role^="menuitem"], :scope > .cr-submenu-wrap > [role^="menuitem"]'))
  /** The open submenu (Vue › Vues, Task 18): its parent item and its panel. */
  let sub: { parent: HTMLButtonElement; panel: HTMLElement } | null = null
  const subItems = (): HTMLButtonElement[] => (sub ? Array.from(sub.panel.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]')) : [])

  function openSub(parent: HTMLButtonElement, panel: HTMLElement, focus: 'first' | 'last' | 'none'): void {
    if (parent.getAttribute('aria-disabled') === 'true') return
    if (sub && sub.panel !== panel) closeSub(false)
    sub = { parent, panel }
    panel.hidden = false
    place(panel)
    // The menubar widens when the web fonts arrive (its items move right): place it again then.
    const fonts = (doc as Document & { fonts?: FontFaceSet }).fonts
    if (fonts && fonts.status !== 'loaded')
      void fonts.ready.then(() => {
        if (sub?.panel === panel) place(panel)
      })
    parent.setAttribute('aria-expanded', 'true')
    const list = subItems()
    if (focus === 'first') list[0]?.focus()
    else if (focus === 'last') list[list.length - 1]?.focus()
  }

  /**
   * Never off-screen (Fix 1: 1280 px laptops, 1366 px at 125 % zoom): to the right of its item when
   * it fits, else to the left of the menu, else slid left until its right edge is inside the window
   * (over the parent menu, which it then covers in part). Too tall: it scrolls.
   */
  function place(panel: HTMLElement): void {
    const s = panel.style
    s.left = s.right = s.maxHeight = s.overflowY = ''
    const win = doc.defaultView
    if (!win) return
    const vw = doc.documentElement.clientWidth || win.innerWidth
    const vh = doc.documentElement.clientHeight || win.innerHeight
    const r = panel.getBoundingClientRect()
    const host = (panel.offsetParent as HTMLElement | null)?.getBoundingClientRect()
    if (r.right > vw - MARGIN && host) {
      if (host.left - r.width >= MARGIN) {
        s.left = 'auto'
        s.right = '100%'
      } else {
        const left = Math.max(MARGIN, vw - MARGIN - r.width)
        s.left = `${left - host.left}px`
      }
    }
    const top = panel.getBoundingClientRect().top
    if (top + r.height > vh - MARGIN) {
      s.maxHeight = `${Math.max(120, vh - MARGIN - top)}px`
      s.overflowY = 'auto'
    }
  }

  function closeSub(returnFocus: boolean): void {
    if (!sub) return
    const { parent, panel } = sub
    sub = null
    panel.hidden = true
    parent.setAttribute('aria-expanded', 'false')
    if (returnFocus) parent.focus()
  }

  function render(i: number): void {
    sub = null
    const def = menus()[i]
    const panel = panels[i]
    panel.replaceChildren()
    const button = (item: MenuItem): HTMLButtonElement => {
      const b = doc.createElement('button')
      b.type = 'button'
      b.className = 'cr-menu-item'
      // Checkable items (Task 19): « Marcher » is a checkbox, the ear heights a radio pair.
      b.setAttribute('role', item.kind === 'checkbox' ? 'menuitemcheckbox' : item.kind === 'radio' ? 'menuitemradio' : 'menuitem')
      if (item.kind) b.setAttribute('aria-checked', String(!!item.checked?.()))
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
      if (!item.enabled()) {
        b.setAttribute('aria-disabled', 'true')
        // Why it is off (Task 39): visible under the label, and the item's accessible description (aria-hidden: it is not part of the NAME).
        const why = item.description?.()
        if (why) {
          const d = doc.createElement('span')
          d.className = 'cr-menu-desc'
          d.id = `cr-menu-desc-${item.id}`
          d.setAttribute('aria-hidden', 'true')
          d.textContent = why
          b.appendChild(d)
          b.setAttribute('aria-describedby', d.id)
        }
      }
      return b
    }
    for (const item of def.items) {
      const b = button(item)
      if (!item.children?.length) {
        b.addEventListener('click', () => activate(item))
        b.addEventListener('pointerenter', () => {
          closeSub(false)
          b.focus()
        })
        panel.appendChild(b)
        continue
      }
      // A submenu (APG): → / Entrée / Espace open it on its first item, ← / Échap close it back here.
      b.id = `cr-menu-item-${item.id}`
      b.setAttribute('aria-haspopup', 'menu')
      b.setAttribute('aria-expanded', 'false')
      const chevron = doc.createElement('span')
      chevron.className = 'cr-submenu-chevron'
      chevron.setAttribute('aria-hidden', 'true')
      chevron.textContent = '›'
      b.appendChild(chevron)
      const wrap = doc.createElement('div')
      wrap.className = 'cr-submenu-wrap'
      wrap.setAttribute('role', 'none')
      const sp = doc.createElement('div')
      sp.className = 'cr-menu-panel cr-submenu'
      sp.id = `cr-menu-${item.id}-panel`
      sp.setAttribute('role', 'menu')
      sp.setAttribute('aria-labelledby', b.id)
      sp.hidden = true
      b.setAttribute('aria-controls', sp.id)
      // Consecutive children sharing a `group` go in one labelled role="group" (« Faces », « Arêtes », « Coins »).
      let group: HTMLElement | null = null
      let groupName: string | undefined
      item.children.forEach((c) => {
        if (c.group !== undefined && (group === null || c.group !== groupName)) {
          groupName = c.group
          group = doc.createElement('div')
          group.className = 'cr-menu-group'
          group.setAttribute('role', 'group')
          const h = doc.createElement('div')
          h.className = 'cr-menu-group-label'
          h.id = `${sp.id}-g${sp.childElementCount}`
          h.textContent = c.group
          h.setAttribute('aria-hidden', 'true') // names the group (aria-labelledby), not a menu child
          group.setAttribute('aria-labelledby', h.id)
          group.appendChild(h)
          sp.appendChild(group)
        } else if (c.group === undefined) group = null
        const cb = button(c)
        cb.addEventListener('click', () => activate(c))
        cb.addEventListener('pointerenter', () => cb.focus())
        ;(group ?? sp).appendChild(cb)
      })
      b.addEventListener('click', () => (sub?.panel === sp ? closeSub(true) : openSub(b, sp, 'first')))
      b.addEventListener('pointerenter', () => {
        b.focus()
        openSub(b, sp, 'none')
      })
      wrap.append(b, sp)
      panel.appendChild(wrap)
    }
  }

  function activate(item: MenuItem): void {
    if (!item.enabled()) return
    close(item.returnFocus !== false)
    item.run()
  }

  function open(i: number, focus: 'first' | 'last' | 'none'): void {
    hooks.onTopIntent?.(defs[i].id)
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
    closeSub(false)
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

  /**
   * A held Entrée / Espace is ONE press: its auto-repeats do nothing (Task 39). Without this a held key opens the menu, runs « Lecture », closes it,
   * opens it again, runs « Stop »… and the sound starts and stops for as long as the key is down.
   */
  function heldKey(e: KeyboardEvent): boolean {
    if (!e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return false
    e.preventDefault()
    e.stopPropagation()
    return true
  }

  function onTopKey(e: KeyboardEvent, i: number): void {
    if (heldKey(e)) return
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

  /** The item model behind a rendered button (submenu items included). */
  const modelOf = (i: number, b: HTMLElement | undefined): MenuItem | undefined => {
    const flat = (xs: MenuItem[]): MenuItem[] => xs.flatMap((x) => [x, ...flat(x.children ?? [])])
    return b ? flat(menus()[i].items).find((x) => x.id === b.dataset.item) : undefined
  }

  /** Keys inside the open submenu: ↑ ↓ Home End move (wrap), ← / Échap back to its parent, → next menu. */
  function onSubKey(e: KeyboardEvent, i: number): boolean {
    const list = subItems()
    const at = list.indexOf(doc.activeElement as HTMLButtonElement)
    const n = tops.length
    switch (e.key) {
      case 'ArrowDown':
        list[(at + 1) % list.length]?.focus()
        return true
      case 'ArrowUp':
        list[(at - 1 + list.length) % list.length]?.focus()
        return true
      case 'Home':
        list[0]?.focus()
        return true
      case 'End':
        list[list.length - 1]?.focus()
        return true
      case 'ArrowLeft':
      case 'Escape':
        closeSub(true)
        return true
      case 'ArrowRight':
        open((i + 1) % n, 'first')
        return true
      case 'Enter':
      case ' ': {
        const item = modelOf(i, list[at])
        if (item) activate(item)
        return true
      }
      default:
        return false
    }
  }

  function onPanelKey(e: KeyboardEvent, i: number): void {
    if (heldKey(e)) return
    if (sub && sub.panel.contains(doc.activeElement)) {
      if (onSubKey(e, i)) {
        e.preventDefault()
        e.stopPropagation()
      }
      return
    }
    const list = items(i)
    const at = list.indexOf(doc.activeElement as HTMLButtonElement)
    const n = tops.length
    const here = list[at]
    if (here?.getAttribute('aria-haspopup') === 'menu' && (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      e.stopPropagation()
      openSub(here, here.nextElementSibling as HTMLElement, 'first')
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') closeSub(false)
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
        const item = modelOf(i, here)
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
  // A window resize (or zoom) with a submenu open: it is placed again, never left off-screen.
  const onResize = (): void => {
    if (sub) place(sub.panel)
  }
  doc.defaultView?.addEventListener('resize', onResize)

  return {
    close: () => close(false),
    dispose() {
      doc.removeEventListener('pointerdown', onOutside, true)
      doc.removeEventListener('focusin', onOutside)
      doc.defaultView?.removeEventListener('resize', onResize)
      bar.replaceChildren()
    },
  }
}
