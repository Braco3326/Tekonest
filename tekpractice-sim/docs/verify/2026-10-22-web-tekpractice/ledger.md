# QA web ledger: TekPractice Explore mode (2026-10-22)

- **Driver:** Playwright Chromium headless, against the production build (`vite preview`, port 4173).
- **Script:** `tests/e2e/zz-qa-crawl.spec.ts`. It is opt-in: `QA_CRAWL=1 npx playwright test zz-qa-crawl`.
- **Scope:**
  - 8 pages: dashboard, A1 orbit, A1 explore, exam, sandbox, generated concert hall, generated radio studio, 2D board.
  - 2 viewports: 1440×900 and 390×844.
  - Light theme only (the app has no dark theme).
- **Not walked:** the qa-web skill's auth, backend and persona stages. The app has no accounts and no backend; pointer lock cannot be exercised headless.

## Checks per page

- Screenshot
- Console errors and page errors
- Visible buttons and links without an accessible name
- Horizontal overflow
- For each toolbar panel (inventory, help, settings): the dialog stays on screen, Tab stays inside it, and Esc closes it

## Results

| Pass | Findings | Fixed |
|---|---|---|
| 1st | 3 timeouts and dialog off-screen on phone (inventory) | Two of the timeouts came from the crawl itself (40 Tab presses at a few fps). The exam had no inventory button to click (by design: no inventory in the exam). |
| 2nd | Off-screen inventory on phone (sandbox, generated radio studio) | **Real bug.** The panels reused the toasts' `toast-in` keyframe, which animates `transform` and dropped the `translate(-50%, -50%)` centring during the animation, so the panel slid in from a corner. Panels now have their own keyframe, `ex-panel-in`, and an explicit stacking order (`z-index` 20, toolbar 21). |
| 3rd | **0 findings**: 16/16 page × viewport combinations clean | |

Remaining screenshots are in `screens/`; the rest were deleted to keep the repo light. `findings.jsonl` is the machine-readable output of the last pass.

## Hooks proposed for future runs

- `window.__audioSim` already acts as the QA hook (state, projections, `explore()`).
- A `?qa=1` flag that turns off animations would remove mid-animation captures.
