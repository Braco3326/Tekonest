/**
 * Wave 0, Task 0.6: a Bêta proposal that has a shipped model (beta-modelled: a model at an ESTIMATED size) shows « Bêta — dimensions estimées »;
 * one without a model keeps the plain « non vérifié ». Both stay unverified and badged, never read as verified. Model level and drawer level.
 */
import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { COPY } from '../../src/creation/copy'
import { inventory } from '../../src/creation/inventory'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { mountInventoryDrawer } from '../../src/creation/shell/inventoryDrawer'

const registry = loadCatalog(catalogJson)
const allModels: ReadonlySet<string> = new Set(registry.catalog.devices.map((d) => d.id))

describe('inventory(): the badge of a proposal depends on whether a model ships for it', () => {
  const proposals = [
    { deviceId: 'p-modelled', label: 'Modélisé' },
    { deviceId: 'p-plain', label: 'Sans modèle' },
  ]
  const models = new Set([...allModels, 'p-modelled'])

  it('a proposal with a manifest model shows the estimated-size badge', () => {
    const it = inventory(registry, { proposals, modelIds: models }).items.find((i) => i.deviceId === 'p-modelled')!
    expect(it.tab).toBe('beta')
    expect(it.hasModel).toBe(true)
    expect(it.badge).toBe('dimensions estimées')
  })
  it('a proposal without a model shows the plain Bêta badge', () => {
    const it = inventory(registry, { proposals, modelIds: models }).items.find((i) => i.deviceId === 'p-plain')!
    expect(it.hasModel).toBe(false)
    expect(it.badge).toBe('non vérifié')
  })
  it('a modelled proposal whose size is verified (Wave 1b) says its connectors are unverified; an unlisted modelled one keeps the estimated-size badge', () => {
    const sizeVerified = new Set(['p-modelled'])
    const r = inventory(registry, { proposals: [...proposals, { deviceId: 'p-modelled-estimate', label: 'Estimé' }], modelIds: new Set([...models, 'p-modelled-estimate']), sizeVerified })
    expect(r.items.find((i) => i.deviceId === 'p-modelled')!.badge).toBe('connecteurs non vérifiés')
    expect(r.items.find((i) => i.deviceId === 'p-modelled-estimate')!.badge).toBe('dimensions estimées')
    expect(r.items.find((i) => i.deviceId === 'p-plain')!.badge).toBe('non vérifié')
    // a verified size without a model is still the plain badge
    expect(inventory(registry, { proposals, modelIds: new Set(allModels), sizeVerified: new Set(['p-plain']) }).items.find((i) => i.deviceId === 'p-plain')!.badge).toBe('non vérifié')
  })
  it('a catalogue device never carries a badge, a modelled proposal never loses its badge (it is still unverified), and the texts are the deck ones', () => {
    const r = inventory(registry, { proposals, modelIds: models })
    for (const i of r.items) expect(Boolean(i.badge), i.deviceId).toBe(i.tab === 'beta')
    expect(COPY.inventory!.badgeEstimated).toBe('Bêta — dimensions estimées')
    expect(COPY.inventory!.badgeUnverified).toBe('non vérifié')
    expect(COPY.inventory!.tipEstimated).toMatch(/estimées/)
    expect(COPY.inventory!.tipEstimated).toMatch(/non vérifiée/)
    expect(COPY.inventory!.badgePorts).toBe('Bêta — connecteurs non vérifiés')
    expect(COPY.inventory!.tipPorts).toMatch(/connecteurs ne sont pas vérifiés/)
  })
})

// ── the drawer, on a minimal fake DOM (Node has none) ──────────────────────────────────────────────────────────────────

