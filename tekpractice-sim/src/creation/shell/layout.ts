/**
 * The Mode Création app shell (Task 7, C10 landmarks): skip link, menubar
 * (header), Projet tree (nav), 3D viewport (main, holds #renderCanvas),
 * Propriétés (aside), status bar (footer). Layout inspired by pro
 * acoustic-design tools. The legacy #site-link is moved into the top bar.
 * DOM only: the shell never touches the rig (intents only, C6).
 */
import './creation.css'
import { COPY } from '../copy'
import { createLiveText } from './liveText'

export type PanelId = 'tree' | 'props'

export interface ShellDom {
  root: HTMLElement
  menubar: HTMLElement
  tree: HTMLElement
  viewport: HTMLElement
  canvas: HTMLCanvasElement
  props: HTMLElement
  status: HTMLElement
  title: HTMLElement
  /** The element the menubar renders its menus into (inside `menubar`). */
  menus: HTMLElement
  treeBody: HTMLElement
  propsBody: HTMLElement
  isPanelOpen(p: PanelId): boolean
  /** A side panel folded or unfolded (a click on its button, a menu item, a script): told after the state changed. Returns the remover. */
  onPanelChange(fn: (p: PanelId, open: boolean) => void): () => void
  /** Collapse / expand a side panel (toggles when `open` is omitted). */
  setPanel(p: PanelId, open?: boolean): void
  /**
   * Status bar: the place on screen ('' = none) and the state message.
   * `reannounce`: an answer to a learner action, read again even when the text did not change.
   */
  setStatus(place: string, message: string, state?: 'idle' | 'busy' | 'ready', reannounce?: boolean): void
}

const S = (): Readonly<Record<string, string>> => COPY.shell!

