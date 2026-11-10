/** Entry router (ADR-0013): Mode Création by default; ?legacy=1 / ?level= → the legacy app, unchanged. */
import { decideRoute } from './routing'
// Static: it must render when the creation chunk itself fails to download.
import { showBootFailure } from './creation/bootFailure'

/**
 * The inline entry guard of index.html (night 2 wave 5, P1-1; fix round C1) acts ONLY until the route module has loaded: a file that fails later (a lazy chunk: the Bêta sheets, coverage,
 * the drawer, a room, the Essais panel...) is handled by the app itself, and the guard's full-screen alert must never cover it. `booted()` tells it the app has started.
 */
interface EntryGuardWindow {
  __tekBooted?: boolean
  /** Set by the guard: shows its alert (the legacy route has no alert of its own). */
  __tekEntryFailed?: () => void
}
const guard = (): EntryGuardWindow => window as unknown as EntryGuardWindow
const booted = (): void => {
  guard().__tekBooted = true
}

if (decideRoute(location.search) === 'legacy')
  void import('./legacyMain').then(booted, (e: unknown) => {
    console.error('[legacy] boot failed', e)
    const alert = guard().__tekEntryFailed
    if (alert) alert()
    else showBootFailure(document, 'load')
  })
else
  void import('./creation/boot')
    .then((m) => {
      booted() // the route chunk is here: from now on a failing lazy chunk is the app's to handle, never the entry guard's
      return m.bootCreation()
    })
    .catch((e: unknown) => {
      console.error('[creation] boot failed', e)
      showBootFailure(document, 'load')
    })

// Oscar, the guide: its own lazy chunk, fetched after the route has started and never part of the creation start. A failure here is silent (W-12).
void import('./guide').then((m) => m.bootGuide(decideRoute(location.search)), () => undefined)
