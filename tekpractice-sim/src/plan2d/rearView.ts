/**
 * The rear panel view of the 2D schema page (mission 2, spec §1.3): the device « flips » and its real ports show as buttons (catalogue order, connector
 * glyph, gender, French names, direction). With a cable held, the ports that may take its other end are LIT and the others DIMMED with the rule's
 * reason (patchRules.ts: the existing connection rules); with no cable held, a free port starts a cable and a taken one says how to free it.
 *
 * `rearModel` is pure (unit tested); `mountRear` draws it. The flip is a short CSS animation from the device's place on the plan; with reduced
 * motion it is a cut (no animation at all). Every port is a real <button>: keyboard, touch and screen readers get the same path as the mouse.
 */
import type { Registry } from '../engine/CatalogLoader'
import { COPY } from '../creation/copy'
import { cableAt, type Plan2D, type PortEnd } from './model'
import type { PatchRules } from './patchRules'
import { rearLayout, type ConnectorGlyph, type RearPort } from './rearPanel'

const P = (): Readonly<Record<string, string>> => COPY.plan2d!
const fill = (s: string, vars: Record<string, string>): string => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)

export type PortState = 'pick' | 'taken' | 'lit' | 'dim'
export interface RearPortView {
  port: RearPort
  state: PortState
  /** The visible and accessible text: « id · connecteur · signal ». */
  text: string
  dirText: string
  /** Why a dimmed or taken port cannot be used (the rule's title), and its teaching line. */
  reason?: string
  detail?: string
}
export interface RearModel {
  dev: string
  title: string
  note: string
  line: string
  holding: boolean
  ports: RearPortView[]
  litCount: number
}

export function rearModel(registry: Registry, plan: Plan2D, dev: string, held: PortEnd | null, rules: PatchRules, portName: (e: PortEnd) => string): RearModel | null {
  const d = plan.devices.find((x) => x.id === dev)
  const layout = d && rearLayout(registry, d.deviceId)
  if (!d || !layout) return null
  const dirText = (dir: string): string => (dir === 'in' ? P().dirIn! : dir === 'out' ? P().dirOut! : P().dirBidir!)
  const verdicts = held ? new Map(rules.portVerdicts(plan, held, dev).map((v) => [v.port, v.verdict])) : null
  const ports = layout.ports.map((port): RearPortView => {
    const base = { port, text: `${port.portId} · ${port.connectorLabel} · ${port.signalLabel}`, dirText: dirText(port.dir) }
    if (!verdicts) return cableAt(plan, { dev, port: port.portId }) ? { ...base, state: 'taken', reason: P().portTaken! } : { ...base, state: 'pick' }
    const v = verdicts.get(port.portId)
    if (v?.ok) return { ...base, state: 'lit' }
    return { ...base, state: 'dim', reason: v && !v.ok ? v.title : '', detail: v && !v.ok ? v.detail : '' }
  })
  return {
    dev,
    title: fill(P().rearTitle!, { device: `${layout.label} (${dev})` }),
    note: P().rearNote!,
    line: held ? fill(P().holding!, { port: portName(held) }) : P().pickStart!,
    holding: held !== null,
    ports,
    litCount: ports.filter((p) => p.state === 'lit').length,
  }
}

const SVG = 'http://www.w3.org/2000/svg'

/** Pin drawing: the sheet's rule (male filled = output, female open = input); a genderless connector follows the port's direction. */
const pinFilled = (p: RearPort): boolean => (p.gender === 'male' ? true : p.gender === 'female' ? false : p.dir === 'out')

/** A small front-view glyph of the connector (24 x 24), decorative: the pin geometry is simplified (the sheet: UNVERIFIED pin positions). */
export function connectorGlyphMarkup(glyph: ConnectorGlyph, filled: boolean): string {
  const pin = (x: number, y: number, r = 1.6): string => `<circle cx="${x}" cy="${y}" r="${r}" class="${filled ? 'p2d-pin-m' : 'p2d-pin-f'}"/>`
  const body: Record<ConnectorGlyph, string> = {
    xlr: `<circle cx="12" cy="12" r="10"/>${pin(8, 9)}${pin(16, 9)}${pin(12, 16)}`,
    jack: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/>`,
    rca: `<circle cx="12" cy="12" r="8"/>${pin(12, 12, 2.2)}`,
    speakon: `<circle cx="12" cy="12" r="10"/><path d="M6 12h4M14 12h4M12 6v3M12 15v3"/>`,
    rj45: `<path d="M4 6h16v10h-4v3h-8v-3H4Z"/>${pin(8, 9, 1)}${pin(12, 9, 1)}${pin(16, 9, 1)}`,
    bnc: `<circle cx="12" cy="12" r="8"/>${pin(12, 12, 1.8)}<path d="M2 12h2M20 12h2"/>`,
    optical: `<path d="M5 5h14v14H5Z"/>${pin(12, 12, 2.5)}`,
    usb: `<path d="M5 8h14v8H5Z"/><path d="M8 11h8"/>`,
    din: `<circle cx="12" cy="12" r="10"/>${pin(6, 13)}${pin(8, 8)}${pin(12, 6)}${pin(16, 8)}${pin(18, 13)}`,
    iec: `<path d="M5 6h14v8l-4 4H9l-4-4Z"/>${pin(9, 11, 1.4)}${pin(15, 11, 1.4)}${pin(12, 15, 1.4)}`,
    schuko: `<circle cx="12" cy="12" r="10"/>${pin(8, 12, 2)}${pin(16, 12, 2)}<path d="M12 2v3M12 19v3"/>`,
    powercon: `<circle cx="12" cy="12" r="10"/><path d="M12 2v5"/>${pin(9, 14)}${pin(15, 14)}`,
    dsub: `<path d="M3 7h18l-2 10H5Z"/>${pin(7, 10, 1)}${pin(10, 10, 1)}${pin(13, 10, 1)}${pin(16, 10, 1)}${pin(8.5, 14, 1)}${pin(11.5, 14, 1)}${pin(14.5, 14, 1)}`,
    dc: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>${pin(12, 12, 1.2)}`,
    terminal: `<path d="M3 8h18v8H3Z"/>${pin(7, 12, 1.8)}${pin(12, 12, 1.8)}${pin(17, 12, 1.8)}`,
    multipin: `<circle cx="12" cy="12" r="10"/>${pin(9, 9, 1.2)}${pin(15, 9, 1.2)}${pin(9, 15, 1.2)}${pin(15, 15, 1.2)}${pin(12, 12, 1.2)}`,
  }
  return `<svg xmlns="${SVG}" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false" class="p2d-glyph p2d-glyph-${glyph}">${body[glyph]}</svg>`
}

