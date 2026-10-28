/**
 * Task 28 (CA-02, P0, C10): the reference rig is cabled with the KEYBOARD ONLY, from a fresh load: Tab into the place
 * picker, arrows + Entrée on « Concert simple (référence) », Tab to the tree, select ql1, Tab to Propriétés › Connexions,
 * « Connecter à… » on each output, type a filter, Entrée on the input. No pointer anywhere in this file (a unit test reads
 * its text, tests/creation/keyboardPatchSpec.test.ts) and no programmatic focus or dispatch: the only way to move is a key.
 *
 * Counts, from the real template (Task 26 found the mic cable, Task 32 added the strip): it opens with 5 devices and
 * 4 connections (sm58 → ql1 in-mic-1, plus the strip `mains` feeding ql1, k12-g and k12-d). The two signal cables make 6.
 * Then (Task 32, P4) the rig is POWERED with keys alone: Suppr removes the template's strip and its three cables (3 left),
 * Espace, « multiprise », Entrée, Entrée puts a new one down, and « Connecter à… » cables its out-1..3 to the three
 * power-in: 1 mic + 2 signal + 3 power = 6 connections. The strip must go first, or its outputs would be the three
 * power-in's neighbours already (a port holds one cable).
 */
import { expect, test, type Page } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })

const design = (page: Page) => page.evaluate(() => window.__creation!.design())
const inside = (page: Page, selector: string) => page.evaluate((s) => document.activeElement?.closest(s) != null, selector)

/** Press Tab (or Shift+Tab) until the focused element is inside `selector`; fails loudly when it never is. */
async function tabTo(page: Page, selector: string, o: { max?: number; back?: boolean } = {}): Promise<void> {
  const max = o.max ?? 120
  for (let i = 0; i < max; i++) {
    if (await inside(page, selector)) return
    await page.keyboard.press(o.back ? 'Shift+Tab' : 'Tab')
  }
  expect(await inside(page, selector), `Tab never reached ${selector} in ${max} presses`).toBe(true)
}

