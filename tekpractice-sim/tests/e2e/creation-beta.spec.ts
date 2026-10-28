/**
 * Task 30 (S5): the « Bêta » tab holds the catalog PROPOSALS (content/proposals/catalog-proposals.json, the file
 * `npm run sync:kb` writes), each badged « non vérifié ». The expected devices are read from that file, not invented here.
 * A proposal is placed as a placeholder box with its declared ports, is marked « non vérifié » in the tree and in
 * Properties, patches by its declared connector / signal only, and reloads (or is dropped with a visible note).
 * The proposals chunk (`proposalsSource`) is lazy: fetched when the drawer first opens, or when a saved project needs it.
 * Screenshots on demand: $env:BETA_SCREENS = 'commit' → docs/creative/screens/task-30-beta-drawer-1366.png and task-30-beta-placed-1366.png
 */
import { readFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })

interface Proposal {
  id: string
  label: string
  ports: { portId: string; dir: string; connector: string; signal: string }[]
}
const proposals = (JSON.parse(readFileSync('content/proposals/catalog-proposals.json', 'utf8')) as { devices: Proposal[] }).devices
const AMP = proposals.find((p) => p.id === 'crown-xls-2502')! // an XLR line input and an RCA input, both declared
const AMP_XLR = AMP.ports.find((p) => p.connector === 'xlr3-f' && p.signal === 'line-level-pro')!
const AMP_RCA = AMP.ports.find((p) => p.connector === 'rca')!
const PLACE = 'room:concert-hall-medium'
const TIP = 'Fiche proposée, pas encore vérifiée : comportement approximatif.'

const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate((p) => window.__creation!.choosePlace(p), PLACE)
  await page.waitForFunction((p) => window.__creation!.place() === p, PLACE)
}
const reboot = async (page: Page): Promise<void> => {
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await page.waitForFunction((p) => window.__creation!.place() === p, PLACE)
}
const drawer = (page: Page) => page.getByTestId('inventory-drawer')
const open = async (page: Page): Promise<void> => {
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Space')
  await expect(drawer(page)).toBeVisible()
}
const betaTab = (page: Page) => page.getByRole('tab', { name: 'Bêta' })
/** The proposals chunk replaced by this module (the seam: what the sync wrote, or not). */
const serveProposals = (page: Page, body: string) =>
  page.route('**/proposalsSource*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body }))
const design = (page: Page) => page.evaluate(() => window.__creation!.design())
const chunkUrls = (page: Page): string[] => {
  const urls: string[] = []
  page.on('request', (r) => {
    if (/proposalsSource/i.test(r.url())) urls.push(r.url())
  })
  return urls
}

/** Choose a Bêta item in the open drawer and drop it where the ghost stands (Entrée). */
const placeBeta = async (page: Page, id: string): Promise<void> => {
  await open(page)
  await betaTab(page).click()
  await page.locator(`[data-testid="inventory-item"][data-device-id="${id}"]`).click()
  await expect(drawer(page)).toBeHidden()
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(true)
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await design(page)).rig.instances.some((i) => i.deviceId === id)).toBe(true)
}

test('the file the sync wrote has proposals, none already in the catalogue', async () => {
  expect(proposals.length).toBeGreaterThan(0)
  const catalog = (JSON.parse(readFileSync('content/catalog.json', 'utf8')) as { devices: { id: string }[] }).devices.map((d) => d.id)
  for (const p of proposals) expect(catalog, p.id).not.toContain(p.id)
  expect(new Set(proposals.map((p) => p.id)).size).toBe(proposals.length)
})

