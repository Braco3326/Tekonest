/**
 * The status bar's controls (Task 14, CA-15, C17): selection, snapping, the
 * autosave state (and a persistent line with its action while it is paused),
 * and the signal button that opens the persistent error list (a non-modal
 * `role="dialog"` pop-over: Échap closes it and focus returns to the button).
 * The list is never a toast: it stays until the rig changes it.
 * DOM only: it renders a StatusView handed in by the owner (boot.ts).
 */
import { COPY } from '../copy'
import type { PortRef } from '../../engine/types'
import type { AutosaveView, StatusError, StatusView } from './statusModel'

export interface StatusBarDeps {
  doc: Document
  /** The footer (layout.ts) the controls go into. */
  bar: HTMLElement
  /** Where the pop-over is appended (inside `.cr`, so the shell styles apply). */
  root: HTMLElement
  /** « Yamaha QL1 (ql1) · in-mic-2 » for the ports line. */
  portLabel(p: PortRef): string
  /** An error row was chosen: select its first device (and fly to it). */
  pick(e: StatusError): void
  /** The persistent autosave line's button. */
  autosaveAction(a: NonNullable<AutosaveView['action']>): void
}

export interface StatusBar {
  render(v: StatusView): void
  renderAutosave(a: AutosaveView): void
  readonly isOpen: boolean
  open(): void
  close(returnFocus?: boolean): void
}

const S = (): Readonly<Record<string, string>> => COPY.status!
const ACTION_LABEL = (a: NonNullable<AutosaveView['action']>): string =>
  a === 'export' ? S().actionExport! : a === 'checked' ? COPY.project!.checkedFile! : COPY.project!.resumeHere!
/** Glyphs beside the words (never colour alone). */
const GLYPH: Record<StatusError['severity'] | 'ok', string> = { ok: '✓', error: '⚠', warning: 'ⓘ', rejection: '⊘' }

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}
/** Writes only when the text changes (no needless DOM churn on every store change). */
const setText = (e: HTMLElement, t: string): void => {
  if (e.textContent !== t) e.textContent = t
}

