// bootGuide: the lazy entry. The mount itself is replaced by a spy: what is tested is when, and when not, the guide starts.
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { WAIT_LIMIT_MS, WAIT_STEP_MS, bootGuide } from '../../src/guide/index'
import { mountOscar } from '../../src/guide/mount'

vi.mock('../../src/guide/mount', () => ({ mountOscar: vi.fn() }))

const mount = mountOscar as unknown as MockInstance
const handle = { destroy: vi.fn() }

function fakeWin(search = '', withHook = true, hook: '__creation' | '__audioSim' = '__creation') {
  const win: Record<string, unknown> = {
    location: { search },
    document: { hidden: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), querySelector: vi.fn(() => null) },
    localStorage: { getItem: vi.fn(), setItem: vi.fn() },
    innerWidth: 1280,
    innerHeight: 800,
  }
  if (withHook) win[hook] = hook === '__creation' ? { design: vi.fn(), events: vi.fn(), place: vi.fn() } : { state: vi.fn(), assets: vi.fn(), level: {} }
  return win as unknown as Window & { __creation?: unknown; __audioSim?: unknown }
}

let warnSpy: MockInstance
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  mount.mockReset()
  mount.mockReturnValue(handle)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// With `?oscar=0` or the flag off, nothing mounts, listens or polls. The small entry chunk of the guide is still fetched by the page; the gates inside
