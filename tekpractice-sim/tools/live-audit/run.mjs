/* eslint-env node */
// Live re-audit of Mode Création on PRODUCTION (https://tekonest.com/tekpractice/jouer/). READ-ONLY: no login, no form posted to a server (saving is localStorage),
// one browser at a time, polite pacing; the only requests are GETs of the public site (pages, assets, a made-up asset URL to see how a missing file answers).
//
// What it checks (night 2 wave 5; the first run is live-reaudit-report.md): CA-01 to CA-27 replayed on the real UI with the mouse and the keyboard, the keyboard-only path,
// touch at 400 x 800, axe on the main screens, a 3-minute legacy session, HTTP behaviour (status, content type and caching of assets), the bundle grep (strings that must not
// ship), the site page. `window.__creation` (shipped in the production bundle) is read as an oracle only.
//
// Usage:  node tools/live-audit/run.mjs [section[,section...]]       (from tekpractice-sim/; sections: ca, ca2, ca3, keyboard, touch, axe, session, legacy, http, site, last;
//         no argument = all of them)
// Env:    AUDIT_OUT   folder for screenshots and results.json (default: <system temp>/tekpractice-live-audit; never inside the repo)
//         LIVE_AUDIT_GPU=1   the real GPU instead of software GL (SwiftShader, the default, a weak-PC proxy)
// Not part of `npm test`, vitest or Playwright (they only read tests/): run it by hand.
import { runCA } from './ca.mjs'
import { runCA2 } from './ca2.mjs'
import { runCA3 } from './ca3.mjs'
import { runKeyboard, runTouch, runAxeScreens, runCreationSession, runLegacy, runHttp, runSitePage } from './extras.mjs'
import { RESULTS } from './lib.mjs'

const all = {
  ca: runCA, ca2: runCA2, ca3: runCA3,
  keyboard: runKeyboard, touch: runTouch, axe: runAxeScreens,
  session: runCreationSession, legacy: runLegacy, http: runHttp, site: runSitePage,
  last: () => import('./last.mjs'),
}
const pick = process.argv[2] ? process.argv[2].split(',') : Object.keys(all)
for (const k of pick) {
  console.log(`\n== ${k}`)
  await all[k]()
}
console.log('\nresults: ' + RESULTS)
