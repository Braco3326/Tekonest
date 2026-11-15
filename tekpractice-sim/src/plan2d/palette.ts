/**
 * The palette of the 2D schema page (mission 2, spec §1.2): the catalogue's devices with the inventory drawer's own families and names
 * (src/creation/inventory.ts: the same tabs, the same labels, the same search), as buttons. A click (or Entrée / Espace) asks to place the device at the
 * centre of the view; a drag from a button to the plan asks to place it where it is dropped. Bêta proposals are not listed (their ports are unverified).
 */
import type { Registry } from '../engine/CatalogLoader'
import { COPY } from '../creation/copy'
import { TAB_LABELS, filterItems, inventory, type InventoryItem } from '../creation/inventory'

const P = (): Readonly<Record<string, string>> => COPY.plan2d!
const fill = (s: string, vars: Record<string, string>): string => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)

export interface PaletteHandlers {
  /** Place at the view's centre. */
  onPick(deviceId: string): void
  /** Place where the pointer was released (client px); false when the point is not on the plan (nothing is placed). */
  onDrop(deviceId: string, clientX: number, clientY: number): boolean
}

export interface Palette {
  root: HTMLElement
  search: HTMLInputElement
  /** The items the search keeps (tests). */
  visible(): InventoryItem[]
}

/** A press that moves this far (px) is a drag, not a click. */
const DRAG_PX = 6

export function mountPalette(doc: Document, registry: Registry, h: PaletteHandlers): Palette {
  const { items } = inventory(registry, { proposals: [], modelIds: new Set() })
  const root = doc.createElement('section')
  root.className = 'p2d-palette'
  root.setAttribute('aria-labelledby', 'p2d-palette-title')
  root.dataset.testid = 'plan2d-palette'
  const title = doc.createElement('h3')
  title.id = 'p2d-palette-title'
  title.className = 'p2d-side-title'
  title.textContent = P().palette!
  const label = doc.createElement('label')
  label.className = 'p2d-search-label'
  label.textContent = P().search!
  const search = doc.createElement('input')
  search.type = 'search'
  search.className = 'p2d-search'
  search.id = 'p2d-search'
  search.autocomplete = 'off'
  label.htmlFor = search.id
  const list = doc.createElement('div')
  list.className = 'p2d-palette-list'
  const empty = doc.createElement('p')
  empty.className = 'p2d-empty'
  empty.hidden = true
  root.append(title, label, search, list, empty)

  let kept: InventoryItem[] = items
  const render = (): void => {
    kept = filterItems(items, search.value)
    list.replaceChildren()
    empty.hidden = kept.length > 0
    empty.textContent = kept.length ? '' : fill(P().noMatch!, { q: search.value.trim() })
    for (const tab of [...new Set(kept.map((i) => i.tab))]) {
      const group = doc.createElement('div')
      group.className = 'p2d-palette-group'
      group.setAttribute('role', 'group')
      const head = doc.createElement('h4')
      head.className = 'p2d-palette-tab'
      head.textContent = TAB_LABELS[tab]
      head.id = `p2d-tab-${tab}`
      group.setAttribute('aria-labelledby', head.id)
      group.append(head)
      for (const it of kept.filter((i) => i.tab === tab)) {
        const b = doc.createElement('button')
        b.type = 'button'
        b.className = 'p2d-palette-item'
        b.dataset.device = it.deviceId
        b.textContent = it.label
        b.setAttribute('aria-label', fill(P().placeItem!, { device: it.label }))
        wireItem(b, it.deviceId)
        group.append(b)
      }
      list.append(group)
    }
  }
  /** Click = place at the centre; a press that travels = a drag to the plan. A drag that ends off the plan places nothing. */
  const wireItem = (b: HTMLButtonElement, deviceId: string): void => {
    let start: { x: number; y: number; id: number } | null = null
    let dragged = false
    b.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      start = { x: e.clientX, y: e.clientY, id: e.pointerId }
      dragged = false
      try {
        b.setPointerCapture(e.pointerId)
      } catch {
        // a synthetic pointer (tests) has no capture: the drag still works on the button itself
      }
    })
    b.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id) return
      if (!dragged && Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_PX) {
        dragged = true
        b.classList.add('p2d-dragging')
      }
    })
    const end = (e: PointerEvent): void => {
      if (!start || e.pointerId !== start.id) return
      start = null
      b.classList.remove('p2d-dragging')
      if (dragged) h.onDrop(deviceId, e.clientX, e.clientY)
    }
    b.addEventListener('pointerup', end)
    b.addEventListener('pointercancel', () => {
      start = null
      dragged = false
      b.classList.remove('p2d-dragging')
    })
    b.addEventListener('click', (e) => {
      if (dragged) {
        dragged = false
        e.preventDefault()
        return
      }
      h.onPick(deviceId)
    })
  }
  search.addEventListener('input', render)
  render()
  return { root, search, visible: () => kept }
}