test('« Bêta » is shown (the file has proposals), just before « Autres » ; one item per proposal, each badged « non vérifié » with the tooltip', async ({ page }) => {
  await boot(page)
  await open(page)
  const tabs = page.getByRole('tablist').getByRole('tab')
  await expect(tabs.first()).toBeVisible() // web-first: the tabs are in the accessibility tree before they are read
  const names = await tabs.allInnerTexts()
  expect(names).toContain('Bêta')
  expect(names.indexOf('Bêta')).toBe(names.indexOf('Autres') - 1)
  await betaTab(page).click()
  const items = page.getByRole('tabpanel').getByTestId('inventory-item')
  await expect(items).toHaveCount(proposals.length)
  expect(await items.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.deviceId))).toEqual(proposals.map((p) => p.id))
  // every item: the visible badge, the tooltip, the sentence as its description
  const bad = await items.evaluateAll((els, tip) =>
    els.flatMap((e) => {
      const b = e as HTMLButtonElement
      const badge = b.querySelector('[data-testid="inventory-badge"]')
      const desc = b.getAttribute('aria-describedby')
      const why: string[] = []
      if (badge?.textContent !== 'non vérifié') why.push('badge')
      if (b.title !== tip) why.push('title')
      if (!desc || b.ownerDocument.getElementById(desc)?.textContent !== tip) why.push('description')
      return why.length ? [`${b.dataset.deviceId}: ${why.join(',')}`] : []
    }), TIP)
  expect(bad).toEqual([])
  await expect(page.getByTestId('inventory-badge').first()).toBeVisible()
  await expect(page.getByTestId('inventory-badge')).toHaveCount(proposals.length)
  // a proposal appears in « Bêta » only; a catalogue tab has no badge and no tooltip
  for (const name of names.filter((n) => n !== 'Bêta')) {
    await page.getByRole('tab', { name }).click()
    await expect(page.getByTestId('inventory-badge')).toHaveCount(0)
    expect(await page.getByRole('tabpanel').getByTestId('inventory-item').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.deviceId))).not.toEqual(
      expect.arrayContaining([AMP.id]),
    )
    expect(await page.getByRole('tabpanel').getByTestId('inventory-item').evaluateAll((els) => els.filter((e) => (e as HTMLElement).title !== '').length)).toBe(0)
  }
})

test('« Bêta » is hidden when the file holds no proposal', async ({ page }) => {
  await serveProposals(page, 'export default { "devices": [] }')
  await boot(page)
  await open(page)
  await expect(page.getByRole('tablist').getByRole('tab').first()).toHaveText('Micros')
  await expect(betaTab(page)).toHaveCount(0)
  await expect(page.getByTestId('inventory-badge')).toHaveCount(0)
})

test('« Bêta » is hidden, and the drawer still opens, when the proposals file cannot be loaded', async ({ page }) => {
  await page.route('**/proposalsSource*', (r) => r.abort())
  await boot(page)
  await open(page)
  await expect(page.getByRole('tab').first()).toHaveText('Micros')
  await expect(betaTab(page)).toHaveCount(0)
  await page.keyboard.press('Space')
  await expect(drawer(page)).toBeHidden()
})

/**
 * The proposals request stalls past the (shortened) delay, then arrives: the first open shows the drawer without « Bêta » (a failed
 * fetch is never « there are none »); the next open asks again and the tab comes back. A request ABORTED outright is remembered by
 * Chromium for the document (a second import() of the same chunk fails without a new request): only a reload recovers that one.
 */
const stallProposals = async (page: Page): Promise<{ release: () => Promise<void>; held: () => number }> => {
  await page.addInitScript(() => {
    ;(window as unknown as { __creationBetaTimeoutMs: number }).__creationBetaTimeoutMs = 400 // test-only seam (default 5 s)
  })
  const held: Array<() => Promise<void>> = []
  await page.route('**/proposalsSource*', (r) => void held.push(() => r.continue()))
  return { release: async () => void (await Promise.all(held.splice(0).map((f) => f()))), held: () => held.length }
}

test('« Bêta » comes back on the next open once a stalled proposals file has arrived (a failed fetch is not remembered for the session)', async ({ page }) => {
  const net = await stallProposals(page)
  await boot(page)
  await open(page) // waits the 400 ms, then opens without the tab
  await expect(page.getByRole('tab').first()).toHaveText('Micros')
  await expect(betaTab(page)).toHaveCount(0)
  await page.keyboard.press('Space')
  await expect(drawer(page)).toBeHidden()
  await net.release() // the network is back
  await open(page)
  await expect(betaTab(page)).toBeVisible()
  await betaTab(page).click()
  await expect(page.getByTestId('inventory-badge').first()).toBeVisible()
})

