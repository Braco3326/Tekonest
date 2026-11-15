// @vitest-environment jsdom
/**
 * The 2D schema page in Mode Création (mission 2; src/creation/plan2dWiring.ts): the page's code is fetched only when it is opened, never on an exam
 * address, only with a place on screen; it opens on the current place with the project's name, and when it closes the focus goes back to the 3D view.
 * The menu entry « Schéma 2D » (Vue) exists only where the page registered it. The 3D store is never handed to the page.
 */
import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { wirePlan2d, type Plan2dWiringDeps } from '../../src/creation/plan2dWiring'
import { blankData } from '../../src/creation/placeData'
import { buildMenus } from '../../src/creation/shell/menuModel'
import { History } from '../../src/creation/history'
import { CreationStore, creationEvaluator } from '../../src/creation/store'

const registry = loadCatalog(catalogJson)
const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

function deps(over: Partial<Plan2dWiringDeps> = {}): { d: Plan2dWiringDeps; state: { loads: number; opened: unknown[]; focused: number }; closeNow(): void } {
  const state = { loads: 0, opened: [] as unknown[], focused: 0 }
  let close: () => void = () => undefined
  const d: Plan2dWiringDeps = {
    doc: document,
    registry,
    placeKey: () => 'blank',
    placeName: () => 'Salle vide neutre',
    projectName: () => 'Mon projet',
    storage: () => null,
    practiceNow: () => true,
    returnFocus: () => void state.focused++,
    loadPlace: async () => blankData(),
    load: async () => {
      state.loads++
      return {
        outlineOf: () => '<svg></svg>',
        openPlan2dPage: (o: unknown) => {
          state.opened.push(o)
          const closed = new Promise<void>((r) => (close = r))
          return { closed, close: () => close(), history: null as never, root: document.body }
        },
      } as unknown as typeof import('../../src/plan2d/view')
    },
    ...over,
  }
  return { d, state, closeNow: () => close() }
}

describe('the 2D schema page wiring', () => {
  it('fetches nothing before it is opened; opening loads the page once with the place and the project, and closing gives the focus back', async () => {
    const { d, state, closeNow } = deps()
    const w = wirePlan2d(d)
    expect(state.loads).toBe(0)
    const p = w.open()
    await flush()
    expect(state.loads).toBe(1)
    expect(w.isOpen).toBe(true)
    expect(state.opened[0]).toMatchObject({ room: { key: 'blank', name: 'Salle vide neutre', width: 24, length: 14 }, projectName: 'Mon projet' })
    expect(Object.keys(state.opened[0] as object)).not.toContain('store')
    void w.open() // a second ask while it is open does nothing
    await flush()
    expect(state.opened).toHaveLength(1)
    closeNow()
    await p
    expect(w.isOpen).toBe(false)
    expect(state.focused).toBe(1)
  })

  it('never on an exam address, and never without a place on screen', async () => {
    const exam = deps({ practiceNow: () => false })
    await wirePlan2d(exam.d).open()
    expect(exam.state.loads).toBe(0)
    const none = deps({ placeKey: () => null })
    await wirePlan2d(none.d).open()
    expect(none.state.loads).toBe(0)
  })

  it('a page that cannot load says nothing alarming and gives the focus back', async () => {
    const { d, state } = deps({ load: async () => Promise.reject(new Error('offline')) })
    await wirePlan2d(d).open()
    expect(state.focused).toBe(1)
  })

  it('the menu entry « Schéma 2D » is in Vue only where the page registered it, and off while no place is on screen', () => {
    const store = new CreationStore(registry, creationEvaluator(registry))
    const history = new History(store)
    const vue = (actions: Record<string, () => void>, locked = false) =>
      buildMenus({ history, actions, bindingLabel: () => undefined, viewLocked: () => locked }).find((m) => m.id === 'vue')!.items
    expect(vue({}).some((i) => i.id === 'plan2d')).toBe(false)
    const item = vue({ plan2d: () => undefined }).find((i) => i.id === 'plan2d')!
    expect(item.label).toBe('Schéma 2D')
    expect(item.enabled()).toBe(true)
    expect(item.returnFocus).toBe(false)
    expect(vue({ plan2d: () => undefined }, true).find((i) => i.id === 'plan2d')!.enabled()).toBe(false)
  })
})
