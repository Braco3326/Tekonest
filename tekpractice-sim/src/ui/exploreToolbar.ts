/**
 * Explore toolbar (ADR-0010) — the always-visible, startup-bundle half of the
 * Explore HUD. Implements the ExploreUi surface for the ExploreController and
 * loads the panel module (inventory/help/settings/pause, src/ui/exploreHud.ts)
 * on first use, so the startup bundle stays within budget (+15 %).
 */
import type { ExploreUi } from '../scene/ExploreController'
import type { Action } from '../input/actions'
import { labelFor } from '../input/layoutLabels'
import type { ExploreHud, ExploreHudDeps, PanelId } from './exploreHud'

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export class ExploreToolbar implements ExploreUi {
  private el: HTMLElement
  private hud: ExploreHud | null = null
  private loading: Promise<ExploreHud> | null = null

  constructor(private deps: Omit<ExploreHudDeps, 'onPanelsChanged'>) {
    this.el = document.createElement('nav')
    this.el.id = 'explore-toolbar'
    this.el.setAttribute('aria-label', 'Contrôles du monde 3D')
    deps.root.appendChild(this.el)
    this.render()
  }

  private panels(): Promise<ExploreHud> {
    this.loading ??= import('./exploreHud').then(({ ExploreHud: Hud }) => {
      this.hud = new Hud({ ...this.deps, onPanelsChanged: () => this.render() })
      return this.hud
    })
    return this.loading
  }

  // ── ExploreUi ───────────────────────────────────────────────────────────────
  panelCount(): number {
    return this.hud?.panelCount() ?? 0
  }
  closeTopPanel(): void {
    this.hud?.closeTopPanel()
  }
  toggleInventory(): void {
    void this.panels().then((h) => h.toggleInventory())
  }
  toggleHelp(): void {
    void this.panels().then((h) => h.toggleHelp())
  }
  openPause(): void {
    void this.panels().then((h) => h.openPause())
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

  /** Re-render labels after a view switch or a settings change. */
  refresh(): void {
    this.render()
  }

  // ── toolbar ─────────────────────────────────────────────────────────────────
  private key(action: Action): string {
    return this.deps.settings().bindings[action].map((c) => labelFor(c, this.deps.layout, this.deps.layoutMap))[0] ?? '—'
  }

  private open(id: PanelId): boolean {
    return this.hud?.isOpen(id) ?? false
  }

  private render(): void {
    const view = this.deps.currentView()
    this.el.innerHTML = `
      <button type="button" data-act="inventory" aria-pressed="${this.open('inventory')}">Inventaire <kbd>${esc(this.key('TOGGLE_INVENTORY'))}</kbd></button>
      <button type="button" data-act="view" aria-pressed="${view === 'explore'}" title="Exploration : marcher dans la salle. Orbite : tourner autour du matériel.">Vue : ${view === 'explore' ? 'Exploration' : 'Orbite'} <kbd>${esc(this.key('TOGGLE_VIEW'))}</kbd></button>
      <button type="button" data-act="help" aria-pressed="${this.open('help')}">Aide <kbd>${esc(this.key('TOGGLE_HELP'))}</kbd></button>
      <button type="button" data-act="settings" aria-pressed="${this.open('settings')}">Réglages</button>`
    this.el.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
      b.addEventListener('click', () => {
        const act = b.dataset.act
        if (act === 'inventory') this.toggleInventory()
        else if (act === 'help') this.toggleHelp()
        else if (act === 'settings') void this.panels().then((h) => h.toggleSettings())
        else if (act === 'view') {
          this.deps.toggleView()
          this.render()
        }
      }),
    )
  }
}
