/**
 * The « Propriétés » panel (Task 10, C5, C10), inspired by pro acoustic-design
 * tools: the selected device's position, orientation, mount, catalog controls
 * and connections. DOM only: every edit is an intent sent through
 * `history.do` (the shell never mutates the graph, C6); the model and the
 * parsing live in propertiesModel.ts.
 *
 * - Numeric fields are text inputs (`inputmode="decimal"`, French comma) with
 *   named ± steppers. Entrée or leaving the field commits; Échap puts the store
 *   value back. Invalid text is announced on the field (`aria-invalid`,
 *   `aria-describedby`) and nothing is dispatched.
 * - A stepper burst (clicks within 600 ms, or a held pointer) is ONE history
 *   transaction: `begin` on the first step, `commit` 600 ms after the last.
 * - Tilt sign: positive = the front aims up (see propertiesModel.ts).
 * - Updated on store / selection change only (no per-frame work): values are
 *   patched in place so focus stays where it is; the DOM is rebuilt only when
 *   the device, its controls or its cables change, and focus is put back.
 */
import type { Registry } from '../../engine/CatalogLoader'
import type { History } from '../history'
import type { DesignState } from '../../trials/trial'
import { COPY } from '../copy'
import { createLiveText } from './liveText'
import { fieldIntent, poseChanged, propsView, stepIntent, type FieldId, type FieldOpts, type PropsView } from './propertiesModel'

export interface PropertiesPanelDeps {
  doc: Document
  container: HTMLElement
  registry: Registry
  history: Pick<History, 'do' | 'begin' | 'commit'>
  design(): DesignState
  selection(): string | null
  floorAt?: FieldOpts['floorAt']
  /** Status-bar answer to a learner action (« Débranché : … »). */
  announce(message: string): void
}

export interface PropertiesPanel {
  readonly element: HTMLElement
  /** Rebuilds + patches so far (no per-frame work). */
  readonly renders: number
  render(): void
  /** Close a pending stepper burst now (before an undo / redo). */
  flush(): void
}

type NumField = 'x' | 'y' | 'z' | 'yaw' | 'tilt'
const NUM: readonly NumField[] = ['x', 'y', 'z', 'yaw', 'tilt']
export const BURST_MS = 600
const HOLD_DELAY_MS = 400
const HOLD_REPEAT_MS = 90

const P = (): Readonly<Record<string, string>> => COPY.props!
const fill = (s: string, k: string, v: string): string => s.replace(`{${k}}`, v)

let seq = 0

