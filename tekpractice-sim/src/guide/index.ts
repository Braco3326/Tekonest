// Lazy entry of the guide: src/main.ts imports it after the route has booted and calls `bootGuide(decideRoute(location.search))`.
//
// Nothing here runs before the gates are passed: this file statically imports only the two gate modules (already in the page's own chunk).
// The widget, the controller, the bridge, the catalog and the style sheets are separate lazy chunks, fetched only when the guide will really mount,
// so an exam URL, `?oscar=0` or an old browser never downloads them. `bootGuide` never throws and never rejects: the answer to any
// failure is null and the app is untouched.
import type { Registry } from '../engine/CatalogLoader'
import type { TpBridge } from './bridge/types'
import { guideMode, guideRouteAllowed, type GuideRoute } from './mode'

/** How long the guide waits for the route's debug hook (`window.__creation`, or `window.__audioSim` on the level page), and how often it looks. */
export const WAIT_LIMIT_MS = 10_000
export const WAIT_STEP_MS = 250

type MakeBridge = (deps: { win: Window; registry: Registry; doc: Document; now: () => number }) => TpBridge

export interface GuideHandle {
  destroy(): void
}

/** The guide uses `Object.hasOwn` and `String.prototype.toWellFormed`: without them it does not start. */
function runtimeOk(): boolean {
  return typeof Object.hasOwn === 'function' && typeof ''.toWellFormed === 'function'
}

function warn(message: string, e?: unknown): void {
  try {
    if (e === undefined) console.warn(message)
    else console.warn(message, e)
  } catch {
    // nothing left to say it to
  }
}

/** The debug hook each route's bridge reads. */
const HOOK: Record<GuideRoute, '__creation' | '__audioSim'> = { creation: '__creation', legacy: '__audioSim' }

/** Resolves true once the route's hook exists on `win`, false after the limit. The timers are cleared in both cases. */
function waitForHook(win: Window, hook: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let waited = 0
    const look = (): void => {
      try {
        if ((win as unknown as Record<string, unknown>)[hook]) return resolve(true)
      } catch {
        return resolve(false)
      }
      if (waited >= WAIT_LIMIT_MS) return resolve(false)
      waited += WAIT_STEP_MS
      setTimeout(look, WAIT_STEP_MS)
    }
    look()
  })
}

/** `win` defaults to the page's window; it is resolved inside the guard, so even a missing `window` is a null, never a throw. */
export async function bootGuide(route: GuideRoute, target?: Window): Promise<GuideHandle | null> {
  try {
    const win = target ?? window
    let search = ''
    try {
      search = win.location.search
    } catch {
      return null // no readable address: fail closed (the mode cannot be known)
    }
    if (route !== 'creation' && route !== 'legacy') return null
    if (!guideRouteAllowed(search, route)) return null
    if (guideMode(search, route) !== 'practice') return null
    if (!runtimeOk()) {
      warn('guide: this browser lacks Object.hasOwn or String.prototype.toWellFormed, the guide stays off')
      return null
    }
    if (!(await waitForHook(win, HOOK[route]))) return null
    // The address is read again: the page may have moved to an exam address while the guide waited, and the gates must see that one.
    try {
      search = win.location.search
    } catch {
      return null
    }
    if (!guideRouteAllowed(search, route) || guideMode(search, route) !== 'practice') return null

    const [makeBridge, { mountOscar }, { loadCatalog }, catalog] = await Promise.all([
      // One bridge per route: Mode Création reads `window.__creation`, the level page `window.__audioSim`. Each is its own lazy chunk.
      route === 'creation'
        ? import('./bridge/creationBridge').then((m): MakeBridge => (d) => m.createCreationBridge(d))
        : import('./bridge/legacyBridge').then((m): MakeBridge => (d) => m.createLegacyBridge(d)),
      import('./mount'),
      import('../engine/CatalogLoader'),
      import('../../content/catalog.json'),
      // Imported here, not in index.html: Vite puts the sheets in the guide's own chunk, so a page that never mounts it never loads them.
      import('./theme.css'),
      import('./vendor/guide.css'),
    ])
    const registry = loadCatalog(catalog.default)
    const doc = win.document
    let storage: Storage | null = null
    try {
      storage = win.localStorage
    } catch {
      storage = null
    }
    const now = (): number => performance.now()
    const bridge = makeBridge({ win, registry, doc, now })
    return mountOscar({ win, doc, route, search, bridge, registry, storage, now })
  } catch (e) {
    warn('guide: could not start, the page is untouched', e)
    return null
  }
}
