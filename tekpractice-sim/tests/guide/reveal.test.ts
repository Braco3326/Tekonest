// G14c fix (a): the ringed Propriétés button is brought into view inside its scroll box, once per target (src/guide/reveal.ts), and the tutorial's
// resolver asks for it on the rows it rings (src/guide/tutorial.ts deviceThenRow and the playback row).
import { describe, expect, it } from 'vitest'
import { createRevealer, createRowRevealer, rowBoxOf, scrollBoxOf, type RevealElement, type RowElement } from '../../src/guide/reveal'
import { resolveTutorialAnchor, type AnchorEnv } from '../../src/guide/tutorial'
import { propsKeySelector } from '../../src/guide/bridge/shared'
import { makeRegistry } from '../helpers'
import type { TpState } from '../../src/guide/bridge/types'

interface Fake extends RevealElement {
  top: number
  bottom: number
  overflow: string
  scrolled: number
}
const el = (top: number, bottom: number, parent: Fake | null, o: Partial<Fake> = {}): Fake => {
  const e: Fake = {
    top,
    bottom,
    overflow: 'visible',
    scrolled: 0,
    parentElement: parent,
    getBoundingClientRect: () => ({ top: e.top, bottom: e.bottom }),
    scrollIntoView: () => {
      e.scrolled++
    },
    ...o,
  }
  return e
}
const ov = (e: RevealElement): string => (e as Fake).overflow

describe('createRevealer', () => {
  it('scrolls a button below its scroll box into view, once per key; a button in view, or one with no scroll box, is left alone', () => {
    const panel = el(100, 700, null, { overflow: 'auto', scrollHeight: 1400, clientHeight: 600 })
    const below = el(900, 932, panel)
    const shown = el(300, 332, panel)
    const doc = { querySelector: (s: string) => (s === '#below' ? below : s === '#shown' ? shown : null) }
    const reveal = createRevealer(doc, ov)
    expect(reveal('#below', 'ql1|connect:out-main-l')).toBe(true)
    expect(below.scrolled).toBe(1)
    // the same key again (the learner scrolled it away): left alone
    expect(reveal('#below', 'ql1|connect:out-main-l')).toBe(false)
    expect(below.scrolled).toBe(1)
    // another target is a new key
    expect(reveal('#below', 'ql1|connect:power-in')).toBe(true)
    expect(reveal('#shown', 'k|connect:power-in')).toBe(false)
    expect(shown.scrolled).toBe(0)
    expect(reveal('#missing', 'x')).toBe(false)
  })

  it('a folded panel (no scroll box) is asked again later: nothing is remembered until the box scrolls', () => {
    const panel = el(100, 700, null, { overflow: 'hidden', scrollHeight: 1400, clientHeight: 600 })
    const below = el(900, 932, panel)
    const reveal = createRevealer({ querySelector: () => below }, ov)
    expect(reveal('#b', 'k')).toBe(false)
    panel.overflow = 'auto' // unfolded
    expect(reveal('#b', 'k')).toBe(true)
    expect(below.scrolled).toBe(1)
  })

  it('scrollBoxOf takes the nearest ancestor whose content overflows a scrolling box; never throws through the revealer', () => {
    const outer = el(0, 800, null, { overflow: 'auto', scrollHeight: 2000, clientHeight: 800 })
    const inner = el(0, 400, outer, { overflow: 'auto', scrollHeight: 400, clientHeight: 400 }) // scrolls nothing
    const btn = el(500, 520, inner)
    expect(scrollBoxOf(btn, ov)).toBe(outer)
    const broken = createRevealer({ querySelector: () => { throw new Error('x') } }, ov)
    expect(broken('#a', 'a')).toBe(false)
  })
})