/** A chevron that points left (« replier » on the tree) — rotated by the caller's state. */
function chevron(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 12 12')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const p = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
  p.setAttribute('d', 'M7.5 2.5 4 6l3.5 3.5')
  p.setAttribute('fill', 'none')
  p.setAttribute('stroke', 'currentColor')
  p.setAttribute('stroke-width', '1.5')
  p.setAttribute('stroke-linecap', 'square')
  svg.appendChild(p)
  return svg
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

export function mountShell(doc: Document, canvas: HTMLCanvasElement): ShellDom {
  doc.documentElement.classList.add('cr-mode')

  const skip = el(doc, 'a', 'cr-skip', S().skip)
  skip.href = '#cr-viewport'
  skip.dataset.testid = 'skip-link'
  // Land on the canvas itself (one tab stop, keys ready) once it is shown; else on the viewport.
  skip.addEventListener('click', (e) => {
    if (canvas.style.display === 'none') return
    e.preventDefault()
    canvas.focus()
  })

  const root = el(doc, 'div', 'cr')
  root.id = 'creation-root'
  root.dataset.testid = 'creation-root'
  // The page's h1 (Task 7 review): visually hidden, panels and the picker use h2. It is the first thing INSIDE the header landmark (night 2 wave 5, P3-7: outside every
  // landmark it was the one node axe's `region` rule flagged on every screen); it stays first in the DOM, so the heading order and the skip link's target do not change.
  const h1 = el(doc, 'h1', 'cr-sr-only', S().appTitle)

  // ── header: brand, menus, project title, back to the site
  const menubar = el(doc, 'header', 'cr-menubar')
  menubar.dataset.testid = 'menubar'
  const brand = el(doc, 'span', 'cr-brand', S().brand)
  const menus = el(doc, 'div', 'cr-menus')
  menus.setAttribute('role', 'menubar')
  menus.setAttribute('aria-label', S().menubar!)
  const title = el(doc, 'span', 'cr-title', S().untitled)
  title.dataset.testid = 'project-title'
  menubar.append(h1, brand, menus, title)
  const site = doc.getElementById('site-link')
  if (site instanceof HTMLAnchorElement) {
    // One link, visible name = accessible name (no aria-label mismatch).
    site.removeAttribute('aria-label')
    site.textContent = ''
    const arrow = el(doc, 'span', undefined, '←')
    arrow.setAttribute('aria-hidden', 'true')
    site.append(arrow, el(doc, 'span', 'cr-site-label', S().siteBack))
    menubar.appendChild(site)
  }

  // ── side panels
  const panel = (id: PanelId, tag: 'nav' | 'aside', name: string): { box: HTMLElement; body: HTMLElement; btn: HTMLButtonElement } => {
    const box = el(doc, tag, id === 'tree' ? 'cr-tree' : 'cr-props')
    box.setAttribute('aria-label', name)
    box.dataset.testid = id === 'tree' ? 'project-tree' : 'properties'
    const head = el(doc, 'div', 'cr-panel-head')
    const h = el(doc, 'h2', 'cr-panel-title', name)
    const btn = el(doc, 'button', 'cr-collapse')
    btn.type = 'button'
    btn.dataset.testid = id === 'tree' ? 'tree-collapse' : 'props-collapse'
    btn.setAttribute('aria-controls', `cr-${id}-body`)
    btn.appendChild(chevron(doc))
    head.append(h, btn)
    const body = el(doc, 'div', 'cr-panel-body')
    body.id = `cr-${id}-body`
    box.append(head, body)
    return { box, body, btn }
  }
  const tree = panel('tree', 'nav', S().tree!)
  const props = panel('props', 'aside', S().props!)

  // tree content: mounted by the owner (projectTree.ts, Task 9)
  props.body.appendChild(el(doc, 'p', 'cr-empty', S().propsEmpty))

  // ── viewport (main): the existing canvas moves in
  const viewport = el(doc, 'main', 'cr-viewport')
  viewport.id = 'cr-viewport'
  viewport.tabIndex = -1
  viewport.dataset.testid = 'viewport'
  canvas.tabIndex = 0
  canvas.setAttribute('aria-label', S().canvas!)
  canvas.setAttribute('role', 'application') // keyboard-driven 3D view (input/keyboard.ts); the focus key is never intercepted
  viewport.appendChild(canvas)

  // ── status bar (footer): place + a polite live message
  const status = el(doc, 'footer', 'cr-status')
  status.dataset.testid = 'status-bar'
  status.setAttribute('role', 'contentinfo')
  // Plain text (not a tab stop): the bar's controls (signal button, autosave action) are its tab stops (Task 14).
  const summary = el(doc, 'div', 'cr-status-summary')
  const statusPlace = el(doc, 'span', 'cr-status-place')
  const statusMsg = el(doc, 'span', 'cr-status-msg')
  statusMsg.setAttribute('role', 'status')
  summary.append(statusPlace, statusMsg)
  status.append(summary)

  root.append(menubar, tree.box, viewport, props.box, status)
  doc.body.prepend(skip, root) // the skip link is the first tab stop

  const btnOf = { tree: tree.btn, props: props.btn }
  const nameOf = (p: PanelId, open: boolean): string =>
    p === 'tree' ? (open ? S().treeCollapse! : S().treeExpand!) : open ? S().propsCollapse! : S().propsExpand!
  const isPanelOpen = (p: PanelId): boolean => root.dataset[p] !== 'collapsed'
  const panelListeners = new Set<(p: PanelId, open: boolean) => void>()
  /** Below this width the two side panels cannot be open together (night 2 wave 4, item 1: Projet 200 + Propriétés 260 > 400). Same threshold as the CSS cap. */
  const PHONE_PX = 760
  const phone = (): boolean => !!win && win.innerWidth < PHONE_PX
  let openOrder = 0
  const openedAt: Record<PanelId, number> = { tree: 0, props: 0 }
  const other = (p: PanelId): PanelId => (p === 'tree' ? 'props' : 'tree')
  const setPanel = (p: PanelId, open = !isPanelOpen(p)): void => {
    const was = root.dataset[p]
    if (open && was !== 'open') {
      openedAt[p] = ++openOrder
      // Accordion on a phone: opening one panel folds the other (a user's own choice at a wide width is never touched).
      const o = other(p)
      if (phone() && isPanelOpen(o)) {
        const body = o === 'tree' ? tree.body : props.body
        const hadFocus = body.contains(doc.activeElement)
        setPanel(o, false)
        if (hadFocus) btnOf[o].focus() // the folded body is display: none: a focus left in it would fall to the page
      }
    }
    root.dataset[p] = open ? 'open' : 'collapsed'
    const b = btnOf[p]
    b.setAttribute('aria-expanded', String(open))
    b.setAttribute('aria-label', nameOf(p, open))
    b.title = nameOf(p, open)
    // the chevron points to where the panel goes: tree ‹ to fold, › to unfold; props mirrored
    const svg = b.firstElementChild as SVGElement
    const left = p === 'tree' ? open : !open
    svg.style.transform = left ? '' : 'scaleX(-1)'
    if (was !== root.dataset[p]) for (const fn of [...panelListeners]) fn(p, open)
  }
  for (const p of ['tree', 'props'] as const) btnOf[p].addEventListener('click', () => setPanel(p))

  // A narrow window starts with Propriétés folded so the 3D view keeps ≥ 60 %; a phone-sized one (< 760 px) folds Projet too (night wave 2, item A:
  // at 400 px the 200 px tree left the view 168 px wide). Only the first state: a click, a menu item or a script wins afterwards.
  const win = doc.defaultView
  setPanel('tree', !phone())
  setPanel('props', !(win && win.innerWidth < 1200))

  // A window narrowed below 760 px with both panels open: the one opened longer ago folds (the same accordion, applied once).
  const narrowQuery = win?.matchMedia ? win.matchMedia(`(max-width: ${PHONE_PX - 0.02}px)`) : null
  narrowQuery?.addEventListener('change', (e) => {
    if (e.matches && isPanelOpen('tree') && isPanelOpen('props')) setPanel(openedAt.tree < openedAt.props ? 'tree' : 'props', false)
  })

  const liveMsg = createLiveText(statusMsg, (fn, ms) => (win ? win.setTimeout(fn, ms) : fn()))
  const setStatus = (place: string, message: string, state: 'idle' | 'busy' | 'ready' = 'idle', reannounce = false): void => {
    // Writes only on a change; the message itself goes through liveText (re-announced only for a learner's action).
    if (statusPlace.textContent !== place) statusPlace.textContent = place
    liveMsg(message, reannounce)
    // the full text when the bar clips it (night 2 wave 4, item 7: the pose hints are 98 characters, the bar shows about 36 at 400 px); on a touch screen the CSS gives it two lines
    if (statusMsg.title !== message) statusMsg.title = message
    if (statusMsg.dataset.state !== state) statusMsg.dataset.state = state
  }
  setStatus('', S().statusNoPlace!)

  return {
    root,
    menubar,
    tree: tree.box,
    viewport,
    canvas,
    props: props.box,
    status,
    title,
    menus,
    treeBody: tree.body,
    propsBody: props.body,
    isPanelOpen,
    onPanelChange: (fn) => {
      panelListeners.add(fn)
      return () => void panelListeners.delete(fn)
    },
    setPanel,
    setStatus,
  }
}
