import { describe, expect, it } from 'vitest'
import { DEFAULT_CREATION_BINDINGS } from '../../src/creation/input/creationActions'
import { mountCreationKeyboard } from '../../src/creation/input/keyboard'
import { DisposableBag } from '../../src/util/disposable'

/** A window-like event target that records listeners. */
function fakeWindow() {
  const fns: ((e: unknown) => void)[] = []
  return {
    addEventListener: (_t: string, fn: (e: unknown) => void) => void fns.push(fn),
    removeEventListener: (_t: string, fn: (e: unknown) => void) => void fns.splice(fns.indexOf(fn), 1),
    fire(e: object) {
      for (const f of [...fns]) f(e)
    },
    get count() {
      return fns.length
    },
  }
}

const el = (tagName: string, attrs: Record<string, string> = {}, inDialog = false) => ({
  tagName,
  getAttribute: (n: string) => attrs[n] ?? null,
  closest: (s: string) => (inDialog && s.includes('dialog') ? {} : null),
})

function key(init: { code: string; key: string; target: unknown; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; repeat?: boolean }) {
  const e = { altKey: false, metaKey: false, ctrlKey: false, shiftKey: false, isComposing: false, defaultPrevented: false, ...init, prevented: 0 }
  return Object.assign(e, {
    preventDefault() {
      e.prevented++
      e.defaultPrevented = true
    },
  })
}

function setup() {
  const win = fakeWindow()
  const bag = new DisposableBag()
  const canvas = el('CANVAS')
  const kb = mountCreationKeyboard({ bag, bindings: DEFAULT_CREATION_BINDINGS, canvas: canvas as unknown as HTMLElement, target: win })
  const log: string[] = []
  for (const a of ['UNDO', 'NEXT_DEVICE', 'FRAME_SELECTION', 'TOGGLE_INVENTORY', 'CANCEL', 'SAVE'] as const) kb.onAction(a, () => void log.push(a))
  return { win, bag, canvas, kb, log }
}

