/**
 * The layout presets of the five design packages in the browser (onboarding packs, plan T4.3, spec 7.2): the panels each package opens with, the surface style and density it
 * writes on <html>, the inventory drawer that stays open after a pose (packages 1, 2, 3) or closes after it (4, 5), the phone accordion that still wins under 760 px, and
 * « no ?design » / an exam address, where nothing of it applies. G8 review S7: with Propriétés folded (package 1) the tutorial's « dans Propriétés » steps ring the Propriétés
 * unfold toggle once the device is selected.
 *
 * Desktop first, tablet comfortable: the panels are checked at 1366 x 768, 1024 x 768 and 820 x 1180. The width rules are the shell's own upper bound (layout.ts): the tree needs
 * 760 px, Propriétés 1200 px, so a preset never opens more than the window allows.
 */
import { expect, test, type Page } from '@playwright/test'
import { DESIGN_IDS, packageById } from '../../src/design/packages'

const GUIDE_KEY = 'oscar-guide.onboarding.v1'
const root = (page: Page) => page.locator('.cr')
const drawer = (page: Page) => page.getByTestId('inventory-drawer')
const ring = (page: Page) => page.locator('.oscar-ring:not(.oscar-ring-drop)')

async function openFresh(page: Page, query: string): Promise<void> {
  await page.goto('/' + query)
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
}
/** The start screen, « je découvre » (key 1), « Passer »: the neutral room opens (and the start screen no longer covers the panels). */
async function openRoom(page: Page, id: number): Promise<void> {
  await openFresh(page, `?design=${id}`)
  await page.getByTestId('start-screen').waitFor()
  await page.keyboard.press('1')
  await page.getByRole('button', { name: 'Passer, je connais', exact: true }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
}
const panels = async (page: Page): Promise<{ tree: string | null; props: string | null }> => ({
  tree: await root(page).getAttribute('data-tree'),
  props: await root(page).getAttribute('data-props'),
})
const htmlAttr = (page: Page, name: string): Promise<string | null> => page.locator('html').getAttribute(name)

for (const vp of [
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 820, height: 1180 },
]) {
  test.describe(`panels at ${vp.width} x ${vp.height}`, () => {
    test.use({ viewport: vp })
    for (const id of DESIGN_IDS) {
      test(`package ${id} opens the panels its preset asks for, within the window's width rules, and writes its surface style and density`, async ({ page }) => {
        const pkg = packageById(id)
        await openFresh(page, `?design=${id}`)
        // the preset is the wish; the shell's width rules are the bound: the tree needs 760 px, Propriétés 1200 px (the 3D view keeps 60 %)
        const want = { tree: pkg.layout.panels.tree && vp.width >= 760, props: pkg.layout.panels.props && vp.width >= 1200 }
        expect(await panels(page)).toEqual({ tree: want.tree ? 'open' : 'collapsed', props: want.props ? 'open' : 'collapsed' })
        expect(await htmlAttr(page, 'data-surface')).toBe(pkg.layout.surfaceStyle)
        expect(await htmlAttr(page, 'data-density')).toBe(pkg.layout.density)
        expect(await htmlAttr(page, 'data-drawer')).toBe(pkg.layout.drawer)
        // the view is never squeezed under half the window by a preset
        const box = (await page.locator('.cr-viewport').boundingBox())!
        expect(box.width).toBeGreaterThanOrEqual(vp.width * 0.5)
      })
    }
  })
}

test.describe('package 2 opens both panels (1366 x 768)', () => {
  test.use({ viewport: { width: 1366, height: 768 } })
  test('Projet and Propriétés are both open, and the view still has more than half of the window', async ({ page }) => {
    await openFresh(page, '?design=2')
    expect(await panels(page)).toEqual({ tree: 'open', props: 'open' })
    await expect(page.getByTestId('tree-collapse')).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('props-collapse')).toHaveAttribute('aria-expanded', 'true')
    const box = (await page.locator('.cr-viewport').boundingBox())!
    expect(box.width).toBeGreaterThan(1366 / 2)
  })
})