test('CA-02: from a fresh load, the whole reference rig is cabled with the keyboard only', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)

  // 1. The picker: Tab into the templates, arrows, Entrée.
  await expect(page.getByTestId('place-picker')).toBeVisible()
  await tabTo(page, '[data-testid="template-grid"]', { max: 12 })
  const card = page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ })
  await expect(card).toBeFocused()
  await page.keyboard.press('ArrowRight') // one template: the arrows stay on it
  await page.keyboard.press('ArrowLeft')
  await expect(card).toBeFocused()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 5)
  await expect(page.locator('#renderCanvas')).toBeFocused()
  // the template's mic cable and its strip's three power cables are already there
  let d = await design(page)
  expect(d.rig.connections).toHaveLength(4)
  expect(d.rig.connections).toContainEqual({ a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } })

  // 2. The tree: Shift+Tab from the canvas, down to « Matériel », open it, down to QL1, Entrée.
  await tabTo(page, '[data-testid="project-tree"]', { max: 12, back: true })
  const tree = page.getByRole('tree', { name: 'Projet' })
  await expect(tree.getByRole('treeitem', { name: /^Lieu/ })).toBeFocused()
  await page.keyboard.press('ArrowDown') // Zones
  await page.keyboard.press('ArrowDown') // Matériel
  await expect(tree.getByRole('treeitem', { name: /^Matériel/ })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  const ql1 = tree.getByRole('treeitem', { name: 'Yamaha QL1 (ql1)' })
  for (let i = 0; i < 6; i++) {
    if (await ql1.evaluate((e) => e === document.activeElement)) break
    await page.keyboard.press('ArrowDown')
  }
  await expect(ql1).toBeFocused()
  await page.keyboard.press('Enter')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1')

  // 3. Propriétés › Connexions › out-main-l › « Connecter à… »: filter « k12-g », Entrée on in-line-a.
  const outL = page.getByRole('button', { name: 'Connecter à… (depuis out-main-l)' })
  await tabTo(page, '[data-key="connect:out-main-l"]')
  await expect(outL).toBeFocused()
  // the row is named in full for a screen reader (the keyboard stand-in for the port's hover label)
  await expect(page.locator('[data-key="port:out-main-l"]')).toHaveAccessibleName('out-main-l · XLR3 mâle · Niveau ligne pro (+4 dBu) · libre')
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Connecter à…' })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Filtrer' })).toBeFocused()
  await page.keyboard.type('k12-g')
  await expect(page.getByTestId('connect-count')).toHaveText('1 prise compatible.')
  const option = dialog.getByRole('option')
  await expect(option).toHaveCount(1)
  await expect(option).toHaveAccessibleName('K12.2 (k12-g) · in-line-a · XLR3 femelle · Niveau ligne pro (+4 dBu)')
  await expect(page.getByRole('combobox', { name: 'Filtrer' })).toHaveAttribute('aria-activedescendant', (await option.getAttribute('id'))!)
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('status').first()).toContainText('Connecté : ')
  d = await design(page)
  expect(d.rig.connections).toHaveLength(5)
  expect(d.rig.connections).toContainEqual({ a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } })
  // focus lands on the row it cabled; its name says where it goes now
  const rowL = page.locator('[data-key="port:out-main-l"]')
  await expect(rowL).toBeFocused()
  await expect(rowL).toHaveAccessibleName('out-main-l · XLR3 mâle · Niveau ligne pro (+4 dBu) · branché à K12.2 (k12-g) · in-line-a')

  // 4. The same for out-main-r → k12-d in-line-a.
  await tabTo(page, '[data-key="connect:out-main-r"]', { max: 6 })
  await expect(page.getByRole('button', { name: 'Connecter à… (depuis out-main-r)' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(dialog).toBeVisible()
  await page.keyboard.type('k12-d in-line-a')
  await expect(dialog.getByRole('option')).toHaveCount(1)
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  d = await design(page)
  // The reference template's mic cable and three power cables + the two new signal cables.
  expect(d.rig.connections).toHaveLength(6)
  expect(d.rig.connections).toContainEqual({ a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } })
  expect(d.rig.connections).toContainEqual({ a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } })
  expect(d.rig.connections).toContainEqual({ a: { instance: 'ql1', port: 'out-main-r' }, b: { instance: 'k12-d', port: 'in-line-a' } })
  await expect(page.locator('[data-key="port:out-main-r"]')).toBeFocused()

  // 5. Power, by keys: remove the template's strip. Shift+Tab back to the tree, down to « Multiprise secteur », Entrée selects it,
  // Tab to the 3D view, Suppr (a 3D-view key) removes it with its three cables.
  await tabTo(page, '[data-testid="project-tree"]', { max: 60, back: true }) // back through the properties panel's rows and buttons
  const strip = tree.getByRole('treeitem', { name: 'Multiprise secteur (mains)' })
  for (let i = 0; i < 8; i++) {
    if (await strip.evaluate((e) => e === document.activeElement)) break
    await page.keyboard.press('ArrowDown')
  }
  await expect(strip).toBeFocused()
  await page.keyboard.press('Enter')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('mains')
  await tabTo(page, '#renderCanvas', { max: 6 })
  await expect(page.locator('#renderCanvas')).toBeFocused()
  await page.keyboard.press('Delete')
  d = await design(page)
  expect(d.rig.instances.map((i) => i.instanceId)).not.toContain('mains')
  expect(d.rig.instances).toHaveLength(4)
  expect(d.rig.connections).toHaveLength(3) // the mic cable and the two signal cables stay; the strip's three went with it
  expect(d.rig.connections.some((c) => c.a.port === 'power-in' || c.b.port === 'power-in')).toBe(false)

  // 6. Espace opens the inventory on the 3D view; typing lands in « Filtrer »; Entrée chooses the strip (a ghost follows
  // the pointer), Entrée again drops it where the ghost stands (a fresh press; a held key repeats nothing).
  const drawer = page.getByTestId('inventory-drawer')
  await page.keyboard.press('Space')
  await expect(drawer).toBeVisible()
  await expect(page.getByRole('tab', { selected: true })).toBeFocused()
  await page.keyboard.type('multiprise')
  const items = drawer.getByTestId('inventory-item')
  await expect(page.getByRole('textbox', { name: 'Filtrer' })).toHaveValue('multiprise')
  await expect(items).toHaveCount(1)
  await expect(items.first()).toHaveAttribute('data-device-id', 'multiprise-secteur')
  await page.keyboard.press('Enter')
  await expect(drawer).toBeHidden()
  await expect(page.locator('#renderCanvas')).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.__creation!.placing())).toBe(true)
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => window.__creation!.placing())).toBe(false)
  d = await design(page)
  expect(d.rig.instances).toHaveLength(5)
  const newStrip = d.rig.instances.find((i) => i.deviceId === 'multiprise-secteur')!
  expect(newStrip, 'the strip is on the stage').toBeDefined()
  expect(await page.evaluate(() => window.__creation!.selection())).toBe(newStrip.instanceId)

  // 7. The three power cables, from the strip's outputs: Propriétés › Connexions › « Connecter à… (depuis out-N) ».
  const PEERS = [['out-1', 'ql1'], ['out-2', 'k12-g'], ['out-3', 'k12-d']] as const
  for (const [i, [out, peer]] of PEERS.entries()) {
    // the first one is a long way from the 3D view (the whole Position block), the next ones are a Tab or two from the row just cabled
    await tabTo(page, `[data-key="connect:${out}"]`, i === 0 ? {} : { max: 6 })
    await expect(page.getByRole('button', { name: `Connecter à… (depuis ${out})` })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog).toBeVisible()
    await page.keyboard.type(`${peer} power-in`)
    await expect(dialog.getByRole('option')).toHaveCount(1) // the mains inlets already cabled are not offered
    await expect(dialog.getByRole('option')).toContainText('power-in')
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    await expect(page.locator(`[data-key="port:${out}"]`)).toBeFocused()
  }
  d = await design(page)
  // 1 mic + 2 signal + 3 power = 6, the real final count
  expect(d.rig.connections).toHaveLength(6)
  for (const [out, peer] of PEERS)
    expect(d.rig.connections).toContainEqual({ a: { instance: newStrip.instanceId, port: out }, b: { instance: peer, port: 'power-in' } })
  expect(d.rig.connections).toContainEqual({ a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } })
})
