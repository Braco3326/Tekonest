/**
 * Écoute block (Task 39, CA-03, CA-26): at the bottom of « Propriétés » (never over the 3D view), the screen-reader and keyboard side of the sound. The
 * state, a Lecture / Stop button, and for each speaker its level, gain, delay and pan as TEXT (the bar is only a picture of the same level), then the
 * honest notes: a SIMPLE simulation, the volume starts low, a chosen file stays in the browser.
 *
 * DOM only, no scene, no audio, no timer: it renders the `ListenView` the controller hands in (listenModel.ts). It rebuilds nothing at the meter rate:
 * rows are created when a speaker appears and only their text and bar width change. Every control is a real button: named, a visible focus ring
 * (2 px Ambre + 1 px Nuit, in the CSS), no transition. A disabled « Lecture » stays focusable (`aria-disabled`) and its reason is its description.
 */
import './listen.css'
import type { DisposableBag } from '../../util/disposable'
import { COPY } from '../copy'
import type { ListenRow, ListenView } from '../listenModel'

const L = (): Readonly<Record<string, string>> => COPY.listen!
const SVG = 'http://www.w3.org/2000/svg'

export interface ListenPanelHandlers {
  /** The block's button: start the chosen source, or stop the one playing. */
  toggle(): void
}

export interface ListenPanel {
  readonly element: HTMLElement
  render(view: ListenView): void
  readonly open: boolean
  setOpen(open: boolean): void
}

let seq = 0

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

function chevron(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 12 12')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  svg.setAttribute('class', 'cr-listen-chevron')
  const p = doc.createElementNS(SVG, 'path')
  p.setAttribute('d', 'M2.5 4.5 6 8l3.5-3.5')
  p.setAttribute('fill', 'none')
  p.setAttribute('stroke', 'currentColor')
  p.setAttribute('stroke-width', '1.5')
  p.setAttribute('stroke-linecap', 'square')
  svg.appendChild(p)
  return svg
}

