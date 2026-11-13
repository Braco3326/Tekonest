// G14c fix (a): the ringed Propriétés button is brought into view inside its scroll box, once per target (src/guide/reveal.ts), and the tutorial's
// resolver asks for it on the rows it rings (src/guide/tutorial.ts deviceThenRow and the playback row).
import { describe, expect, it } from 'vitest'
import { createRevealer, scrollBoxOf, type RevealElement } from '../../src/guide/reveal'
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
    for (const sels of asked) {
      const item = sels.indexOf('#cr-menu-materiel-panel [data-item="inventory"]')
      expect(item, sels.join(' , ')).toBeGreaterThanOrEqual(0)
      expect(item).toBe(sels.indexOf('#cr-menu-materiel') - 1)
    }
  })
})
