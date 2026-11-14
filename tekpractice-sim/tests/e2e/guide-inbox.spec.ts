/**
 * The unanswered-questions inbox of the guide, end to end.
 *
 *  - On the normal build the flag is off: asking a question the guide cannot answer shows the fixed sentence alone, nothing is stored, no global exists, and the
 *    inbox chunk is never requested.
 *  - On a test-only build with the flag on (npm run build with TP_TEST_FEATURES=guideInbox into dist/guide-inbox-test, served on its own port, whose address is
 *    given in E2E_INBOX_URL; the specs below skip without it): the question is kept in this browser, one calm line follows the fixed sentence, the export has the
 *    documented shape, and in an exam, the sandbox, the teacher page and with ?oscar=0 there is no global, no storage key and no inbox chunk.
 *    There is no address that turns the flag on: the switch is the build.
 */
import { expect, test, type Page } from '@playwright/test'
import { INBOX_NOTED_A_VALIDER, INBOX_STORAGE_KEY } from '../../src/guide/inbox'
import { TP_STRINGS } from '../../src/guide/strings'

const INBOX_URL = process.env.E2E_INBOX_URL
const ICON_NAME = 'Oscar, assistant IA'
const PLACE = 'room:concert-hall-medium'
const QUESTION = 'quelle est la capitale de la Mongolie'
const NO_INFO = TP_STRINGS.ask.noInformation

test.describe.configure({ timeout: 120_000 })

const icon = (page: Page) => page.getByRole('button', { name: ICON_NAME, exact: true })
const liveLines = (page: Page): Promise<string[]> => page.locator('.oscar-live').evaluate((el) => [...el.children].map((c) => (c.textContent ?? '').trim()))

type Where = { name: string; search: string; hook: '__creation' | '__audioSim'; guide: boolean; path?: string }
const PRACTICE: Where[] = [
  { name: 'Mode Création', search: '', hook: '__creation', guide: true },
  { name: 'a level page (explicit opt-in)', search: '?level=a1&oscar=legacy', hook: '__audioSim', guide: true },
]
const SILENT: Where[] = [
  { name: 'an exam address of Mode Création', search: '?mode=exam', hook: '__creation', guide: false },
  { name: '?oscar=0 in Mode Création', search: '?oscar=0', hook: '__creation', guide: false },
  { name: 'a level exam', search: '?level=a1&mode=exam&oscar=legacy', hook: '__audioSim', guide: false },
  { name: 'a level page with ?oscar=0', search: '?level=a1&oscar=0', hook: '__audioSim', guide: false },
  { name: 'the sandbox', search: '?level=sandbox&oscar=legacy', hook: '__audioSim', guide: false },
  { name: 'a level page with no opt-in', search: '?level=a1', hook: '__audioSim', guide: false },
]

const requests = (page: Page): { paths: () => string[]; methods: () => Set<string>; origins: () => Set<string> } => {
  const seen: { url: string; method: string }[] = []
  page.context().on('request', (r) => seen.push({ url: r.url(), method: r.method() }))
  return {
    paths: () => seen.filter((s) => !/^(data|blob):/.test(s.url)).map((s) => new URL(s.url).pathname),
    methods: () => new Set(seen.map((s) => s.method)),
    origins: () => new Set(seen.filter((s) => !/^(data|blob):/.test(s.url)).map((s) => new URL(s.url).origin)),
  }
}

async function boot(page: Page, w: Where): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/' + w.search)
  await page.waitForFunction((h) => !!(window as unknown as Record<string, unknown>)[h], w.hook)
  if (w.hook === '__creation') {
    await page.evaluate((p) => window.__creation!.choosePlace(p), PLACE)
    await page.waitForFunction((p) => window.__creation!.place() === p, PLACE)
  }
}

async function ask(page: Page, question: string): Promise<void> {
  await expect(icon(page)).toBeVisible({ timeout: 30_000 })
  if (await page.locator('.oscar-bubble').isHidden()) await icon(page).click()
  const input = page.getByRole('textbox', { name: /Poser une question/ })
  await input.fill(question)
  await input.press('Enter')
  await expect(page.locator('.oscar-live')).toContainText(NO_INFO)
}

