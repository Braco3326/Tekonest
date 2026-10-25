import { describe, expect, it } from 'vitest'
import { buildMenus, type MenuContext, type MenuItem } from '../../src/creation/shell/menuModel'
import type { History } from '../../src/creation/history'
import { ZONES, zoneId, zoneLabel } from '../../src/camera/cubeZones'

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

  describe('Vue (Task 18, C11, CA-05)', () => {
    const vue = (c: MenuContext) => buildMenus(c).find((m) => m.id === 'vue')!
    // Faces (horizon clockwise from Face, then the poles), edges (horizon, top, bottom), corners (top, bottom).
    const ORDER = [
      'face', 'droite', 'arriere', 'gauche', 'dessus', 'dessous',
      'face-droite', 'arriere-droite', 'arriere-gauche', 'face-gauche',
      'dessus-face', 'dessus-droite', 'dessus-arriere', 'dessus-gauche',
      'dessous-face', 'dessous-droite', 'dessous-arriere', 'dessous-gauche',
      'dessus-face-droite', 'dessus-arriere-droite', 'dessus-arriere-gauche', 'dessus-face-gauche',
      'dessous-face-droite', 'dessous-arriere-droite', 'dessous-arriere-gauche', 'dessous-face-gauche',
    ]
    const expected = ORDER.map((id) => ZONES.find((z) => zoneId(z) === id)!)
    it('the expected order covers the 26 zones once, by kind', () => {
      expect(new Set(ORDER).size).toBe(26)
      const kind = (z: (typeof ZONES)[number]) => Math.abs(z.x) + Math.abs(z.y) + Math.abs(z.z)
      expect(expected.map(kind)).toEqual([...Array(6).fill(1), ...Array(12).fill(2), ...Array(8).fill(3)])
    })
    it('Vue › Vues holds the 26 named views: faces (6), edges (12), corners (8), labels = zoneLabel', () => {
      const views = vue(ctx()).items.find((i) => i.id === 'views')!
      expect(views.label).toBe('Vues')
      expect(views.children).toHaveLength(26)
      expect(views.children!.map((i) => i.label)).toEqual(expected.map(zoneLabel))
      expect(views.children!.map((i) => i.id)).toEqual(expected.map((z) => `view:${zoneId(z)}`))
      expect(views.children!.map((i) => i.group)).toEqual([
        ...Array(6).fill('Faces'),
        ...Array(12).fill('Arêtes'),
        ...Array(8).fill('Coins'),
      ])
    })
    it('Vue lists Vues · Cadrer la sélection · Vue d’ensemble · Choisir une vue… then the panels, with live shortcuts', () => {
      const labels: Record<string, string> = { 'frame-selection': 'F', 'camera-home': 'Alt+H', 'view-picker': 'V' }
      const items = vue(ctx({ bindingLabel: (a) => labels[a] })).items
      expect(items.map((i) => i.id)).toEqual(['views', 'frame-selection', 'camera-home', 'view-picker', 'panel-tree', 'panel-props'])
      expect(items.map((i) => i.label)).toEqual(['Vues', 'Cadrer la sélection', 'Vue d’ensemble', 'Choisir une vue…', 'Panneau Projet', 'Panneau Propriétés'])
      expect(items.map((i) => i.shortcut)).toEqual([undefined, 'F', 'Alt+H', 'V', undefined, undefined])
    })
    it('a view item runs its view:<id> action; views are disabled while the view is locked (place picker open)', () => {
      const ran: string[] = []
      let locked = false
      const actions = Object.fromEntries(expected.map((z) => [`view:${zoneId(z)}`, () => void ran.push(zoneId(z))]))
      const c = ctx({ actions: { ...actions, 'view-picker': () => void ran.push('picker') }, viewLocked: () => locked })
      const items = vue(c).items
      const views = items.find((i) => i.id === 'views')!
      expect(views.enabled()).toBe(true)
      views.children![2].run()
      expect(ran).toEqual([zoneId(expected[2])])
      locked = true
      expect(views.enabled()).toBe(false)
      expect(views.children!.every((i) => !i.enabled())).toBe(true)
      expect(items.find((i) => i.id === 'view-picker')!.enabled()).toBe(false)
      views.children![0].run()
      items.find((i) => i.id === 'view-picker')!.run()
      expect(ran).toHaveLength(1)
    })
    it('no « Marcher » item until the walk action exists (Task 19)', () => {
      expect(vue(ctx()).items.some((i) => i.id === 'walk')).toBe(false)
    })
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