test.describe('under 760 px the phone accordion still wins over any preset', () => {
  test.use({ viewport: { width: 400, height: 800 } })
  for (const id of [2, 4]) {
    test(`package ${id} (both panels wanted): in the opened room at most one panel is open, and opening one folds the other`, async ({ page }) => {
      await openRoom(page, id)
      const start = await panels(page)
      expect([start.tree, start.props].filter((s) => s === 'open').length).toBeLessThanOrEqual(1)
      await page.getByTestId('tree-collapse').click()
      expect(await panels(page)).toEqual({ tree: 'open', props: 'collapsed' })
      await page.getByTestId('props-collapse').click()
      expect(await panels(page)).toEqual({ tree: 'collapsed', props: 'open' })
    })
  }
  test('a window that narrows below 760 px with both open folds one of them (package 2)', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await openFresh(page, '?design=2')
    expect(await panels(page)).toEqual({ tree: 'open', props: 'open' })
    await page.setViewportSize({ width: 700, height: 800 })
    await expect.poll(async () => Object.values(await panels(page)).filter((s) => s === 'open').length).toBeLessThanOrEqual(1)
  })
})

test.describe('where no package applies, nothing of it does', () => {
  test.use({ viewport: { width: 1366, height: 768 } })
  for (const query of ['', '?design=1&mode=exam', '?design=2&mode=exam', '?design=3&mode=exam', '?design=4&mode=practice']) {
    test(`${query || '/ (no ?design)'}: today's panels (both open at 1366), no surface style, no density, no drawer rule, no role colours`, async ({ page }) => {
      await openFresh(page, query)
      expect(await panels(page)).toEqual({ tree: 'open', props: 'open' })
      for (const a of ['data-surface', 'data-density', 'data-drawer']) expect(await htmlAttr(page, a), a).toBeNull()
      // the role sources are the plain map (Ambre focus, panel surface): a package's colours are not written
      const role = (name: string) => page.evaluate((n) => document.documentElement.style.getPropertyValue(n), name)
      expect(await role('--cr-role-focus')).toBe('#DD9349')
      expect(await role('--cr-role-surface')).toBe('#1C191D')
      expect(await role('--cr-role-ink')).toBe('#F3EDE3')
    })
  }
})

test.describe('the inventory drawer after a pose (1366 x 768)', () => {
  test.use({ viewport: { width: 1366, height: 768 } })

  /** The neutral room opens with the profile's drawer on its first tab. */
  async function openRoomWithDrawer(page: Page, id: number): Promise<void> {
    await openRoom(page, id)
    await expect(drawer(page)).toHaveAttribute('data-open', 'true')
  }
  const chooseQl1 = async (page: Page): Promise<void> => {
    await drawer(page).locator('[data-testid="inventory-item"][data-device-id="yamaha-ql1"]').click()
    await expect(drawer(page)).toHaveAttribute('data-open', 'false')
    expect(await page.evaluate(() => window.__creation!.placing())).toBe(true)
  }
  const drop = async (page: Page): Promise<void> => {
    const box = (await page.locator('#renderCanvas').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3)
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 3)
    await expect.poll(() => page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(1)
  }

  for (const id of DESIGN_IDS) {
    const stays = packageById(id).layout.drawer === 'stay-open'
    test(`package ${id} (${stays ? 'stay-open' : 'close-after-place'}): the drawer is ${stays ? 'open again' : 'closed'} after a placement`, async ({ page }) => {
      await openRoomWithDrawer(page, id)
      await chooseQl1(page)
      await drop(page)
      await expect(drawer(page)).toHaveAttribute('data-open', stays ? 'true' : 'false')
      if (stays) {
        // it comes back without taking the focus: the 3D view keeps it (keys keep working), and the tab it showed is still the one shown
        await expect(page.locator('#renderCanvas')).toBeFocused()
        await expect(drawer(page).getByRole('tab', { selected: true })).toHaveText('Consoles')
      }
    })
  }

  test('package 1: Échap on the pose (nothing placed) brings the drawer back too, and a second device can be chosen at once', async ({ page }) => {
    await openRoomWithDrawer(page, 1)
    await chooseQl1(page)
    await page.keyboard.press('Escape')
    expect(await page.evaluate(() => window.__creation!.placing())).toBe(false)
    await expect(drawer(page)).toHaveAttribute('data-open', 'true')
    expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(0)
    await chooseQl1(page) // chosen again straight from the returned drawer
  })

  test('package 1: the drawer closed by hand stays closed after a pose that was not started from it', async ({ page }) => {
    await openRoomWithDrawer(page, 1)
    await page.getByTestId('inventory-close').click()
    await expect(drawer(page)).toHaveAttribute('data-open', 'false')
    await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'q', position: [0, 0, 0], rotationY: 0 }))
    await page.waitForTimeout(300)
    await expect(drawer(page)).toHaveAttribute('data-open', 'false')
  })
})

