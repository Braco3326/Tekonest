/**
 * The 2D schema page (mission 2, spec §1): an independent page over the 3D view, a floor plan of the current place to scale, in metres.
 *
 * - A real modal layer (src/creation/shell/modal.ts): role="dialog", labelled by its title, everything behind it inert, focus kept in, Échap closes
 *   it (after dropping a held cable or leaving a rear panel first). The 3D view's keys never fire inside it (src/creation/input/keyboard.ts).
 * - It never changes the 3D scene, the 3D store or the engine: it has its own plan (model.ts), its own undo history (history.ts) and its own storage
 *   key (persist.ts). The only thing it reads of the 3D page is the place (its key, name, size and outline) and the catalogue.
 * - Place (palette click or drag), move (drag, arrows), rotate (R 90°, Maj+R 15°), delete (Suppr), duplicate (Ctrl+D), multi-select (Maj / Ctrl +
 *   clic, Ctrl+A, Espace), undo / redo (Ctrl+Z, Ctrl+Y), pan (drag the floor, arrows with nothing selected), zoom (wheel, pinch, + / -).
 * - Cables: activate a device (a second click on it, Entrée, a double click) and it flips to its rear panel (rearView.ts); a free port starts a cable
 *   (« held »), back on the plan the devices that can take its other end are lit and the others dimmed; activating one flips it with its ports lit or
 *   dimmed with the rule's reason; a lit port ends the cable. Échap drops it. Lines are drawn in their type's colour, pattern, arrow and tag
 *   (cableStyle2d.ts), with a legend always shown and a « Légende et sources » panel that keeps the colour and symbol sheet's level of proof.
 * Every message goes to one polite live region.
 */
import './plan2d.css'
import type { Registry } from '../engine/CatalogLoader'
import { COPY } from '../creation/copy'
import { openModal } from '../creation/shell/modal'
import type { PlaceData } from '../creation/placeData'
import { floorPlanSvg, roomPlanSvg } from '../creation/roomPlanSvg'
import { createLiveText } from '../creation/shell/liveText'
import { shortName } from '../creation/shell/propertiesModel'
import { CABLE_STYLES, arrowOf, cableTypeOf, styleOf, tagOf, type CableType } from './cableStyle2d'
import {
  DEFAULT_SNAP_M, SNAP_STEPS_M, deviceMatrix, fitView, footprintBounds, footprintCorners, gridLines, panBy, portAnchor, scaleBar, snap, toScreen, toWorld, zoomAt,
  type View,
} from './geometry'
import { PlanHistory } from './history'
import { emptyPlan, selectToggle, type Plan2D, type PlanDevice, type PortEnd } from './model'
import { createPatchRules } from './patchRules'
import { loadPlan, planKey, savePlan } from './persist'
import { mountPalette } from './palette'
import { mountRear, rearModel } from './rearView'
import { planSpawn, type SpawnPlan, type SpawnTarget } from './spawn3d'
import { choiceInPage } from './spawnDialog'
import { CATEGORY_FAMILY, GLYPHS, familyOf, footprintOf, type Family } from './symbols'

const P = (): Readonly<Record<string, string>> => COPY.plan2d!
const fill = (s: string, vars: Record<string, string>): string => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const n2 = (v: number): string => {
  const r = Math.round(v * 100) / 100
  return String(Object.is(r, -0) ? 0 : r)
}
/** A French number: « 1,25 ». */
const fr = (v: number): string => n2(v).replace('.', ',')

export interface RoomInfo {
  /** The place key of the 3D page (`room:<id>`, `set:<env>`, `blank`). */
  key: string
  name: string
  width: number
  length: number
  /** The room's plan as drawn for the place picker (src/creation/roomPlanSvg.ts): metres, world +x mirrored to the left. */
  outline: string
}

export interface Plan2dPageDeps {
  doc: Document
  registry: Registry
  room: RoomInfo
  storage: Storage | null
  projectName: string | null
  /** True: the flip is a cut (prefers-reduced-motion). */
  reducedMotion?(): boolean
  parent?: HTMLElement
  /**
   * Stage 2: what the 3D page lends for « Envoyer dans la scène 3D » (closures over its store and history, never the store). Absent: no such button,
   * the page stays the stand-alone plan of stage 1.
   */
  spawn?: SpawnTarget | null
}

export interface Plan2dPage {
  /** Settles when the page has closed (Fermer, Échap). */
  readonly closed: Promise<void>
  close(): void
  readonly history: PlanHistory
  readonly root: HTMLElement
}

export const PLAN2D_TESTID = 'plan2d'

/** The outline of a place as the place picker draws it (src/creation/roomPlanSvg.ts): a TEK Brain room with its zones and openings, else the bare floor. */
export const outlineOf = (place: PlaceData): string => (place.kind === 'room' ? roomPlanSvg(place.file) : floorPlanSvg(place.width, place.length))

const TAG_LABEL = (): Record<string, string> => ({ STANDARD: P().tagStandard!, 'TRADE PRACTICE': P().tagTrade!, 'OUR PROPOSAL': P().tagProposal! })
const typeName = (t: CableType): string => P()[`type${t.split('-').map((w) => w[0]!.toUpperCase() + w.slice(1)).join('')}`] ?? t
const FAMILY_KEY: Record<Family, string> = {
  micro: 'familyMicro', speaker: 'familySpeaker', headphones: 'familyHeadphones', amp: 'familyAmp', console: 'familyConsole', rack: 'familyRack', box: 'familyBox', unknown: 'familyUnknown',
}

/** What may take focus inside the page (the modal's two edge sentinels excepted). */
const FOCUSABLE = 'button:not([disabled]), input, select, [tabindex="0"]'

