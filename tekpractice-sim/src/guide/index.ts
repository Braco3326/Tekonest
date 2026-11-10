// Lazy entry of the guide: src/main.ts imports it after the route has booted and calls `bootGuide(decideRoute(location.search))`.
//
// Nothing here runs before the gates are passed: this file statically imports only the two gate modules (already in the page's own chunk).
// The widget, the controller, the bridge, the catalog and the style sheets are separate lazy chunks, fetched only when the guide will really mount,
// so an exam URL, `?oscar=0` or an old browser never downloads them. `bootGuide` never throws and never rejects: the answer to any
// failure is null and the app is untouched.
import { guideEnabled, guideMode, type GuideRoute } from './mode'

/** How long the guide waits for `window.__creation` (the debug hook the bridge reads), and how often it looks. */
export const WAIT_LIMIT_MS = 10_000
export const WAIT_STEP_MS = 250

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

/** Resolves true once `win.__creation` exists, false after the limit. The timers are cleared in both cases. */
function waitForHook(win: Window): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let waited = 0
    const look = (): void => {
      try {
        if ((win as { __creation?: unknown }).__creation) return resolve(true)
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
    if (!guideEnabled(search)) return null
    // The legacy route comes with the legacy task; until then the guide is creation only.
    if (route !== 'creation') return null
    if (guideMode(search, route) !== 'practice') return null
    if (!runtimeOk()) {
      warn('guide: this browser lacks Object.hasOwn or String.prototype.toWellFormed, the guide stays off')
      return null
    }
    if (!(await waitForHook(win))) return null
    // The address is read again: the page may have moved to an exam address while the guide waited, and the gates must see that one.
    try {
      search = win.location.search
    } catch {
      return null
    }
    if (!guideEnabled(search) || guideMode(search, route) !== 'practice') return null

    const [{ createCreationBridge }, { mountOscar }, { loadCatalog }, catalog] = await Promise.all([
      import('./bridge/creationBridge'),
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
    const bridge = createCreationBridge({ win, registry, doc, now })
    return mountOscar({ win, doc, route, search, bridge, registry, storage, now })
  } catch (e) {
    warn('guide: could not start, the page is untouched', e)
    return null
  }
}
