/**
 * Hand-drawn cables, the DOM (mission 3 B stage 2, spec docs/superpowers/specs/2026-11-15-hand-drawn-cables-design.md §1): the cable panel shown in Propriétés while a
 * cable is selected, and the drawing bar shown under the menu bar while a cable is traced (never over the 3D view). DOM only: every action is a callback; the
 * controller (cableRouteController.ts) owns the state and sends the intents through the history (the shell never mutates the graph).
 *
 * - The panel: what the cable joins (output end first, as the hover), its signal, its connectors, its drawn length (`cableLengthM`, the hover's figure), its shape,
 *   « Tracer le câble » and, with a route, « Remettre le tracé automatique » and « Points du tracé »: one focusable zone (the keyboard way to the handles of the
 *   3D view) where the arrows move the chosen point, Page préc. / Page suiv. change point and Suppr deletes it, with a button for each.
 * - The bar: the snap size, « Angles droits » (a switch), the live length, « Poser le point », « Retirer le dernier point », « Terminer », « Annuler ». It is a named
 *   region inserted right after the menu bar; `data-trace="on"` on the shell gives it its own grid row (creation.css).
 * - Re-renders keep the focus where it was (by `data-key`), so an arrow that redraws the panel never loses the zone.
 */
import './cablePanel.css'
import type { Registry } from '../../engine/CatalogLoader'
import type { XZ } from '../../scene/cableGravity'
import { DEFAULT_SNAP_M, SNAP_STEPS_M, toXZ, type SnapStepM } from '../../scene/cableRoute'
import type { DesignState } from '../../trials/trial'
import { COPY } from '../copy'
import { portInfoOf } from '../cableStyle'
import { cableKey } from '../sceneDiff'
import { connectorName, signalName } from './propertiesModel'

const C = (): Readonly<Record<string, string>> => COPY.cableRoute!
const fill = (s: string, vars: Record<string, string>): string => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k]! : m))

/** Metres with two decimals and the French comma; a negative coordinate gets the real minus sign; never « −0,00 ». */
export function formatMetres(v: number): string {
  const r = Math.round(v * 100) / 100
  const abs = Math.abs(r).toFixed(2).replace('.', ',')
  return r < 0 ? `−${abs}` : abs
}

export const STEP_LABEL = (step: SnapStepM): string =>
  ({ 0.1: C().step10!, 0.25: C().step25!, 0.5: C().step50!, 1: C().step100! })[step]

export interface CablePanelView {
  key: string
  /** « Yamaha QL1 (ql1) · out-main-l → QSC K12.2 (k12-g) · in-line-a » (output end first). */
  joins: string
  signal: string
  /** « XLR3 mâle → XLR3 femelle ». */
  connectors: string
  /** The drawn length (m), null when the cable is not drawn. */
  lengthM: number | null
  /** The stored route ([] = automatic). */
  route: XZ[]
  /** The chosen point of the route (handles), or null. */
  selectedPoint: number | null
  /** « Tracer le câble » can start now (not while tracing, not where the 3D view is locked). */
  canTrace: boolean
  /** The snap size the edits use (the drawing bar's last choice). */
  step: SnapStepM
}

export interface CablePanelViewOpts {
  lengthM: number | null
  selectedPoint: number | null
  /** « Yamaha QL1 (ql1) » (with « non vérifié » for a Bêta device). */
  deviceName(instanceId: string): string
  canTrace?: boolean
  step?: SnapStepM
}