const storageKeys = (page: Page): Promise<string[]> => page.evaluate(() => Object.keys(window.localStorage))
const inboxGlobal = (page: Page): Promise<boolean> => page.evaluate(() => '__oscarQuestions' in window)

// ── the normal build: dark ───────────────────────────────────────────────────────────────────────────────────────────

test.describe('flag off (the normal build)', () => {
  test.skip(INBOX_URL !== undefined && INBOX_URL !== '', 'the flag-on build is under test')

  for (const w of PRACTICE) {
    test(`${w.name}: the fixed sentence alone, nothing stored, no global, no inbox chunk`, async ({ page }) => {
      const req = requests(page)
      await boot(page, w)
      await ask(page, QUESTION)
      expect(await liveLines(page), 'the refusal is the fixed sentence and nothing else').toEqual([NO_INFO])
      expect(await page.locator('.oscar-live').innerText()).not.toContain(INBOX_NOTED_A_VALIDER)
      expect(await inboxGlobal(page)).toBe(false)
      expect((await storageKeys(page)).filter((k) => /inbox|question/i.test(k)), 'no inbox key').toEqual([])
      expect(await page.evaluate((k) => window.localStorage.getItem(k), INBOX_STORAGE_KEY)).toBeNull()
      expect(req.paths().filter((p) => /inbox/i.test(p)), 'the inbox chunk is never requested').toEqual([])
    })
  }

  for (const w of SILENT) {
    test(`${w.name}: no global, no storage key, no inbox chunk`, async ({ page }) => {
      const req = requests(page)
      await boot(page, w)
      await page.waitForTimeout(1500)
      expect(await inboxGlobal(page)).toBe(false)
      expect((await storageKeys(page)).filter((k) => /inbox|question/i.test(k))).toEqual([])
      expect(req.paths().filter((p) => /inbox/i.test(p))).toEqual([])
    })
  }

  test('the teacher page: no global, no storage key', async ({ page }) => {
    await page.goto('/teacher.html')
    await page.waitForLoadState('networkidle')
    expect(await inboxGlobal(page)).toBe(false)
    expect((await storageKeys(page)).filter((k) => /inbox|question/i.test(k))).toEqual([])
  })
})

// ── the test-only build with the flag on ─────────────────────────────────────────────────────────────────────────────

