/**
 * Teacher page (Task 15): reads an exported .essai.json and shows the trail.
 * DOM only: NO Babylon import (this chunk stays small), no network, no storage,
 * nothing saved (rubric ticks included). Every node is built with textContent,
 * never innerHTML: the file is untrusted input.
 */
import { injectTokens } from '../design/tokens'
import { importTrails } from '../trials/export'
import {
  failureMessage,
  isQuarantineFile,
  rejectedNotice,
  TEACHER_COPY as C,
  trailCards,
  type MapGeometry,
  type RoomInfo,
  type TrialCard,
} from './teacherModel'
import roomIndexJson from '../../content/rooms/index.json'

// Typical room dimensions (only `dimensions_m` is kept from each room JSON). Eager on purpose: a dynamic
// import would pull Vite's preload helper, which lives in the Babylon chunk.
type Dims = { width?: { typical?: number }; length?: { typical?: number } }
const roomDims = import.meta.glob<Dims>(['../../content/rooms/*.json', '!../../content/rooms/index.json'], { eager: true, import: 'dimensions_m' })
const roomNames = new Map((roomIndexJson as { rooms: { id: string; name_fr: string }[] }).rooms.map((r) => [r.id, r.name_fr]))

function roomInfo(id: string): RoomInfo {
  const dims = roomDims[`../../content/rooms/${id}.json`]
  return { name: roomNames.get(id) ?? id, width: dims?.width?.typical, length: dims?.length?.typical }
}
type Child = Node | string
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  for (const k of kids) e.append(k)
  return e
}
const SVG = 'http://www.w3.org/2000/svg'
function svg(tag: string, attrs: Record<string, string | number> = {}, ...kids: Child[]): SVGElement {
  const e = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  for (const k of kids) e.append(k)
  return e
}

function mapSvg(g: MapGeometry, titleId: string): SVGElement {
  const root = svg('svg', { class: 'map', viewBox: g.viewBox, role: 'img', 'aria-labelledby': titleId, 'aria-label': g.title })
  root.append(svg('title', { id: titleId }, g.title))
  if (g.room) root.append(svg('rect', { class: 'room', x: g.room.x, y: g.room.y, width: g.room.w, height: g.room.h }))
  for (const d of g.dots) {
    const grp = svg('g')
    grp.append(svg('circle', { class: 'dot', cx: d.x, cy: d.y, r: 0.12 }), svg('text', { class: 'lbl', x: d.x + 0.18, y: d.y + 0.07 }, d.label))
    root.append(grp)
  }
  return root
}

function list(items: HTMLElement[], empty: string): HTMLElement {
  return items.length ? el('ul', {}, ...items) : el('p', { class: 'meta' }, empty)
}

function cardEl(c: TrialCard): HTMLElement {
  const headId = `h-${c.id}`
  const dl = el('dl', { class: 'fields' })
  const field = (label: string, ...body: Child[]): void => {
    dl.append(el('dt', {}, label), el('dd', {}, ...body))
  }
  field(C.prediction, `${c.prediction.text} `, el('span', { class: 'meta' }, `(écrite à ${c.prediction.time})`))
  field(
    'Changements depuis le parent',
    c.parentName === null ? C.noParent : list(c.changes.map((x) => el('li', {}, x)), C.noChange),
  )
  const rulesBody: Child[] = [
    list(
      c.rules.map((r) => el('li', {}, el('code', {}, r.ruleId), ' ', el('span', { class: `pill ${r.severity}` }, r.severityLabel))),
      C.noRules,
    ),
  ]
  if (c.fixed && c.fixed.length) rulesBody.push(el('p', { class: 'good' }, 'Corrigées depuis le parent : ', ...c.fixed.map((x, i) => el('code', {}, i ? `, ${x}` : x))))
  if (c.broken && c.broken.length) rulesBody.push(el('p', { class: 'bad' }, 'Nouvelles depuis le parent : ', ...c.broken.map((x, i) => el('code', {}, i ? `, ${x}` : x))))
  field(C.rules, ...rulesBody)
  if (c.levelState) field(C.levelState, c.levelState)
  const noteBody: Child[] = [c.note ? el('p', {}, c.note) : el('p', { class: 'meta' }, C.noNote)]
  if (c.amendments.length) noteBody.push(el('ul', {}, ...c.amendments.map((a) => el('li', {}, `${a.text} `, el('span', { class: 'meta' }, `(à ${a.time})`)))))
  field(C.note, ...noteBody)

  const mapTitleId = `m-${c.id}`
  return el(
    'li',
    { class: 'card', 'aria-labelledby': headId },
    el(
      'header',
      {},
      el('h3', { id: headId }, c.label),
      el('span', { class: 'meta' }, `figé à ${c.time}`),
      el('span', { class: 'meta' }, c.parentName ? `parent : Essai ${c.parentName}` : C.noParent),
      el('span', { class: 'meta' }, c.roomName),
    ),
    el('div', { class: 'grid' }, dl, el('div', {}, el('p', { class: 'meta' }, C.map), mapSvg(c.map, mapTitleId))),
  )
}

