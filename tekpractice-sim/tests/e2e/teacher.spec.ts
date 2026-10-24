/**
 * Teacher page (Task 15): offline, DOM only. The fixture is the game's own
 * export (tests/fixtures/essais-sample.essai.json).
 */
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const FIXTURE = 'tests/fixtures/essais-sample.essai.json'
const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { trials: { name: string; evidence: { prediction: { text: string } } }[] }

const open = async (page: Page): Promise<void> => {
  await page.goto('/teacher.html')
  await expect(page.locator('#status')).toContainText('Aucun fichier ouvert.')
}
const upload = (page: Page, name: string, body: string) =>
  page.locator('#file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(body, 'utf8') })

test('fixture: names, predictions, parent and map are visible; no Babylon is loaded', async ({ page }) => {
  const scripts: string[] = []
  page.on('request', (r) => {
    if (r.resourceType() === 'script') scripts.push(r.url())
  })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await open(page)
  await page.locator('#file').setInputFiles(FIXTURE)
  const cards = page.locator('ol.trail > li')
  await expect(cards).toHaveCount(fixture.trials.length)
  for (const [i, t] of fixture.trials.entries()) {
    await expect(cards.nth(i).getByRole('heading', { level: 3 })).toHaveText(`Essai ${t.name}`)
    await expect(cards.nth(i)).toContainText(t.evidence.prediction.text)
    await expect(cards.nth(i).locator('svg.map title')).toContainText(`l'essai ${t.name}`)
    expect(await cards.nth(i).locator('svg.map circle').count()).toBeGreaterThan(0)
  }
  await expect(cards.nth(1)).toContainText('parent : Essai A')
  await expect(cards.nth(1)).toContainText('Sans salle')
  await expect(page.getByRole('heading', { level: 2, name: 'Grille de lecture' })).toBeVisible()
  await expect(page.getByText('Brouillon')).toBeVisible()
  await expect(page.locator('.rubric input[type=checkbox]')).toHaveCount(5)
  await expect(page.locator('footer.disclaimer')).toContainText('déclaratifs')
  expect(scripts.filter((s) => /babylon/i.test(s))).toEqual([])
  expect(errors).toEqual([])

  // Optional screenshots (never committed): TEACHER_SHOTS=<dir>
  const dir = process.env.TEACHER_SHOTS
  if (dir) {
    for (const [w, h] of [[1366, 768], [390, 844]] as const) {
      await page.setViewportSize({ width: w, height: h })
      await page.screenshot({ path: `${dir}/teacher-${w}x${h}.png`, fullPage: true })
    }
  }
})

test('the file input is keyboard-reachable', async ({ page }) => {
  await open(page)
  // Tab order: the site link comes first (header position, as on the game page), then the file control.
  await page.keyboard.press('Tab')
  await expect(page.locator('#site-link')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('#file')).toBeFocused()
})

test('a quarantine file gets a clear message and no card', async ({ page }) => {
  await open(page)
  await upload(page, 'q.json', JSON.stringify({ formatVersion: 1, kind: 'quarantine', exportedAt: '2026-10-24T10:00:00.000Z', app: 'tekpractice', declaratif: true, items: [], trialsRaw: null, rigItems: [] }))
  await expect(page.locator('#status')).toContainText('quarantaine')
  await expect(page.locator('ol.trail')).toHaveCount(0)
})

test('garbage files give an error message, no crash, and a good file still opens after', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await open(page)
  await upload(page, 'x.json', 'this is not json {{{')
  await expect(page.locator('#status .error')).toContainText("n'a pas pu être lu")
  await upload(page, 'y.json', '{"hello":"world"}')
  await expect(page.locator('#status .error')).toContainText("n'a pas pu être lu")
  await upload(page, 'z.json', 'null')
  await expect(page.locator('#status .error')).toContainText("n'a pas pu être lu")
  await page.locator('#file').setInputFiles(FIXTURE)
  await expect(page.locator('ol.trail > li')).toHaveCount(fixture.trials.length)
  expect(errors).toEqual([])
})

test('a file over 10 MB is refused with a message, before parsing', async ({ page }) => {
  await open(page)
  await upload(page, 'big.json', ' '.repeat(10 * 1024 * 1024 + 1))
  await expect(page.locator('#status .error')).toContainText('dépasse 10 Mo')
  await expect(page.locator('ol.trail')).toHaveCount(0)
})

test('more than 500 trials is refused with a message', async ({ page }) => {
  await open(page)
  const data = { formatVersion: 1, exportedAt: '2026-10-24T10:00:00.000Z', app: 'tekpractice', declaratif: true, trials: Array.from({ length: 501 }, () => ({})) }
  await upload(page, 'many.json', JSON.stringify(data))
  await expect(page.locator('#status .error')).toContainText('plus de 500 essais')
})

test('several files: the first is read and the user is told', async ({ page }) => {
  await open(page)
  await page.locator('#file').setInputFiles([FIXTURE, FIXTURE])
  await expect(page.locator('ol.trail > li')).toHaveCount(fixture.trials.length)
  await expect(page.locator('#status')).toContainText('seul le premier est lu')
})

test('a tampered trial is rejected and reported, the others stay', async ({ page }) => {
  await open(page)
  const data = JSON.parse(readFileSync(FIXTURE, 'utf8'))
  data.trials[1].design.placements[0].position_m[0] += 1 // fingerprint no longer matches
  await upload(page, 't.json', JSON.stringify(data))
  await expect(page.locator('ol.trail > li')).toHaveCount(1)
  await expect(page.locator('#status .warn')).toContainText('1 essai')
})

test('works offline once loaded', async ({ page, context }) => {
  await open(page)
  await context.setOffline(true)
  await page.locator('#file').setInputFiles(FIXTURE)
  await expect(page.locator('ol.trail > li')).toHaveCount(fixture.trials.length)
})

test('390 px wide: no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  await page.locator('#file').setInputFiles(FIXTURE)
  await expect(page.locator('ol.trail > li').first()).toBeVisible()
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(over).toBeLessThanOrEqual(0)
})