/** The panel's facts for a cable of the design, or null when the key is no cable. */
export function cablePanelView(design: DesignState, registry: Registry, key: string, o: CablePanelViewOpts): CablePanelView | null {
  const c = design.rig.connections.find((k) => cableKey(k.a, k.b) === key)
  if (!c) return null
  const portOf = portInfoOf(registry, design.rig.instances)
  const [from, to] = portOf(c.a)?.dir !== 'out' && portOf(c.b)?.dir === 'out' ? [c.b, c.a] : [c.a, c.b]
  const deviceOf = (instance: string): string => design.rig.instances.find((i) => i.instanceId === instance)?.deviceId ?? ''
  const port = (r: { instance: string; port: string }) => registry.deviceById.get(deviceOf(r.instance))?.ports.find((p) => p.portId === r.port)
  const pf = port(from)
  const pt = port(to)
  const signal = pf?.signal ?? pt?.signal ?? ''
  const route = design.routes?.[key]?.length ? toXZ(design.routes[key]!) : []
  const sel = o.selectedPoint
  return {
    key,
    joins: `${o.deviceName(from.instance)} · ${from.port} → ${o.deviceName(to.instance)} · ${to.port}`,
    signal: signal ? signalName(registry, signal) : '',
    connectors: `${pf ? connectorName(registry, pf.connector) : '?'} → ${pt ? connectorName(registry, pt.connector) : '?'}`,
    lengthM: o.lengthM,
    route,
    selectedPoint: sel !== null && Number.isInteger(sel) && sel >= 0 && sel < route.length ? sel : null,
    canTrace: o.canTrace ?? true,
    step: o.step ?? DEFAULT_SNAP_M,
  }
}