export function openPlan2dPage(d: Plan2dPageDeps): Plan2dPage {
  const { doc, registry, room } = d
  const key = planKey(d.projectName, room.key)
  const loaded = loadPlan(d.storage, key)
  const history = new PlanHistory(loaded.plan ?? emptyPlan(room.key))
  const rules = createPatchRules(registry)
  const reduced = (): boolean => d.reducedMotion?.() ?? doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  let selection: string[] = []
  let cableSel: string | null = null
  let held: PortEnd | null = null
  let rearDev: string | null = null
  let snapStep: number = DEFAULT_SNAP_M
  let view: View = fitView(room, 800, 520)
  let fitted = false
  /** A drag of devices in progress: the snapped offset shown before it is one undoable move. */
  let dragOffset: { ids: string[]; dx: number; dz: number } | null = null
  let saveWarned = false
  let finish: (() => void) | null = null
  /** The modal's box (the in-page confirmations sit in it, beside the page's parts they make inert). */
  let pageBox: HTMLElement | null = null
  /** A send is being confirmed or applied: a second press does nothing. */
  let sending = false
  /** Where the focus goes once a send has ended. */
  let focusNext: HTMLElement | null = null

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
    const e = doc.createElement(tag)
    if (cls) e.className = cls
    if (text !== undefined) e.textContent = text
    return e
  }
  const btn = (label: string, testid: string, run: () => void): HTMLButtonElement => {
    const b = el('button', 'p2d-btn', label)
    b.type = 'button'
    b.dataset.testid = testid
    b.addEventListener('click', run)
    return b
  }

  // ── the page's parts (built once; the modal puts them in its box)
  const root = el('div', 'p2d')
  const live = el('p', 'p2d-live')
  live.setAttribute('role', 'status')
  live.dataset.testid = 'plan2d-live'
  const later = (fn: () => void, ms: number): void => void (doc.defaultView ? doc.defaultView.setTimeout(fn, ms) : fn())
  const sayText = createLiveText(live, later)
  const say = (text: string): void => sayText(text, true)

  const toolbar = el('div', 'p2d-toolbar')
  toolbar.setAttribute('role', 'toolbar')
  toolbar.setAttribute('aria-label', P().toolbar!)
  const undoBtn = btn(P().undo!, 'plan2d-undo', () => undo())
  const redoBtn = btn(P().redo!, 'plan2d-redo', () => redo())
  const snapLabel = el('label', 'p2d-snap-label', P().snap)
  const snapSel = el('select', 'p2d-snap')
  snapSel.id = 'p2d-snap'
  snapLabel.htmlFor = snapSel.id
  for (const s of SNAP_STEPS_M) {
    const o = el('option', undefined, s >= 1 ? `${s} m` : `${Math.round(s * 100)} cm`)
    o.value = String(s)
    if (s === DEFAULT_SNAP_M) o.selected = true
    snapSel.append(o)
  }
  snapSel.addEventListener('change', () => {
    const v = Number(snapSel.value)
    if ((SNAP_STEPS_M as readonly number[]).includes(v)) snapStep = v
  })
  const zoomIn = btn(P().zoomIn!, 'plan2d-zoom-in', () => zoomBy(1.25))
  const zoomOut = btn(P().zoomOut!, 'plan2d-zoom-out', () => zoomBy(0.8))
  const fitBtn = btn(P().fit!, 'plan2d-fit', () => {
    view = fitView(room, view.w, view.h)
    render()
  })
  const sourcesBtn = btn(P().sources!, 'plan2d-sources-toggle', () => {
    const open = sourcesPanel.hidden
    sourcesPanel.hidden = !open
    sourcesBtn.setAttribute('aria-expanded', String(open))
  })
  sourcesBtn.setAttribute('aria-expanded', 'false')
  sourcesBtn.setAttribute('aria-controls', 'p2d-sources')
  const closeBtn = btn(P().close!, 'plan2d-close', () => finish?.())
  // Stage 2: « Envoyer dans la scène 3D », only when the 3D page lent a target; never automatic (a press, then a confirmation)
  const spawnBtn = d.spawn ? btn(P().spawn!, 'plan2d-spawn', () => void send()) : null
  const spawnWhy = el('span', 'p2d-spawn-why', P().spawnEmpty)
  spawnWhy.id = 'p2d-spawn-why'
  spawnWhy.hidden = true
  toolbar.append(undoBtn, redoBtn, snapLabel, snapSel, zoomIn, zoomOut, fitBtn, sourcesBtn, ...(spawnBtn ? [spawnBtn, spawnWhy] : []), closeBtn)

  const palette = mountPalette(doc, registry, {
    onPick: (deviceId) => place(deviceId, view.cx, view.cz),
    onDrop: (deviceId, cx, cy) => {
      const r = svg.getBoundingClientRect()
      if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return false
      const w = toWorld(view, cx - r.left, cy - r.top)
      place(deviceId, w.x, w.z)
      return true
    },
  })

  const stage = el('div', 'p2d-stage')
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.classList.add('p2d-svg')
  svg.setAttribute('role', 'group')
  svg.setAttribute('tabindex', '0')
  svg.setAttribute('aria-label', fill(P().plan!, { room: room.name }))
  svg.setAttribute('aria-describedby', 'p2d-keys')
  svg.dataset.testid = 'plan2d-plan'
  const emptyMsg = el('p', 'p2d-empty-plan', P().empty)
  const rearHost = el('div', 'p2d-rear')
  rearHost.hidden = true
  const keysHelp = el('p', 'p2d-keys', P().keys)
  keysHelp.id = 'p2d-keys'
  stage.append(svg, emptyMsg, rearHost)

  const side = el('div', 'p2d-side')
  const legend = el('section', 'p2d-legend')
  legend.setAttribute('aria-labelledby', 'p2d-legend-title')
  legend.dataset.testid = 'plan2d-legend'
  const legendTitle = el('h3', 'p2d-side-title', P().legend)
  legendTitle.id = 'p2d-legend-title'
  const legendList = el('ul', 'p2d-legend-list')
  for (const s of CABLE_STYLES) {
    const li = el('li', 'p2d-legend-item')
    li.dataset.type = s.type
    li.innerHTML = `<svg width="44" height="14" viewBox="0 0 44 14" aria-hidden="true" focusable="false"><line x1="2" y1="7" x2="42" y2="7" stroke="${s.colour}" stroke-width="${s.width}" stroke-dasharray="${s.dash}" stroke-linecap="${s.dash.startsWith('0 ') ? 'round' : 'butt'}"/></svg>`
    li.append(el('span', 'p2d-legend-name', typeName(s.type)), el('span', 'p2d-legend-tag', s.tag))
    legendList.append(li)
  }
  legend.append(legendTitle, legendList)

  const sourcesPanel = el('section', 'p2d-sources')
  sourcesPanel.id = 'p2d-sources'
  sourcesPanel.hidden = true
  sourcesPanel.setAttribute('aria-labelledby', 'p2d-sources-title')
  sourcesPanel.dataset.testid = 'plan2d-sources'
  const sourcesTitle = el('h3', 'p2d-side-title', P().sources)
  sourcesTitle.id = 'p2d-sources-title'
  const sourcesList = el('ul', 'p2d-sources-list')
  const row = (tag: string | null, text: string): void => {
    const li = el('li', 'p2d-source')
    if (tag) {
      const t = el('span', 'p2d-source-tag', TAG_LABEL()[tag] ?? tag)
      t.dataset.tag = tag
      li.append(t)
    }
    li.append(el('span', 'p2d-source-text', text))
    sourcesList.append(li)
  }
  row('OUR PROPOSAL', P().srcGlyphs!)
  for (const f of [...new Set(Object.values(CATEGORY_FAMILY)), 'unknown' as Family]) row(GLYPHS[f].confidence, P()[FAMILY_KEY[f]]!)
  row('OUR PROPOSAL', P().srcColours!)
  row('OUR PROPOSAL', P().srcLines!)
  row('STANDARD', P().srcWcag!)
  row('OUR PROPOSAL', P().srcMains!)
  row('TRADE PRACTICE', P().srcOrientation!)
  row('STANDARD', P().srcGender!)
  row(null, P().srcFootprint!)
  row(null, P().srcRules!)
  row(null, P().rearNote!)
  sourcesPanel.append(sourcesTitle, el('p', 'p2d-sources-intro', P().sourcesIntro), sourcesList)
  // the report of the last send (stage 2), first in the side column
  const report = el('section', 'p2d-report')
  report.hidden = true
  report.setAttribute('aria-labelledby', 'p2d-report-title')
  report.dataset.testid = 'plan2d-report'
  side.append(report, legend, sourcesPanel)

  const main = el('div', 'p2d-main')
  main.append(palette.root, stage, side)
  root.append(toolbar, main, keysHelp, live)

  // ── names
  const deviceOf = (id: string): PlanDevice | undefined => history.plan.devices.find((x) => x.id === id)
  const nameOf = (id: string): string => {
    const dv = deviceOf(id)
    return dv ? `${shortName(registry, dv.deviceId)} (${id})` : id
  }
  const portName = (e: PortEnd): string => `${nameOf(e.dev)} · ${e.port}`
  const portOf = (e: PortEnd) => {
    const dv = deviceOf(e.dev)
    return dv ? registry.deviceById.get(dv.deviceId)?.ports.find((q) => q.portId === e.port) : undefined
  }

  // ── plan edits (each is one undoable step)
  const place = (deviceId: string, x: number, z: number): void => {
    let px = snap(x, snapStep)
    const pz = snap(z, snapStep)
    for (let k = 0; k < 40 && history.plan.devices.some((q) => Math.abs(q.x - px) < 0.05 && Math.abs(q.z - pz) < 0.05); k++) px = snap(px - 2 * snapStep, snapStep)
    const label = registry.deviceById.get(deviceId)?.label ?? deviceId
    const r = history.do({ type: 'place', deviceId, x: px, z: pz }, fill(P().entryPlace!, { device: label }))
    if (!r.ok) return
    selection = [...r.created]
    cableSel = null
    render()
    say(fill(P().placed!, { device: label, x: fr(px), z: fr(pz) }))
  }
  const moveBy = (ids: string[], dx: number, dz: number): void => {
    if (!ids.length || (dx === 0 && dz === 0)) return
    if (history.do({ type: 'move', ids, dx, dz }, P().entryMove!).ok) say(fill(P().moved!, { n: String(ids.length) }))
  }
  const rotate = (ids: string[], by: number): void => {
    if (ids.length && history.do({ type: 'rotate', ids, by }, P().entryRotate!).ok) say(fill(P().rotated!, { n: String(ids.length) }))
  }
  const remove = (ids: string[]): void => {
    if (!ids.length) return
    if (held && ids.includes(held.dev)) held = null
    if (history.do({ type: 'remove', ids }, P().entryRemove!).ok) {
      selection = []
      say(fill(P().removed!, { n: String(ids.length) }))
    }
  }
  const duplicate = (ids: string[]): void => {
    if (!ids.length) return
    const r = history.do({ type: 'duplicate', ids, dx: -2 * snapStep, dz: 2 * snapStep }, P().entryDuplicate!)
    if (!r.ok) return
    selection = [...r.created]
    render()
    say(fill(P().duplicated!, { n: String(ids.length) }))
  }
  const cableText = (id: string): { a: string; b: string; type: CableType } | null => {
    const c = history.plan.cables.find((x) => x.id === id)
    if (!c) return null
    const pa = portOf(c.a)
    const pb = portOf(c.b)
    const type = (CABLE_STYLES.some((s) => s.type === c.type) ? c.type : pa && pb ? cableTypeOf(pa, pb) : 'analog-bal') as CableType
    const flip = pa && pb && arrowOf(type, pa.dir, pb.dir) === 'to-a'
    return { a: portName(flip ? c.b : c.a), b: portName(flip ? c.a : c.b), type }
  }
  const disconnect = (id: string): void => {
    const t = cableText(id)
    if (t && history.do({ type: 'disconnect', ids: [id] }, P().entryDisconnect!).ok) {
      cableSel = null
      say(fill(P().cableRemoved!, { a: t.a, b: t.b }))
    }
  }
  const undo = (): void => {
    const l = history.undo()
    say(l === null ? P().nothingUndo! : fill(P().undone!, { label: l }))
  }
  const redo = (): void => {
    const l = history.redo()
    say(l === null ? P().nothingRedo! : fill(P().redone!, { label: l }))
  }
  const zoomBy = (f: number): void => {
    view = zoomAt(view, f, view.w / 2, view.h / 2)
    render()
  }

  // ── cables: hold, flip, connect
  const flip = (dev: string): void => {
    const m = rearModel(registry, history.plan, dev, held, rules, portName)
    if (!m) return
    rearDev = dev
    const dv = deviceOf(dev)!
    const at = toScreen(view, dv.x, dv.z)
    const first = mountRear(doc, rearHost, m, { onPort, onBack: () => closeRear(), onDrop: () => dropCable() }, { from: { x: at.sx, y: at.sy }, reduced: reduced() })
    svg.setAttribute('inert', '')
    palette.root.inert = true
    first.focus()
    say(m.holding ? `${fill(P().lit!, { n: String(m.litCount), total: String(m.ports.length) })} ${m.line}` : `${m.title}. ${m.line}`)
  }
  const onPort = (portId: string): void => {
    if (!rearDev) return
    const m = rearModel(registry, history.plan, rearDev, held, rules, portName)
    const p = m?.ports.find((x) => x.port.portId === portId)
    if (!m || !p) return
    if (p.state === 'taken') return say(p.reason!)
    if (p.state === 'dim') return say(`${fill(P().refused!, { reason: p.reason ?? '' })}${p.detail ? ` ${p.detail}` : ''}`)
    if (p.state === 'pick') {
      held = { dev: rearDev, port: portId }
      closeRear()
      return say(fill(P().cableStart!, { port: portName(held) }))
    }
    // lit: the cable ends here
    const a = held!
    const b = { dev: rearDev, port: portId }
    const pa = portOf(a)
    const pb = portOf(b)
    const cableType = pa && pb ? cableTypeOf(pa, pb) : undefined
    const r = history.do({ type: 'connect', a, b, ...(cableType ? { cableType } : {}) }, fill(P().entryConnect!, { a: portName(a), b: portName(b) }))
    if (!r.ok) return say(fill(P().refused!, { reason: r.message }))
    held = null
    cableSel = r.created[0] ?? null
    selection = []
    closeRear()
    const t = cableSel ? cableText(cableSel) : null
    say(fill(P().cableDone!, { a: t?.a ?? portName(a), b: t?.b ?? portName(b) }))
  }
  const closeRear = (): void => {
    const was = rearDev
    rearDev = null
    rearHost.hidden = true
    rearHost.replaceChildren()
    svg.removeAttribute('inert')
    palette.root.inert = false
    render()
    const target = (was && svg.querySelector<SVGElement>(`[data-dev="${cssEsc(was)}"]`)) || svg
    target.focus()
  }
  const dropCable = (): void => {
    held = null
    if (rearDev) closeRear()
    else render()
    say(P().cableDropped!)
  }

  // ── stage 2: « Envoyer dans la scène 3D » (spawn3d.ts): a confirmation, one undoable 3D step, a report; the page stays open
  const nDev = (n: number): string => fill(n < 2 ? P().deviceOne! : P().deviceMany!, { n: String(n) })
  const nCab = (n: number): string => fill(n < 2 ? P().cableOne! : P().cableMany!, { n: String(n) })
  const refusalLines = (s: SpawnPlan): string[] => [
    ...s.refusedDevices.map((r) => {
      const device = nameOf(r.planId)
      switch (r.reason) {
        case 'outside':
          return fill(P().whyOutside!, { device })
        case 'unknown-device':
          return fill(P().whyUnknown!, { device })
        case 'store':
          return fill(P().whyStore!, { device, reason: r.message })
        case 'overlap':
          return r.with.inScene
            ? fill(P().whyOverlapScene!, { device, other: `${shortName(registry, r.with.deviceId)} (${r.with.id})` })
            : fill(P().whyOverlap!, { device, other: nameOf(r.with.id) })
      }
    }),
    ...s.refusedCables.map((r) => {
      const ends = { a: portName(r.a), b: portName(r.b) }
      return r.reason === 'device' ? fill(P().whyCableDevice!, { ...ends, device: nameOf(r.device) }) : fill(P().whyCableRule!, { ...ends, title: r.title, detail: r.detail }).trim()
    }),
  ]
  const showReport = (s: SpawnPlan | null, done: boolean): void => {
    const target = d.spawn!
    const undoKey = target.undoLabel()
    const title = el('h3', 'p2d-side-title', P().reportTitle)
    title.id = 'p2d-report-title'
    const head = !done || !s
      ? P().reportNone!
      : fill(s.mode === 'replace' ? P().reportReplaced! : P().reportAdded!, { devices: nDev(s.devices.length), cables: nCab(s.cables.length), undo: undoKey })
    const parts: HTMLElement[] = [title, el('p', 'p2d-report-head', head)]
    const lines = s ? refusalLines(s) : []
    if (lines.length) {
      parts.push(el('p', 'p2d-report-refused', P().reportRefused))
      const ul = el('ul', 'p2d-report-list')
      for (const line of lines) ul.append(el('li', 'p2d-report-item', line))
      parts.push(ul)
    }
    let show: HTMLButtonElement | null = null
    if (done && s) {
      const ids = s.devices.map((x) => x.instanceId)
      show = btn(P().show3d!, 'plan2d-show3d', () => {
        finish?.()
        target.show(ids)
      })
      parts.push(show)
    }
    report.replaceChildren(...parts)
    report.hidden = false
    say(lines.length ? `${head} ${P().reportRefused} ${lines.join(' ')}` : head)
    focusNext = show ?? spawnBtn
  }
  const send = async (): Promise<void> => {
    const target = d.spawn
    if (!target || sending || !history.plan.devices.length || !pageBox) return
    sending = true
    render()
    try {
      const plan = history.plan
      const add = planSpawn(registry, plan, target, 'add')
      const rep = planSpawn(registry, plan, target, 'replace')
      const hasGear = target.design().rig.instances.length > 0
      const canReplace = hasGear && rep.devices.length > 0
      if (!add.devices.length && !canReplace) return showReport(add, false)
      const cover = [toolbar, palette.root, stage, side, keysHelp]
      const left = add.refusedDevices.length + add.refusedCables.length
      const body = add.devices.length
        ? [fill(P().spawnBody!, { devices: nDev(add.devices.length), cables: nCab(add.cables.length) }), ...(left ? [fill(P().spawnBodyRefused!, { devices: nDev(add.refusedDevices.length), cables: nCab(add.refusedCables.length) })] : [])]
        : [P().spawnNothing!]
      const choice = await choiceInPage(doc, pageBox, cover, {
        id: 'plan2d-spawn-dialog',
        title: P().spawnTitle!,
        body,
        choices: [
          ...(add.devices.length ? [{ id: 'add' as const, label: P().spawnAdd! }] : []),
          ...(canReplace ? [{ id: 'replace' as const, label: COPY.place!.replace! }] : []),
          { id: 'cancel' as const, label: P().spawnCancel! },
        ],
        cancel: 'cancel',
      })
      if (choice === 'cancel') {
        say(P().spawnCancelled!)
        focusNext = spawnBtn
        return
      }
      if (choice === 'replace') {
        // the existing replace path's own confirmation (« Remplacer le matériel ? »), then its intent: APPLY_DESIGN, one undoable step
        const sure = await choiceInPage(doc, pageBox, cover, {
          id: 'plan2d-replace-dialog',
          title: COPY.place!.replaceTitle!,
          body: [fill(P().spawnReplaceBody!, { undo: target.undoLabel() })],
          choices: [
            { id: 'replace' as const, label: COPY.place!.replace! },
            { id: 'cancel' as const, label: COPY.place!.cancel! },
          ],
          cancel: 'cancel',
        })
        if (sure !== 'replace') {
          say(P().spawnCancelled!)
          focusNext = spawnBtn
          return
        }
        // planned again at the moment of applying: nothing changes behind a modal, but the store is the truth
        const now = planSpawn(registry, history.plan, target, 'replace')
        if (!now.devices.length || !target.replace(now.design!, P().entryReplace!)) {
          say(P().spawnFailed!)
          return
        }
        return showReport(now, true)
      }
      const now = planSpawn(registry, history.plan, target, 'add')
      if (!now.devices.length || !target.apply(now.intents, P().entrySpawn!).ok) {
        say(P().spawnFailed!)
        return
      }
      showReport(now, true)
    } finally {
      sending = false
      render()
      // after the render: the button is enabled again only now
      focusNext?.focus()
      focusNext = null
    }
  }

  // ── drawing
  const outlineInner = room.outline.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  const posOf = (dv: PlanDevice): PlanDevice => (dragOffset && dragOffset.ids.includes(dv.id) ? { ...dv, x: dv.x + dragOffset.dx, z: dv.z + dragOffset.dz } : dv)
  const litCount = (dev: string): number => (held ? rules.portVerdicts(history.plan, held, dev).filter((v) => v.verdict.ok).length : 0)

  function render(): void {
    const plan: Plan2D = history.plan
    selection = selection.filter((id) => plan.devices.some((x) => x.id === id))
    if (cableSel && !plan.cables.some((c) => c.id === cableSel)) cableSel = null
    if (held && !plan.devices.some((x) => x.id === held!.dev)) held = null
    const w = Math.round(stage.clientWidth) || 800
    const h = Math.round(stage.clientHeight) || 520
    if (!fitted && stage.clientWidth > 0) {
      view = fitView(room, w, h)
      fitted = true
    } else if (w !== view.w || h !== view.h) view = { ...view, w, h }
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
    svg.setAttribute('width', String(w))
    svg.setAttribute('height', String(h))
    const S = view.scale
    const out: string[] = []
    // arrow heads, one per type, in its colour
    out.push('<defs>')
    for (const s of CABLE_STYLES)
      out.push(`<marker id="p2d-arrow-${s.type}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="${Math.max(6, 3 + s.width * 1.5)}" markerHeight="${Math.max(6, 3 + s.width * 1.5)}" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${s.colour}"/></marker>`)
    out.push('</defs>')
    // the room (its picker plan, in metres, mirrored x): one matrix onto the screen
    out.push(`<g class="p2d-room" aria-hidden="true" transform="matrix(${n2(S)} 0 0 ${n2(S)} ${n2(w / 2 + S * view.cx)} ${n2(h / 2 - S * view.cz)})">${outlineInner}</g>`)
    // the metre grid
    const g = gridLines(room, 1)
    const tl = toScreen(view, room.width / 2, -room.length / 2)
    const br = toScreen(view, -room.width / 2, room.length / 2)
    out.push('<g class="p2d-grid" aria-hidden="true">')
    for (const x of g.xs) {
      const sx = toScreen(view, x, 0).sx
      out.push(`<line x1="${n2(sx)}" y1="${n2(tl.sy)}" x2="${n2(sx)}" y2="${n2(br.sy)}"/>`)
    }
    for (const z of g.zs) {
      const sy = toScreen(view, 0, z).sy
      out.push(`<line x1="${n2(tl.sx)}" y1="${n2(sy)}" x2="${n2(br.sx)}" y2="${n2(sy)}"/>`)
    }
    out.push('</g>')
    // orientation (seen from the audience) and the place's name
    const mx = (tl.sx + br.sx) / 2
    const my = (tl.sy + br.sy) / 2
    out.push('<g class="p2d-orient" aria-hidden="true">')
    out.push(`<text x="${n2(tl.sx)}" y="${n2(tl.sy - 22)}" class="p2d-room-name">${esc(room.name)}</text>`)
    out.push(`<text x="${n2(mx)}" y="${n2(tl.sy - 6)}" text-anchor="middle">${esc(P().stage!)}</text>`)
    out.push(`<text x="${n2(mx)}" y="${n2(br.sy + 16)}" text-anchor="middle">${esc(P().audience!)}</text>`)
    out.push(`<text x="${n2(tl.sx - 8)}" y="${n2(my)}" text-anchor="middle" transform="rotate(-90 ${n2(tl.sx - 8)} ${n2(my)})">${esc(P().jardin!)}</text>`)
    out.push(`<text x="${n2(br.sx + 8)}" y="${n2(my)}" text-anchor="middle" transform="rotate(90 ${n2(br.sx + 8)} ${n2(my)})">${esc(P().cour!)}</text>`)
    out.push('</g>')
    // cables, under the devices
    out.push('<g class="p2d-cables">')
    for (const c of plan.cables) {
      const da = plan.devices.find((x) => x.id === c.a.dev)
      const db = plan.devices.find((x) => x.id === c.b.dev)
      const pa = portOf(c.a)
      const pb = portOf(c.b)
      const t = cableText(c.id)
      if (!da || !db || !pa || !pb || !t) continue
      const portsA = registry.deviceById.get(da.deviceId)!.ports
      const portsB = registry.deviceById.get(db.deviceId)!.ports
      const fa = footprintOf(da.deviceId)
      const fb = footprintOf(db.deviceId)
      const A = portAnchor(posOf(da), fa, portsA.findIndex((q) => q.portId === c.a.port), portsA.length)
      const B = portAnchor(posOf(db), fb, portsB.findIndex((q) => q.portId === c.b.port), portsB.length)
      const sa = toScreen(view, A.x, A.z)
      const sb = toScreen(view, B.x, B.z)
      const st = styleOf(t.type)
      const arrow = arrowOf(t.type, pa.dir, pb.dir)
      const marker = `url(#p2d-arrow-${t.type})`
      const d = `M${n2(sa.sx)} ${n2(sa.sy)}L${n2(sb.sx)} ${n2(sb.sy)}`
      const tag = tagOf(t.type, pa.signal)
      const midX = (sa.sx + sb.sx) / 2
      const midY = (sa.sy + sb.sy) / 2
      const tw = tag.length * 6.4 + 10
      const sel = cableSel === c.id
      out.push(
        `<g class="p2d-cable${sel ? ' p2d-sel' : ''}" data-cable="${esc(c.id)}" data-type="${t.type}" role="button" tabindex="0" aria-pressed="${sel}" aria-label="${esc(fill(P().cableLabel!, { type: typeName(t.type), a: t.a, b: t.b }))}">`,
        `<path class="p2d-cable-hit" d="${d}"/>`,
        sel ? `<path class="p2d-cable-halo" d="${d}" stroke-width="${st.width + 6}"/>` : '',
        `<path class="p2d-cable-line" d="${d}" stroke="${st.colour}" stroke-width="${st.width}"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''} stroke-linecap="${st.dash.startsWith('0 ') ? 'round' : 'butt'}"${arrow !== 'to-a' ? ` marker-end="${marker}"` : ''}${arrow !== 'to-b' ? ` marker-start="${marker}"` : ''}/>`,
        `<rect class="p2d-tag-bg" x="${n2(midX - tw / 2)}" y="${n2(midY - 9)}" width="${n2(tw)}" height="16" stroke="${st.colour}"/>`,
        `<text class="p2d-tag" x="${n2(midX)}" y="${n2(midY + 3)}" text-anchor="middle">${esc(tag)}</text>`,
        st.glyph === 'lightning' ? `<path class="p2d-line-glyph" d="M${n2(midX + tw / 2 + 4)} ${n2(midY - 8)}l-4 8h4l-3 8 8-10h-4l3-6Z" fill="${st.colour}"/>` : '',
        st.glyph === 'clock' ? `<circle class="p2d-line-glyph" cx="${n2(sa.sx)}" cy="${n2(sa.sy)}" r="6" stroke="${st.colour}"/><path class="p2d-line-glyph" d="M${n2(sa.sx)} ${n2(sa.sy - 4)}V${n2(sa.sy)}H${n2(sa.sx + 3)}" stroke="${st.colour}"/>` : '',
        '</g>',
      )
    }
    out.push('</g>')
    // devices
    out.push('<g class="p2d-devices">')
    for (const raw of plan.devices) {
      const dv = posOf(raw)
      const device = registry.deviceById.get(dv.deviceId)
      const fp = footprintOf(dv.deviceId)
      const family = familyOf(device?.realWorld.category ?? '')
      const glyph = GLYPHS[family]
      const corners = footprintCorners(dv, fp).map((p) => toScreen(view, p.x, p.z))
      const m = deviceMatrix(view, dv, fp)
      const c = toScreen(view, dv.x, dv.z)
      const b = footprintBounds(dv, fp)
      const half = Math.max(((b.maxZ - b.minZ) / 2) * S, 8)
      const sel = selection.includes(dv.id)
      const lit = held ? litCount(dv.id) : -1
      const ports = device?.ports ?? []
      const label = shortName(registry, dv.deviceId)
      let aria = fill(P().deviceLabel!, { device: label, id: dv.id, x: fr(dv.x), z: fr(dv.z), rot: fr(dv.rot) })
      if (!fp.known) aria += `, ${P().sizeUnknown}`
      if (held) aria += `, ${fill(P().lit!, { n: String(Math.max(0, lit)), total: String(ports.length) })}`
      const cls = ['p2d-dev', sel ? 'p2d-sel' : '', held ? (lit > 0 ? 'p2d-lit' : 'p2d-dim') : '', fp.known ? '' : 'p2d-size-unknown'].filter(Boolean).join(' ')
      out.push(`<g class="${cls}" data-dev="${esc(dv.id)}" data-family="${family}" role="button" tabindex="0" aria-pressed="${sel}" aria-label="${esc(aria)}">`)
      out.push(`<circle class="p2d-hit" cx="${n2(c.sx)}" cy="${n2(c.sy)}" r="14"/>`)
      out.push(`<polygon class="p2d-fp" points="${corners.map((p) => `${n2(p.sx)},${n2(p.sy)}`).join(' ')}"/>`)
      out.push(`<path class="p2d-sym" d="${glyph.d}" transform="matrix(${m.map((v) => String(Math.round(v * 1e4) / 1e4)).join(' ')})" vector-effect="non-scaling-stroke"/>`)
      ports.forEach((q, i) => {
        const a = portAnchor(dv, fp, i, ports.length)
        const s = toScreen(view, a.x, a.z)
        const used = plan.cables.some((k) => (k.a.dev === dv.id && k.a.port === q.portId) || (k.b.dev === dv.id && k.b.port === q.portId))
        out.push(`<circle class="p2d-anchor${used ? ' p2d-anchor-used' : ''}" cx="${n2(s.sx)}" cy="${n2(s.sy)}" r="${used ? 2.4 : 1.6}"/>`)
      })
      out.push(`<text class="p2d-dev-label" x="${n2(c.sx)}" y="${n2(c.sy + half + 12)}" text-anchor="middle">${esc(label)}</text>`)
      if (!fp.known) out.push(`<text class="p2d-dev-note" x="${n2(c.sx)}" y="${n2(c.sy + half + 24)}" text-anchor="middle">${esc(P().sizeUnknown!)}</text>`)
      out.push('</g>')
    }
    out.push('</g>')
    // the scale bar, bottom left
    const bar = scaleBar(S)
    out.push(`<g class="p2d-scalebar" aria-hidden="true" transform="translate(16 ${n2(h - 18)})"><path d="M0 -6V0H${n2(bar.px)}V-6"/><text x="${n2(bar.px / 2)}" y="-9" text-anchor="middle">${esc(bar.label)}</text></g>`)
    const focusedKey = (doc.activeElement as Element | null)?.closest?.('[data-dev],[data-cable]')
    const refocus = focusedKey && svg.contains(focusedKey) ? (focusedKey.getAttribute('data-dev') ? `[data-dev="${cssEsc(focusedKey.getAttribute('data-dev')!)}"]` : `[data-cable="${cssEsc(focusedKey.getAttribute('data-cable')!)}"]`) : null
    svg.innerHTML = out.join('')
    if (refocus) (svg.querySelector<SVGElement>(refocus) ?? svg).focus()
    emptyMsg.hidden = plan.devices.length > 0
    undoBtn.disabled = !history.canUndo
    redoBtn.disabled = !history.canRedo
    if (spawnBtn) {
      // an empty plan has nothing to send: the button is off and says why (its tooltip and its accessible description)
      const empty = plan.devices.length === 0
      spawnBtn.disabled = empty || sending
      if (empty) {
        spawnBtn.title = P().spawnEmpty!
        spawnBtn.setAttribute('aria-describedby', spawnWhy.id)
      } else {
        spawnBtn.removeAttribute('title')
        spawnBtn.removeAttribute('aria-describedby')
      }
    }
    root.dataset.holding = String(held !== null)
  }

  history.subscribe((plan) => {
    if (!savePlan(d.storage, key, plan) && !saveWarned) {
      saveWarned = true
      say(P().notSaved!)
    }
    render()
  })

  // ── pointer: select, drag, pan, pinch, wheel
  type Drag =
    | { kind: 'dev'; id: string; pointer: number; x0: number; y0: number; moved: boolean; wasSole: boolean; additive: boolean; origin: { x: number; z: number }; ids: string[] }
    | { kind: 'pan'; pointer: number; x: number; y: number; moved: boolean }
  let drag: Drag | null = null
  const pointers = new Map<number, { x: number; y: number }>()
  let pinch: { dist: number } | null = null
  const local = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const r = svg.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  svg.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return
    const id = e.pointerId ?? 1
    pointers.set(id, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2) {
      const [p, q] = [...pointers.values()]
      pinch = { dist: Math.hypot(p!.x - q!.x, p!.y - q!.y) || 1 }
      drag = null
      dragOffset = null
      return
    }
    try {
      svg.setPointerCapture(id)
    } catch {
      // synthetic pointers (tests) have no capture
    }
    const t = e.target as Element
    const devEl = t.closest?.('[data-dev]')
    const cabEl = t.closest?.('[data-cable]')
    if (devEl) {
      const dev = devEl.getAttribute('data-dev')!
      const additive = e.shiftKey || e.ctrlKey || e.metaKey
      const wasSole = selection.length === 1 && selection[0] === dev
      if (additive) selection = selectToggle(selection, dev, true)
      else if (!selection.includes(dev)) selection = [dev]
      cableSel = null
      const dv = deviceOf(dev)!
      drag = { kind: 'dev', id: dev, pointer: id, x0: e.clientX, y0: e.clientY, moved: false, wasSole, additive, origin: { x: dv.x, z: dv.z }, ids: selection.includes(dev) ? [...selection] : [dev] }
      render()
      ;(svg.querySelector<SVGElement>(`[data-dev="${cssEsc(dev)}"]`) ?? svg).focus()
      return
    }
    if (cabEl) {
      selectCable(cabEl.getAttribute('data-cable')!)
      return
    }
    drag = { kind: 'pan', pointer: id, x: e.clientX, y: e.clientY, moved: false }
  })
  svg.addEventListener('pointermove', (e: PointerEvent) => {
    const id = e.pointerId ?? 1
    if (pointers.has(id)) pointers.set(id, { x: e.clientX, y: e.clientY })
    if (pinch && pointers.size === 2) {
      const [p, q] = [...pointers.values()]
      const dist = Math.hypot(p!.x - q!.x, p!.y - q!.y) || 1
      const mid = local({ clientX: (p!.x + q!.x) / 2, clientY: (p!.y + q!.y) / 2 })
      view = zoomAt(view, dist / pinch.dist, mid.x, mid.y)
      pinch = { dist }
      return render()
    }
    if (!drag || drag.pointer !== id) return
    if (drag.kind === 'pan') {
      const dx = e.clientX - drag.x
      const dy = e.clientY - drag.y
      if (!drag.moved && Math.hypot(dx, dy) < 4) return
      drag.moved = true
      drag.x = e.clientX
      drag.y = e.clientY
      view = panBy(view, dx, dy)
      return render()
    }
    const dsx = e.clientX - drag.x0
    const dsy = e.clientY - drag.y0
    if (!drag.moved && Math.hypot(dsx, dsy) < 4) return
    drag.moved = true
    const nx = snap(drag.origin.x - dsx / view.scale, snapStep)
    const nz = snap(drag.origin.z + dsy / view.scale, snapStep)
    dragOffset = { ids: drag.ids, dx: nx - drag.origin.x, dz: nz - drag.origin.z }
    render()
  })
  const pointerEnd = (e: PointerEvent): void => {
    const id = e.pointerId ?? 1
    pointers.delete(id)
    if (pinch) {
      if (pointers.size < 2) pinch = null
      return
    }
    const g = drag
    if (!g || g.pointer !== id) return
    drag = null
    if (g.kind === 'pan') {
      if (!g.moved && !held) {
        selection = []
        cableSel = null
        render()
      }
      return
    }
    if (g.moved) {
      const off = dragOffset
      dragOffset = null
      if (off && (off.dx !== 0 || off.dz !== 0)) moveBy(off.ids, off.dx, off.dz)
      else render()
      return
    }
    // a click on a device: with a cable held it flips; a second click on the selected device flips; else it is selected
    if (held || (g.wasSole && !g.additive)) return flip(g.id)
    if (selection.length > 1) say(fill(P().selectedN!, { n: String(selection.length) }))
    else if (selection.length === 1) say(fill(P().selected!, { device: nameOf(selection[0]!) }))
  }
  svg.addEventListener('pointerup', pointerEnd)
  svg.addEventListener('pointercancel', (e: PointerEvent) => {
    pointers.delete(e.pointerId ?? 1)
    pinch = null
    drag = null
    dragOffset = null
    render()
  })
  svg.addEventListener('dblclick', (e) => {
    const devEl = (e.target as Element).closest?.('[data-dev]')
    if (devEl && !rearDev) flip(devEl.getAttribute('data-dev')!)
  })
  svg.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      e.preventDefault()
      const p = local(e)
      view = zoomAt(view, Math.exp(-e.deltaY * 0.0015), p.x, p.y)
      render()
    },
    { passive: false },
  )
  const selectCable = (id: string): void => {
    cableSel = id
    selection = []
    render()
    ;(svg.querySelector<SVGElement>(`[data-cable="${cssEsc(id)}"]`) ?? svg).focus()
    const t = cableText(id)
    if (t) say(fill(P().cableSelected!, { type: typeName(t.type), a: t.a, b: t.b }))
  }

  // ── keyboard (inside the page only: the 3D view's keys never fire in a dialog)
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    const t = e.target as HTMLElement
    const consume = (): void => {
      e.preventDefault()
      e.stopPropagation()
    }
    if (e.key === 'Escape') {
      if (rearDev) {
        if (held) dropCable()
        else closeRear()
        return consume()
      }
      if (held) {
        dropCable()
        return consume()
      }
      if (selection.length || cableSel) {
        selection = []
        cableSel = null
        render()
        return consume()
      }
      return // the page closes (the modal's own Échap)
    }
    const tag = t.tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
    const ctrl = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (ctrl && !e.altKey && ((k === 'z' && e.shiftKey) || k === 'y')) {
      redo()
      return consume()
    }
    if (ctrl && !e.altKey && k === 'z') {
      undo()
      return consume()
    }
    if (rearDev || !svg.contains(t)) return
    if (e.repeat && (k === 'delete' || k === 'backspace' || k === 'd' || k === 'r')) return consume()
    const devAttr = t.closest?.('[data-dev]')?.getAttribute('data-dev') ?? null
    const cabAttr = t.closest?.('[data-cable]')?.getAttribute('data-cable') ?? null
    const targets = devAttr ? (selection.includes(devAttr) ? [...selection] : [devAttr]) : [...selection]
    const step = snapStep
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        // screen left is world +x (the plan is read from the audience); screen down is +z
        const dx = e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0
        const dz = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        if (targets.length) moveBy(targets, dx, dz)
        else {
          // nothing to move: the arrows pan the drawing (the view travels the way the arrow points)
          const px = e.key === 'ArrowLeft' ? 40 : e.key === 'ArrowRight' ? -40 : 0
          const py = e.key === 'ArrowUp' ? 40 : e.key === 'ArrowDown' ? -40 : 0
          view = panBy(view, px, py)
          render()
        }
        return consume()
      }
      case 'r':
      case 'R':
        if (ctrl || e.altKey) return
        rotate(targets, e.shiftKey ? 15 : 90)
        return consume()
      case 'Delete':
      case 'Backspace':
        if (cabAttr || cableSel) disconnect(cabAttr ?? cableSel!)
        else remove(targets)
        return consume()
      case 'Enter':
        if (devAttr) flip(devAttr)
        else if (cabAttr) selectCable(cabAttr)
        return consume()
      case ' ':
        if (devAttr) {
          selection = e.shiftKey || ctrl ? selectToggle(selection, devAttr, true) : [devAttr]
          cableSel = null
          render()
          say(selection.length > 1 ? fill(P().selectedN!, { n: String(selection.length) }) : fill(P().selected!, { device: nameOf(devAttr) }))
        } else if (cabAttr) selectCable(cabAttr)
        return consume()
      case '+':
      case '=':
        zoomBy(1.25)
        return consume()
      case '-':
        zoomBy(0.8)
        return consume()
      default:
        break
    }
    if (ctrl && k === 'd') {
      duplicate(targets)
      return consume()
    }
    if (ctrl && k === 'a') {
      selection = history.plan.devices.map((x) => x.id)
      cableSel = null
      render()
      say(fill(P().selectedN!, { n: String(selection.length) }))
      return consume()
    }
  })

  // ── the modal layer
  const closed = openModal<void>({
    id: PLAN2D_TESTID,
    title: fill(P().title!, { room: room.name }),
    body: P().intro!,
    cancel: undefined,
    ...(d.parent ? { parent: d.parent } : {}),
    build(b, done) {
      b.classList.add('p2d-page')
      b.append(root)
      pageBox = b
      finish = () => done(undefined)
      const focusables = (): HTMLElement[] =>
        [...b.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.dataset.sentinel === undefined && !x.closest('[hidden]') && !x.closest('[inert]'))
      return {
        first: palette.search,
        edges: () => {
          const all = focusables()
          return [all[0] ?? closeBtn, all[all.length - 1] ?? closeBtn]
        },
      }
    },
  })
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => render()) : null
  resize?.observe(stage)
  render()
  if (loaded.dropped) say(P().dropped!)
  const done = closed.then(() => {
    resize?.disconnect()
    finish = null
  })
  return {
    closed: done,
    close: () => finish?.(),
    history,
    root,
  }
}

/** CSS.escape where it exists (the ids are kebab-case slugs anyway). */
const cssEsc = (s: string): string => (typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&'))
