// @vitest-environment jsdom
/**
 * Mission 3 fixes, item 3 (review finding A): the 2D page's send report and its replace confirmation name the 3D page's undo with the label the 3D page lends
 * (boot.ts `undoLabel`): on a coarse pointer « « Annuler » (menu Projet) dans la scène 3D … », never « Ctrl+Z dans la scène 3D ». The send itself is untouched
 * (tests/plan2d/spawn3d.test.ts is not changed and keeps the desktop words).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { History } from '../../src/creation/history'
import { floorPlanSvg } from '../../src/creation/roomPlanSvg'
import { coarsePointer } from '../../src/creation/input/coarsePointer'
import { undoLabelFor } from '../../src/creation/undoWording'
import type { DesignState } from '../../src/trials/trial'
import { applyIntent, emptyPlan, type Plan2D, type PlanIntent } from '../../src/plan2d/model'
import { planKey, savePlan } from '../../src/plan2d/persist'
import type { SpawnTarget } from '../../src/plan2d/spawn3d'
import { openPlan2dPage, type Plan2dPage } from '../../src/plan2d/view'

const registry = loadCatalog(catalogJson)
const room = { key: 'blank', name: 'Salle vide neutre', width: 24, length: 14, outline: floorPlanSvg(24, 14) }
const phone = { matchMedia: (q: string) => ({ matches: q === '(pointer: coarse)' }) } as unknown as Window
const desk = { matchMedia: () => ({ matches: false }) } as unknown as Window

function memory(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}
const build = (...intents: PlanIntent[]): Plan2D =>
  intents.reduce((p, i) => {
    const r = applyIntent(p, i)
    if (!r.ok) throw new Error(r.message)
    return r.plan
  }, emptyPlan('blank'))
const duo = (): Plan2D =>
  build(
    { type: 'place', deviceId: 'midas-m32', x: 0, z: 0 },
    { type: 'place', deviceId: 'qsc-k12-2', x: -2, z: 3, rot: 90 },
    { type: 'connect', a: { dev: 'midas-m32-1', port: 'out-main-l' }, b: { dev: 'qsc-k12-2-1', port: 'in-line-a' } },
  )
const gear = (): DesignState => ({
  roomId: 'blank',
  rig: { instances: [{ instanceId: 'qsc-k12-2-1', deviceId: 'qsc-k12-2' }], connections: [], controls: {} },
  placements: [{ instanceId: 'qsc-k12-2-1', deviceId: 'qsc-k12-2', position_m: [5, 0, 5], yawDeg: 30 }],
})

let page: Plan2dPage | null = null
const q = <T extends Element = HTMLElement>(sel: string): T | null => document.querySelector<T>(sel)
const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}
function openOn(win: Window, initial?: DesignState) {
  const storage = memory()
  savePlan(storage, planKey(null, 'blank'), duo())
  const store = new CreationStore(registry, creationEvaluator(registry), initial)
  const history = new History(store)
  // the 3D page's own label, as boot.ts builds it: the key map's « Ctrl+Z », or « Annuler » on a coarse pointer
  const target: SpawnTarget = {
    design: () => store.design(),
    roomBounds: () => ({ minX: -12, maxX: 12, minZ: -7, maxZ: 7 }),
    floorAt: () => 0,
    apply: (intents, label) => history.doAll(intents, label),
    replace: (design, label) => history.do({ type: 'APPLY_DESIGN', design }, label).ok,
    undoLabel: () => undoLabelFor('Ctrl+Z', coarsePointer(win)),
    show: () => undefined,
  }
  page = openPlan2dPage({ doc: document, registry, room, storage, projectName: null, reducedMotion: () => true, spawn: target })
}
const send = async (choice: string): Promise<void> => {
  q<HTMLButtonElement>('[data-testid="plan2d-spawn"]')!.click()
  q('[data-testid="plan2d-spawn-dialog"]')!.querySelector<HTMLButtonElement>(`[data-choice="${choice}"]`)!.click()
  await flush()
}

describe('the 2D send words on a phone', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
  })
  afterEach(() => {
    page?.close()
    page = null
  })

  it('« Ajouter »: the report (and its announcement) names « Annuler » (menu Projet) in the 3D view', async () => {
    openOn(phone)
    await send('add')
    const report = q('[data-testid="plan2d-report"]')!.textContent!
    expect(report).toContain('Ajoutés dans la scène 3D : 2 appareils et 1 câble, aux mêmes places. « Annuler » (menu Projet) dans la scène 3D les retire en une fois.')
    expect(report).not.toContain('Ctrl')
    expect(q('[data-testid="plan2d-live"]')!.textContent).not.toContain('Ctrl')
  })

  it('« Remplacer le matériel »: the confirmation and the report name « Annuler » (menu Projet)', async () => {
    openOn(phone, gear())
    await send('replace')
    const sure = q('[data-testid="plan2d-replace-dialog"]')!
    expect(sure.textContent).toContain('« Annuler » (menu Projet) dans la scène 3D permet de revenir en arrière.')
    expect(sure.textContent).not.toContain('Ctrl')
    sure.querySelector<HTMLButtonElement>('[data-choice="replace"]')!.click()
    await flush()
    expect(q('[data-testid="plan2d-report"]')!.textContent).toContain('« Annuler » (menu Projet) dans la scène 3D revient en arrière.')
  })

  it('on a fine pointer the words are the old ones, byte for byte', async () => {
    openOn(desk)
    await send('add')
    expect(q('[data-testid="plan2d-report"]')!.textContent).toContain('aux mêmes places. Ctrl+Z dans la scène 3D les retire en une fois.')
  })
})
