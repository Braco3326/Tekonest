/**
 * CameraPresets DOM (Task 5): long-press saves once and swallows the click that
 * follows; right-click saves; a short click recalls. Fake timers, minimal DOM stub.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CameraPresets, LONG_PRESS_MS, type CameraPresetsDeps } from '../../src/ui/cameraPresets'

type Handler = (e: Record<string, unknown>) => void
class FakeEl {
  hidden = false
  title = ''
  innerHTML = ''
  id = ''
  type = ''
  dataset: Record<string, string> = {}
  children: FakeEl[] = []
  classList = { toggle: () => undefined }
  private h = new Map<string, Handler[]>()
  private attrs = new Map<string, string>()
  addEventListener(ev: string, fn: Handler): void {
    this.h.set(ev, [...(this.h.get(ev) ?? []), fn])
  }
  fire(ev: string, e: Record<string, unknown> = {}): void {
    for (const fn of this.h.get(ev) ?? []) fn({ button: 0, preventDefault: () => undefined, ...e })
  }
  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v)
  }
  getAttribute(k: string): string | null {
    return this.attrs.get(k) ?? null
  }
  className = ''
  textContent = ''
  appendChild(c: FakeEl): FakeEl {
    this.children.push(c)
    return c
  }
  append(...cs: FakeEl[]): void {
    this.children.push(...cs)
  }
}

describe('CameraPresets interactions', () => {
  let root: FakeEl
  let deps: CameraPresetsDeps & { calls: string[] }
  let ui: CameraPresets
  const slotsFilled = [true, false, false]
  const btn = (slot: number): FakeEl => (root.children[0].children.filter((c) => c.dataset.slot === String(slot))[0])

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout })
    vi.stubGlobal('document', { createElement: () => new FakeEl() })
    root = new FakeEl()
    const calls: string[] = []
    deps = {
      calls,
      root: root as unknown as HTMLElement,
      slots: () => slotsFilled.map((f) => (f ? { alpha: 0, beta: 1, radius: 5, target: [0, 0, 0] as [number, number, number] } : null)) as never,
      keyLabel: (s) => String(s + 1),
      available: () => true,
      recall: (s) => calls.push(`recall${s}`),
      save: (s) => calls.push(`save${s}`),
      empty: (s) => calls.push(`empty${s}`),
    }
    ui = new CameraPresets(deps)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('a short click on a filled slot recalls, on an empty slot teaches', () => {
    const b = btn(1)
    b.fire('pointerdown')
    b.fire('pointerup')
    b.fire('click')
    btn(2).fire('click')
    expect(deps.calls).toEqual(['recall0', 'empty1'])
  })

  it('a long-press saves once after 600 ms and swallows the following click', () => {
    const b = btn(1)
    b.fire('pointerdown')
    vi.advanceTimersByTime(LONG_PRESS_MS - 1)
    expect(deps.calls).toEqual([])
    vi.advanceTimersByTime(1)
    expect(deps.calls).toEqual(['save0'])
    b.fire('pointerup')
    b.fire('click') // the click that ends the same gesture
    b.fire('contextmenu') // touch browsers add a contextmenu too
    expect(deps.calls).toEqual(['save0'])
  })

  it('releasing before 600 ms cancels the long-press', () => {
    const b = btn(1)
    b.fire('pointerdown')
    vi.advanceTimersByTime(300)
    b.fire('pointerup')
    vi.advanceTimersByTime(1000)
    expect(deps.calls).toEqual([])
  })

  it('right-click saves', () => {
    btn(3).fire('contextmenu')
    expect(deps.calls).toEqual(['save2'])
  })

  it('Shift+Enter on a slot saves; the named save buttons save too', () => {
    btn(2).fire('keydown', { key: 'Enter', shiftKey: true })
    ui.refresh()
    const row = root.children[0].children.filter((c) => c.className === 'save-row')[0]
    const saves = row.children.filter((c) => c.dataset.save)
    expect(saves).toHaveLength(3)
    saves[2].fire('click')
    expect(deps.calls).toEqual(['save1', 'save2'])
  })
})