/**
 * Explore toolbar (ADR-0010) — the always-visible, startup-bundle half of the
 * Explore HUD. Implements the ExploreUi surface for the ExploreController and
 * loads the panel module (inventory/help/settings/pause, src/ui/exploreHud.ts)
 * on first use, so the startup bundle stays within budget (+15 %).
 * Buttons are built ONCE and updated in place: keyboard focus survives updates.
 */
import type { ExploreUi } from '../scene/ExploreController'
import type { Action } from '../input/actions'
import { labelFor } from '../input/layoutLabels'
import type { ExploreHud, ExploreHudDeps, PanelId } from './exploreHud'

export interface ExploreToolbarDeps extends Omit<ExploreHudDeps, 'onPanelsChanged'> {
  /** Exam mode: no inventory at all (no hints of any kind). */
  inventoryEnabled: boolean
  /** Device currently framed in Focus (shows the "Ramasser" button in the sandbox). */
  focusedInstance(): string | null
  /** « Vue d'ensemble » (CAMERA_HOME, Task 4): fly back to the Ensemble pose. */
  home(): void
}

type Act = 'home' | 'inventory' | 'view' | 'help' | 'settings' | 'pickup'

export class ExploreToolbar implements ExploreUi {
  private el: HTMLElement
  private buttons = new Map<Act, HTMLButtonElement>()
  private hud: ExploreHud | null = null
  private loading: Promise<ExploreHud> | null = null
  /** Opens requested before the panel chunk arrived (Esc can cancel them). */
  private queued = 0

  constructor(private deps: ExploreToolbarDeps) {
    this.el = document.createElement('nav')
    this.el.id = 'explore-toolbar'
    this.el.setAttribute('aria-label', 'Contrôles du monde 3D')
    const acts: Act[] = ['home', ...(deps.inventoryEnabled ? (['inventory'] as Act[]) : []), 'view', 'help', 'settings']
    if (deps.sandbox) acts.push('pickup')
    for (const act of acts) {
      const b = document.createElement('button')
      b.type = 'button'
      b.dataset.act = act
      b.addEventListener('click', () => this.onClick(act))
      this.el.appendChild(b)
      this.buttons.set(act, b)
    }
    deps.root.appendChild(this.el)
    this.render()
  }

  private panels(): Promise<ExploreHud> {
    this.loading ??= import('./exploreHud')
      .then(({ ExploreHud: Hud }) => {
        this.hud = new Hud({ ...this.deps, onPanelsChanged: () => this.render() })
        return this.hud
      })
      .catch((err: unknown) => {
        this.loading = null // allow a retry on the next request
        this.queued = 0
        console.warn('[explore] panneaux indisponibles (chargement échoué)', err)
        throw err
      })
    return this.loading
  }

  /** Run a panel action once the chunk is there; Esc before that cancels it. */
  private withPanels(fn: (h: ExploreHud) => void): void {
    if (this.hud) {
      fn(this.hud)
      return
    }
    this.queued++
    void this.panels()
      .then((h) => {
        if (this.queued > 0) {
          this.queued--
          fn(h)
        }
      })
      .catch(() => undefined)
  }

  // ── ExploreUi ───────────────────────────────────────────────────────────────
  panelCount(): number {
    return this.hud ? this.hud.panelCount() : this.queued
  }
  closeTopPanel(): void {
    if (this.hud) this.hud.closeTopPanel()
    else if (this.queued > 0) this.queued--
  }
  toggleInventory(): void {
    if (this.deps.inventoryEnabled) this.withPanels((h) => h.toggleInventory())
  }
  toggleHelp(): void {
    this.withPanels((h) => h.toggleHelp())
  }
  openPause(): void {
    this.withPanels((h) => h.openPause())
  }
  placing(): boolean {
    return this.deps.placement.active
  }
  cancelPlacement(): void {
    this.deps.placement.cancel()
  }
  rotatePlacement(): void {
    this.deps.placement.rotate()
  }
  confirmPlacement(): void {
    this.deps.placement.confirm()
  }
  pickUp(instanceId: string): void {
    this.deps.pickUp(instanceId)
  }
  capturingKey(): boolean {
    return this.hud?.capturingKey() ?? false
  }

  /** Re-render labels/states after a view switch, a focus change or a settings change. */
  refresh(): void {
    this.render()
  }

  // ── toolbar ─────────────────────────────────────────────────────────────────
  private onClick(act: Act): void {
    if (act === 'home') this.deps.home()
    else if (act === 'inventory') this.toggleInventory()
    else if (act === 'help') this.toggleHelp()
    else if (act === 'settings') this.withPanels((h) => h.toggleSettings())
    else if (act === 'view') {
      this.deps.toggleView()
      this.render()
    } else if (act === 'pickup') {
      const id = this.deps.focusedInstance()
      if (id) this.deps.pickUp(id)
    }
  }

  private key(action: Action): string {
    return this.deps.settings().bindings[action].map((c) => labelFor(c, this.deps.layout, this.deps.layoutMap))[0] ?? '—'
  }

  private open(id: PanelId): boolean {
    return this.hud?.isOpen(id) ?? false
  }

  private set(act: Act, html: string, pressed?: boolean): void {
    const b = this.buttons.get(act)
    if (!b) return
    if (b.innerHTML !== html) b.innerHTML = html
    if (pressed === undefined) b.removeAttribute('aria-pressed')
    else b.setAttribute('aria-pressed', String(pressed))
  }

  private render(): void {
    const kbd = (a: Action) => `<kbd>${this.key(a).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}</kbd>`
    const view = this.deps.currentView()
    // « Vue d'ensemble » (copy deck viewCube.home.*). Hidden while walking with
    // nothing framed: Explore has no orbit overview (ADR-0010 untouched).
    const home = this.buttons.get('home')
    if (home) {
      home.hidden = view === 'explore' && !this.deps.focusedInstance()
      this.set('home', `Vue d'ensemble ${kbd('CAMERA_HOME')}`)
      home.title = `Vue d'ensemble (${this.key('CAMERA_HOME')})`
      home.setAttribute('aria-label', "Revenir à la vue d'ensemble de la salle")
    }
    this.set('inventory', `Inventaire ${kbd('TOGGLE_INVENTORY')}`, this.open('inventory'))
    // The label says the state; no aria-pressed on a button whose label changes.
    this.set('view', `Vue : ${view === 'explore' ? 'Exploration' : 'Orbite'} ${kbd('TOGGLE_VIEW')}`)
    this.buttons.get('view')?.setAttribute('title', 'Exploration : marcher dans la salle. Orbite : tourner autour du matériel.')
    this.set('help', `Aide ${kbd('TOGGLE_HELP')}`, this.open('help'))
    this.set('settings', 'Réglages', this.open('settings'))
    const pick = this.buttons.get('pickup')
    if (pick) {
      pick.hidden = !this.deps.focusedInstance()
      this.set('pickup', `Ramasser ${kbd('PICK_UP')}`)
    }
  }
}
