/**
 * Explore HUD (ADR-0010 Décisions 8–9): toolbar, inventory (Space), controls
 * help (H), settings with key remapping, pause menu (Esc in Explore).
 * Implements the ExploreUi surface the ExploreController drives. DOM only:
 * placement goes through the Placement scene adapter, pick-up through an
 * injected callback that dispatches an intent — the graph is never touched here.
 */
import type { ExploreUi, BaseView } from '../scene/ExploreController'
import type { Placement } from '../scene/Placement'
import { ACTIONS, type Action } from '../input/actions'
import { rebind } from '../input/bindings'
import { labelFor, type Layout } from '../input/layoutLabels'
import { ACTION_LABELS, controlsHelp, MOUSE_HELP } from './controlsHelp'
import { buildInventoryModel, type InventoryDevice, type KbSheets } from './inventoryModel'
import { DEFAULT_SETTINGS, type ExploreSettings } from './exploreSettings'

export interface ExploreHudDeps {
  root: HTMLElement
  devices: readonly InventoryDevice[]
  sandbox: boolean
  settings(): ExploreSettings
  onSettings(s: ExploreSettings): void
  layout: Layout
  layoutMap?: ReadonlyMap<string, string>
  placement: Placement
  /** Placement aims while walking: switch to Explore first. */
  ensureExplore(): void
  pickUp(instanceId: string): void
  toggleView(): void
  currentView(): BaseView
}

