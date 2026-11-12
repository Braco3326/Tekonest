// The entry router's tail that starts the guide: on each route it starts only after the route has booted, never after a failed boot. src/main.ts runs on import,
// so the route modules, the failure screen and the guide entry are replaced by spies and the address is faked.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const bootGuide = vi.fn(() => Promise.resolve(null))
const bootCreation = vi.fn<[], unknown>()
const showBootFailure = vi.fn()
let routeLoad: 'ok' | 'chunk-fails' = 'ok'

vi.mock('../../src/guide', () => ({ bootGuide }))
vi.mock('../../src/creation/bootFailure', () => ({ showBootFailure }))

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
  await new Promise((r) => setTimeout(r, 0))
  for (let i = 0; i < 20; i++) await Promise.resolve()
}
const run = async (search: string): Promise<{ booted: boolean }> => {
  const win: Record<string, unknown> = {}
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', {})
  vi.stubGlobal('location', { search })
  vi.resetModules()
  const load = (mod: unknown) => () => {
    if (routeLoad === 'chunk-fails') throw new Error('chunk 404')
    return mod as Record<string, unknown>
  }
  vi.doMock('../../src/creation/boot', load({ bootCreation }))
  vi.doMock('../../src/legacyMain', load({}))
  await import('../../src/main')
  await flush()
  return { booted: win.__tekBooted === true }
}

beforeEach(() => {
  bootGuide.mockClear()
  bootCreation.mockReset()
  showBootFailure.mockClear()
  routeLoad = 'ok'
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Mode Création tail', () => {
  it('starts the guide, with the creation route, once the route has booted', async () => {
    const r = await run('')
    expect(r.booted).toBe(true)
    expect(bootCreation).toHaveBeenCalledTimes(1)
    expect(bootGuide).toHaveBeenCalledTimes(1)
    expect(bootGuide).toHaveBeenCalledWith('creation')
  })

  it('does not start the guide after a failed boot (bootCreation throws): the failure screen shows, nothing else is started', async () => {
    bootCreation.mockImplementation(() => {
      throw new Error('boot failed')
    })
    await run('')
    expect(showBootFailure).toHaveBeenCalledTimes(1)
    expect(bootGuide).not.toHaveBeenCalled()
  })

  it('does not start the guide after a failed boot that rejects asynchronously', async () => {
    bootCreation.mockImplementation(() => Promise.reject(new Error('late failure')))
    await run('')
    expect(showBootFailure).toHaveBeenCalledTimes(1)
    expect(bootGuide).not.toHaveBeenCalled()
  })

  it('does not start the guide when the route chunk itself fails to load', async () => {
    routeLoad = 'chunk-fails'
    await run('')
    expect(bootGuide).not.toHaveBeenCalled()
  })
})

describe('level page tail', () => {
  it('starts the guide, with the legacy route, once the page has booted', async () => {
    const r = await run('?level=a1&oscar=legacy')
    expect(r.booted).toBe(true)
    expect(bootGuide).toHaveBeenCalledTimes(1)
    expect(bootGuide).toHaveBeenCalledWith('legacy')
  })

  it('does not start the guide when the page chunk fails to load', async () => {
    routeLoad = 'chunk-fails'
    const r = await run('?level=a1&oscar=legacy')
    expect(r.booted).toBe(false)
    expect(bootGuide).not.toHaveBeenCalled()
  })
})
