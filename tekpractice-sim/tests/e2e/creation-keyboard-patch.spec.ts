/**
 * Task 28 (CA-02, P0, C10): the reference rig is cabled with the KEYBOARD ONLY, from a fresh load: Tab into the place
 * picker, arrows + Entrée on « Concert simple (référence) », Tab to the tree, select ql1, Tab to Propriétés › Connexions,
 * « Connecter à… » on each output, type a filter, Entrée on the input. No pointer anywhere in this file (a unit test reads
 * its text, tests/creation/keyboardPatchSpec.test.ts) and no programmatic focus or dispatch: the only way to move is a key.
 *
 * The reference template already cables sm58 → ql1 in-mic-1 (Task 26 found it): the two new signal cables make THREE
 * connections, which is the real count (Task 32 adds the three power cables to this spec, P4).
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
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 4)
  await expect(page.locator('#renderCanvas')).toBeFocused()
  // the template's mic cable is already there
  expect((await design(page)).rig.connections).toHaveLength(1)

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
  let d = await design(page)
  expect(d.rig.connections).toHaveLength(2)
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
  // The reference template's mic cable + the two new signal cables.
  expect(d.rig.connections).toHaveLength(3)
  expect(d.rig.connections).toContainEqual({ a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } })
  expect(d.rig.connections).toContainEqual({ a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } })
  expect(d.rig.connections).toContainEqual({ a: { instance: 'ql1', port: 'out-main-r' }, b: { instance: 'k12-d', port: 'in-line-a' } })
  await expect(page.locator('[data-key="port:out-main-r"]')).toBeFocused()
})
