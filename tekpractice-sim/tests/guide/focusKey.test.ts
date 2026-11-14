// The shortcut that puts the focus on the guide's icon from anywhere in the page: a two-modifier chord, only in practice mode, never from a text field,
// and it takes no other key (Escape, Tab, letters) from the page.
import { describe, expect, it, vi } from 'vitest'
import { FOCUS_ICON_CHORD, installFocusKey, isFocusChord, isTextTarget } from '../../src/guide/focusKey'
import { TP_STRINGS } from '../../src/guide/strings'

const chord = (over: Record<string, unknown> = {}) => ({ code: 'KeyO', key: 'O', altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, repeat: false, isComposing: false, ...over })

describe('isFocusChord', () => {
  it('is Alt+Shift+O, by the physical key, whatever character the layout types', () => {
    expect(isFocusChord(chord())).toBe(true)
    expect(isFocusChord(chord({ key: 'Ø' }))).toBe(true)
    expect(isFocusChord(chord({ key: 'o' }))).toBe(true)
    expect(FOCUS_ICON_CHORD).toBe('Alt+Shift+O')
  })

  it.each([
    ['O alone', { altKey: false, shiftKey: false }],
    ['Shift+O (a capital letter)', { altKey: false }],
    ['Alt+O (one modifier)', { shiftKey: false }],
    ['Ctrl+Alt+Shift+O', { ctrlKey: true }],
    ['Meta+Alt+Shift+O', { metaKey: true }],
    ['another letter', { code: 'KeyP', key: 'P' }],
    ['Escape', { code: 'Escape', key: 'Escape' }],
    ['Tab with both modifiers', { code: 'Tab', key: 'Tab' }],
    ['a held key', { repeat: true }],
    ['a composition', { isComposing: true }],
  ])('is not %s', (_name, over) => {
    expect(isFocusChord(chord(over))).toBe(false)
  })

  it('never reads a single character key as the chord', () => {
    for (const k of 'abcdefghijklmnopqrstuvwxyz0123456789 ?/') expect(isFocusChord({ code: `Key${k.toUpperCase()}`, key: k, altKey: false, shiftKey: false, ctrlKey: false, metaKey: false })).toBe(false)
  })
})

describe('isTextTarget', () => {
  it('a text field, a text area, a select and an editable element are text targets', () => {
    expect(isTextTarget({ tagName: 'INPUT' })).toBe(true)
    expect(isTextTarget({ tagName: 'textarea' })).toBe(true)
    expect(isTextTarget({ tagName: 'SELECT' })).toBe(true)
    expect(isTextTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true)
  })
  it('a canvas, the body, a button and nothing are not', () => {
    expect(isTextTarget({ tagName: 'CANVAS' })).toBe(false)
    expect(isTextTarget({ tagName: 'BODY' })).toBe(false)
    expect(isTextTarget({ tagName: 'BUTTON' })).toBe(false)
    expect(isTextTarget(null)).toBe(false)
    expect(isTextTarget(undefined)).toBe(false)
  })
})

// A document of just what the module touches.
function fakePage(search = '?level=a1&oscar=legacy', withIcon = true) {
  const listeners = new Map<string, Set<(e: unknown) => void>>()
  const hint = { textContent: 'Les flèches du clavier déplacent l’icône.', dataset: {} as Record<string, string> }
  const icon = { focus: vi.fn(), getAttribute: (n: string) => (n === 'aria-describedby' ? 'oscar-help-1' : null) }
  let focused: unknown = null
  icon.focus.mockImplementation(() => {
    focused = icon
  })
  const doc = {
    addEventListener: (t: string, f: (e: unknown) => void) => void (listeners.get(t) ?? listeners.set(t, new Set()).get(t)!).add(f),
    removeEventListener: (t: string, f: (e: unknown) => void) => void listeners.get(t)?.delete(f),
    querySelector: (sel: string) => (withIcon && sel.includes('oscar-icon') ? icon : null),
    getElementById: (id: string) => (id === 'oscar-help-1' ? hint : null),
    get activeElement() {
      return focused
    },
  }
  const win = { document: doc, location: { search } } as unknown as Window
  const press = (over: Record<string, unknown> = {}, target: unknown = { tagName: 'CANVAS' }): { defaultPrevented: boolean } => {
    const e = { ...chord(over), target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
    for (const f of [...(listeners.get('keydown') ?? [])]) f(e)
    return e
  }
  return { win, icon, hint, press, count: () => listeners.get('keydown')?.size ?? 0 }
}

describe('installFocusKey', () => {
  it('announces the shortcut by adding a sentence to the icon’s own hint, once', () => {
    const p = fakePage()
    installFocusKey(p.win, 'legacy')
    expect(p.hint.textContent).toBe(`Les flèches du clavier déplacent l’icône. ${TP_STRINGS.focusKey.hint}`)
    installFocusKey(p.win, 'legacy')
    expect(p.hint.textContent!.split(TP_STRINGS.focusKey.hint).length - 1).toBe(1)
  })

  it('the chord focuses the icon and is consumed; the same key without the chord does nothing', () => {
    const p = fakePage()
    installFocusKey(p.win, 'legacy')
    const other = p.press({ altKey: false })
    expect(p.icon.focus).not.toHaveBeenCalled()
    expect(other.defaultPrevented).toBe(false)
    const e = p.press()
    expect(p.icon.focus).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(true)
  })

  it('takes no key of the page: Escape, Tab and a plain letter are left alone', () => {
    const p = fakePage()
    installFocusKey(p.win, 'creation')
    for (const over of [{ code: 'Escape', key: 'Escape', altKey: false, shiftKey: false }, { code: 'Tab', key: 'Tab', altKey: false, shiftKey: false }, { code: 'KeyO', key: 'o', altKey: false, shiftKey: false }]) {
      expect(p.press(over).defaultPrevented).toBe(false)
    }
    expect(p.icon.focus).not.toHaveBeenCalled()
  })

  it('does nothing when the key comes from a text field', () => {
    const p = fakePage()
    installFocusKey(p.win, 'legacy')
    p.press({}, { tagName: 'INPUT' })
    p.press({}, { tagName: 'TEXTAREA' })
    expect(p.icon.focus).not.toHaveBeenCalled()
  })

  it.each([['?level=a1&mode=exam&oscar=legacy', 'legacy'], ['?oscar=0', 'creation'], ['?mode=exam', 'creation'], ['?level=sandbox&oscar=legacy', 'legacy']] as const)(
    'does nothing at %s (not practice mode)',
    (search, route) => {
      const p = fakePage(search)
      installFocusKey(p.win, route)
      const e = p.press()
      expect(p.icon.focus).not.toHaveBeenCalled()
      expect(e.defaultPrevented).toBe(false)
    },
  )

  it('removes itself when the icon is gone (the guide was destroyed)', () => {
    const p = fakePage('?level=a1&oscar=legacy', false)
    installFocusKey(p.win, 'legacy')
    expect(p.count()).toBe(1)
    expect(p.press().defaultPrevented).toBe(false)
    expect(p.count()).toBe(0)
  })

  it('never throws on a page without a usable document', () => {
    expect(() => installFocusKey({ location: { search: '' } } as unknown as Window, 'legacy')).not.toThrow()
    expect(() => installFocusKey({ document: {}, location: { search: '' } } as unknown as Window, 'creation')).not.toThrow()
  })
})