export function mountStatusBar(d: StatusBarDeps): StatusBar {
  const { doc } = d
  const selection = el(doc, 'span', 'cr-status-sel')
  selection.dataset.testid = 'status-selection'
  const snapping = el(doc, 'span', 'cr-status-snap')
  snapping.dataset.testid = 'status-snapping'
  const save = el(doc, 'span', 'cr-status-save')
  save.dataset.testid = 'status-autosave'
  const pause = el(doc, 'span', 'cr-status-pause')
  pause.dataset.testid = 'status-autosave-paused'
  pause.hidden = true
  const pauseText = el(doc, 'span', 'cr-status-pause-text')
  const pauseBtn = el(doc, 'button', 'cr-status-action')
  pauseBtn.type = 'button'
  pauseBtn.dataset.testid = 'status-autosave-action'
  pause.append(pauseText, pauseBtn)
  let pauseAction: AutosaveView['action'] = null
  pauseBtn.addEventListener('click', () => pauseAction && d.autosaveAction(pauseAction))

  // ── the signal button
  const signal = el(doc, 'button', 'cr-signal')
  signal.type = 'button'
  signal.dataset.testid = 'signal-status'
  signal.setAttribute('aria-haspopup', 'dialog')
  signal.setAttribute('aria-expanded', 'false')
  signal.setAttribute('aria-controls', 'cr-error-list')
  signal.title = S().signalHint!
  const glyph = el(doc, 'span', 'cr-signal-glyph')
  glyph.setAttribute('aria-hidden', 'true')
  const label = el(doc, 'span', 'cr-signal-label')
  label.dataset.testid = 'signal-label'
  const extra = el(doc, 'span', 'cr-signal-extra')
  extra.dataset.testid = 'signal-extra'
  signal.append(glyph, label, extra)

  const right = el(doc, 'div', 'cr-status-right')
  right.append(selection, snapping, save, pause, signal)
  d.bar.append(right)

  // ── the pop-over (non-modal dialog)
  const pop = el(doc, 'section', 'cr-errlist')
  pop.id = 'cr-error-list'
  pop.dataset.testid = 'error-list'
  pop.setAttribute('role', 'dialog')
  pop.setAttribute('aria-labelledby', 'cr-error-list-title')
  pop.setAttribute('aria-describedby', 'cr-error-list-hint')
  pop.hidden = true
  const head = el(doc, 'div', 'cr-errlist-head')
  const h = el(doc, 'h2', 'cr-errlist-title', S().listTitle)
  h.id = 'cr-error-list-title'
  const x = el(doc, 'button', 'cr-errlist-close', '×')
  x.type = 'button'
  x.setAttribute('aria-label', S().listClose!)
  x.title = S().listClose!
  x.addEventListener('click', () => close(true))
  head.append(h, x)
  const hint = el(doc, 'p', 'cr-errlist-hint', S().listHint)
  hint.id = 'cr-error-list-hint'
  const list = el(doc, 'ul', 'cr-errlist-rows')
  list.dataset.testid = 'error-rows'
  const empty = el(doc, 'p', 'cr-errlist-empty', S().listEmpty)
  pop.append(head, hint, list, empty)
  // In the DOM only while open (a closed list is not a dialog anywhere in the page).

  let view: StatusView | null = null
  let isOpen = false
  const tagOf = (s: StatusError['severity']): string => (s === 'rejection' ? S().tagRefused! : s === 'error' ? S().tagError! : S().tagWarning!)

  const renderRows = (): void => {
    if (!view) return
    const errs = view.errors
    // Keep focus on the same row (by id) across a rebuild.
    const focusedId = (doc.activeElement as HTMLElement | null)?.closest?.('[data-error-id]')?.getAttribute('data-error-id') ?? null
    list.textContent = ''
    for (const e of errs) {
      const li = el(doc, 'li')
      const b = el(doc, 'button', 'cr-errlist-row')
      b.type = 'button'
      b.dataset.errorId = e.id
      b.dataset.severity = e.severity
      b.dataset.testid = `error-row-${e.id}`
      const g = el(doc, 'span', 'cr-errlist-glyph', GLYPH[e.severity])
      g.setAttribute('aria-hidden', 'true')
      // « Connexion refusée : » reads as one phrase before the title
      const tag = el(doc, 'span', 'cr-errlist-tag', `${tagOf(e.severity)} :`)
      const title = el(doc, 'span', 'cr-errlist-rtitle', e.title)
      const top = el(doc, 'span', 'cr-errlist-top')
      top.append(g, tag, title)
      b.append(top)
      if (e.detail) b.append(el(doc, 'span', 'cr-errlist-detail', e.detail))
      if (e.ports.length) b.append(el(doc, 'span', 'cr-errlist-ports', S().ports!.replace('{ports}', e.ports.map(d.portLabel).join(' → '))))
      b.addEventListener('click', () => {
        close(true)
        d.pick(e)
      })
      li.appendChild(b)
      list.appendChild(li)
    }
    empty.hidden = errs.length > 0
    if (focusedId !== null && isOpen) {
      const again = list.querySelector<HTMLElement>(`[data-error-id="${CSS.escape(focusedId)}"]`)
      ;(again ?? list.querySelector<HTMLElement>('button') ?? x).focus()
    }
  }

  const render = (v: StatusView): void => {
    view = v
    setText(selection, v.selection)
    setText(snapping, v.snapping)
    setText(glyph, v.signal.kind === 'ok' ? GLYPH.ok : GLYPH.error)
    setText(label, v.signal.label)
    setText(extra, v.extra ? ` · ${v.extra}` : '')
    signal.dataset.kind = v.signal.kind
    if (isOpen) renderRows()
  }

  const renderAutosave = (a: AutosaveView): void => {
    setText(save, a.label)
    save.dataset.state = a.state
    // The persistent line replaces the short state while paused (same fact, said once).
    save.hidden = a.label === '' || a.line !== ''
    pause.hidden = a.line === ''
    setText(pauseText, a.line)
    pauseAction = a.action
    pauseBtn.hidden = a.action === null
    if (a.action) setText(pauseBtn, ACTION_LABEL(a.action))
  }

  const onDocDown = (e: Event): void => {
    const t = e.target as Node | null
    if (t && !pop.contains(t) && !signal.contains(t)) close(false)
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    close(true)
  }
  pop.addEventListener('keydown', onKey)
  // Non-modal: Tab is never trapped. Focus leaving the list (not to its button) closes it, so it never lingers over the view.
  pop.addEventListener('focusout', (e) => {
    const to = e.relatedTarget as Node | null
    if (isOpen && to && !pop.contains(to) && !signal.contains(to)) close(false)
  })

  const open = (): void => {
    if (isOpen) return
    isOpen = true
    d.root.appendChild(pop)
    pop.hidden = false
    signal.setAttribute('aria-expanded', 'true')
    renderRows()
    ;(list.querySelector<HTMLElement>('button') ?? x).focus()
    doc.addEventListener('pointerdown', onDocDown, true)
  }
  function close(returnFocus = true): void {
    if (!isOpen) return
    isOpen = false
    pop.hidden = true
    pop.remove()
    signal.setAttribute('aria-expanded', 'false')
    doc.removeEventListener('pointerdown', onDocDown, true)
    if (returnFocus) signal.focus()
  }
  signal.addEventListener('click', () => (isOpen ? close(true) : open()))

  return {
    render,
    renderAutosave,
    get isOpen() {
      return isOpen
    },
    open,
    close,
  }
}
