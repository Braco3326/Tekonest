/**
 * « Choisir un lieu » (Task 12, C15, CA-04, CA-13): the start screen. It covers
 * the workspace (Projet, the 3D view, Propriétés) under the menubar, which stays
 * usable; the panels behind it are `inert` while it is open.
 *
 * - Two listboxes: « Modèles » (starter templates) and « Lieux » (36 cards),
 *   each one tab stop (roving tabindex), `aria-selected` on the highlighted card.
 * - Arrow keys / Home / End only move the highlight (`gridMove`); Enter or a
 *   click commits (CA-13: browsing never changes the place).
 * - A card with the L2 badge asks « Salle vide » / « Avec le matériel du
 *   modèle » (radio group + « Ouvrir ») in a small modal dialog.
 * - A filter by type; lazy thumbnails (`<img loading="lazy" alt="">`, the card text names the place).
 * - No transitions anywhere (reduced motion is the default here).
 * DOM only: choosing calls `onChoose`, the shell owns the place change.
 */
import { COPY } from '../copy'
import { gridMove, type GridKey, type PlaceCard } from './placePickerModel'

export type { PlaceCard } from './placePickerModel'
export { placeCards, templateCards } from './placePickerModel'
export { placeSummary } from '../placeSummary'

export interface PlacePickerDeps {
  doc: Document
  /** Where the picker lives (the shell root: it spans the workspace row). */
  parent: HTMLElement
  /** Made `inert` while the picker is open (the panels and the 3D view it covers). */
  covers: HTMLElement[]
  places: PlaceCard[]
  templates: PlaceCard[]
  /** URL prefix of the thumbnails (`<BASE_URL>room-thumbs/`). */
  thumbBase: string
  onChoose(card: PlaceCard, mode: 'empty' | 'gear'): void
}

export interface PlacePicker {
  readonly root: HTMLElement
  readonly isOpen: boolean
  /** `closable`: a place is already on screen (« Fermer » and Échap go back to it). `focus`: move focus to the highlighted card. */
  show(opts: { closable: boolean; focus: boolean }): void
  hide(): void
  /** Focus the highlighted card (skip link). */
  focus(): void
  /** While a chosen place opens: `aria-busy`, clicks ignored. */
  setBusy(on: boolean): void
}

const P = (): Readonly<Record<string, string>> => COPY.picker!
const GRID_KEYS: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'])

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

interface Grid {
  box: HTMLElement
  heading: HTMLElement
  cards: { card: PlaceCard; el: HTMLElement }[]
  /** Index into `cards` of the highlighted one. */
  at: number
}