test('a second Espace while the drawer waits for the Bêta sheets cancels the open (as for the first open)', async ({ page }) => {
  const net = await stallProposals(page)
  await boot(page)
  await open(page)
  await page.keyboard.press('Space')
  await expect(drawer(page)).toBeHidden()
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Space') // the retry waits for the sheets (they are still stalled)
  await expect(page.getByRole('status')).toContainText('Ouverture')
  await page.keyboard.press('Space') // changed my mind
  await net.release()
  await expect(page.getByRole('status')).not.toContainText('Ouverture') // the retry is over
  await expect(drawer(page)).toBeHidden()
})

test('« Bêta » is hidden when the file is not a proposals file', async ({ page }) => {
  await serveProposals(page, 'export default 42')
  await boot(page)
  await open(page)
  await expect(betaTab(page)).toHaveCount(0)
  await expect(page.getByRole('tablist').getByRole('tab').first()).toHaveText('Micros')
})

test('the proposals chunk is not requested at boot, and is requested when the drawer first opens', async ({ page }) => {
  const urls = chunkUrls(page)
  await boot(page)
  await page.waitForTimeout(300)
  expect(urls).toEqual([])
  await open(page)
  await expect(betaTab(page)).toBeVisible()
  expect(urls.length).toBeGreaterThan(0)
})

test('placing a Bêta item drops a placeholder box with its declared ports (and nothing else)', async ({ page }) => {
  await boot(page)
  await placeBeta(page, AMP.id)
  const d = await design(page)
  expect(d.rig.instances).toHaveLength(1)
  const inst = d.rig.instances[0]
  expect(inst.deviceId).toBe(AMP.id)
  expect(d.placements.find((p) => p.instanceId === inst.instanceId)).toBeDefined()
  expect(await page.evaluate(() => window.__creation!.historySize())).toBe(1)
  // the box is on screen and carries exactly the ports the file declares
  expect(await page.evaluate((id) => window.__creation!.deviceBodyCenter(id), inst.instanceId)).not.toBeNull()
  expect(await page.evaluate((id) => window.__creation!.devicePorts(id), inst.instanceId)).toEqual(AMP.ports.map((p) => p.portId))
  // no model ships for a proposal: the drawer's silhouette says placeholder
  await open(page)
  await betaTab(page).click()
  await expect(page.locator(`[data-device-id="${AMP.id}"]`)).toHaveAttribute('data-model', 'false')
  // undo takes it away (one entry), redo brings it back
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => window.__creation!.undo())).toBe(true)
  expect((await design(page)).rig.instances).toHaveLength(0)
  expect(await page.evaluate(() => window.__creation!.redo())).toBe(true)
  expect((await design(page)).rig.instances).toHaveLength(1)
})

test('a placed Bêta device says « non vérifié » in the tree and in Properties; a catalogue device does not', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] }))
  await placeBeta(page, AMP.id)
  const ampId = (await design(page)).rig.instances.find((i) => i.deviceId === AMP.id)!.instanceId
  // the tree: Matériel opened with the keyboard
  const tree = page.getByRole('tree', { name: 'Projet' })
  await tree.locator('[role="treeitem"][tabindex="0"]').focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowRight')
  const ampRow = tree.locator(`[data-node-id="device:${ampId}"]`)
  await expect(ampRow).toBeVisible()
  await expect(ampRow.getByTestId('tree-badge')).toHaveText('non vérifié')
  await expect(ampRow).toHaveAccessibleName(/non vérifié$/)
  await expect(tree.locator('[data-node-id="device:ql1"]').getByTestId('tree-badge')).toHaveCount(0)
  await expect(tree.locator('[data-node-id="device:ql1"]')).not.toHaveAccessibleName(/non vérifié/)
  // Properties
  await ampRow.focus()
  await page.keyboard.press('Enter')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe(ampId)
  const mark = page.getByTestId('props-unverified')
  await expect(mark).toBeVisible()
  await expect(mark).toContainText('non vérifié')
  await expect(mark).toContainText(TIP)
  await tree.locator('[data-node-id="device:ql1"]').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('props-unverified')).toHaveCount(0)
})

