/**
 * The checklist « Pourquoi je n’entends rien ? » (T1.3b): a chip in the status bar that opens a non-modal list (a `role="dialog"` pop-over, like the
 * error list: Échap closes it and the focus goes back to the chip, Tab is never trapped, a click or focus outside closes it). Read-only: it renders
 * a ChecklistView (checklistModel.ts, the engine's own playback reasons) and « Aller à » only asks the owner to select a device or open the
 * inventory; nothing here touches the design. The one exception is the power helper's button (T3.3, under `?design` only): a click hands over to the owner,
 * which cables the console and speakers to the strip the learner placed, as one undo entry (src/creation/powerHelper.ts). DOM only; it needs no guide, so it works with `?oscar=0` and in every package.
 *
 * Two forms (onboarding plan T6.2, the package's `layout.checklist`): the CHIP (above: a pop-over opened from the status bar) and the PANEL (`dock` given): the same list, docked at the foot of the
 * Projet panel, on the page for as long as playback is blocked and a place is open: no chip, no dialog role, no focus stolen, no Échap (nothing to close). Where the dock cannot be seen (the Projet
 * panel folded, a phone-width window) the list is the chip's pop-over as before, so it is never out of reach. One list element, never two: its test ids are unique in both forms.
 */
import { COPY } from '../copy'
import type { ChecklistRow, ChecklistView, GoTo, RowState } from '../checklistModel'

export interface ChecklistDeps {
  doc: Document
  /** The status bar's slot (statusBar.ts `checklistSlot`): the chip goes in it. */
  slot: HTMLElement
  /** Where the pop-over is appended while open (inside `.cr`, so the shell styles apply). */
  root: HTMLElement
  /** The live view, read on every render. */
  view(): ChecklistView
  /** « Yamaha QL1 (ql1) » for the accessible name of « Aller à ». */
  deviceLabel(instance: string): string
  /** « Aller à » (the list is already closed): select the device or open the inventory. */
  goTo(target: GoTo): void
  /** Hands the focus back to the page when the chip or the list disappears while holding it. */
  returnFocus(): void
  /**
   * The power helper's button on the « Alimentation » row (T3.3, spec 6.5; only under `?design`): what to show, read on every render, and what a click does
   * (the list is already closed). Absent = no button. `note` is the visible line under it: what a click does, or why it is disabled.
   */
  helper?: { view(): HelperView; run(): void }
  /**
   * The PANEL form (T6.2): where the list is docked while that place can be seen. Absent = the chip form. It is shown only while `root.dataset.tree` is not `collapsed` (the shell marks it on `.cr`):
   * folded, the list becomes the chip's pop-over again.
   */
  dock?: HTMLElement
}

export type HelperView = { shown: false } | { shown: true; enabled: boolean; note: string }

export interface Checklist {
  render(): void
  readonly isOpen: boolean
  open(): void
  close(returnFocus?: boolean): void
}

const C = (): Readonly<Record<string, string>> => COPY.checklist!
/** Glyphs beside the words (never colour alone). */
const GLYPH: Readonly<Record<RowState, string>> = { ok: '✓', unchecked: '○', blocked: '⚠' }
const TAG_KEY: Readonly<Record<RowState, string>> = { ok: 'tagOk', unchecked: 'tagUnchecked', blocked: 'tagBlocked' }

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