type PanelId = 'inventory' | 'help' | 'settings' | 'pause'

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export class ExploreHud implements ExploreUi {
  private stack: { id: PanelId; el: HTMLElement; returnFocus: Element | null }[] = []
  private sheets: KbSheets | null = null
  private capture: Action | null = null
  private toolbar: HTMLElement

  constructor(private deps: ExploreHudDeps) {
    this.toolbar = document.createElement('nav')
    this.toolbar.id = 'explore-toolbar'
    this.toolbar.setAttribute('aria-label', 'Contrôles du monde 3D')
    deps.root.appendChild(this.toolbar)
    this.renderToolbar()
    // Key capture for remapping runs after the controller (which yields while capturing).
    window.addEventListener('keydown', this.onCaptureKey, true)
  }

  // ── ExploreUi ───────────────────────────────────────────────────────────────
  panelCount(): number {
    return this.stack.length
  }
  closeTopPanel(): void {
    const top = this.stack.pop()
    if (!top) return
    top.el.remove()
    ;(top.returnFocus as HTMLElement | null)?.focus?.()
    this.renderToolbar()
  }
  toggleInventory(): void {
    this.toggle('inventory', () => this.buildInventory())
  }
  toggleHelp(): void {
    this.toggle('help', () => this.buildHelp())
  }
  openPause(): void {
    if (!this.isOpen('pause')) this.open('pause', this.buildPause())
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
    return this.capture !== null
  }

  /** Re-render labels after a view switch or settings change. */
  refresh(): void {
    this.renderToolbar()
  }

  // ── panels ──────────────────────────────────────────────────────────────────
  private isOpen(id: PanelId): boolean {
    return this.stack.some((p) => p.id === id)
  }

  private toggle(id: PanelId, build: () => HTMLElement): void {
    if (this.stack.length && this.stack[this.stack.length - 1].id === id) {
      this.closeTopPanel()
      return
    }
    if (this.isOpen(id)) return
    this.open(id, build())
  }

  private open(id: PanelId, el: HTMLElement): void {
    el.classList.add('ex-panel')
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-modal', 'true')
    el.dataset.panel = id
    el.addEventListener('keydown', (e) => this.trapTab(e, el))
    const returnFocus = document.activeElement
    this.deps.root.appendChild(el)
    this.stack.push({ id, el, returnFocus })
    ;(el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>(FOCUSABLE))?.focus()
    this.renderToolbar()
  }

  private trapTab(e: KeyboardEvent, el: HTMLElement): void {
    if (e.key !== 'Tab') return
    const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => !x.hasAttribute('disabled'))
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  private panel(title: string, id: string, body: string): HTMLElement {
    const el = document.createElement('section')
    el.setAttribute('aria-labelledby', `${id}-title`)
    el.innerHTML = `<header class="ex-head"><h2 id="${id}-title">${esc(title)}</h2>
      <button type="button" class="ex-close" aria-label="Fermer (Échap)">×</button></header>${body}`
    el.querySelector('.ex-close')!.addEventListener('click', () => this.closeTopPanel())
    return el
  }

  // ── toolbar ─────────────────────────────────────────────────────────────────
  private key(action: Action): string {
    return this.deps.settings().bindings[action].map((c) => labelFor(c, this.deps.layout, this.deps.layoutMap))[0] ?? '—'
  }

  private renderToolbar(): void {
    const view = this.deps.currentView()
    this.toolbar.innerHTML = `
      <button type="button" data-act="inventory" aria-pressed="${this.isOpen('inventory')}">Inventaire <kbd>${esc(this.key('TOGGLE_INVENTORY'))}</kbd></button>
      <button type="button" data-act="view" aria-pressed="${view === 'explore'}" title="Exploration : marcher dans la salle. Orbite : tourner autour du matériel.">Vue : ${view === 'explore' ? 'Exploration' : 'Orbite'} <kbd>${esc(this.key('TOGGLE_VIEW'))}</kbd></button>
      <button type="button" data-act="help" aria-pressed="${this.isOpen('help')}">Aide <kbd>${esc(this.key('TOGGLE_HELP'))}</kbd></button>
      <button type="button" data-act="settings" aria-pressed="${this.isOpen('settings')}">Réglages</button>`
    this.toolbar.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
      b.addEventListener('click', () => {
        const act = b.dataset.act
        if (act === 'inventory') this.toggleInventory()
        else if (act === 'help') this.toggleHelp()
        else if (act === 'settings') this.toggle('settings', () => this.buildSettings())
        else if (act === 'view') {
          this.deps.toggleView()
          this.renderToolbar()
        }
      }),
    )
  }

  // ── inventory ───────────────────────────────────────────────────────────────
  private buildInventory(): HTMLElement {
    const el = this.panel(
      'Inventaire',
      'ex-inv',
      `<div class="ex-inv">
        <div class="ex-inv-list">
          <label class="ex-search"><span class="sr-only">Rechercher du matériel</span>
            <input type="search" data-autofocus placeholder="Rechercher (micro, console, Shure…)" autocomplete="off" /></label>
          <div class="ex-inv-groups" aria-live="polite"></div>
        </div>
        <aside class="ex-inv-sheet" aria-live="polite"><p class="ex-muted">Choisis un appareil pour voir sa fiche.</p></aside>
      </div>`,
    )
    el.classList.add('ex-panel-wide')
    const input = el.querySelector<HTMLInputElement>('input')!
    const render = (): void => this.renderInventory(el, input.value)
    input.addEventListener('input', render)
    render()
    if (!this.sheets) void this.ensureSheets().then(() => el.isConnected && render())
    return el
  }

  private sheetsLoad: Promise<KbSheets> | null = null

  /** KB sheets are a lazy chunk (not in the startup bundle); one shared load. */
  private ensureSheets(): Promise<KbSheets> {
    this.sheetsLoad ??= import('../../content/kb-sheets.json')
      .then((m) => (this.sheets = (m.default ?? m) as unknown as KbSheets))
      .catch(() => (this.sheets = { categories: {}, devices: {} }))
    return this.sheetsLoad
  }

  private renderInventory(el: HTMLElement, query: string): void {
    const sheets: KbSheets = this.sheets ?? { categories: {}, devices: {} }
    const model = buildInventoryModel(this.deps.devices, sheets, query, this.deps.sandbox)
    const groups = el.querySelector<HTMLElement>('.ex-inv-groups')!
    groups.innerHTML = model.groups.length
      ? model.groups
          .map(
            (g) => `<section><h3>${esc(g.label)} <span class="ex-muted">(${g.items.length})</span></h3>
              ${g.items.map((i) => `<button type="button" class="ex-item" data-device="${esc(i.id)}">${esc(i.label)}</button>`).join('')}</section>`,
          )
          .join('')
      : `<p class="ex-muted">Aucun appareil ne correspond à « ${esc(query)} ».</p>`
    groups.querySelectorAll<HTMLButtonElement>('.ex-item').forEach((b) =>
      b.addEventListener('click', () => this.renderSheet(el, b.dataset.device!)),
    )
  }

  private renderSheet(el: HTMLElement, deviceId: string): void {
    if (!this.sheets) {
      void this.ensureSheets().then(() => el.isConnected && this.renderSheet(el, deviceId))
      return
    }
    const device = this.deps.devices.find((d) => d.id === deviceId)
    if (!device) return
    const sheet = this.sheets.devices[deviceId] ?? null
    const specs = sheet?.keySpecs.length
      ? `<dl>${sheet.keySpecs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`
      : '<p class="ex-muted">Pas de fiche sourcée dans la base de connaissances pour cet appareil.</p>'
    const connectors = sheet?.connectors.length ? `<p><strong>Connecteurs :</strong> ${sheet.connectors.map(esc).join(', ')}</p>` : ''
    const manual = sheet?.manualUrl
      ? `<p><a href="${esc(sheet.manualUrl)}" target="_blank" rel="noopener noreferrer">Manuel officiel${sheet.manualLanguages.length ? ` (${sheet.manualLanguages.map(esc).join(', ')})` : ''} ↗</a></p>`
      : ''
    const place = this.deps.sandbox
      ? `<button type="button" class="ex-primary" data-place="${esc(deviceId)}">Placer dans le monde</button>
         <p class="ex-muted">Vise le sol, <kbd>${esc(this.key('ROTATE_PLACEMENT'))}</kbd> pour tourner, clic pour poser, <kbd>Échap</kbd> pour annuler.</p>`
      : '<p class="ex-muted">Le placement libre est disponible dans la Sandbox. Dans un niveau, le matériel est déjà posé.</p>'
    const aside = el.querySelector<HTMLElement>('.ex-inv-sheet')!
    aside.innerHTML = `<h3>${esc(device.label)}</h3><p class="ex-muted">${esc(device.realWorld.brand)} · ${esc(device.realWorld.model)}</p>${specs}${connectors}${manual}${place}`
    aside.querySelector<HTMLButtonElement>('[data-place]')?.addEventListener('click', () => {
      while (this.stack.length) this.closeTopPanel()
      this.deps.ensureExplore()
      this.deps.placement.start(deviceId)
    })
  }

  // ── help ────────────────────────────────────────────────────────────────────
  private buildHelp(): HTMLElement {
    const rows = controlsHelp(this.deps.settings().bindings, this.deps.layout, this.deps.layoutMap)
    return this.panel(
      'Contrôles',
      'ex-help',
      `<div class="ex-help">
        <section><h3>Clavier + souris</h3><table><tbody>
          ${rows.map((r) => `<tr><td>${r.keys.map((k) => `<kbd>${esc(k)}</kbd>`).join(' ')}</td><td>${esc(r.label)} <span class="ex-muted" lang="en">(${esc(r.english)})</span></td></tr>`).join('')}
          <tr><td>Souris (capturée)</td><td>Regarder autour de soi</td></tr>
        </tbody></table></section>
        <section><h3>Souris seule</h3><table><tbody>
          ${MOUSE_HELP.map((m) => `<tr><td>${esc(m.gesture)}</td><td>${esc(m.action)}</td></tr>`).join('')}
        </tbody></table>
        <p class="ex-muted">Clic sur un appareil : focus et ports (comme avant). Les touches suivent la position physique du clavier (AZERTY ou QWERTY) et se changent dans Réglages.</p></section>
      </div>`,
    )
  }

  // ── pause ───────────────────────────────────────────────────────────────────
  private buildPause(): HTMLElement {
    const el = this.panel(
      'Pause',
      'ex-pause',
      `<div class="ex-pause">
        <button type="button" class="ex-primary" data-autofocus data-act="resume">Reprendre</button>
        <button type="button" data-act="settings">Réglages</button>
        <button type="button" data-act="help">Aide des contrôles</button>
        <a href="/">Retour au tableau de bord</a>
      </div>`,
    )
    el.querySelector('[data-act="resume"]')!.addEventListener('click', () => this.closeTopPanel())
    el.querySelector('[data-act="settings"]')!.addEventListener('click', () => this.open('settings', this.buildSettings()))
    el.querySelector('[data-act="help"]')!.addEventListener('click', () => this.open('help', this.buildHelp()))
    return el
  }

  // ── settings ────────────────────────────────────────────────────────────────
  private buildSettings(): HTMLElement {
    const s = this.deps.settings()
    const opt = (v: string, label: string, cur: string) => `<option value="${v}"${v === cur ? ' selected' : ''}>${label}</option>`
    const el = this.panel(
      'Réglages',
      'ex-set',
      `<form class="ex-settings" onsubmit="return false">
        <label>Vitesse de marche <input type="range" name="speedMult" min="0.25" max="3" step="0.25" value="${s.speedMult}" data-autofocus /><output>${s.speedMult}×</output></label>
        <label>Sensibilité de la souris <input type="range" name="sensitivity" min="0.2" max="3" step="0.1" value="${s.sensitivity}" /><output>${s.sensitivity}×</output></label>
        <label>Champ de vision <input type="range" name="fovDeg" min="40" max="100" step="5" value="${s.fovDeg}" /><output>${s.fovDeg}°</output></label>
        <label class="ex-check"><input type="checkbox" name="invertY"${s.invertY ? ' checked' : ''} /> Inverser l’axe vertical</label>
        <label>Mouvements réduits <select name="reducedMotion">${opt('system', 'Comme le système', s.reducedMotion)}${opt('on', 'Activés', s.reducedMotion)}${opt('off', 'Désactivés', s.reducedMotion)}</select></label>
        <label>Capture de la souris <select name="pointerLock">${opt('auto', 'Auto (après avoir marché au clavier)', s.pointerLock)}${opt('always', 'Toujours au clic', s.pointerLock)}${opt('never', 'Jamais (souris seule)', s.pointerLock)}</select></label>
        <label>Vue par défaut dans les niveaux <select name="levelView">${opt('orbit', 'Orbite', s.levelView)}${opt('explore', 'Exploration', s.levelView)}</select></label>
        <h3>Touches</h3>
        <table class="ex-binds"><tbody>${ACTIONS.map(
          (a) => `<tr><td>${esc(ACTION_LABELS[a].fr)}</td><td><kbd>${esc(s.bindings[a].map((c) => labelFor(c, this.deps.layout, this.deps.layoutMap)).join(' / '))}</kbd></td>
            <td><button type="button" data-bind="${a}">Changer</button></td></tr>`,
        ).join('')}</tbody></table>
        <p class="ex-capture" role="status" hidden></p>
        <button type="button" data-act="reset">Rétablir les réglages par défaut</button>
      </form>`,
    )
    const form = el.querySelector<HTMLFormElement>('form')!
    form.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement | HTMLSelectElement
      if (!t.name) return
      const cur = this.deps.settings()
      const value: unknown = t instanceof HTMLInputElement && t.type === 'checkbox' ? t.checked : t instanceof HTMLInputElement && t.type === 'range' ? Number(t.value) : t.value
      const out = t.parentElement?.querySelector('output')
      if (out) out.textContent = t.name === 'fovDeg' ? `${value}°` : `${value}×`
      this.deps.onSettings({ ...cur, [t.name]: value } as ExploreSettings)
      this.renderToolbar()
    })
    form.querySelectorAll<HTMLButtonElement>('[data-bind]').forEach((b) =>
      b.addEventListener('click', () => {
        this.capture = b.dataset.bind as Action
        const status = form.querySelector<HTMLElement>('.ex-capture')!
        status.hidden = false
        status.textContent = `Appuie sur la nouvelle touche pour « ${ACTION_LABELS[this.capture].fr} » (Échap pour annuler).`
      }),
    )
    form.querySelector('[data-act="reset"]')!.addEventListener('click', () => {
      this.deps.onSettings(DEFAULT_SETTINGS)
      this.closeTopPanel()
      this.open('settings', this.buildSettings())
    })
    return el
  }

  private onCaptureKey = (e: KeyboardEvent): void => {
    if (!this.capture) return
    e.preventDefault()
    e.stopPropagation()
    const action = this.capture
    this.capture = null
    if (e.code !== 'Escape') {
      const cur = this.deps.settings()
      this.deps.onSettings({ ...cur, bindings: rebind(cur.bindings, action, [e.code]) })
    }
    // Rebuild the settings panel in place so the table shows the new key.
    if (this.stack.length && this.stack[this.stack.length - 1].id === 'settings') {
      this.closeTopPanel()
      this.open('settings', this.buildSettings())
    }
    this.renderToolbar()
  }
}