type Arrow = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
const ARROWS = new Set<string>(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

export interface CablePanelDeps {
  doc: Document
  container: HTMLElement
  onTrace(): void
  onReset(): void
  /** Page suiv. (+1) / Page préc. (−1), and the two buttons. */
  onSelectPoint(dir: 1 | -1): void
  /** An arrow in « Points du tracé » (the controller turns it into a grid step as seen from the camera); `big` = Maj. */
  onArrow(key: Arrow, big: boolean): void
  onDeletePoint(): void
  onStep(step: SnapStepM): void
}

export interface CablePanel {
  readonly element: HTMLElement
  render(view: CablePanelView | null): void
  /** Put focus on « Points du tracé » (false when the panel has none). */
  focusPoints(): boolean
  /** Put focus on « Tracer le câble » (false when absent or off). */
  focusTrace(): boolean
}

let seq = 0

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

function stepSelect(doc: Document, value: SnapStepM, key: string, onStep: (s: SnapStepM) => void): { row: HTMLElement; select: HTMLSelectElement } {
  const row = el(doc, 'div', 'cr-trace-field')
  const id = `cr-trace-${++seq}`
  const label = el(doc, 'label', 'cr-trace-label', C().snap)
  label.htmlFor = id
  const select = el(doc, 'select', 'cr-select cr-trace-select')
  select.id = id
  select.dataset.key = key
  for (const s of SNAP_STEPS_M) {
    const o = el(doc, 'option', undefined, STEP_LABEL(s))
    o.value = String(s)
    select.appendChild(o)
  }
  select.value = String(value)
  select.addEventListener('change', () => {
    const v = Number(select.value)
    if ((SNAP_STEPS_M as readonly number[]).includes(v)) onStep(v as SnapStepM)
  })
  row.append(label, select)
  return { row, select }
}

export function mountCablePanel(d: CablePanelDeps): CablePanel {
  const { doc } = d
  const root = el(doc, 'div', 'cr-props-content cr-cable-panel')
  root.dataset.testid = 'cable-panel'
  d.container.replaceChildren(root)

  const button = (text: string, key: string, onClick: () => void, cls = 'cr-cable-btn'): HTMLButtonElement => {
    const b = el(doc, 'button', cls, text)
    b.type = 'button'
    b.dataset.key = key
    b.addEventListener('click', onClick)
    return b
  }

  const build = (v: CablePanelView): void => {
    const head = el(doc, 'div', 'cr-props-head')
    const title = el(doc, 'h3', 'cr-props-title', C().panelTitle)
    title.tabIndex = -1
    head.appendChild(title)

    const facts = el(doc, 'dl', 'cr-cable-facts')
    const fact = (dt: string, dd: string, key: string): void => {
      const t = el(doc, 'dt', undefined, dt)
      const v2 = el(doc, 'dd', undefined, dd)
      v2.dataset.fact = key
      facts.append(t, v2)
    }
    fact(C().joins!, v.joins, 'joins')
    fact(C().signal!, v.signal, 'signal')
    fact(C().connectors!, v.connectors, 'connectors')
    fact(C().length!, v.lengthM === null ? C().lengthNone! : fill(C().lengthValue!, { m: formatMetres(v.lengthM) }), 'length')
    const n = v.route.length
    fact(C().shape!, n === 0 ? C().shapeAuto! : n === 1 ? C().shapeRouteOne! : fill(C().shapeRoute!, { n: String(n) }), 'shape')

    const actions = el(doc, 'div', 'cr-cable-actions')
    const hint = el(doc, 'p', 'cr-props-hint', C().traceHint)
    hint.id = `cr-trace-${++seq}`
    const trace = button(C().trace!, 'trace', () => d.onTrace(), 'cr-cable-btn cr-cable-btn-primary')
    trace.dataset.testid = 'cable-trace'
    trace.disabled = !v.canTrace
    trace.setAttribute('aria-describedby', hint.id)
    actions.append(trace)
    if (n > 0) {
      const reset = button(C().reset!, 'reset', () => d.onReset())
      reset.dataset.testid = 'cable-reset'
      reset.disabled = !v.canTrace
      actions.append(reset)
    }
    actions.append(hint)
    const parts: HTMLElement[] = [head, facts, actions]

    if (n > 0) {
      const sec = el(doc, 'section', 'cr-cable-points')
      const h = el(doc, 'h4', 'cr-props-legend', C().points)
      h.id = `cr-trace-${++seq}`
      sec.setAttribute('aria-labelledby', h.id)
      const help = el(doc, 'p', 'cr-props-hint', C().pointsHint)
      help.id = `cr-trace-${++seq}`
      const zone = el(doc, 'div', 'cr-cable-point-zone')
      zone.tabIndex = 0
      zone.dataset.key = 'points'
      zone.dataset.testid = 'cable-points'
      // A widget of its own that takes the arrows (as the 3D view does): « application » so a screen reader passes them through.
      zone.setAttribute('role', 'application')
      zone.setAttribute('aria-label', C().pointGroup!)
      zone.setAttribute('aria-describedby', help.id)
      const sel = v.selectedPoint
      zone.textContent =
        sel === null ? C().pointNone! : fill(C().pointNow!, { i: String(sel + 1), n: String(n), x: formatMetres(v.route[sel]!.x), z: formatMetres(v.route[sel]!.z) })
      zone.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.altKey || e.metaKey) return
        if (ARROWS.has(e.key)) d.onArrow(e.key as Arrow, e.shiftKey)
        else if (e.key === 'PageDown') d.onSelectPoint(1)
        else if (e.key === 'PageUp') d.onSelectPoint(-1)
        else if (e.key === 'Delete') d.onDeletePoint()
        else return
        e.preventDefault()
        e.stopPropagation() // the 3D view's keys never see them
      })
      const row = el(doc, 'div', 'cr-cable-point-btns')
      row.append(button(C().prevPoint!, 'prev', () => d.onSelectPoint(-1)), button(C().nextPoint!, 'next', () => d.onSelectPoint(1)))
      const del = button(C().deletePoint!, 'delete', () => d.onDeletePoint())
      del.disabled = sel === null
      row.append(del)
      const step = stepSelect(doc, v.step, 'step', (s) => d.onStep(s))
      sec.append(h, help, zone, row, step.row)
      parts.push(sec)
    }
    root.replaceChildren(...parts)
  }

  return {
    element: root,
    render(v) {
      const active = doc.activeElement
      const focusKey = active instanceof HTMLElement && root.contains(active) ? active.dataset.key : undefined
      if (!v) {
        root.replaceChildren()
        return
      }
      build(v)
      if (focusKey) {
        const target = root.querySelector<HTMLElement>(`[data-key="${focusKey}"]`)
        if (target && !(target as HTMLButtonElement).disabled) target.focus()
        else root.querySelector<HTMLElement>('.cr-props-title')?.focus()
      }
    },
    focusPoints() {
      const z = root.querySelector<HTMLElement>('[data-key="points"]')
      z?.focus()
      return !!z && doc.activeElement === z
    },
    focusTrace() {
      const b = root.querySelector<HTMLButtonElement>('[data-key="trace"]')
      if (!b || b.disabled) return false
      b.focus()
      return doc.activeElement === b
    },
  }
}

