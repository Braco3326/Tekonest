/**
 * The inventory drawer (Task 23, CA-09, P16/S5): a bottom drawer over the 3D view, one tab
 * per category (`inventory()`, Task 22), one button per device. A lazy chunk: boot loads
 * it with `import()` on the first open (nothing of it is fetched before).
 *
 * - `role="dialog"` + `aria-modal="false"` (the 3D view stays reachable), named « Inventaire ».
 *   Focus goes to the selected tab on open; Space, Esc or « Fermer » close it and give the
 *   3D view back (`returnFocus`). Tab is never intercepted.
 * - Tabs: `role="tablist"`, roving tabindex, ← → wrap, Home / End; selection follows focus.
 * - Items: plain buttons (Entrée or click → `onChoose(deviceId)`, the one seam Task 24 swaps for
 *   `startPlacement`); the drawer closes first so the 3D view has focus when placement starts.
 * - Search (final review 4): a labelled « Filtrer » field above the tabs filters the devices by label across ALL tabs
 *   (`filterItems`); Entrée in it chooses the first match; no match is said politely (`role="status"`) and shown. A
 *   printable key typed on a tab or an item moves into the field (keyboard-only: Espace, type, Entrée). In the field no
 *   key is a shell key and Espace is a space; Échap still closes. A tab click clears the filter.
 * - Pictures: a device with a thumbnail (`inventoryThumbs`) shows it (decorative, lazy, only for the tab that is open);
 *   the silhouette stays for a Bêta proposal and when the picture fails to load.
 * - Closed = `inert` + `visibility: hidden` (out of the tab order and the accessibility tree).
 * - The slide is the only motion in Mode Création (≤ 200 ms, none under reduced motion): CSS only,
 *   no per-frame work, nothing rendered by the 3D scene.
 * DOM only: it dispatches nothing itself and never touches the rig (C6).
 */
import './inventoryDrawer.css'
import manifest from '../../../public/assets/ASSET_MANIFEST.json'
import type { Registry } from '../../engine/CatalogLoader'
import { COPY } from '../copy'
import { assetUrl } from '../../assetUrl'
import { filterItems, inventory, TAB_LABELS, type InventoryItem, type InventoryTab } from '../inventory'
import { thumbPath } from '../inventoryThumbs'

export interface InventoryDrawerDeps {
  doc: Document
  /** The element the drawer docks to the bottom of (the shell's viewport, `position: relative`). */
  parent: HTMLElement
  registry: Registry
  /** Proposed devices (« Bêta » tab, Task 30), read at each open. */
  proposals(): { deviceId: string; label: string }[]
  /** Entrée or click on a device (the drawer is already closed and the 3D view focused). */
  onChoose(deviceId: string): void
  /** Hands focus back to the 3D view when the drawer closes. */
  returnFocus(): void
  /** The key event is the inventory key (remappable); Space by default. */
  isToggleKey(e: KeyboardEvent): boolean
  /** Label of the inventory key for the hint (« Espace »). */
  keyLabel(): string
}

export interface InventoryDrawer {
  readonly root: HTMLElement
  readonly isOpen: boolean
  open(): void
  /** `returnFocus: false` when something else takes focus right after (the place picker). */
  close(opts?: { returnFocus?: boolean }): void
}

/** Devices that ship a `public/assets/<id>.glb` (the manifest lists exactly those files). */
const MODEL_IDS: ReadonlySet<string> = new Set(
  (manifest as { assets: { id: string; status: string }[] }).assets.filter((a) => a.status === 'ok').map((a) => a.id),
)

const I = (): Readonly<Record<string, string>> => COPY.inventory!
const SVG = 'http://www.w3.org/2000/svg'

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

/**
 * A small device silhouette (front panel with its ports): outlined and dashed for the
 * placeholder box, plain for a device that has its own `.glb` model. Decorative.
 */
function icon(doc: Document, hasModel: boolean): SVGSVGElement {
  const svg = doc.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 40 28')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  svg.setAttribute('class', hasModel ? 'cr-inv-icon cr-inv-icon--model' : 'cr-inv-icon cr-inv-icon--placeholder')
  const body = doc.createElementNS(SVG, 'rect')
  body.setAttribute('x', '2')
  body.setAttribute('y', '4')
  body.setAttribute('width', '36')
  body.setAttribute('height', '20')
  body.setAttribute('class', 'cr-inv-icon-body')
  svg.appendChild(body)
  for (const x of [8, 16, 24, 32]) {
    const port = doc.createElementNS(SVG, 'rect')
    port.setAttribute('x', String(x - 2))
    port.setAttribute('y', '16')
    port.setAttribute('width', '4')
    port.setAttribute('height', '4')
    port.setAttribute('class', 'cr-inv-icon-port')
    svg.appendChild(port)
  }
  return svg
}

/**
 * The device's picture (decorative, lazy: only the tab that is open is rendered, so only its pictures are fetched) or, when it
 * has none or it fails to load, the silhouette.
 */