test.describe('G8 review S7: Propriétés folded (package 1), the « dans Propriétés » steps ring the unfold toggle (1366 x 768)', () => {
  test.use({ viewport: { width: 1366, height: 768 } })
  const act = (page: Page, intents: unknown[]) =>
    page.evaluate((list) => {
      for (const i of list) if (!window.__creation!.dispatch(i as never).ok) throw new Error('refused: ' + JSON.stringify(i))
    }, intents)
  const spawn = (deviceId: string, instanceId: string, x: number) => ({ type: 'SPAWN', deviceId, instanceId, position: [x, 0, 0], rotationY: 0 })
  const connect = (a: string, ap: string, b: string, bp: string) => ({ type: 'CONNECT', a: { instance: a, port: ap }, b: { instance: b, port: bp } })

  /** The ring's centre comes to rest inside the target. */
  const centreInside = async (page: Page, selector: string): Promise<void> => {
    await expect
      .poll(
        async () => {
          const r = await ring(page).boundingBox()
          const t = await page.locator(selector).boundingBox()
          if (!r || !t) return false
          const cx = r.x + r.width / 2
          const cy = r.y + r.height / 2
          return cx >= t.x - 2 && cx <= t.x + t.width + 2 && cy >= t.y - 2 && cy <= t.y + t.height + 2
        },
        { timeout: 6_000 },
      )
      .toBe(true)
  }
  async function takeTutorial(page: Page): Promise<void> {
    await openFresh(page, '?design=1')
    await page.getByTestId('start-screen').getByRole('button', { name: 'Je découvre', exact: true }).click()
    await page.getByTestId('start-screen').getByRole('button', { name: /^Faire le tutoriel/ }).click()
    await page.waitForFunction(() => window.__creation?.place() === 'blank')
  }
  const UNFOLD = '.cr[data-props="collapsed"] [data-testid="props-collapse"]'

  test('step 4 (connect): the console is ringed while not selected, the unfold toggle once it is selected, the « Connecter à… » button once Propriétés is unfolded', async ({ page }) => {
    await takeTutorial(page)
    expect((await panels(page)).props).toBe('collapsed')
    await act(page, [spawn('yamaha-ql1', 'ql1', 0), spawn('shure-sm58', 'sm58', 0.8), spawn('qsc-k12-2', 'k12', -1)])
    await expect(page.locator('.oscar-live')).toContainText('étape 4 sur 10', { timeout: 10_000 })
    await expect(ring(page)).toBeVisible()
    await page.evaluate(() => window.__creation!.frameDevice('ql1'))
    await centreInside(page, UNFOLD)
    // the learner unfolds Propriétés: the ring moves to the button the step names
    await page.getByTestId('props-collapse').click()
    // (the « Connecter à… » rows are far down Propriétés' one scroller at 768 px high: scroll the button into view, the ring follows it as it always has)
    await page.locator('[data-testid="properties-content"] [data-key="connect:out-main-l"]').scrollIntoViewIfNeeded()
    await centreInside(page, '[data-testid="properties-content"] [data-key="connect:out-main-l"]')
  })

  test('step 6 (Lecture console): the console selected and Propriétés folded, the ring is on the unfold toggle; unfolded, on the toggle row', async ({ page }) => {
    await takeTutorial(page)
    await act(page, [
      spawn('yamaha-ql1', 'ql1', 0),
      spawn('shure-sm58', 'sm58', 0.8),
      spawn('qsc-k12-2', 'k12', -1),
      connect('ql1', 'out-main-l', 'k12', 'in-line-a'),
      connect('sm58', 'out-xlr', 'ql1', 'in-mic-1'),
    ])
    await expect(page.locator('.oscar-live')).toContainText('étape 6 sur 10', { timeout: 10_000 })
    await page.evaluate(() => window.__creation!.frameDevice('ql1'))
    await centreInside(page, UNFOLD)
    await page.getByTestId('props-collapse').click()
    await centreInside(page, '[data-testid="properties-content"] [data-key="ctl:playback-usb"]')
    expect(await page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? 'null')?.status, GUIDE_KEY)).toBe('running')
  })
})
