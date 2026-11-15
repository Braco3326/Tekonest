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
    expect(page!.history.plan.devices.map((d) => [d.x, d.z])).toEqual([[0, 0], [-0.5, 0]])
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
