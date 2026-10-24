# Mode Création: implementation plan (2026-10-24)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Every task is TDD (superpowers:test-driven-development): failing test → run it red → minimal code → run it green → commit. Steps use checkboxes (`- [ ]`). A task's implementer sees only that task plus `## Global constraints` and `## Decisions taken by default`: everything they need is written in the task.

- **Goal:** TekPractice opens straight into one pro-design-tool mode, « Mode Création ». A learner chooses a place, places and patches real gear in a Fohhn-like editor layout (menu, project tree, properties, status bar, 26-zone view cube), and, once the chain is truly valid, hears a song through each powered speaker and sees honest relative-level coverage dots.
- **Architecture:**
  - A new shell `src/creation/` is the default route; the legacy router (levels, Sandbox, exam, onboarding, dashboard) stays behaviourally unchanged behind `?legacy=1` / `?level=` (C1, strangler pattern C2).
  - A headless `CreationStore` owns the rig (`ConnectionGraph` + placements) and is mutated **only** by intents; a `History` command stack gives undo/redo; a `SceneHost` owns one Babylon `Engine` and one `Scene` per place and reconciles the scene from the store (`planSceneOps`).
  - Rendering is on demand (`RenderScheduler`). Signal-flow gating is the pure `src/flow/signalPath.ts`; acoustics is the pure `src/acoustics/` core behind a thin Web Worker; Web Audio is an adapter over the pure `listenerMix`.
- **Tech stack:** TypeScript strict, Babylon.js 7 (`@babylonjs/core`, `@babylonjs/loaders`), Vite 5, zod 3, vitest 1 (node environment; Babylon `NullEngine` for headless scene tests; no jsdom), Playwright 1.44+ (built bundle on `vite preview` port 4173), Web Audio API, Web Workers. Website: static HTML built by `website-prototype/src/build.py` on branch `design/tekonest-umbrella-brand`.
- **Spec:** brief `tekpractice-sim/docs/plans/2026-10-24-creative-mode-brief.md` (approved by Oscar as the spec), council `docs/audit/2026-10-24-council.md` (decisions C1–C18, task list, cut order: authoritative), audit `docs/audit/2026-10-24-creative-audit.md` (CA-01…CA-27), inventory `docs/audit/assets-inventory.md`, log `docs/CREATIVE-MODE-LOG.md` (L1–L3).
- **Paths:** unless absolute, every path is relative to `tekpractice-sim/` inside the worktree `C:\Users\brro\dev\Tekonest-wt\creative`. Run `npm`/`npx` commands from `C:\Users\brro\dev\Tekonest-wt\creative\tekpractice-sim`.

## Global constraints

Binding on every task. Values are copied from the brief, the council and `tekpractice-sim/CLAUDE.md`.

**Design system (brief §2):**
- Nuit `#131114` chrome, Papier `#F3EDE3` text, Ambre `#DD9349` selection/active, Prune `#612D45`.
- Tektur titles, IBM Plex Sans UI, **square corners** (border-radius 0 everywhere in the shell).
- French UI with English technical terms (XLR, Dante, gain, fader, mute). All shell strings live in `src/creation/copy.ts`; the wording is owned by **tekuxwriter**. No shipped string may contain `[À REMPLACER`.
- Focus ring: 2 px Ambre `#DD9349` + 1 px Nuit outline (≥ 3:1). Text contrast ≥ 4.5:1.

