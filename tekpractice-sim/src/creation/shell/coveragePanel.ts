/**
 * Coverage block (Task 37, C13, CA-24): legend, statistics and honesty notes, at the bottom of « Propriétés » (never over the 3D view). It is the
 * screen-reader equivalent of the dots: every number the dots stand for (the dots per colour, the min / max / mean / σ / count, the level at the
 * named points and at the pinned one) is real text here. Colour is never the only cue: each legend row prints its dB range.
 *
 * DOM only, no scene, no timer, no render request. Fed by the controller with a plain `CoverageView` (coverageModel.ts); it never reads the rig
 * (C6: the shell dispatches intents only; here there is no intent at all, the pin is a view setting). Hidden entirely while the coverage is off.
 * Every control is a real button: named, `aria-expanded` where it opens something, a visible focus ring (2 px Ambre + 1 px Nuit, in the CSS), no
 * transition. The fidelity chip « relatif » opens a pop-over (Échap closes it and gives the focus back).
 */
import './coverage.css'
import type { DisposableBag } from '../../util/disposable'
import { COPY } from '../copy'
import type { CoverageView, LegendRow } from '../coverageModel'
import { COVERAGE_PALETTE } from '../coveragePalette'
import { CREATION_TOKENS } from '../../design/creationTokens'

const C = (): Readonly<Record<string, string>> => COPY.coverage!
const SVG = 'http://www.w3.org/2000/svg'

export interface CoveragePanelHandlers {
  /** Pin the level at a named point (its id), or at nothing (`null` removes the pin). */
  pin(id: string | null): void
}

export interface CoveragePanel {
  readonly element: HTMLElement
  render(view: CoverageView): void
  readonly open: boolean
  setOpen(open: boolean): void
  readonly popoverOpen: boolean
}

let seq = 0

function chevron(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 12 12')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  svg.setAttribute('class', 'cr-cov-chevron')
  const p = doc.createElementNS(SVG, 'path')
  p.setAttribute('d', 'M2.5 4.5 6 8l3.5-3.5')
  p.setAttribute('fill', 'none')
  p.setAttribute('stroke', 'currentColor')
  p.setAttribute('stroke-width', '1.5')
  p.setAttribute('stroke-linecap', 'square')
  svg.appendChild(p)
  return svg
}