function picture(doc: Document, it: InventoryItem): SVGSVGElement | HTMLImageElement {
  const path = thumbPath(it.deviceId)
  const fallback = (): SVGSVGElement => icon(doc, it.hasModel)
  if (!path) return fallback()
  const img = doc.createElement('img')
  img.className = 'cr-inv-thumb'
  img.alt = ''
  img.setAttribute('aria-hidden', 'true')
  img.loading = 'lazy'
  img.decoding = 'async'
  img.draggable = false
  img.src = assetUrl(path)
  img.addEventListener('error', () => img.replaceWith(fallback()), { once: true })
  return img
}

export function mountInventoryDrawer(d: InventoryDrawerDeps): InventoryDrawer {
  const { doc } = d
  const root = el(doc, 'section', 'cr-drawer')
  root.dataset.testid = 'inventory-drawer'
  root.dataset.open = 'false'
  root.inert = true
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'false')
  root.setAttribute('aria-labelledby', 'cr-inv-title')

  const head = el(doc, 'div', 'cr-drawer-head')
  const title = el(doc, 'h2', 'cr-drawer-title', I().title)
  title.id = 'cr-inv-title'
  const tablist = el(doc, 'div', 'cr-drawer-tabs')
  tablist.setAttribute('role', 'tablist')
  tablist.setAttribute('aria-label', I().tabs!)
  const close = el(doc, 'button', 'cr-drawer-close', I().close)
  close.type = 'button'
  close.dataset.testid = 'inventory-close'
  close.setAttribute('aria-label', I().closeLabel!)
  // The search field (final review 4): a real label, a text field, a polite status for « no match ».
  const filterBox = el(doc, 'div', 'cr-drawer-filter')
  const filterLabel = el(doc, 'label', 'cr-drawer-filter-label', I().filter)
  filterLabel.htmlFor = 'cr-inv-filter'
  const filter = el(doc, 'input', 'cr-drawer-filter-input')
  filter.id = 'cr-inv-filter'
  filter.type = 'text'
  filter.autocomplete = 'off'
  filter.spellcheck = false
  filter.dataset.testid = 'inventory-filter'
  const filterStatus = el(doc, 'p', 'cr-sr-only')
  filterStatus.setAttribute('role', 'status')
  filterStatus.setAttribute('aria-live', 'polite')
  filterStatus.dataset.testid = 'inventory-filter-status'
  filterBox.append(filterLabel, filter, filterStatus)
  head.append(title, filterBox, tablist)

  const panel = el(doc, 'div', 'cr-drawer-panel')
  panel.id = 'cr-inv-panel'
  panel.setAttribute('role', 'tabpanel')
  const hint = el(doc, 'p', 'cr-drawer-hint')
  // DOM order = Tab order: tabs, the devices, then « Fermer » (placed top right by the CSS).
  root.append(head, panel, hint, close)
  d.parent.appendChild(root)

  let selected: InventoryTab | null = null
  let tabs: { tab: InventoryTab; btn: HTMLButtonElement }[] = []
  let items: InventoryItem[] = []

  const showTab = (tab: InventoryTab, focus: boolean): void => {
    selected = tab
    for (const t of tabs) {
      const on = t.tab === tab
      t.btn.setAttribute('aria-selected', String(on))
      t.btn.tabIndex = on ? 0 : -1
      if (on) {
        panel.setAttribute('aria-labelledby', t.btn.id)
        if (focus) t.btn.focus()
      }
    }
    renderItems(tab)
  }

  /** The matches of the filter (every tab), or null while the field is empty. */
  const matches = (): InventoryItem[] | null => (filter.value.trim() === '' ? null : filterItems(items, filter.value))

  const renderItems = (tab: InventoryTab): void => {
    panel.replaceChildren()
    const found = matches()
    // A filter on: one list of the matches of every tab, named for what it is; no match is said (status) and shown.
    if (found) {
      panel.removeAttribute('aria-labelledby')
      panel.setAttribute('aria-label', I().filterResults!)
      const none = found.length === 0
      filterStatus.textContent = none ? I().filterNone! : ''
      if (none) {
        const p = el(doc, 'p', 'cr-drawer-empty', I().filterNone)
        p.setAttribute('aria-hidden', 'true') // the status above says it; read once
        panel.appendChild(p)
        return
      }
    } else {
      panel.removeAttribute('aria-label')
      filterStatus.textContent = ''
      const sel = tabs.find((t) => t.tab === tab)
      if (sel) panel.setAttribute('aria-labelledby', sel.btn.id)
    }
    const mine = found ?? items.filter((it) => it.tab === tab)
    if (!mine.length) {
      panel.appendChild(el(doc, 'p', 'cr-drawer-empty', I().empty))
      return
    }
    const list = el(doc, 'ul', 'cr-inv-list')
    // `inventory()` does not de-duplicate proposals: every node is keyed by its index in the whole
    // list as well as the device id, so a duplicate id can never share a DOM id or break the list.
    for (const it of mine) {
      const at = items.indexOf(it)
      const li = el(doc, 'li')
      const b = el(doc, 'button', 'cr-inv-item')
      b.type = 'button'
      b.id = `cr-inv-item-${at}`
      b.dataset.testid = 'inventory-item'
      b.dataset.deviceId = it.deviceId
      b.dataset.model = String(it.hasModel)
      const text = el(doc, 'span', 'cr-inv-text')
      text.appendChild(el(doc, 'span', 'cr-inv-name', it.label))
      if (it.badge) {
        const badge = el(doc, 'span', 'cr-inv-badge', I().badgeUnverified)
        badge.dataset.testid = 'inventory-badge'
        text.appendChild(badge)
        // A proposal never looks verified (S5): the tooltip says it is approximate, and screen readers get it as the description.
        b.title = I().tipUnverified!
        b.dataset.beta = 'true'
        const tip = el(doc, 'span', 'cr-sr-only', I().tipUnverified)
        tip.id = `cr-inv-tip-${at}`
        b.setAttribute('aria-describedby', tip.id)
        li.appendChild(tip)
      }
      b.append(picture(doc, it), text)
      b.addEventListener('click', () => choose(it.deviceId))
      li.appendChild(b)
      list.appendChild(li)
    }
    panel.appendChild(list)
  }

  const build = (): void => {
    const inv = inventory(d.registry, { proposals: d.proposals(), modelIds: MODEL_IDS })
    items = inv.items
    tablist.replaceChildren()
    tabs = inv.tabs.map((tab, i) => {
      const btn = el(doc, 'button', 'cr-drawer-tab', TAB_LABELS[tab])
      btn.type = 'button'
      btn.id = `cr-inv-tab-${i}`
      btn.setAttribute('role', 'tab')
      btn.setAttribute('aria-controls', panel.id)
      btn.dataset.tab = tab
      btn.addEventListener('click', () => {
        filter.value = '' // a tab is its own list
        showTab(tab, false)
      })
      tablist.appendChild(btn)
      return { tab, btn }
    })
    hint.textContent = I().hint!.replace('{key}', d.keyLabel())
    const first = tabs[0]?.tab
    const tab = selected !== null && tabs.some((t) => t.tab === selected) ? selected : first
    if (tab === undefined) {
      panel.removeAttribute('aria-labelledby')
      panel.removeAttribute('aria-label')
      panel.replaceChildren(el(doc, 'p', 'cr-drawer-empty', I().empty))
      return
    }
    showTab(tab, false)
  }

  tablist.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || !tabs.length) return
    const at = tabs.findIndex((t) => t.btn === doc.activeElement)
    if (at < 0) return
    const n = tabs.length
    const to =
      e.key === 'ArrowRight' ? (at + 1) % n : e.key === 'ArrowLeft' ? (at - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1
    if (to < 0) return
    e.preventDefault()
    filter.value = ''
    showTab(tabs[to].tab, true) // selection follows focus
  })

  // The field: every key is text here (the page-level map skips dialogs; Space is a space), except Entrée (choose the first
  // match) and Échap (close, handled below). A printable key typed on a tab or an item moves into the field.
  filter.addEventListener('input', () => {
    if (selected !== null) renderItems(selected)
  })
  filter.addEventListener('keydown', (e) => {
    if (e.isComposing || e.key !== 'Enter' || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return
    e.preventDefault()
    const first = matches()?.[0]
    if (first) choose(first.deviceId)
  })
  root.addEventListener('keydown', (e) => {
    if (e.isComposing || e.defaultPrevented || e.target === filter || e.ctrlKey || e.altKey || e.metaKey) return
    // One printable character (not Space: that closes) typed on a tab or an item: it starts a search.
    if (e.key.length === 1 && e.key !== ' ' && !d.isToggleKey(e)) filter.focus() // the character then goes into the field
  })

  // Space (the inventory key) and Esc close from anywhere inside; the page-level key map skips dialogs.
  root.addEventListener('keydown', (e) => {
    if (e.isComposing) return
    const plain = !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey
    // In the search field Space is a space: only Échap is the drawer's.
    if (e.target === filter && e.key !== 'Escape') return
    // A held key closes it once (repeats would land on the canvas and re-open it).
    if (e.repeat && plain && d.isToggleKey(e)) {
      e.preventDefault()
      return
    }
    if (e.key === 'Escape' || (plain && d.isToggleKey(e))) {
      e.preventDefault() // also stops the button's own Space activation
      api.close()
    }
  })
  close.addEventListener('click', () => api.close())

  function choose(deviceId: string): void {
    api.close() // the 3D view is focused again before placement starts
    d.onChoose(deviceId)
  }

  const api: InventoryDrawer = {
    root,
    get isOpen() {
      return root.dataset.open === 'true'
    },
    open() {
      if (api.isOpen) return
      filter.value = ''
      build()
      root.inert = false
      root.getBoundingClientRect() // the closed pose is laid out before the slide starts
      root.dataset.open = 'true'
      ;(tabs.find((t) => t.tab === selected)?.btn ?? close).focus()
    },
    close(opts) {
      if (!api.isOpen) return
      root.dataset.open = 'false'
      root.inert = true
      if (opts?.returnFocus !== false) d.returnFocus()
    },
  }
  return api
}