describe('creation keyboard (Task 8)', () => {
  it('Ctrl+Z (AZERTY) from anywhere outside text fields runs UNDO and prevents the default', () => {
    const { win, log } = setup()
    const e = key({ code: 'KeyW', key: 'z', ctrlKey: true, target: el('BUTTON') })
    win.fire(e)
    expect(log).toEqual(['UNDO'])
    expect(e.prevented).toBe(1)
  })
  it('the focus key is never handled nor prevented', () => {
    const { win, canvas, log } = setup()
    for (const shiftKey of [false, true]) {
      const e = key({ code: 'Tab', key: 'Tab', shiftKey, target: canvas })
      win.fire(e)
      expect(e.prevented).toBe(0)
    }
    expect(log).toEqual([])
  })
  it('] acts only while the canvas has focus', () => {
    const { win, canvas, log } = setup()
    const off = key({ code: 'BracketRight', key: ']', target: el('BUTTON') })
    win.fire(off)
    expect(off.prevented).toBe(0)
    win.fire(key({ code: 'BracketRight', key: '$', target: canvas }))
    expect(log).toEqual(['NEXT_DEVICE'])
  })
  it('F frames only from the canvas (WCAG 2.1.4: a single-character key acts only on focus)', () => {
    const { win, canvas, log } = setup()
    const off = key({ code: 'KeyF', key: 'f', target: el('BUTTON') })
    win.fire(off)
    expect(off.prevented).toBe(0)
    win.fire(key({ code: 'KeyF', key: 'f', target: canvas }))
    expect(log).toEqual(['FRAME_SELECTION'])
  })
  it('Entrée on the canvas frames the selection; Entrée elsewhere is the browser’s', () => {
    const { win, canvas, log } = setup()
    win.fire(key({ code: 'Enter', key: 'Enter', target: canvas }))
    const onButton = key({ code: 'Enter', key: 'Enter', target: el('BUTTON') })
    win.fire(onButton)
    expect(log).toEqual(['FRAME_SELECTION'])
    expect(onButton.prevented).toBe(0)
  })
  it('text fields keep their keys, except Échap and Ctrl+S', () => {
    const { win, log } = setup()
    const input = el('INPUT')
    const undo = key({ code: 'KeyZ', key: 'z', ctrlKey: true, target: input })
    win.fire(undo)
    expect(undo.prevented).toBe(0)
    win.fire(key({ code: 'Escape', key: 'Escape', target: input }))
    win.fire(key({ code: 'KeyS', key: 's', ctrlKey: true, target: input }))
    expect(log).toEqual(['CANCEL', 'SAVE'])
  })
  it('Space on a focused button stays its activation key; on the canvas it toggles the inventory', () => {
    const { win, canvas, log } = setup()
    const onBtn = key({ code: 'Space', key: ' ', target: el('DIV', { role: 'menuitem' }) })
    win.fire(onBtn)
    expect(onBtn.prevented).toBe(0)
    win.fire(key({ code: 'Space', key: ' ', target: canvas }))
    expect(log).toEqual(['TOGGLE_INVENTORY'])
  })
  it('Space opens the inventory only on the canvas (Task 23): not on the body, a panel or a text field', () => {
    const { win, canvas, log } = setup()
    for (const t of [el('BODY'), el('DIV'), el('INPUT')]) {
      const e = key({ code: 'Space', key: ' ', target: t })
      win.fire(e)
      expect(e.prevented).toBe(0)
    }
    expect(log).toEqual([])
    win.fire(key({ code: 'Space', key: ' ', target: canvas }))
    expect(log).toEqual(['TOGGLE_INVENTORY'])
  })
  it('a held Space (auto-repeat) toggles the inventory once: repeats are claimed, never acted on', () => {
    const { win, canvas, log } = setup()
    win.fire(key({ code: 'Space', key: ' ', target: canvas }))
    for (let i = 0; i < 5; i++) {
      const rep = key({ code: 'Space', key: ' ', target: canvas, repeat: true })
      win.fire(rep)
      expect(rep.prevented).toBe(1) // no page scroll either
    }
    expect(log).toEqual(['TOGGLE_INVENTORY'])
    // other actions keep their repeat (a held ] keeps cycling)
    win.fire(key({ code: 'BracketRight', key: ']', target: canvas, repeat: true }))
    expect(log).toEqual(['TOGGLE_INVENTORY', 'NEXT_DEVICE'])
  })
  it('nothing fires inside a modal dialog, nor for an event already handled', () => {
    const { win, log } = setup()
    win.fire(key({ code: 'KeyZ', key: 'z', ctrlKey: true, target: el('BUTTON', {}, true) }))
    const handled = key({ code: 'KeyZ', key: 'z', ctrlKey: true, target: el('BUTTON') })
    handled.defaultPrevented = true
    win.fire(handled)
    expect(log).toEqual([])
  })
  it('a handler returning false leaves the event to the browser; unregistered actions too', () => {
    const { win, kb, canvas } = setup()
    kb.onAction('UNDO', () => false)
    const e = key({ code: 'KeyZ', key: 'z', ctrlKey: true, target: canvas })
    win.fire(e)
    expect(e.prevented).toBe(0)
    const dup = key({ code: 'KeyD', key: 'd', ctrlKey: true, target: canvas })
    win.fire(dup)
    expect(dup.prevented).toBe(0) // DUPLICATE has no handler yet: the browser keeps Ctrl+D
  })
  it('a suspended action (place picker open) does not fire and its key stays the browser’s; others still fire', () => {
    const win = fakeWindow()
    let pickerOpen = true
    const kb = mountCreationKeyboard({
      bag: new DisposableBag(),
      bindings: DEFAULT_CREATION_BINDINGS,
      canvas: el('CANVAS') as unknown as HTMLElement,
      target: win,
      suspended: (a) => pickerOpen && a !== 'SAVE',
    })
    const log: string[] = []
    for (const a of ['UNDO', 'REDO', 'SAVE'] as const) kb.onAction(a, () => void log.push(a))
    const undo = () => key({ code: 'KeyW', key: 'z', ctrlKey: true, target: el('BUTTON') })
    const e = undo()
    win.fire(e)
    win.fire(key({ code: 'KeyY', key: 'y', ctrlKey: true, target: el('BUTTON') }))
    const save = key({ code: 'KeyS', key: 's', ctrlKey: true, target: el('BUTTON') })
    win.fire(save)
    expect(log).toEqual(['SAVE'])
    expect(e.prevented).toBe(0)
    expect(save.prevented).toBe(1)
    pickerOpen = false
    win.fire(undo())
    expect(log).toEqual(['SAVE', 'UNDO'])
  })
  describe('edit keys (Task 25)', () => {
    const editSetup = () => {
      const s = setup()
      for (const a of ['ROTATE_CW', 'ROTATE_CCW', 'DUPLICATE', 'DELETE'] as const) s.kb.onAction(a, () => void s.log.push(a))
      return s
    }
    it('R / Shift+R / Alt+R / Alt+Shift+R rotate, from the canvas only', () => {
      const { win, canvas, log } = editSetup()
      const off = key({ code: 'KeyR', key: 'r', target: el('BUTTON') })
      win.fire(off)
      expect(off.prevented).toBe(0)
      win.fire(key({ code: 'KeyR', key: 'r', target: canvas }))
      win.fire(key({ code: 'KeyR', key: 'R', shiftKey: true, target: canvas }))
      win.fire(key({ code: 'KeyR', key: 'r', altKey: true, target: canvas }))
      win.fire(key({ code: 'KeyR', key: 'R', altKey: true, shiftKey: true, target: canvas }))
      expect(log).toEqual(['ROTATE_CW', 'ROTATE_CCW', 'ROTATE_CW', 'ROTATE_CCW'])
    })
    it('Suppr deletes from the canvas only; Ctrl+D (QWERTY, AZERTY, any layout: the labelled key) duplicates from anywhere but a text field', () => {
      const { win, canvas, log } = editSetup()
      const offDel = key({ code: 'Delete', key: 'Delete', target: el('BUTTON') })
      win.fire(offDel)
      expect(offDel.prevented).toBe(0)
      win.fire(key({ code: 'Delete', key: 'Delete', target: canvas }))
      win.fire(key({ code: 'KeyD', key: 'd', ctrlKey: true, target: canvas })) // QWERTY and AZERTY
      win.fire(key({ code: 'KeyE', key: 'd', ctrlKey: true, target: el('BUTTON') })) // Dvorak: the key printed D sits elsewhere
      win.fire(key({ code: 'KeyD', key: 'e', ctrlKey: true, target: canvas })) // ... and the physical D is an E there
      win.fire(key({ code: 'KeyD', key: 'd', ctrlKey: true, target: el('INPUT') }))
      expect(log).toEqual(['DELETE', 'DUPLICATE', 'DUPLICATE'])
    })
    it('a held key (auto-repeat) never repeats Suppr, Ctrl+D or R: claimed, not acted on', () => {
      const { win, canvas, log } = editSetup()
      const keys = [
        { code: 'Delete', key: 'Delete' },
        { code: 'KeyD', key: 'd', ctrlKey: true },
        { code: 'KeyR', key: 'r' },
        { code: 'KeyR', key: 'R', shiftKey: true },
        { code: 'KeyR', key: 'r', altKey: true },
      ]
      for (const k of keys) {
        win.fire(key({ ...k, target: canvas }))
        for (let i = 0; i < 4; i++) {
          const rep = key({ ...k, target: canvas, repeat: true })
          win.fire(rep)
          expect(rep.prevented, k.code + ' repeat claimed').toBe(1) // no browser bookmark / back navigation either
        }
      }
      expect(log).toEqual(['DELETE', 'DUPLICATE', 'ROTATE_CW', 'ROTATE_CCW', 'ROTATE_CW'])
    })
  })
  it('the listener is released with the bag', () => {
    const { win, bag } = setup()
    expect(win.count).toBe(1)
    bag.dispose()
    expect(win.count).toBe(0)
  })
})