describe('the tutorial resolver asks for the ringed row', () => {
  const registry = makeRegistry()
  const state = (): TpState => ({
    route: 'creation',
    placeKnown: true,
    instances: [
      { id: 'q', deviceId: 'yamaha-ql1', label: 'QL1' },
      { id: 'k', deviceId: 'qsc-k12-2', label: 'K12' },
    ],
    connections: [],
    controls: { q: { 'playback-usb': false } },
    events: [],
    playbackReady: false,
    firstReason: null,
  })
  const env = (selection: string | null, asked: string[]): AnchorEnv => ({
    state: state(),
    selection,
    registry,
    firstRect: (sels) => (sels[0]?.includes('data-key') ? { x: 1200, y: 900, w: 120, h: 28 } : null),
    rectOfAnchor: () => ({ x: 400, y: 300, w: 56, h: 56 }),
    anchorOfDevice: (id) => `device:${id}`,
    anchorOfPort: (r) => `port:${r.instance}.${r.port}`,
    anchorOfControl: (i, c) => `control:${i}.${c}`,
    reveal: (sel, key) => void asked.push(`${sel} ${key}`),
  })

  it('« Connecter à… » of the console (step 4) and « Lecture console » (step 6) are revealed once the console is selected; not before', () => {
    const asked: string[] = []
    resolveTutorialAnchor('nav:connect.from.console-speaker', env(null, asked))
    resolveTutorialAnchor('control:suggest.playback', env(null, asked))
    expect(asked).toEqual([])
    resolveTutorialAnchor('nav:connect.from.console-speaker', env('q', asked))
    resolveTutorialAnchor('control:suggest.playback', env('q', asked))
    expect(asked).toEqual([`${propsKeySelector('connect:out-main-l')} q|connect:out-main-l`, `${propsKeySelector('ctl:playback-usb')} q|ctl:playback-usb`])
  })
})

describe('G14c fix (d): with the « Matériel » menu open, the inventory steps ring « Inventaire »', () => {
  const registry = makeRegistry()
  it('the menu item comes before the « Matériel » button in what the item and tab anchors look for (the drawer closed)', () => {
    const asked: string[][] = []
    const env: AnchorEnv = {
      state: null,
      selection: null,
      registry,
      firstRect: (sels) => (asked.push([...sels]), null),
      rectOfAnchor: () => null,
      anchorOfDevice: (id) => id,
      anchorOfPort: (r) => r.port,
      anchorOfControl: (i) => i,
    }
    resolveTutorialAnchor('nav:inventory.item.shure-sm58', env)
    resolveTutorialAnchor('nav:inventory.tab.micros', env)
    // the item anchor asks for its card alone first (merge fix 2026-11-14: the tab is revealed only when the card is not shown), then the fallback list
    const fallbacks = asked.filter((sels) => sels.includes('#cr-menu-materiel'))
    expect(fallbacks).toHaveLength(2)
    for (const sels of fallbacks) {
      const item = sels.indexOf('#cr-menu-materiel-panel [data-item="inventory"]')
      expect(item, sels.join(' , ')).toBeGreaterThanOrEqual(0)
      expect(item).toBe(sels.indexOf('#cr-menu-materiel') - 1)
    }
  })
})

// Merge fix 2026-11-14 (equipment build merged into the onboarding packs): eleven drawer tabs, « Secteur » past the right end of the tab row at 1366 px.
// The tutorial's step 7 rang that hidden tab (its rect under « Fermer »): a click on the ring closed the drawer, a dead end.
interface RowFake extends RowElement {
  left: number
  right: number
  overflow: string
}
const rowEl = (left: number, right: number, parent: RowFake | null, o: Partial<RowFake> = {}): RowFake => {
  const e: RowFake = { left, right, overflow: 'visible', parentElement: parent, getBoundingClientRect: () => ({ left: e.left, right: e.right }), ...o }
  return e
}
const ovx = (e: RowElement): string => (e as RowFake).overflow

