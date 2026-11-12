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
const run = async (search: string): Promise<{ booted: boolean; htmlClasses: string[] }> => {
  const win: Record<string, unknown> = {}
  const htmlClasses = new Set<string>()
  vi.stubGlobal('window', win)
  // T4.3: main.ts marks <html> on a practice address (the design packages' look applies there only), so the fake page has a documentElement that records its classes.
  vi.stubGlobal('document', { documentElement: { classList: { add: (c: string) => void htmlClasses.add(c) } } })
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
  return { booted: win.__tekBooted === true, htmlClasses: [...htmlClasses] }
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

describe('the onboarding gates (T2.4b + ruling R-A: main.ts computes them, creation may not import the guide)', () => {
  const gatesFor = async (search: string): Promise<unknown> => {
    bootCreation.mockClear()
    await run(search)
    expect(bootCreation).toHaveBeenCalledTimes(1)
    return (bootCreation.mock.calls[0] as unknown[])[0]
  }
  it('a plain address and ?design: the onboarding and the tutorial are both allowed', async () => {
    expect(await gatesFor('')).toEqual({ onboarding: true, tutorialAllowed: true })
    expect(await gatesFor('?design=1')).toEqual({ onboarding: true, tutorialAllowed: true })
  })
  it('?oscar=0: the profile choice stays (onboarding), the tutorial does not', async () => {
    expect(await gatesFor('?design=1&oscar=0')).toEqual({ onboarding: true, tutorialAllowed: false })
  })
  it('an exam address (any mode parameter, any key case, even with ?design): the onboarding is OFF entirely, so the exam stays silent', async () => {
    expect(await gatesFor('?design=1&mode=exam')).toEqual({ onboarding: false, tutorialAllowed: false })
    expect(await gatesFor('?mode=exam')).toEqual({ onboarding: false, tutorialAllowed: false })
    expect(await gatesFor('?design=1&MODE=practice')).toEqual({ onboarding: false, tutorialAllowed: false })
    expect(await gatesFor('?design=1&mode=exam&oscar=0')).toEqual({ onboarding: false, tutorialAllowed: false })
  })
  it('T4.3: <html> carries cr-practice on a practice address (plain, ?design, ?oscar=0), never on an exam address, even with ?design', async () => {
    for (const search of ['', '?design=3', '?design=1&oscar=0']) expect((await run(search)).htmlClasses, search).toEqual(['cr-practice'])
    for (const search of ['?design=3&mode=exam', '?mode=exam', '?design=1&MODE=practice']) expect((await run(search)).htmlClasses, search).toEqual([])
  })
  it("the guide is still started exactly as before on each of them (the gate is the guide's own)", async () => {
    await run('?design=1&oscar=0')
    expect(bootGuide).toHaveBeenCalledWith('creation')
  })
})