test('a Bêta device is patched by its declared connector and signal (R1), and never makes « Signal OK »', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] }))
  await placeBeta(page, AMP.id)
  const ampId = (await design(page)).rig.instances.find((i) => i.deviceId === AMP.id)!.instanceId
  const ok = await page.evaluate(
    ([amp, port]) => window.__creation!.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: amp, port } }).ok,
    [ampId, AMP_XLR.portId],
  )
  expect(ok).toBe(true)
  const bad = await page.evaluate(
    ([amp, port]) => window.__creation!.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-r' }, b: { instance: amp, port } }),
    [ampId, AMP_RCA.portId],
  )
  expect(bad.ok).toBe(false) // XLR male out into the declared RCA input: refused like any connector mismatch
  expect((await design(page)).rig.connections).toHaveLength(1)
  await expect(page.getByTestId('status-bar')).not.toContainText('Signal OK')
  // the absence of errors is weaker evidence with a proposal in the rig: the status line says so
  await expect(page.getByTestId('signal-extra')).toContainText('1 appareil non vérifié')
})

test('a Bêta device is duplicated, deleted and restored like any other (one undo entry each)', async ({ page }) => {
  await boot(page)
  await placeBeta(page, AMP.id)
  const base = await page.evaluate(() => window.__creation!.historySize())
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press(']')
  const ampId = (await design(page)).rig.instances[0].instanceId
  expect(await page.evaluate(() => window.__creation!.selection())).toBe(ampId)
  await page.keyboard.press('Control+d')
  expect((await design(page)).rig.instances.map((i) => i.deviceId)).toEqual([AMP.id, AMP.id])
  expect(await page.evaluate(() => window.__creation!.historySize())).toBe(base + 1)
  await page.keyboard.press('Delete')
  expect((await design(page)).rig.instances).toHaveLength(1)
  await page.keyboard.press('Control+z')
  expect((await design(page)).rig.instances).toHaveLength(2)
  // both are Bêta devices: each one selected is marked in Properties
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press(']')
    await expect(page.getByTestId('props-unverified')).toBeVisible()
  }
})

test('reload: a Bêta device comes back with the catalogue ones, the chunk is fetched for it', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] }))
  await placeBeta(page, AMP.id)
  const before = await design(page)
  await page.waitForTimeout(1200) // the autosave
  const urls = chunkUrls(page)
  await reboot(page)
  const after = await design(page)
  expect(after.rig.instances.map((i) => `${i.instanceId}:${i.deviceId}`).sort()).toEqual(before.rig.instances.map((i) => `${i.instanceId}:${i.deviceId}`).sort())
  expect(after.placements).toEqual(before.placements)
  expect(urls.length).toBeGreaterThan(0)
  await expect(page.getByTestId('note-missing-sheets')).toHaveCount(0)
  expect(await page.evaluate((id) => window.__creation!.devicePorts(id), before.rig.instances.find((i) => i.deviceId === AMP.id)!.instanceId)).toEqual(
    AMP.ports.map((p) => p.portId),
  )
})

test('reload with only catalogue gear does not fetch the proposals chunk', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] }))
  await page.waitForTimeout(1200)
  const urls = chunkUrls(page)
  await reboot(page)
  expect((await design(page)).rig.instances.map((i) => i.instanceId)).toEqual(['ql1'])
  await page.waitForTimeout(300)
  expect(urls).toEqual([])
})

