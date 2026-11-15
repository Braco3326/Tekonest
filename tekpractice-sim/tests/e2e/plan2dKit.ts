/**
 * Shared steps of the 2D schema page specs (plan2d-a11y, plan2d-touch): enter a design package the way a learner does, open the page from the menu, and a
 * reference plan that carries every cable type the catalogue gives a pair for (analogue balanced and unbalanced, speaker, digital, network, clock, control,
 * mains; DC has no catalogue pair), written under the page's own key.
 */
import { expect, type Locator, type Page } from '@playwright/test'
import { answerFirstQuestion, loadFresh, openNeutralRoomAfterAnswer, waitStartScreen } from './onboardingKit'

export const PRODUCT = process.env.E2E_PRODUCT_URL
export const BUILDS: { name: string; base?: string; product: boolean }[] = [{ name: 'all-on build', product: false }, ...(PRODUCT ? [{ name: 'product build', base: PRODUCT, product: true }] : [])]

/** `?design=<id>&oscar=0`: the start screen's first answer, then the neutral room (no tutorial offer, no guide). */
export async function enterDesign(page: Page, id: 1 | 2 | 3 | 4 | 5): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await loadFresh(page, `?design=${id}&oscar=0`)
  await waitStartScreen(page)
  await answerFirstQuestion(page, '1', 'click')
  const skip = page.getByRole('button', { name: 'Passer, je connais' })
  if (await skip.isVisible().catch(() => false)) await skip.click()
  await openNeutralRoomAfterAnswer(page)
}

/** Vue › « Schéma 2D » (by taps when `tap`). */
export async function openPlan(page: Page, tap = false): Promise<Locator> {
  const vue = page.getByRole('menuitem', { name: 'Vue', exact: true })
  if (tap) await vue.tap()
  else await vue.click()
  const item = page.getByRole('menuitem', { name: 'Schéma 2D' })
  await expect(item).toBeVisible()
  if (tap) await item.tap()
  else await item.click()
  const dialog = page.getByTestId('plan2d')
  // the first open fetches the page's lazy chunk and the place's data
  await expect(dialog).toBeVisible({ timeout: 20_000 })
  return dialog
}

export const RIG = {
  v: 1,
  roomId: 'blank',
  devices: [
    { id: 'yamaha-ql1-1', deviceId: 'yamaha-ql1', x: 0, z: 2, rot: 180 },
    { id: 'qsc-k12-2-1', deviceId: 'qsc-k12-2', x: 4, z: -4, rot: 0 },
    { id: 'qsc-k12-2-2', deviceId: 'qsc-k12-2', x: -4, z: -4, rot: 0 },
    { id: 'shure-sm58-1', deviceId: 'shure-sm58', x: 0, z: -4, rot: 0 },
    { id: 'crown-xti-4002-1', deviceId: 'crown-xti-4002', x: 7, z: -2, rot: 0 },
    { id: 'db-audiotechnik-y10p-1', deviceId: 'db-audiotechnik-y10p', x: 8, z: -5, rot: 0 },
    { id: 'yamaha-rio3224-d2-1', deviceId: 'yamaha-rio3224-d2', x: -2, z: -2, rot: 0 },
    { id: 'multiprise-secteur-1', deviceId: 'multiprise-secteur', x: 2, z: 4, rot: 0 },
    { id: 'axia-iq-1', deviceId: 'axia-iq', x: -8, z: 3, rot: 0 },
    { id: 'grace-m905-1', deviceId: 'grace-m905', x: -6, z: 5, rot: 0 },
    { id: 'yellowtec-litt-1', deviceId: 'yellowtec-litt', x: -10, z: 5, rot: 0 },
    { id: 'playout-pc-1', deviceId: 'playout-pc', x: 6, z: 3, rot: 0 },
    { id: 'mackie-profx12v3-1', deviceId: 'mackie-profx12v3', x: 9, z: 3, rot: 0 },
    { id: 'avid-hd-io-1', deviceId: 'avid-hd-io', x: -8, z: -3, rot: 0 },
    { id: 'mutec-mc-3-plus-1', deviceId: 'mutec-mc-3-plus', x: -10, z: -5, rot: 0 },
  ],
  cables: [
    { id: 'c1', a: { dev: 'yamaha-ql1-1', port: 'out-main-l' }, b: { dev: 'qsc-k12-2-1', port: 'in-line-a' } },
    { id: 'c2', a: { dev: 'shure-sm58-1', port: 'out-xlr' }, b: { dev: 'yamaha-ql1-1', port: 'in-mic-1' } },
    { id: 'c3', a: { dev: 'crown-xti-4002-1', port: 'out-spk-1' }, b: { dev: 'db-audiotechnik-y10p-1', port: 'bidir-nl4-1' } },
    { id: 'c4', a: { dev: 'yamaha-ql1-1', port: 'dante-primary' }, b: { dev: 'yamaha-rio3224-d2-1', port: 'dante-primary' } },
    { id: 'c5', a: { dev: 'multiprise-secteur-1', port: 'out-1' }, b: { dev: 'yamaha-ql1-1', port: 'power-in' } },
    { id: 'c6', a: { dev: 'axia-iq-1', port: 'out-program-aes' }, b: { dev: 'grace-m905-1', port: 'in-aes3' } },
    { id: 'c7', a: { dev: 'axia-iq-1', port: 'gpio' }, b: { dev: 'yellowtec-litt-1', port: 'in-gpio' } },
    { id: 'c8', a: { dev: 'playout-pc-1', port: 'out-analog-consumer' }, b: { dev: 'mackie-profx12v3-1', port: 'in-stereo-35' } },
    { id: 'c9', a: { dev: 'avid-hd-io-1', port: 'wordclock-out' }, b: { dev: 'mutec-mc-3-plus-1', port: 'in-wclk' } },
  ],
}

/** Writes `plan` under the page's own key for the place on screen (persist.ts: audio-sim/plan2d.v1.<project>@<place>). */
export async function writePlan(page: Page, plan: unknown): Promise<void> {
  await page.evaluate((p) => {
    const c = (window as unknown as { __creation: { project(): { name: string | null }; place(): string | null } }).__creation
    window.localStorage.setItem(`audio-sim/plan2d.v1.${encodeURIComponent(c.project().name ?? '')}@${encodeURIComponent(c.place() ?? '')}`, JSON.stringify(p))
  }, plan)
}