export function mountListenPanel(doc: Document, container: HTMLElement, before: HTMLElement | null, bag: DisposableBag, handlers: ListenPanelHandlers): ListenPanel {
  const t = L()
  const id = `cr-listen-${++seq}`
  const root = el(doc, 'section', 'cr-listen')
  root.dataset.testid = 'listen-panel'
  root.setAttribute('aria-label', t.panelTitle!)
  root.hidden = true

  const head = el(doc, 'div', 'cr-listen-head')
  const toggle = el(doc, 'button', 'cr-listen-toggle')
  toggle.type = 'button'
  toggle.dataset.testid = 'listen-toggle'
  toggle.setAttribute('aria-controls', `${id}-body`)
  toggle.append(el(doc, 'span', 'cr-listen-title', t.panelTitle), chevron(doc))
  head.append(toggle)

  const body = el(doc, 'div', 'cr-listen-body')
  body.id = `${id}-body`
  const state = el(doc, 'p', 'cr-listen-state')
  state.id = `${id}-state`
  state.dataset.testid = 'listen-state'
  const transport = el(doc, 'button', 'cr-listen-btn')
  transport.type = 'button'
  transport.dataset.testid = 'listen-transport'
  const reason = el(doc, 'p', 'cr-listen-note cr-listen-reason')
  reason.id = `${id}-reason`
  reason.dataset.testid = 'listen-reason'
  reason.hidden = true
  const silent = el(doc, 'p', 'cr-listen-note cr-listen-silent', t.silentMix)
  silent.dataset.testid = 'listen-silent'
  const metersTitle = el(doc, 'h3', 'cr-listen-h', t.metersTitle)
  const meters = el(doc, 'ul', 'cr-listen-meters')
  meters.dataset.testid = 'listen-meters'
  const none = el(doc, 'p', 'cr-listen-note', t.noSpeakers)
  none.dataset.testid = 'listen-none'
  // Always shown (brief §10, S3): the simulation is simple, the volume starts low, the file stays here.
  const simple = el(doc, 'p', 'cr-listen-note', t.simple)
  simple.dataset.testid = 'listen-simple'
  const volume = el(doc, 'p', 'cr-listen-note', t.volume)
  volume.dataset.testid = 'listen-volume'
  const local = el(doc, 'p', 'cr-listen-note', t.fileLocal)
  local.dataset.testid = 'listen-local'
  body.append(state, transport, reason, silent, metersTitle, meters, none, simple, volume, local)
  root.append(head, body)
  container.insertBefore(root, before)
  bag.add(() => root.remove())

  let open = true
  const applyOpen = (): void => {
    body.hidden = !open
    toggle.setAttribute('aria-expanded', String(open))
    const name = open ? t.panelCollapse! : t.panelExpand!
    toggle.setAttribute('aria-label', name)
    toggle.title = name
    root.dataset.open = String(open)
  }
  applyOpen()
  bag.listen(toggle, 'click', () => {
    open = !open
    applyOpen()
  })
  // A held Entrée must not start and stop the sound over and over: a native button clicks on every auto-repeat of Entrée.
  bag.listen(transport, 'keydown', (e: KeyboardEvent) => {
    if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault()
  })
  bag.listen(transport, 'click', () => {
    if (transport.getAttribute('aria-disabled') !== 'true') handlers.toggle()
  })

  const rows = new Map<string, { li: HTMLLIElement; text: HTMLElement; bar: HTMLElement; shownText: string; shownBar: number }>()
  const rowOf = (r: ListenRow): { li: HTMLLIElement; text: HTMLElement; bar: HTMLElement; shownText: string; shownBar: number } => {
    let row = rows.get(r.id)
    if (!row) {
      const li = el(doc, 'li', 'cr-listen-meter')
      li.dataset.instance = r.id
      const text = el(doc, 'span', 'cr-listen-meter-text')
      const track = el(doc, 'span', 'cr-listen-track')
      track.setAttribute('aria-hidden', 'true')
      const bar = el(doc, 'span', 'cr-listen-bar')
      track.appendChild(bar)
      li.append(text, track)
      row = { li, text, bar, shownText: '', shownBar: -1 }
      rows.set(r.id, row)
    }
    return row
  }

  return {
    element: root,
    get open() {
      return open
    },
    setOpen(next) {
      open = next
      applyOpen()
    },
    render(view) {
      root.hidden = !view.shown
      if (!view.shown) return
      const playing = view.state !== 'stopped'
      if (state.textContent !== view.line) state.textContent = view.line
      state.dataset.state = view.state
      // The button: « Stop » while the sound runs or starts; « Lecture » otherwise, off (still focusable) when the chain cannot play.
      const label = playing ? COPY.menu!.stop! : COPY.menu!.play!
      if (transport.textContent !== label) transport.textContent = label
      const off = !playing && !view.canStart
      if (off) transport.setAttribute('aria-disabled', 'true')
      else transport.removeAttribute('aria-disabled')
      // Its description is the first reason of the signal path, shown under it while it is off.
      reason.hidden = !off
      if (off) {
        if (reason.textContent !== view.reason) reason.textContent = view.reason
        transport.setAttribute('aria-describedby', reason.id)
      } else transport.removeAttribute('aria-describedby')
      silent.hidden = !(view.state === 'playing' && view.silent)
      none.hidden = !(view.state === 'playing' && view.rows.length === 0)
      metersTitle.hidden = meters.hidden = view.rows.length === 0
      const keep = new Set(view.rows.map((r) => r.id))
      for (const [rid, row] of rows) {
        if (!keep.has(rid)) {
          row.li.remove()
          rows.delete(rid)
        }
      }
      view.rows.forEach((r, i) => {
        const row = rowOf(r)
        if (row.shownText !== r.text) {
          row.text.textContent = r.text
          row.shownText = r.text
        }
        const w = Math.round(r.bar * 100)
        if (row.shownBar !== w) {
          row.bar.style.width = `${w}%`
          row.shownBar = w
        }
        if (meters.children[i] !== row.li) meters.insertBefore(row.li, meters.children[i] ?? null)
      })
    },
  }
}