// answer before anything heavier (the widget, the bridge, the catalog, the sheets) is requested.
describe('bootGuide gates', () => {
  it.each([['?oscar=0'], ['?mode=exam'], ['?level=a1'], ['?legacy=1'], ['?%4Dode=exam']])('resolves null for %s and mounts nothing', async (search) => {
    const win = fakeWin(search)
    await expect(bootGuide('creation', win)).resolves.toBeNull()
    expect(mount).not.toHaveBeenCalled()
  })

  it.each([['?level=a1&mode=exam'], ['?level=sandbox'], ['?legacy=1'], ['?level=zz'], ['?level=a1&oscar=0'], ['?level=a1&%4Dode=exam'], ['']])('resolves null for the legacy route at %s and mounts nothing', async (search) => {
    await expect(bootGuide('legacy', fakeWin(search, true, '__audioSim'))).resolves.toBeNull()
    expect(mount).not.toHaveBeenCalled()
  })

  it.each([['?level=a1&mode=exam'], ['?level=sandbox'], ['?legacy=1'], ['?level=a1&oscar=0']])('starts no timer for the legacy route at %s, even with no hook (the gates answer before the wait)', async (search) => {
    vi.useFakeTimers()
    await expect(bootGuide('legacy', fakeWin(search, false))).resolves.toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    expect(mount).not.toHaveBeenCalled()
  })

  it('resolves null for a route it does not know', async () => {
    await expect(bootGuide('nowhere' as never, fakeWin())).resolves.toBeNull()
    expect(mount).not.toHaveBeenCalled()
  })

  it.each([['?oscar=0'], ['?mode=exam'], ['?level=a1'], ['?legacy=1']])('starts no timer and fetches nothing for %s (the gates answer before the wait)', async (search) => {
    vi.useFakeTimers()
    await expect(bootGuide('creation', fakeWin(search, false))).resolves.toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    expect(mount).not.toHaveBeenCalled()
  })

  it('resolves null, with one console.warn, when Object.hasOwn is missing, and starts no timer', async () => {
    vi.useFakeTimers()
    const orig = Object.hasOwn
    // @ts-expect-error the feature test is the point
    delete Object.hasOwn
    try {
      await expect(bootGuide('creation', fakeWin())).resolves.toBeNull()
    } finally {
      Object.hasOwn = orig
    }
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(mount).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('resolves null, with one console.warn, when String.prototype.toWellFormed is missing', async () => {
    const proto = String.prototype as unknown as { toWellFormed?: () => string }
    const orig = proto.toWellFormed
    delete proto.toWellFormed
    try {
      await expect(bootGuide('creation', fakeWin())).resolves.toBeNull()
    } finally {
      proto.toWellFormed = orig
    }
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(mount).not.toHaveBeenCalled()
  })

  it('resolves null when the address cannot be read, and never rejects for a window that is not one', async () => {
    const win = fakeWin()
    Object.defineProperty(win, 'location', {
      get() {
        throw new Error('no address')
      },
    })
    await expect(bootGuide('creation', win)).resolves.toBeNull()
    await expect(bootGuide('creation', null as unknown as Window)).resolves.toBeNull()
    await expect(bootGuide('creation', undefined as unknown as Window)).resolves.toBeNull()
    expect(mount).not.toHaveBeenCalled()
  })
})

describe('bootGuide waits for window.__creation', () => {
  it('resolves null when __creation never appears within the limit, and leaves no timer behind', async () => {
    vi.useFakeTimers()
    const win = fakeWin('', false)
    let result: unknown = 'pending'
    void bootGuide('creation', win).then((r) => (result = r))
    await vi.advanceTimersByTimeAsync(WAIT_LIMIT_MS - 1)
    expect(result).toBe('pending')
    await vi.advanceTimersByTimeAsync(WAIT_STEP_MS + 1)
    expect(result).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    expect(mount).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('looks every 250 ms and mounts once the hook appears, with the real pieces behind it', async () => {
    vi.useFakeTimers()
    const win = fakeWin('', false)
    let result: unknown = 'pending'
    void bootGuide('creation', win).then((r) => (result = r))
    await vi.advanceTimersByTimeAsync(2900)
    expect(result).toBe('pending')
    expect(mount).not.toHaveBeenCalled()
    win.__creation = { design: vi.fn(), events: vi.fn(), place: vi.fn() } as never
    await vi.advanceTimersByTimeAsync(WAIT_STEP_MS)
    vi.useRealTimers() // the rest is real module loading
    await vi.waitFor(() => expect(result).toBe(handle), { timeout: 20_000 })
    expect(mount).toHaveBeenCalledTimes(1)
    const deps = mount.mock.calls[0][0] as Record<string, unknown>
    expect(deps.route).toBe('creation')
    expect(deps.search).toBe('')
    expect(deps.win).toBe(win)
    expect(deps.doc).toBe((win as unknown as { document: unknown }).document)
    expect(deps.storage).toBe((win as unknown as { localStorage: unknown }).localStorage)
    expect((deps.registry as { deviceById: Map<string, unknown> }).deviceById.has('yamaha-ql1')).toBe(true)
    expect(Object.keys(deps).sort()).toEqual(['bridge', 'doc', 'now', 'registry', 'route', 'search', 'storage', 'win'])
    const bridge = deps.bridge as Record<string, unknown>
    for (const m of ['snapshot', 'rectOf', 'anchorOfPort', 'anchorOfDevice', 'anchorOfControl', 'onChange', 'destroy']) expect(typeof bridge[m]).toBe('function')
  })

  it('an address that turns into an exam address while the guide waits gives null, and nothing mounts', async () => {
    vi.useFakeTimers()
    const win = fakeWin('', false)
    let result: unknown = 'pending'
    void bootGuide('creation', win).then((r) => (result = r))
    await vi.advanceTimersByTimeAsync(1000)
    ;(win.location as { search: string }).search = '?mode=exam'
    win.__creation = { design: vi.fn() } as never
    await vi.advanceTimersByTimeAsync(WAIT_STEP_MS)
    await vi.advanceTimersByTimeAsync(0)
    expect(result).toBeNull()
    expect(mount).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('the address read after the wait is the one the mount gets', async () => {
    vi.useFakeTimers()
    const win = fakeWin('', false)
    let result: unknown = 'pending'
    void bootGuide('creation', win).then((r) => (result = r))
    await vi.advanceTimersByTimeAsync(500)
    ;(win.location as { search: string }).search = '?x=1'
    win.__creation = { design: vi.fn() } as never
    await vi.advanceTimersByTimeAsync(WAIT_STEP_MS)
    vi.useRealTimers()
    await vi.waitFor(() => expect(result).toBe(handle), { timeout: 20_000 })
    expect((mount.mock.calls[0][0] as { search: string }).search).toBe('?x=1')
  })

  it('a hook that is there at once mounts without waiting', async () => {
    const r = await bootGuide('creation', fakeWin())
    expect(r).toBe(handle)
    expect(mount).toHaveBeenCalledTimes(1)
  })

  it('a hook that shows up on the very last look still counts', async () => {
    vi.useFakeTimers()
    const win = fakeWin('', false)
    let result: unknown = 'pending'
    void bootGuide('creation', win).then((r) => (result = r))
    await vi.advanceTimersByTimeAsync(WAIT_LIMIT_MS - 10)
    win.__creation = { design: vi.fn() } as never
    await vi.advanceTimersByTimeAsync(10)
    vi.useRealTimers()
    await vi.waitFor(() => expect(result).toBe(handle), { timeout: 20_000 })
  })
})

describe('bootGuide on the legacy route', () => {
  it('waits for window.__audioSim (not __creation), looks every 250 ms, and mounts with the legacy bridge', async () => {
    vi.useFakeTimers()
    const win = fakeWin('?level=a1', false)
    win.__creation = { design: vi.fn() } as never // the other route's hook does not count
    let result: unknown = 'pending'
    void bootGuide('legacy', win).then((r) => (result = r))
    await vi.advanceTimersByTimeAsync(2900)
    expect(result).toBe('pending')
    expect(mount).not.toHaveBeenCalled()
    win.__audioSim = { state: vi.fn(), assets: vi.fn(), level: {} } as never
    await vi.advanceTimersByTimeAsync(WAIT_STEP_MS)
    vi.useRealTimers()
    await vi.waitFor(() => expect(result).toBe(handle), { timeout: 20_000 })
    expect(mount).toHaveBeenCalledTimes(1)
    const deps = mount.mock.calls[0][0] as Record<string, unknown>
    expect(deps.route).toBe('legacy')
    expect(deps.search).toBe('?level=a1')
    expect(deps.win).toBe(win)
    const bridge = deps.bridge as Record<string, unknown>
    for (const m of ['snapshot', 'rectOf', 'anchorOfPort', 'anchorOfDevice', 'anchorOfControl', 'onChange', 'destroy']) expect(typeof bridge[m]).toBe('function')
    // the bridge is the legacy one: it reads the level page's hook (a hook with a level and no rig gives a bench it can read), not Mode Création's
    expect(Object.keys(deps).sort()).toEqual(['bridge', 'doc', 'now', 'registry', 'route', 'search', 'storage', 'win'])
  })

  it('gives up quietly after the limit when the hook never comes, leaving no timer', async () => {
    vi.useFakeTimers()
    const win = fakeWin('?level=a1', false)
    let result: unknown = 'pending'
    void bootGuide('legacy', win).then((r) => (result = r))
    await vi.advanceTimersByTimeAsync(WAIT_LIMIT_MS + WAIT_STEP_MS)
    expect(result).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('an address that turns into an exam address while the guide waits gives null, and nothing mounts', async () => {
    vi.useFakeTimers()
    const win = fakeWin('?level=a1', false)
    let result: unknown = 'pending'
    void bootGuide('legacy', win).then((r) => (result = r))
    await vi.advanceTimersByTimeAsync(1000)
    ;(win.location as { search: string }).search = '?level=a1&mode=exam'
    win.__audioSim = { state: vi.fn() } as never
    await vi.advanceTimersByTimeAsync(WAIT_STEP_MS)
    await vi.advanceTimersByTimeAsync(0)
    expect(result).toBeNull()
    expect(mount).not.toHaveBeenCalled()
  })
})

describe('bootGuide failures', () => {
  it('a throw in mountOscar resolves null with one console.warn', async () => {
    mount.mockImplementation(() => {
      throw new Error('boom')
    })
    await expect(bootGuide('creation', fakeWin())).resolves.toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('a mountOscar that returns null (a gate inside said no) resolves null quietly', async () => {
    mount.mockReturnValue(null)
    await expect(bootGuide('creation', fakeWin())).resolves.toBeNull()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('a blocked localStorage is not fatal: the guide mounts without a storage', async () => {
    const win = fakeWin()
    Object.defineProperty(win, 'localStorage', {
      get() {
        throw new Error('blocked')
      },
    })
    await expect(bootGuide('creation', win)).resolves.toBe(handle)
    expect((mount.mock.calls[0][0] as { storage: unknown }).storage).toBeNull()
  })
})
