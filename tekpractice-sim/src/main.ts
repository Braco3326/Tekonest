/** Entry router (ADR-0013): Mode Création by default; ?legacy=1 / ?level= → the legacy app, unchanged. */
import { decideRoute } from './routing'
// Static: it must render when the creation chunk itself fails to download.
import { showBootFailure } from './creation/bootFailure'
// The guide's two small gate modules (pure, query only; the guide chunk itself stays lazy): the creation boot may not import the guide, so the answer is passed in.
import { guideMode, guideRouteAllowed } from './guide/mode'
import { PRACTICE_CLASS } from './design/practice'

/**
 * What the creation boot may do of the onboarding (packs T2.4b): the creation code may not import the guide, so the guide's own gates are read here.
 * `onboarding`: practice mode (no `?mode=`, so an exam address leaves the start screen, the record, the chip, the framing and the panel and drawer changes entirely off).
 * `tutorialAllowed`: practice mode and the guide may run (not `?oscar=0`): the start screen offers the tutorial and Aide has « Premiers pas ». `?oscar=0` keeps the profile choice.
 * One more thing on a practice address (plan T4.3): <html> gets the class `cr-practice` (`PRACTICE_CLASS`), the one gate the shell reads (`lookOfRoot`) before a valid `?design`
 * restyles and lays it out; an exam address never gets it, so it never changes, with or without `?design`.
 */
function onboardingGates(search: string): { onboarding: boolean; tutorialAllowed: boolean; practiceNow: () => boolean } {
  const onboarding = guideMode(search, 'creation') === 'practice'
  if (onboarding) document.documentElement.classList.add(PRACTICE_CLASS)
  // `practiceNow`: the same mode gate read again at each call, on the address the page has NOW (a pushState to an exam address turns the entrepreneur's card off)
  return { onboarding, tutorialAllowed: onboarding && guideRouteAllowed(search, 'creation'), practiceNow: () => guideMode(location.search, 'creation') === 'practice' }
}

/**
 * The inline entry guard of index.html (night 2 wave 5, P1-1) acts ONLY until the route module has loaded: a file that fails later (a lazy chunk: the Bêta sheets, coverage,
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
  void import('./legacyMain')
    .then(booted, (e: unknown) => {
      console.error('[legacy] boot failed', e)
      const alert = guard().__tekEntryFailed
      if (alert) alert()
      else showBootFailure(document, 'load')
    })
    // Oscar, the guide, on the level page: the same lazy entry, started once the page has booted (a failed boot leaves `__tekBooted` unset and starts nothing). The
    // guide's own gates keep it silent on an exam address, the sandbox, the dashboard and `?oscar=0`. Nothing in this tail can reject.
    .then(() => (guard().__tekBooted === true ? import('./guide').then((m) => m.bootGuide(decideRoute(location.search))) : undefined))
    .catch(() => undefined)
else {
  // Set by the failure handler below: the route's own boot failed (its chunk, or bootCreation), so there is no debug hook to wait for and the guide is not started.
  let creationFailed = false
  void import('./creation/boot')
    .then((m) => {
      booted() // the route chunk is here: from now on a failing lazy chunk is the app's to handle, never the entry guard's
      return m.bootCreation(onboardingGates(location.search))
    })
    .catch((e: unknown) => {
      creationFailed = true
      console.error('[creation] boot failed', e)
      showBootFailure(document, 'load')
    })
    // Oscar, the guide: its own lazy chunk, fetched only after the route has booted, so its wait for the app's debug hook never overlaps the download of the
    // route chunk. A failure here never reaches the page, and nothing in this tail can reject.
    .then(() => (creationFailed ? undefined : import('./guide').then((m) => m.bootGuide(decideRoute(location.search)))))
    .catch(() => undefined)
}