**Layout and accessibility:**
- Target 1366×768. The 3D viewport is **≥ 60 %** of the window area at 1366×768; panels are collapsible with named buttons; nothing overlays the viewport except the view cube (and the inventory drawer while open).
- Every action has a named button; visible focus; Tab is **never** intercepted in Mode Création; the canvas is one tab stop.
- `prefers-reduced-motion` (or the shell's motion setting) → **cuts, not flights**; the drawer opens in 0 ms.
- Keys by `KeyboardEvent.code`, remappable, AZERTY-safe (letter-mnemonic chords Ctrl+Z/Y/S/D match the **labelled** key, see P3); keys never fire while a text field (`input`, `textarea`, `select`, `[contenteditable]`) has focus.

**Navigation (brief §3):**
- View cube top-left: **26 click zones** (6 faces, 12 edges, 8 corners); drag = orbit; generous hit areas with Ambre hover; 120 px at 1366, 130 px at ≥ 1600 px width (C-a).
- **One engine, a second Babylon camera with its own viewport + layer mask; no second WebGL context.**
- Camera flights 450 ms ease-in-out cubic (`TOKENS.focus.flyMs`); reduced motion = cuts.

**Inventory and placement (brief §4):**
- Bottom drawer slides in **≤ 200 ms**; Space or Esc closes it.
- R rotates **15°** (Shift = free, 1°); undo/redo **Ctrl+Z / Ctrl+Y** (and Ctrl+Shift+Z) for every rig action. Selection and camera are never undoable.

**Acoustics (brief §5, council Q5):**
- Direct field `L = L_ref + D(θ, φ) − 20·log10(r / 1 m)`: **−6 dB per doubling** of distance; r floored at 0.5 m.
- `D = max(−6·u², −30) dB`, `u² = (θh/(H/2))² + (θv/(V/2))²`: exactly −6 dB at half the nominal H and V coverage; −30 dB in the rear hemisphere.
- Energetic sum over speakers that receive signal, are powered and are not muted.
- Speed of sound **c = 343 m/s**; Web Audio delay r/c; gain ∝ 1/r.
- Display relative only by default: « dB relatif (0 = point le plus fort) », **0 to −24 dB in 3 dB steps**, locked colour scale + legend + « somme énergétique, champ direct » + source.
- Listener plane at ear height **1.2 m seated (default) / 1.7 m standing**; grid **0.5 m** (1 m, then 2 m, when the point count would exceed 20 000).
- Computed in a **Web Worker on change only, debounce 150 ms**; never per frame.
- Golden tests: 2× distance on axis = −6.02 dB; −6.00 dB at the coverage edge; two equal sources = +3.01 dB.
- Honesty: **no STI, no legal-limit claim** anywhere (grep-tested); « ≈ dB SPL estimé » only when every contributing speaker has sourced `sensitivity_db` and `max_spl_db`, labelled « estimation pédagogique »; hatched overlap « interférences non modélisées »; fidelity chip « relatif ».

**Audio content:** no copyrighted audio bundled or linked. 2–3 CC0 tracks with a verifiable licence URL recorded in `tekpractice-sim/ASSET_LOG.md`, each file ≤ 3 MB (mp3 preferred, ogg allowed). « Choisir un fichier audio… » plays a local file through `URL.createObjectURL` and never uploads or stores it.

**Fohhn rules:** copy the interaction model and information layout only (big viewport, top menu, left project tree, right properties, nav cube top-left, colour legend, statistics). Never Fohhn's graphics, icons, wording, code, data, name or brand. Code comments may say "inspired by pro acoustic-design tools". Never commit Fohhn screenshots.

**Engine invariants (`tekpractice-sim/CLAUDE.md`):**
- `content/catalog.json` and `content/levels/*.json` are the source of truth; new gear or behaviour = data edits, not engine changes.
- The engine (`src/engine/*`) never imports `logic/*`; R1 (connector mate), R2 (signal), R3 (direction) stay engine invariants enforced by `ConnectionGraph.connect()`; `logicChecks` declare R4–R8 only.
- **The UI dispatches intents only**; it never mutates the graph. A static test forbids importing `ConnectionGraph` under `src/creation/shell/`.
- Device switches are state (ADR-0001): catalog `controls`, mutated only by `SET_CONTROL`.
- `src/engine/ConnectionGraph.ts` contains NUL bytes: **do not edit it** (no task needs to).

**Performance:** no per-frame work at idle (no `onBeforeRender` observer while idle; idle = 0 renders in 2 s). Thin-instance dots in one draw call. Creation start chunk ≤ legacy sandbox start chunk + 15 %. Lazy chunks: acoustics + worker, Web Audio, inventory drawer, place-picker thumbnails, songs.

**Legacy:** `?legacy=1` and every `?level=` URL behave exactly as today. Legacy e2e stay green after every task. New behaviour is added to shared modules only behind options whose defaults keep legacy behaviour.

**Git and shipping:**
- Branch `feature/tekpractice-creative-mode`, worktree `C:\Users\brro\dev\Tekonest-wt\creative`. Git is MinGit: in PowerShell 5.1 use `$git = "$env:LOCALAPPDATA\MinGit\cmd\git.exe"` then `& $git ...` (no `&&`; chain with `;` or `if ($?) { … }`).
- Small atomic commits per task (conventional messages). Push after each green phase gate. Never force-push a shared branch. Never commit Fohhn material, copyrighted audio, secrets or `screenshots/`. Leave no background process running (kill every `vite preview` you start).
- Site deploy: Vite `base: '/tekpractice/jouer/'` for the deploy build only (`npm run build:site`); Cloudflare limits 25 MiB per file, 20 000 files; site worktree `C:\Users\brro\dev\Tekonest-wt\site` on `design/tekonest-umbrella-brand`; run `python website-prototype/src/build.py` after any page edit.

**Agents:** only the named agents of `.claude/agents/REGISTRY.md`: **tekdeveloper** (engine, logic, tests, perf), **tekfrontenddesigner** (UI, always with `/frontend-design`), **tekuxwriter** (French copy), **tekdesigner** (tokens, 3D look), **tekreviwer** (reviews, never the author).

## Decisions taken by default

Brief §7 defaults (logged in `docs/CREATIVE-MODE-LOG.md`), inventory facts L1–L3, council decisions C1–C18, and plan-level resolutions P1–P20 (this plan; Oscar can overturn any of them).

| # | Decision |
|---|---|
| S1 | Similarity to Fohhn: same interaction model and layout logic; Tekonest look; no Fohhn assets, wording, code or name |
| S2 | dB display relative by default; « ≈ dB SPL estimé » only with sourced data |
| S3 | Demo songs: CC0 tracks + local file picker; nothing copyrighted bundled |
| S4 | Levels / exams hidden behind `?legacy=1` (`FEATURES.levels = false`); code and tests kept |
| S5 | Catalog proposals shown only in the « Bêta » tab with the badge « non vérifié » |
| S6 | Ear height 1.2 m seated by default; 1.7 m standing selectable |
| S7 | Branch `feature/tekpractice-creative-mode`; site deploys from `design/tekonest-umbrella-brand` |
| L1 | 32 room cards (`content/rooms/` = the TEK Brain templates) + 3 `.glb` venue sets + « Salle vide neutre » = 36 cards |
| L2 | Template gear matches the catalog at 22 % (77/350): « Avec le matériel du modèle » spawns matched devices and lists the rest as « matériel non disponible dans le jeu » |
| L3 | The reference rig QL1 + SM58 + 2 active speakers gets its own starter template « Concert simple (référence) » |
| C1 | New shell `src/creation/` is the default route; legacy behind `?legacy=1` / `?level=`; `FEATURES.levels = false` in `src/features.ts`; ADR-0013 « Mode Création d'abord » |
| C2 | Strangler extraction from `game.ts` only when the shell needs it; legacy e2e green after each move; no new feature code in `bootGame` |
| C3 | One Babylon `Engine` per page; `SceneHost` owns a `Scene` per place; `dispose()` via `DisposableBag`; change place without reload with « Garder le matériel » / « Repartir à vide »; the picker commits only on Enter or click |
| C4 | `RenderScheduler` (invalidate, tween, inertia, lease); backported to `game.ts:1207`; software GL → hardware scaling 1.5 (proposal) |
| C5 | Undo/redo = command stack over intents; inverse intents for granular edits, a DesignState snapshot entry for template/rig/place loads; a drag or stepper burst = 1 transaction |
| C6 | New intents `SET_POSE`, `SPAWN.instanceId?`, `SPAWN.controls?`, `APPLY_DESIGN`; the shell imports no `ConnectionGraph` (static test) |
| C7 | Mains = generic device `multiprise-secteur` (out `iec-c13`, `mains-power`, flag `isMainsSource`) + a `power` toggle (default on) on active devices; powered = power-in connected to a mains source **and** `power` on |
| C8 | Playback = QL1 control `playback-usb` (« Lecture console ») + catalog `routing[]`, read only by `src/flow/signalPath.ts` |
| C9 | Gate `playbackReady` = enabled source on a powered host → path over routes and connections → input of a powered transducer, no error event on the path; mute/fader silence but never gate; « Micro OK » is separate |
| C10 | Tab never intercepted; landmarks + skip link; canvas one tab stop; `[` / `]` cycle devices; Properties « Connexions » + « Connecter à… » is the keyboard/screen-reader patch path |
| C11 | Cube: second camera + layer mask, one box mesh, analytic 26-zone classifier (threshold 0.5), 120/130 px, compass ring, drag = orbit, Dessus/Dessous north-up; all 26 views in Vue and on `V` + arrows; walking at Vue → Marcher / Maj+V |
| C12 | Acoustic fields `{ value, source: { kind, ref, retrieved } }`, zod-required provenance; `nominal` only as 90 × 60 with « valeur nominale »; values copied from the KB |
| C13 | Directivity/field/sum/scale as in Global constraints; pure core tested without a worker; worker thin with transferables, ≤ 20 k points; ADR-0015 |
| C14 | Web Audio pan = speaker direction projected on the listener's **rendered** right vector; gain 1/r; delay r/343 |
| C15 | Place cards with build-time SVG floor plans (proposal); `sync-rooms` keeps `gear_positions`; starter template includes the multiprise (added in Task 32) |
| C16 | Autosave debounced 1 s in `audio-sim/creation.v1`, try/catch, reset on version mismatch; « * » dirty marker; Ctrl+S; Enter submits the name field |
| C17 | French `title_fr` / `teach_fr` on every catalog rule; error pinned at the port; persistent status list; coach placeholders never ship |
| C18 | Port labels on hover/focus only, screen-size-capped; invisible enlarged pick proxies (≥ 24 px); feedback on every missed click; cables coloured by signal type + legend + hover; Draco decoder off |
| P1 | Undo needs id-free inverses: a new intent `UNPLUG { a, b }` disconnects by port pair; `History` records `DISCONNECT` as `UNPLUG` |
| P2 | Debug hook for the shell is `window.__creation` (legacy keeps `window.__audioSim`, which gains an optional `renders()`) |
| P3 | Shell key bindings live in `src/creation/input/creationActions.ts` (legacy `ACTIONS` untouched). Spatial keys bind by `code`; letter-mnemonic chords (Ctrl+Z, Ctrl+Y, Ctrl+S, Ctrl+D) bind as `key:` chords matched on `e.key`, so they follow the labelled key on AZERTY |
| P4 | The multiprise only exists after Task 32: Task 28's keyboard-only e2e wires the mic and the two signal cables; Task 32 extends it with the three power cables |
| P5 | Council T5.2 (live re-audit + report) is folded into the Phase 5 gate, because it needs the live deploy |
| P6 | `Placement` gains optional `tiltDeg` and `mount` (`'floor' \| 'stand' \| 'flown'`); undefined fields are dropped by `canonicalize`, so legacy fingerprints are unchanged |
| P7 | Stereo playback: a source route carries `channels` (`'L'`/`'R'`, parallel to `to`); pass-through routes carry `passive: true` (the K12.2 loop-thru, a parallel link per the KB) and work unpowered |
| P8 | Console sound controls are catalog data on the QL1: `mute-master` (toggle), `fader-master` (enum dB), `balance-master` (enum) |
| P9 | Rear hemisphere (local z < 0) is −30 dB, as the council wrote; for H > 80° this makes a step at the speaker plane, stated in ADR-0015 |
| P10 | Relative mode: `L_ref` = the path's fader dB only (no inter-model sensitivity) |
| P11 | Shell tokens live in `src/design/creationTokens.ts` (`--cr-*` custom properties); legacy `TOKENS` and its look are untouched |
| P12 | Fonts self-hosted: `@fontsource/tektur` + `@fontsource/ibm-plex-sans` (OFL); fallback: vendored woff2 + OFL text under `public/fonts/` |
| P13 | Songs: mp3 preferred (Safari plays it), each ≤ 3 MB, fetched on demand |
| P14 | The starter template lives in `concert-hall-medium`; « Enceinte G » sits at world +x so that it is on screen-left from the Face view (what you see is what you hear; room mirror untouched, Feld's dissent logged) |
| P15 | The shell applies designs through the store + a pure reconciler `planSceneOps`; `src/scene/designApplier.ts` holds the pure helpers shared with `game.ts` (C2) |
| P16 | Inventory drawer gets an extra last tab « Autres » so every catalog device with a model is reachable; « Éclairage » is hidden while empty |
| P17 | Stats (min/max/mean/σ/count) are computed on unclamped relative dB of the listener points |
| P18 | `multiprise-secteur.glb` is generated with `tools/blender/gen_asset.py` (own work); if Blender is unavailable, the placeholder box ships and the device still appears in the « Secteur » tab (logged) |
| P19 | Adding the `power` control to shared catalog devices also adds it to legacy designs; an old Essai may show `power` once in « modifié depuis » (logged, accepted) |
| P20 | Placement: left-drag that **starts on the selected device** moves it; any other left-drag orbits |

---

## Phase 1: Mode Création shell

### Task 1: Router, feature flag, ADR-0013

- **Agent:** tekdeveloper. **Closes:** CA-04 (start route), CA-17 (levels hidden behind legacy). **Decisions:** C1, C2, S4.
- **Files:**
  - Create: `src/features.ts`, `src/routing.ts`, `src/legacyMain.ts` (the current body of `src/main.ts`, moved verbatim), `src/creation/boot.ts` (stub), `src/creation/copy.ts`, `docs/adr/0013-mode-creation-first.md`.
  - Modify: `src/main.ts` (becomes a tiny router), `tests/e2e/dashboard.spec.ts` and `tests/e2e/onboarding.spec.ts` (every `page.goto('/')` → `page.goto('/?legacy=1')`).
  - Test: `tests/routing.test.ts`, `tests/e2e/creation-boot.spec.ts`.
- **Interfaces (produces):**

  ```ts
  // src/features.ts
  export interface Features { levels: boolean }
  export const FEATURES: Features = { levels: false }
  // src/routing.ts
  export type Route = 'creation' | 'legacy'
  export function decideRoute(search: string, features?: Features): Route
  // src/creation/boot.ts
  export async function bootCreation(): Promise<void>
  // src/creation/copy.ts — every shell string; grows task by task
  export const COPY: { readonly [section: string]: Readonly<Record<string, string>> }
  ```

- [ ] **Step 1: write the failing unit test** `tests/routing.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest'
  import { decideRoute } from '../src/routing'

  describe('decideRoute', () => {
    it('no query → Mode Création', () => expect(decideRoute('')).toBe('creation'))
    it('?legacy=1 → legacy home', () => expect(decideRoute('?legacy=1')).toBe('legacy'))
    it('any ?level= → legacy (levels, sandbox, exam)', () => {
      for (const q of ['?level=a1', '?level=sandbox&room=bar-club-stage-small', '?level=a1&mode=exam'])
        expect(decideRoute(q)).toBe('legacy')
    })
    it('?legacy=0 or other params → creation', () => expect(decideRoute('?legacy=0&room=x')).toBe('creation'))
    it('FEATURES.levels = true sends the default URL to legacy', () =>
      expect(decideRoute('', { levels: true })).toBe('legacy'))
  })
  ```

- [ ] **Step 2: run it red.** `npx vitest run tests/routing.test.ts` → FAIL (module not found).
- [ ] **Step 3: implement** `src/features.ts` and `src/routing.ts`:

  ```ts
  // src/routing.ts
  import { FEATURES, type Features } from './features'
  export type Route = 'creation' | 'legacy'
  /** C1: the default URL is Mode Création; legacy keeps every ?level= URL and ?legacy=1. */
  export function decideRoute(search: string, features: Features = FEATURES): Route {
    const p = new URLSearchParams(search)
    if (p.has('level') || p.get('legacy') === '1') return 'legacy'
    return features.levels ? 'legacy' : 'creation'
  }
  ```

- [ ] **Step 4: run it green.** `npx vitest run tests/routing.test.ts` → PASS.
- [ ] **Step 5: move legacy and add the router.**
  - Copy the whole current `src/main.ts` into `src/legacyMain.ts` unchanged (imports, `injectTokens()`, the three branches). Its relative imports stay valid (same folder).
  - Replace `src/main.ts` with:

    ```ts
    /** Entry router (ADR-0013): Mode Création by default; ?legacy=1 / ?level= → the legacy app, unchanged. */
    import { decideRoute } from './routing'
    if (decideRoute(location.search) === 'legacy') void import('./legacyMain')
    else void import('./creation/boot').then((m) => m.bootCreation())
    ```

  - `src/creation/boot.ts` stub: hide `#renderCanvas`, create `<main data-testid="place-picker" class="cr-placeholder"><h1>${COPY.picker.title}</h1></main>` in `document.body`. `COPY.picker.title = 'Choisir un lieu'`. No level, onboarding or dashboard link anywhere.
- [ ] **Step 6: failing e2e** `tests/e2e/creation-boot.spec.ts`:

  ```ts
  import { expect, test } from '@playwright/test'
  test('default URL boots Mode Création on « Choisir un lieu »', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/')
    await expect(page.getByTestId('place-picker')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Choisir un lieu' })).toBeVisible()
    await expect(page.locator('#dashboard')).toBeHidden()
    await expect(page.locator('a[href*="level="]')).toHaveCount(0)
    expect(errors).toEqual([])
  })
  test('?legacy=1 boots the legacy home (onboarding or dashboard)', async ({ page }) => {
    await page.goto('/?legacy=1')
    await expect(page.locator('#dashboard')).toBeVisible()
  })
  ```

- [ ] **Step 7: update the legacy home e2e.** In `tests/e2e/dashboard.spec.ts` (lines 18, 28, 52) and `tests/e2e/onboarding.spec.ts` (lines 5, 24) replace `page.goto('/')` by `page.goto('/?legacy=1')`. Grep `src/ui/` for links to `/` or `./` (today there are none: every legacy link is `?level=…`); keep it that way.
- [ ] **Step 8: run.** `npm run build; if ($?) { npx playwright test tests/e2e/creation-boot.spec.ts tests/e2e/dashboard.spec.ts tests/e2e/onboarding.spec.ts }` → PASS. Then the full legacy suite: `npx playwright test` → all green (the pre-existing focusPatch "A1 wired" flake is noted, never retried away).
- [ ] **Step 9: ADR-0013** `docs/adr/0013-mode-creation-first.md` (French, ADR format of 0012): context (audit CA-04/CA-17, brief §2), decision (C1, C2, `FEATURES.levels`, levels become "missions" later), consequences (legacy URLs unchanged, two entry chunks, legacy e2e use `?legacy=1` for the home).
- [ ] **Step 10: commit.** `& $git add tekpractice-sim/src tekpractice-sim/tests tekpractice-sim/docs/adr/0013-mode-creation-first.md; & $git commit -m "feat(creation): default route boots Mode Création; legacy behind ?legacy=1 (ADR-0013)"`
- **Acceptance:** `decideRoute` tests green; `/` shows « Choisir un lieu » with no level/onboarding/dashboard link; `/?legacy=1` shows the legacy home; full legacy Playwright suite green; ADR-0013 present.

### Task 2: RenderScheduler (render on demand) + legacy backport

- **Agent:** tekdeveloper. **Closes:** CA-18. **Decisions:** C4.
- **Files:**
  - Create: `src/creation/renderScheduler.ts`.
  - Modify: `src/render/detect.ts` (add `isSoftwareRenderer`), `src/scene/CameraRig.ts` (add `get tweening(): boolean`), `src/scene/CableRenderer.ts` (add `get pulseCount(): number`; constructor option `{ pulses?: boolean }` default `true`), `src/game.ts:1207` (backport), `src/game.ts` `__audioSim` type (optional `renders?: () => number`).
  - Test: `tests/creation/renderScheduler.test.ts`, `tests/render/detect.test.ts` (extend), `tests/e2e/renderOnDemand.spec.ts`.
- **Interfaces (produces):**

  ```ts
  export interface InertiaSource {
    inertialAlphaOffset: number; inertialBetaOffset: number; inertialRadiusOffset: number
    inertialPanningX: number; inertialPanningY: number
  }
  export interface SchedulerHooks {
    render(): void
    camera(): InertiaSource | null      // the active orbit camera, null in walk view
    tweening(): boolean                 // a CameraTween is running
    busy?(): boolean                    // legacy only: walk view, placing, cable pulses
  }
  export function hasInertia(c: InertiaSource | null): boolean
  export class RenderScheduler {
    constructor(hooks: SchedulerHooks)
    invalidate(): void
    hold(name: string): () => void      // animation lease; returns an idempotent release
    shouldRender(): boolean
    tick(): boolean                     // renders iff shouldRender(); returns whether it rendered
    get renders(): number
    get leaseNames(): string[]
  }
  export function attachRenderScheduler(
    engine: Engine, scene: Scene, camera: ArcRotateCamera, canvas: HTMLCanvasElement,
    scheduler: RenderScheduler, bag?: DisposableBag, // bag optional until Task 3 lands
  ): void
  // src/render/detect.ts
  export function isSoftwareRenderer(rendererString: string): boolean
  ```

- [ ] **Step 1: failing unit tests** `tests/creation/renderScheduler.test.ts`:

  ```ts
  import { describe, expect, it, vi } from 'vitest'
  import { hasInertia, RenderScheduler, type InertiaSource } from '../../src/creation/renderScheduler'

  const still = (): InertiaSource => ({ inertialAlphaOffset: 0, inertialBetaOffset: 0, inertialRadiusOffset: 0, inertialPanningX: 0, inertialPanningY: 0 })
  function make(over: Partial<{ cam: InertiaSource | null; tween: boolean; busy: boolean }> = {}) {
    const render = vi.fn()
    const state = { cam: still() as InertiaSource | null, tween: false, busy: false, ...over }
    const s = new RenderScheduler({ render, camera: () => state.cam, tweening: () => state.tween, busy: () => state.busy })
    return { s, render, state }
  }

  describe('RenderScheduler', () => {
    it('renders the first frame, then nothing without a signal', () => {
      const { s, render } = make()
      expect(s.tick()).toBe(true)
      for (let i = 0; i < 100; i++) expect(s.tick()).toBe(false)
      expect(render).toHaveBeenCalledTimes(1)
      expect(s.renders).toBe(1)
    })
    it('invalidate() renders exactly one frame', () => {
      const { s, render } = make(); s.tick()
      s.invalidate(); s.tick(); s.tick()
      expect(render).toHaveBeenCalledTimes(2)
    })
    it('keeps rendering while the camera has inertia, stops when the offsets reach 0', () => {
      const { s, render, state } = make(); s.tick()
      state.cam!.inertialAlphaOffset = 0.01
      s.tick(); s.tick()
      state.cam!.inertialAlphaOffset = 0
      s.tick()
      expect(render).toHaveBeenCalledTimes(3)
    })
    it('each inertia channel counts (beta, radius, pan x/y)', () => {
      for (const k of ['inertialBetaOffset', 'inertialRadiusOffset', 'inertialPanningX', 'inertialPanningY'] as const) {
        const c = still(); c[k] = -0.2
        expect(hasInertia(c)).toBe(true)
      }
      expect(hasInertia(still())).toBe(false)
      expect(hasInertia(null)).toBe(false)
    })
    it('a tween keeps rendering', () => {
      const { s, render, state } = make({ tween: true }); s.tick(); s.tick(); s.tick()
      state.tween = false; s.tick()
      expect(render).toHaveBeenCalledTimes(3)
    })
    it('a lease keeps rendering until released; release is idempotent and renders the final frame', () => {
      const { s, render } = make(); s.tick()
      const release = s.hold('meters')
      s.tick(); s.tick()
      expect(s.leaseNames).toEqual(['meters'])
      release(); release()
      s.tick(); s.tick()
      expect(s.leaseNames).toEqual([])
      expect(render).toHaveBeenCalledTimes(4) // first + 2 leased + 1 final after release
    })
    it('two holders of the same lease name both have to release', () => {
      const { s } = make(); s.tick()
      const r1 = s.hold('x'); const r2 = s.hold('x')
      r1(); s.tick()
      expect(s.shouldRender()).toBe(true)
      r2(); s.tick()
      expect(s.shouldRender()).toBe(false)
    })
    it('busy() (legacy) keeps rendering', () => {
      const { s, state } = make({ busy: true }); s.tick()
      expect(s.shouldRender()).toBe(true)
      state.busy = false
      expect(s.shouldRender()).toBe(false)
    })
  })
  ```

  Extend `tests/render/detect.test.ts`:

  ```ts
  it.each([
    ['Google SwiftShader', true], ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))', true],
    ['llvmpipe (LLVM 15.0.7, 256 bits)', true], ['Microsoft Basic Render Driver', true],
    ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)', false],
    ['ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)', false],
  ])('isSoftwareRenderer(%s) = %s', (r, expected) => expect(isSoftwareRenderer(r)).toBe(expected))
  ```

- [ ] **Step 2: run red.** `npx vitest run tests/creation/renderScheduler.test.ts tests/render/detect.test.ts` → FAIL.
- [ ] **Step 3: implement** `src/creation/renderScheduler.ts`:

  ```ts
  /**
   * Render on demand (C4, CA-18): the loop runs every rAF but only renders when
   * something changed. Pure decision (RenderScheduler) + a thin Babylon adapter.
   * ArcRotateCamera applies inertia inside scene.render(), so non-zero inertial
   * offsets keep frames coming until Babylon zeroes them.
   */
  import type { ArcRotateCamera, Engine, Scene } from '@babylonjs/core'

  export interface InertiaSource { inertialAlphaOffset: number; inertialBetaOffset: number; inertialRadiusOffset: number; inertialPanningX: number; inertialPanningY: number }
  export interface SchedulerHooks { render(): void; camera(): InertiaSource | null; tweening(): boolean; busy?(): boolean }

  export function hasInertia(c: InertiaSource | null): boolean {
    return !!c && (c.inertialAlphaOffset !== 0 || c.inertialBetaOffset !== 0 || c.inertialRadiusOffset !== 0 || c.inertialPanningX !== 0 || c.inertialPanningY !== 0)
  }

  export class RenderScheduler {
    private dirty = true
    private leases = new Map<string, number>()
    private count = 0
    constructor(private readonly hooks: SchedulerHooks) {}
    invalidate(): void { this.dirty = true }
    hold(name: string): () => void {
      this.leases.set(name, (this.leases.get(name) ?? 0) + 1)
      this.dirty = true
      let released = false
      return () => {
        if (released) return
        released = true
        const n = (this.leases.get(name) ?? 1) - 1
        if (n <= 0) this.leases.delete(name)
        else this.leases.set(name, n)
        this.dirty = true // one last frame shows the end state
      }
    }
    shouldRender(): boolean {
      return this.dirty || this.leases.size > 0 || this.hooks.tweening() || hasInertia(this.hooks.camera()) || (this.hooks.busy?.() ?? false)
    }
    tick(): boolean {
      if (!this.shouldRender()) return false
      this.dirty = false
      this.hooks.render()
      this.count++
      return true
    }
    get renders(): number { return this.count }
    get leaseNames(): string[] { return [...this.leases.keys()] }
  }

  /** Babylon glue: one runRenderLoop, invalidated by input, camera, scene and resize events. */
  export function attachRenderScheduler(
    engine: Engine, scene: Scene, camera: ArcRotateCamera, canvas: HTMLCanvasElement,
    scheduler: RenderScheduler, bag?: { add(fn: () => void): void },
  ): void {
    const inv = (): void => scheduler.invalidate()
    for (const t of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown', 'keyup'] as const) {
      canvas.addEventListener(t, inv, { passive: true })
      bag?.add(() => canvas.removeEventListener(t, inv))
    }
    const onResize = (): void => { engine.resize(); inv() }
    window.addEventListener('resize', onResize)
    bag?.add(() => window.removeEventListener('resize', onResize))
    const o1 = camera.onViewMatrixChangedObservable.add(inv)
    const o2 = scene.onNewMeshAddedObservable.add(inv)
    const o3 = scene.onMeshRemovedObservable.add(inv)
    bag?.add(() => { camera.onViewMatrixChangedObservable.remove(o1); scene.onNewMeshAddedObservable.remove(o2); scene.onMeshRemovedObservable.remove(o3) })
    engine.runRenderLoop(() => void scheduler.tick())
    bag?.add(() => engine.stopRenderLoop())
  }
  ```

  The `render` hook passed by callers is `() => { scene.render(); if (!scene.isReady()) scheduler.invalidate() }` (materials compiling async keep frames coming, without a per-frame `isReady()` call at idle).
  `isSoftwareRenderer = (r) => /swiftshader|llvmpipe|software|basic render/i.test(r)`.
- [ ] **Step 4: run green.** Same command → PASS.
- [ ] **Step 5: accessors for the hooks.** `CameraRig`: `get tweening(): boolean { return this.tween.active }`. `CableRenderer`: constructor `(scene, budget = new CableBudget(), opts: { pulses?: boolean } = {})`; `addPulse` returns early when `opts.pulses === false`; `get pulseCount(): number { return this.pulses.size }`. Legacy call sites are unchanged (defaults keep pulses).
- [ ] **Step 6: backport to legacy** (`src/game.ts:1207`). Replace `babylon.runRenderLoop(() => scene.render())` by:

  ```ts
  const renderScheduler = new RenderScheduler({
    render: () => { scene.render(); if (!scene.isReady()) renderScheduler.invalidate() },
    camera: () => (scene.activeCamera === camera ? camera : null),
    tweening: () => rig.tweening,
    // Legacy keeps its continuous animations: walking, placing, cable pulses.
    busy: () => explore.exploreView || exploreUi.placing() || cables.pulseCount > 0,
  })
  attachRenderScheduler(babylon, scene, camera, canvas, renderScheduler)
  ```

  Remove the old `window.addEventListener('resize', () => babylon.resize())` line (the adapter owns resize). Add `renders: () => renderScheduler.renders` to the `window.__audioSim` object and `renders?: () => number` to its declared type. If `exploreUi` or `explore` names differ at that line, use the variables already in scope there (grep `new ExploreController` and `placing()` in `game.ts`).
- [ ] **Step 7: software GL scaling (proposal C4).** In `attachRenderScheduler`'s callers (legacy here, the shell in Task 6): `if (isSoftwareRenderer(engine.getGlInfo().renderer)) engine.setHardwareScalingLevel(1.5)`. Log `[render] software GL → scaling 1.5` once.
- [ ] **Step 8: failing e2e** `tests/e2e/renderOnDemand.spec.ts` (legacy a1 has no cables at load):

  ```ts
  import { expect, test } from '@playwright/test'
  test('legacy a1 orbit: 0 renders over 2 s idle, > 0 while orbit-dragging, inertia glide renders after release', async ({ page }) => {
    await page.goto('/?level=a1')
    await page.waitForFunction(() => !!window.__audioSim?.renders)
    await page.waitForTimeout(1500) // let models finish loading
    const r0 = await page.evaluate(() => window.__audioSim!.renders!())
    await page.waitForTimeout(2000)
    expect(await page.evaluate(() => window.__audioSim!.renders!())).toBe(r0)
    const box = (await page.locator('#renderCanvas').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 10 })
    await page.mouse.up()
    const rDrag = await page.evaluate(() => window.__audioSim!.renders!())
    expect(rDrag).toBeGreaterThan(r0)
    const a1 = await page.evaluate(() => window.__audioSim!.camera().alpha)
    await page.waitForTimeout(400)
    const a2 = await page.evaluate(() => window.__audioSim!.camera().alpha)
    expect(Math.abs(a2 - a1)).toBeGreaterThan(0.001) // the glide went on after release
  })
  ```

- [ ] **Step 9: run.** `npm run build; if ($?) { npx playwright test tests/e2e/renderOnDemand.spec.ts }` → PASS, then the full suite `npx playwright test` → green (walking, placing and pulses still animate through `busy`).
- [ ] **Step 10: commit.** `feat(render): on-demand render scheduler; legacy loop backported (CA-18)`.
- **Acceptance:** unit tests prove: no render without a signal; inertia renders until the offsets are 0; tween and lease keep rendering; e2e: 0 renders in 2 s idle, > 0 during a drag, the glide continues after release; full legacy suite green.

### Task 3: DisposableBag + controller `dispose()`

- **Agent:** tekdeveloper. **Decisions:** C3.
- **Files:**
  - Create: `src/util/disposable.ts`.
  - Modify: `src/scene/FocusPatch.ts`, `src/scene/ExploreController.ts`, `src/scene/CameraRig.ts`, `src/scene/CableRenderer.ts`, `src/scene/designerOrbitInput.ts` (add `uninstallDesignerOrbitInput`), `src/scene/Placement.ts`. Each gains `dispose(): void`; legacy never calls it (no behaviour change).
  - Test: `tests/util/disposable.test.ts`, `tests/scene/dispose.test.ts`.
- **Interfaces (produces):**

  ```ts
  export interface ListenTarget {
    addEventListener(type: string, fn: (e: never) => void, opts?: boolean | AddEventListenerOptions): void
    removeEventListener(type: string, fn: (e: never) => void, opts?: boolean | EventListenerOptions): void
  }
  export interface ObservableLike<T> { add(fn: (v: T) => void): unknown; remove(o: unknown): boolean }
  export class DisposableBag {
    static liveListeners: number           // debug/e2e: listeners registered through any bag and not yet removed
    add(fn: () => void): void              // runs immediately if the bag is already disposed
    listen(target: ListenTarget, type: string, fn: (e: never) => void, opts?: boolean | AddEventListenerOptions): void
    observe<T>(observable: ObservableLike<T>, fn: (v: T) => void): void
    get disposed(): boolean
    dispose(): void                        // LIFO, idempotent, one failing disposer never stops the others
  }
  ```

- [ ] **Step 1: failing tests** `tests/util/disposable.test.ts`:

  ```ts
  import { describe, expect, it, vi } from 'vitest'
  import { DisposableBag } from '../../src/util/disposable'

  function fakeTarget() {
    const live = new Set<string>()
    return {
      live,
      addEventListener: vi.fn((t: string, _f: unknown, o?: unknown) => void live.add(`${t}:${JSON.stringify(o ?? null)}`)),
      removeEventListener: vi.fn((t: string, _f: unknown, o?: unknown) => void live.delete(`${t}:${JSON.stringify(o ?? null)}`)),
    }
  }
  describe('DisposableBag', () => {
    it('every listen() has a matching remove with the same options after dispose()', () => {
      const t = fakeTarget(); const bag = new DisposableBag(); const fn = () => {}
      bag.listen(t, 'keydown', fn, true); bag.listen(t, 'wheel', fn, { passive: false })
      expect(t.live.size).toBe(2)
      bag.dispose()
      expect(t.live.size).toBe(0)
      expect(t.removeEventListener).toHaveBeenCalledWith('keydown', fn, true)
    })
    it('is idempotent and LIFO', () => {
      const order: number[] = []; const bag = new DisposableBag()
      bag.add(() => order.push(1)); bag.add(() => order.push(2))
      bag.dispose(); bag.dispose()
      expect(order).toEqual([2, 1])
    })
    it('a throwing disposer does not stop the others', () => {
      const bag = new DisposableBag(); const ok = vi.fn()
      bag.add(ok); bag.add(() => { throw new Error('x') })
      expect(() => bag.dispose()).not.toThrow()
      expect(ok).toHaveBeenCalled()
    })
    it('add() after dispose runs at once', () => {
      const bag = new DisposableBag(); bag.dispose(); const fn = vi.fn(); bag.add(fn)
      expect(fn).toHaveBeenCalledTimes(1)
    })
    it('observe() removes the observer', () => {
      const obs = { add: vi.fn(() => 'o1'), remove: vi.fn(() => true) }; const bag = new DisposableBag()
      bag.observe(obs, () => {}); bag.dispose()
      expect(obs.remove).toHaveBeenCalledWith('o1')
    })
    it('liveListeners counts listeners across bags', () => {
      const before = DisposableBag.liveListeners; const bag = new DisposableBag(); const t = fakeTarget()
      bag.listen(t, 'a', () => {}); bag.listen(t, 'b', () => {})
      expect(DisposableBag.liveListeners).toBe(before + 2)
      bag.dispose()
      expect(DisposableBag.liveListeners).toBe(before)
    })
  })
  ```

  `tests/scene/dispose.test.ts`: NullEngine scene (pattern of `tests/scene/cameraRig.test.ts`), a spy `globalThis.window`/`document` built from `fakeTarget()` plus `matchMedia: () => ({ matches: false })`, `performance` from node. For each of `FocusPatch`, `ExploreController`, `CameraRig`, `CableRenderer` (with one pulse), `Placement`: construct, assert listeners/observers were added, call `dispose()` twice, assert every window/document/canvas listener added was removed and `scene.onBeforeRenderObservable.observers.length` and `scene.onPointerObservable.observers.length` are back to their pre-construction values.
- [ ] **Step 2: run red.** `npx vitest run tests/util/disposable.test.ts tests/scene/dispose.test.ts` → FAIL.
- [ ] **Step 3: implement** `src/util/disposable.ts`:

  ```ts
  export class DisposableBag {
    static liveListeners = 0
    private fns: (() => void)[] = []
    private done = false
    get disposed(): boolean { return this.done }
    add(fn: () => void): void { if (this.done) fn(); else this.fns.push(fn) }
    listen(target: ListenTarget, type: string, fn: (e: never) => void, opts?: boolean | AddEventListenerOptions): void {
      target.addEventListener(type, fn, opts)
      DisposableBag.liveListeners++
      this.add(() => { target.removeEventListener(type, fn, opts); DisposableBag.liveListeners-- })
    }
    observe<T>(observable: ObservableLike<T>, fn: (v: T) => void): void {
      const o = observable.add(fn)
      this.add(() => void observable.remove(o))
    }
    dispose(): void {
      if (this.done) return
      this.done = true
      for (const fn of this.fns.splice(0).reverse()) {
        try { fn() } catch (e) { console.warn('[dispose]', e) }
      }
    }
  }
  ```

  In each controller, route **every** `addEventListener` and observable `.add(` through a private `bag = new DisposableBag()` and add `dispose(): void { this.bag.dispose() }`:
  - `FocusPatch`: `scene.onPointerObservable` observer, canvas `contextmenu`, window `keydown`; `dispose()` also clears glow/dim state (`clearHints()`) and cancels the deferred empty click.
  - `ExploreController`: the `onBeforeRenderObservable` tick and the 9 listeners of its constructor; `dispose()` also exits pointer lock and disposes `this.camera`.
  - `CameraRig`: the canvas `pointerdown`/`wheel`, window `keydown`, and the disposer returned by `tween.cancelOnUserInput(canvas)`; `dispose()` also `tween.cancel()`.
  - `CableRenderer`: the pulse observer; `dispose()` = `clear()` + `endDrag()` + materials disposed.
  - `Placement`: its `onBeforeRenderObservable` observer.
  - `designerOrbitInput.ts`: `export function uninstallDesignerOrbitInput(cam, input): void { cam.inputs.remove(input) }`.
- [ ] **Step 4: run green.** Same command → PASS. `npx tsc --noEmit` clean. `npx vitest run` → whole suite green.
- [ ] **Step 5: legacy check.** `npm run build; if ($?) { npx playwright test tests/e2e/focusPatch.spec.ts tests/e2e/explore.spec.ts tests/e2e/cameraFeel.spec.ts }` → green.
- [ ] **Step 6: commit.** `feat(scene): DisposableBag; dispose() on FocusPatch, Explore, CameraRig, CableRenderer, Placement`.
- **Acceptance:** with spies, every listener and observer added by each controller is removed by `dispose()`; `dispose()` is idempotent; legacy e2e unchanged.

### Task 4: CreationStore, new intents, `designApplier.ts` extraction

- **Agent:** tekdeveloper. **Decisions:** C5, C6, C2, P1, P6, P15.
- **Files:**
  - Modify: `src/ui/intents.ts` (new variants), `src/trials/trial.ts` (`Placement.tiltDeg?`, `Placement.mount?`), `src/game.ts` (call the extracted helpers; its `dispatch` switch simply has no case for the new intents).
  - Create: `src/scene/designApplier.ts` (pure helpers), `src/creation/store.ts`.
  - Test: `tests/creation/store.test.ts`, `tests/creation/shellImports.test.ts`, `tests/scene/designApplier.test.ts`.
- **Interfaces (produces):**

  ```ts
  // src/trials/trial.ts
  export type Mount = 'floor' | 'stand' | 'flown'
  export interface Placement { instanceId: string; deviceId: string; position_m: [number, number, number]; yawDeg: number; tiltDeg?: number; mount?: Mount }
  // src/ui/intents.ts — added variants
  | { type: 'SPAWN'; deviceId: string; position?: [number, number, number]; rotationY?: number; instanceId?: string; controls?: Record<string, ControlValue>; tiltDeg?: number; mount?: Mount }
  | { type: 'SET_POSE'; instanceId: string; position: [number, number, number]; yawDeg: number; tiltDeg: number; mount: Mount }
  | { type: 'APPLY_DESIGN'; design: DesignState }
  | { type: 'UNPLUG'; a: PortRef; b: PortRef }
  // src/scene/designApplier.ts
  export function isFinitePlacement(p: unknown): p is Placement
  export function sanitizePlacements(design: DeepReadonly<DesignState>): Placement[]
  export function rigToDesign(rig: { roomId?: string | null; instances: …; connections: …; controls: …; positions?: Record<string, number[]> }): DesignState
  export function captureDesignFrom(snapshot: RigSnapshot, placements: ReadonlyMap<string, Placement>, roomId: string | null): DesignState
  // src/creation/store.ts
  export type DispatchResult =
    | { ok: true; normalized: Intent; inverse: Intent[]; connectionId?: string }
    | { ok: false; error: { code: string; message: string; ruleId?: string }; subjects: PortRef[] }
  export interface StoreChange { intent: Intent; result: DispatchResult }
  export class CreationStore {
    constructor(registry: Registry, evaluator: RuleEvaluator, initial?: DesignState)
    dispatch(intent: Intent): DispatchResult
    design(): DesignState               // fresh deep copy
    events(): TeachingEvent[]           // RuleEvaluator output after the last change
    snapshot(): RigSnapshot
    canConnect(a: PortRef, b: PortRef): ConnectResult
    connectionAt(ref: PortRef): string | undefined
    get revision(): number
    subscribe(fn: (change: StoreChange) => void): () => void
    newInstanceId(deviceId: string): string // `${deviceId}-${n}`, never reused in this store
  }
  ```

- [ ] **Step 1: failing tests.** `tests/creation/store.test.ts` (real catalog through `tests/helpers.ts`; the evaluator gets a synthetic level `{ id: 'creation', logicChecks: ['R4','R5','R6','R7','R8'], … }` and the real logic modules, exactly like the legacy sandbox in `src/legacyMain.ts`):

  ```ts
  import { describe, expect, it } from 'vitest'
  import { makeRegistry } from '../helpers'
  import { CreationStore } from '../../src/creation/store'
  import { creationEvaluator } from '../../src/creation/store'

  const store = () => { const r = makeRegistry(); return new CreationStore(r, creationEvaluator(r)) }

  describe('CreationStore drives the reference rig through intents only', () => {
    it('spawns with fixed ids, connects, sets controls, poses', () => {
      const s = store()
      for (const [id, dev, x] of [['ql1', 'yamaha-ql1', 0], ['sm58', 'shure-sm58', 1], ['k12-g', 'qsc-k12-2', 6], ['k12-d', 'qsc-k12-2', -6]] as const)
        expect(s.dispatch({ type: 'SPAWN', deviceId: dev, instanceId: id, position: [x, 0, 0] }).ok).toBe(true)
      expect(s.dispatch({ type: 'CONNECT', a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }).ok).toBe(true)
      expect(s.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } }).ok).toBe(true)
      expect(s.dispatch({ type: 'SET_POSE', instanceId: 'k12-g', position: [6, 2.7, -7.5], yawDeg: 15, tiltDeg: -5, mount: 'stand' }).ok).toBe(true)
      const d = s.design()
      expect(d.rig.instances.map((i) => i.instanceId).sort()).toEqual(['k12-d', 'k12-g', 'ql1', 'sm58'])
      expect(d.rig.connections).toHaveLength(2)
      expect(d.placements.find((p) => p.instanceId === 'k12-g')).toMatchObject({ position_m: [6, 2.7, -7.5], yawDeg: 15, tiltDeg: -5, mount: 'stand' })
    })
    it('a rejected CONNECT is a result, not an exception, and changes nothing', () => {
      const s = store()
      s.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k' })
      s.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'q' })
      const r = s.dispatch({ type: 'CONNECT', a: { instance: 'k', port: 'power-in' }, b: { instance: 'q', port: 'in-mic-2' } })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.ruleId).toBe('R3')
      expect(s.design().rig.connections).toHaveLength(0)
    })
    it('returns inverse intents', () => {
      const s = store()
      const sp = s.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm', position: [1, 0, 2] })
      expect(sp.ok && sp.inverse).toEqual([{ type: 'REMOVE', instanceId: 'm' }])
      s.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'q' })
      const c = s.dispatch({ type: 'CONNECT', a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'q', port: 'in-mic-1' } })
      expect(c.ok && c.inverse).toEqual([{ type: 'UNPLUG', a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'q', port: 'in-mic-1' } }])
      const id = c.ok ? c.connectionId! : ''
      const dc = s.dispatch({ type: 'DISCONNECT', connectionId: id })
      expect(dc.ok && dc.normalized).toEqual({ type: 'UNPLUG', a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'q', port: 'in-mic-1' } })
      expect(dc.ok && dc.inverse).toEqual([{ type: 'CONNECT', a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'q', port: 'in-mic-1' } }])
    })
    it('REMOVE inverse brings the device back with its pose, controls and cables', () => {
      const s = store()
      s.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm', position: [1, 0, 2] })
      s.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'q' })
      s.dispatch({ type: 'CONNECT', a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'q', port: 'in-mic-1' } })
      const r = s.dispatch({ type: 'REMOVE', instanceId: 'q' })
      expect(r.ok).toBe(true)
      for (const i of r.ok ? r.inverse : []) s.dispatch(i)
      expect(s.design().rig.connections).toHaveLength(1)
      expect(s.design().rig.instances.some((i) => i.instanceId === 'q')).toBe(true)
    })
    it('APPLY_DESIGN replaces everything; its inverse is the previous design', () => {
      const s = store()
      s.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' })
      const before = s.design()
      const r = s.dispatch({ type: 'APPLY_DESIGN', design: { roomId: 'concert-hall-medium', rig: { instances: [], connections: [], controls: {} }, placements: [] } })
      expect(s.design().rig.instances).toHaveLength(0)
      expect(s.design().roomId).toBe('concert-hall-medium')
      expect(r.ok && r.inverse).toEqual([{ type: 'APPLY_DESIGN', design: before }])
    })
    it('notifies subscribers once per dispatch, and never mutates a returned design', () => {
      const s = store(); let n = 0; s.subscribe(() => n++)
      s.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' })
      const d = s.design(); d.rig.instances.length = 0
      expect(n).toBe(1)
      expect(s.design().rig.instances).toHaveLength(1)
    })
    it('newInstanceId never reuses an id', () => {
      const s = store()
      const a = s.newInstanceId('shure-sm58'); s.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: a })
      s.dispatch({ type: 'REMOVE', instanceId: a })
      expect(s.newInstanceId('shure-sm58')).not.toBe(a)
    })
  })
  ```

  `tests/creation/shellImports.test.ts` (ADR-0008 static-test style):

  ```ts
  import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
  import { join } from 'node:path'
  import { describe, expect, it } from 'vitest'
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
  describe('the shell dispatches intents only (C6)', () => {
    it('no file under src/creation/shell imports ConnectionGraph or engine internals', () => {
      const dir = new URL('../../src/creation/shell/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
      if (!existsSync(dir)) return
      for (const f of walk(dir).filter((p) => p.endsWith('.ts'))) {
        const src = readFileSync(f, 'utf8')
        expect(src, f).not.toMatch(/ConnectionGraph/)
        expect(src, f).not.toMatch(/from\s+['"].*engine\/(ConnectionGraph|RuleEvaluator)['"]/)
      }
    })
  })
  ```

  `tests/scene/designApplier.test.ts`: `isFinitePlacement` rejects NaN/Infinity/short arrays; `rigToDesign` reproduces the conversion that `game.ts` `loadRigByName` does today (4 finite numbers → placement, otherwise dropped); `captureDesignFrom` maps snapshot + placements to a `DesignState` whose controls are copies.
- [ ] **Step 2: run red.** `npx vitest run tests/creation/store.test.ts tests/creation/shellImports.test.ts tests/scene/designApplier.test.ts` → FAIL.
- [ ] **Step 3: implement `src/scene/designApplier.ts`** by moving the pure parts out of `game.ts`: the finite-number validation inside `applyDesign` (lines ~617–628) and the rig → design conversion in `loadRigByName` (lines ~649–660). `game.ts` now calls `sanitizePlacements(design)` and `rigToDesign(rig)`; behaviour identical.
- [ ] **Step 4: implement `src/creation/store.ts`.**

  ```ts
  import { ConnectionGraph } from '../engine/ConnectionGraph'
  import { RuleEvaluator } from '../engine/RuleEvaluator'
  import type { Registry } from '../engine/CatalogLoader'
  import type { ConnectResult, PortRef, RigSnapshot, TeachingEvent } from '../engine/types'
  import type { Intent } from '../ui/intents'
  import type { DesignState, Placement } from '../trials/trial'
  import { captureDesignFrom } from '../scene/designApplier'
  import { phantomCheck } from '../logic/phantom'   // use the exact export names legacyMain/game.ts import
  import { gpioCheck } from '../logic/gpio'
  import { mixMinusCheck } from '../logic/mixMinus'
  import { clockCheck } from '../logic/clock'

  /** The Mode Création evaluator: every domain rule R4–R8 (legacy sandbox parity). */
  export function creationEvaluator(registry: Registry): RuleEvaluator {
    const level = { id: 'creation', version: 1, domain: 'live', title: 'Mode Création', brief: '-', devices: [], requiredChain: [], logicChecks: ['R4', 'R5', 'R6', 'R7', 'R8'], successMessage: '-' } as const
    return new RuleEvaluator(registry, level as never, { 'logic/phantom': phantomCheck, 'logic/gpio': gpioCheck, 'logic/mixMinus': mixMinusCheck, 'logic/clock': clockCheck })
  }

  const clone = <T>(v: T): T => structuredClone(v)
  const EMPTY: DesignState = { roomId: null, rig: { instances: [], connections: [], controls: {} }, placements: [] }

  export class CreationStore {
    private graph: ConnectionGraph
    private placements = new Map<string, Placement>()
    private roomId: string | null
    private lastEvents: TeachingEvent[] = []
    private rev = 0
    private seq = new Map<string, number>()
    private subs = new Set<(c: StoreChange) => void>()

    constructor(private registry: Registry, private evaluator: RuleEvaluator, initial: DesignState = EMPTY) {
      this.graph = new ConnectionGraph(registry, [])
      this.roomId = initial.roomId
      this.load(initial)
    }
    // dispatch(): switch over intent.type; each branch mutates graph/placements,
    // computes { normalized, inverse }, then evaluates rules, bumps revision, notifies.
    //  SPAWN        → addInstance(id ?? newInstanceId), placement {position ?? [0,0,0], yawDeg: rotationY ?? 0, tiltDeg, mount},
    //                 controls via setControl; inverse [REMOVE]
    //  REMOVE       → capture pose, controls, wires; removeInstance; inverse [SPAWN{instanceId, deviceId, position, rotationY, tiltDeg, mount, controls}, ...wires.map(CONNECT)]
    //  CONNECT      → graph.connect; inverse [UNPLUG(a,b)]; connectionId returned
    //  DISCONNECT   → resolve ends from getConnections() by id; normalized UNPLUG(a,b); inverse [CONNECT(a,b)]
    //  UNPLUG       → id = graph.connectionAt(a); must equal connectionAt(b); disconnect; inverse [CONNECT(a,b)]
    //  SET_CONTROL  → previous = graph.getControl; setControl; inverse [SET_CONTROL previous]
    //  SET_POSE     → previous placement; replace; inverse [SET_POSE previous] (missing instance → error UNKNOWN_INSTANCE)
    //  APPLY_DESIGN → before = this.design(); this.load(design); inverse [APPLY_DESIGN before]
    //  LOAD_RIG, RESTORE_INSTANCE → { ok:false, error:{ code:'UNSUPPORTED' } } (legacy-only intents)
  }
  ```

  Write every branch completely (no stubs). `load(design)` = `graph.clear()`, `placements.clear()`, re-add instances (unknown devices are skipped and reported in the result as `error.code = 'UNKNOWN_DEVICE'` only if **all** fail; a partial load is ok and the skipped ids are logged), reconnect, set controls, copy sanitized placements, set `roomId`. `design()` returns `clone(captureDesignFrom(graph.snapshot(), placements, roomId))`. `newInstanceId(deviceId)` keeps a per-device counter that only grows and skips ids present in the graph.
- [ ] **Step 5: add the intent variants** to `src/ui/intents.ts` (types above, with a doc comment per variant) and `Mount`/optional fields to `Placement` in `src/trials/trial.ts`. Check `npx vitest run tests/trials` stays green (fingerprints of designs without the new fields are unchanged, because `canonicalize` drops undefined fields).
- [ ] **Step 6: run green.** `npx vitest run` (whole suite) → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 7: legacy e2e.** `npm run build; if ($?) { npx playwright test tests/e2e/sandbox.spec.ts tests/e2e/essais.spec.ts tests/e2e/finalReview.spec.ts }` → green.
- [ ] **Step 8: commit.** `feat(creation): headless CreationStore with SET_POSE, APPLY_DESIGN, UNPLUG; designApplier helpers extracted`.
- **Acceptance:** vitest drives the reference rig through intents only; the static test forbids `ConnectionGraph` under `src/creation/shell/`; legacy e2e green.

### Task 5: Undo/redo command stack

- **Agent:** tekdeveloper. **Decisions:** C5, P1.
- **Files:** create `src/creation/history.ts`; test `tests/creation/history.test.ts`, `tests/creation/historyProperty.test.ts`.
- **Interfaces:**
  - Consumes: `CreationStore.dispatch(intent): DispatchResult` (Task 4).
  - Produces:

  ```ts
  export interface HistoryEntry { label: string; forward: Intent[]; inverse: Intent[] } // inverse in application order
  export class History {
    constructor(store: { dispatch(i: Intent): DispatchResult }, limit?: number) // default 200 entries
    do(intent: Intent, label?: string): DispatchResult  // dispatch + record (no record when !ok)
    begin(label: string): void                          // open a transaction (nested begin = no-op, depth counted)
    commit(): void                                      // close; an empty transaction records nothing
    rollback(): void                                    // undo everything since begin, record nothing
    undo(): boolean
    redo(): boolean
    get canUndo(): boolean; get canRedo(): boolean
    get undoLabel(): string | null; get redoLabel(): string | null
    get sizes(): { undo: number; redo: number }
    clear(): void
    onChange(fn: () => void): () => void
  }
  ```

- [ ] **Step 1: failing unit tests** `tests/creation/history.test.ts`:
  - `do(SPAWN)` then `undo()` → instance gone; `redo()` → back with the same id.
  - `do(CONNECT)`, `do(DISCONNECT by id)`, `undo()` → connected again, `undo()` → disconnected, `redo()` twice → disconnected (proves P1: the redo of the DISCONNECT is an `UNPLUG` by ports, valid after the id changed).
  - A transaction `begin('Déplacer')` + 30 × `do(SET_POSE)` + `commit()` = **1** entry; `undo()` returns the original pose.
  - Coalescing: consecutive `SET_POSE` of the same instance inside one transaction keep the **first** inverse and the **last** forward (entry has 1 forward, 1 inverse).
  - `rollback()` restores the state at `begin` and records nothing.
  - A failed dispatch records nothing and does not clear the redo stack.
  - A new `do()` after `undo()` clears the redo stack.
  - `limit` drops the oldest entries.
- [ ] **Step 2: failing property test** `tests/creation/historyProperty.test.ts` (seeded PRNG, no new dependency):

  ```ts
  import { describe, expect, it } from 'vitest'
  import { fingerprint } from '../../src/trials/fingerprint'
  // mulberry32(seed) PRNG; pickIntent(rand, store) builds a random valid-or-invalid intent among:
  // SPAWN (5 device ids, fixed fresh ids), REMOVE (existing), CONNECT (random port pair of existing instances),
  // DISCONNECT (existing connection id), SET_CONTROL (a toggle/enum of an existing instance, random allowed value),
  // SET_POSE (existing instance, random pose), and every 25th step a transaction of 3–8 SET_POSE.
  describe('History property: undo all = initial fingerprint, redo all = final fingerprint', () => {
    it('200 random sequences', async () => {
      for (let seed = 1; seed <= 200; seed++) {
        const { store, history, run } = setup(seed)   // run() applies 40 random intents through history
        const initial = await fingerprint(store.design())
        run()
        const final = await fingerprint(store.design())
        while (history.undo()) { /* empty */ }
        expect(await fingerprint(store.design()), `seed ${seed} undo`).toBe(initial)
        while (history.redo()) { /* empty */ }
        expect(await fingerprint(store.design()), `seed ${seed} redo`).toBe(final)
      }
    })
  })
  ```

  Write `setup`, `mulberry32` and `pickIntent` in the test file in full.
- [ ] **Step 3: run red.** `npx vitest run tests/creation/history.test.ts tests/creation/historyProperty.test.ts` → FAIL.
- [ ] **Step 4: implement** `src/creation/history.ts`:

  ```ts
  export class History {
    private undoStack: HistoryEntry[] = []
    private redoStack: HistoryEntry[] = []
    private tx: HistoryEntry | null = null
    private depth = 0
    private listeners = new Set<() => void>()
    constructor(private store: { dispatch(i: Intent): DispatchResult }, private limit = 200) {}

    do(intent: Intent, label = intent.type): DispatchResult {
      const r = this.store.dispatch(intent)
      if (!r.ok) return r
      const step: HistoryEntry = { label, forward: [r.normalized], inverse: r.inverse }
      if (this.tx) this.merge(this.tx, step)
      else this.push(step)
      return r
    }
    begin(label: string): void { if (this.depth++ === 0) this.tx = { label, forward: [], inverse: [] } }
    commit(): void {
      if (this.depth === 0 || --this.depth > 0) return
      const tx = this.tx; this.tx = null
      if (tx && tx.forward.length) this.push(tx)
    }
    rollback(): void {
      if (!this.tx) return
      const tx = this.tx; this.tx = null; this.depth = 0
      for (const i of tx.inverse) this.store.dispatch(i)
      this.emit()
    }
    undo(): boolean {
      const e = this.undoStack.pop(); if (!e) return false
      for (const i of e.inverse) this.store.dispatch(i)
      this.redoStack.push(e); this.emit(); return true
    }
    redo(): boolean {
      const e = this.redoStack.pop(); if (!e) return false
      const inverse: Intent[] = []
      for (const f of e.forward) { const r = this.store.dispatch(f); if (r.ok) inverse.unshift(...r.inverse) }
      this.undoStack.push({ label: e.label, forward: e.forward, inverse }); this.emit(); return true
    }
    /** Inverse order: the last change is undone first. SET_POSE of one instance coalesces. */
    private merge(tx: HistoryEntry, step: HistoryEntry): void {
      const f = step.forward[0]
      if (f.type === 'SET_POSE') {
        const k = tx.forward.findIndex((x) => x.type === 'SET_POSE' && x.instanceId === f.instanceId)
        if (k >= 0) { tx.forward[k] = f; return } // keep the first inverse, the last forward
      }
      tx.forward.push(...step.forward)
      tx.inverse.unshift(...step.inverse)
    }
    private push(e: HistoryEntry): void {
      this.undoStack.push(e)
      if (this.undoStack.length > this.limit) this.undoStack.shift()
      this.redoStack = []; this.emit()
    }
    // canUndo, canRedo, undoLabel, redoLabel, sizes, clear(), onChange(), emit()
  }
  ```

  Note on coalescing correctness: the kept inverse is the pose before the first move; replaying the last forward reaches the final pose. Both directions are absolute poses, so intermediate poses are irrelevant.
- [ ] **Step 5: run green.** Same command → PASS (all 200 seeds).
- [ ] **Step 6: commit.** `feat(creation): undo/redo command stack with transactions (property-tested)`.
- **Acceptance:** 200 random sequences: undo all = initial `fingerprint`, redo all = final; a drag (transaction) is 1 entry. Keys and menu items are wired in Task 7/8 (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z).

### Task 6: SceneHost, scene reconciler, change place without reload

- **Agent:** tekdeveloper. **Closes:** CA-13. **Decisions:** C3, P15, C4.
- **Files:**
  - Create: `src/creation/places.ts`, `src/creation/sceneDiff.ts`, `src/creation/sceneHost.ts`, `src/creation/viewState.ts`, `src/creation/debug.ts`, `src/scene/project.ts` (extracted from `game.ts` `project()`), `src/creation/fitToRoom.ts`.
  - Modify: `src/creation/boot.ts` (create the store, history, SceneHost; expose `window.__creation`), `src/game.ts` (call `project.ts`).
  - Test: `tests/creation/sceneDiff.test.ts`, `tests/creation/fitToRoom.test.ts`, `tests/creation/places.test.ts`, `tests/e2e/creation-places.spec.ts`.
- **Interfaces (produces):**

  ```ts
  // src/creation/places.ts
  export type PlaceRef = { kind: 'room'; id: string } | { kind: 'set'; envId: 'plateau' | 'radio' | 'theatre' } | { kind: 'blank' }
  export const placeKey: (p: PlaceRef) => string          // 'room:<id>' | 'set:<envId>' | 'blank' — stored in DesignState.roomId
  export const placeFromKey: (key: string | null) => PlaceRef
  // src/creation/sceneDiff.ts
  export interface SceneOps {
    spawn: Placement[]                  // new instances (with their pose)
    remove: string[]                    // instance ids
    move: Placement[]                   // pose changed
    cablesAdd: { key: string; a: PortRef; b: PortRef }[]
    cablesRemove: string[]              // cable keys
    reloadPlace: boolean                // roomId changed
  }
  export const cableKey: (a: PortRef, b: PortRef) => string // direction-free, e.g. 'k12-g in-line-a|ql1 out-main-l'
  export function planSceneOps(prev: DesignState | null, next: DesignState): SceneOps
  // src/creation/fitToRoom.ts
  export function fitPlacementsToRoom(design: DesignState, bounds: { width: number; length: number }, floorAt: (x: number, z: number) => number, margin?: number): DesignState
  // src/creation/viewState.ts — never undoable
  export interface ViewStateData { selection: string | null; hidden: string[]; treeOpen: boolean; propsOpen: boolean; earHeight: 1.2 | 1.7 }
  export class ViewState { get(): Readonly<ViewStateData>; set(patch: Partial<ViewStateData>): void; subscribe(fn: () => void): () => void }
  // src/creation/sceneHost.ts
  export class SceneHost {
    constructor(canvas: HTMLCanvasElement, registry: Registry, scheduler: RenderScheduler)
    readonly engine: Engine
    get scene(): Scene | null
    get camera(): ArcRotateCamera | null
    get rig(): CameraRig | null
    get layout(): RoomLayout | null
    get place(): PlaceRef | null
    load(place: PlaceRef, design: DesignState): Promise<void>  // disposes the current scene first
    apply(design: DesignState): void                           // reconcile through planSceneOps
    instance(id: string): DeviceInstance | undefined
    portWorld(ref: PortRef): Vector3 | null
    dispose(): void                                            // scene teardown; the Engine survives
  }
  // src/scene/project.ts
  export function projectToScreen(world: Vector3, scene: Scene, camera: Camera, engine: Engine, canvas: HTMLCanvasElement): { x: number; y: number } | null
  ```

- [ ] **Step 1: failing tests.**
  - `tests/creation/sceneDiff.test.ts`: `planSceneOps(null, d)` spawns everything and adds every cable; same design → all ops empty; a moved instance → `move` only; a removed instance → `remove` + its cables in `cablesRemove`; a cable whose ends swap (`a`/`b` reversed) is **not** a change (`cableKey` is direction-free); `roomId` change → `reloadPlace: true`.
  - `tests/creation/fitToRoom.test.ts`: a placement outside a 10 × 8 room is clamped inside with a 0.5 m margin; `y` becomes `floorAt(x, z)` for `mount: 'floor'` (and keeps its height above the floor for `stand`/`flown`); the rig is unchanged.
  - `tests/creation/places.test.ts`: `placeKey`/`placeFromKey` round-trip; `null` → `{ kind: 'blank' }`; an unknown key → blank.
- [ ] **Step 2: run red.** `npx vitest run tests/creation/sceneDiff.test.ts tests/creation/fitToRoom.test.ts tests/creation/places.test.ts` → FAIL.
- [ ] **Step 3: implement** the three pure modules. `planSceneOps` compares instance ids, placements (by `quantField` from `trials/fingerprint.ts` per field, so float noise is no change) and cable keys.
- [ ] **Step 4: run green.** Same command → PASS.
- [ ] **Step 5: implement `SceneHost`** (Babylon, no new pure logic):
  - Constructor: `this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true })` once. Software GL → `setHardwareScalingLevel(1.5)` (Task 2 helper).
  - `load(place, design)`: `this.dispose()`; `scene = new Scene(engine)`; `scene.clearColor` from `CREATION_TOKENS` (Task 7; until then `#131114`); `camera = new ArcRotateCamera(...)` with `installDesignerOrbitInput` + `applyOrbitFeel`; lights as in `game.ts` lines 229–233; room: lazy `import.meta.glob('../../content/rooms/*.json')` + `roomLayout` + `buildRoom` (same as `src/legacyMain.ts` sandbox branch); set: load `content/environments/<envId>.json` and its `set.glb` as `game.ts` lines 250–275 do; blank: a 24 × 14 ground in Nuit. `spawner = new DeviceSpawner(scene, registry)`, `cables = new CableRenderer(scene, undefined, { pulses: false })`, `rig = new CameraRig(camera)`. `attachRenderScheduler(engine, scene, camera, canvas, scheduler, bag)`. Then `apply(design)`.
  - `apply(design)`: `ops = planSceneOps(this.applied, design)`; if `ops.reloadPlace` → `load(placeFromKey(design.roomId), design)` and return. Remove instances (`inst.dispose()`), spawn (`spawner.spawn(deviceId, Vector3.FromArray(position_m), instanceId)`, yaw/tilt on `root.rotation`), move (`root.position`, `root.rotation`), recompute port world points for moved/spawned instances (as `game.ts` `spawnExact` does), cables remove/add (`cables.addCable(key, a, b)` using `portWorld`), and for moved instances re-add every cable touching them (endpoints follow). Each spawned instance's `modelReady` re-anchors its ports and its cables (as `game.ts` `resyncInstance`) and calls `scheduler.invalidate()`. Store `this.applied = structuredClone(design)`.
  - `dispose()` order (C3): focus/patch controllers registered later call into `this.bag` (Tasks 9, 18, 26); then `cables.dispose()`, every `DeviceInstance.dispose()`, `rig.dispose()`, `uninstallDesignerOrbitInput`, `bag.dispose()` (which stops the render loop), `scene.dispose()`. The `Engine` survives. Set every field to null.
- [ ] **Step 6: boot wiring** (`src/creation/boot.ts`): `injectTokens()` is **not** called (legacy tokens); create `registry = loadCatalog(catalogJson)`, `store = new CreationStore(registry, creationEvaluator(registry))`, `history = new History(store)`, `viewState = new ViewState()`, `scheduler`, `host = new SceneHost(canvas, registry, scheduler)`; `store.subscribe(() => { host.apply(store.design()); scheduler.invalidate() })`. Temporary until Task 12: the picker stub lists 3 hard-coded places as buttons; choosing one dispatches `APPLY_DESIGN` with the new `roomId` through `history` (snapshot entry, C5).
  - Change-place dialog (`role="dialog"`, `aria-modal="true"`, focus trapped, Esc = Annuler) when the current design has ≥ 1 instance: « Garder le matériel » → `APPLY_DESIGN(fitPlacementsToRoom({ ...design, roomId: newKey }, layoutOf(newRoom)))`; « Repartir à vide » → `APPLY_DESIGN(empty with roomId)`; « Annuler ». Copy keys `COPY.place.keep`, `COPY.place.empty`, `COPY.place.cancel`, `COPY.place.dialogTitle` (tekuxwriter).
  - `window.__creation` (`src/creation/debug.ts` declares the global type): `dispatch` (through `history.do`), `design()`, `events()`, `undo()`, `redo()`, `historySize()`, `renders()`, `camera()`, `scenes()` (= `host.engine.scenes.length`), `meshCount()`, `liveListeners()` (= `DisposableBag.liveListeners`), `place()`, `selection()`, `deviceScreen(id)`, `portScreen(ref)`, `worldScreen(p)`.
- [ ] **Step 7: failing e2e** `tests/e2e/creation-places.spec.ts`:

  ```ts
  import { expect, test } from '@playwright/test'
  test('5 place changes without reload: one scene, no leftovers, no leaks, 0 console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/')
    const nav = await page.evaluate(() => performance.getEntriesByType('navigation').length)
    const choose = async (key: string) => {
      await page.evaluate((k) => window.__creation!.choosePlace(k), key) // test hook = same path as a card click
      await page.waitForFunction((k) => window.__creation!.place() === k, key)
    }
    await choose('room:concert-hall-medium')
    const meshesA = await page.evaluate(() => window.__creation!.meshCount())
    const listenersA = await page.evaluate(() => window.__creation!.liveListeners())
    for (const k of ['room:bar-club-stage-small', 'set:theatre', 'blank', 'room:classroom-lab-small', 'room:concert-hall-medium']) await choose(k)
    expect(await page.evaluate(() => window.__creation!.scenes())).toBe(1)
    expect(await page.evaluate(() => window.__creation!.meshCount())).toBe(meshesA)
    expect(await page.evaluate(() => window.__creation!.liveListeners())).toBe(listenersA)
    expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(nav)
    expect(errors).toEqual([])
  })
  test('changing place with gear asks « Garder le matériel / Repartir à vide »', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
    await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] }))
    await page.evaluate(() => void window.__creation!.requestPlace('room:bar-club-stage-small'))
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Garder le matériel' }).click()
    await page.waitForFunction(() => window.__creation!.place() === 'room:bar-club-stage-small')
    expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(1)
    await page.evaluate(() => window.__creation!.undo())
    await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  })
  ```

  `choosePlace(key)` applies without a dialog (empty design); `requestPlace(key)` is the user path (dialog when gear exists). Both are debug hooks calling the same functions as the UI.
- [ ] **Step 8: run.** `npm run build; if ($?) { npx playwright test tests/e2e/creation-places.spec.ts }` → PASS. Full suite green.
- [ ] **Step 9: commit.** `feat(creation): SceneHost with per-place scene, reconciler and dispose; change place without reload (CA-13)`.
- **Acceptance:** 5 successive place changes → `engine.scenes.length === 1`, mesh count back to the first load of the same room, no leaked listeners, no navigation, 0 console errors; the keep/empty dialog works and the place change is undoable. (« ArrowDown in the picker does not commit » is proved in Task 12 with the real picker.)

### Task 7: App shell layout, creation tokens, fonts, copy deck

- **Agents:** tekdesigner (tokens), tekuxwriter (copy deck), tekfrontenddesigner with `/frontend-design` (layout). **Closes:** CA-06, CA-08, CA-21, CA-22. **Decisions:** P11, P12, C10 (landmarks only; keys in Task 8).
- **Files:**
  - Create: `src/design/creationTokens.ts`, `src/creation/shell/creation.css`, `src/creation/shell/layout.ts`, `src/creation/shell/menuModel.ts`, `src/creation/shell/menuBar.ts`, `docs/copy/creation-mode.md` (copy deck), `public/fonts/` only if the P12 fallback is needed.
  - Modify: `src/creation/boot.ts`, `src/creation/copy.ts`, `package.json` (deps `@fontsource/tektur`, `@fontsource/ibm-plex-sans`; devDep `@axe-core/playwright`).
  - Test: `tests/creation/menuModel.test.ts`, `tests/creation/creationTokens.test.ts`, `tests/e2e/creation-layout.spec.ts`.
- **Interfaces (produces):**

  ```ts
  // src/design/creationTokens.ts
  export const CREATION_TOKENS: {
    color: { nuit: '#131114'; papier: '#F3EDE3'; ambre: '#DD9349'; prune: '#612D45'; panel: string; panelLine: string; inkMuted: string; danger: string; ok: string }
    font: { title: string; ui: string }                    // "'Tektur', …" / "'IBM Plex Sans', …"
    size: { menubar: 32; status: 28; tree: 200; props: 260; rail: 32 } // px
    motion: { drawerMs: 180; flyMs: 450 }
  }
  export function injectCreationTokens(root?: HTMLElement): void // sets --cr-* on root
  export function contrastRatio(hexA: string, hexB: string): number
  // src/creation/shell/layout.ts
  export interface ShellDom { root: HTMLElement; menubar: HTMLElement; tree: HTMLElement; viewport: HTMLElement; canvas: HTMLCanvasElement; props: HTMLElement; status: HTMLElement; title: HTMLElement }
  export function mountShell(doc: Document, canvas: HTMLCanvasElement): ShellDom
  // src/creation/shell/menuModel.ts
  export interface MenuItem { id: string; label: string; shortcut?: string; enabled(): boolean; run(): void; children?: MenuItem[] }
  export interface MenuDef { id: 'projet' | 'lieu' | 'materiel' | 'cablage' | 'ecoute' | 'vue' | 'aide'; label: string; items: MenuItem[] }
  export function buildMenus(ctx: MenuContext): MenuDef[]
  export interface MenuContext { history: History; actions: Record<string, () => void>; bindingLabel(action: string): string | undefined }
  ```

- [ ] **Step 1: tokens test first** `tests/creation/creationTokens.test.ts`: the four brand hex values are exact; `contrastRatio(papier, nuit) ≥ 4.5`; `inkMuted` on `panel` ≥ 4.5; `ambre` on `nuit` ≥ 3 (focus ring and selection); every `color` value is a 7-char hex.
- [ ] **Step 2: menu model test** `tests/creation/menuModel.test.ts`: the 7 menus in order Projet · Lieu · Matériel · Câblage · Écoute · Vue · Aide; « Annuler » and « Rétablir » are disabled when `history.canUndo/canRedo` are false and show their shortcut labels from `bindingLabel`; every item has a non-empty French label; no label contains `[À REMPLACER`.
- [ ] **Step 3: run red.** `npx vitest run tests/creation/creationTokens.test.ts tests/creation/menuModel.test.ts` → FAIL.
- [ ] **Step 4: implement tokens** (tekdesigner): `panel` is a raised Nuit (e.g. `#1C191D`), `panelLine` a subtle divider, `inkMuted` a Papier tint that passes 4.5:1 on `panel`, `danger`/`ok` pass 4.5:1 on `panel`. Square corners: no radius token exists in the shell.
- [ ] **Step 5: implement the menu model**; run green (`npx vitest run tests/creation/creationTokens.test.ts tests/creation/menuModel.test.ts` → PASS).
- [ ] **Step 6: copy deck** (tekuxwriter): `docs/copy/creation-mode.md` lists every key of `COPY` with its French text; `src/creation/copy.ts` mirrors it. Sections created now: `shell` (skip link « Aller à la vue 3D », panel names « Projet », « Propriétés », collapse buttons « Replier le panneau Projet » / « Déplier le panneau Projet » / same for Propriétés, canvas aria-label « Vue 3D : flèches = orbiter, [ ] = appareil suivant/précédent, Entrée = cadrer »), `menu` (all menu and item labels), `picker`, `place`. English technical terms kept (XLR, Dante, gain, fader, mute).
- [ ] **Step 7: layout** (tekfrontenddesigner, `/frontend-design`). DOM built by `mountShell` (the existing `#renderCanvas` is moved inside the viewport):

  ```html
  <a class="cr-skip" href="#cr-viewport" data-testid="skip-link">Aller à la vue 3D</a>
  <div class="cr" id="creation-root" data-testid="creation-root">
    <header class="cr-menubar" data-testid="menubar">
      <div role="menubar" aria-label="Menu principal"><!-- 7 role=menuitem buttons, roving tabindex, aria-haspopup="menu" --></div>
      <span class="cr-title" data-testid="project-title"></span>
    </header>
    <nav class="cr-tree" aria-label="Projet" data-testid="project-tree"><button data-testid="tree-collapse" aria-expanded="true">…</button></nav>
    <main class="cr-viewport" id="cr-viewport" tabindex="-1" data-testid="viewport">
      <canvas id="renderCanvas" tabindex="0" aria-label="…"></canvas>
    </main>
    <aside class="cr-props" aria-label="Propriétés" data-testid="properties"><button data-testid="props-collapse" aria-expanded="true">…</button></aside>
    <footer class="cr-status" data-testid="status-bar"></footer>
  </div>
  ```

  CSS grid `grid-template-rows: 32px 1fr 28px; grid-template-columns: var(--cr-tree-w, 200px) 1fr var(--cr-props-w, 260px)`; collapsed panel = 32 px rail with its expand button. 200 + 260 at 1366 × (768 − 60) leaves a 906 × 708 viewport = 61.1 % of 1366 × 768. Fonts: `import '@fontsource/tektur/600.css'` and `import '@fontsource/ibm-plex-sans/400.css'`, `500.css` in `boot.ts` (bundled same-origin). If a package is missing on npm, vendor the woff2 from `github.com/google/fonts` (OFL) into `public/fonts/` with `OFL.txt` and an ASSET_LOG entry (P12). `:focus-visible { outline: 2px solid var(--cr-ambre); outline-offset: 1px; box-shadow: 0 0 0 3px var(--cr-nuit) }`. `border-radius: 0` on every element (`.cr * { border-radius: 0 }`). Menubar follows the WAI-ARIA menubar pattern (Left/Right move, Down/Enter/Space open, Esc closes and returns focus). Menu panels render `MenuDef` items with their shortcut labels.
- [ ] **Step 8: failing e2e** `tests/e2e/creation-layout.spec.ts` (install first: `npm i -D @axe-core/playwright`):

  ```ts
  import AxeBuilder from '@axe-core/playwright'
  import { expect, test } from '@playwright/test'
  test.use({ viewport: { width: 1366, height: 768 } })
  test('viewport ≥ 60 % of the window at 1366×768, nothing overlays it', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
    const r = (await page.getByTestId('viewport').boundingBox())!
    expect((r.width * r.height) / (1366 * 768)).toBeGreaterThanOrEqual(0.6)
    const covered = await page.evaluate(({ x, y, w, h }) => {
      const pts: [number, number][] = []
      for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) pts.push([x + (w * i) / 10, y + (h * j) / 10])
      return pts.filter(([px, py]) => document.elementFromPoint(px, py)?.id !== 'renderCanvas').length
    }, { x: r.x, y: r.y, w: r.width, h: r.height })
    expect(covered).toBeLessThanOrEqual(2) // only the cube corner may cover sample points (Task 17)
  })
  test('panels collapse and expand with named buttons', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Replier le panneau Projet' }).click()
    await expect(page.getByRole('button', { name: 'Déplier le panneau Projet' })).toBeVisible()
    await page.getByRole('button', { name: 'Replier le panneau Propriétés' }).click()
    const r = (await page.getByTestId('viewport').boundingBox())!
    expect(r.width).toBeGreaterThan(1366 - 2 * 32 - 2)
  })
  test('axe: 0 serious/critical issues; fonts are Tektur + IBM Plex Sans; square corners', async ({ page }) => {
    await page.goto('/')
    const res = await new AxeBuilder({ page }).analyze()
    expect(res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.cr-menubar')!).fontFamily)).toMatch(/IBM Plex Sans/)
    const radii = await page.evaluate(() => [...document.querySelectorAll('.cr *')].map((e) => getComputedStyle(e).borderRadius).filter((r) => r !== '0px'))
    expect(radii).toEqual([])
  })
  ```

- [ ] **Step 9: run.** `npm run build; if ($?) { npx playwright test tests/e2e/creation-layout.spec.ts }` → PASS; full suite green.
- [ ] **Step 10: commit.** `feat(creation): app shell layout, Nuit/Papier/Ambre/Prune tokens, Tektur + Plex, copy deck (CA-06, CA-08, CA-21, CA-22)`.
- **Acceptance:** at 1366×768 the canvas is ≥ 60 % of the window and nothing overlays it; panels collapse by named buttons; axe 0 serious/critical; all text ≥ 4.5:1; square corners; self-hosted fonts.

### Task 8: Keyboard model (landmarks, skip link, canvas tab stop, `[` / `]`)

- **Agent:** tekfrontenddesigner (`/frontend-design`) with tekdeveloper for the bindings module. **Closes:** CA-01 (P0). **Decisions:** C10, P3.
- **Files:**
  - Create: `src/creation/input/creationActions.ts`, `src/creation/input/keyboard.ts`, `src/creation/deviceCycle.ts`.
  - Modify: `src/creation/boot.ts`, `src/creation/shell/layout.ts`, `docs/adr/0008-focus-patch-camera.md` (addendum: in Mode Création, Tab is never taken; device cycling is `[`/`]`; legacy keeps Tab).
  - Test: `tests/creation/creationActions.test.ts`, `tests/creation/deviceCycle.test.ts`, `tests/creation/noTabTrap.test.ts`, `tests/e2e/creation-keyboard.spec.ts`.
- **Interfaces (produces):**

  ```ts
  export const CREATION_ACTIONS = [
    'UNDO', 'REDO', 'SAVE', 'DUPLICATE', 'DELETE', 'NEXT_DEVICE', 'PREV_DEVICE', 'FRAME_SELECTION',
    'TOGGLE_INVENTORY', 'TOGGLE_HELP', 'VIEW_PICKER', 'WALK_TOGGLE', 'ROTATE_CW', 'ROTATE_CCW',
    'CAMERA_HOME', 'CAMERA_PRESET_1', 'CAMERA_PRESET_2', 'CAMERA_PRESET_3', 'CANCEL',
  ] as const
  export type CreationAction = (typeof CREATION_ACTIONS)[number]
  export type CreationBindings = Record<CreationAction, string[]>
  export const DEFAULT_CREATION_BINDINGS: CreationBindings
  /** Chords produced by one key event: the code chord ('Ctrl+KeyZ') and the key chord ('Ctrl+key:z'). */
  export function chordsFor(e: { code: string; key: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean; shiftKey?: boolean }): string[]
  export function creationActionsFor(b: CreationBindings, e: Parameters<typeof chordsFor>[0]): CreationAction[]
  export function loadCreationBindings(storage: Storage | null): CreationBindings   // key 'audio-sim/creation-bindings.v1', tolerant like parseBindings
  export function bindingLabel(b: CreationBindings, a: CreationAction): string     // French label: « Ctrl+Z », « Suppr », « Espace », « [ »
  // src/creation/deviceCycle.ts
  export function nextDevice(ids: readonly string[], current: string | null, dir: 1 | -1): string | null
  ```

  Defaults: `UNDO: ['Ctrl+key:z']`, `REDO: ['Ctrl+key:y', 'Ctrl+Shift+key:z']`, `SAVE: ['Ctrl+key:s']`, `DUPLICATE: ['Ctrl+key:d']`, `DELETE: ['Delete']`, `NEXT_DEVICE: ['BracketRight']`, `PREV_DEVICE: ['BracketLeft']`, `FRAME_SELECTION: ['KeyF']`, `TOGGLE_INVENTORY: ['Space']`, `TOGGLE_HELP: ['KeyH']`, `VIEW_PICKER: ['KeyV']`, `WALK_TOGGLE: ['Shift+KeyV']`, `ROTATE_CW: ['KeyR']`, `ROTATE_CCW: ['Shift+KeyR']`, `CAMERA_HOME: ['Alt+KeyH']`, `CAMERA_PRESET_1..3: ['Digit1'..'Digit3']`, `CANCEL: ['Escape']`. In `chordsFor`, Shift **is** a chord prefix (unlike legacy `chordFor`), order `Ctrl+Alt+Meta+Shift+`. Tab, Enter and Escape can never be rebound (reuse `RESERVED_CODES` from `src/input/bindings.ts`).
- [ ] **Step 1: failing tests.**
  - `creationActions.test.ts`: AZERTY Ctrl+Z: event `{ code: 'KeyW', key: 'z', ctrlKey: true }` → `['UNDO']`; QWERTY `{ code: 'KeyZ', key: 'z', ctrlKey: true }` → `['UNDO']`; `{ code: 'KeyZ', key: 'Z', ctrlKey: true, shiftKey: true }` → `['REDO']`; `{ code: 'BracketRight', key: '$' }` (AZERTY `$` key) → `['NEXT_DEVICE']`; `{ code: 'Tab', key: 'Tab' }` → `[]`; loading bindings that try to rebind Tab keeps the defaults; `bindingLabel(DEFAULT, 'DELETE') === 'Suppr'`.
  - `deviceCycle.test.ts`: wraps around both ways; `null` current → first (dir 1) or last (dir −1); empty list → null.
  - `noTabTrap.test.ts` (static): no file under `src/creation/` contains `'Tab'` together with `preventDefault` in the same handler (regex over the source: `/['"]Tab['"][\s\S]{0,200}preventDefault|preventDefault[\s\S]{0,200}['"]Tab['"]/`).
- [ ] **Step 2: run red.** `npx vitest run tests/creation/creationActions.test.ts tests/creation/deviceCycle.test.ts tests/creation/noTabTrap.test.ts` → FAIL.
- [ ] **Step 3: implement** `creationActions.ts` and `deviceCycle.ts`. `src/creation/input/keyboard.ts`: one `keydown` listener on `window` through the shell `DisposableBag`; returns early when `isTextTarget(e.target)` (from `src/scene/cameraTween.ts`) except for `CANCEL` and `SAVE`; dispatches `CreationAction`s to handlers registered by tasks (`onAction(action, fn)`); `preventDefault()` only for handled actions, never for Tab. `NEXT_DEVICE`/`PREV_DEVICE` only act when the canvas has focus: `viewState.set({ selection: nextDevice(ids, sel, ±1) })` and the camera frames it (Task 9 wires the fly). `UNDO`/`REDO` → `history.undo()/redo()` (works from anywhere outside text fields).
- [ ] **Step 4: run green.** Same command → PASS.
- [ ] **Step 5: failing e2e** `tests/e2e/creation-keyboard.spec.ts`:

  ```ts
  import { expect, test } from '@playwright/test'
  test.use({ viewport: { width: 1366, height: 768 } })
  test('from a fresh load, Tab walks skip link → menubar → tree → canvas → properties → status, each with a visible ring', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/'); await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
    await page.evaluate(() => document.body.focus())
    const seen: string[] = []
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement
        const zone = el.closest('[data-testid]')?.getAttribute('data-testid') ?? el.id
        const cs = getComputedStyle(el)
        return { zone, ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 }
      })
      expect(info.ring, `focus ring on ${info.zone}`).toBe(true)
      if (seen[seen.length - 1] !== info.zone) seen.push(info.zone)
    }
    const order = ['skip-link', 'menubar', 'project-tree', 'viewport', 'properties', 'status-bar']
    expect(seen.filter((z) => order.includes(z)).slice(0, 6)).toEqual(order)
  })
  test('[ and ] cycle devices only while the canvas has focus; Ctrl+Z undoes', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
    await page.evaluate(() => { window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1' }); window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58' }) })
    await page.locator('#renderCanvas').focus()
    await page.keyboard.press(']')
    const first = await page.evaluate(() => window.__creation!.selection())
    await page.keyboard.press(']')
    expect(await page.evaluate(() => window.__creation!.selection())).not.toBe(first)
    await page.keyboard.press('Control+z')
    expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(1)
  })
  ```

  (The Properties panel and status bar get focusable content in Tasks 10 and 14; until then each region holds its collapse button or a `tabindex="0"` summary line so the order test runs now.)
- [ ] **Step 6: run.** `npm run build; if ($?) { npx playwright test tests/e2e/creation-keyboard.spec.ts }` → PASS.
- [ ] **Step 7: ADR-0008 addendum** (dated 2026-10-24, « Mode Création »).
- [ ] **Step 8: commit.** `feat(creation): keyboard model — landmarks, skip link, one canvas tab stop, [ ] device cycling (CA-01)`.
- **Acceptance:** from load, Tab reaches menu → tree → canvas → Properties → status in order with a visible ring; no `preventDefault` on Tab anywhere in `src/creation/`; Ctrl+Z works on AZERTY and QWERTY.

### Task 9: Project tree

- **Agent:** tekfrontenddesigner (`/frontend-design`). **Decisions:** C10 (tree = keyboard path).
- **Files:** create `src/creation/shell/treeModel.ts`, `src/creation/shell/projectTree.ts`, `src/creation/selection.ts` (select + fly helper, wires `FocusPatch`-free picking for the shell: a click on a device body selects it and flies, through `CameraRig.flyToDevice(focusFrame(inst))`); modify `src/creation/boot.ts`, `src/creation/copy.ts` (`tree` section); tests `tests/creation/treeModel.test.ts`, `tests/e2e/creation-tree.spec.ts`.
- **Interfaces (produces):**

  ```ts
  export type TreeNodeKind = 'lieu' | 'zones' | 'zone' | 'materiel' | 'device' | 'cables' | 'cable' | 'ecoute' | 'point'
  export interface TreeNode { id: string; kind: TreeNodeKind; label: string; children?: TreeNode[]; target?: { instanceId?: string; cableKey?: string; zoneId?: string; pointId?: string }; hideable: boolean }
  export function buildTree(input: { placeLabel: string; zones: { id: string; kind: string }[]; design: DesignState; deviceLabel(deviceId: string): string; points: { id: string; label: string }[] }): TreeNode[]
  export function flattenVisible(nodes: TreeNode[], expanded: ReadonlySet<string>): TreeNode[] // roving order
  export function treeKey(state: { focused: string; expanded: Set<string> }, key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End', nodes: TreeNode[]): { focused: string; expanded: Set<string> }
  ```

- [ ] **Step 1: failing test** `tests/creation/treeModel.test.ts`: the root order is Lieu → Zones → Matériel → Câbles → Points d'écoute; a device node label is « Yamaha QL1 (ql1) »; a cable node label is « ql1 out-main-l → k12-g in-line-a » using the French port names when available; `treeKey` implements the WAI-ARIA tree keys (Down/Up move, Right expands then enters, Left collapses then goes to the parent, Home/End).
- [ ] **Step 2: run red** `npx vitest run tests/creation/treeModel.test.ts` → FAIL; **implement**; **run green**.
- [ ] **Step 3: DOM** (`role="tree"`, `role="treeitem"`, `aria-level`, `aria-expanded`, `aria-selected`, roving `tabindex`): one tab stop; Enter or click = `viewState.set({ selection })` + fly (`selection.ts`); each device/cable/zone row has an eye toggle button (« Masquer » / « Afficher » + the item name) that flips `viewState.hidden` → `SceneHost` sets `root.setEnabled(false)`; **no** history entry. The tree rebuilds on store and viewState changes (no polling).
- [ ] **Step 4: failing e2e** `tests/e2e/creation-tree.spec.ts`: spawn QL1 at `[0,0,8]`; focus the tree; ArrowDown to the « Matériel » group, ArrowRight, ArrowDown to the QL1 row, Enter → `selection() === 'ql1'` and, with reduced motion, `camera().target` is within 0.3 m of `deviceBodyCenter` (add `deviceBodyCenter(id)` to `__creation`, reusing `debugBodyCenter` logic from `game.ts` moved to `src/scene/debugBody.ts`); press the eye → the QL1 root is disabled (`__creation.visible('ql1') === false`) and `historySize().undo` is unchanged; press it again → visible.
- [ ] **Step 5: run.** `npm run build; if ($?) { npx playwright test tests/e2e/creation-tree.spec.ts }` → PASS.
- [ ] **Step 6: commit.** `feat(creation): project tree (WAI-ARIA tree, select + fly, eye toggles)`.
- **Acceptance:** tree model unit-tested; keyboard select flies to the device; the eye hides/shows without an undo entry.

### Task 10: Properties panel

- **Agent:** tekfrontenddesigner (`/frontend-design`), tekuxwriter for labels. **Closes:** CA-10/CA-11 (numeric pose part). **Decisions:** C5 (stepper burst = 1 transaction), P6.
- **Files:** create `src/creation/shell/propertiesModel.ts`, `src/creation/shell/propertiesPanel.ts`; modify `src/creation/copy.ts` (`props`), `src/creation/boot.ts`; tests `tests/creation/propertiesModel.test.ts`, `tests/e2e/creation-properties.spec.ts`.
- **Interfaces:**

  ```ts
  export interface PropField { id: 'name' | 'x' | 'y' | 'z' | 'yaw' | 'tilt' | 'mount'; label: string; value: string | number; unit?: 'm' | '°'; step?: number; min?: number; max?: number; readOnly?: boolean }
  export interface PropControl { id: string; label: string; kind: 'toggle' | 'enum'; value: ControlValue; options?: string[] }
  export interface PropPort { portId: string; label: string; connector: string; signal: string; dir: 'in' | 'out' | 'bidir'; state: { kind: 'free' } | { kind: 'connected'; to: PortRef; toLabel: string } }
  export interface PropsView { title: string; deviceId: string; fields: PropField[]; controls: PropControl[]; ports: PropPort[] }
  export function propsView(design: DesignState, registry: Registry, instanceId: string): PropsView | null
  /** Parse a field edit into the intent to dispatch (null = invalid input, shown as an error on the field). */
  export function fieldIntent(view: PropsView, design: DesignState, field: PropField['id'], raw: string): Intent | null
  ```

- [ ] **Step 1: failing tests** `tests/creation/propertiesModel.test.ts`: `propsView` for a placed QL1 gives fields x/y/z in metres with 2 decimals, yaw/tilt in degrees, mount « Sol / Pied / Accroché »; controls listed from the catalog; ports listed with state (free/connected to « K12.2 (k12-g) · in-line-a »); `fieldIntent(view, design, 'x', '1,5')` (French decimal comma) → `SET_POSE` with x = 1.5; `'abc'` → null; yaw 370 → 10; tilt clamps to [−90, 90]; mount `floor` forces y = floor height.
- [ ] **Step 2: run red; implement; run green.** `npx vitest run tests/creation/propertiesModel.test.ts`.
- [ ] **Step 3: DOM.** `<aside data-testid="properties">` with a `<form>` per section (« Position », « Orientation », « Montage », « Réglages », « Connexions »). Every input has a `<label for>`; numeric fields are `<input type="text" inputmode="decimal">` with ± stepper buttons (« Diminuer X », « Augmenter X »); Enter commits (`history.do(fieldIntent(...))`), Esc reverts the field to the store value, blur commits. A stepper burst (pointer held or repeated clicks within 600 ms) is one transaction: `history.begin('Régler <label>')` on the first step, `commit()` 600 ms after the last. Toggles are `<button aria-pressed>`; enums are `<select>`. The « Connexions » list is read-only here (Task 27 adds the buttons). Empty selection → « Aucune sélection » + a hint to use the tree or `[ ]`.
- [ ] **Step 4: failing e2e** `tests/e2e/creation-properties.spec.ts`: select the QL1, type `2,5` in X + Enter → `design()` placement x = 2.5 and `historySize().undo` +1; Ctrl+Z → back; type `abc` + Enter → the field shows an error message (`aria-invalid="true"`, `aria-describedby`) and nothing is dispatched; type `9` then Esc → field shows the store value; click « Augmenter Lacet » 5 times quickly → 1 undo entry.
- [ ] **Step 5: run.** `npm run build; if ($?) { npx playwright test tests/e2e/creation-properties.spec.ts }` → PASS.
- [ ] **Step 6: commit.** `feat(creation): Properties panel (pose, mount, controls, connections)`.
- **Acceptance:** editing x dispatches an undoable `SET_POSE`; every input is labelled; Enter commits; Esc reverts.

### Task 11: Rooms sync keeps `gear_positions`; templates

- **Agent:** tekdeveloper. **Decisions:** C15, L2, L3, P14.
- **Files:**
  - Modify: `tools/sync-rooms.ts` (`KEEP` gains `'gear_positions'`, `'coordinate_system'`), `src/explore/roomSchema.ts` (`GearPosition`, optional fields), then re-run the sync so `content/rooms/*.json` carry the data.
  - Create: `src/creation/templateSchema.ts`, `src/creation/templates.ts`, `src/creation/templateGear.ts`, `content/templates/concert-simple-reference.json`.
  - Test: `tests/explore/roomSchema.test.ts` (extend), `tests/creation/templateGear.test.ts`, `tests/creation/templates.test.ts`.
- **Interfaces:**

  ```ts
  // src/explore/roomSchema.ts
  export const GearPosition = z.object({ equipment_id: z.string(), zone: z.string(), position_m: z.tuple([z.number(), z.number(), z.number()]), rotation_deg: z.number().optional(), note: z.string().optional() })
  // RoomFile gains: gear_positions: z.array(GearPosition).optional(), coordinate_system: z.string().optional()
  // src/creation/templateSchema.ts
  export const Template = z.object({ id: z.string(), name_fr: z.string(), roomId: z.string(), instances: z.array(z.object({ instanceId: z.string(), deviceId: z.string() })), connections: z.array(z.object({ a: PortRef, b: PortRef })), controls: z.record(z.record(z.union([z.boolean(), z.string()]))), placements: z.array(PlacementSchema) })
  // src/creation/templateGear.ts
  export interface GearSpawnPlan { design: DesignState; unavailable: { equipmentId: string; zone: string; note?: string }[] }
  export function designFromRoomGear(room: RoomFileT, registry: Registry): GearSpawnPlan
  // src/creation/templates.ts
  export function loadTemplates(): Promise<TemplateT[]>   // import.meta.glob('../../content/templates/*.json')
  export function templateToDesign(t: TemplateT): DesignState
  ```

- [ ] **Step 1: failing schema test:** a room object with `gear_positions` survives `RoomFile.parse` (zod strips unknown keys, so the field must be declared) and the real `content/rooms/radio-talk-studio-medium.json` (after Step 3) has 14 entries.
- [ ] **Step 2: failing spawn test** `tests/creation/templateGear.test.ts`: `designFromRoomGear(radio-talk-studio-medium, registry)` → 9 instances (ev-re20 ×4, yellowtec-mika, yellowtec-litt, genelec-8030c ×2, playout-pc) with ids `<deviceId>-g<n>`, placements from `position_m` and `yawDeg = rotation_deg ?? 0`, `roomId = 'room:radio-talk-studio-medium'`, and 5 unavailable (behringer-ha400, beyerdynamic-dt-770-pro, dhd-rx2, rtw-touchmonitor-tm7, telos-hx2).
- [ ] **Step 3: run red; implement; regenerate rooms.** `npx tsx tools/sync-rooms.ts` → « 32 rooms written »; `npx vitest run tests/explore/roomSchema.test.ts tests/creation/templateGear.test.ts` → PASS. Commit the regenerated `content/rooms/*.json` in the same commit.
- [ ] **Step 4: starter template** `content/templates/concert-simple-reference.json` (multiprise and power cables come in Task 32):

  ```json
  {
    "id": "concert-simple-reference",
    "name_fr": "Concert simple (référence)",
    "roomId": "room:concert-hall-medium",
    "instances": [
      { "instanceId": "ql1", "deviceId": "yamaha-ql1" },
      { "instanceId": "sm58", "deviceId": "shure-sm58" },
      { "instanceId": "k12-g", "deviceId": "qsc-k12-2" },
      { "instanceId": "k12-d", "deviceId": "qsc-k12-2" }
    ],
    "placements": [
      { "instanceId": "ql1", "deviceId": "yamaha-ql1", "position_m": [0, 0, 8], "yawDeg": 180, "mount": "floor" },
      { "instanceId": "sm58", "deviceId": "shure-sm58", "position_m": [0, 2.8, -9], "yawDeg": 0, "mount": "stand" },
      { "instanceId": "k12-g", "deviceId": "qsc-k12-2", "position_m": [6, 2.7, -7.5], "yawDeg": 0, "tiltDeg": 0, "mount": "stand" },
      { "instanceId": "k12-d", "deviceId": "qsc-k12-2", "position_m": [-6, 2.7, -7.5], "yawDeg": 0, "tiltDeg": 0, "mount": "stand" }
    ],
    "connections": [ { "a": { "instance": "sm58", "port": "out-xlr" }, "b": { "instance": "ql1", "port": "in-mic-1" } } ],
    "controls": {}
  }
  ```

  The stage of `concert-hall-medium` is the zone `scene` (centre z = −11.5, depth 9, floor 1.3 m); FOH is `regie-facade` (z = 8). « G » is at world +x (P14).
- [ ] **Step 5: failing template test** `tests/creation/templates.test.ts`: every file under `content/templates/` parses; every `deviceId` exists in the catalog; every connection passes `ConnectionGraph.canConnect` once the instances exist; `templateToDesign` → a `DesignState` whose placements match.
- [ ] **Step 6: run green.** `npx vitest run tests/creation/templates.test.ts` → PASS.
- [ ] **Step 7: commit.** `feat(creation): rooms keep gear_positions; starter template « Concert simple (référence) »`.
- **Acceptance:** schema test proves `gear_positions` survives the sync; `radio-talk-studio-medium` → 9 devices + 5 listed unavailable; the starter template validates.

### Task 12: « Choisir un lieu » picker + build-time SVG plans

- **Agents:** tekdeveloper (thumbnail tool, model), tekfrontenddesigner (`/frontend-design`, cards), tekuxwriter (card copy). **Closes:** CA-04, CA-13 (keyboard browse never commits). **Decisions:** C15, L1, L2.
- **Files:**
  - Create: `src/creation/roomPlanSvg.ts` (pure), `tools/room-thumbs.ts`, `public/room-thumbs/*.svg` (generated, committed), `src/creation/shell/placePickerModel.ts`, `src/creation/shell/placePicker.ts`.
  - Modify: `package.json` (`"thumbs:rooms": "tsx tools/room-thumbs.ts"`; `"build": "tsx tools/room-thumbs.ts && tsc && vite build"`), `src/creation/boot.ts` (replace the Task 6 stub).
  - Test: `tests/creation/roomPlanSvg.test.ts`, `tests/creation/placePickerModel.test.ts`, `tests/e2e/creation-picker.spec.ts`.
- **Interfaces:**

  ```ts
  export function roomPlanSvg(room: RoomFileT): string  // viewBox in metres, zones by kind (stage, audience, foh…), openings, front wall marked; Nuit/Papier/Ambre/Prune only; ≤ 8 KB
  export interface PlaceCard { key: string; title: string; sizeLabel: string; typeLabel: string; thumb: string; withGear: boolean; withGearCount: number }
  export function placeCards(input: { rooms: { id: string; name_fr: string; family: string; size: string; dims?: [number, number, number]; catalogGear: number }[]; sets: { envId: string; name: string }[] }): PlaceCard[] // 32 rooms + 3 sets + « Salle vide neutre » = 36
  export function gridMove(index: number, key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End', count: number, columns: number): number
  export const WITH_GEAR_ROOMS: readonly string[] // L2: the 5 rooms with the highest catalog share, computed from data (radio-talk-studio-medium, radio-studio-self-op-small, wedding-event-hall-medium, museum-installed-sound-medium, post-atmos-mix-room-medium)
  ```

- [ ] **Step 1: failing tests.** `roomPlanSvg` for each of the 32 rooms: starts with `<svg`, ≤ 8192 bytes, contains one `<rect` per zone, uses only the 4 brand colours plus `none`; `placeCards` → 36 cards, unique keys, the « Avec le matériel » flag on exactly the 5 `WITH_GEAR_ROOMS` (computed in the test from `gear_positions` × catalog ids, sorted by matched count, ties by id); `gridMove` never leaves `[0, count)`.
- [ ] **Step 2: run red; implement; run green.** `npx vitest run tests/creation/roomPlanSvg.test.ts tests/creation/placePickerModel.test.ts`.
- [ ] **Step 3: generate thumbnails.** `npx tsx tools/room-thumbs.ts` writes `public/room-thumbs/<id>.svg` for 32 rooms + `set-plateau.svg`, `set-radio.svg`, `set-theatre.svg`, `blank.svg`. Commit them (deterministic output; the build re-runs the tool).
- [ ] **Step 4: DOM.** Full-viewport overlay `data-testid="place-picker"` with heading « Choisir un lieu », a filter by type, a `role="grid"`-like listbox of cards (`role="listbox"`, each card `role="option"`, `aria-selected`), each card: SVG `<img alt="">` + name + « L × l × h m » + type + badge « Avec le matériel » where applicable. **Arrow keys only move the highlight; Enter or a click commits** (CA-13). Committing a card with a template badge asks « Salle vide » / « Avec le matériel du modèle » (radio group + « Ouvrir »). « Avec le matériel du modèle » applies `designFromRoomGear` and shows a dismissible note listing « matériel non disponible dans le jeu : … ». A separate card row « Modèles » offers « Concert simple (référence) ». The picker opens on first visit (no autosave) and from Lieu → « Choisir un lieu… ». Thumbnails are lazy `<img loading="lazy">`.
- [ ] **Step 5: failing e2e** `tests/e2e/creation-picker.spec.ts`: 36 place cards + the template card; ArrowRight ×3 + ArrowDown does **not** change `place()`; Enter commits the highlighted card; « Avec le matériel du modèle » on `radio-talk-studio-medium` → `design().rig.instances.length === 9` and the note lists 5 items; the « Concert simple (référence) » card loads 4 devices in `concert-hall-medium`.
- [ ] **Step 6: run.** `npm run build; if ($?) { npx playwright test tests/e2e/creation-picker.spec.ts tests/e2e/creation-boot.spec.ts }` → PASS.
- [ ] **Step 7: commit.** `feat(creation): « Choisir un lieu » picker with build-time SVG floor plans (CA-04)`.
- **Acceptance:** 36 cards; each SVG ≤ 8 KB; the grid works by arrows and Enter; arrows never commit; the « Avec le matériel » badge is on the 5 L2 rooms.

### Task 13: Autosave, dirty marker, Ctrl+S, named projects

- **Agent:** tekdeveloper (store), tekfrontenddesigner (Projet menu dialogs). **Closes:** CA-14. **Decisions:** C16.
- **Files:** create `src/creation/persistence.ts`; modify `src/creation/boot.ts`, `src/creation/shell/menuModel.ts` (Projet items), `src/creation/copy.ts` (`project`); tests `tests/creation/persistence.test.ts`, `tests/e2e/creation-autosave.spec.ts`.
- **Interfaces:**

  ```ts
  export const AUTOSAVE_KEY = 'audio-sim/creation.v1'
  export const PROJECTS_KEY = 'audio-sim/creation-projects.v1'
  export interface AutosaveV1 { version: 1; savedAt: string; name: string | null; design: DesignState; savedFingerprint: string | null }
  export type LoadResult = { status: 'ok'; data: AutosaveV1 } | { status: 'empty' } | { status: 'reset'; reason: 'version' | 'corrupt' } | { status: 'blocked' }
  export function loadAutosave(storage: Storage | null): LoadResult
  export function saveAutosave(storage: Storage | null, data: AutosaveV1): 'ok' | 'blocked' | 'full'
  export function listProjects(storage: Storage | null): { name: string; savedAt: string }[]
  export function saveProject(storage: Storage | null, name: string, design: DesignState): 'ok' | 'blocked' | 'full' // max 20; same name overwrites after confirm (UI)
  export function loadProject(storage: Storage | null, name: string): DesignState | null
  export function debounce<T extends unknown[]>(fn: (...a: T) => void, ms: number): ((...a: T) => void) & { flush(): void; cancel(): void }
  ```

- [ ] **Step 1: failing tests** `tests/creation/persistence.test.ts` with an in-memory `Storage` fake: round-trip; version 2 payload → `reset/version`; invalid JSON → `reset/corrupt`; a storage whose `getItem` throws → `blocked`; `setItem` throwing `QuotaExceededError` → `full`; designs are zod-validated (reuse the template schema pieces) and untrusted placements dropped via `sanitizePlacements`; `debounce` with fake timers (`vi.useFakeTimers()`): 5 calls within 1 s → 1 call; `flush()` runs now.
- [ ] **Step 2: run red; implement; run green.** `npx vitest run tests/creation/persistence.test.ts`.
- [ ] **Step 3: wire.** On every store change: `autosave(design)` debounced 1000 ms; `dirty = fingerprint(design) !== savedFingerprint` → `document.title = (dirty ? '* ' : '') + (name ?? 'Sans titre') + ' · Mode Création · TekPractice'` and the shell title shows « * ». Boot: `loadAutosave` → `ok` → `history`-less `APPLY_DESIGN` (not undoable: `store.dispatch` directly) and skip the picker; `reset` → a notice « Sauvegarde incompatible, on repart de zéro. »; `blocked` → a persistent notice « Le navigateur bloque la sauvegarde : ton travail ne sera pas gardé. » and no crash. Ctrl+S (`SAVE` action) → `saveProject(name)` (asks a name the first time, dialog with a labelled text field; **Enter submits**), clears dirty, toast « Projet « X » enregistré ». Projet menu: « Nouveau » (confirm when dirty), « Ouvrir… » (list, Enter opens = `APPLY_DESIGN` snapshot entry), « Enregistrer » (Ctrl+S), « Enregistrer sous… ». `beforeunload` flushes the debounce.
- [ ] **Step 4: failing e2e** `tests/e2e/creation-autosave.spec.ts`: place 2 devices → wait 1.2 s → reload → both back, same ids and poses; title starts with `* ` before Ctrl+S and not after; Ctrl+S then type a name + Enter saves (no click); with `localStorage` blocked (`page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked') } }))`) the shell boots, shows the notice, 0 page errors.
- [ ] **Step 5: run.** `npm run build; if ($?) { npx playwright test tests/e2e/creation-autosave.spec.ts }` → PASS.
- [ ] **Step 6: commit.** `feat(creation): autosave, dirty marker, Ctrl+S and named projects (CA-14)`.
- **Acceptance:** build 2 devices → reload → both back; « * » while dirty; Enter in the name field saves; blocked storage → visible notice, no crash.

### Task 14: Status bar, persistent errors, coach guard

- **Agents:** tekfrontenddesigner (`/frontend-design`), tekuxwriter (copy). **Closes:** CA-15 (persistent list part), CA-16. **Decisions:** C17.
- **Files:** create `src/creation/shell/statusModel.ts`, `src/creation/shell/statusBar.ts`, `tests/creation/noPlaceholderCopy.test.ts`; modify `src/creation/boot.ts`, `src/creation/copy.ts` (`status`); tests `tests/creation/statusModel.test.ts`, `tests/e2e/creation-status.spec.ts`.
- **Interfaces:**

  ```ts
  export interface StatusView {
    selection: string                 // « Sélection : Yamaha QL1 (ql1) » | « Aucune sélection »
    snapping: string                  // « Aimantation : 0,25 m · 15° » | « Aimantation : libre »
    signal: { kind: 'ok' | 'errors'; label: string; count: number } // « Signal OK » | « 2 erreurs »
    errors: { id: string; title: string; detail: string; ports: PortRef[] }[]
  }
  export function statusView(input: { selectionLabel: string | null; snapFree: boolean; events: TeachingEvent[]; lastRejection: { title: string; detail: string; ports: PortRef[] } | null; ruleText(ruleId: string): { title: string; teach: string } }): StatusView
  ```

  `ruleText` returns the catalog `title`/`teach` until Task 29 adds `title_fr`/`teach_fr`, then prefers the French fields.
- [ ] **Step 1: failing tests.** `statusModel.test.ts`: 0 events and no rejection → `Signal OK`; 2 error events → « 2 erreurs » (singular « 1 erreur »); warnings are listed but don't count as errors; the last rejection is listed first. `noPlaceholderCopy.test.ts`: walks `src/creation/**/*.ts` and every JSON under `content/templates/`, fails on `[À REMPLACER` or `À REMPLACER PAR OSCAR`; the shell imports nothing from `src/ui/coach.ts` (static check).
- [ ] **Step 2: run red; implement; run green.** `npx vitest run tests/creation/statusModel.test.ts tests/creation/noPlaceholderCopy.test.ts`.
- [ ] **Step 3: DOM.** `<footer role="contentinfo" data-testid="status-bar">`: selection text, snapping text, a signal button `data-testid="signal-status"` (« Signal OK » in `ok` colour with a check glyph, or « X erreurs » in `danger` with a warning glyph; never colour alone) that opens a pop-over list (`role="dialog"`, Esc closes, focus returns); each error row is a button: click → select the first subject's instance + fly to it. The count updates on store changes only.
- [ ] **Step 4: failing e2e** `tests/e2e/creation-status.spec.ts`: load the reference template; (a) the status count label always equals `__creation.events().filter(e => e.severity === 'error').length` (« Signal OK » when 0); (b) dispatch the rejected CONNECT `{ k12-g power-in } → { ql1 in-mic-2 }` → the pop-over lists the rejection first (R3 text), it stays listed after 10 s (persistent, not a toast), and clicking its row sets `selection()` to `k12-g`; (c) a later valid CONNECT clears the rejection row.
- [ ] **Step 5: run.** `npm run build; if ($?) { npx playwright test tests/e2e/creation-status.spec.ts }` → PASS.
- [ ] **Step 6: commit.** `feat(creation): status bar with persistent error list; no coach placeholders in Mode Création (CA-15, CA-16)`.
- **Acceptance:** the error count matches `RuleEvaluator`; the placeholder test fails on any `[À REMPLACER` in shipped Mode Création strings.

### Task 15: Phase 1 gate

- **Agents:** tekdeveloper (runs the gate), **tekreviwer** (review; never the author).
- [ ] **Step 1: full checks.** From `tekpractice-sim/`: `npx tsc --noEmit`; `npx vitest run` → all green; `npm run lint`; `npm run build; if ($?) { npx playwright test }` → all green (legacy + creation). Record pass counts.
- [ ] **Step 2: budgets.** From `npm run build` output, compare the creation entry chunk (+ its static imports) with the legacy sandbox entry: creation ≤ legacy + 15 %. Note both sizes.
- [ ] **Step 3: perf proof.** `npx playwright test tests/e2e/renderOnDemand.spec.ts` plus a creation variant (add to `tests/e2e/creation-places.spec.ts`): after `choosePlace('room:concert-hall-medium')` and 1.5 s settle, `renders()` grows by 0 over 2 s.
- [ ] **Step 4: review.** Dispatch **tekreviwer** on the range `c51dc87..HEAD` (Phase 1) with the brief, council C1–C18 and this plan's Phase 1. Fix every Critical and Important finding in new commits (TDD), re-run Step 1.
- [ ] **Step 5: site build + local check.** Create once (this gate) `tools/site-smoke.mjs`: spawns `node node_modules/vite/bin/vite.js preview --outDir dist-site --port 4174 --strictPort` with `TEKPRACTICE_BASE=/tekpractice/jouer/`, launches Chromium (Playwright library), opens `http://localhost:4174/tekpractice/jouer/` → expects `[data-testid="place-picker"]`; opens `?legacy=1` → expects `#dashboard`; collects console errors (must be 0); **always kills the preview process in `finally`**. Add `"smoke:site": "node tools/site-smoke.mjs"`. Run `npm run build:site; if ($?) { npm run smoke:site }` → OK.
- [ ] **Step 6: log + commit + push.** Append to `docs/CREATIVE-MODE-LOG.md` « Phase 1 : done » with test counts, chunk sizes and any decision taken. `& $git add -A tekpractice-sim docs/CREATIVE-MODE-LOG.md; & $git commit -m "chore(creation): phase 1 gate"; & $git push origin feature/tekpractice-creative-mode`.
- **Acceptance:** everything green, review findings fixed, site build boots Mode Création and `?legacy=1` locally, branch pushed, no background process left.

---

## Phase 2: Navigation (view cube, views, walking)

### Task 16: Cube zone classifier, zone angles, view picker model, ADR-0014

- **Agent:** tekdeveloper. **Closes:** CA-05 (model part). **Decisions:** C11.
- **Files:** create `src/camera/cubeZones.ts`, `src/camera/viewPicker.ts`, `docs/adr/0014-view-cube-26-zones.md`; tests `tests/camera/cubeZones.test.ts`, `tests/camera/viewPicker.test.ts`. `src/camera/viewCube.ts` is reused (constants), not changed.
- **Interfaces (produces):**

  ```ts
  // Cube frame: x = droite (+) / gauche (−), y = dessus (+) / dessous (−), z = face (+) / arrière (−).
  // Babylon LH: from the Face pose world +x is screen-left, so cube-frame x = −(babylon x) of the cube mesh.
  export type Sign = -1 | 0 | 1
  export interface ZoneSigns { x: Sign; y: Sign; z: Sign }
  export const ZONES: readonly ZoneSigns[]                        // the 26 non-zero sign triples
  export function zoneId(s: ZoneSigns): string                    // 'face', 'dessus', 'dessus-face', 'arriere-gauche', 'dessous-arriere-droite'…
  export function zoneLabel(s: ZoneSigns): string                 // French: « Dessus · Face », « Arrière · Gauche »…
  export function classifyHit(local: { x: number; y: number; z: number }, threshold?: number): ZoneSigns // local in [−0.5, 0.5]³ on the surface; threshold 0.5
  export function zoneAngles(s: ZoneSigns): { alpha: number; beta: number }
  export function nearestZone(alpha: number, beta: number): ZoneSigns
  export function zoneBox(s: ZoneSigns, threshold?: number): { center: [number, number, number]; size: [number, number, number] } // hover overlay in cube local units
  // src/camera/viewPicker.ts — the V picker: 8 azimuths × 5 elevations, poles collapsed = 26 cells
  export interface PickerCell { az: number /*0..7*/; el: -2 | -1 | 0 | 1 | 2; zone: ZoneSigns }
  export const PICKER_CELLS: readonly PickerCell[]                // length 26
  export function pickerMove(cell: PickerCell, key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'): PickerCell
  ```

- [ ] **Step 1: failing tests** `tests/camera/cubeZones.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest'
  import { classifyHit, nearestZone, zoneAngles, zoneId, ZONES } from '../../src/camera/cubeZones'
  import { DEFAULT_FRONT_ALPHA, DESSUS_BETA, FACE_BETA } from '../../src/camera/viewCube'

  describe('cube zones', () => {
    it('26 unique zones: 6 faces, 12 edges, 8 corners', () => {
      expect(ZONES).toHaveLength(26)
      expect(new Set(ZONES.map(zoneId)).size).toBe(26)
      const nz = (s: { x: number; y: number; z: number }) => [s.x, s.y, s.z].filter((v) => v !== 0).length
      expect([1, 2, 3].map((k) => ZONES.filter((s) => nz(s) === k).length)).toEqual([6, 12, 8])
    })
    it('classifies face centre, edge band and corner with threshold 0.5', () => {
      expect(zoneId(classifyHit({ x: 0, y: 0, z: 0.5 }))).toBe('face')
      expect(zoneId(classifyHit({ x: 0, y: 0.4, z: 0.5 }))).toBe('dessus-face')
      expect(zoneId(classifyHit({ x: 0.4, y: 0.4, z: 0.5 }))).toBe('dessus-face-droite')
      expect(zoneId(classifyHit({ x: -0.3, y: 0, z: -0.5 }))).toBe('arriere-gauche')
      expect(zoneId(classifyHit({ x: 0.2, y: -0.2, z: 0.5 }))).toBe('face') // |2·0.2| = 0.4 < 0.5
    })
    it('angles: face = front, droite = front + π/2, top = north-up, corners at the true isometric beta', () => {
      expect(zoneAngles({ x: 0, y: 0, z: 1 })).toEqual({ alpha: DEFAULT_FRONT_ALPHA, beta: FACE_BETA })
      expect(zoneAngles({ x: 1, y: 0, z: 0 }).alpha).toBeCloseTo(DEFAULT_FRONT_ALPHA + Math.PI / 2)
      expect(zoneAngles({ x: 0, y: 1, z: 0 })).toEqual({ alpha: DEFAULT_FRONT_ALPHA, beta: DESSUS_BETA })
      expect(zoneAngles({ x: 1, y: 1, z: 1 }).beta).toBeCloseTo(0.9553, 4)
      expect(zoneAngles({ x: 0, y: 1, z: 1 }).beta).toBeCloseTo(Math.PI / 4)
      expect(zoneAngles({ x: -1, y: -1, z: 0 }).beta).toBeCloseTo((3 * Math.PI) / 4)
      expect(zoneAngles({ x: 1, y: -1, z: -1 }).beta).toBeCloseTo(Math.PI - 0.9553, 4)
    })
    it('nearestZone inverts zoneAngles for all 26 zones', () => {
      for (const s of ZONES) { const { alpha, beta } = zoneAngles(s); expect(zoneId(nearestZone(alpha, beta))).toBe(zoneId(s)) }
    })
  })
  ```

  `tests/camera/viewPicker.test.ts`: 26 cells, one per zone; ArrowLeft/Right wrap the 8 azimuths; ArrowUp from el 1 goes to the pole (el 2, single cell); ArrowDown from the pole returns to el 1 at the previous azimuth (default face, az 0).
- [ ] **Step 2: run red.** `npx vitest run tests/camera/cubeZones.test.ts tests/camera/viewPicker.test.ts` → FAIL.
- [ ] **Step 3: implement** `src/camera/cubeZones.ts`:

  ```ts
  import { DEFAULT_FRONT_ALPHA, DESSOUS_BETA, DESSUS_BETA, FACE_BETA, SIDE_SIGN } from './viewCube'
  const ISO = 0.9553 // acos(1/√3): the elevation of a cube corner
  const sgn = (v: number, t: number): Sign => (Math.abs(v) >= 0.999 ? (Math.sign(v) as Sign) : Math.abs(v) > t ? (Math.sign(v) as Sign) : 0)
  export const ZONES: ZoneSigns[] = []
  for (const y of [1, 0, -1] as Sign[]) for (const z of [1, 0, -1] as Sign[]) for (const x of [0, 1, -1] as Sign[]) if (x || y || z) ZONES.push({ x, y, z })
  export function zoneId(s: ZoneSigns): string {
    const p: string[] = []
    if (s.y) p.push(s.y > 0 ? 'dessus' : 'dessous')
    if (s.z) p.push(s.z > 0 ? 'face' : 'arriere')
    if (s.x) p.push(s.x > 0 ? 'droite' : 'gauche')
    return p.join('-')
  }
  export function classifyHit(l: { x: number; y: number; z: number }, threshold = 0.5): ZoneSigns {
    return { x: sgn(l.x * 2, threshold), y: sgn(l.y * 2, threshold), z: sgn(l.z * 2, threshold) }
  }
  export function zoneAngles(s: ZoneSigns): { alpha: number; beta: number } {
    const horizontal = s.x !== 0 || s.z !== 0
    const alpha = horizontal ? DEFAULT_FRONT_ALPHA + SIDE_SIGN * Math.atan2(s.x, s.z) : DEFAULT_FRONT_ALPHA // poles: north-up
    if (s.y === 0) return { alpha, beta: FACE_BETA }
    if (!horizontal) return { alpha, beta: s.y > 0 ? DESSUS_BETA : DESSOUS_BETA }
    const corner = s.x !== 0 && s.z !== 0
    const up = corner ? ISO : Math.PI / 4
    return { alpha, beta: s.y > 0 ? up : Math.PI - up }
  }
  const OCTANTS: [Sign, Sign][] = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]] // [x, z] from face, clockwise seen from above
  export function nearestZone(alpha: number, beta: number): ZoneSigns {
    const el = (Math.PI / 2 - beta) * (180 / Math.PI)
    const y: Sign = el > 70 ? 1 : el > 25 ? 1 : el < -70 ? -1 : el < -25 ? -1 : 0
    if (Math.abs(el) > 70) return { x: 0, y, z: 0 }
    const k = (((Math.round((SIDE_SIGN * (alpha - DEFAULT_FRONT_ALPHA)) / (Math.PI / 4)) % 8) + 8) % 8)
    const [x, z] = OCTANTS[k]
    return { x, y, z }
  }
  ```

  `zoneLabel` joins « Dessus/Dessous », « Face/Arrière », « Droite/Gauche » with « · ». `zoneBox`: per axis, sign 0 → centre 0, size `threshold` (the middle band spans `[−threshold/2, threshold/2]`); sign s ≠ 0 → the band spans `[threshold/2, 0.5]·s`, so `center = s·(0.5 + threshold/2)/2` and `size = 0.5 − threshold/2`; add 0.01 outward on every non-zero axis so the overlay sits on the surface. Unit-test: `zoneBox({x:0,y:0,z:1})` → centre `[0, 0, 0.385]`, size `[0.5, 0.5, 0.25]` (before the 0.01 offset: centre z 0.375). Note the test `nearestZone` round-trip passes because `zoneAngles` elevations are 0°, 45°, 54.7°, 89.99° — all inside their bands.
- [ ] **Step 4: implement** `src/camera/viewPicker.ts`: az `k` ↔ `OCTANTS[k]`; `el 0` → y 0; `el ±1` → y ±1 with the octant; `el ±2` → the pole (one cell each, `az` kept for returning). 8 × 3 + 2 = 26.
- [ ] **Step 5: run green.** Same command → PASS.
- [ ] **Step 6: ADR-0014** « Cube de vue 26 zones » (French): second camera + layer mask, analytic classifier, threshold 0.5, north-up poles, 120/130 px, why no second WebGL context, why no Fohhn imagery.
- [ ] **Step 7: commit.** `feat(camera): 26-zone cube classifier, zone angles and view picker model (ADR-0014)`.
- **Acceptance:** 26 zones with unique ids; classifier tested on faces, edges, corners; `nearestZone(zoneAngles(z)) === z` for all 26.

### Task 17: View cube rendering (second camera, layer mask, hover, compass ring)

- **Agents:** tekdesigner (cube look: Nuit body, Papier labels, Ambre hover, square), tekfrontenddesigner (`/frontend-design`) for the DOM hit layer. **Closes:** CA-05, CA-07. **Decisions:** C11.
- **Files:** create `src/creation/viewCubeWidget.ts`, `src/creation/cubeTextures.ts` (labels drawn on a `DynamicTexture`: « FACE », « ARRIÈRE », « GAUCHE », « DROITE », « DESSUS », « DESSOUS» in Tektur, own work); modify `src/creation/sceneHost.ts` (create/dispose the widget), `src/creation/debug.ts` (`cubeZoneAt(x, y)`, `cubeRect()`); test `tests/e2e/creation-cube.spec.ts`.
- **Interfaces:**
  - Consumes: `classifyHit`, `zoneAngles`, `zoneBox`, `zoneLabel` (Task 16); `CameraRig.flyToView(alpha, beta)`; `RenderScheduler.invalidate()`.
  - Produces: `class ViewCubeWidget { constructor(scene: Scene, main: ArcRotateCamera, rig: CameraRig, scheduler: RenderScheduler, bag: DisposableBag); readonly hitElement: HTMLElement; sizePx(): 120 | 130; dispose(): void }`.
- [ ] **Step 1: failing e2e** `tests/e2e/creation-cube.spec.ts` (reduced motion → cuts, so the camera lands at once):

  ```ts
  import { expect, test } from '@playwright/test'
  import { ZONES, zoneAngles, zoneId } from '../../src/camera/cubeZones'
  test.use({ viewport: { width: 1366, height: 768 } })
  test('all 26 cube zones are clickable and land on their view', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/'); await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
    for (const s of ZONES) {
      const id = zoneId(s)
      // first rotate to Face·Dessus·Droite iso so every zone has a visible patch, then ask the widget where the zone is on screen
      const pt = await page.evaluate((z) => window.__creation!.cubeZoneScreenPoint(z), id)
      expect(pt, id).not.toBeNull()
      await page.mouse.click(pt!.x, pt!.y)
      const cam = await page.evaluate(() => window.__creation!.camera())
      const want = zoneAngles(s)
      expect(Math.abs(((cam.alpha - want.alpha + 3 * Math.PI) % (2 * Math.PI)) - Math.PI), id).toBeLessThan(0.02)
      expect(Math.abs(cam.beta - want.beta), id).toBeLessThan(0.02)
    }
  })
  test('cube is 120 px at 1366 and 130 px at 1600; one WebGL context', async ({ page }) => {
    await page.goto('/')
    expect((await page.evaluate(() => window.__creation!.cubeRect())).width).toBe(120)
    await page.setViewportSize({ width: 1600, height: 900 })
    await expect.poll(() => page.evaluate(() => window.__creation!.cubeRect().width)).toBe(130)
    expect(await page.evaluate(() => document.querySelectorAll('canvas').length)).toBe(1)
  })
  test('hover paints the zone Ambre and renders on demand; drag on the cube orbits', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
    const r = await page.evaluate(() => window.__creation!.cubeRect())
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2)
    await expect.poll(() => page.evaluate(() => window.__creation!.cubeHover())).toBe('face')
    const a0 = await page.evaluate(() => window.__creation!.camera().alpha)
    await page.mouse.down(); await page.mouse.move(r.x + r.width / 2 + 60, r.y + r.height / 2, { steps: 6 }); await page.mouse.up()
    expect(await page.evaluate(() => window.__creation!.camera().alpha)).not.toBeCloseTo(a0, 2)
  })
  ```

  `cubeZoneScreenPoint(id)` (debug hook): first orbits the main camera to the cube-facing pose that exposes the zone (`zoneAngles` of the zone itself: the zone's own patch faces the viewer and sits at the cube centre), then returns the cube centre in page coordinates. This is the honest user path: the user can always click the centre patch after turning.
- [ ] **Step 2: run red.** `npm run build; if ($?) { npx playwright test tests/e2e/creation-cube.spec.ts }` → FAIL.
- [ ] **Step 3: implement the widget.**
  - Second camera `cubeCam = new ArcRotateCamera('cube-cam', main.alpha, main.beta, 3.2, Vector3.Zero(), scene)` with `layerMask = 0x10000000`, `viewport` computed from the canvas size so the cube square sits at `(16 px, 16 px)` from the viewport top-left, size `sizePx()` = `innerWidth >= 1600 ? 130 : 120`; `scene.activeCameras = [main, cubeCam]`; `cubeCam.clearColor`-free: set `scene.autoClear` as is and use `cubeCam` with `scene.autoClearDepthAndStencil = true` (Babylon clears depth per active camera) so the cube draws over the room.
  - One box mesh (size 1) + 6 label decals from `cubeTextures.ts`, `layerMask = 0x10000000` (main camera `layerMask = 0x0FFFFFFF`). A thin compass ring (torus, 12 tick marks, « N » at Face direction is **not** used: label the ring with « FACE » arrow only) on the same layer.
  - Each frame the cube camera mirrors the main camera's `alpha`/`beta` via `main.onViewMatrixChangedObservable` (no `onBeforeRender` observer).
  - Hit layer: a transparent `<div class="cr-cube-hit" data-testid="view-cube" role="group" aria-label="Cube de vue">` absolutely positioned over the cube square inside the viewport (the only overlay allowed). Pointer events on it: `scene.pick(x, y, (m) => m === box, false, cubeCam)` → local hit point → `classifyHit` → hover overlay box (`zoneBox`, Ambre emissive, 0.35 alpha) → click → `rig.flyToView(zoneAngles(z))` (reduced motion: `CameraRig` already cuts). Drag (> 4 px) → orbit `main.alpha/beta` by `dx·0.01`, `dy·0.01` (clamped like the main camera), no click. Missed area (corner of the square outside the box) → no-op, no flight.
  - Keyboard: the hit layer is **not** a tab stop (the Vue menu and `V` picker are the keyboard path, Task 18); it has `aria-hidden="true"` and the named views live in the menu.
  - Hover/drag call `scheduler.invalidate()`; everything added goes into `bag`; `dispose()` restores `scene.activeCameras = [main]`.
- [ ] **Step 4: run green.** Same command → PASS. Then `npx playwright test tests/e2e/creation-layout.spec.ts` (the overlay sample test allows only the cube corner).
- [ ] **Step 5: commit.** `feat(creation): 26-zone view cube on a second camera with layer mask (CA-05, CA-07)`.
- **Acceptance:** Playwright clicks all 26 zones and lands on each view; one canvas; 120/130 px; hover Ambre; drag orbits.

### Task 18: Vue menu with 26 named views and the `V` picker

- **Agents:** tekfrontenddesigner (`/frontend-design`), tekuxwriter (view names). **Closes:** CA-05 (keyboard path). **Decisions:** C11.
- **Files:** create `src/creation/shell/viewPickerOverlay.ts`; modify `src/creation/shell/menuModel.ts` (Vue menu: « Vues » submenu with 26 items grouped Faces / Arêtes / Coins, « Cadrer la sélection » F, « Vue d'ensemble » Alt+H, « Choisir une vue… » V, « Marcher » Maj+V), `src/creation/copy.ts` (`views`); tests `tests/creation/menuModel.test.ts` (extend), `tests/e2e/creation-views.spec.ts`.
- [ ] **Step 1: failing tests.** Menu model: the Vue › Vues submenu has 26 items whose labels equal `zoneLabel` of each zone, in the order faces (6), edges (12), corners (8). e2e: press `V` with the canvas focused → `role="dialog"` « Choisir une vue » opens with a 5-row grid; focus starts on the current nearest view (`nearestZone`); ArrowRight ×2 + Enter → camera lands on « Droite »; Esc closes without moving; reopening + ArrowUp ×2 + Enter → « Dessus » with Face at the bottom (alpha = front); every Vue › Vues item reached by keyboard through the menubar lands its view (loop over the 26 with reduced motion).
- [ ] **Step 2: run red; implement.** The overlay is a small modal grid (8 columns × 3 rows + 2 pole buttons), each cell a `button` named by `zoneLabel`, roving focus via `pickerMove`; Enter flies, Esc cancels, focus returns to the canvas.
- [ ] **Step 3: run green.** `npx vitest run tests/creation/menuModel.test.ts; npm run build; if ($?) { npx playwright test tests/e2e/creation-views.spec.ts }` → PASS.
- [ ] **Step 4: commit.** `feat(creation): 26 named views in Vue menu and the V view picker`.
- **Acceptance:** all 26 views reachable by keyboard from the menu and from `V` + arrows; Esc never moves the camera.

### Task 19: Walking in Mode Création (Marcher, ear height)

- **Agent:** tekdeveloper. **Decisions:** C11, S6.
- **Files:** modify `src/creation/sceneHost.ts` (own an `ExploreController` per scene, created lazily on first walk, disposed with the scene), `src/creation/viewState.ts` (`earHeight` already there), `src/creation/shell/menuModel.ts` (Vue › « Marcher » Maj+V, Écoute › « Hauteur d'oreille : assis 1,2 m / debout 1,7 m »), `src/scene/ExploreController.ts` (constructor option `eyeHeight?: number`, default unchanged); tests `tests/scene/exploreEyeHeight.test.ts`, `tests/e2e/creation-walk.spec.ts`.
- [ ] **Step 1: failing tests.** Unit (NullEngine): `new ExploreController(..., { eyeHeight: 1.2 })` places the walk camera at `floorAt(spawn) + 1.2`; default stays the legacy height. e2e: Maj+V enters walk view (`__creation.view() === 'explore'`), the RenderScheduler renders while keys are held (lease `walk` held during movement keys, released on key-up), Esc or Maj+V returns to orbit; switching ear height to « debout » moves the walk camera to floor + 1.7; changing place while walking returns to orbit and leaks nothing (`liveListeners()` back to the orbit value).
- [ ] **Step 2: run red; implement.** In walk view the shell holds `scheduler.hold('walk')` while any movement key is down or pointer lock moves the view; release on key-up/idle. ExploreController's own `onBeforeRender` tick is registered only while walking (move it from the constructor into `enterExplore()`/`exitExplore()` via its bag; legacy behaviour identical because legacy is either always in orbit or walking with `busy()`).
- [ ] **Step 3: run green.** `npx vitest run tests/scene/exploreEyeHeight.test.ts; npm run build; if ($?) { npx playwright test tests/e2e/creation-walk.spec.ts tests/e2e/explore.spec.ts }` → PASS.
- [ ] **Step 4: commit.** `feat(creation): walk view with 1.2/1.7 m ear height, no idle ticking`.
- **Acceptance:** Marcher works from menu and Maj+V; ear height switch works; 0 renders at idle in orbit after leaving walk; legacy explore e2e green.

### Task 20: Named listening points and camera presets (« Régie »)

- **Agents:** tekdeveloper, tekuxwriter. **Decisions:** council named points (only Régie mandatory; more points are on the cut list).
- **Files:** create `src/creation/listeningPoints.ts`; modify `src/creation/shell/treeModel.ts` (« Points d'écoute » group), `src/creation/shell/menuModel.ts` (Vue › « Aller au point d'écoute » list; `Digit1..3` presets), `src/creation/copy.ts`; tests `tests/creation/listeningPoints.test.ts`, `tests/e2e/creation-points.spec.ts`.
- **Interfaces:** `export interface ListeningPoint { id: string; label: string; position: [number, number, number] }`; `export function defaultPoints(layout: RoomLayout | null, earHeight: number): ListeningPoint[]` — « Régie » at the centre of the first `foh` zone (else the room centre at 2/3 depth) at floor + ear height; « Premier rang » 2 m in front of the stage edge on the audience floor if an audience zone exists; « Fond de salle » 1 m before the back of the last audience zone.
- [ ] **Step 1: failing unit test:** for `concert-hall-medium` the Régie point is `(0, floorAt(0,8) + 1.2, 8)`; blank place → one « Centre » point; ear height 1.7 shifts y by 0.5.
- [ ] **Step 2: run red; implement; run green.** `npx vitest run tests/creation/listeningPoints.test.ts`.
- [ ] **Step 3: wire.** Selecting a point (tree, menu, `Digit1..3`) flies the orbit camera to look at the stage from the point (`flyToPreset`); the active listening point is `viewState.listenerPoint` (added now: `listenerPoint: string`, default `'regie'`) and is what the Web Audio listener uses in Task 39 when not walking.
- [ ] **Step 4: e2e** `tests/e2e/creation-points.spec.ts`: tree › Points d'écoute › Régie + Enter → camera position within 0.5 m of the Régie point; `Digit2` → « Premier rang ». Run `npm run build; if ($?) { npx playwright test tests/e2e/creation-points.spec.ts }` → PASS.
- [ ] **Step 5: commit.** `feat(creation): named listening points (Régie, Premier rang, Fond de salle)`.
- **Acceptance:** Régie exists for every place; points reachable from tree, menu and digits.

### Task 21: Phase 2 gate

- **Agents:** tekdeveloper (gate), **tekreviwer** (review).
- [ ] **Step 1:** `npx tsc --noEmit; npx vitest run; npm run lint; npm run build; if ($?) { npx playwright test }` → all green.
- [ ] **Step 2: perf.** Idle in Mode Création after cube hover-out: 0 renders in 2 s (add the assertion to `creation-cube.spec.ts`).
- [ ] **Step 3: review.** tekreviwer on the Phase 2 commits (brief §3, C11, ADR-0014); fix Critical/Important with TDD; re-run Step 1.
- [ ] **Step 4: site build + local check.** `npm run build:site; if ($?) { npm run smoke:site }` → OK (no process left).
- [ ] **Step 5: log, commit, push.** Append « Phase 2 : done » to `docs/CREATIVE-MODE-LOG.md`; `& $git commit -am "chore(creation): phase 2 gate"; & $git push origin feature/tekpractice-creative-mode`.
- **Acceptance:** all green, review fixed, pushed.

---

## Phase 3: Inventory, placement and patching

### Task 22: Inventory model and catalog checks

- **Agent:** tekdeveloper. **Decisions:** P16, S5, C18.
- **Files:** create `src/creation/inventory.ts`, `tools/catalogChecks.ts` (pure checks; `tools/validate-catalog.ts` calls them and keeps its `process.exit` behaviour); tests `tests/creation/inventory.test.ts`, `tests/tools/catalogChecks.test.ts`.
- **Interfaces:**

  ```ts
  export type InventoryTab = 'micros' | 'consoles' | 'enceintes' | 'sources' | 'reseau' | 'secteur' | 'eclairage' | 'beta' | 'autres'
  export interface InventoryItem { deviceId: string; label: string; tab: InventoryTab; hasModel: boolean; badge?: 'non vérifié' }
  export const TAB_LABELS: Record<InventoryTab, string> // « Micros », « Consoles », « Enceintes », « Sources », « Réseau », « Secteur », « Éclairage », « Bêta », « Autres »
  export function tabFor(device: DeviceT): InventoryTab // from catalog category/kind fields; unknown → 'autres'
  export function inventory(registry: Registry, opts: { proposals: { deviceId: string; label: string }[]; modelIds: ReadonlySet<string> }): { tabs: InventoryTab[]; items: InventoryItem[] } // empty tabs hidden; 'autres' always last
  // tools/catalogChecks.ts
  export interface CheckIssue { level: 'error' | 'warning'; path: string; message: string }
  export function checkCatalog(catalog: CatalogT, opts: { modelIds: ReadonlySet<string> }): CheckIssue[]
  ```

  `tabFor` reads the device's existing category field (open `content/catalog.json` and `tools/schemas.ts` `Device` to see the exact field name and values; map each existing value explicitly in a `const CATEGORY_TAB: Record<string, InventoryTab>` and unit-test every value present in the catalog).
- [ ] **Step 1: failing tests.** Every one of the 24 catalog devices appears in exactly one tab; the SM58 is in « Micros », the QL1 in « Consoles », the K12.2/DBR12/8030C in « Enceintes », the playout PC in « Sources »; « Éclairage » hidden while empty; « Autres » last; proposals only in « Bêta » with badge « non vérifié ». `checkCatalog`: a device without `.glb` in `public/assets/` → warning (placeholder ships, CLAUDE.md); a duplicate port id → error; a `routing` / `acoustic` field (added later) is validated when present.
- [ ] **Step 2: run red; implement; run green.** `npx vitest run tests/creation/inventory.test.ts tests/tools/catalogChecks.test.ts`; `npm run validate:catalog` still exits 0.
- [ ] **Step 3: commit.** `feat(creation): inventory tabs model and pure catalog checks`.
- **Acceptance:** every catalog device is reachable from a tab; empty tabs hidden.

### Task 23: Inventory drawer UI

- **Agents:** tekfrontenddesigner (`/frontend-design`), tekuxwriter. **Closes:** CA-09. **Decisions:** brief §4.
- **Files:** create `src/creation/shell/inventoryDrawer.ts` (lazy chunk: `import()` on first open), `src/creation/shell/inventoryDrawer.css`; modify `src/creation/boot.ts`, `src/creation/shell/menuModel.ts` (Matériel › « Inventaire » Espace), `src/creation/copy.ts`; test `tests/e2e/creation-drawer.spec.ts`.
- [ ] **Step 1: failing e2e:** Space (canvas focused) opens the drawer `data-testid="inventory-drawer"` (`role="dialog"`, `aria-modal="false"`, label « Inventaire »); its CSS transition is ≤ 200 ms (`getComputedStyle(...).transitionDuration` ≤ 0.2 s) and 0 s under reduced motion; tabs are a `role="tablist"` with arrow keys; Space or Esc closes it and returns focus to the canvas; the drawer covers only the bottom of the viewport (≤ 40 % of its height); the lazy chunk is not requested before the first open (`page.on('request')`).
- [ ] **Step 2: run red; implement.** Items are buttons with the device name, a small own-work icon or the placeholder silhouette, and the badge if any. Enter or click on an item starts placement (Task 24 contract: `startPlacement(deviceId)`); until Task 24, it dispatches `SPAWN` at the viewport centre ray hit on the floor.
- [ ] **Step 3: run green.** `npm run build; if ($?) { npx playwright test tests/e2e/creation-drawer.spec.ts }` → PASS.
- [ ] **Step 4: commit.** `feat(creation): inventory drawer (≤ 200 ms, Space/Esc, lazy) (CA-09)`.
- **Acceptance:** opens/closes in ≤ 200 ms (0 ms reduced motion), keyboard tabs, lazy chunk.

### Task 24: Place and move devices (snapping, one transaction per drag)

- **Agent:** tekdeveloper (logic), tekfrontenddesigner (ghost look). **Closes:** CA-10. **Decisions:** C5, P20, brief §4.
- **Files:** create `src/creation/placementMath.ts` (pure), `src/creation/placementController.ts`; modify `src/creation/sceneHost.ts`; tests `tests/creation/placementMath.test.ts`, `tests/e2e/creation-place.spec.ts`.
- **Interfaces:**

  ```ts
  export const SNAP_M = 0.25, SNAP_DEG = 15
  export function snapPosition(p: [number, number, number], free: boolean): [number, number, number] // x,z to 0.25 m grid unless free
  export function snapYaw(deg: number, free: boolean): number   // 15° steps unless free (1°); result in [0, 360)
  export function rotateStep(yawDeg: number, dir: 1 | -1, free: boolean): number // R / Shift+R: ±15° (free: ±1°)
  export function clampToRoom(p: [number, number, number], bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, margin?: number): [number, number, number]
  export class PlacementController {
    constructor(host: SceneHost, history: History, store: CreationStore, viewState: ViewState, scheduler: RenderScheduler, bag: DisposableBag)
    startPlacement(deviceId: string): void   // ghost follows the pointer on the floor; click drops (SPAWN); Esc cancels
    get placing(): boolean
  }
  ```

- [ ] **Step 1: failing unit tests:** snapping values; yaw wrap (−15 → 345); Shift (free) keeps 1° steps; `clampToRoom` respects the 0.5 m margin.
- [ ] **Step 2: run red; implement; run green.** `npx vitest run tests/creation/placementMath.test.ts`.
- [ ] **Step 3: controller.** Ghost = the device placeholder at 0.5 alpha; pointer move → floor pick → `snapPosition` (Alt held = free) → ghost moves, `scheduler.invalidate()` (no observer). Click → `history.do({ type: 'SPAWN', deviceId, instanceId: store.newInstanceId(deviceId), position, rotationY, mount: 'floor' })`. Moving: left-drag that **starts on the selected device** (P20) → `history.begin('Déplacer <nom>')`, `SET_POSE` per pointer move (coalesced), `commit()` on pointer-up; Esc during drag → `history.rollback()`. Any other left-drag orbits (designerOrbitInput). While dragging, `scheduler.hold('drag')`.
- [ ] **Step 4: e2e** `tests/e2e/creation-place.spec.ts`: open drawer → QL1 → click the floor → 1 instance at a 0.25 m-snapped position; drag it 2 m → 1 undo entry; Ctrl+Z → back at the drop point; Esc during a drag restores the pose and records nothing; a drag that starts off the device orbits (camera alpha changes, pose unchanged). Run `npm run build; if ($?) { npx playwright test tests/e2e/creation-place.spec.ts }` → PASS.
- [ ] **Step 5: commit.** `feat(creation): place and move devices with snapping; one undo entry per drag (CA-10)`.
- **Acceptance:** drop, drag, undo and Esc behave as above; no observer while idle.

### Task 25: Rotate, tilt, mount, duplicate, delete, missed-click feedback

- **Agents:** tekdeveloper, tekuxwriter (feedback copy). **Closes:** CA-11, CA-12. **Decisions:** C18, brief §4.
- **Files:** modify `src/creation/placementController.ts`, `src/creation/input/keyboard.ts` handlers, `src/creation/shell/menuModel.ts` (Matériel › Pivoter, Dupliquer Ctrl+D, Supprimer Suppr), `src/creation/copy.ts` (`feedback`); create `src/creation/shell/toast.ts` (`role="status"`, polite, 2.5 s); tests `tests/creation/placementMath.test.ts` (extend), `tests/e2e/creation-edit.spec.ts`.
- [ ] **Step 1: failing tests.** Unit: `duplicatePose(p)` = +0.5 m on x (snapped), same yaw/tilt/mount. e2e: select QL1, R → yaw +15 (1 undo entry), Shift+R → −15; Ctrl+D (AZERTY and QWERTY events) → a second QL1 with a new id and the same controls; Suppr → removed, Ctrl+Z → back with its cables; clicking empty floor or sky shows « Rien ici : clique un appareil ou ouvre l'inventaire (Espace). » (`role="status"`) and clears the selection; clicking a hidden device does nothing visible but the same message.
- [ ] **Step 2: run red; implement; run green.** `npx vitest run tests/creation/placementMath.test.ts; npm run build; if ($?) { npx playwright test tests/e2e/creation-edit.spec.ts }`.
- [ ] **Step 3: commit.** `feat(creation): rotate, duplicate, delete and missed-click feedback (CA-11, CA-12)`.
- **Acceptance:** each edit is one undo entry; feedback on every missed click.

### Task 26: Port pick proxies, hover labels and mouse patching

- **Agents:** tekdeveloper (picking, intents), tekfrontenddesigner (`/frontend-design`, labels). **Closes:** CA-19, CA-20. **Decisions:** C18, C6.
- **Files:** create `src/creation/portProxies.ts`, `src/creation/patchController.ts`, `src/creation/shell/portLabel.ts`; modify `src/creation/sceneHost.ts`; tests `tests/creation/portProxies.test.ts`, `tests/e2e/creation-patch.spec.ts`.
- **Interfaces:**

  ```ts
  /** World radius so that a proxy covers ≥ 24 CSS px at distance d (perspective camera, fov, viewport height). */
  export function proxyRadius(distanceM: number, fovRad: number, viewportHeightPx: number, minPx?: number): number
  export function labelScale(distanceM: number, maxPx: number): number // screen-size cap for port labels
  export class PatchController {
    constructor(host: SceneHost, history: History, store: CreationStore, scheduler: RenderScheduler, bag: DisposableBag)
    get pending(): PortRef | null      // first port clicked, waiting for the second
    cancel(): void
  }
  ```

- [ ] **Step 1: failing unit test:** `proxyRadius(10, 0.8, 708)` ≥ the world size of 12 px (radius of 24 px) at 10 m; monotonic in distance; `labelScale` never exceeds `maxPx`.
- [ ] **Step 2: run red; implement; run green.** `npx vitest run tests/creation/portProxies.test.ts`.
- [ ] **Step 3: controller.** Invisible spheres (`isVisible = false`, `isPickable = true`) per port marker, rescaled on camera view change (observer on `onViewMatrixChangedObservable`, no per-frame work). Hover/focus shows the port label (« in-mic-1 · XLR · micro »), never permanent labels. Click port A → `pending`; ports that `store.canConnect(A, X).ok` glow green, the rest dim; click port B → `history.do({ type: 'CONNECT', a, b })`; a rejection pins the error label at B (`role="alert"`) and is added to the status list (Task 14) — it never throws. Click an occupied port → offers « Débrancher » (dispatches `UNPLUG`). Esc cancels `pending`. A drag from port to port is on the cut list: do not implement.
- [ ] **Step 4: e2e** `tests/e2e/creation-patch.spec.ts`: with the reference template, click `sm58 out-xlr` then `ql1 in-mic-2` (via `portScreen(ref)`) → connected; click `k12-g power-in` then `ql1 in-mic-1` → rejected with the R3 message pinned at the port and the status list updated; hovering a port shows exactly one label; a 24 px hit box exists around each port at the default camera distance (`__creation.portHitRadiusPx(ref) >= 12`). Run `npm run build; if ($?) { npx playwright test tests/e2e/creation-patch.spec.ts }` → PASS.
- [ ] **Step 5: commit.** `feat(creation): enlarged port proxies, hover labels and click-to-patch (CA-19, CA-20)`.
- **Acceptance:** ≥ 24 px hit areas; labels on hover/focus only; rejections are messages, not exceptions.

### Task 27: Cable colours by signal type, legend, cable hover

- **Agents:** tekdesigner (palette), tekfrontenddesigner (`/frontend-design`, legend). **Decisions:** C18.
- **Files:** create `src/creation/cableStyle.ts`; modify `src/scene/CableRenderer.ts` (option `colorFor?: (a: PortRef, b: PortRef) => Color3`, default = current colour), `src/creation/sceneHost.ts`; create `src/creation/shell/cableLegend.ts`; tests `tests/creation/cableStyle.test.ts`, `tests/e2e/creation-cables.spec.ts`.
- **Interfaces:** `export const SIGNAL_STYLE: Record<string, { color: string; label: string; dash?: boolean }>` keyed by catalog signal ids (`mic`, `line`, `aes3`, `dante`, `mains-power`, … every signal id in the catalog); `export function cableColor(signalId: string): string`.
- [ ] **Step 1: failing test:** every signal id of the catalog has a style; colours are distinct pairwise (ΔE simple RGB distance ≥ 60) and each passes 3:1 against Nuit; `mains-power` is dashed so colour is never the only cue.
- [ ] **Step 2: run red; implement; run green.** `npx vitest run tests/creation/cableStyle.test.ts`.
- [ ] **Step 3: UI.** Legend: collapsible block at the bottom-left of the Properties panel (not over the viewport) listing only the signal types present. Hovering a cable highlights it and shows « ql1 out-main-l → k12-g in-line-a · ligne ».
- [ ] **Step 4: e2e:** after the template's mic cable, the legend shows « Micro »; `__creation.cableColor(key)` equals the style colour. Run `npm run build; if ($?) { npx playwright test tests/e2e/creation-cables.spec.ts }`.
- [ ] **Step 5: commit.** `feat(creation): cables coloured by signal type with legend and hover info`.
- **Acceptance:** each signal type has a distinct colour + legend; hover info works; legacy cables unchanged (default `colorFor`).

### Task 28: Keyboard and screen-reader patching (« Connecter à… »)

- **Agents:** tekfrontenddesigner (`/frontend-design`), tekuxwriter. **Closes:** CA-02 (P0). **Decisions:** C10, P4.
- **Files:** create `src/creation/shell/connectDialog.ts`, `src/creation/shell/connectModel.ts`; modify `src/creation/shell/propertiesPanel.ts` (« Connexions » rows get « Connecter à… » / « Débrancher » buttons); tests `tests/creation/connectModel.test.ts`, `tests/e2e/creation-keyboard-patch.spec.ts`.
- **Interfaces:** `export function candidates(store: Pick<CreationStore, 'canConnect' | 'connectionAt' | 'design'>, registry: Registry, from: PortRef): { ok: { ref: PortRef; label: string }[]; rejected: { ref: PortRef; label: string; reason: string }[] }` — every free port of every other instance, split by `canConnect`.
- [ ] **Step 1: failing unit test:** from `sm58 out-xlr` in the reference rig the `ok` list contains `ql1 in-mic-1` and `ql1 in-mic-2`, never `k12-g power-in`; rejected entries carry the French rule title (until Task 29: English title).
- [ ] **Step 2: run red; implement; run green.** `npx vitest run tests/creation/connectModel.test.ts`.
- [ ] **Step 3: dialog.** « Connecter à… » opens a `role="dialog"` listbox grouped by device; type-ahead filter field (label « Filtrer »); Enter on an option dispatches `CONNECT` through history and announces « Connecté : … » in a live region; incompatible ports are listed in a collapsed « Incompatibles » group with their reason (teaching value), not selectable.
- [ ] **Step 4: failing keyboard-only e2e** `tests/e2e/creation-keyboard-patch.spec.ts` (no `page.mouse` call anywhere in the file): from a fresh load, Tab into the picker, choose « Concert simple (référence) » with arrows + Enter; Tab to the tree, select `ql1`; Tab to Properties › Connexions › `out-main-l` › « Connecter à… » → filter « k12-g » → Enter on `in-line-a`; same for `out-main-r` → `k12-d in-line-a`; assert `design().rig.connections.length === 3` (mic + 2 signal). (Task 32 extends this spec with the 3 power cables, P4.)
- [ ] **Step 5: run.** `npm run build; if ($?) { npx playwright test tests/e2e/creation-keyboard-patch.spec.ts }` → PASS.
- [ ] **Step 6: commit.** `feat(creation): keyboard and screen-reader patching via « Connecter à… » (CA-02)`.
- **Acceptance:** the whole reference chain is cabled with the keyboard only; the spec contains no mouse call.

### Task 29: French rule texts and errors pinned at the port

- **Agents:** tekuxwriter (texts), tekdeveloper (schema + wiring). **Closes:** CA-15. **Decisions:** C17.
- **Files:** modify `tools/schemas.ts` (`Rule` gains required `title_fr`, `teach_fr`), `content/catalog.json` (R1–R8 French texts), `src/creation/shell/statusModel.ts` (`ruleText` prefers `_fr`), `src/creation/patchController.ts` (pinned label uses `_fr`); tests `tests/tools/schemas.test.ts` (extend), `tests/creation/ruleTexts.test.ts`.
- [ ] **Step 1: failing tests:** zod rejects a rule without `title_fr`; every catalog rule has non-empty `title_fr` and `teach_fr` without `[À REMPLACER`; the status view of an R3 rejection shows the French title.
- [ ] **Step 2: run red.** `npx vitest run tests/tools/schemas.test.ts tests/creation/ruleTexts.test.ts` → FAIL.
- [ ] **Step 3: write the texts** (tekuxwriter): translate the existing English `title`/`teach` of R1–R8 faithfully (same meaning, no new technical claim), English terms kept (XLR, phantom +48 V → « alimentation fantôme +48 V »). Keep the English fields (legacy reads them).
- [ ] **Step 4: run green**, plus `npm run validate:catalog` → exit 0 and `npx vitest run` → all green (legacy tests read `title`).
- [ ] **Step 5: commit.** `feat(catalog): French rule titles and teaching texts; shown at the port and in the status list (CA-15)`.
- **Acceptance:** every rule has French texts; Mode Création shows only French rule texts.

### Task 30: « Bêta » tab with catalog proposals « non vérifié »

- **Agents:** tekdeveloper, tekuxwriter. **Decisions:** S5.
- **Files:** read the existing proposals source (grep `proposal` under `content/` and `docs/`; the KB sync `npm run sync:kb` writes them — use exactly the file it writes, do not invent devices); modify `src/creation/inventory.ts` callers in `src/creation/boot.ts`; test `tests/e2e/creation-beta.spec.ts`.
- [ ] **Step 1: failing e2e:** the drawer shows « Bêta » only if proposals exist; each Bêta item carries the visible badge « non vérifié » and a tooltip « Fiche proposée, pas encore vérifiée : comportement approximatif. »; placing a Bêta item spawns a placeholder box with its declared ports.
- [ ] **Step 2: implement.** If no proposals file exists in the repo, the Bêta tab stays hidden and the test asserts that (log it in `docs/CREATIVE-MODE-LOG.md`, no invented data).
- [ ] **Step 3: run green.** `npm run build; if ($?) { npx playwright test tests/e2e/creation-beta.spec.ts }`.
- [ ] **Step 4: commit.** `feat(creation): « Bêta » tab with unverified catalog proposals`.
- **Acceptance:** proposals appear only in Bêta, always badged.

### Task 31: Phase 3 gate

- **Agents:** tekdeveloper (gate), **tekreviwer** (review).
- [ ] **Step 1:** `npx tsc --noEmit; npx vitest run; npm run lint; npm run validate:catalog; npm run build; if ($?) { npx playwright test }` → all green.
- [ ] **Step 2: review.** tekreviwer on Phase 3 (brief §4, C6, C10, C17, C18; the static no-`ConnectionGraph` test; keyboard-only spec has no mouse call). Fix Critical/Important with TDD.
- [ ] **Step 3: site build + local check.** `npm run build:site; if ($?) { npm run smoke:site }`.
- [ ] **Step 4: log, commit, push** (« Phase 3 : done »).
- **Acceptance:** all green; CA-02 closed; pushed.

---

## Phase 4: Mains, signal path, sound and coverage

### Task 32: Mains power: `multiprise-secteur`, `power` control, starter template update

- **Agents:** tekdeveloper (data, schema), tekdesigner (multiprise model via `tools/blender/gen_asset.py`). **Closes:** CA-03 (mains part). **Decisions:** C7, P4, P18, P19.
- **Files:** modify `tools/schemas.ts` (`PortFlag` gains `'isMainsSource'`), `content/catalog.json` (new device `multiprise-secteur`; `power` toggle on every device with a `power-in` port), `content/templates/concert-simple-reference.json` (+ multiprise `mains` at `[0, 1.3, -10]` on stage, + 3 power cables QL1/K12-G/K12-D → `mains out-1..3`), `src/creation/inventory.ts` (`secteur` tab), `tests/e2e/creation-keyboard-patch.spec.ts` (P4 extension), `public/assets/multiprise-secteur.glb` (if Blender available), `ASSET_LOG.md`; tests `tests/tools/schemas.test.ts`, `tests/creation/templates.test.ts`.
- [ ] **Step 1: failing tests.** The catalog has `multiprise-secteur` with 4 outputs `out-1..out-4` (connector `iec-c13`, signal `mains-power`, direction `out`, flags `['isMainsSource']`) and no `power-in`; every device with a `power-in` port has a toggle control `power` (label « Alimentation », default `true`); `ConnectionGraph` connects `k12-g power-in` ↔ `mains out-1` (R1–R3 pass: check the K12.2 `power-in` connector id in the catalog and give the multiprise outputs the **mating** connector of that inlet — if the catalog uses `iec-c14` for the inlet, the output is `iec-c13` with the mate relation already declared in `connectors[]`; if the mate is missing, add it as data); the template now has 5 instances and 4 connections and still validates.
- [ ] **Step 2: run red; edit data; run green.** `npx vitest run tests/tools/schemas.test.ts tests/creation/templates.test.ts; npm run validate:catalog`.
- [ ] **Step 3: model (P18).** tekdesigner runs `tools/blender/gen_asset.py` for a plain generic power strip (own work, no brand), exports `public/assets/multiprise-secteur.glb` ≤ 200 KB, logs it in `ASSET_LOG.md`. No Blender → keep the placeholder and log it.
- [ ] **Step 4: extend the keyboard-only spec** (P4): after the signal cables, place the multiprise from the drawer by keyboard (« Secteur » tab, Enter on the item; keyboard placement drops at the selected point = viewport centre floor hit) and wire `ql1 power-in`, `k12-g power-in`, `k12-d power-in` to `out-1..3` via « Connecter à… »; assert 6 connections.
- [ ] **Step 5: legacy check (P19).** `npm run build; if ($?) { npx playwright test }` → all green; if an Essais test shows a new « modifié depuis » diff only for `power`, accept it in the test fixture and log P19.
- [ ] **Step 6: commit.** `feat(catalog): generic multiprise-secteur, power control on active devices; starter template powered`.
- **Acceptance:** mains data validated; the reference rig can be powered with the keyboard only.

### Task 33: Catalog `routing[]`, `playback-usb` and console sound controls

- **Agent:** tekdeveloper. **Decisions:** C8, P7, P8.
- **Files:** modify `tools/schemas.ts` (`Route`, `Device.routing?`), `tools/catalogChecks.ts` (route ports exist and directions are right), `content/catalog.json`; tests `tests/tools/schemas.test.ts`, `tests/tools/catalogChecks.test.ts`.
- **Interfaces:**

  ```ts
  export const Route = z.object({
    from: z.string(),                         // an input port id, or 'control:<controlId>' for an internal source
    to: z.array(z.string()).min(1),           // output port ids, or the pseudo-target 'transducer'
    channels: z.array(z.enum(['L', 'R'])).optional(), // parallel to `to` (P7)
    passive: z.boolean().optional(),          // works unpowered (P7: K12.2 loop-thru)
    when: z.object({ control: z.string(), equals: z.union([z.boolean(), z.string()]) }).optional(),
  })
  ```

  Data:
  - QL1 controls: `playback-usb` (toggle, label « Lecture console », default `false`), `mute-master` (toggle « Mute master », default `false`), `fader-master` (enum « Fader master », values `["-inf","-30","-20","-10","-6","-3","0","+6","+10"]`, default `"0"`), `balance-master` (enum « Balance », values `["G100","G50","C","D50","D100"]`, default `"C"`).
  - QL1 routing: `{ from: 'control:playback-usb', to: ['out-main-l','out-main-r'], channels: ['L','R'], when: { control: 'playback-usb', equals: true } }`, `{ from: 'in-mic-1', to: ['out-main-l','out-main-r'] }`, `{ from: 'in-mic-2', to: ['out-main-l','out-main-r'] }`.
  - K12.2: `{ from: 'in-line-a', to: ['transducer'] }`, `{ from: 'in-line-a', to: ['thru-out-a'], passive: true }`. DBR12: `{ from: 'in-line', to: ['transducer'] }`, `{ from: 'in-line', to: ['link-out'], passive: true }`. Genelec 8030C: `{ from: 'in-analog', to: ['transducer'] }`.
  - Before writing a route, open each device's ports in `content/catalog.json` and use their exact ids; a pass-through is only declared where the KB says the output is a parallel link of the input (K12.2: KB « loop-thru »; DBR12: KB « link out »). If the KB does not say so for a device, do not add the route.
- [ ] **Step 1: failing tests:** schema accepts the routes above and rejects `channels` whose length ≠ `to` length; `checkCatalog` errors when a route names an unknown port, when `from` is an output, when a `to` is an input, or when `when.control` is not a control of the device.
- [ ] **Step 2: run red; edit; run green.** `npx vitest run tests/tools; npm run validate:catalog` → exit 0.
- [ ] **Step 3: commit.** `feat(catalog): device routing[] and QL1 playback + master controls`.
- **Acceptance:** routing data validated against ports; legacy suite green (`npx vitest run`).

### Task 34: Pure signal path (`playbackReady`, reasons, Micro OK)

- **Agent:** tekdeveloper. **Closes:** CA-03 (gate part). **Decisions:** C7, C8, C9.
- **Files:** create `src/flow/signalPath.ts`; modify `src/creation/shell/statusModel.ts` (a « Lecture » line: « Lecture possible » or the first reason), `src/creation/shell/menuModel.ts` (Écoute › « Lecture » enabled iff `playbackReady`); tests `tests/flow/signalPath.test.ts`.
- **Interfaces (produces):**

  ```ts
  export type ReasonCode = 'NO_SOURCE' | 'SOURCE_OFF' | 'HOST_UNPOWERED' | 'NO_PATH' | 'SPEAKER_UNPOWERED' | 'RULE_ERROR'
  export interface Reason { code: ReasonCode; text_fr: string; subjects: PortRef[] }
  export interface SpeakerFeed { instanceId: string; channels: ('L' | 'R')[]; gainDb: number; muted: boolean; balance: string; path: PortRef[] }
  export interface PathResult { playbackReady: boolean; speakers: SpeakerFeed[]; reasons: Reason[]; micOk: boolean; micReasons: Reason[] }
  export function isPowered(design: DesignState, registry: Registry, instanceId: string): boolean
  export function signalPath(design: DesignState, registry: Registry, events: readonly TeachingEvent[]): PathResult
  ```

- [ ] **Step 1: failing tests** `tests/flow/signalPath.test.ts` (build designs with `CreationStore` from Task 4 so ports are real):

  ```ts
  // helper: powered reference rig = template + multiprise + 3 power cables + 2 signal cables; playback-usb on
  it('powered reference rig with playback on → ready, both speakers fed L and R', () => {
    const r = signalPath(rig(), registry, [])
    expect(r.playbackReady).toBe(true)
    expect(r.speakers.map((s) => [s.instanceId, s.channels]).sort()).toEqual([['k12-d', ['R']], ['k12-g', ['L']]])
  })
  it('playback off → SOURCE_OFF', () => expect(signalPath(rig({ playback: false }), registry, []).reasons[0].code).toBe('SOURCE_OFF'))
  it('QL1 unplugged from mains → HOST_UNPOWERED', () => expect(first(rig({ unplug: 'ql1 power-in' }))).toBe('HOST_UNPOWERED'))
  it('QL1 power control off → HOST_UNPOWERED', () => expect(first(rig({ power: { ql1: false } }))).toBe('HOST_UNPOWERED'))
  it('k12-g unpowered → only k12-d fed, ready stays true, reason SPEAKER_UNPOWERED listed', () => {
    const r = signalPath(rig({ unplug: 'k12-g power-in' }), registry, [])
    expect(r.playbackReady).toBe(true)
    expect(r.speakers.map((s) => s.instanceId)).toEqual(['k12-d'])
    expect(r.reasons.map((x) => x.code)).toContain('SPEAKER_UNPOWERED')
  })
  it('no speaker cable → NO_PATH', () => expect(first(rig({ unplug: ['ql1 out-main-l', 'ql1 out-main-r'] }))).toBe('NO_PATH'))
  it('no QL1 → NO_SOURCE', () => expect(first(emptyWith(['shure-sm58']))).toBe('NO_SOURCE'))
  it('an error event on a path port blocks that path → RULE_ERROR', () => {
    const ev = [{ ruleId: 'R5', severity: 'error', title: 't', teach: 't', subjects: [{ instance: 'k12-g', port: 'in-line-a' }] }] as TeachingEvent[]
    const r = signalPath(rig({ unplug: 'ql1 out-main-r' }), registry, ev)
    expect(r.playbackReady).toBe(false); expect(r.reasons[0].code).toBe('RULE_ERROR')
  })
  it('mute and fader never gate: muted → ready, feed muted; fader -inf → ready, gainDb -Infinity', () => {
    expect(signalPath(rig({ controls: { 'mute-master': true } }), registry, []).speakers.every((s) => s.muted)).toBe(true)
    expect(signalPath(rig({ controls: { 'fader-master': '-inf' } }), registry, []).playbackReady).toBe(true)
  })
  it('daisy-chain through the passive loop-thru works even if the first speaker is unpowered', () => {
    // ql1 out-main-l → k12-g in-line-a ; k12-g thru-out-a → k12-d in-line-a ; k12-g unpowered
    const r = signalPath(chain({ unpowered: 'k12-g' }), registry, [])
    expect(r.speakers.map((s) => [s.instanceId, s.channels])).toEqual([['k12-d', ['L']]])
  })
  it('Micro OK: SM58 into a powered QL1 mic input with no error event', () => {
    expect(signalPath(rig(), registry, []).micOk).toBe(true)
    expect(signalPath(rig({ unplug: 'sm58 out-xlr' }), registry, []).micOk).toBe(false)
  })
  ```

  Write the helpers `rig(opts)`, `chain(opts)`, `emptyWith(ids)`, `first(design)` in the test file in full (they dispatch intents on a fresh `CreationStore`, then return `store.design()`).
- [ ] **Step 2: run red.** `npx vitest run tests/flow/signalPath.test.ts` → FAIL.
- [ ] **Step 3: implement** `src/flow/signalPath.ts`:

  ```ts
  /** Pure, data-driven signal flow (C8, C9). Reads catalog routing[] and DesignState only; never imports Babylon or the store. */
  const key = (r: PortRef) => `${r.instance}\u0000${r.port}`

  export function isPowered(design: DesignState, registry: Registry, id: string): boolean {
    const inst = design.rig.instances.find((i) => i.instanceId === id); if (!inst) return false
    const dev = registry.deviceById.get(inst.deviceId)!
    if (design.rig.controls[id]?.power === false) return false
    const inlet = dev.ports.find((p) => p.id === 'power-in')
    if (!inlet) return true // passive (mic) or itself a mains source
    const peer = peerOf(design, { instance: id, port: 'power-in' }); if (!peer) return false
    const peerDev = registry.deviceById.get(deviceOf(design, peer.instance))!
    return !!peerDev.ports.find((p) => p.id === peer.port)?.flags?.includes('isMainsSource')
  }

  export function signalPath(design: DesignState, registry: Registry, events: readonly TeachingEvent[]): PathResult {
    const errorPorts = new Set(events.filter((e) => e.severity === 'error').flatMap((e) => e.subjects.map(key)))
    const sources = design.rig.instances.flatMap((i) => (registry.deviceById.get(i.deviceId)?.routing ?? []).filter((r) => r.from.startsWith('control:')).map((r) => ({ inst: i, route: r })))
    if (!sources.length) return fail('NO_SOURCE')
    const enabled = sources.filter(({ inst, route }) => !route.when || (design.rig.controls[inst.instanceId]?.[route.when.control] ?? defaultOf(registry, inst.deviceId, route.when.control)) === route.when.equals)
    if (!enabled.length) return fail('SOURCE_OFF', sources.map((s) => ({ instance: s.inst.instanceId, port: s.route.from })))
    const live = enabled.filter(({ inst }) => isPowered(design, registry, inst.instanceId))
    if (!live.length) return fail('HOST_UNPOWERED', enabled.map((s) => ({ instance: s.inst.instanceId, port: 'power-in' })))
    // BFS over (port, channel): out port → connection peer (an input) → device routes from that input → outputs | transducer
    const feeds = new Map<string, SpeakerFeed>(); const unpoweredSpeakers = new Set<string>(); let blockedByRule = false
    const queue: { out: PortRef; channel: 'L' | 'R' | null; path: PortRef[]; host: string }[] = []
    for (const { inst, route } of live) route.to.forEach((to, k) => queue.push({ out: { instance: inst.instanceId, port: to }, channel: route.channels?.[k] ?? null, path: [], host: inst.instanceId }))
    const seen = new Set<string>()
    while (queue.length) {
      const { out, channel, path, host } = queue.shift()!
      const tag = `${key(out)}|${channel}`; if (seen.has(tag)) continue; seen.add(tag)
      if (errorPorts.has(key(out))) { blockedByRule = true; continue }
      const inp = peerOf(design, out); if (!inp) continue
      if (errorPorts.has(key(inp))) { blockedByRule = true; continue }
      const dev = registry.deviceById.get(deviceOf(design, inp.instance))!
      const powered = isPowered(design, registry, inp.instance)
      for (const r of (dev.routing ?? []).filter((x) => x.from === inp.port)) {
        if (!r.passive && !powered) { if (r.to.includes('transducer')) unpoweredSpeakers.add(inp.instance); continue }
        for (const to of r.to) {
          if (to === 'transducer') addFeed(feeds, inp.instance, channel, [...path, out, inp], design, host)
          else queue.push({ out: { instance: inp.instance, port: to }, channel, path: [...path, out, inp], host })
        }
      }
    }
    // reasons: SPEAKER_UNPOWERED for each unpoweredSpeakers id without a feed; NO_PATH or RULE_ERROR when feeds is empty
    // feed gain/mute/balance come from the host console controls (fader-master, mute-master, balance-master); fader '-inf' → -Infinity
  }
  ```

  Complete `peerOf` (the other end of the connection that touches the ref), `deviceOf`, `defaultOf` (catalog control default), `addFeed` (merge channels per speaker, sorted `L` before `R`), `fail(code, subjects?)` (playbackReady false, French `text_fr` from a `REASON_TEXT` table owned by tekuxwriter: « Aucune source de lecture dans le projet. », « La lecture console est coupée. », « La console n'est pas alimentée. », « Aucun chemin de la console jusqu'à une enceinte. », « Une enceinte reçoit le signal mais n'est pas alimentée. », « Une erreur de câblage bloque le chemin. »), and `micOk` (an SM58 `out-xlr` whose peer is a QL1 `isMicInput` port on a powered QL1 with no error event on either port; else a `micReasons` entry).
- [ ] **Step 4: run green.** `npx vitest run tests/flow/signalPath.test.ts` → PASS.
- [ ] **Step 5: wire the status** (status line « Lecture possible » / first reason; « Micro OK » indicator) and Écoute › Lecture enablement. `npx vitest run tests/creation` → green.
- [ ] **Step 6: commit.** `feat(flow): pure signal path — playbackReady, reasons, Micro OK (CA-03)`.
- **Acceptance:** the table of cases above passes; mute/fader never gate; passive loop-thru works unpowered.

### Task 35: Acoustic provenance fields in the catalog

- **Agent:** tekdeveloper (values copied from the KB only). **Decisions:** C12.
- **Files:** modify `tools/schemas.ts` (`Sourced`, `Device.acoustic?`), `tools/catalogChecks.ts`, `content/catalog.json` (K12.2, DBR12, Genelec 8030C); tests `tests/tools/schemas.test.ts`, `tests/tools/catalogChecks.test.ts`.
- **Interfaces:**

  ```ts
  export const Sourced = <T extends z.ZodTypeAny>(v: T) => z.object({ value: v, source: z.object({ kind: z.enum(['datasheet', 'kb', 'nominal']), ref: z.string().min(1), retrieved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }) })
  export const Acoustic = z.object({
    coverage_h_deg: Sourced(z.number().positive()), coverage_v_deg: Sourced(z.number().positive()),
    max_spl_db: Sourced(z.number()).optional(), sensitivity_db: Sourced(z.number()).optional(),
  })
  ```

  Values (from the KB, `ref` = the KB note path, `retrieved` = the KB note date): K12.2 coverage « 75° nominal, axisymmetric » → H 75, V 75, kind `kb`; max SPL 132 dB peak → `max_spl_db` 132 kind `kb` (continuous 126 noted in `ref`); no sensitivity → omitted. DBR12 « H90° x V60° » → 90 / 60 `kb`; max SPL 131 peak `kb`. Genelec 8030C: no coverage in the KB → 90 / 60 kind `nominal`, `ref: "valeur nominale (pas de donnée constructeur dans la KB)"`; max SPL « >104 short-term » is a lower bound → omit `max_spl_db`. Open the KB notes (`npm run sync:kb` source) and copy the exact refs; never invent a value.
- [ ] **Step 1: failing tests:** zod requires `source` on every acoustic field; `checkCatalog` errors when `kind: 'nominal'` is used with values other than 90 × 60 and warns for any speaker (device with a `transducer` route) without `acoustic`; the three speakers have the values above.
- [ ] **Step 2: run red; edit; run green.** `npx vitest run tests/tools; npm run validate:catalog`.
- [ ] **Step 3: commit.** `feat(catalog): sourced acoustic fields for K12.2, DBR12, 8030C (C12)`.
- **Acceptance:** every acoustic value has provenance; nominal only as 90 × 60.

### Task 36: Pure acoustics core and ADR-0015

- **Agent:** tekdeveloper. **Closes:** CA-23 (model part). **Decisions:** C13, P9, P10, P17.
- **Files:** create `src/acoustics/geometry.ts`, `src/acoustics/field.ts`, `src/acoustics/scale.ts`, `src/acoustics/grid.ts`, `docs/adr/0015-acoustics-direct-field.md`; tests `tests/acoustics/golden.test.ts`, `tests/acoustics/field.test.ts`, `tests/acoustics/grid.test.ts`.
- **Interfaces (produces):**

  ```ts
  // geometry.ts — Babylon LH, yaw about +y (0 = facing +z), tilt > 0 aims up
  export interface SpeakerPose { position: [number, number, number]; yawDeg: number; tiltDeg: number }
  export function offAxis(s: SpeakerPose, p: [number, number, number]): { thetaHdeg: number; thetaVdeg: number; rear: boolean; r: number }
  // field.ts
  export interface AcSource { id: string; pose: SpeakerPose; hDeg: number; vDeg: number; lRefDb: number } // lRefDb = feed gainDb (P10)
  export function directivityDb(thetaHdeg: number, thetaVdeg: number, hDeg: number, vDeg: number, rear: boolean): number
  export function levelDb(src: AcSource, p: [number, number, number]): number   // L_ref + D − 20·log10(max(r, 0.5))
  export function energeticSumDb(levels: readonly number[]): number            // 10·log10(Σ 10^(L/10)); [] → -Infinity
  export interface FieldResult { relDb: Float32Array; overlap: Uint8Array; maxDb: number }
  export function computeField(sources: readonly AcSource[], points: Float32Array /* xyz triples */): FieldResult // overlap[i] = 1 when the top two contributors are within 6 dB
  // scale.ts
  export const SCALE_STEPS_DB = [0, -3, -6, -9, -12, -15, -18, -21, -24] as const
  export function scaleBin(relDb: number): number                              // 0..7, clamp to [-24, 0]
  export function stats(relDb: Float32Array): { min: number; max: number; mean: number; sd: number; count: number } // unclamped (P17)
  // grid.ts
  export function listenerGrid(zones: readonly { x: number; z: number; w: number; d: number; y: number }[], earHeight: number, maxPoints?: number): { points: Float32Array; stepM: 0.5 | 1 | 2 }
  ```

- [ ] **Step 1: failing golden tests** `tests/acoustics/golden.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest'
  import { directivityDb, energeticSumDb, levelDb, computeField } from '../../src/acoustics/field'
  import { offAxis } from '../../src/acoustics/geometry'
  import { scaleBin } from '../../src/acoustics/scale'
  const src = (over = {}) => ({ id: 's', pose: { position: [0, 0, 0] as [number, number, number], yawDeg: 0, tiltDeg: 0 }, hDeg: 90, vDeg: 60, lRefDb: 0, ...over })
  describe('golden (council Q5)', () => {
    it('#1 doubling the distance on axis = −6.02 dB', () => expect(levelDb(src(), [0, 0, 8]) - levelDb(src(), [0, 0, 4])).toBeCloseTo(-6.02, 2))
    it('#2 −6.00 dB at half the H coverage', () => expect(directivityDb(45, 0, 90, 60, false)).toBeCloseTo(-6.0, 6))
    it('#3 −6.00 dB at half the V coverage', () => expect(directivityDb(0, 30, 90, 60, false)).toBeCloseTo(-6.0, 6))
    it('#4 two equal sources = +3.01 dB', () => expect(energeticSumDb([0, 0])).toBeCloseTo(3.01, 2))
    it('#5 rear hemisphere = −30 dB (P9)', () => expect(directivityDb(170, 0, 90, 60, true)).toBe(-30))
    it('#6 floor at −30 dB off-axis', () => expect(directivityDb(89, 0, 90, 60, false)).toBe(-30))
    it('#7 yaw 90° faces +x', () => expect(offAxis({ position: [0, 0, 0], yawDeg: 90, tiltDeg: 0 }, [5, 0, 0]).thetaHdeg).toBeCloseTo(0, 6))
    it('#8 r is floored at 0.5 m', () => expect(levelDb(src(), [0, 0, 0.1])).toBeCloseTo(levelDb(src(), [0, 0, 0.5]), 9))
    it('#9 scale bins: 0 → 0, −3 → 1, −23.9 → 7, −40 → 7', () => expect([0, -3, -23.9, -40].map(scaleBin)).toEqual([0, 1, 7, 7]))
    it('field is relative: its max point is 0 dB', () => {
      const f = computeField([src()], new Float32Array([0, 0, 2, 0, 0, 4]))
      expect(Math.max(...f.relDb)).toBe(0); expect(f.relDb[1]).toBeCloseTo(-6.02, 2)
    })
  })
  ```

  `tests/acoustics/field.test.ts`: a muted/unfed source is simply absent from `sources` (caller's job), `tiltDeg −10` lowers the on-axis point; overlap flag set midway between two equal speakers, not right in front of one. `tests/acoustics/grid.test.ts`: step 0.5 m when ≤ 20 000 points, then 1 m, then 2 m; y = zone floor + ear height; points stay inside zones.
- [ ] **Step 2: run red.** `npx vitest run tests/acoustics` → FAIL.
- [ ] **Step 3: implement.**

  ```ts
  // geometry.ts
  const D2R = Math.PI / 180
  export function offAxis(s: SpeakerPose, p: [number, number, number]) {
    const dx = p[0] - s.position[0], dy = p[1] - s.position[1], dz = p[2] - s.position[2]
    const r = Math.hypot(dx, dy, dz)
    const yaw = s.yawDeg * D2R, tilt = s.tiltDeg * D2R
    // inverse yaw (Babylon LH: world = local rotated by yaw about +y)
    const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw)
    const lz1 = dx * Math.sin(yaw) + dz * Math.cos(yaw)
    // inverse tilt (pitch up by `tilt` about local x)
    const ly = dy * Math.cos(tilt) - lz1 * Math.sin(tilt)
    const lz = dy * Math.sin(tilt) + lz1 * Math.cos(tilt)
    return { thetaHdeg: Math.atan2(lx, lz) / D2R, thetaVdeg: Math.atan2(ly, Math.hypot(lx, lz)) / D2R, rear: lz < 0, r }
  }
  // field.ts
  export function directivityDb(th: number, tv: number, h: number, v: number, rear: boolean): number {
    if (rear) return -30
    const u2 = (th / (h / 2)) ** 2 + (tv / (v / 2)) ** 2
    return Math.max(-6 * u2, -30)
  }
  export function levelDb(s: AcSource, p: [number, number, number]): number {
    const a = offAxis(s.pose, p)
    return s.lRefDb + directivityDb(a.thetaHdeg, a.thetaVdeg, s.hDeg, s.vDeg, a.rear) - 20 * Math.log10(Math.max(a.r, 0.5))
  }
  export function energeticSumDb(levels: readonly number[]): number {
    let e = 0; for (const l of levels) e += 10 ** (l / 10)
    return e > 0 ? 10 * Math.log10(e) : -Infinity
  }
  export function computeField(sources: readonly AcSource[], pts: Float32Array): FieldResult {
    const n = pts.length / 3, abs = new Float64Array(n), overlap = new Uint8Array(n); let maxDb = -Infinity
    for (let i = 0; i < n; i++) {
      const p: [number, number, number] = [pts[3 * i], pts[3 * i + 1], pts[3 * i + 2]]
      const ls = sources.map((s) => levelDb(s, p)).sort((a, b) => b - a)
      abs[i] = energeticSumDb(ls)
      overlap[i] = ls.length > 1 && ls[0] - ls[1] <= 6 ? 1 : 0
      if (abs[i] > maxDb) maxDb = abs[i]
    }
    const relDb = new Float32Array(n); for (let i = 0; i < n; i++) relDb[i] = abs[i] - maxDb
    return { relDb, overlap, maxDb }
  }
  // scale.ts
  export function scaleBin(rel: number): number { const c = Math.min(0, Math.max(-24, rel)); return Math.min(7, Math.floor(-c / 3)) }
  ```

  `stats` uses the unclamped values (P17); `listenerGrid` builds the grid per zone (only `audience` and `foh` kinds are passed by the caller), doubling the step while the count exceeds `maxPoints` (default 20 000).
- [ ] **Step 4: run green.** `npx vitest run tests/acoustics` → PASS.
- [ ] **Step 5: ADR-0015** « Champ direct relatif » (French): formula, −6 dB at half coverage, rear −30 dB step (P9), r floor, energetic sum, relative display, SPL estimate rule (only with sourced `sensitivity_db` + `max_spl_db` for every contributor, « estimation pédagogique »), what is **not** modelled (reflections, interference: hatched, no STI, no legal limit).
- [ ] **Step 6: commit.** `feat(acoustics): pure direct-field core with golden tests (ADR-0015)`.
- **Acceptance:** golden tests 2×distance −6.02, coverage edge −6.00, two sources +3.01 pass without a worker.

### Task 37: Coverage worker, dots, legend and statistics

- **Agents:** tekdeveloper (worker, thin instances), tekfrontenddesigner (`/frontend-design`, legend + stats panel), tekuxwriter (honesty copy), tekdesigner (8-colour scale on Nuit). **Closes:** CA-23, CA-24, CA-25. **Decisions:** C13, S2, S6.
- **Files:** create `src/acoustics/worker.ts`, `src/acoustics/client.ts`, `src/creation/coverageLayer.ts`, `src/creation/shell/coveragePanel.ts`, `tests/acoustics/honesty.test.ts`; modify `src/creation/shell/menuModel.ts` (Écoute › « Couverture » toggle, « Hauteur d'oreille »), `src/creation/copy.ts`; tests `tests/acoustics/client.test.ts`, `tests/e2e/creation-coverage.spec.ts`.
- **Interfaces:**

  ```ts
  export interface CoverageJob { jobId: number; sources: AcSource[]; points: Float32Array }
  export interface CoverageReply { jobId: number; relDb: Float32Array; overlap: Uint8Array; stats: ReturnType<typeof stats> }
  export class CoverageClient { constructor(makeWorker: () => Worker | MessagePortLike, debounceMs?: number /* 150 */); request(job: Omit<CoverageJob, 'jobId'>): void; onResult(fn: (r: CoverageReply) => void): () => void; dispose(): void }
  export function coverageSources(design: DesignState, registry: Registry, path: PathResult): AcSource[] // only fed, powered, unmuted speakers with acoustic data
  ```

- [ ] **Step 1: failing tests.** `client.test.ts` with a fake worker and fake timers: 5 requests within 150 ms → 1 job posted; a reply with an old `jobId` is dropped (stale); buffers are transferred (`postMessage` second arg lists them). `honesty.test.ts`: no file under `src/` or `content/` (excluding tests) contains `STI` as a word, « limite légale », « décret », « 102 dB » or « dB(A) réglementaire »; the copy has « dB relatif (0 = point le plus fort) », « somme énergétique, champ direct », « interférences non modélisées », « estimation pédagogique ». `coverageSources`: a muted feed or a speaker without `acoustic` is excluded; `lRefDb = gainDb`.
- [ ] **Step 2: run red; implement; run green.** `npx vitest run tests/acoustics`.
- [ ] **Step 3: layer + panel.**
  - Recompute only on store change, ear-height change or coverage toggle (debounce 150 ms); never per frame.
  - Dots: one thin-instanced disc mesh (`thinInstanceSetBuffer('matrix')` + `'color'`), one draw call, colour from `scaleBin` over a locked 8-step palette; overlap points drawn with a hatched texture variant (second thin-instanced mesh).
  - Panel (Properties side, not over the viewport): legend 0 → −24 dB in 3 dB steps with labels, « dB relatif (0 = point le plus fort) », « somme énergétique, champ direct », source line (« Couverture : données KB / valeur nominale »), the fidelity chip « relatif », stats min/max/moyenne/écart-type/points, « Hachuré : interférences non modélisées ». « ≈ dB SPL estimé » appears only when every contributing speaker has sourced `sensitivity_db` and `max_spl_db` (none today, so it is hidden; the unit test proves the rule with a synthetic catalog).
- [ ] **Step 4: e2e** `tests/e2e/creation-coverage.spec.ts`: powered reference rig + playback-usb on; Écoute › Couverture → `__creation.coverage()` returns ≤ 20 000 points with max 0 dB; idle 2 s → 0 renders and 0 worker jobs; moving `k12-g` by 1 m → exactly 1 new job after 150 ms; muting the master → the dots disappear (no fed source) and the panel says why; `__creation.drawCalls('coverage') === 1` for the plain dots mesh.
- [ ] **Step 5: run.** `npm run build; if ($?) { npx playwright test tests/e2e/creation-coverage.spec.ts }` → PASS.
- [ ] **Step 6: commit.** `feat(acoustics): debounced worker coverage with thin-instance dots, legend and stats (CA-23, CA-24, CA-25)`.
- **Acceptance:** coverage on change only; one draw call; honest labels; no STI / legal-limit wording (grep test).

### Task 38: CC0 demo songs and local file

- **Agents:** tekdeveloper (fetch, verify, log), tekuxwriter (credits copy). **Closes:** CA-03 (content part). **Decisions:** S3, P13.
- **Files:** create `public/audio/songs/*.mp3` (2–3 files), `content/songs.json`, `src/audio/songs.ts`; modify `ASSET_LOG.md`; tests `tests/audio/songs.test.ts`.
- **Interfaces:** `export const SongEntry = z.object({ id: z.string(), title: z.string(), author: z.string(), file: z.string(), bytes: z.number().max(3 * 1024 * 1024), licence: z.literal('CC0-1.0'), licenceUrl: z.string().url(), sourceUrl: z.string().url(), retrieved: z.string(), sha256: z.string().length(64) })`.
- [ ] **Step 1: failing test** `tests/audio/songs.test.ts`: `content/songs.json` has 2–3 entries; each `file` exists, its size equals `bytes` and is ≤ 3 MB, its SHA-256 equals `sha256`; each entry appears in `ASSET_LOG.md` with its `licenceUrl`.
- [ ] **Step 2: run red.** `npx vitest run tests/audio/songs.test.ts` → FAIL.
- [ ] **Step 3: choose and verify tracks.** Source: freepd.com (states its music is public domain / CC0) or a ccMixter upload whose page shows the CC0 licence. **Pixabay is not CC0: do not use it.** For each track: open the track page and the licence page, confirm CC0 / public domain dedication text, record the exact page URLs, download, transcode to mp3 ≤ 3 MB if needed (`ffmpeg -i in -b:a 128k -ac 2 out.mp3`, trimming to ~2–3 min is fine), compute SHA-256 (`Get-FileHash -Algorithm SHA256`). Prefer one band-like track, one acoustic/voice-like track. Never use a track whose licence you cannot see on the page. If no CC0 track can be verified, ship **no** song file, set `content/songs.json` to `[]`, relax the test to 0 entries, and rely on the generated test signal (Task 39) + local file; log the decision.
- [ ] **Step 4: run green.** Same command → PASS.
- [ ] **Step 5: commit.** `feat(audio): CC0 demo songs with verified licence URLs (ASSET_LOG)`.
- **Acceptance:** each file ≤ 3 MB, licence URL recorded and verifiable, hash-checked.

### Task 39: Web Audio listener mix, transport and meters

- **Agents:** tekdeveloper (pure mix + adapter), tekfrontenddesigner (`/frontend-design`, Écoute UI), tekuxwriter. **Closes:** CA-03 (P0: hear the rig), CA-26. **Decisions:** C9, C14, S3.
- **Files:** create `src/audio/listenerMix.ts` (pure), `src/audio/engine.ts` (Web Audio adapter, lazy chunk), `src/audio/testSignal.ts` (own-work generated pink noise and a short musical pattern rendered with `OfflineAudioContext`), `src/creation/shell/listenPanel.ts`; modify `src/creation/shell/menuModel.ts` (Écoute: « Lecture » / « Stop », « Morceau » list, « Choisir un fichier audio… », « Signal de test »), `src/creation/copy.ts`; tests `tests/audio/listenerMix.test.ts`, `tests/e2e/creation-listen.spec.ts`.
- **Interfaces:**

  ```ts
  export interface MixInput { listener: { position: [number, number, number]; right: [number, number, number] }; feeds: { instanceId: string; position: [number, number, number]; channels: ('L' | 'R')[]; gainDb: number; muted: boolean; dirDb: number /* directivityDb toward the listener */ }[] }
  export interface MixVoice { instanceId: string; channels: ('L' | 'R')[]; gain: number; delayS: number; pan: number }
  export function listenerMix(input: MixInput): MixVoice[]
  export class AudioEngine { static create(): Promise<AudioEngine>; play(source: { kind: 'song'; url: string } | { kind: 'file'; file: File } | { kind: 'test' }): Promise<void>; stop(): void; update(voices: MixVoice[]): void; levels(): Record<string, number>; dispose(): void }
  ```

- [ ] **Step 1: failing tests** `tests/audio/listenerMix.test.ts`:
  - gain ∝ 1/r (speaker at 2 m vs 4 m → ratio 2), times `10^(gainDb/20)` and `10^(dirDb/20)`; muted → 0; `gainDb = -Infinity` → 0.
  - delay = r/343 minus the smallest r/343 (the nearest voice has 0 delay; 34.3 m further = 0.1 s).
  - pan = dot(horizontal unit vector listener→speaker, listener right), clamped to [−1, 1]: a speaker on the listener's right → +1; straight ahead → 0.
  - With the Régie listener facing the stage (camera right vector), « k12-g » at world +x pans **left** (P14: the rendered right vector is world −x when looking toward −z in Babylon LH) — compute `right` from the camera, never assume it.
- [ ] **Step 2: run red; implement** `listenerMix` (pure, 25 lines); **run green.** `npx vitest run tests/audio/listenerMix.test.ts`.
- [ ] **Step 3: adapter.** `AudioEngine`: `AudioContext` created on the first user gesture (« Lecture »); source → `ChannelSplitterNode(2)` → per voice: pick L (0) or R (1) or both (sum) → `GainNode` → `DelayNode(maxDelay 1 s)` → `StereoPannerNode` → `AnalyserNode` (meter) → destination. `update()` ramps params with `setTargetAtTime(…, 0.02)`. Local file: `URL.createObjectURL(file)` into an `<audio>` element + `MediaElementAudioSourceNode`; revoke on stop; the file is never uploaded or stored (no fetch, no storage write; asserted in e2e by request listening). Meters run only while playing: `scheduler.hold('meters')` on play, release on stop.
- [ ] **Step 4: wiring.** « Lecture » is enabled iff `signalPath(...).playbackReady`; otherwise the button stays focusable with `aria-disabled="true"` and its description is the first reason (`text_fr`). The listener is the walk camera in walk view, else the active listening point (Task 20) looking at the stage. Voices update on store change, listener move (debounced to animation frames only while playing), ear height change.
- [ ] **Step 5: failing e2e** `tests/e2e/creation-listen.spec.ts` (Chromium flag `--autoplay-policy=no-user-gesture-required` in `playwright.config.ts` `launchOptions.args`): unpowered rig → Lecture `aria-disabled` with « La console n'est pas alimentée. »; power everything + playback-usb on → Lecture enabled → click → after 500 ms `__creation.audioLevels()` shows both speakers > 0; `mute-master` on → levels 0 but « Lecture » stays on (mute never gates); stop → lease `meters` released and 0 renders in 2 s; « Choisir un fichier audio… » with `setInputFiles` (a 1 s generated WAV in the test) plays and **no network request** carries the file (`page.on('request')` sees no POST/PUT and no blob upload).
- [ ] **Step 6: run.** `npm run build; if ($?) { npx playwright test tests/e2e/creation-listen.spec.ts }` → PASS.
- [ ] **Step 7: commit.** `feat(audio): listener mix through each powered speaker; songs, local file, test signal (CA-03, CA-26)`.
- **Acceptance:** sound only when the chain is truly valid; per-speaker gain/delay/pan from geometry; local file never leaves the browser.

### Task 40 (bonus, cut first after Délais): Wavefront visualisation

- **Agents:** tekdesigner (look), tekdeveloper. **Decisions:** council bonus; cut order.
- **Files:** create `src/creation/wavefronts.ts`, `src/acoustics/wavefrontMath.ts` (pure); tests `tests/acoustics/wavefrontMath.test.ts`, `tests/e2e/creation-wavefront.spec.ts`.
- **Interfaces:** `export function ringRadius(tS: number, c?: number /* 343 */): number`; `export function ringAlpha(radiusM: number, maxM: number): number` (fades to 0 at `maxM`).
- [ ] **Step 1: failing tests:** radius after 10 ms = 3.43 m; alpha 0 at max; reduced motion → the feature shows static rings at 5 m steps instead of animating.
- [ ] **Step 2: run red; implement; run green.** `npx vitest run tests/acoustics/wavefrontMath.test.ts`.
- [ ] **Step 3: layer.** Écoute › « Fronts d'onde » (off by default): while on **and** playing, one expanding ring per fed speaker (thin torus, Ambre 30 % alpha), lease `wavefronts` held only while visible; off → lease released.
- [ ] **Step 4: e2e:** toggle on while playing → renders increase; toggle off → 0 renders in 2 s. `npm run build; if ($?) { npx playwright test tests/e2e/creation-wavefront.spec.ts }`.
- [ ] **Step 5: commit.** `feat(creation): optional wavefront rings (bonus)`.
- **Acceptance:** animation only while visible; reduced motion = static.

### Task 41 (bonus, cut first): « Délais » panel

- **Agents:** tekdeveloper, tekuxwriter. **Decisions:** council bonus; first in the cut order.
- **Files:** create `src/acoustics/delays.ts` (pure), `src/creation/shell/delaysPanel.ts`; tests `tests/acoustics/delays.test.ts`, `tests/e2e/creation-delays.spec.ts`.
- **Interfaces:** `export function arrivalTable(listener: [number, number, number], speakers: { instanceId: string; position: [number, number, number] }[], c?: number): { instanceId: string; distanceM: number; arrivalMs: number; relativeMs: number }[]` sorted by arrival.
- [ ] **Step 1: failing tests:** 34.3 m → 100 ms; relative to the first arrival; ties stable by id.
- [ ] **Step 2: run red; implement; run green.** `npx vitest run tests/acoustics/delays.test.ts`.
- [ ] **Step 3: panel.** Écoute › « Délais d'arrivée » opens a read-only table for the active listening point (« Enceinte · Distance · Arrivée · Écart »), with the note « Temps de vol direct, c = 343 m/s. Aucun réglage de délai n'est appliqué. »
- [ ] **Step 4: e2e:** at Régie the table lists k12-g and k12-d with equal distance in the template (symmetry) and an « Écart » of 0,0 ms. `npm run build; if ($?) { npx playwright test tests/e2e/creation-delays.spec.ts }`.
- [ ] **Step 5: commit.** `feat(creation): arrival-time table (bonus)`.
- **Acceptance:** values match r/343; panel is read-only.

### Task 42: Phase 4 gate

- **Agents:** tekdeveloper (gate), **tekreviwer** (review).
- [ ] **Step 1:** `npx tsc --noEmit; npx vitest run; npm run lint; npm run validate:catalog; npm run build; if ($?) { npx playwright test }` → all green.
- [ ] **Step 2: honesty and licences.** `npx vitest run tests/acoustics/honesty.test.ts tests/audio/songs.test.ts` green; `& $git ls-files tekpractice-sim/public/audio` lists only the files in `content/songs.json`; no screenshot or Fohhn file tracked (`& $git ls-files | Select-String -Pattern 'fohhn|screenshots/' -SimpleMatch` → nothing except the existing docs that mention the word).
- [ ] **Step 3: review.** tekreviwer on Phase 4 (brief §5, C7–C9, C12–C14, ADR-0015; engine untouched: `& $git diff c51dc87 -- tekpractice-sim/src/engine` is empty). Fix Critical/Important with TDD.
- [ ] **Step 4: site build + local check.** `npm run build:site; if ($?) { npm run smoke:site }`; every file in `dist-site` ≤ 25 MiB.
- [ ] **Step 5: log, commit, push** (« Phase 4 : done », bonuses shipped or cut).
- **Acceptance:** all green; engine unchanged; licences verifiable; pushed.

---

## Phase 5: Ship

### Task 43: Budgets, accessibility sweep, site page update

- **Agents:** tekdeveloper (budgets), tekfrontenddesigner (`/frontend-design`, site page), tekuxwriter (page copy). **Closes:** CA-27 and any remaining P2 from the audit.
- **Files:** create `tests/e2e/creation-budgets.spec.ts`, `tools/chunk-budget.mjs`; modify `package.json` (`"budget": "node tools/chunk-budget.mjs"`), site worktree `C:\Users\brro\dev\Tekonest-wt\site\website-prototype\src\pages\tekpractice.html` (or the page source `build.py` reads for `/tekpractice`; locate it with `Select-String -Path C:\Users\brro\dev\Tekonest-wt\site\website-prototype\src\*.py -Pattern tekpractice`).
- [ ] **Step 1: failing budget checks.** `tools/chunk-budget.mjs` reads `dist/.vite/manifest.json` (enable `build.manifest: true` in `vite.config.ts`), sums the creation entry + its static imports and the legacy entry + its static imports, fails if creation > legacy × 1.15, and fails if the acoustics, worker, audio, inventory drawer, picker thumbnails or songs are statically imported by the creation entry (they must be dynamic). `creation-budgets.spec.ts`: idle 0 renders in 2 s after each of: load, place change, cube hover, drawer close, coverage computed, stop playback; `liveListeners()` returns to its baseline after 5 place changes with gear; axe 0 serious/critical on picker, shell, drawer, connect dialog, view picker, listen panel.
- [ ] **Step 2: run red** (`npm run build; if ($?) { npm run budget; npx playwright test tests/e2e/creation-budgets.spec.ts }`); fix what fails (TDD per fix); **run green**.
- [ ] **Step 3: audit leftovers.** Re-read `docs/audit/2026-10-24-creative-audit.md`; for each CA-xx not yet closed by a task, either fix it (test first) or log why it is deferred in `docs/CREATIVE-MODE-LOG.md`.
- [ ] **Step 4: site page** (site worktree, branch `design/tekonest-umbrella-brand`): update the TekPractice page copy to present « Mode Création » (choose a place, place real gear, cable it, hear it, see the coverage) with the link to `/tekpractice/jouer/`; no Fohhn mention, no STI/legal claim. `python C:\Users\brro\dev\Tekonest-wt\site\website-prototype\src\build.py` → OK. Commit in the site worktree: `docs(site): TekPractice page presents Mode Création`.
- [ ] **Step 5: commit** (creative worktree): `perf(creation): chunk budget and idle/leak e2e; audit leftovers closed`.
- **Acceptance:** budget script and e2e green; site page updated and built.

### Task 44: Phase 5 gate: review, push, deploy, live re-audit, report

- **Agents:** tekdeveloper (gate, deploy), **tekreviwer** (final review), tekauditor or tekreviwer (live re-audit, per `.claude/agents/REGISTRY.md`).
- [ ] **Step 1: full checks.** `npx tsc --noEmit; npx vitest run; npm run lint; npm run validate:catalog; npm run build; if ($?) { npm run budget; npx playwright test }` → all green.
- [ ] **Step 2: final review.** tekreviwer on `c51dc87..HEAD` against the brief, council C1–C18 and this plan; fix Critical/Important; re-run Step 1. Push: `& $git push origin feature/tekpractice-creative-mode`.
- [ ] **Step 3: deploy build.** `npm run build:site; if ($?) { npm run smoke:site }`. Replace the site's game folder with the new build: `Remove-Item -Recurse -Force C:\Users\brro\dev\Tekonest-wt\site\website-prototype\tekpractice\jouer\*; Copy-Item -Recurse dist-site\* C:\Users\brro\dev\Tekonest-wt\site\website-prototype\tekpractice\jouer\`. Check no file > 25 MiB and the total file count < 20 000. `python C:\Users\brro\dev\Tekonest-wt\site\website-prototype\src\build.py`. In the site worktree: `& $git -C C:\Users\brro\dev\Tekonest-wt\site add -A website-prototype; & $git -C C:\Users\brro\dev\Tekonest-wt\site commit -m "deploy(tekpractice): Mode Création"; & $git -C C:\Users\brro\dev\Tekonest-wt\site push origin design/tekonest-umbrella-brand` (never force).
- [ ] **Step 4: live re-audit (council T5.2, P5).** When Cloudflare has deployed the branch (check the live `/tekpractice/jouer/` URL serves the new hashed assets), run the audit checklist of `docs/audit/2026-10-24-creative-audit.md` on the live URL at 1366×768 (Chromium): each CA-01…CA-27 → « corrigé / partiel / ouvert » with evidence (test name or observation). Live smoke: `/` shows « Choisir un lieu », the reference template plays sound after powering, `?legacy=1` and `?level=a1` work, 0 console errors.
- [ ] **Step 5: report.** Write `docs/CREATIVE-MODE-REPORT.md` (French): what shipped, the CA table with status, tests and budgets (numbers), decisions taken (S/L/C/P ids changed or confirmed), cut items, open risks, next steps for Oscar. Append « Phase 5 : done » to `docs/CREATIVE-MODE-LOG.md`.
- [ ] **Step 6: commit + push.** `& $git add docs/CREATIVE-MODE-REPORT.md docs/CREATIVE-MODE-LOG.md; & $git commit -m "docs(creation): live re-audit and final report"; & $git push origin feature/tekpractice-creative-mode`. Confirm no `vite preview` or other background process is still running.
- **Acceptance:** branch and site pushed (no force), live URL serves Mode Création, re-audit table complete, report committed. Merging to `main` is Oscar's call, not part of this plan.
