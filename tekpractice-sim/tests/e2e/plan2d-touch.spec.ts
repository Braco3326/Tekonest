/**
 * Mission 2 review (2026-11-15): the whole 2D schema flow by TOUCH only, on a phone (390 x 844, hasTouch, isMobile), design 2. Real touch input through the
 * Chrome DevTools protocol (Input.dispatchTouchEvent: the browser makes the pointer events of type « touch », and applies touch-action and scrolling as a finger
 * would), never synthetic DOM events:
 *  - open from the menu by taps; the empty plan says why the send is off in words (no hover);
 *  - place a console and a speaker from the palette by taps; move the speaker with a one-finger drag on the plan, the page not scrolling under it;
 *  - a two-finger pinch zooms the plan and keeps the selection;
 *  - tap, tap again: the rear panel; tap a free output (the cable is held); tap the speaker: its rear panel with lit and dimmed ports; tap the lit input;
 *  - back on the plan, tap the cable, remove it with the on-screen « Retirer le câble »; cable it again; « Envoyer dans la scène 3D » and « Ajouter » by taps;
 *  - every control of the page on screen is at least 44 x 44 px.
 */
import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test'
import { BUILDS, enterDesign, openPlan } from './plan2dKit'

type Pt = { x: number; y: number }
const centre = async (l: Locator): Promise<Pt> => {
  const b = (await l.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
const touch = (cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', pts: Pt[]) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: Math.round(p.x), y: Math.round(p.y), id: i, radiusX: 4, radiusY: 4, force: 1 })) })

/** A one-finger drag from a to b in `steps` moves. */
async function drag(cdp: CDPSession, a: Pt, b: Pt, steps = 12): Promise<void> {
  await touch(cdp, 'touchStart', [a])
  for (let i = 1; i <= steps; i++) await touch(cdp, 'touchMove', [{ x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps }])
  await touch(cdp, 'touchEnd', [])
}

/** The visible controls of the page smaller than 44 px (HTML controls; the plan's SVG hit areas are measured separately). */
const smallControls = (page: Page) =>
  page.evaluate(() => {
    const box = document.querySelector('[data-testid="plan2d"]')!
    const out: string[] = []
    for (const el of box.querySelectorAll<HTMLElement>('button, input, select, [role="button"]:not(g)')) {
      if (el.closest('[hidden], [inert]') || el.dataset.sentinel !== undefined) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.bottom < 0 || r.top > innerHeight) continue
      if (r.width < 44 || r.height < 44) out.push(`${el.tagName.toLowerCase()} « ${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)} » ${Math.round(r.width)}x${Math.round(r.height)}`)
    }
    return out
  })

for (const build of BUILDS) {
  test.describe(build.name, () => {
    if (build.base) test.use({ baseURL: build.base })
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
    test.describe.configure({ timeout: 180_000 })

    test('the whole flow by taps and touch drags on a phone; every control >= 44 px; a drag or a pinch on the plan never scrolls the page nor loses the selection', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(String(e)))
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text())
      })
      await enterDesign(page, 2)
      const cdp = await page.context().newCDPSession(page)
      const dialog = await openPlan(page, true)
      // no hover-only affordance: the empty plan says in words why the send is off
      await expect(dialog.getByRole('button', { name: 'Envoyer dans la scène 3D' })).toBeDisabled()
      await expect(dialog.getByText('Plan vide : rien à envoyer dans la scène 3D.')).toBeVisible()
      // the page has no horizontal scroll
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
      expect(await dialog.evaluate((d) => d.scrollWidth <= d.clientWidth)).toBe(true)
      expect(await smallControls(page), 'controls under 44 px (first screen)').toEqual([])

      // place by taps: the console, then the speaker (the search field is tapped and typed in, as with the on-screen keyboard)
      await dialog.getByRole('button', { name: 'Poser Yamaha QL1 sur le plan' }).tap()
      await expect(dialog.locator('[data-dev="yamaha-ql1-1"]')).toHaveCount(1)
      await dialog.getByRole('searchbox', { name: 'Rechercher un appareil' }).tap()
      await dialog.getByRole('searchbox', { name: 'Rechercher un appareil' }).fill('k12')
      await dialog.getByRole('button', { name: 'Poser QSC K12.2 sur le plan' }).tap()
      const k12 = dialog.locator('[data-dev="qsc-k12-2-1"]')
      await expect(k12).toHaveCount(1)
      await expect(k12).toHaveAttribute('aria-pressed', 'true')

      // a one-finger drag moves the speaker; the page under the plan does not scroll
      const plan = dialog.getByTestId('plan2d-plan')
      await plan.scrollIntoViewIfNeeded()
      const scroll0 = await dialog.evaluate((d) => d.scrollTop)
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('audio-sim/plan2d.v1.'))!)!).devices[1] as { x: number; z: number })
      const from = await centre(k12.locator('.p2d-hit'))
      await drag(cdp, from, { x: from.x, y: from.y + 40 })
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('audio-sim/plan2d.v1.'))!)!).devices[1].z as number)).toBeGreaterThan(before.z)
      expect(await dialog.evaluate((d) => d.scrollTop), 'the drag on the plan did not scroll the page').toBe(scroll0)
      await expect(k12).toHaveAttribute('aria-pressed', 'true')

      // a two-finger pinch zooms (the scale bar changes) and keeps the selection
      const bar0 = await dialog.locator('.p2d-scalebar text').textContent()
      const c = await centre(plan)
      await touch(cdp, 'touchStart', [{ x: c.x - 30, y: c.y }, { x: c.x + 30, y: c.y }])
      for (let i = 1; i <= 10; i++) await touch(cdp, 'touchMove', [{ x: c.x - 30 - i * 10, y: c.y }, { x: c.x + 30 + i * 10, y: c.y }])
      await touch(cdp, 'touchEnd', [])
      await expect(dialog.locator('.p2d-scalebar text')).not.toHaveText(bar0!)
      await expect(k12).toHaveAttribute('aria-pressed', 'true')
      expect(await dialog.evaluate((d) => d.scrollTop), 'the pinch did not scroll the page').toBe(scroll0)
      // the plan's hit areas are touch sized
      const hit = (await k12.locator('.p2d-hit').boundingBox())!
      expect(Math.min(hit.width, hit.height), 'a device hit area').toBeGreaterThanOrEqual(44)

      // back to the whole place (the pinch zoomed in), by its button
      await dialog.getByRole('button', { name: 'Ajuster au lieu' }).tap()
      // the console: tap selects, a second tap flips it to its rear panel; tap a free output: the cable is held
      const ql1 = dialog.locator('[data-dev="yamaha-ql1-1"] .p2d-hit')
      await ql1.tap()
      await ql1.tap()
      const rear = dialog.getByTestId('plan2d-rear')
      await expect(rear).toBeVisible()
      expect(await smallControls(page), 'controls under 44 px (rear panel)').toEqual([])
      await rear.locator('[data-port="out-main-l"]').tap()
      await expect(rear).toBeHidden()
      // while a cable is held, the plan offers « Lâcher le câble » on screen (no Échap on a phone)
      await expect(dialog.getByTestId('plan2d-act-drop')).toBeVisible()
      // the speaker: one tap flips it with its ports lit and dimmed, the reason in words
      await k12.locator('.p2d-hit').tap()
      await expect(rear).toBeVisible()
      await expect(rear.locator('[data-port="in-line-a"]')).toHaveAttribute('data-state', 'lit')
      await expect(rear.locator('[data-port="power-in"] .p2d-port-why')).toBeVisible()
      await rear.locator('[data-port="in-line-a"]').tap()
      await expect(rear).toBeHidden()
      const cable = dialog.locator('[data-cable="c1"]')
      await expect(cable).toHaveCount(1)

      // tap the cable (its tag), remove it with the on-screen control
      await cable.locator('.p2d-tag-bg').tap()
      await expect(cable).toHaveAttribute('aria-pressed', 'true')
      const remove = dialog.getByRole('button', { name: 'Retirer le câble' })
      await expect(remove).toBeVisible()
      expect(await smallControls(page), 'controls under 44 px (cable selected)').toEqual([])
      await remove.tap()
      await expect(dialog.locator('[data-cable]')).toHaveCount(0)

      // cable it again, then send by taps
      await ql1.tap()
      await ql1.tap()
      await rear.locator('[data-port="out-main-l"]').tap()
      await k12.locator('.p2d-hit').tap()
      await rear.locator('[data-port="in-line-a"]').tap()
      await expect(dialog.locator('[data-cable]')).toHaveCount(1)
      const send = dialog.getByRole('button', { name: 'Envoyer dans la scène 3D' })
      await send.scrollIntoViewIfNeeded()
      await send.tap()
      const confirm = page.getByTestId('plan2d-spawn-dialog')
      await expect(confirm).toBeVisible()
      for (const b of await confirm.getByRole('button').all()) {
        const r = (await b.boundingBox())!
        expect(Math.min(r.width, r.height), `confirmation button ${await b.textContent()}`).toBeGreaterThanOrEqual(44)
      }
      await confirm.getByRole('button', { name: 'Ajouter' }).tap()
      await expect(dialog.getByTestId('plan2d-report')).toContainText('Ajoutés dans la scène 3D : 2 appareils et 1 câble')
      // mission 3 fixes, item 3: a phone has no Ctrl key: the report names the « Annuler » command of the 3D view
      await expect(dialog.getByTestId('plan2d-report')).toContainText('aux mêmes places. « Annuler » (menu Projet) dans la scène 3D les retire en une fois.')
      await expect(dialog.getByTestId('plan2d-report')).not.toContainText('Ctrl')
      const sent = await page.evaluate(() => (window as unknown as { __creation: { design(): { rig: { instances: unknown[]; connections: unknown[] } } } }).__creation.design().rig)
      expect(sent.instances).toHaveLength(2)
      expect(sent.connections).toHaveLength(1)
      const show = dialog.getByRole('button', { name: 'Voir la scène 3D' })
      await show.scrollIntoViewIfNeeded()
      await show.tap()
      await expect(dialog).toHaveCount(0)
      // mission 3 fixes, item 3: in the 3D view (the first new device is selected), Matériel › Pivoter by taps: the status line names « Annuler », not Ctrl+Z
      await page.getByRole('menuitem', { name: 'Matériel', exact: true }).tap()
      await page.getByRole('menuitem', { name: /^Pivoter/ }).first().tap()
      const status = page.locator('.cr-status-msg')
      await expect(status).toContainText('« Annuler » (menu Projet) pour revenir en arrière.')
      await expect(status).not.toContainText('Ctrl')
      expect(errors, 'console errors').toEqual([])
    })

    test('mission 3 fixes, item 1: a finger drags a speaker past the wall: red hatched outline and « hors de la salle » while it is out, said politely; dragged back, all gone; never clamped', async ({ page }) => {
      await enterDesign(page, 2)
      const cdp = await page.context().newCDPSession(page)
      const dialog = await openPlan(page, true)
      await dialog.getByRole('searchbox', { name: 'Rechercher un appareil' }).tap()
      await dialog.getByRole('searchbox', { name: 'Rechercher un appareil' }).fill('k12')
      await dialog.getByRole('button', { name: 'Poser QSC K12.2 sur le plan' }).tap()
      const k12 = dialog.locator('[data-dev="qsc-k12-2-1"]')
      await expect(k12).toHaveCount(1)
      const plan = dialog.getByTestId('plan2d-plan')
      await plan.scrollIntoViewIfNeeded()
      // the blank room is 24 m wide: the screen's left is world +x; drag the speaker 12.5 m to the left (its footprint past the +x wall at 12 m)
      const scale = await plan.evaluate((svg) => {
        const g = svg.querySelector('.p2d-grid line:nth-child(1)')!
        const h = svg.querySelector('.p2d-grid line:nth-child(2)')!
        return Math.abs(Number(h.getAttribute('x1')) - Number(g.getAttribute('x1')))
      })
      const from = await centre(k12.locator('.p2d-hit'))
      const to = { x: from.x - 12.5 * scale, y: from.y }
      await touch(cdp, 'touchStart', [from])
      for (let i = 1; i <= 12; i++) await touch(cdp, 'touchMove', [{ x: from.x + ((to.x - from.x) * i) / 12, y: from.y }])
      // still under the finger: the cue is there before anything is committed
      await expect(k12).toHaveClass(/p2d-outside/)
      await expect(k12.locator('.p2d-out-label')).toHaveText('hors de la salle')
      await touch(cdp, 'touchEnd', [])
      await expect(k12).toHaveClass(/p2d-outside/)
      await expect(k12.locator('.p2d-out-edge')).toHaveCount(1)
      await expect(k12).toHaveAttribute('aria-label', /, hors de la salle$/)
      await expect(dialog.getByTestId('plan2d-live')).toHaveText('Appareils déplacés : 1. K12.2 (qsc-k12-2-1) : hors de la salle.')
      const x = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('audio-sim/plan2d.v1.'))!)!).devices[0].x as number)
      expect(x, 'not clamped: it stays where the finger left it').toBeGreaterThan(12)
      // and back in
      const back = await centre(k12.locator('.p2d-hit'))
      await drag(cdp, back, from)
      await expect(k12).not.toHaveClass(/p2d-outside/)
      await expect(k12.locator('.p2d-out-label')).toHaveCount(0)
      await expect(dialog.getByTestId('plan2d-live')).toHaveText('Appareils déplacés : 1. K12.2 (qsc-k12-2-1) : de nouveau dans la salle.')
    })
  })
}
