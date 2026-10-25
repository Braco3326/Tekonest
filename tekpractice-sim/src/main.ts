/** Entry router (ADR-0013): Mode Création by default; ?legacy=1 / ?level= → the legacy app, unchanged. */
import { decideRoute } from './routing'
// Static: it must render when the creation chunk itself fails to download.
import { showBootFailure } from './creation/bootFailure'
if (decideRoute(location.search) === 'legacy') void import('./legacyMain')
else
  void import('./creation/boot')
    .then((m) => m.bootCreation())
    .catch((e: unknown) => {
      console.error('[creation] boot failed', e)
      showBootFailure(document, 'load')
    })
