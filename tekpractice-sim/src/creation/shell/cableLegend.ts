/**
 * Cable legend (Task 27, C18): a collapsible block at the bottom of the « Propriétés » panel (never over the 3D view)
 * listing ONLY the signal types that have a cable on the scene, each with a stroke sample (solid or dashed, in the
 * cable's colour) and its French name. Colour is never the only cue: the dashed signal also says « pointillés ».
 *
 * DOM only, no scene, no timer, no render request. Fed by the shell with plain data (`LegendEntry`: id, label, colour,
 * dash) computed in `src/creation/cableStyle.ts`; it never reads the rig (C6: the shell dispatches intents only).
 * Hidden entirely while no cable is on the scene. The toggle is a real button: named, `aria-expanded`, a visible
 * focus ring (the shell's 2 px Ambre + 1 px Nuit, in the CSS), no transition.
 */
import type { LegendEntry } from '../cableStyle'
import type { DisposableBag } from '../../util/disposable'
import { COPY } from '../copy'

export interface CableLegend {
  readonly element: HTMLElement
  readonly toggle: HTMLButtonElement
  /** Show these entries (in the order given); an empty list hides the block. Rebuilds only on a change. */
  set(entries: readonly LegendEntry[]): void
  /** The list is unfolded. */
  readonly open: boolean
  setOpen(open: boolean): void
}

const SVG = 'http://www.w3.org/2000/svg'
const L = (): Readonly<Record<string, string>> => COPY.cables!

/** A chevron: points down when the list is open (folding it up). Rotated by CSS. */
function chevron(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 12 12')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  svg.setAttribute('class', 'cr-legend-chevron')
  const p = doc.createElementNS(SVG, 'path')
  p.setAttribute('d', 'M2.5 4.5 6 8l3.5-3.5')
  p.setAttribute('fill', 'none')
  p.setAttribute('stroke', 'currentColor')
  p.setAttribute('stroke-width', '1.5')
  p.setAttribute('stroke-linecap', 'square')
  svg.appendChild(p)
  return svg
}

/** The stroke sample: a line in the cable's colour, dashed like the cable when it is. */
function swatch(doc: Document, e: LegendEntry): SVGSVGElement {
  const svg = doc.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 36 8')
  svg.setAttribute('class', 'cr-legend-swatch')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const line = doc.createElementNS(SVG, 'line')
  line.setAttribute('x1', '1')
  line.setAttribute('x2', '35')
  line.setAttribute('y1', '4')
  line.setAttribute('y2', '4')
  line.setAttribute('stroke', e.color)
  line.setAttribute('stroke-width', '3')
  line.setAttribute('stroke-linecap', 'butt')
  if (e.dash) line.setAttribute('stroke-dasharray', '6 4')
  svg.appendChild(line)
  return svg
}

let seq = 0

export function mountCableLegend(doc: Document, container: HTMLElement, bag: DisposableBag): CableLegend {
  const id = `cr-legend-${++seq}`
  const root = doc.createElement('section')
  root.className = 'cr-legend'
  root.dataset.testid = 'cable-legend'
  root.setAttribute('aria-label', L().legendTitle!)
  root.hidden = true

  const toggle = doc.createElement('button')
  toggle.type = 'button'
  toggle.className = 'cr-legend-toggle'
  toggle.dataset.testid = 'cable-legend-toggle'
  toggle.setAttribute('aria-controls', `${id}-list`)
  const title = doc.createElement('span')
  title.className = 'cr-legend-title'
  title.textContent = L().legendTitle!
  toggle.append(title, chevron(doc))

  const list = doc.createElement('ul')
  list.id = `${id}-list`
  list.className = 'cr-legend-list'
  list.dataset.testid = 'cable-legend-list'

  root.append(toggle, list)
  container.appendChild(root)
  bag.add(() => root.remove())

  let open = true
  let shown = ''
  const apply = (): void => {
    list.hidden = !open
    toggle.setAttribute('aria-expanded', String(open))
    const name = open ? L().legendCollapse! : L().legendExpand!
    toggle.setAttribute('aria-label', name)
    toggle.title = name
    root.dataset.open = String(open)
  }
  apply()
  bag.listen(toggle, 'click', () => {
    open = !open
    apply()
  })

  return {
    element: root,
    toggle,
    get open() {
      return open
    },
    setOpen(next) {
      open = next
      apply()
    },
    set(entries) {
      const key = entries.map((e) => `${e.id}|${e.color}|${e.dash}|${e.label}`).join('\n')
      if (key === shown) return
      shown = key
      list.replaceChildren(
        ...entries.map((e) => {
          const li = doc.createElement('li')
          li.className = 'cr-legend-item'
          li.dataset.signal = e.id
          const name = doc.createElement('span')
          name.className = 'cr-legend-name'
          name.textContent = e.label
          li.append(swatch(doc, e), name)
          if (e.dash) {
            const note = doc.createElement('span')
            note.className = 'cr-legend-note'
            note.textContent = L().dashed!
            li.append(note)
          }
          return li
        })
      )
      root.hidden = entries.length === 0
    },
  }
}