describe('createRowRevealer (the drawer tab row)', () => {
  it('triggers: a tab past the right end of a sideways-scrolling row is centred in it, once per tab element', () => {
    const row = rowEl(200, 900, null, { overflow: 'auto', scrollWidth: 1300, clientWidth: 700, scrollLeft: 0 })
    const secteur = rowEl(1000, 1080, row)
    const reveal = createRowRevealer({ querySelector: () => secteur }, ovx)
    expect(reveal('#secteur')).toBe(true)
    expect(row.scrollLeft).toBe(1040 - 550) // tab centre to row centre
    // the learner scrolled the row away again (same drawer, same tab element): left alone
    row.scrollLeft = 0
    expect(reveal('#secteur')).toBe(false)
    expect(row.scrollLeft).toBe(0)
    // the drawer reopened: its tabs were rebuilt, a new element is a new target
    const again = rowEl(1000, 1080, row)
    const reveal2 = createRowRevealer({ querySelector: (s) => (s === '#new' ? again : secteur) }, ovx)
    expect(reveal2('#new')).toBe(true)
  })

  it('triggers: a tab under the edge fade (within 28 px of a side) is centred', () => {
    const row = rowEl(200, 900, null, { overflow: 'auto', scrollWidth: 1300, clientWidth: 700, scrollLeft: 100 })
    const faded = rowEl(820, 890, row)
    expect(createRowRevealer({ querySelector: () => faded }, ovx)('#f')).toBe(true)
    expect(row.scrollLeft).toBe(100 + 855 - 550)
  })

  it('does not trigger: a tab clear of both edges, a row that does not scroll, a missing tab, a throwing page', () => {
    const row = rowEl(200, 900, null, { overflow: 'auto', scrollWidth: 1300, clientWidth: 700, scrollLeft: 0 })
    const shown = rowEl(400, 480, row)
    expect(createRowRevealer({ querySelector: () => shown }, ovx)('#s')).toBe(false)
    expect(row.scrollLeft).toBe(0)
    const fits = rowEl(200, 900, null, { overflow: 'auto', scrollWidth: 700, clientWidth: 700, scrollLeft: 0 })
    const off = rowEl(1000, 1080, fits)
    expect(createRowRevealer({ querySelector: () => off }, ovx)('#o')).toBe(false)
    expect(fits.scrollLeft).toBe(0)
    expect(createRowRevealer({ querySelector: () => null }, ovx)('#m')).toBe(false)
    expect(createRowRevealer({ querySelector: () => { throw new Error('x') } }, ovx)('#t')).toBe(false)
    expect(createRowRevealer(undefined, ovx)('#u')).toBe(false)
    expect(rowBoxOf(off, ovx)).toBeNull()
  })
})

describe('merge fix 2026-11-14: the inventory anchors reveal the tab, never the card', () => {
  const registry = makeRegistry()
  const base = (cardShown: boolean, revealed: string[]): AnchorEnv => ({
    state: null,
    selection: null,
    registry,
    firstRect: (sels) => (sels[0]?.includes('inventory-item') ? (cardShown ? { x: 10, y: 600, w: 120, h: 80 } : null) : { x: 1000, y: 100, w: 80, h: 30 }),
    rectOfAnchor: () => null,
    anchorOfDevice: (id) => id,
    anchorOfPort: (r) => r.port,
    anchorOfControl: (i) => i,
    revealRow: (sel) => void revealed.push(sel),
  })

  it('triggers: the card is not shown (another tab is open): its tab is revealed in the row, and the tab is ringed', () => {
    const revealed: string[] = []
    const r = resolveTutorialAnchor('nav:inventory.item.multiprise-secteur', base(false, revealed))
    expect(revealed).toEqual(['[data-testid="inventory-drawer"][data-open="true"] [role="tab"][data-tab="secteur"]'])
    expect(r).toEqual({ x: 1000, y: 100, w: 80, h: 30 })
    resolveTutorialAnchor('nav:inventory.tab.secteur', base(false, revealed))
    expect(revealed).toHaveLength(2)
  })

  it('does not trigger: the card is shown, so it is ringed and the row is left as it is', () => {
    const revealed: string[] = []
    const r = resolveTutorialAnchor('nav:inventory.item.multiprise-secteur', base(true, revealed))
    expect(revealed).toEqual([])
    expect(r).toEqual({ x: 10, y: 600, w: 120, h: 80 })
  })
})