export interface RearHandlers {
  onPort(portId: string): void
  onBack(): void
  onDrop(): void
}

/**
 * Draws the model into `host` (replacing what was there) and returns the first control to focus. `from` = the device's centre on screen (px, inside
 * `host`): the flip starts there; `reduced` = no animation.
 */
export function mountRear(doc: Document, host: HTMLElement, m: RearModel, h: RearHandlers, opts: { from?: { x: number; y: number }; reduced: boolean }): HTMLElement {
  host.replaceChildren()
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
    const e = doc.createElement(tag)
    e.className = cls
    if (text !== undefined) e.textContent = text
    return e
  }
  const panel = el('section', 'p2d-rear-panel')
  panel.setAttribute('aria-labelledby', 'p2d-rear-title')
  panel.dataset.testid = 'plan2d-rear'
  panel.dataset.holding = String(m.holding)
  if (opts.from) panel.style.transformOrigin = `${Math.round(opts.from.x)}px ${Math.round(opts.from.y)}px`
  if (!opts.reduced) panel.classList.add('p2d-flip-in')
  const title = el('h3', 'p2d-rear-title', m.title)
  title.id = 'p2d-rear-title'
  const note = el('p', 'p2d-rear-note', m.note)
  const line = el('p', 'p2d-rear-line', m.line)
  const grid = el('div', 'p2d-rear-grid')
  grid.setAttribute('role', 'group')
  grid.setAttribute('aria-label', m.title)
  grid.style.setProperty('--p2d-cols', String(Math.max(1, Math.min(8, m.ports.length))))
  let first: HTMLElement | null = null
  m.ports.forEach((p, i) => {
    const b = el('button', `p2d-port p2d-port-${p.state}`)
    b.type = 'button'
    b.dataset.port = p.port.portId
    b.dataset.state = p.state
    const usable = p.state === 'lit' || p.state === 'pick'
    if (!usable) b.setAttribute('aria-disabled', 'true')
    const icon = el('span', 'p2d-port-icon')
    icon.innerHTML = connectorGlyphMarkup(p.port.glyph, pinFilled(p.port))
    const name = el('span', 'p2d-port-name', p.port.portId)
    const meta = el('span', 'p2d-port-meta', `${p.port.connectorLabel} · ${p.port.signalLabel} · ${p.dirText}`)
    b.append(icon, name, meta)
    b.setAttribute('aria-label', `${p.text}, ${p.dirText}`)
    if (p.reason) {
      const why = el('span', 'p2d-port-why', p.reason)
      why.id = `p2d-why-${i}`
      b.append(why)
      b.setAttribute('aria-describedby', why.id)
      b.title = p.detail ? `${p.reason} ${p.detail}` : p.reason
    }
    b.addEventListener('click', () => h.onPort(p.port.portId))
    grid.append(b)
    if (!first && usable) first = b
  })
  const actions = el('div', 'p2d-rear-actions')
  const back = el('button', 'p2d-btn', P().back)
  back.type = 'button'
  back.dataset.testid = 'plan2d-rear-back'
  back.addEventListener('click', () => h.onBack())
  actions.append(back)
  if (m.holding) {
    const drop = el('button', 'p2d-btn', P().drop)
    drop.type = 'button'
    drop.dataset.testid = 'plan2d-rear-drop'
    drop.addEventListener('click', () => h.onDrop())
    actions.append(drop)
  }
  panel.append(title, note, line, grid, actions)
  host.append(panel)
  host.hidden = false
  return first ?? (grid.querySelector('button') as HTMLElement | null) ?? back
}
