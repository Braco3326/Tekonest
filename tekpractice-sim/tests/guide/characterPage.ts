// Test page for the new Oscar (plan T5.2): bundled by tests/guide/characterHarness.ts for tests/e2e/character.spec.ts with esbuild into an IIFE and run in a blank page next to the
// real sheets (src/guide/vendor/guide.css, then src/guide/character.css). It builds the character through the real module and, for the motion
// test, the vendored DOM it will live in (an .oscar-guide root with the real vendored mascot and ring), so the vendored infinite loops are present
// and must be stopped by character.css. Not a spec file (no .spec suffix): Playwright never runs it on its own.
import { HOST_CLASS, createCharacter, type Character, type CharacterState, type Dir } from '../../src/guide/character'
import { createMascot } from '../../src/guide/vendor/ui/mascot'
import { createOverlay } from '../../src/guide/vendor/ui/overlay'

/** Timers that never fire: a host state (nod, wave) is HELD so a still of it can be taken. The live timing is tested with real timers below. */
const FROZEN = { setTimeout: (): unknown => 0, clearTimeout: (): void => undefined }

function pose(c: Character, state: CharacterState): void {
  if (state === 'nod' || state === 'wave') c.play(state)
  else if (state === 'shrug') c.setState('no')
  else c.setState(state)
}

export interface CellOpts {
  id: string
  size: number
  state: CharacterState
  dir?: Dir
  ground: string
  parent?: string
}

const widgets: { c: Character; mascot: ReturnType<typeof createMascot> }[] = []
const cells = new Map<string, Character>()

const api = {
  /** One character in a square cell of `size` px on a ground colour; the state held (frozen timers). */
  cell(o: CellOpts): void {
    const box = document.createElement('div')
    box.id = o.id
    box.style.cssText = `width:${o.size}px;height:${o.size}px;background:${o.ground};display:inline-block;vertical-align:top;margin:0;padding:0`
    const c = createCharacter(document, { timers: FROZEN })
    if (o.dir) c.setDir(o.dir)
    pose(c, o.state)
    box.appendChild(c.svg)
    ;(o.parent ? document.getElementById(o.parent)! : document.body).appendChild(box)
    cells.set(o.id, c)
  },
  /** A later state for the cell `id` (from its current pose: the transitions and animations of that change start). */
  pose(id: string, state: CharacterState): void {
    const c = cells.get(id)!
    void document.getElementById(id)!.getBoundingClientRect() // the old pose is styled before the change, so transitions start from it
    getComputedStyle(c.svg.querySelector('.tpo-arm-pose')!).transform
    pose(c, state)
  },
  /** Pauses every animation and transition inside the cell `id` at `ms` from its start (a frame of the motion, for the filmstrip). */
  seek(id: string, ms: number): number {
    const box = document.getElementById(id)!
    const list = document.getAnimations().filter((a) => {
      const t = (a.effect as KeyframeEffect | null)?.target
      return t instanceof Element && box.contains(t)
    })
    for (const a of list) {
      a.pause()
      a.currentTime = ms
    }
    return list.length
  },
  /** A plain filled circle of the same size, for the silhouette comparison. */
  circle(id: string, size: number, ground: string, fill: string): void {
    const box = document.createElement('div')
    box.id = id
    box.style.cssText = `width:${size}px;height:${size}px;background:${ground};display:inline-block`
    const disc = document.createElement('div')
    disc.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${fill}`
    box.appendChild(disc)
    document.body.appendChild(box)
  },
  /**
   * The vendored widget's DOM around the character: .oscar-guide (with or without the host class) > .oscar-icon-wrap > button.oscar-icon >
   * [the real vendored mascot, the character], plus the real vendored ring shown. The vendored mascot gets the controller's state, the
   * character gets the same through setState (or plays a host state with REAL timers). Returns the drawn state.
   */
  widget(o: { vendor: string; host?: 'nod' | 'wave'; dir?: Dir; hostClass: boolean; x: number }): string {
    const root = document.createElement('div')
    root.className = 'oscar-guide' + (o.hostClass ? ' ' + HOST_CLASS : '')
    const overlay = createOverlay(document)
    overlay.ring.hidden = false
    overlay.ring.style.cssText = `left:${o.x}px;top:120px;width:40px;height:24px`
    root.appendChild(overlay.ring)
    const wrap = document.createElement('div')
    wrap.className = 'oscar-icon-wrap'
    wrap.style.transform = `translate(${o.x}px, 20px)`
    const button = document.createElement('button')
    button.className = 'oscar-icon'
    button.type = 'button'
    const mascot = createMascot(document)
    mascot.setState(o.vendor as Parameters<typeof mascot.setState>[0])
    button.appendChild(mascot.el)
    const c = createCharacter(document)
    if (o.dir) c.setDir(o.dir)
    c.setState(o.vendor)
    if (o.host) c.play(o.host)
    button.appendChild(c.svg)
    wrap.appendChild(button)
    root.appendChild(wrap)
    document.body.appendChild(root)
    widgets.push({ c, mascot })
    return c.state()
  },
  /** A later controller state for widget `i` (both the vendored mascot and the character, as the host's observer will do in T5.3). */
  set(i: number, vendor: string): string {
    const w = widgets[i]
    w.mascot.setState(vendor as Parameters<typeof w.mascot.setState>[0])
    w.c.setState(vendor)
    return w.c.state()
  },
  /** Running animations, document-wide, with a short label each (for a readable failure). */
  running(): string[] {
    return document.getAnimations().map((a) => {
      const t = (a.effect as KeyframeEffect | null)?.target as Element | null
      const name = (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? 'script'
      return `${name} on ${t ? t.getAttribute('class') ?? t.tagName : '?'}`
    })
  },
  /** The arm's hand centre minus the shoulder, in screen pixels (y down), for the direction check. The shoulder is the start of the arm line. */
  armVector(id: string): { x: number; y: number } {
    const svg = document.querySelector(`#${id} svg`) as SVGSVGElement
    const hand = svg.querySelector('[data-part="hand"]')!.getBoundingClientRect()
    const line = svg.querySelector('.tpo-arm-line') as SVGPathElement
    const start = line.getPointAtLength(0)
    const m = line.getScreenCTM()!
    const sx = m.a * start.x + m.c * start.y + m.e
    const sy = m.b * start.x + m.d * start.y + m.f
    return { x: hand.x + hand.width / 2 - sx, y: hand.y + hand.height / 2 - sy }
  },
}

declare global {
  interface Window {
    __tpo: typeof api
  }
}
window.__tpo = api
