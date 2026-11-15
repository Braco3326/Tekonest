// @vitest-environment jsdom
/**
 * Mission 3 B stage 2: the cable panel in Propriétés and the drawing bar under the menu bar (spec docs/superpowers/specs/2026-11-15-hand-drawn-cables-design.md §1).
 * DOM only: every action is a callback (the controller dispatches); labels and accessible names in French from COPY.cableRoute.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { COPY } from '../../src/creation/copy'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { cableKey } from '../../src/creation/sceneDiff'
import type { DesignState } from '../../src/trials/trial'
import { cablePanelView, formatMetres, mountCablePanel, mountDrawingBar, type CablePanelView } from '../../src/creation/shell/cablePanel'

const registry = loadCatalog(catalogJson)
const C = COPY.cableRoute!
const QL_OUT = { instance: 'ql1', port: 'out-main-l' }
const K12_IN = { instance: 'k12-g', port: 'in-line-a' }
const KEY = cableKey(QL_OUT, K12_IN)
const design = (routes?: Record<string, [number, number][]>): DesignState =>
  ({
    roomId: 'room:concert-hall-medium',
    rig: {
      instances: [
        { instanceId: 'ql1', deviceId: 'yamaha-ql1' },
        { instanceId: 'k12-g', deviceId: 'qsc-k12-2' },
      ],
      // stored input first: the panel still reads the output end first
      connections: [{ a: K12_IN, b: QL_OUT }],
      controls: {},
    },
    placements: [],
    ...(routes ? { routes } : {}),
  }) as unknown as DesignState
const name = (id: string): string => (id === 'ql1' ? 'Yamaha QL1 (ql1)' : 'QSC K12.2 (k12-g)')

describe('cablePanelView', () => {
  it('says what the cable joins (output end first), its signal, its connectors and its drawn length', () => {
    const v = cablePanelView(design(), registry, KEY, { lengthM: 6.4321, selectedPoint: null, deviceName: name })!
    expect(v.key).toBe(KEY)
    expect(v.joins).toBe('Yamaha QL1 (ql1) · out-main-l → QSC K12.2 (k12-g) · in-line-a')
    expect(v.signal).toBe(COPY.signal?.['line-level-pro'] ?? 'line-level-pro')
    expect(v.connectors).toContain('→')
    expect(v.lengthM).toBeCloseTo(6.4321)
    expect(v.route).toEqual([])
  })
  it('reads the route and the chosen point; null for a key that is no cable', () => {
    const v = cablePanelView(design({ [KEY]: [[0, 0], [1.25, -0.5]] }), registry, KEY, { lengthM: null, selectedPoint: 1, deviceName: name })!
    expect(v.route).toEqual([{ x: 0, z: 0 }, { x: 1.25, z: -0.5 }])
    expect(v.selectedPoint).toBe(1)
    expect(cablePanelView(design(), registry, 'nope', { lengthM: null, selectedPoint: null, deviceName: name })).toBeNull()
  })
  it('a chosen point past the route is dropped', () => {
    const v = cablePanelView(design({ [KEY]: [[0, 0]] }), registry, KEY, { lengthM: null, selectedPoint: 4, deviceName: name })!
    expect(v.selectedPoint).toBeNull()
  })
})

describe('formatMetres', () => {
  it('two decimals, the French comma, never « -0,00 », a real minus sign', () => {
    expect(formatMetres(6.4321)).toBe('6,43')
    expect(formatMetres(-0.001)).toBe('0,00')
    expect(formatMetres(-0.5)).toBe('−0,50')
  })
})

const base = (o: Partial<CablePanelView> = {}): CablePanelView => ({
  key: KEY,
  joins: 'Yamaha QL1 (ql1) · out-main-l → QSC K12.2 (k12-g) · in-line-a',
  signal: 'Niveau ligne pro',
  connectors: 'XLR3 mâle → XLR3 femelle',
  lengthM: 4.25,
  route: [],
  selectedPoint: null,
  canTrace: true,
  step: 0.25,
  ...o,
})

describe('the cable panel', () => {
  let container: HTMLElement
  const cb = () => ({ onTrace: vi.fn(), onReset: vi.fn(), onSelectPoint: vi.fn(), onArrow: vi.fn(), onDeletePoint: vi.fn(), onStep: vi.fn() })
  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
  })
  it('shows the title, the facts and « Tracer le câble »; no reset and no points without a route', () => {
    const f = cb()
    const p = mountCablePanel({ doc: document, container, ...f })
    p.render(base())
    expect(container.querySelector('h3')!.textContent).toBe(C.panelTitle)
    const text = container.textContent!
    for (const s of [C.joins, C.signal, C.connectors, C.length, C.shape, 'Niveau ligne pro', 'XLR3 mâle → XLR3 femelle', C.lengthValue!.replace('{m}', '4,25'), C.shapeAuto]) expect(text).toContain(s)
    const trace = [...container.querySelectorAll('button')].find((b) => b.textContent === C.trace)!
    expect(trace).toBeDefined()
    trace.click()
    expect(f.onTrace).toHaveBeenCalledTimes(1)
    expect([...container.querySelectorAll('button')].some((b) => b.textContent === C.reset)).toBe(false)
    expect(container.querySelector('[data-testid="cable-points"]')).toBeNull()
    // the button is described by its hint
    const hint = document.getElementById(trace.getAttribute('aria-describedby')!)
    expect(hint?.textContent).toBe(C.traceHint)
  })
  it('a cable not drawn yet says so', () => {
    const p = mountCablePanel({ doc: document, container, ...cb() })
    p.render(base({ lengthM: null }))
    expect(container.textContent).toContain(C.lengthNone)
  })
  it('« Tracer le câble » is off while tracing or where the 3D view is locked', () => {
    const p = mountCablePanel({ doc: document, container, ...cb() })
    p.render(base({ canTrace: false }))
    const trace = [...container.querySelectorAll('button')].find((b) => b.textContent === C.trace)!
    expect(trace.disabled).toBe(true)
  })
  it('with a route: « Remettre le tracé automatique », the shape in words and the points with keyboard access', () => {
    const f = cb()
    const p = mountCablePanel({ doc: document, container, ...f })
    p.render(base({ route: [{ x: 0, z: 0 }, { x: 1.25, z: -0.5 }, { x: 2, z: 1 }], selectedPoint: 1 }))
    expect(container.textContent).toContain(C.shapeRoute!.replace('{n}', '3'))
    const reset = [...container.querySelectorAll('button')].find((b) => b.textContent === C.reset)!
    reset.click()
    expect(f.onReset).toHaveBeenCalledTimes(1)
    const group = container.querySelector<HTMLElement>('[data-testid="cable-points"]')!
    expect(group.tabIndex).toBe(0)
    expect(group.getAttribute('aria-label')).toBe(C.pointGroup)
    expect(document.getElementById(group.getAttribute('aria-describedby')!)?.textContent).toBe(C.pointsHint)
    expect(group.textContent).toBe('Point 2 sur 3 : x 1,25 m, z −0,50 m')
    const key = (k: string, shift = false): KeyboardEvent => {
      const e = new KeyboardEvent('keydown', { key: k, code: k, shiftKey: shift, bubbles: true, cancelable: true })
      group.dispatchEvent(e)
      return e
    }
    expect(key('ArrowRight').defaultPrevented).toBe(true)
    expect(f.onArrow).toHaveBeenLastCalledWith('ArrowRight', false)
    key('ArrowUp', true)
    expect(f.onArrow).toHaveBeenLastCalledWith('ArrowUp', true)
    key('PageDown')
    expect(f.onSelectPoint).toHaveBeenLastCalledWith(1)
    key('PageUp')
    expect(f.onSelectPoint).toHaveBeenLastCalledWith(-1)
    expect(key('Delete').defaultPrevented).toBe(true)
    expect(f.onDeletePoint).toHaveBeenCalledTimes(1)
    expect(key('Tab').defaultPrevented).toBe(false) // the focus key is never taken
    const btn = (t: string) => [...container.querySelectorAll('button')].find((b) => b.textContent === t)!
    btn(C.nextPoint!).click()
    expect(f.onSelectPoint).toHaveBeenLastCalledWith(1)
    btn(C.prevPoint!).click()
    expect(f.onSelectPoint).toHaveBeenLastCalledWith(-1)
    btn(C.deletePoint!).click()
    expect(f.onDeletePoint).toHaveBeenCalledTimes(2)
    const step = container.querySelector<HTMLSelectElement>('select')!
    expect(document.querySelector(`label[for="${step.id}"]`)?.textContent).toBe(C.snap)
    expect([...step.options].map((o) => o.textContent)).toEqual([C.step10, C.step25, C.step50, C.step100])
    expect(step.value).toBe('0.25')
    step.value = '0.5'
    step.dispatchEvent(new Event('change'))
    expect(f.onStep).toHaveBeenLastCalledWith(0.5)
  })
  it('no point chosen: the group says so and « Supprimer le point » is off', () => {
    const p = mountCablePanel({ doc: document, container, ...cb() })
    p.render(base({ route: [{ x: 0, z: 0 }], selectedPoint: null }))
    expect(container.querySelector('[data-testid="cable-points"]')!.textContent).toBe(C.pointNone)
    expect([...container.querySelectorAll('button')].find((b) => b.textContent === C.deletePoint)!.disabled).toBe(true)
    expect(container.textContent).toContain(C.shapeRouteOne)
  })
  it('keeps the focus on the points group across a re-render (an arrow redraws the panel)', () => {
    const p = mountCablePanel({ doc: document, container, ...cb() })
    p.render(base({ route: [{ x: 0, z: 0 }, { x: 1, z: 0 }], selectedPoint: 0 }))
    container.querySelector<HTMLElement>('[data-testid="cable-points"]')!.focus()
    p.render(base({ route: [{ x: 0.25, z: 0 }, { x: 1, z: 0 }], selectedPoint: 0 }))
    expect(document.activeElement?.getAttribute('data-testid')).toBe('cable-points')
    expect(document.activeElement!.textContent).toBe('Point 1 sur 2 : x 0,25 m, z 0,00 m')
    expect(p.focusPoints()).toBe(true)
  })
  it('render(null) empties it', () => {
    const p = mountCablePanel({ doc: document, container, ...cb() })
    p.render(base())
    p.render(null)
    expect(container.textContent).toBe('')
  })
})

describe('the drawing bar', () => {
  let root: HTMLElement
  let menubar: HTMLElement
  const cb = () => ({ onStep: vi.fn(), onRightAngles: vi.fn(), onPlace: vi.fn(), onRemoveLast: vi.fn(), onFinish: vi.fn(), onCancel: vi.fn() })
  beforeEach(() => {
    document.body.innerHTML = ''
    root = document.createElement('div')
    menubar = document.createElement('header')
    root.append(menubar, document.createElement('main'))
    document.body.appendChild(root)
  })
  const view = { cable: 'ql1 out-main-l → k12-g in-line-a', step: 0.25 as const, rightAngles: false, lengthM: 4.25, canFinish: false, canRemove: false }
  it('appears right under the menu bar as a named region (a landmark: no arrow-key promise of a toolbar), and marks the shell so the grid gives it a row', () => {
    const bar = mountDrawingBar({ doc: document, root, after: menubar, ...cb() })
    expect(bar.visible).toBe(false)
    bar.show(view)
    expect(bar.visible).toBe(true)
    expect(menubar.nextElementSibling).toBe(bar.element)
    expect(bar.element.getAttribute('role')).toBe('region')
    expect(bar.element.getAttribute('aria-label')).toBe(C.bar)
    expect(root.dataset.trace).toBe('on')
    expect(bar.element.textContent).toContain(C.barTitle!.replace('{cable}', view.cable))
    expect(bar.element.textContent).toContain(C.lengthLive!.replace('{m}', '4,25'))
    bar.hide()
    expect(bar.visible).toBe(false)
    expect(root.dataset.trace).toBeUndefined()
    expect(bar.element.isConnected).toBe(false)
  })
  it('has the snap selector, the « Angles droits » switch and the four buttons, each named, each calling back', () => {
    const f = cb()
    const bar = mountDrawingBar({ doc: document, root, after: menubar, ...f })
    bar.show({ ...view, canFinish: true, canRemove: true })
    const el = bar.element
    const step = el.querySelector('select')!
    expect(el.querySelector(`label[for="${step.id}"]`)?.textContent).toBe(C.snap)
    expect([...step.options].map((o) => [o.value, o.textContent])).toEqual([['0.1', C.step10], ['0.25', C.step25], ['0.5', C.step50], ['1', C.step100]])
    step.value = '1'
    step.dispatchEvent(new Event('change'))
    expect(f.onStep).toHaveBeenLastCalledWith(1)
    const sw = el.querySelector<HTMLButtonElement>('[role="switch"]')!
    expect(sw.textContent).toBe(C.rightAngles)
    expect(sw.getAttribute('aria-checked')).toBe('false')
    sw.click()
    expect(f.onRightAngles).toHaveBeenLastCalledWith(true)
    const btn = (t: string) => [...el.querySelectorAll('button')].find((b) => b.textContent === t)!
    for (const [t, fn] of [[C.place, f.onPlace], [C.removeLast, f.onRemoveLast], [C.finish, f.onFinish], [C.cancel, f.onCancel]] as const) {
      btn(t!).click()
      expect(fn, t).toHaveBeenCalledTimes(1)
    }
    expect(document.getElementById(el.getAttribute('aria-describedby')!)?.textContent).toBe(C.barHint)
  })
  it('update() keeps the same element (focus stays), and « Terminer » / « Retirer » are off until a point is placed', () => {
    const bar = mountDrawingBar({ doc: document, root, after: menubar, ...cb() })
    bar.show(view)
    const el = bar.element
    const btn = (t: string) => [...el.querySelectorAll('button')].find((b) => b.textContent === t)!
    expect(btn(C.finish!).disabled).toBe(true)
    expect(btn(C.removeLast!).disabled).toBe(true)
    btn(C.cancel!).focus()
    bar.update({ ...view, canFinish: true, canRemove: true, rightAngles: true, step: 0.5, lengthM: 7 })
    expect(bar.element).toBe(el)
    expect(document.activeElement).toBe(btn(C.cancel!))
    expect(btn(C.finish!).disabled).toBe(false)
    expect(el.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('true')
    expect(el.querySelector('select')!.value).toBe('0.5')
    expect(el.textContent).toContain(C.lengthLive!.replace('{m}', '7,00'))
  })
})

describe('the new words', () => {
  it('every string of the section is French « vous » copy: no first person, no placeholder, no English UI word', () => {
    for (const [k, t] of Object.entries(C)) {
      expect(t, k).not.toMatch(/\b(je|j’|me|moi|mon|ma|mes|nous|notre|nos)\b/i)
      expect(t, k).not.toMatch(/\[À REMPLACER|TODO|\bclick\b|\bfinish\b/i)
    }
  })
})
