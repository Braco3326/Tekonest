/** Entry router (ADR-0013): Mode Création by default; ?legacy=1 / ?level= → the legacy app, unchanged. */
import { decideRoute } from './routing'
if (decideRoute(location.search) === 'legacy') void import('./legacyMain')
else void import('./creation/boot').then((m) => m.bootCreation())
