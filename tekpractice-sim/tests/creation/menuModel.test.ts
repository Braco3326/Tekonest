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
      const labels: Record<string, string> = {
        'frame-selection': 'F',
        'camera-home': 'Alt+H',
        'view-rotate-left': 'Pavé num. 4',
        'view-rotate-right': 'Pavé num. 6',
        'view-picker': 'V',
        walk: 'Maj+V',
      }
      const items = vue(ctx({ bindingLabel: (a) => labels[a] })).items
      expect(items.map((i) => i.id)).toEqual(['views', 'points', 'frame-selection', 'camera-home', 'view-rotate-left', 'view-rotate-right', 'view-picker', 'walk', 'panel-tree', 'panel-props'])
      expect(items.map((i) => i.label)).toEqual(['Vues', 'Aller au point d’écoute', 'Cadrer la sélection', 'Vue d’ensemble', 'Tourner la vue à gauche', 'Tourner la vue à droite', 'Choisir une vue…', 'Marcher', 'Panneau Projet', 'Panneau Propriétés'])
      expect(items.map((i) => i.shortcut)).toEqual([undefined, undefined, 'F', 'Alt+H', 'Pavé num. 4', 'Pavé num. 6', 'V', 'Maj+V', undefined, undefined])
      // the quarter turns are camera items: they hand focus to the 3D view, off while the view is locked
      for (const id of ['view-rotate-left', 'view-rotate-right'])
        expect(items.find((i) => i.id === id)!.returnFocus, id).toBe(false)
    })
    it('Vue › Aller au point d’écoute (Task 20): one radio item per point, keys 1 / 2 / 3 by position, checked = the active point', () => {
      let active = 'regie'
      let locked = false
      const ran: string[] = []
      const points = [
        { id: 'regie', label: 'Régie' },
        { id: 'premier-rang', label: 'Premier rang' },
        { id: 'fond-de-salle', label: 'Fond de salle' },
      ]
      const c = ctx({
        actions: Object.fromEntries(points.map((p) => [`point:${p.id}`, () => void ran.push(p.id)])),
        bindingLabel: (a) => ({ 'point-key-1': '1', 'point-key-2': '2', 'point-key-3': '3' })[a],
        points: () => points,
        listenerPoint: () => active,
        viewLocked: () => locked,
      })
      const sub = vue(c).items.find((i) => i.id === 'points')!
      expect(sub.enabled()).toBe(true)
      expect(sub.children!.map((i) => [i.id, i.label, i.shortcut, i.kind])).toEqual([
        ['point:regie', 'Régie', '1', 'radio'],
        ['point:premier-rang', 'Premier rang', '2', 'radio'],
        ['point:fond-de-salle', 'Fond de salle', '3', 'radio'],
      ])
      for (const i of sub.children!) expect(i.returnFocus, i.id).toBe(false) // camera items: focus to the 3D view
      expect(sub.children!.map((i) => i.checked!())).toEqual([true, false, false])
      active = 'premier-rang'
      expect(sub.children!.map((i) => i.checked!())).toEqual([false, true, false])
      sub.children![2].run()
      expect(ran).toEqual(['fond-de-salle'])
      locked = true
      expect(sub.enabled()).toBe(false)
      sub.children![0].run()
      expect(ran).toEqual(['fond-de-salle'])
    })
    it('a dropped point never renumbers the keys: Régie 1, Fond de salle 3 (review Fix 1)', () => {
      const keys: Record<string, string> = { 'point-key-1': '1', 'point-key-2': '2', 'point-key-3': '3' }
      const c = ctx({
        bindingLabel: (a) => keys[a],
        points: () => [
          { id: 'regie', label: 'Régie' },
          { id: 'fond-de-salle', label: 'Fond de salle' },
        ],
      })
      const sub = vue(c).items.find((i) => i.id === 'points')!
      expect(sub.children!.map((i) => i.shortcut)).toEqual(['1', '3'])
      const blank = vue(ctx({ bindingLabel: (a) => keys[a], points: () => [{ id: 'centre', label: 'Centre' }] }))
      expect(blank.items.find((i) => i.id === 'points')!.children!.map((i) => i.shortcut)).toEqual(['1'])
    })
    it('no points (no place yet): the submenu is there, disabled', () => {
      const sub = vue(ctx()).items.find((i) => i.id === 'points')!
      expect(sub.children).toEqual([])
      expect(sub.enabled()).toBe(false)
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
    it('camera items hand focus to the 3D view (returnFocus false); the picker and the panels keep the APG return', () => {
      const items = vue(ctx({ points: () => [{ id: 'regie', label: 'Régie' }] })).items
      const views = items.find((i) => i.id === 'views')!
      for (const v of views.children!) expect(v.returnFocus, v.id).toBe(false)
      for (const v of items.find((i) => i.id === 'points')!.children!) expect(v.returnFocus, v.id).toBe(false)
      expect(items.find((i) => i.id === 'frame-selection')!.returnFocus).toBe(false)
      expect(items.find((i) => i.id === 'camera-home')!.returnFocus).toBe(false)
      expect(items.find((i) => i.id === 'view-picker')!.returnFocus).toBeUndefined()
      expect(items.find((i) => i.id === 'panel-tree')!.returnFocus).toBeUndefined()
    })
    it('« Marcher » (Maj+V, Task 19): a checkbox item following the walk view, focus to the 3D view, off while the view is locked', () => {
      let walking = false
      let locked = false
      let ran = 0
      const c = ctx({
        actions: { walk: () => void ran++, 'view-picker': () => {} },
        bindingLabel: (a) => ({ walk: 'Maj+V' })[a],
        walking: () => walking,
        viewLocked: () => locked,
      })
      const items = vue(c).items
      const walk = items.find((i) => i.id === 'walk')!
      expect(walk.label).toBe('Marcher')
      expect(walk.shortcut).toBe('Maj+V')
      expect(walk.returnFocus).toBe(false)
      expect(walk.kind).toBe('checkbox')
      expect(walk.checked!()).toBe(false)
      expect(walk.enabled()).toBe(true)
      walk.run()
      expect(ran).toBe(1)
      walking = true
      expect(walk.checked!()).toBe(true)
      // the V picker is off while walking (views and Vue d'ensemble go back to Orbit first: their actions)
      expect(items.find((i) => i.id === 'view-picker')!.enabled()).toBe(false)
      locked = true
      expect(walk.enabled()).toBe(false)
      walk.run()
      expect(ran).toBe(1)
    })
  })

  describe('Écoute › Hauteur d’oreille (Task 19, S6)', () => {
    const ecoute = (c: MenuContext) => buildMenus(c).find((m) => m.id === 'ecoute')!
    it('two radio items, assis 1,2 m and debout 1,7 m, checked from the view state', () => {
      let ear: 1.2 | 1.7 = 1.2
      const ran: string[] = []
      const c = ctx({
        actions: { 'ear-seated': () => void ran.push('seated'), 'ear-standing': () => void ran.push('standing') },
        earHeight: () => ear,
      })
      const items = ecoute(c).items
      const seated = items.find((i) => i.id === 'ear-seated')!
      const standing = items.find((i) => i.id === 'ear-standing')!
      expect(seated.label).toBe('Hauteur d’oreille : assis 1,2 m')
      expect(standing.label).toBe('Hauteur d’oreille : debout 1,7 m')
      expect(seated.kind).toBe('radio')
      expect(standing.kind).toBe('radio')
      expect([seated.checked!(), standing.checked!()]).toEqual([true, false])
      ear = 1.7
      expect([seated.checked!(), standing.checked!()]).toEqual([false, true])
      standing.run()
      seated.run()
      expect(ran).toEqual(['standing', 'seated'])
    })
  })

  describe('Écoute › Couverture (Task 37)', () => {
    const item = (c: MenuContext) => find(buildMenus(c), 'coverage')
    it('a checkbox item in Écoute, after the sources and before the ear heights, unchecked by default', () => {
      const ecoute = buildMenus(ctx()).find((m) => m.id === 'ecoute')!
      expect(ecoute.items.map((i) => i.id)).toEqual(['play', 'choose-file', 'test-signal', 'coverage', 'ear-seated', 'ear-standing'])
      const c = item(ctx())
      expect(c.label).toBe('Couverture')
      expect(c.kind).toBe('checkbox')
      expect(c.checked!()).toBe(false)
    })
    it('is checked from the state, runs its action, and is off without an action or while no place is on screen', () => {
      let on = false
      const ran: string[] = []
      const live = item(ctx({ actions: { coverage: () => void ran.push('toggle') }, coverage: () => on }))
      expect(live.enabled()).toBe(true)
      live.run()
      expect(ran).toEqual(['toggle'])
      on = true
      expect(live.checked!()).toBe(true)
      const noAction = item(ctx())
      expect(noAction.enabled()).toBe(false)
      const locked = item(ctx({ actions: { coverage: () => void ran.push('locked') }, viewLocked: () => true }))
      expect(locked.enabled()).toBe(false)
      locked.run() // a disabled item never runs
      expect(ran).toEqual(['toggle'])
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

describe('Matériel › Pivoter, Dupliquer, Supprimer (Task 25)', () => {
  const labels: Record<string, string> = { rotate: 'R', duplicate: 'Ctrl+D', delete: 'Suppr' }
  const withKeys = (over: Partial<MenuContext> = {}): MenuContext =>
    ctx({ bindingLabel: (a) => labels[a], actions: { rotate: () => {}, duplicate: () => {}, delete: () => {} }, ...over })
  const materiel = (menus: ReturnType<typeof buildMenus>) => menus.find((m) => m.id === 'materiel')!.items

  it('the menu lists Inventaire, Pivoter, Dupliquer, Supprimer, with their shortcuts', () => {
    const items = materiel(buildMenus(withKeys({ hasSelection: () => true })))
    expect(items.map((i) => i.label)).toEqual(['Inventaire', 'Pivoter', 'Dupliquer', 'Supprimer'])
    expect(items.slice(1).map((i) => i.shortcut)).toEqual(['R', 'Ctrl+D', 'Suppr'])
  })
  it('disabled with no selection, enabled with one; running a disabled item does nothing', () => {
    let selected = false
    const ran: string[] = []
    const menus = buildMenus(
      withKeys({
        hasSelection: () => selected,
        actions: { rotate: () => void ran.push('rotate'), duplicate: () => void ran.push('duplicate'), delete: () => void ran.push('delete') },
      })
    )
    for (const id of ['rotate', 'duplicate', 'delete']) {
      expect(find(menus, id).enabled(), id).toBe(false)
      find(menus, id).run()
    }
    expect(ran).toEqual([])
    selected = true
    for (const id of ['rotate', 'duplicate', 'delete']) {
      expect(find(menus, id).enabled(), id).toBe(true)
      find(menus, id).run()
    }
    expect(ran).toEqual(['rotate', 'duplicate', 'delete'])
  })
  it('off while the place picker covers the rig (history locked), and when the action is not registered', () => {
    const locked = buildMenus(withKeys({ hasSelection: () => true, historyLocked: () => true }))
    for (const id of ['rotate', 'duplicate', 'delete']) expect(find(locked, id).enabled(), id).toBe(false)
    const bare = buildMenus(ctx({ hasSelection: () => true }))
    for (const id of ['rotate', 'duplicate', 'delete']) expect(find(bare, id).enabled(), id).toBe(false)
  })
  it('without a hasSelection hook the items stay off', () => {
    const menus = buildMenus(withKeys())
    expect(find(menus, 'delete').enabled()).toBe(false)
  })
  describe('Écoute › Lecture, Morceau, Choisir un fichier audio…, Signal de test (Task 39)', () => {
    const REASON = 'La console n’est pas alimentée.'
    const run: string[] = []
    const actions = (): Record<string, () => void> =>
      Object.fromEntries(['play', 'choose-file', 'test-signal', 'song:demo-1'].map((a) => [a, () => void run.push(a)]))
    const live = (over: Partial<MenuContext> = {}): MenuContext => ctx({ actions: actions(), playbackReady: () => true, playbackReason: () => undefined, ...over })
    const ecoute = (c: MenuContext) => buildMenus(c).find((m) => m.id === 'ecoute')!
    it('« Lecture » is enabled iff the chain can play; otherwise it stays in the menu (focusable) and its description is the FIRST reason', () => {
      const off = find(buildMenus(live({ playbackReady: () => false, playbackReason: () => REASON })), 'play')
      expect(off.label).toBe('Lecture')
      expect(off.enabled()).toBe(false)
      expect(off.description!()).toBe(REASON)
      const on = find(buildMenus(live()), 'play')
      expect(on.enabled()).toBe(true)
      expect(on.description!()).toBeUndefined()
    })
    it('the sources (file, test signal, songs) follow the same gate and say the same reason', () => {
      const off = buildMenus(live({ playbackReady: () => false, playbackReason: () => REASON, songs: () => [{ id: 'demo-1', title: 'Titre' }] }))
      for (const id of ['choose-file', 'test-signal', 'songs', 'song:demo-1']) {
        expect(find(off, id).enabled(), id).toBe(false)
        expect(find(off, id).description!(), id).toBe(REASON)
      }
      const on = buildMenus(live({ songs: () => [{ id: 'demo-1', title: 'Titre' }] }))
      for (const id of ['choose-file', 'test-signal', 'songs', 'song:demo-1']) expect(find(on, id).enabled(), id).toBe(true)
    })
    it('a disabled item never runs; an enabled one runs its action', () => {
      run.length = 0
      const off = buildMenus(live({ playbackReady: () => false }))
      for (const id of ['play', 'choose-file', 'test-signal']) find(off, id).run()
      expect(run).toEqual([])
      const on = buildMenus(live())
      for (const id of ['play', 'choose-file', 'test-signal']) find(on, id).run()
      expect(run).toEqual(['play', 'choose-file', 'test-signal'])
    })
    it('while playing the item reads « Stop » and stays live even if the chain just became invalid (stopping is never gated)', () => {
      const p = find(buildMenus(live({ playing: () => true, playbackReady: () => false, playbackReason: () => REASON })), 'play')
      expect(p.label).toBe('Stop')
      expect(p.enabled()).toBe(true)
      expect(p.description!()).toBeUndefined()
    })
    it('« Morceau » is left out when there is no song (the list is empty by design), and lists the songs by title otherwise', () => {
      expect(ecoute(live()).items.some((i) => i.id === 'songs')).toBe(false)
      expect(ecoute(live({ songs: () => [] })).items.some((i) => i.id === 'songs')).toBe(false)
      const songs = find(buildMenus(live({ songs: () => [{ id: 'demo-1', title: 'Titre un' }, { id: 'demo-2', title: 'Titre deux' }] })), 'songs')
      expect(songs.label).toBe('Morceau')
      expect(songs.children!.map((c) => [c.id, c.label])).toEqual([['song:demo-1', 'Titre un'], ['song:demo-2', 'Titre deux']])
    })
    it('the order: Lecture, Morceau, Choisir un fichier audio…, Signal de test, Couverture, the ear heights', () => {
      const c = live({ songs: () => [{ id: 'demo-1', title: 'T' }] })
      expect(ecoute(c).items.map((i) => i.label)).toEqual(['Lecture', 'Morceau', 'Choisir un fichier audio…', 'Signal de test', 'Couverture', expect.any(String), expect.any(String)])
    })
    it('without a registered action the item is off (and says the reason when there is one)', () => {
      const p = find(buildMenus(ctx({ playbackReady: () => true })), 'play')
      expect(p.enabled()).toBe(false)
    })
    it('under the place picker with a VALID chain the items are off and say why (never off with no word); a chain reason wins when there is one', () => {
      const locked = buildMenus(live({ viewLocked: () => true, songs: () => [{ id: 'demo-1', title: 'T' }] }))
      for (const id of ['play', 'choose-file', 'test-signal', 'songs', 'song:demo-1']) {
        expect(find(locked, id).enabled(), id).toBe(false)
        expect(find(locked, id).description!(), id).toBe('Indisponible pendant le choix du lieu.')
      }
      const both = find(buildMenus(live({ viewLocked: () => true, playbackReady: () => false, playbackReason: () => REASON })), 'play')
      expect(both.description!()).toBe(REASON)
      expect(find(buildMenus(live()), 'play').description!()).toBeUndefined()
    })
    it('nothing starts under the place picker (viewLocked) but Stop still works', () => {
      expect(find(buildMenus(live({ viewLocked: () => true })), 'play').enabled()).toBe(false)
      expect(find(buildMenus(live({ viewLocked: () => true, playing: () => true })), 'play').enabled()).toBe(true)
    })
  })
})
