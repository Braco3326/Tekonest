import { describe, expect, it } from 'vitest'
import { buildMenus, type MenuContext, type MenuItem } from '../../src/creation/shell/menuModel'
import type { History } from '../../src/creation/history'

const fakeHistory = (canUndo: boolean, canRedo: boolean): History =>
  ({ canUndo, canRedo, undo: () => canUndo, redo: () => canRedo }) as unknown as History

const ctx = (over: Partial<MenuContext> = {}): MenuContext => ({
  history: fakeHistory(false, false),
  actions: {},
  bindingLabel: (a) => ({ undo: 'Ctrl+Z', redo: 'Ctrl+Y' })[a],
  ...over,
})

const all = (items: MenuItem[]): MenuItem[] => items.flatMap((i) => [i, ...all(i.children ?? [])])
const find = (menus: ReturnType<typeof buildMenus>, id: string): MenuItem =>
  menus.flatMap((m) => all(m.items)).find((i) => i.id === id)!

describe('menu model (Task 7)', () => {
  it('7 menus in order Projet · Lieu · Matériel · Câblage · Écoute · Vue · Aide', () => {
    const menus = buildMenus(ctx())
    expect(menus.map((m) => m.id)).toEqual(['projet', 'lieu', 'materiel', 'cablage', 'ecoute', 'vue', 'aide'])
    expect(menus.map((m) => m.label)).toEqual(['Projet', 'Lieu', 'Matériel', 'Câblage', 'Écoute', 'Vue', 'Aide'])
    for (const m of menus) expect(m.items.length).toBeGreaterThan(0)
  })
  it('Annuler / Rétablir follow history.canUndo / canRedo and show their shortcut labels', () => {
    let menus = buildMenus(ctx())
    expect(find(menus, 'undo').label).toBe('Annuler')
    expect(find(menus, 'redo').label).toBe('Rétablir')
    expect(find(menus, 'undo').enabled()).toBe(false)
    expect(find(menus, 'redo').enabled()).toBe(false)
    expect(find(menus, 'undo').shortcut).toBe('Ctrl+Z')
    expect(find(menus, 'redo').shortcut).toBe('Ctrl+Y')
    menus = buildMenus(ctx({ history: fakeHistory(true, true) }))
    expect(find(menus, 'undo').enabled()).toBe(true)
    expect(find(menus, 'redo').enabled()).toBe(true)
  })
  it('no shortcut shown when no key is bound', () => {
    const menus = buildMenus(ctx({ bindingLabel: () => undefined }))
    expect(find(menus, 'undo').shortcut).toBeUndefined()
  })
  it('Annuler runs history.undo', () => {
    let undone = 0
    const h = { canUndo: true, canRedo: false, undo: () => (undone++, true), redo: () => false } as unknown as History
    find(buildMenus(ctx({ history: h })), 'undo').run()
    expect(undone).toBe(1)
  })
  it('history locked (place picker open): Annuler / Rétablir are disabled and do nothing', () => {
    let calls = 0
    let locked = true
    const h = { canUndo: true, canRedo: true, undo: () => (calls++, true), redo: () => (calls++, true) } as unknown as History
    const menus = buildMenus(ctx({ history: h, historyLocked: () => locked }))
    expect(find(menus, 'undo').enabled()).toBe(false)
    expect(find(menus, 'redo').enabled()).toBe(false)
    find(menus, 'undo').run()
    find(menus, 'redo').run()
    expect(calls).toBe(0)
    locked = false
    expect(find(menus, 'undo').enabled()).toBe(true)
    find(menus, 'undo').run()
    expect(calls).toBe(1)
  })
  it('an item is enabled only when its action is registered, and runs it', () => {
    let ran = 0
    expect(find(buildMenus(ctx()), 'panel-tree').enabled()).toBe(false)
    const menus = buildMenus(ctx({ actions: { 'panel-tree': () => ran++ } }))
    expect(find(menus, 'panel-tree').enabled()).toBe(true)
    find(menus, 'panel-tree').run()
    expect(ran).toBe(1)
  })
  it('a disabled item does nothing when run', () => {
    expect(() => find(buildMenus(ctx()), 'panel-tree').run()).not.toThrow()
  })
  it('Lieu lists the given places, each running its place action', () => {
    let picked = ''
    const menus = buildMenus(
      ctx({
        places: [{ key: 'blank', label: 'Salle vide neutre' }],
        actions: { 'place:blank': () => (picked = 'blank') },
      }),
    )
    const lieu = menus.find((m) => m.id === 'lieu')!
    const item = lieu.items.find((i) => i.id === 'place:blank')!
    expect(item.label).toBe('Salle vide neutre')
    item.run()
    expect(picked).toBe('blank')
  })
  it('Projet: Nouveau · Ouvrir… · Enregistrer · Enregistrer sous… · Annuler · Rétablir (Task 13), Enregistrer shows the save key', () => {
    const menus = buildMenus(ctx({ bindingLabel: (a) => ({ save: 'Ctrl+S' })[a] }))
    const projet = menus.find((m) => m.id === 'projet')!
    expect(projet.items.map((i) => i.id)).toEqual(['new', 'open', 'save', 'save-as', 'export-kept', 'undo', 'redo'])
    expect(projet.items.map((i) => i.label)).toEqual([
      'Nouveau',
      'Ouvrir…',
      'Enregistrer',
      'Enregistrer sous…',
      'Exporter les données mises de côté…',
      'Annuler',
      'Rétablir',
    ])
    expect(find(menus, 'save').shortcut).toBe('Ctrl+S')
    let ran = ''
    const live = buildMenus(ctx({ actions: { new: () => (ran += 'n'), open: () => (ran += 'o'), save: () => (ran += 's'), 'save-as': () => (ran += 'a') } }))
    for (const id of ['new', 'open', 'save', 'save-as']) {
      expect(find(live, id).enabled()).toBe(true)
      find(live, id).run()
    }
    expect(ran).toBe('nosa')
  })

  it('every item has a non-empty French label, no placeholder, unique ids', () => {
    const items = buildMenus(ctx({ places: [{ key: 'blank', label: 'Salle vide neutre' }] })).flatMap((m) => all(m.items))
    for (const i of items) {
      expect(i.label.trim().length, i.id).toBeGreaterThan(0)
      expect(i.label).not.toContain('[À REMPLACER')
    }
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length)
  })
})