test('reload when the proposal is no longer offered: the catalogue gear comes back, the Bêta device is dropped and the learner is told', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] }))
  await placeBeta(page, AMP.id)
  await page.waitForTimeout(1200)
  await serveProposals(page, 'export default { "devices": [] }') // the sync no longer proposes it
  await reboot(page)
  expect((await design(page)).rig.instances.map((i) => i.instanceId)).toEqual(['ql1'])
  const note = page.getByTestId('note-missing-sheets')
  await expect(note).toBeVisible()
  await expect(note).toContainText('Appareils non rechargés')
  await expect(note).toContainText(AMP.id)
  await expect(page.getByTestId('status-bar')).not.toContainText('Signal OK')
})

test('reload with only a Bêta device whose proposal is gone: nothing is invented, the note says so', async ({ page }) => {
  await boot(page)
  await placeBeta(page, AMP.id)
  await page.waitForTimeout(1200)
  await serveProposals(page, 'export default { "devices": [] }')
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await expect(page.getByTestId('note-missing-sheets')).toBeVisible()
  expect((await design(page)).rig.instances).toEqual([])
})

test('accessibility: no axe violation on the Bêta tab, with a Bêta device selected (tree row and Properties marker)', async ({ page }) => {
  await boot(page)
  await open(page)
  await betaTab(page).click()
  const r = await new AxeBuilder({ page }).include('[data-testid="inventory-drawer"]').analyze()
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
  if (process.env.BETA_SCREENS === 'commit') await page.screenshot({ path: 'docs/creative/screens/task-30-beta-drawer-1366.png' })
  await page.keyboard.press('Escape')
  await placeBeta(page, AMP.id)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press(']')
  await expect(page.getByTestId('props-unverified')).toBeVisible()
  const rest = await new AxeBuilder({ page }).include('[data-testid="props-unverified"]').analyze()
  expect(rest.violations.map((v) => v.id)).toEqual([])
  const tree = await new AxeBuilder({ page }).include('[role="tree"]').analyze()
  expect(tree.violations.map((v) => v.id)).toEqual([])
  if (process.env.BETA_SCREENS === 'commit') await page.screenshot({ path: 'docs/creative/screens/task-30-beta-placed-1366.png' })
})

const AUTOSAVE_KEY = 'audio-sim/creation.v1'
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), AUTOSAVE_KEY)
const UNAVAILABLE = 'Fiches Bêta indisponibles (réseau). Rechargez la page pour retrouver votre projet.'

/** A saved session with a catalogue device and a Bêta one; returns the stored autosave (bytes). */
const saveSession = async (page: Page): Promise<string> => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] }))
  await placeBeta(page, AMP.id)
  await page.waitForTimeout(1200) // the autosave
  const raw = await stored(page)
  expect(raw).toContain(AMP.id)
  return raw!
}

test('reload while the proposals chunk cannot be fetched: nothing is lost, nothing is overwritten, the note says it is the network; the next reload brings the device back', async ({ page }) => {
  const raw = await saveSession(page)
  await page.route('**/proposalsSource*', (r) => r.abort())
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  // the honest note (not « n’existe plus »), also in the picker the learner is looking at
  await expect(page.getByTestId('note-missing-sheets')).toHaveCount(0)
  const note = page.getByTestId('note-beta-unavailable')
  await expect(note).toBeVisible()
  await expect(note).toContainText(UNAVAILABLE)
  await expect(page.getByTestId('place-picker')).toContainText(UNAVAILABLE)
  // no half-loaded rig, no generic « sauvegarde incompatible » note, nothing set aside
  expect((await design(page)).rig.instances).toEqual([])
  await expect(page.getByTestId('note-storage')).toHaveCount(0)
  expect(await page.evaluate(() => window.__creation!.quarantine())).toEqual([])
  // the stored project is byte-identical, also after the autosave delay and a page hide
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')))
  expect(await stored(page)).toBe(raw)
  // a reload WITHOUT the failure: the project is back, the chunk was fetched for it
  await page.unroute('**/proposalsSource*')
  await reboot(page)
  expect((await design(page)).rig.instances.map((i) => i.deviceId).sort()).toEqual([AMP.id, 'yamaha-ql1'].sort())
  await expect(page.getByTestId('note-beta-unavailable')).toHaveCount(0)
})