function rubricEl(): HTMLElement {
  const items = C.rubric.map((text, i) => el('li', {}, el('label', {}, el('input', { type: 'checkbox', id: `rub-${i + 1}` }), el('span', {}, text))))
  return el(
    'section',
    { class: 'block', 'aria-labelledby': 'rubric-h' },
    el('h2', { id: 'rubric-h' }, C.rubricTitle),
    el('p', { class: 'draft' }, C.rubricDraft),
    el('ul', { class: 'rubric' }, ...items),
  )
}

function init(): void {
  injectTokens()
  const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
  $('title').textContent = C.title
  $('subtitle').textContent = C.subtitle
  $('dropText').textContent = C.drop
  $('chooseText').textContent = C.choose
  const status = $('status')
  const result = $('result')
  const drop = $('drop')
  const input = $<HTMLInputElement>('file')

  const say = (text: string, kind: 'info' | 'error' | 'warn' = 'info'): void => {
    status.replaceChildren(el('p', { class: `msg ${kind}` }, text))
  }
  say(C.empty)

  async function open(file: File): Promise<void> {
    result.replaceChildren()
    let text: string
    try {
      text = await file.text()
    } catch {
      say(C.errorRead, 'error')
      return
    }
    try {
      if (isQuarantineFile(text)) return say(failureMessage('quarantine'), 'error')
      const r = await importTrails(text)
      if (!r.ok) return say(failureMessage(r.reason), 'error')
      if (r.trials.length === 0) return say(rejectedNotice(r.rejected) ?? C.noTrials, r.rejected ? 'warn' : 'info')
      const cards = trailCards(r.trials, roomInfo)
      const notice = rejectedNotice(r.rejected)
      if (notice) say(notice, 'warn')
      else status.replaceChildren()
      const printBtn = el('button', { type: 'button', id: 'print', class: 'quiet' }, C.print)
      printBtn.addEventListener('click', () => window.print())
      result.append(
        el(
          'section',
          { class: 'block', 'aria-labelledby': 'trail-h' },
          el('h2', { id: 'trail-h' }, `${C.trail} (${cards.length})`),
          el('ol', { class: 'trail', 'aria-label': C.trail }, ...cards.map(cardEl)),
        ),
        rubricEl(),
        el('p', { class: 'block', style: 'margin-top: var(--tk-space-lg, 20px)' }, printBtn),
      )
    } catch {
      result.replaceChildren()
      say(C.errorRead, 'error')
    }
  }

  input.addEventListener('change', () => {
    const f = input.files?.[0]
    if (f) void open(f)
    input.value = '' // the same file can be chosen again
  })
  drop.addEventListener('dragover', (e) => {
    e.preventDefault()
    drop.classList.add('over')
  })
  drop.addEventListener('dragleave', () => drop.classList.remove('over'))
  drop.addEventListener('drop', (e) => {
    e.preventDefault()
    drop.classList.remove('over')
    const f = e.dataTransfer?.files?.[0]
    if (f) void open(f)
  })
  // A file dropped beside the zone must not navigate away from the page.
  window.addEventListener('dragover', (e) => e.preventDefault())
  window.addEventListener('drop', (e) => e.preventDefault())
  // Persistent disclaimer (teacher.disclaimer).
  document.getElementById('app')!.append(el('footer', { class: 'disclaimer', role: 'note' }, C.disclaimer))
}

init()
