// @vitest-environment jsdom
/**
 * The 2D schema page in a DOM (src/plan2d/view.ts): a modal layer labelled by its title, a blank plan, the palette, place by click, select, the
 * keyboard path (arrows, R, Suppr, Ctrl+D, Ctrl+Z / Ctrl+Y, Entrée), the flip to the rear panel holding a cable with lit and dimmed ports (and
 * the rule's reason), the cable drawn in its type's colour with an arrow and a tag, the legend and the « Légende et sources » panel, Échap in
 * its three steps, persistence under its own key and reopening. The real browser path is tests/e2e/plan2d.spec.ts.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { floorPlanSvg } from '../../src/creation/roomPlanSvg'
import { openPlan2dPage, type Plan2dPage } from '../../src/plan2d/view'
import { planKey } from '../../src/plan2d/persist'
import { fitView } from '../../src/plan2d/geometry'

const registry = loadCatalog(catalogJson)

function memory(): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

const room = { key: 'blank', name: 'Salle vide neutre', width: 24, length: 14, outline: floorPlanSvg(24, 14) }
let storage: ReturnType<typeof memory>
let page: Plan2dPage | null = null
const open = (reduced = true): Plan2dPage => (page = openPlan2dPage({ doc: document, registry, room, storage, projectName: null, reducedMotion: () => reduced }))
const q = <T extends Element = HTMLElement>(sel: string): T | null => document.querySelector<T>(sel)
const qa = (sel: string): Element[] => [...document.querySelectorAll(sel)]
const live = (): string => q('[data-testid="plan2d-live"]')!.textContent ?? ''
const key = (target: Element, k: string, mods: Partial<KeyboardEventInit> = {}): void =>
  void target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods }))
const dev = (id: string): SVGGElement => q<SVGGElement>(`[data-dev="${id}"]`)!
const pick = (deviceId: string): void => (q<HTMLButtonElement>(`.p2d-palette-item[data-device="${deviceId}"]`)!).click()

beforeEach(() => {
  document.body.innerHTML = '<div id="app"><button id="behind">3D</button></div>'
  storage = memory()
})
afterEach(() => {
  page?.close()
  page = null
})

describe('the page is a modal layer over the 3D view', () => {
  it('role dialog, aria-modal, labelled by its title with the place name; what is behind is inert; focus starts in the palette search', () => {
    open()
    const box = q('[data-testid="plan2d"]')!
    expect(box.getAttribute('role')).toBe('dialog')
    expect(box.getAttribute('aria-modal')).toBe('true')
    expect(q(`#${box.getAttribute('aria-labelledby')}`)!.textContent).toBe('Schéma 2D : Salle vide neutre')
    expect((q('#app') as HTMLElement).inert).toBe(true)
    expect(document.activeElement).toBe(q('.p2d-search'))
    expect(q('[data-testid="plan2d-plan"]')!.getAttribute('aria-label')).toBe('Plan de Salle vide neutre')
  })

  it('opens blank: no device, the empty line, the room outline, the scale bar and the four orientation labels', () => {
    open()
    expect(qa('[data-dev]')).toHaveLength(0)
    expect(q<HTMLElement>('.p2d-empty-plan')!.hidden).toBe(false)
    expect(q('.p2d-room [data-walls]')).not.toBeNull()
    expect(q('.p2d-scalebar text')!.textContent).toMatch(/m$/)
    expect(qa('.p2d-orient text').map((t) => t.textContent)).toEqual(['Salle vide neutre', 'Côté scène', 'Public', 'Jardin', 'Cour'])
  })

  it('the palette lists the whole catalogue with the inventory’s names, and its search narrows it', () => {
    open()
    expect(qa('.p2d-palette-item')).toHaveLength(registry.catalog.devices.length)
    const search = q<HTMLInputElement>('.p2d-search')!
    search.value = 'k12'
    search.dispatchEvent(new Event('input'))
    expect(qa('.p2d-palette-item').map((b) => b.getAttribute('data-device'))).toEqual(['qsc-k12-2'])
    expect(q('.p2d-palette-item')!.getAttribute('aria-label')).toBe('Poser QSC K12.2 sur le plan')
  })

  it('the legend shows every cable type with its line, and « Légende et sources » opens the levels of proof of the sheet', () => {
    open()
    expect(qa('.p2d-legend-item')).toHaveLength(9)
    const sources = q<HTMLElement>('[data-testid="plan2d-sources"]')!
    expect(sources.hidden).toBe(true)
    q<HTMLButtonElement>('[data-testid="plan2d-sources-toggle"]')!.click()
    expect(sources.hidden).toBe(false)
    const tags = new Set(qa('.p2d-source-tag').map((t) => t.getAttribute('data-tag')))
    expect([...tags].sort()).toEqual(['OUR PROPOSAL', 'STANDARD', 'TRADE PRACTICE'])
    expect(sources.textContent).toMatch(/^Légende et sourcesConventions courantes/)
  })
})

describe('placing and editing (one undo step each)', () => {
  it('a palette click places the symbol at the centre, snapped, selected, and says where', () => {
    open()
    pick('qsc-k12-2')
    expect(qa('[data-dev]')).toHaveLength(1)
    expect(dev('qsc-k12-2-1').getAttribute('aria-pressed')).toBe('true')
    expect(dev('qsc-k12-2-1').getAttribute('data-family')).toBe('speaker')
    expect(live()).toBe('QSC K12.2 posé à x 0 m, z 0 m.')
    pick('qsc-k12-2')
    // the second one beside it, one symbol plus its label apart (>= 64 px on screen at the fitted scale), never on the same spot
    const [a, b] = page!.history.plan.devices
    expect([a!.x, a!.z]).toEqual([0, 0])
    expect(b!.z).toBe(0)
    expect(b!.x).toBeLessThan(0)
    expect(Math.abs(b!.x) * 4 % 1).toBe(0) // on the 25 cm grid
    const scale = fitView({ width: 24, length: 14 }, 800, 520).scale
    expect(Math.abs(b!.x) * scale).toBeGreaterThanOrEqual(60)
    pick('qsc-k12-2')
    expect(page!.history.plan.devices[2]!.x).toBeGreaterThan(0) // the next free slot, on the other side
  })

  it('keyboard: arrows move by the grid step (left = world +x, seen from the audience), R turns 90, Maj+R 15, Ctrl+D duplicates, Suppr removes, Ctrl+Z / Ctrl+Y', () => {
    open()
    pick('qsc-k12-2')
    const g = dev('qsc-k12-2-1')
    g.focus()
    key(g, 'ArrowLeft')
    key(dev('qsc-k12-2-1'), 'ArrowDown')
    expect(page!.history.plan.devices[0]).toMatchObject({ x: 0.25, z: 0.25 })
    key(dev('qsc-k12-2-1'), 'r')
    key(dev('qsc-k12-2-1'), 'R', { shiftKey: true })
    expect(page!.history.plan.devices[0]!.rot).toBe(105)
    key(dev('qsc-k12-2-1'), 'd', { ctrlKey: true })
    expect(page!.history.plan.devices.map((d) => d.id)).toEqual(['qsc-k12-2-1', 'qsc-k12-2-2'])
    key(dev('qsc-k12-2-2'), 'Delete')
    expect(page!.history.plan.devices.map((d) => d.id)).toEqual(['qsc-k12-2-1'])
    key(dev('qsc-k12-2-1'), 'z', { ctrlKey: true })
    expect(page!.history.plan.devices).toHaveLength(2)
    expect(live()).toBe('Annulé : Supprimer')
    key(dev('qsc-k12-2-1'), 'y', { ctrlKey: true })
    expect(page!.history.plan.devices).toHaveLength(1)
  })

  it('a held key repeats no delete; Ctrl+A selects everything', () => {
    open()
    pick('qsc-k12-2')
    pick('shure-sm58')
    const svg = q<SVGElement>('[data-testid="plan2d-plan"]')!
    svg.focus()
    key(svg, 'a', { ctrlKey: true })
    expect(qa('[data-dev][aria-pressed="true"]')).toHaveLength(2)
    key(svg, 'Delete', { repeat: true })
    expect(page!.history.plan.devices).toHaveLength(2)
  })
})

describe('the cable flow: flip to the rear panel while holding a cable', () => {
  const lineOut = registry.deviceById.get('midas-m32')!.ports.find((p) => p.dir === 'out' && p.connector === 'xlr3-m' && p.signal === 'line-level-pro')!.portId

  it('Entrée flips a device to its real ports; a free port starts the cable; back on the plan the devices are lit or dimmed; the other device’s rear panel lights its compatible ports and dims the others with the rule’s reason; a lit port ends the cable', () => {
    open(false)
    pick('midas-m32')
    pick('qsc-k12-2')
    pick('shure-sm58')
    key(dev('midas-m32-1'), 'Enter')
    const rear = q('[data-testid="plan2d-rear"]')!
    expect(rear.classList.contains('p2d-flip-in'), 'the flip animates when motion is allowed').toBe(true)
    expect(rear.querySelector('.p2d-rear-title')!.textContent).toBe('Panneau arrière : M32 (midas-m32-1)')
    expect(rear.querySelector('.p2d-rear-note')!.textContent).toMatch(/^Disposition simplifiée/)
    expect(qa('.p2d-port')).toHaveLength(registry.deviceById.get('midas-m32')!.ports.length)
    expect(q<SVGElement>('[data-testid="plan2d-plan"]')!.hasAttribute('inert')).toBe(true)
    q<HTMLButtonElement>(`.p2d-port[data-port="${lineOut}"]`)!.click()
    expect(q<HTMLElement>('.p2d-rear')!.hidden).toBe(true)
    expect(live()).toMatch(/^Câble tenu depuis M32 \(midas-m32-1\) · /)
    expect(document.activeElement).toBe(dev('midas-m32-1'))
    expect(dev('qsc-k12-2-1').classList.contains('p2d-lit')).toBe(true)
    expect(dev('shure-sm58-1').classList.contains('p2d-dim'), 'a microphone has no input for a line out').toBe(true)
    key(dev('qsc-k12-2-1'), 'Enter')
    expect(live()).toMatch(/^Prises compatibles : 1 sur 3\./)
    const litPort = q<HTMLButtonElement>('.p2d-port[data-port="in-line-a"]')!
    const dimPort = q<HTMLButtonElement>('.p2d-port[data-port="power-in"]')!
    expect(litPort.dataset.state).toBe('lit')
    expect(dimPort.dataset.state).toBe('dim')
    expect(dimPort.getAttribute('aria-disabled')).toBe('true')
    expect(document.getElementById(dimPort.getAttribute('aria-describedby')!)!.textContent!.length).toBeGreaterThan(0)
    dimPort.click()
    expect(live()).toMatch(/^Impossible ici : /)
    expect(page!.history.plan.cables).toHaveLength(0)
    litPort.click()
    expect(page!.history.plan.cables).toEqual([{ id: 'c1', a: { dev: 'midas-m32-1', port: lineOut }, b: { dev: 'qsc-k12-2-1', port: 'in-line-a' }, type: 'analog-bal' }])
    expect(live()).toBe(`Câble posé : M32 (midas-m32-1) · ${lineOut} vers K12.2 (qsc-k12-2-1) · in-line-a.`)
    // the general view: the line in the type's colour, an arrow toward the input, a tag
    const cable = q('[data-cable="c1"]')!
    const line = cable.querySelector('.p2d-cable-line')!
    expect(line.getAttribute('stroke')).toBe('#2B7BC2')
    expect(line.getAttribute('marker-end')).toBe('url(#p2d-arrow-analog-bal)')
    expect(line.hasAttribute('marker-start')).toBe(false)
    expect(cable.querySelector('.p2d-tag')!.textContent).toBe('sym.')
    expect(cable.getAttribute('aria-label')).toBe(`Câble analogique symétrique : M32 (midas-m32-1) · ${lineOut} vers K12.2 (qsc-k12-2-1) · in-line-a`)
    // selecting the cable says what it joins; Suppr removes it (one undo step)
    key(cable, 'Enter')
    expect(live()).toMatch(/Suppr le retire\.$/)
    key(q('[data-cable="c1"]')!, 'Delete')
    expect(page!.history.plan.cables).toHaveLength(0)
    key(q('[data-testid="plan2d-plan"]')!, 'z', { ctrlKey: true })
    expect(page!.history.plan.cables).toHaveLength(1)
  })

  it('reduced motion: the flip is a cut (no animation class)', () => {
    open(true)
    pick('qsc-k12-2')
    key(dev('qsc-k12-2-1'), 'Enter')
    expect(q('[data-testid="plan2d-rear"]')!.classList.contains('p2d-flip-in')).toBe(false)
  })

  it('Échap: first leaves the rear panel (dropping a held cable), then clears the selection, then closes the page', async () => {
    open()
    pick('midas-m32')
    pick('qsc-k12-2')
    key(dev('midas-m32-1'), 'Enter')
    q<HTMLButtonElement>(`.p2d-port[data-port="${lineOut}"]`)!.click()
    key(dev('qsc-k12-2-1'), 'Enter')
    key(document.activeElement!, 'Escape')
    expect(q<HTMLElement>('.p2d-rear')!.hidden).toBe(true)
    expect(live()).toBe('Câble lâché.')
    expect(q('.p2d')!.getAttribute('data-holding')).toBe('false')
    key(document.activeElement!, 'Escape') // the selection
    expect(qa('[data-dev][aria-pressed="true"]')).toHaveLength(0)
    expect(q('[data-testid="plan2d"]')).not.toBeNull()
    key(document.activeElement!, 'Escape')
    await page!.closed
    expect(q('[data-testid="plan2d"]')).toBeNull()
    expect((q('#app') as HTMLElement).inert, 'restored as it was (jsdom has no inert of its own)').not.toBe(true)
    page = null
  })
})

describe('the plan is kept under its own key, never in the 3D design', () => {
  it('every change is saved; closing and reopening shows the same plan', async () => {
    open()
    pick('qsc-k12-2')
    expect(JSON.parse(storage.data.get(planKey(null, 'blank'))!)).toMatchObject({ v: 1, roomId: 'blank', devices: [{ id: 'qsc-k12-2-1' }] })
    expect([...storage.data.keys()]).toEqual(['audio-sim/plan2d.v1.@blank'])
    q<HTMLButtonElement>('[data-testid="plan2d-close"]')!.click()
    await page!.closed
    open()
    expect(qa('[data-dev]').map((g) => g.getAttribute('data-dev'))).toEqual(['qsc-k12-2-1'])
  })

  it('an unreadable record is dropped and said', () => {
    storage.data.set(planKey(null, 'blank'), '{broken')
    open()
    expect(live()).toBe('Le schéma enregistré était illisible : il a été retiré.')
    expect(storage.data.has(planKey(null, 'blank'))).toBe(false)
  })
})

describe('review 2026-11-15: touch has every action on screen; a pinch is never a pick', () => {
  const ptr = (target: Element, type: string, id: number, x = 10, y = 10): void => {
    const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
    Object.defineProperty(ev, 'pointerId', { value: id })
    target.dispatchEvent(ev)
  }
  const act = (name: string): HTMLButtonElement | undefined =>
    [...document.querySelectorAll<HTMLButtonElement>('[data-testid="plan2d-actions"] button')].find((b) => b.textContent === name)

  it('a selected device offers its rear panel, a 90° turn, a duplicate and a removal as buttons; a selected cable offers its removal; a held cable offers to drop it', () => {
    open()
    pick('qsc-k12-2')
    const bar = q('[data-testid="plan2d-actions"]')!
    expect(bar.hidden).toBe(false)
    expect([...bar.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Panneau arrière', 'Pivoter de 90°', 'Dupliquer', 'Supprimer'])
    act('Pivoter de 90°')!.click()
    expect(page!.history.plan.devices[0]!.rot).toBe(90)
    act('Dupliquer')!.click()
    expect(page!.history.plan.devices).toHaveLength(2)
    act('Supprimer')!.click()
    expect(page!.history.plan.devices).toHaveLength(1)
    // the removed copy was the selection: nothing selected, no bar
    expect(bar.hidden).toBe(true)
    // the rear panel by its button; a free port holds a cable; the plan then offers « Lâcher le câble »
    dev('qsc-k12-2-1').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    ;(q<HTMLButtonElement>('[data-port="thru-out-a"]')!).click()
    expect([...bar.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Lâcher le câble'])
    act('Lâcher le câble')!.click()
    expect(live()).toBe('Câble lâché.')
    expect(bar.hidden).toBe(true)
  })

  it('a two-finger pinch that starts on a device keeps the selection it found', () => {
    open()
    pick('qsc-k12-2')
    pick('shure-sm58')
    expect(dev('shure-sm58-1').getAttribute('aria-pressed')).toBe('true')
    const svg = q('[data-testid="plan2d-plan"]')!
    // the first finger on the OTHER device, the second finger anywhere: a pinch
    ptr(dev('qsc-k12-2-1').querySelector('.p2d-hit')!, 'pointerdown', 7, 100, 100)
    ptr(svg, 'pointerdown', 8, 200, 100)
    ptr(svg, 'pointermove', 8, 260, 100)
    ptr(svg, 'pointerup', 7)
    ptr(svg, 'pointerup', 8)
    expect(dev('shure-sm58-1').getAttribute('aria-pressed')).toBe('true')
    expect(dev('qsc-k12-2-1').getAttribute('aria-pressed')).toBe('false')
  })
})

describe('a device outside the room (mission 3 fixes, item 1): a cue on the plan, never a clamp', () => {
  // the room is 24 m x 14 m (x in [-12, 12], z in [-7, 7]); a K12.2 is 0.356 m x 0.350 m, an M32 0.891 m x 0.612 m
  const ptr = (target: Element, type: string, id: number, x = 10, y = 10): void => {
    const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
    Object.defineProperty(ev, 'pointerId', { value: id })
    target.dispatchEvent(ev)
  }
  const outside = (id: string): boolean => dev(id).classList.contains('p2d-outside')
  const tagOf = (id: string): string | null => dev(id).querySelector('.p2d-out-label')?.textContent ?? null
  const setPose = (id: string, x: number, z: number, rot?: number): void =>
    void page!.history.do({ type: 'setPose', id, x, z, ...(rot === undefined ? {} : { rot }) }, 'test')

  it('inside: no cue at all', () => {
    open()
    pick('qsc-k12-2')
    expect(outside('qsc-k12-2-1')).toBe(false)
    expect(tagOf('qsc-k12-2-1')).toBeNull()
    expect(dev('qsc-k12-2-1').querySelector('.p2d-out-edge')).toBeNull()
    expect(dev('qsc-k12-2-1').getAttribute('aria-label')).not.toContain('hors de la salle')
  })

  it('keyboard: one arrow step past the wall gives the red hatched outline, the words « hors de la salle » and their announcement; one step back clears all of it', () => {
    open()
    pick('qsc-k12-2')
    setPose('qsc-k12-2-1', 11.75, 0)
    expect(outside('qsc-k12-2-1')).toBe(false)
    dev('qsc-k12-2-1').focus()
    key(dev('qsc-k12-2-1'), 'ArrowLeft') // screen left = world +x: x 12, the footprint reaches 12.178
    expect(page!.history.plan.devices[0]).toMatchObject({ x: 12, z: 0 }) // the device stays where it was put: no clamp, no refusal
    expect(outside('qsc-k12-2-1')).toBe(true)
    expect(tagOf('qsc-k12-2-1')).toBe('hors de la salle')
    const g = dev('qsc-k12-2-1')
    expect(g.querySelector('.p2d-out-edge'), 'a red edge round the footprint').not.toBeNull()
    expect(g.querySelector('.p2d-out-hatch')?.getAttribute('fill')).toBe('url(#p2d-out-hatch)')
    expect(q('#p2d-out-hatch'), 'the hatch pattern is defined').not.toBeNull()
    expect(g.getAttribute('aria-label')).toMatch(/, hors de la salle$/)
    expect(live()).toBe('Appareils déplacés : 1. K12.2 (qsc-k12-2-1) : hors de la salle.')
    key(dev('qsc-k12-2-1'), 'ArrowRight')
    expect(outside('qsc-k12-2-1')).toBe(false)
    expect(tagOf('qsc-k12-2-1')).toBeNull()
    expect(dev('qsc-k12-2-1').getAttribute('aria-label')).not.toContain('hors de la salle')
    expect(live()).toBe('Appareils déplacés : 1. K12.2 (qsc-k12-2-1) : de nouveau dans la salle.')
    // a move that keeps it inside says nothing about the room
    key(dev('qsc-k12-2-1'), 'ArrowRight')
    expect(live()).toBe('Appareils déplacés : 1.')
  })

  it('pointer (mouse or a finger): the cue shows WHILE the device is dragged past the wall, before anything is committed, and clears when it is dragged back', () => {
    open()
    pick('qsc-k12-2')
    setPose('qsc-k12-2-1', 11.5, 0)
    const scale = fitView({ width: 24, length: 14 }, 800, 520).scale
    const hit = dev('qsc-k12-2-1').querySelector('.p2d-hit')!
    const svg = q('[data-testid="plan2d-plan"]')!
    ptr(hit, 'pointerdown', 3, 400, 260)
    ptr(svg, 'pointermove', 3, 400 - 1 * scale, 260) // 1 m to the screen's left = +x: x 12.5
    expect(page!.history.plan.devices[0]!.x, 'nothing committed yet').toBe(11.5)
    expect(outside('qsc-k12-2-1')).toBe(true)
    expect(tagOf('qsc-k12-2-1')).toBe('hors de la salle')
    ptr(svg, 'pointermove', 3, 400, 260) // back where it was
    expect(outside('qsc-k12-2-1')).toBe(false)
    ptr(svg, 'pointermove', 3, 400 - 1 * scale, 260)
    ptr(svg, 'pointerup', 3)
    expect(page!.history.plan.devices[0]!.x, 'dropped past the wall, it stays there').toBe(12.5)
    expect(outside('qsc-k12-2-1')).toBe(true)
    expect(live()).toBe('Appareils déplacés : 1. K12.2 (qsc-k12-2-1) : hors de la salle.')
    // undo brings it back inside, and says so
    key(q('[data-testid="plan2d-plan"]')!, 'z', { ctrlKey: true })
    expect(outside('qsc-k12-2-1')).toBe(false)
    expect(live()).toBe('Annulé : Déplacer. K12.2 (qsc-k12-2-1) : de nouveau dans la salle.')
  })

  it('a rotation can take a device out: an M32 that fits square-on near the rear wall reaches past it once turned 90°', () => {
    open()
    pick('midas-m32')
    setPose('midas-m32-1', 0, 6.6)
    expect(outside('midas-m32-1')).toBe(false)
    key(dev('midas-m32-1'), 'r')
    expect(page!.history.plan.devices[0]).toMatchObject({ x: 0, z: 6.6, rot: 90 })
    expect(outside('midas-m32-1')).toBe(true)
    expect(live()).toBe('Appareils pivotés : 1. M32 (midas-m32-1) : hors de la salle.')
    key(dev('midas-m32-1'), 'r')
    expect(outside('midas-m32-1')).toBe(false)
    expect(live()).toBe('Appareils pivotés : 1. M32 (midas-m32-1) : de nouveau dans la salle.')
  })
})