test('reload while the proposals request stalls: the workspace is not blank for ever; after the delay the same non-destructive path runs', async ({ page }) => {
  const raw = await saveSession(page)
  await page.addInitScript(() => {
    ;(window as unknown as { __creationBetaTimeoutMs: number }).__creationBetaTimeoutMs = 400 // test-only seam (default 5 s)
  })
  await page.route('**/proposalsSource*', () => {
    // never answered
  })
  await page.reload()
  await page.waitForFunction(() => !!window.__creation, undefined, { timeout: 4000 })
  await expect(page.getByTestId('note-beta-unavailable')).toBeVisible()
  await expect(page.getByTestId('place-picker')).toBeVisible()
  expect((await design(page)).rig.instances).toEqual([])
  await page.waitForTimeout(1500)
  expect(await stored(page)).toBe(raw)
})

const UNAVAILABLE_OPEN = 'Fiches Bêta indisponibles (réseau). Le projet n’a pas été ouvert ; réessayez plus tard.'

test('« Ouvrir… » while the Bêta sheets cannot be fetched says the project was NOT opened (not « reload the page »); a later successful open clears the note', async ({ page }) => {
  await boot(page)
  await placeBeta(page, AMP.id)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+s')
  await page.getByRole('textbox', { name: 'Nom du projet' }).fill('Mon ampli')
  await page.keyboard.press('Enter')
  await expect(page).toHaveTitle('Mon ampli · Mode Création · TekPractice')
  // Start something else, so the autosave holds no Bêta device: the reload below needs no sheet and holds nothing (no betaHold)
  await page.getByRole('menuitem', { name: 'Projet' }).click()
  await page.getByRole('menuitem', { name: /^Nouveau/ }).click()
  await expect.poll(async () => (await design(page)).rig.instances).toEqual([])
  await expect.poll(() => stored(page).then((raw) => !!raw && !raw.includes(AMP.id))).toBe(true)
  const net = await stallProposals(page)
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  const note = page.getByTestId('note-beta-unavailable')
  await expect(note).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Projet' }).click()
  await page.getByRole('menuitem', { name: /^Ouvrir/ }).click()
  await page.getByRole('button', { name: /Mon ampli/ }).click()
  // the learner just tried to open a project: the note says it was not opened and to try again, not to reload
  await expect(note).toContainText(UNAVAILABLE_OPEN)
  await expect(note).not.toContainText('Rechargez')
  await expect(page.locator('.cr-status-msg')).toContainText(UNAVAILABLE_OPEN)
  expect((await design(page)).rig.instances).toEqual([])
  await expect(page.getByTestId('project-title')).not.toContainText('Mon ampli')
  // the network is back: the same « Ouvrir… » works and the note goes
  await net.release()
  await page.getByRole('menuitem', { name: 'Projet' }).click()
  await page.getByRole('menuitem', { name: /^Ouvrir/ }).click()
  await page.getByRole('button', { name: /Mon ampli/ }).click()
  await expect.poll(async () => (await design(page)).rig.instances.map((i) => i.deviceId)).toEqual([AMP.id])
  await expect(note).toHaveCount(0)
})

test('after a failed reload, starting something else sets the held project aside (recoverable) before the autosave writes', async ({ page }) => {
  const raw = await saveSession(page)
  await page.route('**/proposalsSource*', (r) => r.abort())
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await expect(page.getByTestId('note-beta-unavailable')).toBeVisible()
  await page.evaluate((p) => window.__creation!.choosePlace(p), PLACE) // the learner starts a new project
  await page.waitForFunction((p) => window.__creation!.place() === p, PLACE)
  await expect.poll(() => page.evaluate(() => window.__creation!.quarantine().map((q) => q.raw))).toContain(raw)
})
