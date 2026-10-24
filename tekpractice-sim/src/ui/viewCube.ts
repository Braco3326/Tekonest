/**
 * View cube (designer nav, Task 8): a small DOM/CSS 3D cube in the top-left of
 * the 3D view. Click a face, a ¾ edge, ↺ ↻ (90° turns) or ⌂ (overview); the
 * camera turns around the CURRENT pivot (the focused device, else the room).
 * The behaviour is inspired by pro acoustic-design tools; the look (night-blue
 * faces, paper labels, amber active face, square corners) is our own.
 *
 * Perf-first: no second canvas, no rAF loop. The cube re-orients only when the
 * camera's view matrix actually changed (onViewMatrixChangedObservable), at most
 * once per animation frame (CoalescedUpdate), and detaches while hidden.
 * Copy: docs/copy/designer-nav-essais.md §1 (viewCube.*).
 */
import { cubeCssRotation, nearestFace, type FaceId } from '../camera/viewCube'

/** Copy deck viewCube.face.* / viewCube.corner.* (label drawn on the cube, accessible name + tooltip). */
export const FACE_COPY: Record<FaceId, { label: string; aria: string }> = {
  face: { label: 'Face', aria: 'Vue de face' },
  arriere: { label: 'Arrière', aria: 'Vue arrière' },
  gauche: { label: 'Gauche', aria: 'Vue de gauche' },
  droite: { label: 'Droite', aria: 'Vue de droite' },
  dessus: { label: 'Dessus', aria: 'Vue de dessus' },
  dessous: { label: 'Dessous', aria: 'Vue de dessous' },
  'face-gauche': { label: 'Face-gauche', aria: 'Vue de trois quarts, face-gauche' },
  'face-droite': { label: 'Face-droite', aria: 'Vue de trois quarts, face-droite' },
  'arriere-gauche': { label: 'Arrière-gauche', aria: 'Vue de trois quarts, arrière-gauche' },
  'arriere-droite': { label: 'Arrière-droite', aria: 'Vue de trois quarts, arrière-droite' },
}

/**
 * Jardin / cour hints (viewCube.face.gauche.hint / droite.hint) are OFF: rooms
 * render mirrored left-to-right compared with their data (ADR-0011-nav, "Known
 * issue: rooms rendered mirrored"), so "Côté cour" would contradict the room's
 * `coulisse-jardin`. Turn back on once that is fixed.
 */
export const SHOW_SIDE_HINT = false
const SIDE_HINT: Partial<Record<FaceId, string>> = {
  gauche: 'Côté jardin (à gauche vu de la salle)',
  droite: 'Côté cour (à droite vu de la salle)',
}

/** Tooltip of a face button: accessible name, bound key, room-only side hint (when enabled). */
export function faceTooltip(face: FaceId, key: string | null, hasRoom: boolean): string {
  const hint = SHOW_SIDE_HINT && hasRoom ? SIDE_HINT[face] : undefined
  return `${FACE_COPY[face].aria}${key ? ` (${key})` : ''}${hint ? `\n${hint}` : ''}`
}

/**
 * In-plane turn (degrees) of the Dessus / Dessous label so it always reads
 * upright: the cube's heading ry = front − alpha, snapped to the nearest
 * quadrant (dessus +q, dessous −q). Derivation: at the top view the cube is
 * RX(−90°)·RY(ry)·RX(90°) = RZ(−ry) on the top face, so a label RZ(q) cancels it
 * (bottom face: RX(90°)·RY(ry)·RX(−90°) = RZ(ry), cancelled by RZ(−q)).
 */
export function capLabelTurn(face: 'dessus' | 'dessous', alpha: number, frontAlpha: number): number {
  const ry = cubeCssRotation(alpha, Math.PI / 2, frontAlpha).ry
  const q = Math.round(ry / 90) * 90
  const turn = face === 'dessus' ? q : -q
  return (((turn % 360) + 360) % 360) // 0, 90, 180, 270
}

const COPY = {
  root: 'Cube de vue : choisir un point de vue',
  activeSuffix: ', vue actuelle',
  rotateLeft: 'Tourner à gauche (90°)',
  rotateRight: 'Tourner à droite (90°)',
  home: "Vue d'ensemble",
  homeAria: "Revenir à la vue d'ensemble de la salle",
  coach: "Cliquez une face pour tourner autour de l'objet sélectionné.",
  noSelection: "Rien n'est sélectionné : le cube tourne autour de la salle.",
}

/** Which named view the camera is at, and its label (the cube-state helper). */
export function cubeState(alpha: number, beta: number, frontAlpha: number): { face: FaceId; label: string } {
  const face = nearestFace(alpha, beta, frontAlpha)
  return { face, label: FACE_COPY[face].label }
}

export interface ObservableLike {
  add(cb: () => void): unknown
  remove(observer: unknown): unknown
}