export function mountChecklist(d: ChecklistDeps): Checklist {
  const { doc } = d

  const chip = el(doc, 'button', 'cr-checklist-chip', C().title)
  chip.type = 'button'
  chip.dataset.testid = 'checklist-chip'
  chip.title = C().chipHint!
  chip.hidden = true
  chip.setAttribute('aria-haspopup', 'dialog')
  chip.setAttribute('aria-expanded', 'false')
  d.slot.appendChild(chip)

  const pop = el(doc, 'section', 'cr-checklist')
  pop.id = 'cr-checklist'
  pop.dataset.testid = 'checklist'
  pop.setAttribute('role', 'dialog')
  pop.setAttribute('aria-labelledby', 'cr-checklist-title')
  pop.setAttribute('aria-describedby', 'cr-checklist-intro')
  pop.hidden = true
  const head = el(doc, 'div', 'cr-errlist-head')
  const h = el(doc, 'h2', 'cr-errlist-title', C().title)
  h.id = 'cr-checklist-title'
  const x = el(doc, 'button', 'cr-errlist-close', '×')
  x.type = 'button'
  x.setAttribute('aria-label', C().close!)
  x.title = C().close!
  head.append(h, x)
  // While the helper's button is in the list, the list can add cables (one button): its intro says so instead of « Rien n’est modifié ici ». Set at each
  // render of the rows (T3 close review N2: not whenever a helper is wired, the button is often absent).
  const intro = el(doc, 'p', 'cr-errlist-hint', C().intro)
  intro.id = 'cr-checklist-intro'
  const list = el(doc, 'ol', 'cr-checklist-rows')
  list.dataset.testid = 'checklist-rows'
  const micLine = el(doc, 'p', 'cr-checklist-mic')
  const micLabel = el(doc, 'span', 'cr-checklist-mic-label', C().rowMic)
  const micText = el(doc, 'span', 'cr-checklist-mic-text')
  micText.dataset.testid = 'checklist-mic'
  micLine.append(micLabel, ' ', micText)
  pop.append(head, intro, list, micLine)
  // In the DOM only while open (a closed list is not a dialog anywhere in the page).

  let isOpen = false
  /** The panel form is on screen: the list sits in the dock and `isOpen` is true for as long as it shows. */
  let docked = false
  /** What the rows were built from: a rebuild only on a change, so the focus on a button is never lost to a refresh with the same content. */
  let built = ''

  const targetName = (g: GoTo): string => (g.kind === 'inventory' ? C().targetInventory! : d.deviceLabel(g.instance))
  const rowEl = (r: ChecklistRow): HTMLElement => {
    const li = el(doc, 'li', 'cr-checklist-row')
    li.dataset.row = r.id
    li.dataset.state = r.state
    li.dataset.testid = `checklist-row-${r.id}`
    const top = el(doc, 'span', 'cr-checklist-top')
    const g = el(doc, 'span', 'cr-errlist-glyph', GLYPH[r.state])
    g.setAttribute('aria-hidden', 'true')
    // the separator is its own node so the docked form (a narrow column) can drop it when the tag goes under the label; the text of the tag is unchanged
    const dot = el(doc, 'span', 'cr-checklist-dot', '· ')
    dot.setAttribute('aria-hidden', 'true')
    const tag = el(doc, 'span', 'cr-checklist-tag')
    tag.append(dot, C()[TAG_KEY[r.state]]!)
    top.append(g, el(doc, 'span', 'cr-checklist-label', r.label), tag)
    li.append(top)
    if (r.detail !== '') li.append(el(doc, 'span', 'cr-checklist-detail', r.detail))
    if (r.id === 'power') helperIn(li)
    if (r.goTo) {
      const go = r.goTo
      const b = el(doc, 'button', 'cr-status-action cr-checklist-go', C().goTo)
      b.type = 'button'
      b.dataset.testid = `checklist-goto-${r.id}`
      b.setAttribute('aria-label', C().goToLabel!.replace('{target}', targetName(go)))
      b.addEventListener('click', () => {
        // The button is about to be removed with the list: the focus goes to the chip first (a selection leaves it there; the inventory takes it itself
        // once its chunk is loaded, and if that fails the focus is still on a live control, never on the page body).
        close(true)
        d.goTo(go)
      })
      li.append(b)
    }
    return li
  }

  /** The helper's button and its visible note, on the « Alimentation » row; a disabled button keeps its box (Oscar can point at it) and says why. */
  const helperIn = (li: HTMLElement): void => {
    const h = helperView()
    if (!h.shown) return
    const wrap = el(doc, 'div', 'cr-checklist-helper')
    const b = el(doc, 'button', 'cr-status-action cr-checklist-power', C().helperButton)
    b.type = 'button'
    b.dataset.testid = 'checklist-power'
    b.disabled = !h.enabled
    const note = el(doc, 'span', 'cr-checklist-detail cr-checklist-power-note', h.note)
    note.id = 'cr-checklist-power-note'
    note.dataset.testid = 'checklist-power-note'
    b.setAttribute('aria-describedby', note.id)
    b.addEventListener('click', () => {
      if (b.disabled) return
      close(true)
      d.helper?.run()
    })
    wrap.append(b, note)
    li.append(wrap)
  }
  const helperView = (): HelperView => {
    try {
      return d.helper?.view() ?? { shown: false }
    } catch {
      return { shown: false }
    }
  }

  const renderRows = (v: ChecklistView): void => {
    const helper = helperView()
    const key = JSON.stringify([v.rows.map((r) => [r.id, r.state, r.detail, r.goTo]), v.mic, helper])
    if (key === built) return
    built = key
    // the helper's button sits on the « Alimentation » row only: the intro says what the list can change only while that button is there
    intro.textContent = helper.shown && v.rows.some((r) => r.id === 'power') ? C().introHelper! : C().intro!
    const focusedRow = (doc.activeElement as HTMLElement | null)?.closest?.('[data-row]')?.getAttribute('data-row') ?? null
    list.textContent = ''
    for (const r of v.rows) list.appendChild(rowEl(r))
    micText.textContent = v.mic.text
    if (focusedRow !== null && isOpen) {
      const again = list.querySelector<HTMLElement>(`[data-row="${focusedRow}"] button`)
      ;(again ?? list.querySelector<HTMLElement>('button') ?? x).focus()
    }
  }

  const holdsFocus = (): boolean => {
    const a = doc.activeElement
    return a !== null && (pop.contains(a) || a === chip)
  }

  /** The dock can be seen: the panel form is asked for and the Projet panel is not folded. */
  const dockSeen = (): boolean => d.dock !== undefined && d.root.dataset.tree !== 'collapsed'
  function dockIn(): void {
    if (docked || d.dock === undefined) return
    if (isOpen) close(false) // the pop-over leaves first
    docked = true
    isOpen = true
    built = ''
    pop.removeAttribute('role') // a labelled region on the page, not a dialog
    pop.dataset.form = 'docked'
    pop.hidden = false
    d.dock.appendChild(pop)
    chip.hidden = true
    chip.removeAttribute('aria-controls')
    chip.setAttribute('aria-expanded', 'false')
  }
  function undock(): void {
    if (!docked) return
    docked = false
    isOpen = false
    pop.remove()
    pop.hidden = true
    delete pop.dataset.form
    pop.setAttribute('role', 'dialog')
  }

  const render = (): void => {
    const v = d.view()
    if (!v.visible) {
      // It goes with the problem: the chip and the list leave together, and the focus is not left on something that vanished.
      const had = holdsFocus()
      if (docked) undock()
      if (isOpen) close(false)
      chip.hidden = true
      if (had) d.returnFocus()
      return
    }
    if (dockSeen()) {
      dockIn()
      renderRows(v)
      return
    }
    // the panel form while the dock cannot be seen (folded Projet): the chip and its pop-over, as in the chip form
    if (docked) {
      const had = pop.contains(doc.activeElement)
      undock()
      if (had) d.returnFocus()
    }
    chip.hidden = false
    if (isOpen) renderRows(v)
  }

  const onDocDown = (e: Event): void => {
    const t = e.target as Node | null
    if (t && !pop.contains(t) && !chip.contains(t)) close(false)
  }
  pop.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || docked) return
    e.preventDefault()
    e.stopPropagation()
    close(true)
  })
  // Non-modal: Tab is never trapped. Focus leaving the list (not to its chip) closes it, so it never lingers over the view.
  pop.addEventListener('focusout', (e) => {
    const to = e.relatedTarget as Node | null
    if (isOpen && !docked && to && !pop.contains(to) && !chip.contains(to)) close(false)
  })
  x.addEventListener('click', () => close(true))

  function open(): void {
    if (isOpen || docked) return
    const v = d.view()
    if (!v.visible) return
    isOpen = true
    built = ''
    d.root.appendChild(pop)
    pop.hidden = false
    chip.setAttribute('aria-controls', pop.id)
    chip.setAttribute('aria-expanded', 'true')
    renderRows(v)
    ;(list.querySelector<HTMLElement>('button') ?? x).focus()
    doc.addEventListener('pointerdown', onDocDown, true)
  }
  function close(returnFocus = true): void {
    if (!isOpen || docked) return
    isOpen = false
    pop.hidden = true
    pop.remove()
    chip.removeAttribute('aria-controls')
    chip.setAttribute('aria-expanded', 'false')
    doc.removeEventListener('pointerdown', onDocDown, true)
    if (returnFocus) chip.focus()
  }
  // The Projet panel folds or unfolds (the shell marks `data-tree` on the root): the list moves between the dock and the chip's pop-over with it.
  if (d.dock !== undefined) {
    const Observer = doc.defaultView?.MutationObserver
    if (typeof Observer === 'function') new Observer(() => render()).observe(d.root, { attributes: true, attributeFilter: ['data-tree'] })
  }
  chip.addEventListener('click', () => (isOpen ? close(true) : open()))
  chip.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen) return
    e.preventDefault()
    e.stopPropagation()
    close(true)
  })

  return {
    render,
    get isOpen() {
      return isOpen
    },
    open,
    close,
  }
}