test.describe('flag on (test-only build)', () => {
  test.skip(INBOX_URL === undefined || INBOX_URL === '', 'needs E2E_INBOX_URL: a preview of the build made with TP_TEST_FEATURES=guideInbox')
  test.use({ baseURL: INBOX_URL })

  for (const w of PRACTICE) {
    test(`${w.name}: the question is kept, the fixed sentence comes first, one calm line follows, the export is the contract, nothing leaves the browser`, async ({ page }) => {
      const req = requests(page)
      await boot(page, w)
      await expect(icon(page)).toBeVisible({ timeout: 30_000 })
      await expect.poll(() => inboxGlobal(page), { message: 'the guide mounted, so the inbox global is defined' }).toBe(true)
      expect(await page.evaluate(() => Object.keys(window.__oscarQuestions!).sort())).toEqual(['clear', 'export'])
      expect(JSON.parse(await page.evaluate(() => window.__oscarQuestions!.export())).questions).toEqual([])
      expect(await page.evaluate((k) => window.localStorage.getItem(k), INBOX_STORAGE_KEY), 'nothing is stored before a question is asked').toBeNull()

      await ask(page, QUESTION)
      await expect.poll(() => liveLines(page)).toEqual([NO_INFO, INBOX_NOTED_A_VALIDER])
      await expect.poll(async () => (JSON.parse(await page.evaluate(() => window.__oscarQuestions!.export())).questions as { count: number }[]).map((x) => x.count)).toEqual([1])
      // the same question again, written differently: one question, counted twice
      await ask(page, `  ${QUESTION.toUpperCase()} ?`)
      await expect.poll(async () => (JSON.parse(await page.evaluate(() => window.__oscarQuestions!.export())).questions as { count: number }[]).map((x) => x.count)).toEqual([2])
      expect(await liveLines(page)).toEqual([NO_INFO, INBOX_NOTED_A_VALIDER])

      const out = JSON.parse(await page.evaluate(() => window.__oscarQuestions!.export())) as { version: number; exportedAt: string; questions: Record<string, unknown>[] }
      expect(Object.keys(out).sort()).toEqual(['exportedAt', 'questions', 'version'])
      expect(out.version).toBe(1)
      expect(new Date(out.exportedAt).toISOString()).toBe(out.exportedAt)
      expect(out.questions).toHaveLength(1)
      const q = out.questions[0]
      expect(Object.keys(q).sort()).toEqual(['count', 'firstSeen', 'lastSeen', 'route', 'text'])
      expect(q.text).toBe(QUESTION)
      expect(q.count).toBe(2)
      expect(q.route).toBe(w.hook === '__creation' ? 'creation' : 'legacy')
      expect(new Date(q.firstSeen as string).toISOString()).toBe(q.firstSeen)
      expect((q.firstSeen as string) <= (q.lastSeen as string)).toBe(true)

      // it survives a reload (this browser's storage) and is the only key the inbox owns
      expect((await storageKeys(page)).filter((k) => /inbox|question/i.test(k))).toEqual([INBOX_STORAGE_KEY])
      // nothing left the browser: only GETs of this origin's files, none of them about the question
      expect([...req.methods()]).toEqual(['GET'])
      expect([...req.origins()]).toEqual([new URL(INBOX_URL!).origin])
      expect(req.paths().filter((p) => /inbox/i.test(p)), 'the inbox chunk loads once, on the first unanswered question').toHaveLength(1)
      expect(req.paths().join(' ')).not.toContain('Mongolie')

      await page.evaluate(() => window.__oscarQuestions!.clear())
      expect(await page.evaluate((k) => window.localStorage.getItem(k), INBOX_STORAGE_KEY)).toBeNull()
      expect(JSON.parse(await page.evaluate(() => window.__oscarQuestions!.export())).questions).toEqual([])
    })
  }

  test('an answered question (a rule of the app) is not kept', async ({ page }) => {
    await boot(page, PRACTICE[0])
    await expect(icon(page)).toBeVisible({ timeout: 30_000 })
    await icon(page).click()
    const input = page.getByRole('textbox', { name: /Poser une question/ })
    await input.fill('que veut dire alimentation fantôme')
    await input.press('Enter')
    await expect(page.locator('.oscar-live')).not.toBeEmpty()
    expect(await page.evaluate((k) => window.localStorage.getItem(k), INBOX_STORAGE_KEY)).toBeNull()
  })

  for (const w of SILENT) {
    test(`${w.name}: still no global, no storage key and no inbox chunk with the flag on`, async ({ page }) => {
      const req = requests(page)
      await boot(page, w)
      await page.waitForTimeout(2500)
      expect(await inboxGlobal(page)).toBe(false)
      expect((await storageKeys(page)).filter((k) => /inbox|question/i.test(k))).toEqual([])
      expect(req.paths().filter((p) => /inbox/i.test(p))).toEqual([])
    })
  }

  test('the teacher page: no global, no storage key with the flag on', async ({ page }) => {
    await page.goto('/teacher.html')
    await page.waitForLoadState('networkidle')
    expect(await inboxGlobal(page)).toBe(false)
    expect((await storageKeys(page)).filter((k) => /inbox|question/i.test(k))).toEqual([])
  })

  test('in an exam address the guide is not mounted, so a question cannot even be asked', async ({ page }) => {
    await boot(page, SILENT[0])
    await page.waitForTimeout(2500)
    await expect(icon(page)).toHaveCount(0)
    expect(await page.evaluate((k) => window.localStorage.getItem(k), INBOX_STORAGE_KEY)).toBeNull()
  })
})
