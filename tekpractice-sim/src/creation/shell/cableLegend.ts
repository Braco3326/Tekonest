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

/** The dash pattern of a dashed signal's stroke sample (SVG user units, the swatch is 36 wide). */
export const DASH_PATTERN = '6 4'

/** What one legend row shows: the data the DOM is built from (pure, unit tested: the repo's unit tests have no DOM). */
export interface LegendRow {
  id: string
  label: string
  /** The stroke sample's colour. */
  color: string
  /** `stroke-dasharray` of the sample; null = a solid stroke. */
  dasharray: string | null
  /** The text note next to a dashed sample (« pointillés »), so the stroke is not the only cue; null otherwise. */
  note: string | null
}

export function legendRows(entries: readonly LegendEntry[]): LegendRow[] {
  return entries.map((e) => ({ id: e.id, label: e.label, color: e.color, dasharray: e.dash ? DASH_PATTERN : null, note: e.dash ? L().dashed! : null }))
}

/** The toggle's state for the list being open or folded: `aria-expanded`, the accessible name, the list's `hidden`. */
export function toggleState(open: boolean): { expanded: 'true' | 'false'; name: string; listHidden: boolean } {
  return { expanded: open ? 'true' : 'false', name: open ? L().legendCollapse! : L().legendExpand!, listHidden: !open }
}

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
function swatch(doc: Document, e: LegendRow): SVGSVGElement {
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
  if (e.dasharray) line.setAttribute('stroke-dasharray', e.dasharray)
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
    const st = toggleState(open)
    list.hidden = st.listHidden
    toggle.setAttribute('aria-expanded', st.expanded)
    toggle.setAttribute('aria-label', st.name)
    toggle.title = st.name
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
      const rows = legendRows(entries)
      const key = rows.map((r) => `${r.id}|${r.color}|${r.dasharray}|${r.label}`).join('\n')
      if (key === shown) return
      shown = key
      list.replaceChildren(
        ...rows.map((e) => {
          const li = doc.createElement('li')
          li.className = 'cr-legend-item'
          li.dataset.signal = e.id
          const name = doc.createElement('span')
          name.className = 'cr-legend-name'
          name.textContent = e.label
          li.append(swatch(doc, e), name)
          if (e.note) {
            const note = doc.createElement('span')
            note.className = 'cr-legend-note'
            note.textContent = e.note
            li.append(note)
          }
          return li
        })
      )
      root.hidden = entries.length === 0
    },
  }
}
