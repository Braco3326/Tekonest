/**
 * Sandbox v1 (Beat 3, ADR-0004): guided shelves for a fresh learner, dynamic
 * spawn through SPAWN intents, live rules that still teach, mistakes feeding
 * the readiness store, named rig save.
 */
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/?level=sandbox')
  await page.waitForFunction(() => !!window.__audioSim)
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!window.__audioSim)
})

test('fresh learner gets the GUIDED palette (3 items + brief)', async ({ page }) => {
  await expect(page.locator('#hud-shelf')).toBeVisible()
  await expect(page.locator('.shelf-brief')).toContainText('Palette guidée')
  await expect(page.locator('.shelf-item')).toHaveCount(3)
})

test('spawn via shelves → wire → the rules still teach → readiness records it', async ({ page }) => {
  await page.locator('.shelf-item[data-device="shure-sm58"]').click()
  await page.locator('.shelf-item[data-device="yamaha-rio3224-d2"]').click()
  await page.locator('.shelf-item[data-device="yamaha-ql1"]').click()

  // Deterministic sandbox ids: <deviceId>-s<n> in click order.
  const good = await page.evaluate(() =>
    window.__audioSim!.canConnect(
      { instance: 'shure-sm58-s1', port: 'out-xlr' },
      { instance: 'yamaha-rio3224-d2-s2', port: 'in-mic-1' },
    ),
  )
  expect(good.ok).toBe(true)

  // A wrong drop still teaches (sandbox = same rules, hints ON)
  await page.evaluate(() => {
    window.__audioSim!.dispatch({
      type: 'CONNECT',
      a: { instance: 'shure-sm58-s1', port: 'out-xlr' },
      b: { instance: 'yamaha-ql1-s3', port: 'out-main-l' },
    })
  })
  await expect(page.locator('.toast-error strong')).toHaveText('Direction mismatch')

  // …and the mistake lands in the store under "sandbox" (play = assessment)
  const recorded = await page.evaluate(() => {
    const raw = window.localStorage.getItem('audio-sim/progress')
    return raw ? JSON.parse(raw).levels.sandbox?.mistakes?.length : 0
  })
  expect(recorded).toBeGreaterThanOrEqual(1)
})

test('a named rig can be saved', async ({ page }) => {
  await page.locator('.shelf-item[data-device="shure-sm58"]').click()
  await page.locator('#rig-name').fill('Mon premier rig')
  await page.locator('#rig-save').click()
  await expect(page.locator('#rig-saved')).toHaveText('Montage « Mon premier rig » enregistré.')
  // rigs v2 (ADR-0012 Décision 9): new key, the v1 key is never written
  const rigs = await page.evaluate(() => JSON.parse(window.localStorage.getItem('audio-sim/rigs.v2')!))
  expect(rigs.version).toBe(2)
  expect(rigs.rigs[0].name).toBe('Mon premier rig')
  expect(rigs.rigs[0].roomId).toBeNull()
  expect(rigs.rigs[0].instances[0].deviceId).toBe('shure-sm58')
  expect(await page.evaluate(() => window.localStorage.getItem('audio-sim/rigs'))).toBeNull()
  // the list refreshes without a reload
  await expect(page.locator('.shelf-rig', { hasText: 'Mon premier rig' })).toBeVisible()
})