/**
 * Runs `update` once in the next animation frame after one or more change
 * signals; nothing at all while no change is signalled (no permanent loop).
 */
export class CoalescedUpdate {
  private observer: unknown = null
  private pending: number | null = null

  constructor(
    private readonly signal: ObservableLike,
    private readonly update: () => void,
    private readonly raf: (cb: FrameRequestCallback) => number = (cb) => requestAnimationFrame(cb),
    private readonly caf: (id: number) => void = (id) => cancelAnimationFrame(id),
  ) {}

  get running(): boolean {
    return this.observer !== null
  }

  start(): void {
    if (this.observer !== null) return
    this.observer = this.signal.add(() => this.request())
  }

  stop(): void {
    if (this.observer !== null) this.signal.remove(this.observer)
    this.observer = null
    if (this.pending !== null) this.caf(this.pending)
    this.pending = null
    this.generation++ // a frame already in flight becomes a no-op
  }

  private generation = 0

  /** Schedule one update (coalesced with any already pending). */
  request(): void {
    if (this.pending !== null) return
    const gen = this.generation
    this.pending = this.raf(() => {
      if (gen !== this.generation) return
      this.pending = null
      this.update()
    })
  }
}

export interface ViewCubeDeps {
  root: HTMLElement
  /** "Face" azimuth (N3: +π/2). */
  frontAlpha: number
  pose(): { alpha: number; beta: number }
  /** Orbit and orbit-focus: true. Walking in Explore (and Explore focus, like the presets): false. */
  available(): boolean
  /** A device is focused (the pivot); else the cube turns around the room. */
  focused(): boolean
  go(face: FaceId): void
  rotate(dir: 1 | -1): void
  home(): void
  /** Key label of an action in the learner's layout, or null when unbound. */
  keyLabel(action: 'VIEW_FACE' | 'VIEW_ARRIERE' | 'VIEW_DROITE' | 'VIEW_GAUCHE' | 'VIEW_DESSUS' | 'VIEW_ROT_LEFT' | 'VIEW_ROT_RIGHT' | 'CAMERA_HOME'): string | null
  /** Levels with a room show the jardin / cour hints on Gauche / Droite. */
  hasRoom: boolean
  /** camera.onViewMatrixChangedObservable (fires only when the view really changed). */
  viewChanged: ObservableLike
  /** One-time tip (existing coach-seen mechanism, session-scoped). */
  coach: { seen(): boolean; markSeen(): void }
}

const FACE_KEY: Partial<Record<FaceId, Parameters<ViewCubeDeps['keyLabel']>[0]>> = {
  face: 'VIEW_FACE',
  arriere: 'VIEW_ARRIERE',
  droite: 'VIEW_DROITE',
  gauche: 'VIEW_GAUCHE',
  dessus: 'VIEW_DESSUS',
}

const SIDES: FaceId[] = ['face', 'droite', 'arriere', 'gauche', 'dessus', 'dessous']
const EDGES: FaceId[] = ['face-droite', 'arriere-droite', 'arriere-gauche', 'face-gauche']
const COACH_MS = 12_000

