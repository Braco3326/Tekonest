import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import manifest from '../../public/assets/ASSET_MANIFEST.json'

/**
 * Night 3 (L43): no request for a 3D model that does not exist. The multiprise (multiprise-secteur) never had a .glb: the spawner used to ask for
 * assets/multiprise-secteur.glb anyway and keep the placeholder box when it failed, a visible `404` console line since the site got a real 404 page.
 *
 * Oracles: every request and response of the page is recorded (not the app's own counters). A `.glb` request must name a manifest `ok` id; none may
 * answer 404; no console error may come from a resource load; and a device with a model still loads (its file answers 200, pendingModels reaches 0).
 */
test.use({ viewport: { width: 1366, height: 768 } })

const SHIPPED = new Set((manifest as { assets: { id: string; status: string }[] }).assets.filter((a) => a.status === 'ok').map((a) => a.id))
const glbId = (url: string): string | null => /\/assets\/([^/?#]+)\.glb(?:[?#]|$)/.exec(url)?.[1] ?? null

interface Trace {
  glbRequests: string[]
  glbResponses: { id: string; status: number }[]
  notFound: string[]
  consoleErrors: string[]
}
function trace(page: Page): Trace {
  const t: Trace = { glbRequests: [], glbResponses: [], notFound: [], consoleErrors: [] }
  page.on('request', (r) => {
    const id = glbId(r.url())
    if (id) t.glbRequests.push(id)
  })
  page.on('response', (r) => {
    const id = glbId(r.url())
    if (id) t.glbResponses.push({ id, status: r.status() })
    if (r.status() === 404) t.notFound.push(r.url())
  })
  page.on('console', (m) => m.type() === 'error' && t.consoleErrors.push(m.text()))
  page.on('pageerror', (e) => t.consoleErrors.push(e.message))
  return t
}

/** What the page did must be clean: only shipped models asked for, all answered 200, nothing 404, no resource-load console error. */
function expectClean(t: Trace): void {
  expect(t.glbRequests.filter((id) => !SHIPPED.has(id))).toEqual([])
  expect(t.glbRequests).not.toContain('multiprise-secteur')
  expect(t.glbResponses.filter((r) => r.status !== 200)).toEqual([])
  expect(t.notFound).toEqual([])
  expect(t.consoleErrors.filter((e) => /Failed to load resource|404/.test(e))).toEqual([])
  expect(t.consoleErrors).toEqual([])
}

test('Mode Création, « Concert simple (référence) »: the multiprise is a placeholder box and no file is asked for it; the other devices load', async ({ page }) => {
  const t = trace(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.design().rig.instances.length === 5)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  await page.waitForTimeout(500) // a late request or console line would show here

  const ids = await page.evaluate(() => window.__creation!.design().rig.instances.map((i) => i.deviceId))
  expect(ids).toContain('multiprise-secteur')
  expectClean(t)
  // devices with a model: their file was asked for and answered 200 (the recorded response, not an app counter)
  expect(t.glbResponses.find((r) => r.id === 'yamaha-ql1')?.status).toBe(200)
  expect(t.glbResponses.find((r) => r.id === 'qsc-k12-2')?.status).toBe(200)
  // the multiprise still has its placeholder box (a body to pick and to frame)
  expect(await page.evaluate(() => window.__creation!.bodyBoundsInRoot('mains'))).not.toBeNull()
  // and a model-backed device has its body
  expect(await page.evaluate(() => window.__creation!.bodyBoundsInRoot('ql1'))).not.toBeNull()
})

test('legacy level A1: only shipped models are asked for, all answer 200, no console error', async ({ page }) => {
  const t = trace(page)
  await page.goto('/?level=a1')
  await page.waitForFunction(() => !!window.__audioSim)
  await page.waitForFunction(
    () => window.__audioSim!.assets().length > 0 && window.__audioSim!.assets().every((a) => a.status === 'glb' || a.status === 'placeholder'),
  )
  await page.waitForTimeout(500)
  const assets = await page.evaluate(() => window.__audioSim!.assets())
  expect(assets.some((a) => a.status === 'glb')).toBe(true) // models still load
  expectClean(t)
  for (const a of assets.filter((x) => x.status === 'glb')) expect(t.glbResponses.find((r) => r.id === a.deviceId)?.status).toBe(200)
})

test('legacy sandbox: a device spawned from the shelf loads its model, no unshipped file is asked for', async ({ page }) => {
  const t = trace(page)
  await page.goto('/?level=sandbox')
  await page.waitForFunction(() => !!window.__audioSim)
  await page.locator('.shelf-item[data-device="yamaha-ql1"]').click()
  await page.waitForFunction(() => window.__audioSim!.assets().some((a) => a.deviceId === 'yamaha-ql1' && a.status === 'glb'))
  await page.waitForTimeout(500)
  expectClean(t)
  expect(t.glbResponses.find((r) => r.id === 'yamaha-ql1')?.status).toBe(200)
})

/**
 * Bêta proposals (content/proposals/catalog-proposals.json, « non vérifié ») are spawned by the same DeviceSpawner.tryLoadModel: they have no glb either,
 * so placing one from the drawer's « Bêta » tab must not ask for `<betaId>.glb`. Their placeholder box, their « non vérifié » mark and the Bêta badge stay.
 */
test('Mode Création, a Bêta device placed from the drawer: no file asked for it, no 404, no console error; the placeholder box and the « non vérifié » marks stay', async ({ page }) => {
  const proposals = (JSON.parse(readFileSync('content/proposals/catalog-proposals.json', 'utf8')) as { devices: { id: string; ports: { portId: string }[] }[] }).devices
  const AMP = proposals.find((p) => p.id === 'crown-xls-2502')!
  expect(SHIPPED.has(AMP.id)).toBe(false)
  const t = trace(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] }))

  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Space')
  const drawer = page.getByTestId('inventory-drawer')
  await expect(drawer).toBeVisible()
  await page.getByRole('tab', { name: 'Bêta' }).click()
  await page.locator(`[data-testid="inventory-item"][data-device-id="${AMP.id}"]`).click()
  await expect(drawer).toBeHidden()
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate((id) => window.__creation!.design().rig.instances.some((i) => i.deviceId === id), AMP.id)).toBe(true)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0) // the ghost and the placed device: every load that will arrive has
  await page.waitForTimeout(500)

  expect(t.glbRequests).not.toContain(AMP.id)
  expectClean(t)
  expect(t.glbResponses.find((r) => r.id === 'yamaha-ql1')?.status).toBe(200) // a verified device placed alongside still loads its model
  const ampId = await page.evaluate((id) => window.__creation!.design().rig.instances.find((i) => i.deviceId === id)!.instanceId, AMP.id)
  // the placeholder box, with exactly the declared ports
  expect(await page.evaluate((id) => window.__creation!.deviceBodyCenter(id), ampId)).not.toBeNull()
  expect(await page.evaluate((id) => window.__creation!.devicePorts(id), ampId)).toEqual(AMP.ports.map((p) => p.portId))
  // the tree and Properties still say « non vérifié »; the drawer's Bêta tab still shows the badge and the placeholder silhouette
  const tree = page.getByRole('tree', { name: 'Projet' })
  await tree.locator('[role="treeitem"][tabindex="0"]').focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowRight')
  const row = tree.locator(`[data-node-id="device:${ampId}"]`)
  await expect(row.getByTestId('tree-badge')).toHaveText('non vérifié')
  await row.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('props-unverified')).toContainText('non vérifié')
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Space')
  await page.getByRole('tab', { name: 'Bêta' }).click()
  const item = page.locator(`[data-testid="inventory-item"][data-device-id="${AMP.id}"]`)
  await expect(item.getByTestId('inventory-badge')).toHaveText('non vérifié')
  await expect(item).toHaveAttribute('data-model', 'false')
})