// ── the drawing bar ─────────────────────────────────────────────────────────

export interface DrawingBarView {
  /** The cable as the hover names it. */
  cable: string
  step: SnapStepM
  rightAngles: boolean
  /** Port A → the placed points → port B, as it will be drawn (m). */
  lengthM: number
  canFinish: boolean
  canRemove: boolean
}

export interface DrawingBarDeps {
  doc: Document
  /** The shell root (`.cr`): it gets `data-trace="on"` while the bar shows. */
  root: HTMLElement
  /** The bar goes right after this element (the menu bar). */
  after: HTMLElement
  onStep(step: SnapStepM): void
  onRightAngles(on: boolean): void
  onPlace(): void
  onRemoveLast(): void
  onFinish(): void
  onCancel(): void
}

export interface DrawingBar {
  readonly element: HTMLElement
  readonly visible: boolean
  show(view: DrawingBarView): void
  update(view: DrawingBarView): void
  hide(): void
}

export function mountDrawingBar(d: DrawingBarDeps): DrawingBar {
  const { doc } = d
  const bar = el(doc, 'section', 'cr-trace-bar')
  bar.setAttribute('role', 'region')
  bar.setAttribute('aria-label', C().bar!)
  bar.dataset.testid = 'trace-bar'
  const hint = el(doc, 'p', 'cr-sr-only', C().barHint)
  hint.id = `cr-trace-${++seq}`
  bar.setAttribute('aria-describedby', hint.id)
  const title = el(doc, 'span', 'cr-trace-title')
  let rightAngles = false
  const step = stepSelect(doc, DEFAULT_SNAP_M, 'bar-step', (s) => d.onStep(s))
  const sw = el(doc, 'button', 'cr-trace-switch', C().rightAngles)
  sw.type = 'button'
  sw.setAttribute('role', 'switch')
  sw.setAttribute('aria-checked', 'false')
  sw.dataset.testid = 'trace-right-angles'
  sw.addEventListener('click', () => d.onRightAngles(!rightAngles))
  const length = el(doc, 'span', 'cr-trace-length')
  length.dataset.testid = 'trace-length'
  const btn = (text: string, testid: string, onClick: () => void, cls = 'cr-trace-btn', keys?: string): HTMLButtonElement => {
    const b = el(doc, 'button', cls, text)
    b.type = 'button'
    b.dataset.testid = testid
    if (keys) b.title = keys
    b.addEventListener('click', onClick)
    return b
  }
  const K = COPY.keys!
  const place = btn(C().place!, 'trace-place', () => d.onPlace(), 'cr-trace-btn', K.enter)
  const remove = btn(C().removeLast!, 'trace-remove', () => d.onRemoveLast(), 'cr-trace-btn', K.backspace)
  const finish = btn(C().finish!, 'trace-finish', () => d.onFinish(), 'cr-trace-btn cr-trace-btn-primary', `${K.shift}+${K.enter}`)
  const cancel = btn(C().cancel!, 'trace-cancel', () => d.onCancel(), 'cr-trace-btn', K.escape)
  const group = (...kids: HTMLElement[]): HTMLElement => {
    const g = el(doc, 'div', 'cr-trace-group')
    g.append(...kids)
    return g
  }
  bar.append(hint, title, group(step.row, sw, length), group(place, remove, finish, cancel))

  const update = (v: DrawingBarView): void => {
    title.textContent = fill(C().barTitle!, { cable: v.cable })
    title.title = title.textContent
    if (step.select.value !== String(v.step)) step.select.value = String(v.step)
    rightAngles = v.rightAngles
    sw.setAttribute('aria-checked', String(v.rightAngles))
    length.textContent = fill(C().lengthLive!, { m: formatMetres(v.lengthM) })
    finish.disabled = !v.canFinish
    remove.disabled = !v.canRemove
  }
  let visible = false
  return {
    element: bar,
    get visible() {
      return visible
    },
    show(v) {
      update(v)
      if (!bar.isConnected) d.after.after(bar)
      d.root.dataset.trace = 'on'
      visible = true
    },
    update,
    hide() {
      bar.remove()
      delete d.root.dataset.trace
      visible = false
    },
  }
}
