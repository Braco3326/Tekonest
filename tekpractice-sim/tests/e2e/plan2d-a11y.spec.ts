/**
 * Mission 2 review (2026-11-15): axe-core on the 2D schema page, scoped to the page's dialog, in every state a learner meets: the general view with every cable
 * type (and the palette), a selected cable, a rear panel with a cable held (lit and dimmed ports with their reasons), the « Légende et sources » panel open,
 * the send confirmation and the report. Desktop (1440 x 900) and phone (390 x 844, touch), in design 2 « Atelier » (Nuit); design 3 (the Papier sheet)
 * for colour contrast only. The test FAILS on any serious or critical violation (WCAG 2.0 / 2.1 / 2.2 A and AA rules); the minor and moderate ones are
 * printed as annotations.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { BUILDS, RIG, enterDesign, openPlan, writePlan } from './plan2dKit'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function scan(page: Page, state: string, contrastOnly = false): Promise<string[]> {
  let b = new AxeBuilder({ page }).include('[data-testid="plan2d"]').withTags(TAGS)
  if (contrastOnly) b = b.withRules(['color-contrast'])
  const r = await b.analyze()
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  for (const v of r.violations.filter((x) => !bad.includes(x)))
    test.info().annotations.push({ type: `axe ${v.impact}`, description: `${state}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(' ')}` })
  return bad.flatMap((v) => v.nodes.map((n) => `${state}: ${v.id} [${v.impact}] ${n.target.join(' ')} :: ${(n.any[0]?.message ?? n.failureSummary ?? '').slice(0, 160)}`))
}

const SIZES = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, touch: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, touch: true },
]

for (const build of BUILDS) {
  test.describe(build.name, () => {
    if (build.base) test.use({ baseURL: build.base })
    test.describe.configure({ timeout: 180_000 })

    for (const s of SIZES) {
      test.describe(s.name, () => {
        test.use({ viewport: s.viewport, hasTouch: s.touch, isMobile: s.touch })

        test(`design 2 (Nuit), ${s.name}: no serious or critical axe violation in any state of the page`, async ({ page }) => {
          const found: string[] = []
          await enterDesign(page, 2)
          await writePlan(page, RIG)
          const dialog = await openPlan(page)
          await expect(dialog.locator('[data-cable]')).toHaveCount(9)
          found.push(...(await scan(page, 'general view + palette')))
          // a selected cable (its on-screen action shows)
          await dialog.locator('[data-cable="c3"]').focus()
          await page.keyboard.press('Enter')
          await expect(dialog.getByTestId('plan2d-actions')).toBeVisible()
          found.push(...(await scan(page, 'cable selected')))
          // the legend and sources panel
          await dialog.getByRole('button', { name: 'Légende et sources' }).click()
          await expect(dialog.getByTestId('plan2d-sources')).toBeVisible()
          found.push(...(await scan(page, 'legend and sources')))
          await dialog.getByRole('button', { name: 'Légende et sources' }).click()
          // a rear panel with a cable held: the speaker's lit and dimmed ports
          await dialog.locator('[data-dev="qsc-k12-2-2"]').focus()
          await page.keyboard.press('Enter')
          await dialog.getByTestId('plan2d-rear').locator('[data-port="thru-out-a"]').click()
          await dialog.locator('[data-dev="crown-xti-4002-1"]').focus()
          await page.keyboard.press('Enter')
          await expect(dialog.getByTestId('plan2d-rear')).toHaveAttribute('data-holding', 'true')
          await expect(dialog.locator('[data-state="dim"]').first()).toBeVisible()
          found.push(...(await scan(page, 'rear panel, cable held')))
          await page.keyboard.press('Escape')
          // the send confirmation, then the report
          await dialog.getByRole('button', { name: 'Envoyer dans la scène 3D' }).click()
          await expect(page.getByTestId('plan2d-spawn-dialog')).toBeVisible()
          found.push(...(await scan(page, 'send confirmation')))
          await page.getByTestId('plan2d-spawn-dialog').getByRole('button', { name: 'Ajouter' }).click()
          await expect(dialog.getByTestId('plan2d-report')).toBeVisible()
          found.push(...(await scan(page, 'report')))
          expect(found, 'serious / critical axe violations').toEqual([])
        })
      })
    }

    test.describe('design 3 (Papier), contrast only', () => {
      test.use({ viewport: { width: 1440, height: 900 } })
      test('every glyph, label and line of the page has its contrast on the Papier sheet', async ({ page }) => {
        const found: string[] = []
        await enterDesign(page, 3)
        await writePlan(page, RIG)
        const dialog = await openPlan(page)
        await expect(dialog.locator('[data-cable]')).toHaveCount(9)
        found.push(...(await scan(page, 'design 3 general view', true)))
        await dialog.getByRole('button', { name: 'Légende et sources' }).click()
        found.push(...(await scan(page, 'design 3 sources', true)))
        await dialog.locator('[data-dev="qsc-k12-2-2"]').focus()
        await page.keyboard.press('Enter')
        await dialog.getByTestId('plan2d-rear').locator('[data-port="thru-out-a"]').click()
        await dialog.locator('[data-dev="crown-xti-4002-1"]').focus()
        await page.keyboard.press('Enter')
        await expect(dialog.locator('[data-state="dim"]').first()).toBeVisible()
        found.push(...(await scan(page, 'design 3 rear panel', true)))
        expect(found, 'serious / critical contrast violations').toEqual([])
      })
    })
  })
}