export function mountPropertiesPanel(d: PropertiesPanelDeps): PropertiesPanel {
  const { doc } = d
  const win = doc.defaultView!
  const root = doc.createElement('div')
  root.className = 'cr-props-content'
  root.dataset.testid = 'properties-content'
  d.container.replaceChildren(root)

  let view: PropsView | null = null
  let structure = ''
  let renders = 0
  const drafts = new Map<FieldId, string>()
  const errors = new Set<FieldId>()
  // live DOM refs of the current build
  let inputs = new Map<FieldId, HTMLInputElement>()
  let steppers = new Map<NumField, HTMLButtonElement[]>()
  let errorOut = new Map<FieldId, (text: string, again?: boolean) => void>()
  let errorEl = new Map<FieldId, HTMLElement>()
  let mountSelect: HTMLSelectElement | null = null
  let toggles = new Map<string, HTMLButtonElement>()
  let enums = new Map<string, HTMLSelectElement>()

  const opts = (): FieldOpts => (d.floorAt ? { floorAt: d.floorAt } : {})
  const labelOf = (id: FieldId): string => view?.fields.find((f) => f.id === id)?.label ?? id

  // ── stepper bursts ────────────────────────────────────────────────────────
  let burst: { field: NumField; timer: number } | null = null
  const flush = (): void => {
    if (!burst) return
    win.clearTimeout(burst.timer)
    burst = null
    d.history.commit()
  }
  const step = (field: NumField, dir: 1 | -1): void => {
    if (!view) return
    if (burst && burst.field !== field) flush()
    if (!burst) {
      d.history.begin(fill(P().adjust!, 'field', labelOf(field)))
      burst = { field, timer: 0 }
    }
    win.clearTimeout(burst.timer)
    burst.timer = win.setTimeout(flush, BURST_MS)
    drafts.delete(field)
    clearError(field)
    const design = d.design()
    const intent = stepIntent(view, design, field, dir, opts())
    if (intent && poseChanged(design, intent)) d.history.do(intent, fill(P().adjust!, 'field', labelOf(field)))
  }

  // ── field commit / revert ─────────────────────────────────────────────────
  /** `again`: an answer to Entrée (read again even when unchanged); leaving the field is not. */
  const setError = (id: FieldId, again = true): void => {
    errors.add(id)
    inputs.get(id)?.setAttribute('aria-invalid', 'true')
    errorOut.get(id)?.(P().invalidNumber!, again)
  }
  const clearError = (id: FieldId): void => {
    errors.delete(id)
    inputs.get(id)?.removeAttribute('aria-invalid')
    errorOut.get(id)?.('')
  }
  const storeValue = (id: FieldId): string => String(view?.fields.find((f) => f.id === id)?.value ?? '')
  const revert = (id: FieldId): void => {
    drafts.delete(id)
    clearError(id)
    const input = inputs.get(id)
    if (input) input.value = storeValue(id)
  }
  const commit = (id: FieldId, fromBlur = false): void => {
    const input = inputs.get(id)
    if (!view || !input || input.readOnly || !drafts.has(id)) return
    const design = d.design()
    const intent = fieldIntent(view, design, id, input.value, opts())
    if (!intent) return setError(id, !fromBlur)
    drafts.delete(id)
    clearError(id)
    if (!poseChanged(design, intent)) {
      input.value = storeValue(id) // same pose: show it formatted, record nothing
      return
    }
    flush()
    d.history.do(intent, fill(P().adjust!, 'field', labelOf(id)))
  }

  // ── DOM builders ──────────────────────────────────────────────────────────
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
    const e = doc.createElement(tag)
    if (cls) e.className = cls
    if (text !== undefined) e.textContent = text
    return e
  }
  const section = (legendText: string, hint?: string): { form: HTMLFormElement; box: HTMLFieldSetElement; legendId: string } => {
    const form = el('form', 'cr-props-section')
    form.noValidate = true
    form.addEventListener('submit', (e) => e.preventDefault())
    const box = el('fieldset')
    const legend = el('legend', 'cr-props-legend', legendText)
    legend.id = `cr-props-${++seq}`
    box.appendChild(legend)
    if (hint) {
      const h = el('p', 'cr-props-hint', hint)
      h.id = `cr-props-${++seq}`
      box.setAttribute('aria-describedby', h.id)
      box.appendChild(h)
    }
    form.appendChild(box)
    return { form, box, legendId: legend.id }
  }

  const textField = (v: PropsView, id: FieldId): HTMLElement => {
    const f = v.fields.find((x) => x.id === id)!
    const row = el('div', 'cr-field')
    row.dataset.field = id
    const inputId = `cr-props-${++seq}`
    const label = el('label', 'cr-field-label', f.label)
    label.htmlFor = inputId
    const ctl = el('div', 'cr-field-ctl')
    const input = el('input', 'cr-field-input')
    input.type = 'text'
    input.id = inputId
    input.autocomplete = 'off'
    input.spellcheck = false
    input.dataset.key = `field:${id}`
    input.value = drafts.get(id) ?? String(f.value)
    input.readOnly = !!f.readOnly
    const described: string[] = []
    if (f.unit) {
      input.inputMode = 'decimal'
      const unitWords = el('span', 'cr-sr-only', f.unit === 'm' ? P().unitMetres! : P().unitDegrees!)
      unitWords.id = `${inputId}-unit`
      described.push(unitWords.id)
      ctl.appendChild(unitWords)
    }
    const err = el('p', 'cr-field-error')
    err.id = `${inputId}-error`
    err.setAttribute('aria-live', 'polite')
    described.push(err.id)
    input.setAttribute('aria-describedby', described.join(' '))
    if (errors.has(id)) {
      input.setAttribute('aria-invalid', 'true')
      err.textContent = P().invalidNumber!
    }
    input.addEventListener('input', () => drafts.set(id, input.value))
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commit(id)
      } else if (e.key === 'Escape' && (drafts.has(id) || errors.has(id))) {
        e.preventDefault()
        e.stopPropagation()
        revert(id)
      }
    })
    input.addEventListener('blur', () => commit(id, true))

    if (f.unit && (NUM as readonly string[]).includes(id)) {
      const nf = id as NumField
      const btn = (dir: 1 | -1): HTMLButtonElement => {
        const b = el('button', 'cr-step')
        b.type = 'button'
        const name = fill(dir < 0 ? P().decrease! : P().increase!, 'field', f.label)
        b.setAttribute('aria-label', name)
        b.title = name
        b.dataset.key = `step:${id}:${dir}`
        b.textContent = dir < 0 ? '−' : '+'
        b.disabled = !!f.readOnly
        attachStepper(b, nf, dir)
        return b
      }
      const minus = btn(-1)
      const plus = btn(1)
      const unit = el('span', 'cr-unit', f.unit)
      unit.setAttribute('aria-hidden', 'true')
      ctl.prepend(minus)
      ctl.append(input, unit, plus)
      steppers.set(nf, [minus, plus])
    } else ctl.appendChild(input)
    row.append(label, ctl, err)
    inputs.set(id, input)
    errorEl.set(id, err)
    errorOut.set(id, createLiveText(err, (fn, ms) => win.setTimeout(fn, ms)))
    return row
  }

  /** Click = one step; a held pointer repeats (and swallows the click that ends it). */
  const attachStepper = (b: HTMLButtonElement, field: NumField, dir: 1 | -1): void => {
    let hold = 0
    let repeat = 0
    let repeated = false
    const stop = (): void => {
      win.clearTimeout(hold)
      win.clearInterval(repeat)
      hold = repeat = 0
    }
    b.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      repeated = false
      stop()
      hold = win.setTimeout(() => {
        repeat = win.setInterval(() => {
          repeated = true
          step(field, dir)
        }, HOLD_REPEAT_MS)
      }, HOLD_DELAY_MS)
    })
    for (const t of ['pointerup', 'pointerleave', 'pointercancel'] as const) b.addEventListener(t, stop)
    b.addEventListener('click', () => {
      if (repeated) {
        repeated = false
        return
      }
      step(field, dir)
    })
    // Leaving the stepper (menu, canvas, another field) closes the burst at once.
    b.addEventListener('blur', (e) => {
      stop()
      const next = e.relatedTarget
      if (!(next instanceof HTMLElement && next.dataset.key?.startsWith(`step:${field}:`))) flush()
    })
  }

  const build = (v: PropsView | null): void => {
    inputs = new Map()
    steppers = new Map()
    errorOut = new Map()
    errorEl = new Map()
    toggles = new Map()
    enums = new Map()
    mountSelect = null
    if (!v) {
      const box = el('div', 'cr-props-empty')
      const none = el('h3', 'cr-props-title', P().none)
      none.tabIndex = -1
      box.append(none, el('p', 'cr-props-hint', P().noneHint))
      root.replaceChildren(box)
      return
    }
    const head = el('div', 'cr-props-head')
    const title = el('h3', 'cr-props-title', v.title)
    title.tabIndex = -1 // where focus lands when its control went away
    head.append(title)
    const ident = el('form', 'cr-props-section cr-props-ident')
    ident.addEventListener('submit', (e) => e.preventDefault())
    ident.appendChild(textField(v, 'name'))
    head.appendChild(ident)

    const pos = section(P().sectionPosition!, P().positionHint)
    for (const id of ['x', 'y', 'z'] as const) pos.box.appendChild(textField(v, id))
    const ori = section(P().sectionOrientation!, P().orientationHint)
    for (const id of ['yaw', 'tilt'] as const) ori.box.appendChild(textField(v, id))

    const mnt = section(P().sectionMount!)
    const mf = v.fields.find((f) => f.id === 'mount')!
    const mRow = el('div', 'cr-field')
    const mId = `cr-props-${++seq}`
    const mLabel = el('label', 'cr-field-label', mf.label)
    mLabel.htmlFor = mId
    const sel = el('select', 'cr-select')
    sel.id = mId
    sel.dataset.key = 'field:mount'
    for (const o of mf.options ?? []) {
      const opt = el('option', undefined, o.label)
      opt.value = o.value
      sel.appendChild(opt)
    }
    sel.value = String(mf.value)
    sel.addEventListener('change', () => {
      if (!view) return
      const design = d.design()
      const intent = fieldIntent(view, design, 'mount', sel.value, opts())
      if (intent && poseChanged(design, intent)) {
        flush()
        d.history.do(intent, fill(P().adjust!, 'field', mf.label))
      }
    })
    mRow.append(mLabel, sel)
    mnt.box.appendChild(mRow)
    mountSelect = sel

    const ctl = section(P().sectionControls!)
    if (!v.controls.length) ctl.box.appendChild(el('p', 'cr-props-hint', P().noControls))
    for (const c of v.controls) {
      if (c.kind === 'toggle') {
        const b = el('button', 'cr-toggle')
        b.type = 'button'
        b.dataset.key = `ctl:${c.id}`
        b.setAttribute('aria-pressed', String(c.value === true))
        const state = el('span', 'cr-toggle-state', c.value === true ? P().toggleOn : P().toggleOff)
        state.setAttribute('aria-hidden', 'true')
        b.append(el('span', 'cr-toggle-label', c.label), state)
        b.addEventListener('click', () => {
          if (!view) return
          const now = view.controls.find((x) => x.id === c.id)?.value === true
          flush()
          d.history.do({ type: 'SET_CONTROL', instance: view.instanceId, control: c.id, value: !now }, fill(P().adjust!, 'field', c.label))
        })
        toggles.set(c.id, b)
        ctl.box.appendChild(b)
      } else {
        const row = el('div', 'cr-field')
        const id = `cr-props-${++seq}`
        const label = el('label', 'cr-field-label', c.label)
        label.htmlFor = id
        const s = el('select', 'cr-select')
        s.id = id
        s.dataset.key = `ctl:${c.id}`
        for (const o of c.options ?? []) {
          const opt = el('option', undefined, o)
          opt.value = o
          s.appendChild(opt)
        }
        s.value = String(c.value)
        s.addEventListener('change', () => {
          if (!view) return
          flush()
          d.history.do({ type: 'SET_CONTROL', instance: view.instanceId, control: c.id, value: s.value }, fill(P().adjust!, 'field', c.label))
        })
        enums.set(c.id, s)
        row.append(label, s)
        ctl.box.appendChild(row)
      }
    }

    const con = section(P().sectionConnections!)
    if (!v.ports.length) con.box.appendChild(el('p', 'cr-props-hint', P().noPorts))
    else {
      const list = el('ul', 'cr-ports')
      list.setAttribute('aria-labelledby', con.legendId)
      const dirWord = { in: P().dirIn!, out: P().dirOut!, bidir: P().dirBidir! }
      for (const p of v.ports) {
        const li = el('li', 'cr-port')
        li.tabIndex = -1
        li.dataset.key = `port:${p.portId}`
        li.dataset.state = p.state.kind
        const top = el('div', 'cr-port-top')
        top.append(el('span', 'cr-port-id', p.label), el('span', 'cr-port-dir', `${dirWord[p.dir]} · ${p.signalLabel}`))
        const to = el('div', 'cr-port-to')
        if (p.state.kind === 'connected') {
          const arrow = el('span', 'cr-port-arrow', p.dir === 'in' ? '←' : '→')
          arrow.setAttribute('aria-hidden', 'true')
          to.append(arrow, el('span', 'cr-port-other', p.state.toLabel))
          const other = p.state.toLabel
          const target = p.state.to
          const b = el('button', 'cr-unplug', P().unplug)
          b.type = 'button'
          b.dataset.key = `unplug:${p.portId}`
          b.setAttribute('aria-label', fill(fill(P().unplugName!, 'port', p.label), 'other', other))
          b.addEventListener('click', () => {
            if (!view) return
            flush()
            const r = d.history.do({ type: 'UNPLUG', a: { instance: view.instanceId, port: p.portId }, b: target }, P().unplug)
            if (r.ok) d.announce(fill(fill(P().statusUnplugged!, 'port', p.label), 'other', other))
          })
          li.append(top, to, b)
        } else {
          to.appendChild(el('span', 'cr-port-free', P().portFree))
          li.append(top, to)
        }
        list.appendChild(li)
      }
      con.box.appendChild(list)
    }
    root.replaceChildren(head, pos.form, ori.form, mnt.form, ctl.form, con.form)
  }

  /** Values only: focus, caret and typed drafts stay as they are. */
  const patch = (v: PropsView): void => {
    for (const f of v.fields) {
      const input = inputs.get(f.id)
      if (input) {
        if (!drafts.has(f.id) && input.value !== String(f.value)) input.value = String(f.value)
        input.readOnly = !!f.readOnly
        for (const b of steppers.get(f.id as NumField) ?? []) b.disabled = !!f.readOnly
      }
      if (f.id === 'mount' && mountSelect) mountSelect.value = String(f.value)
    }
    for (const c of v.controls) {
      const t = toggles.get(c.id)
      if (t) {
        t.setAttribute('aria-pressed', String(c.value === true))
        const s = t.querySelector('.cr-toggle-state')
        if (s) s.textContent = c.value === true ? P().toggleOn! : P().toggleOff!
      }
      const s = enums.get(c.id)
      if (s && s.value !== String(c.value)) s.value = String(c.value)
    }
  }

  const structureOf = (v: PropsView | null): string =>
    v
      ? JSON.stringify([
          v.instanceId,
          v.controls.map((c) => [c.id, c.kind, c.options]),
          v.ports.map((p) => [p.portId, p.state.kind === 'connected' ? p.state.toLabel : '']),
        ])
      : ''

  const render = (): void => {
    renders++
    const sel = d.selection()
    const next = sel ? propsView(d.design(), d.registry, sel) : null
    if ((next?.instanceId ?? null) !== (view?.instanceId ?? null)) {
      // Another device: a burst, drafts and errors belong to the previous one.
      flush()
      drafts.clear()
      errors.clear()
    }
    view = next
    const key = structureOf(next)
    if (key === structure && next) return patch(next)
    structure = key
    const active = doc.activeElement
    const focusKey = active instanceof HTMLElement && root.contains(active) ? active.dataset.key : undefined
    build(next)
    if (focusKey) {
      const find = (k: string): HTMLElement | null => root.querySelector<HTMLElement>(`[data-key="${CSS.escape(k)}"]`)
      const target = find(focusKey) ?? (focusKey.startsWith('unplug:') ? find(`port:${focusKey.slice('unplug:'.length)}`) : null)
      ;(target ?? root.querySelector<HTMLElement>('.cr-props-title'))?.focus()
    }
  }

  render()
  return {
    element: root,
    get renders() {
      return renders
    },
    render,
    flush,
  }
}