/** A colour square (the bin's colour); the hatched one has diagonal stripes over its colour. */
function swatch(doc: Document, color: string, hatched = false): SVGSVGElement {
  const svg = doc.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 14 14')
  svg.setAttribute('class', 'cr-cov-swatch')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const r = doc.createElementNS(SVG, 'rect')
  r.setAttribute('width', '14')
  r.setAttribute('height', '14')
  r.setAttribute('fill', color)
  svg.appendChild(r)
  if (hatched) {
    for (const x of [-4, 2, 8, 14]) {
      const l = doc.createElementNS(SVG, 'line')
      l.setAttribute('x1', String(x))
      l.setAttribute('y1', '14')
      l.setAttribute('x2', String(x + 14))
      l.setAttribute('y2', '0')
      l.setAttribute('stroke', CREATION_TOKENS.color.nuit)
      l.setAttribute('stroke-width', '2.5')
      svg.appendChild(l)
    }
  }
  return svg
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

export function mountCoveragePanel(doc: Document, container: HTMLElement, before: HTMLElement | null, bag: DisposableBag, handlers: CoveragePanelHandlers): CoveragePanel {
  const L = C()
  const id = `cr-cov-${++seq}`
  const root = el(doc, 'section', 'cr-cov')
  root.dataset.testid = 'coverage-panel'
  root.setAttribute('aria-label', L.panelTitle!)
  root.hidden = true

  const head = el(doc, 'div', 'cr-cov-head')
  const toggle = el(doc, 'button', 'cr-cov-toggle')
  toggle.type = 'button'
  toggle.dataset.testid = 'coverage-toggle'
  toggle.setAttribute('aria-controls', `${id}-body`)
  toggle.append(el(doc, 'span', 'cr-cov-title', L.panelTitle), chevron(doc))
  const chip = el(doc, 'button', 'cr-cov-chip', L.chip)
  chip.type = 'button'
  chip.dataset.testid = 'coverage-chip'
  chip.setAttribute('aria-label', L.chipName!)
  chip.setAttribute('aria-controls', `${id}-pop`)
  chip.setAttribute('aria-expanded', 'false')
  head.append(toggle, chip)

  const pop = el(doc, 'p', 'cr-cov-pop', L.chipPopover)
  pop.id = `${id}-pop`
  pop.dataset.testid = 'coverage-popover'
  pop.hidden = true

  const body = el(doc, 'div', 'cr-cov-body')
  body.id = `${id}-body`
  const status = el(doc, 'p', 'cr-cov-status')
  status.dataset.testid = 'coverage-status'
  // Always shown with the block (decision L30 viii): the aim line is the truth; the 3D model's shape may not match the real front.
  const caveat = el(doc, 'p', 'cr-cov-note', L.frontCaveat)
  caveat.dataset.testid = 'coverage-caveat'
  const ready = el(doc, 'div', 'cr-cov-ready')
  ready.dataset.testid = 'coverage-ready'

  // static honesty lines (always the same words)
  const unit = el(doc, 'p', 'cr-cov-unit', L.unit)
  unit.dataset.testid = 'coverage-unit'
  const method = el(doc, 'p', 'cr-cov-note', L.method)
  method.dataset.testid = 'coverage-method'
  const legendTitle = el(doc, 'h3', 'cr-cov-h', L.legendTitle)
  const legend = el(doc, 'ul', 'cr-cov-legend')
  legend.dataset.testid = 'coverage-legend'
  const hatched = el(doc, 'p', 'cr-cov-hatched')
  hatched.dataset.testid = 'coverage-hatched'
  const aim = el(doc, 'p', 'cr-cov-note', L.aim)
  const source = el(doc, 'p', 'cr-cov-note')
  source.dataset.testid = 'coverage-source'
  const speakersTitle = el(doc, 'h3', 'cr-cov-h', L.speakersTitle)
  const speakers = el(doc, 'ul', 'cr-cov-list')
  speakers.dataset.testid = 'coverage-speakers'
  const statsTitle = el(doc, 'h3', 'cr-cov-h', L.statsTitle)
  const stats = el(doc, 'dl', 'cr-cov-stats')
  stats.dataset.testid = 'coverage-stats'
  const pointsTitle = el(doc, 'h3', 'cr-cov-h', L.pointsTitle)
  const points = el(doc, 'ul', 'cr-cov-points')
  points.dataset.testid = 'coverage-points'
  const pinned = el(doc, 'p', 'cr-cov-pinned')
  pinned.dataset.testid = 'coverage-pinned'
  const unpin = el(doc, 'button', 'cr-cov-btn', L.unpin)
  unpin.type = 'button'
  unpin.dataset.testid = 'coverage-unpin'
  const pinRow = el(doc, 'div', 'cr-cov-pinrow')
  pinRow.append(pinned, unpin)
  const hint = el(doc, 'p', 'cr-cov-note', L.pinHint)
  const spl = el(doc, 'p', 'cr-cov-note', L.splPending)
  spl.dataset.testid = 'coverage-spl'
  ready.append(unit, method, legendTitle, legend, hatched, aim, source, speakersTitle, speakers, statsTitle, stats, pointsTitle, points, pinRow, hint, spl)
  body.append(status, caveat, ready)

  root.append(head, pop, body)
  container.insertBefore(root, before)
  bag.add(() => root.remove())

  let open = true
  let popOpen = false
  const applyOpen = (): void => {
    body.hidden = !open
    toggle.setAttribute('aria-expanded', String(open))
    const name = open ? L.panelCollapse! : L.panelExpand!
    toggle.setAttribute('aria-label', name)
    toggle.title = name
    root.dataset.open = String(open)
  }
  const applyPop = (): void => {
    pop.hidden = !popOpen
    chip.setAttribute('aria-expanded', String(popOpen))
  }
  applyOpen()
  applyPop()
  bag.listen(toggle, 'click', () => {
    open = !open
    applyOpen()
  })
  bag.listen(chip, 'click', () => {
    popOpen = !popOpen
    applyPop()
  })
  bag.listen(root, 'keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !popOpen) return
    e.stopPropagation() // the pop-over closes; the shell's own Échap (selection, drawer) is not for this
    popOpen = false
    applyPop()
    chip.focus()
  })
  bag.listen(unpin, 'click', () => handlers.pin(null))
  // Named-point buttons are rebuilt with the view: one delegated listener.
  bag.listen(points, 'click', (e: MouseEvent) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button[data-point]')
    if (b?.dataset.point) handlers.pin(b.dataset.point)
  })

  let shown = ''
  const row = (r: LegendRow): HTMLElement => {
    const li = el(doc, 'li', 'cr-cov-bin')
    li.dataset.bin = String(r.bin)
    li.append(swatch(doc, r.color), el(doc, 'span', 'cr-cov-bin-label', r.label))
    if (r.countLabel) li.append(el(doc, 'span', 'cr-cov-count', r.countLabel))
    return li
  }

  return {
    element: root,
    get open() {
      return open
    },
    get popoverOpen() {
      return popOpen
    },
    setOpen(next) {
      open = next
      applyOpen()
    },
    render(view) {
      root.hidden = !view.on
      if (!view.on) {
        popOpen = false
        applyPop()
        return
      }
      // Rebuild only on a change (the render is called on every result, but the DOM must not churn: a focused button stays focused).
      const key = JSON.stringify(view)
      if (key === shown) return
      shown = key
      status.textContent = view.message
      status.dataset.status = view.status
      const has = view.status === 'ready'
      ready.hidden = !has
      if (!has) return
      legend.replaceChildren(...view.legend.map(row))
      hatched.replaceChildren(swatch(doc, COVERAGE_PALETTE[0], true), el(doc, 'span', 'cr-cov-bin-label', L.hatched))
      if (view.hatchedCount !== null) hatched.append(el(doc, 'span', 'cr-cov-count', L.hatchedCount!.replace('{n}', String(view.hatchedCount))))
      source.textContent = view.sourceLine ?? ''
      source.hidden = view.sourceLine === null
      speakers.replaceChildren(...view.speakers.map((t) => el(doc, 'li', undefined, t)))
      stats.replaceChildren(
        ...(view.stats ?? []).flatMap((s) => {
          const dt = el(doc, 'dt', undefined, s.label)
          const dd = el(doc, 'dd', undefined, s.value)
          dd.dataset.stat = s.key
          return [dt, dd]
        })
      )
      points.replaceChildren(
        ...view.points.map((p) => {
          const li = el(doc, 'li', 'cr-cov-point')
          li.dataset.point = p.id
          li.append(el(doc, 'span', 'cr-cov-point-text', p.text))
          if (p.pinnable) {
            const b = el(doc, 'button', 'cr-cov-btn', L.pin!.replace('{name}', p.name))
            b.type = 'button'
            b.dataset.point = p.id
            li.append(b)
          }
          return li
        })
      )
      pinned.textContent = view.pinned?.text ?? ''
      pinRow.hidden = view.pinned === null
      spl.hidden = !view.spl
    },
  }
}