test('same name → in-page confirm (rename focused); Replace overwrites, Cancel keeps', async ({ page }) => {
  await page.locator('.shelf-item[data-device="shure-sm58"]').click()
  await page.locator('#rig-name').fill('Doublon')
  await page.locator('#rig-save').click()
  const first = await page.evaluate(() => window.localStorage.getItem('audio-sim/rigs.v2'))

  await page.locator('.shelf-item[data-device="yamaha-ql1"]').click()
  await page.locator('#rig-save').click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Un montage porte déjà ce nom.')
  await expect(dialog).toContainText('Remplacer « Doublon » ? L\'ancienne version sera perdue.')
  await expect(page.locator('#rig-ow-rename')).toBeFocused()
  await page.locator('#rig-ow-cancel').click()
  await expect(dialog).toBeHidden()
  expect(await page.evaluate(() => window.localStorage.getItem('audio-sim/rigs.v2'))).toBe(first)

  await page.locator('#rig-save').click()
  await page.getByRole('button', { name: 'Remplacer', exact: true }).click()
  await expect(page.locator('#rig-saved')).toHaveText('Montage « Doublon » remplacé.')
  const rigs = await page.evaluate(() => JSON.parse(window.localStorage.getItem('audio-sim/rigs.v2')!).rigs)
  expect(rigs).toHaveLength(1)
  expect(rigs[0].instances).toHaveLength(2)
})

test('overwrite dialog: Tab is trapped, Esc = Annuler (camera untouched, data byte-identical)', async ({ page }) => {
  await page.locator('.shelf-item[data-device="shure-sm58"]').click()
  await page.locator('#rig-name').fill('Esc')
  await page.locator('#rig-save').click()
  await page.locator('#rig-save').click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  await expect(page.locator('#rig-ow-rename')).toBeFocused()

  // Tab cycles the 3 buttons only
  await page.keyboard.press('Tab')
  await expect(page.locator('#rig-ow-cancel')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('#rig-ow-replace')).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.locator('#rig-ow-cancel')).toBeFocused()

  const snap = () =>
    page.evaluate(() => {
      const sim = window.__audioSim!
      const ex = sim.explore?.()
      return JSON.stringify({ camera: sim.camera(), view: sim.view(), explore: ex ? { ...ex } : null })
    })
  const before = await snap()
  const data = await page.evaluate(() => window.localStorage.getItem('audio-sim/rigs.v2'))

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.locator('#rig-save')).toBeFocused()
  expect(await snap()).toBe(before)
  expect(await page.evaluate(() => window.localStorage.getItem('audio-sim/rigs.v2'))).toBe(data)
})

test('loading a rig that is no longer stored shows the failure notice', async ({ page }) => {
  await page.locator('.shelf-item[data-device="shure-sm58"]').click()
  await page.locator('#rig-name').fill('Fantôme')
  await page.locator('#rig-save').click()
  // another tab / an old build removes it behind the shelf's back
  await page.evaluate(() => window.localStorage.setItem('audio-sim/rigs.v2', JSON.stringify({ version: 2, rigs: [] })))
  await page.locator('.shelf-rig', { hasText: 'Fantôme' }).click()
  await expect(page.locator('.toast-warning')).toContainText('Le montage « Fantôme » est introuvable dans ce navigateur.')
})

test('save → reload → load: positions restored within ±1 cm', async ({ page }) => {
  const placed: Record<string, [number, number, number]> = {
    'shure-sm58-s1': [1.234, 0, -0.875],
    'yamaha-ql1-s2': [-1.15, 0, 0.62],
  }
  await page.evaluate(() => {
    const sim = window.__audioSim!
    sim.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', position: [1.234, 0, -0.875], rotationY: 30 })
    sim.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', position: [-1.15, 0, 0.62], rotationY: -90 })
  })
  const before = await page.evaluate(
    (ids) => Object.fromEntries(ids.map((id) => [id, window.__audioSim!.pose!(id)])),
    Object.keys(placed),
  )
  await page.locator('#rig-name').fill('Placé')
  await page.locator('#rig-save').click()
  await expect(page.locator('#rig-saved')).toBeVisible()

  await page.reload()
  await page.waitForFunction(() => !!window.__audioSim)
  await page.locator('.shelf-rig', { hasText: 'Placé' }).click()
  await expect.poll(() => page.evaluate(() => window.__audioSim!.pose!('yamaha-ql1-s2') !== null)).toBe(true)
  const after = await page.evaluate(
    (ids) => Object.fromEntries(ids.map((id) => [id, window.__audioSim!.pose!(id)])),
    Object.keys(placed),
  )
  for (const id of Object.keys(placed)) {
    const b = before[id]!
    const a = after[id]!
    expect(a).not.toBeNull()
    for (let k = 0; k < 3; k++) expect(Math.abs(a.position[k] - b.position[k])).toBeLessThanOrEqual(0.01)
    expect(a.rotationY).toBe(b.rotationY)
  }
  // and the spawn request itself was honoured in x/z (the floor sets y)
  expect(Math.abs(after['shure-sm58-s1']!.position[0] - 1.234)).toBeLessThanOrEqual(0.01)
  expect(Math.abs(after['shure-sm58-s1']!.position[2] - -0.875)).toBeLessThanOrEqual(0.01)
})