export function mountPlacePicker(d: PlacePickerDeps): PlacePicker {
  const { doc } = d
  const root = el(doc, 'section', 'cr-pick')
  root.dataset.testid = 'place-picker'
  root.setAttribute('aria-labelledby', 'cr-picker-title')

  // ── head: title, hint, filter, close
  const head = el(doc, 'div', 'cr-pick-head')
  const titles = el(doc, 'div', 'cr-pick-titles')
  const h2 = el(doc, 'h2', 'cr-pick-title', P().title)
  h2.id = 'cr-picker-title'
  const hint = el(doc, 'p', 'cr-pick-hint', P().hint)
  hint.id = 'cr-picker-hint'
  const legend0 = el(doc, 'p', 'cr-pick-legend')
  legend0.appendChild(el(doc, 'span', undefined, P().legendIntro))
  for (const [k, cls] of [['legendStage', 'stage'], ['legendOperator', 'operator'], ['legendAudience', 'audience']] as const) {
    const item = el(doc, 'span', `cr-pick-key cr-pick-key--${cls}`, P()[k])
    legend0.appendChild(item)
  }
  titles.append(h2, hint, legend0)
  const tools = el(doc, 'div', 'cr-pick-tools')
  const filterLabel = el(doc, 'label', 'cr-pick-filter')
  const filterText = el(doc, 'span', undefined, P().filter)
  const filter = el(doc, 'select')
  filter.dataset.testid = 'place-filter'
  const types = [...new Set(d.places.map((c) => c.typeLabel))]
  filter.append(new Option(P().filterAll!, ''), ...types.map((t) => new Option(t, t)))
  filterLabel.append(filterText, filter)
  const close = el(doc, 'button', 'cr-pick-close', P().close)
  close.type = 'button'
  close.dataset.testid = 'place-picker-close'
  tools.append(filterLabel, close)
  head.append(titles, tools)

  // ── the two grids
  const scroll = el(doc, 'div', 'cr-pick-scroll')
  const grids: Grid[] = []
  const makeGrid = (id: string, title: string, cards: PlaceCard[], testid: string): Grid => {
    const heading = el(doc, 'h3', 'cr-pick-row', title)
    heading.id = `cr-pick-${id}-title`
    const box = el(doc, 'div', id === 'templates' ? 'cr-pick-grid cr-pick-grid--wide' : 'cr-pick-grid')
    box.setAttribute('role', 'listbox')
    box.setAttribute('aria-labelledby', heading.id)
    box.setAttribute('aria-describedby', hint.id)
    box.dataset.testid = testid
    const g: Grid = { box, heading, cards: [], at: 0 }
    cards.forEach((card, i) => {
      const o = el(doc, 'div', 'cr-card')
      o.id = `cr-pick-${id}-${i}`
      o.setAttribute('role', 'option')
      o.dataset.place = card.key
      o.tabIndex = -1
      const thumb = el(doc, 'div', 'cr-card-thumb')
      const img = el(doc, 'img')
      img.alt = '' // the card's text names the place
      img.loading = 'lazy'
      img.decoding = 'async'
      img.width = 160
      img.height = 120
      img.src = d.thumbBase + card.thumb
      thumb.appendChild(img)
      const text = el(doc, 'span', 'cr-card-text')
      const part = (cls: string, t: string): HTMLSpanElement => {
        const s = el(doc, 'span', `cr-card-${cls}`, t)
        s.id = `${o.id}-${cls}`
        return s
      }
      text.append(part('type', card.typeLabel), part('name', card.title), part('size', card.sizeLabel))
      o.append(thumb, text)
      const badgeText = card.withGear ? P().withGearBadge : card.key.startsWith('template:') ? P().devices!.replace('{n}', String(card.withGearCount)) : ''
      if (badgeText) text.appendChild(part('badge', badgeText))
      // Read the name first (visually the type sits above it): name, size, type, badge.
      o.setAttribute('aria-labelledby', ['name', 'size', 'type', ...(badgeText ? ['badge'] : [])].map((p) => `${o.id}-${p}`).join(' '))
      // The highlight follows focus, however it got there (a click, a screen reader, the skip link).
      o.addEventListener('focus', () => {
        if (g.at !== i) highlight(g, i, false)
      })
      o.addEventListener('click', () => {
        highlight(g, i, false)
        commit(g)
      })
      g.cards.push({ card, el: o })
      box.appendChild(o)
    })
    box.addEventListener('keydown', (e) => onGridKey(e, g))
    grids.push(g)
    scroll.append(heading, box)
    return g
  }
  if (d.templates.length) makeGrid('templates', P().templates!, d.templates, 'template-grid')
  const places = makeGrid('places', P().places!.replace('{n}', String(d.places.length)), d.places, 'place-grid')

  // ── « Salle vide » / « Avec le matériel du modèle »
  const confirm = el(doc, 'div', 'cr-pick-confirm')
  confirm.hidden = true
  const confirmBox = el(doc, 'form', 'cr-pick-confirm-box')
  // role="dialog" + aria-modal only while open (a hidden dialog role is noise for other queries and AT).
  const setDialogRole = (on: boolean): void => {
    if (on) {
      confirmBox.setAttribute('role', 'dialog')
      confirmBox.setAttribute('aria-modal', 'true')
    } else {
      confirmBox.removeAttribute('role')
      confirmBox.removeAttribute('aria-modal')
    }
  }
  confirmBox.setAttribute('aria-labelledby', 'cr-pick-confirm-title')
  confirmBox.dataset.testid = 'place-mode-dialog'
  const confirmTitle = el(doc, 'h3', 'cr-pick-confirm-title')
  confirmTitle.id = 'cr-pick-confirm-title'
  const fieldset = el(doc, 'fieldset', 'cr-pick-modes')
  const legend = el(doc, 'legend', 'cr-sr-only')
  fieldset.appendChild(legend)
  const radio = (value: 'empty' | 'gear', label: string): { input: HTMLInputElement; hintEl: HTMLElement | null } => {
    const row = el(doc, 'label', 'cr-pick-mode')
    const input = el(doc, 'input')
    input.type = 'radio'
    input.name = 'cr-pick-mode'
    input.value = value
    const text = el(doc, 'span', 'cr-pick-mode-text')
    text.appendChild(el(doc, 'span', 'cr-pick-mode-label', label))
    let hintEl: HTMLElement | null = null
    if (value === 'gear') {
      hintEl = el(doc, 'span', 'cr-pick-mode-hint')
      hintEl.id = 'cr-pick-mode-gear-hint'
      input.setAttribute('aria-describedby', hintEl.id)
      text.appendChild(hintEl)
    }
    row.append(input, text)
    fieldset.appendChild(row)
    return { input, hintEl }
  }
  const emptyRadio = radio('empty', P().confirmEmpty!)
  const gearRadio = radio('gear', P().confirmGear!)
  const actions = el(doc, 'div', 'cr-pick-confirm-actions')
  const openBtn = el(doc, 'button', 'cr-btn cr-btn-primary', P().confirmOpen)
  openBtn.type = 'submit'
  const cancelBtn = el(doc, 'button', 'cr-btn', P().confirmCancel)
  cancelBtn.type = 'button'
  actions.append(openBtn, cancelBtn)
  // Focus wraps inside the dialog without taking the focus key (C10): edge sentinels.
  const sentinel = (to: () => HTMLElement): HTMLSpanElement => {
    const s = el(doc, 'span')
    s.tabIndex = 0
    s.dataset.sentinel = ''
    s.addEventListener('focus', () => to().focus())
    return s
  }
  const firstRadio = (): HTMLElement => (gearRadio.input.checked ? gearRadio.input : emptyRadio.input)
  confirmBox.append(sentinel(() => cancelBtn), confirmTitle, fieldset, actions, sentinel(firstRadio))
  confirm.appendChild(confirmBox)

  root.append(head, scroll, confirm)
  root.hidden = true
  d.parent.appendChild(root)

  // ── state
  let open = false
  let closable = false
  let busy = false
  let pending: { grid: Grid; card: PlaceCard } | null = null

  const visible = (g: Grid): number[] => g.cards.map((c, i) => (c.el.hidden ? -1 : i)).filter((i) => i >= 0)
  const current = (g: Grid): { card: PlaceCard; el: HTMLElement } | undefined => g.cards[g.at]
  const highlight = (g: Grid, i: number, focus: boolean): void => {
    g.at = i
    g.cards.forEach((c, k) => {
      c.el.setAttribute('aria-selected', String(k === i))
      c.el.tabIndex = k === i ? 0 : -1
    })
    if (focus) g.cards[i]?.el.focus()
  }
  /** Columns of the laid-out grid: cards sharing the first visible card's row. */
  const columns = (g: Grid): number => {
    const vis = visible(g).map((i) => g.cards[i].el)
    if (!vis.length) return 1
    const top = vis[0].offsetTop
    const n = vis.filter((e) => e.offsetTop === top).length
    return Math.max(1, n)
  }

  function onGridKey(e: KeyboardEvent, g: Grid): void {
    if (e.ctrlKey || e.altKey || e.metaKey) return
    if (GRID_KEYS.has(e.key)) {
      const vis = visible(g)
      const pos = Math.max(0, vis.indexOf(g.at))
      const next = vis[gridMove(pos, e.key as GridKey, vis.length, columns(g))]
      if (next !== undefined) highlight(g, next, true)
      e.preventDefault()
      e.stopPropagation()
    } else if (e.key === 'Enter' || e.key === ' ') {
      // Enter commits; Space only (re)selects, as in a listbox (CA-13).
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Enter') commit(g)
    }
  }

  function commit(g: Grid): void {
    const c = current(g)
    if (!c || busy) return
    if (c.card.withGear) return openConfirm(g, c.card)
    d.onChoose(c.card, 'empty')
  }

  const setInert = (on: boolean): void => {
    head.inert = on
    scroll.inert = on
  }
  function openConfirm(grid: Grid, card: PlaceCard): void {
    pending = { grid, card }
    confirmTitle.textContent = P().confirmTitle!.replace('{place}', card.title)
    legend.textContent = confirmTitle.textContent
    gearRadio.hintEl!.textContent = P().confirmGearHint!.replace('{n}', String(card.withGearCount))
    emptyRadio.input.checked = true
    setDialogRole(true)
    confirm.hidden = false
    setInert(true)
    emptyRadio.input.focus()
  }
  function closeConfirm(): void {
    const p = pending
    pending = null
    confirm.hidden = true
    setDialogRole(false)
    setInert(false)
    if (p) current(p.grid)?.el.focus()
  }
  confirmBox.addEventListener('submit', (e) => {
    e.preventDefault()
    const p = pending
    if (!p) return
    const mode = gearRadio.input.checked ? 'gear' : 'empty'
    closeConfirm()
    d.onChoose(p.card, mode)
  })
  cancelBtn.addEventListener('click', () => closeConfirm())
  confirmBox.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      closeConfirm()
    }
  })

  // ── filter by type
  filter.addEventListener('change', () => {
    const t = filter.value
    for (const c of places.cards) c.el.hidden = t !== '' && c.card.typeLabel !== t
    const vis = visible(places)
    places.heading.textContent = P().places!.replace('{n}', String(vis.length))
    if (!vis.includes(places.at) && vis.length) highlight(places, vis[0], false)
  })

  // ── close (a place is on screen)
  const hide = (): void => {
    if (pending) closeConfirm()
    open = false
    root.hidden = true
    for (const c of d.covers) c.inert = false
  }
  close.addEventListener('click', () => {
    if (closable) hide()
  })
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && closable && !pending) {
      e.preventDefault()
      e.stopPropagation()
      hide()
    }
  })

  for (const g of grids) highlight(g, 0, false)

  return {
    root,
    get isOpen() {
      return open
    },
    show({ closable: c, focus }) {
      closable = c
      close.hidden = !c
      open = true
      root.hidden = false
      for (const cov of d.covers) cov.inert = true
      if (focus) current(places)?.el.focus()
    },
    hide,
    focus() {
      current(places)?.el.focus()
    },
    setBusy(on) {
      busy = on
      root.setAttribute('aria-busy', String(on))
    },
  }
}