export class ViewCube {
  readonly el: HTMLElement
  private cube: HTMLElement
  private current: HTMLElement
  private coachEl: HTMLElement
  private buttons = new Map<FaceId, HTMLButtonElement>()
  private caps = new Map<'dessus' | 'dessous', HTMLElement>()
  private rotL: HTMLButtonElement
  private rotR: HTMLButtonElement
  private homeBtn: HTMLButtonElement
  private updater: CoalescedUpdate
  private active: FaceId | null = null
  private focusedLabel: string | null = null
  private coachTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private deps: ViewCubeDeps) {
    this.el = document.createElement('div')
    this.el.id = 'view-cube'
    this.el.setAttribute('role', 'group')
    this.el.setAttribute('aria-label', COPY.root)

    const stage = document.createElement('div')
    stage.className = 'vc-stage'
    this.cube = document.createElement('div')
    this.cube.className = 'vc-cube'
    for (const f of [...SIDES, ...EDGES]) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = EDGES.includes(f) ? 'vc-edge' : 'vc-face'
      b.dataset.face = f
      if (!EDGES.includes(f)) {
        const span = document.createElement('span')
        span.className = 'vc-label'
        span.textContent = FACE_COPY[f].label
        b.appendChild(span)
        if (f === 'dessus' || f === 'dessous') this.caps.set(f, span)
      }
      b.addEventListener('click', () => this.use(() => deps.go(f)))
      b.addEventListener('focus', () => this.showFocused(FACE_COPY[f].aria))
      b.addEventListener('blur', () => this.showFocused(null))
      this.cube.appendChild(b)
      this.buttons.set(f, b)
    }
    stage.appendChild(this.cube)

    const row = document.createElement('div')
    row.className = 'vc-row'
    this.rotL = this.tool('rotate-left', '↺', () => deps.rotate(-1))
    this.homeBtn = this.tool('home', '⌂', () => deps.home())
    this.rotR = this.tool('rotate-right', '↻', () => deps.rotate(1))
    row.append(this.rotL, this.homeBtn, this.rotR)

    this.current = document.createElement('p')
    this.current.className = 'vc-current'
    this.coachEl = document.createElement('p')
    this.coachEl.className = 'vc-coach'
    this.coachEl.hidden = true
    this.coachEl.textContent = COPY.coach

    this.el.append(stage, row, this.current, this.coachEl)
    deps.root.appendChild(this.el)
    this.updater = new CoalescedUpdate(deps.viewChanged, () => this.orient())
    this.refresh()
  }

  private tool(act: string, glyph: string, run: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'vc-tool'
    b.dataset.act = act
    b.textContent = glyph
    b.addEventListener('click', () => this.use(run))
    return b
  }

  private use(run: () => void): void {
    this.hideCoach()
    run()
  }

  private showFocused(text: string | null): void {
    this.focusedLabel = text
    this.renderCurrent()
  }

  private renderCurrent(): void {
    const t = this.focusedLabel ?? (this.active ? FACE_COPY[this.active].label : '')
    if (this.current.textContent !== t) this.current.textContent = t
  }

  /** Re-orient the cube and mark the active face (runs only after a camera change). */
  private orient(): void {
    const { alpha, beta } = this.deps.pose()
    const { rx, ry } = cubeCssRotation(alpha, beta, this.deps.frontAlpha)
    this.cube.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`
    // Top / bottom labels stay upright whatever the heading (changes only at a quadrant crossing).
    for (const [f, span] of this.caps) {
      const turn = `rotate(${capLabelTurn(f, alpha, this.deps.frontAlpha)}deg)`
      if (span.style.transform !== turn) span.style.transform = turn
    }
    const face = nearestFace(alpha, beta, this.deps.frontAlpha)
    if (face !== this.active) {
      if (this.active) this.label(this.active, false)
      this.label(face, true)
      this.active = face
      this.renderCurrent()
    }
  }

  private label(f: FaceId, active: boolean): void {
    const b = this.buttons.get(f)
    if (!b) return
    b.classList.toggle('is-active', active)
    b.setAttribute('aria-label', FACE_COPY[f].aria + (active ? COPY.activeSuffix : ''))
  }

  /** Visibility, tooltips and key hints (view switch, focus change, key remap). */
  refresh(): void {
    const show = this.deps.available()
    this.el.hidden = !show
    if (!show) {
      this.updater.stop()
      this.hideCoach()
      return
    }
    for (const [f, b] of this.buttons) {
      const action = FACE_KEY[f]
      const key = action ? this.deps.keyLabel(action) : null
      b.title = faceTooltip(f, key, this.deps.hasRoom)
      if (!b.hasAttribute('aria-label')) this.label(f, f === this.active)
    }
    const k = (a: Parameters<ViewCubeDeps['keyLabel']>[0]): string => {
      const key = this.deps.keyLabel(a)
      return key ? ` (${key})` : ''
    }
    this.rotL.title = COPY.rotateLeft + k('VIEW_ROT_LEFT')
    this.rotL.setAttribute('aria-label', COPY.rotateLeft)
    this.rotR.title = COPY.rotateRight + k('VIEW_ROT_RIGHT')
    this.rotR.setAttribute('aria-label', COPY.rotateRight)
    this.homeBtn.title = COPY.home + k('CAMERA_HOME')
    this.homeBtn.setAttribute('aria-label', COPY.homeAria)
    this.el.title = this.deps.focused() ? '' : COPY.noSelection
    if (!this.updater.running) {
      this.updater.start()
      this.orient() // shown again: one immediate update, then change-driven only
    }
    this.maybeCoach()
  }

  private maybeCoach(): void {
    if (this.deps.coach.seen()) return
    this.deps.coach.markSeen()
    this.coachEl.hidden = false
    this.coachTimer = setTimeout(() => this.hideCoach(), COACH_MS)
  }

  private hideCoach(): void {
    if (this.coachTimer) clearTimeout(this.coachTimer)
    this.coachTimer = null
    this.coachEl.hidden = true
  }
}

/**
 * Keep `dock` just under the top-left HUD panel (`anchor`), never over it. Driven
 * by ResizeObserver + window resize (no polling).
 */
export function dockBelow(dock: HTMLElement, anchor: HTMLElement | null, gapPx = 12, fallbackTopPx = 20): void {
  const place = (): void => {
    const r = anchor && !anchor.hidden ? anchor.getBoundingClientRect() : null
    const top = r && r.height > 0 ? Math.round(r.bottom + gapPx) : fallbackTopPx
    dock.style.top = `${top}px`
  }
  place()
  if (anchor && typeof ResizeObserver !== 'undefined') new ResizeObserver(place).observe(anchor)
  window.addEventListener('resize', place)
}