test('a v1 rig file is copied to v2 on first load (v1 kept) and the learner is told', async ({ page }) => {
  const v1 = JSON.stringify({
    version: 1,
    rigs: [{ name: 'Ancien rig', savedAt: '2026-01-01T00:00:00Z', instances: [{ instanceId: 'shure-sm58-s1', deviceId: 'shure-sm58' }], connections: [], controls: {} }],
  })
  await page.evaluate((raw) => window.localStorage.setItem('audio-sim/rigs', raw), v1)
  await page.reload()
  await page.waitForFunction(() => !!window.__audioSim)
  await expect(page.locator('.shelf-rig-notice')).toHaveText(
    'Vos montages enregistrés ont été copiés vers le nouveau format. Les anciens sont conservés.',
  )
  await expect(page.locator('.shelf-rig', { hasText: 'Ancien rig' })).toBeVisible()
  expect(await page.evaluate(() => window.localStorage.getItem('audio-sim/rigs'))).toBe(v1)
  const v2 = await page.evaluate(() => JSON.parse(window.localStorage.getItem('audio-sim/rigs.v2')!))
  expect(v2.rigs[0]).toMatchObject({ name: 'Ancien rig', roomId: null })
})

test('a saved rig reloads: instances, cables and readiness credit (ADR-0005)', async ({ page }) => {
  // build a 2-connection clean rig
  for (const id of ['shure-sm58', 'yamaha-rio3224-d2', 'yamaha-ql1'])
    await page.locator(`.shelf-item[data-device="${id}"]`).click()
  await page.evaluate(() => {
    const sim = window.__audioSim!
    sim.dispatch({
      type: 'CONNECT',
      a: { instance: 'shure-sm58-s1', port: 'out-xlr' },
      b: { instance: 'yamaha-rio3224-d2-s2', port: 'in-mic-1' },
    })
    sim.dispatch({
      type: 'CONNECT',
      a: { instance: 'yamaha-rio3224-d2-s2', port: 'dante-primary' },
      b: { instance: 'yamaha-ql1-s3', port: 'dante-primary' },
    })
  })
  await page.locator('#rig-name').fill('Plateau simple')
  await page.locator('#rig-save').click()
  await expect(page.locator('.toast-info')).toContainText('Rig propre')
  const wins = await page.evaluate(
    () => JSON.parse(window.localStorage.getItem('audio-sim/progress')!).levels.sandbox.wins,
  )
  expect(wins).toBe(1)

  // fresh page → the rig list shows it → load → the wiring is back
  await page.reload()
  await page.waitForFunction(() => !!window.__audioSim)
  await page.locator('.shelf-rig', { hasText: 'Plateau simple' }).click()
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const r = window.__audioSim!.canConnect(
          { instance: 'yamaha-ql1-s3', port: 'dante-primary' },
          { instance: 'yamaha-rio3224-d2-s2', port: 'dante-primary' },
        )
        return r.ok ? 'free' : (r as { code: string }).code
      }),
    )
    .toBe('PORT_OCCUPIED') // the reloaded cable occupies the port again
})