class FakeEl {
  children: FakeEl[] = []
  dataset: Record<string, string> = {}
  attrs: Record<string, string> = {}
  className = ''
  textContent = ''
  title = ''
  id = ''
  value = ''
  type = ''
  listeners = new Map<string, ((e: Record<string, unknown>) => void)[]>()
  inert = false
  scrollHeight = 0
  clientHeight = 0
  constructor(readonly tag: string) {}
  setAttribute(k: string, v: string): void {
    this.attrs[k] = v
  }
  removeAttribute(): void {}
  append(...c: FakeEl[]): void {
    this.children.push(...c)
  }
  appendChild(c: FakeEl): FakeEl {
    this.children.push(c)
    return c
  }
  replaceChildren(...c: FakeEl[]): void {
    this.children = c
  }
  removeChild(c: FakeEl): FakeEl {
    this.children = this.children.filter((x) => x !== c)
    return c
  }
  replaceWith(): void {}
  addEventListener(t: string, fn: (e: Record<string, unknown>) => void): void {
    this.listeners.set(t, [...(this.listeners.get(t) ?? []), fn])
  }
  removeEventListener(): void {}
  fire(t: string, e: Record<string, unknown> = {}): void {
    for (const fn of this.listeners.get(t) ?? []) fn(e)
  }
  focus(): void {}
  getBoundingClientRect(): object {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  get style(): Record<string, unknown> {
    return { setProperty() {}, getPropertyValue: () => '' }
  }
  get classList(): { add(): void; remove(): void; toggle(): void } {
    return { add() {}, remove() {}, toggle() {} }
  }
}

describe('the drawer item of a proposal', () => {
  it('shows « Bêta — dimensions estimées » (and its tooltip) for a modelled proposal, « non vérifié » for the others; the sr-only description is the same sentence', () => {
    const win = { addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, getComputedStyle: () => ({ getPropertyValue: () => '' }), requestAnimationFrame: (f: () => void) => f() }
    ;(globalThis as Record<string, unknown>).getComputedStyle ??= win.getComputedStyle
    const created: FakeEl[] = []
    const doc = {
      defaultView: win,
      activeElement: null,
      createElement: (tag: string) => {
        const e = new FakeEl(tag)
        created.push(e)
        return e
      },
      createElementNS: (_ns: string, tag: string) => new FakeEl(tag),
    }
    const drawer = mountInventoryDrawer({
      doc: doc as never,
      parent: new FakeEl('div') as never,
      registry,
      // `rca` is a connector with a shipped model in the manifest and no catalogue device: the stand-in for a Bêta proposal that has a model
      proposals: () => [{ deviceId: 'rca', label: 'Proposé avec modèle' }, { deviceId: 'p-no-model', label: 'Proposé sans modèle' }, { deviceId: 'presonus-hp4', label: 'Taille vérifiée' }],
      betaStatus: () => 'ready' as const,
      onChoose() {},
      returnFocus() {},
      isToggleKey: () => false,
      keyLabel: () => 'Espace',
    })
    drawer.open()
    // select the Bêta tab (a click on its button, as a user does)
    created.find((e) => e.className === 'cr-drawer-tab' && e.dataset.tab === 'beta')!.fire('click')
    const betaItems = (): FakeEl[] => created.filter((e) => e.className === 'cr-inv-item' && e.dataset.beta === 'true')
    expect(betaItems().length).toBeGreaterThanOrEqual(2)
    const texts = created.filter((e) => e.className === 'cr-inv-badge').map((e) => e.textContent)
    expect(texts).toContain(COPY.inventory!.badgeEstimated)
    expect(texts).toContain(COPY.inventory!.badgeUnverified)
    const modelled = betaItems().find((b) => b.dataset.deviceId === 'rca')!
    expect(modelled.title).toBe(COPY.inventory!.tipEstimated)
    // Wave 1b: the HP4 has a datasheet size (plan, sizeConfidence ok): its connectors are the unverified part
    expect(texts).toContain(COPY.inventory!.badgePorts)
    expect(betaItems().find((b) => b.dataset.deviceId === 'presonus-hp4')!.title).toBe(COPY.inventory!.tipPorts)
    const plain = betaItems().find((b) => b.dataset.deviceId === 'p-no-model')!
    expect(plain.title).toBe(COPY.inventory!.tipUnverified)
  })
})
