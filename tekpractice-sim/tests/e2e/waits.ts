/**
 * Shared waits for the Mode Création specs (night wave 1, item 10). A spec waits for a STATE (`expect.poll`, `waitForFunction`, a web-first
 * assertion), never for a number of milliseconds standing in for one. Two things are left that are about time itself, and each is named here:
 *
 *  - a QUIET WINDOW: the test measures that nothing happens for `ms` after a stimulus (no render, no worker job, no toast, no request, no
 *    restart). `quietWindow` is the one place; the call site says what would have happened inside the window.
 *  - a SAMPLING PERIOD: the number of frames or events inside a window is the quantity read (`waitRendersIdle`, the `settle` loops).
 *
 * The screenshot specs (`*-screens.spec.ts`, skipped unless a flag is set) pace their captures with fixed delays: they assert nothing.
 */
import { expect, type Page } from '@playwright/test'

/** « 0 renders in 2 s » is the idle gate (Task 21): the window the idle assertions measure. */
export const IDLE_WINDOW_MS = 2000
/** The shorter window of the look specs (the selection stroke costs no idle frame). */
export const IDLE_WINDOW_SHORT_MS = 1500
/** The `settle` loops compare the render counter at this period until two samples are equal (models and shaders land late). */
export const SETTLE_SAMPLE_MS = 700
/** `waitRendersIdle` counts frames over windows of this length. */
export const IDLE_SAMPLE_MS = 250

/** A deliberate quiet window: asserts that NOTHING happens for `ms` after a stimulus. Never a wait for something to appear (that is `expect.poll`). */
export const quietWindow = (page: Page, ms: number): Promise<void> => page.waitForTimeout(ms)

/** Waits until the page draws no frame over a sample window (state: idle), instead of sleeping a guessed time before a baseline is read. */
export async function waitRendersIdle(page: Page, timeout = 15_000): Promise<void> {
  await expect
    .poll(
      async () => {
        const a = await page.evaluate(() => window.__creation!.renders())
        await page.waitForTimeout(IDLE_SAMPLE_MS)
        return (await page.evaluate(() => window.__creation!.renders())) - a
      },
      { timeout }
    )
    .toBe(0)
}

/**
 * Baseline settle for a spec that loads gear: the .glb models arrive after the placeholders and move the ports, so wait until the render counter holds still over two samples
 * of `SETTLE_SAMPLE_MS` (the specs used to carry five copies of this loop; night 2 wave 4, item 6). A state wait, not a guessed time: it returns the moment the page is idle.
 */
export async function settleRenders(page: Page): Promise<void> {
  let last = -1
  for (let i = 0; i < 40; i++) {
    const n = await page.evaluate(() => window.__creation!.renders())
    if (n === last) return
    last = n
    await page.waitForTimeout(SETTLE_SAMPLE_MS)
  }
  throw new Error('the page never went idle')
}

export const AUTOSAVE_KEY = 'audio-sim/creation.v1'

/** Waits until the autosave in storage holds the design on screen (the debounce has fired and the write landed), instead of sleeping past the debounce. */
export async function waitForAutosave(page: Page, timeout = 10_000): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate((key) => {
          const raw = localStorage.getItem(key)
          if (!raw) return false
          const canon = (v: unknown): unknown =>
            Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v
          try {
            const stored = (JSON.parse(raw) as { design?: unknown }).design
            return JSON.stringify(canon(stored)) === JSON.stringify(canon(JSON.parse(JSON.stringify(window.__creation!.design()))))
          } catch {
            return false
          }
        }, AUTOSAVE_KEY),
      { timeout }
    )
    .toBe(true)
}
