/**
 * T1.3b wiring (G3-fix 7): the checklist reads the signal path AT RENDER TIME, from the owner's getter, and re-renders on every store change.
 * The order of the store's subscribers therefore cannot leave it one change behind (boot.ts recomputes the path from the live design on each read).
 * The DOM list is proven in e2e; here the mount is replaced by a recorder (vitest runs in node, no DOM).
 */
import { describe, expect, it } from 'vitest'
import { wireChecklist, type ChecklistWiring } from '../../src/creation/onboarding/wire'
import type { Checklist, ChecklistDeps } from '../../src/creation/shell/checklist'
import type { ChecklistView } from '../../src/creation/checklistModel'
import { COPY } from '../../src/creation/copy'

type PathIn = ReturnType<ChecklistWiring['path']>
const silent = (text_fr: string): PathIn => ({ playbackReady: false, reasons: [{ code: 'SOURCE_OFF', text_fr, subjects: [{ instance: 'ql1', port: 'control:playback-usb' }] }], micReasons: [] })
const ready: PathIn = { playbackReady: true, reasons: [], micReasons: [] }

function harness(over: Partial<ChecklistWiring> = {}) {
  let path: PathIn = silent('A')
  let open = true
  const subscribers: (() => void)[] = []
  const seen: ChecklistView[] = []
  let deps!: ChecklistDeps
  const mount = (d: ChecklistDeps): Checklist => {
    deps = d
    return { render: () => void seen.push(d.view()), isOpen: false, open: () => undefined, close: () => undefined }
  }
  const w: ChecklistWiring = {
    doc: {} as Document,
    slot: {} as HTMLElement,
    root: {} as HTMLElement,
    path: () => path,
    placeOpen: () => open,
    subscribe: (fn) => void subscribers.push(fn),
    deviceLabel: (i) => i,
    select: () => undefined,
    openInventory: () => undefined,
    returnFocus: () => undefined,
    ...over,
  }
  const list = wireChecklist(w, mount)
  return { list, subscribers, seen, deps: () => deps, set: (p: PathIn) => (path = p), setOpen: (o: boolean) => (open = o) }
}

describe('wireChecklist', () => {
  it('renders once at wiring and subscribes exactly once to the store', () => {
    const h = harness()
    expect(h.subscribers).toHaveLength(1)
    expect(h.seen).toHaveLength(1)
    expect(h.seen[0].visible).toBe(true)
  })

  it('every store change renders again, and the view comes from the path as it is AT THAT MOMENT (a path recomputed after the subscription is not one change late)', () => {
    const h = harness()
    h.set(silent('B'))
    h.subscribers[0]()
    expect(h.seen.at(-1)!.rows.find((r) => r.id === 'console')!.detail).toBe('B')
    h.set(ready)
    h.subscribers[0]()
    expect(h.seen.at(-1)!.visible).toBe(false) // does not trigger once the rig can play
  })

  it('the view is built lazily from the getters on each call: the list opened later sees the live path and place, not a snapshot of the wiring', () => {
    const h = harness()
    h.set(silent('C'))
    expect(h.deps().view().rows.find((r) => r.id === 'console')!.detail).toBe('C')
    h.setOpen(false)
    expect(h.deps().view().visible).toBe(false) // no place open: nothing to show
  })

  it('« Aller à » is routed: a device is selected, the inventory is asked for the Consoles tab, nothing else is called', () => {
    const calls: string[] = []
    const h = harness({ select: (i) => void calls.push(`select ${i}`), openInventory: (t) => void calls.push(`inventory ${t}`) })
    h.deps().goTo({ kind: 'select', instance: 'ql1' })
    h.deps().goTo({ kind: 'inventory', tab: 'consoles' })
    expect(calls).toEqual(['select ql1', 'inventory consoles'])
  })

  it('the wiring does not touch the strings it does not own', () => {
    expect(COPY.checklist!.title).toBe('Pourquoi je n’entends rien ?')
  })
})
