/**
 * T1.5b (onboarding packs, spec 6.5): Mode Création shows its own wording of the simulator rules R1 to R5 (COPY.ruleOverride, Appendix A) at every place it
 * quotes a rule, and the legacy route keeps the catalog text. The catalog is never edited.
 *
 * R1 (an XLR into a TT jack), R2 (a mic into a line input) and R3 (out to out) are REFUSALS of the engine: they reach the status list, the connect dialog
 * (« Incompatibles ») and Oscar's answer to the rule's title. They never reach Oscar's verdict bubble: the verdict reads the evaluator's rule events, and the
 * evaluator only emits R4 to R8 (R1 to R3 are invariants of the connection graph, `RuleEvaluator` header). The verdict bubble is therefore pinned with R4
 * (a condenser into a preamp with +48 V off), the one error rule Mode Création words itself that the evaluator emits.
 */
import { expect, test, type Page } from '@playwright/test'
import catalog from '../../content/catalog.json'
import { COPY } from '../../src/creation/copy'
import { quietWindow } from './waits'

test.use({ viewport: { width: 1366, height: 768 } })
// Software GL on a shared machine: each test boots a 3D page.
test.describe.configure({ timeout: 120_000 })

const RULE = (id: string) => catalog.rules.find((r) => r.id === id)!
/** What Mode Création must show, from COPY (pinned to the Appendix A texts by tests/creation/ruleOverrides.test.ts). */
const OVERRIDE = (id: string): string => (COPY.ruleOverride as Record<string, string>)[id]!
const PLACE = 'room:concert-hall-medium'
const ICON_NAME = 'Oscar, assistant IA'

// ── no console error or page error ───────────────────────────────────────────────────────────────────────────────────
let problems: string[] = []
test.beforeEach(({ page }) => {
  problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' || (m.type() === 'warning' && /guide:/i.test(m.text()))) problems.push(`${m.type()}: ${m.text()}`)
  })
})
test.afterEach(() => {
  expect(problems, 'console errors, page errors and guide warnings').toEqual([])
})

type Ref = { instance: string; port: string }
const SM58: Ref = { instance: 'sm58', port: 'out-xlr' }
const QL_L: Ref = { instance: 'ql1', port: 'out-main-l' }

/**
 * The three refusals, each with: the two ports, the opener port of the connect dialog (the origin), the substring that names the target in the dialog's
 * list, and the title the learner types to Oscar.
 */
const CASES = [
  { id: 'R1', a: SM58, b: { instance: 'pp', port: 'front-tt-1' }, code: 'CONNECTOR_MISMATCH', target: '(pp) · front-tt-1', ask: 'Connecteurs incompatibles' },
  { id: 'R2', a: SM58, b: { instance: 'k12-g', port: 'in-line-a' }, code: 'SIGNAL_MISMATCH', target: '(k12-g) · in-line-a', ask: 'Types de signal incompatibles' },
  { id: 'R3', a: QL_L, b: { instance: 'k12-g', port: 'thru-out-a' }, code: 'DIRECTION_MISMATCH', target: '(k12-g) · thru-out-a', ask: 'Sens de connexion incorrect' },
] as const

const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate((p) => window.__creation!.choosePlace(p), PLACE)
  await page.waitForFunction((p) => window.__creation!.place() === p, PLACE)
}
const spawnRig = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] })
    c.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58', position: [2, 0, 8] })
    c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [3, 0, -3] })
    c.dispatch({ type: 'SPAWN', deviceId: 'switchcraft-studiopatch-9625', instanceId: 'pp', position: [-3, 0, 8] })
  })
const select = async (page: Page, id: string): Promise<void> => {
  await page.locator('#renderCanvas').focus()
  for (let i = 0; i < 8 && (await page.evaluate(() => window.__creation!.selection())) !== id; i++) await page.keyboard.press(']')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe(id)
}

const icon = (page: Page) => page.getByRole('button', { name: ICON_NAME, exact: true })
const bubble = (page: Page) => page.locator('.oscar-bubble')
const chip = (page: Page, name: string) => page.locator('.oscar-chips').getByRole('button', { name, exact: true })
const live = (page: Page): Promise<string> => page.locator('.oscar-live').innerText()
const liveLines = (page: Page): Promise<string[]> => page.locator('.oscar-live').evaluate((el) => [...el.children].map((c) => (c.textContent ?? '').trim()))
const GUIDE_POLL_MS = 500
const openBubble = async (page: Page): Promise<void> => {
  await expect(icon(page)).toBeVisible()
  if (await bubble(page).isHidden()) {
    await quietWindow(page, GUIDE_POLL_MS * 3) // a quiet window: the guide reads the bench every 500 ms and closes a stale bubble
    await icon(page).click()
  }
  await expect(bubble(page)).toBeVisible()
}
const ask = async (page: Page, question: string): Promise<void> => {
  await openBubble(page)
  const input = page.getByRole('textbox', { name: /Poser une question/ })
  await input.fill(question)
  await input.press('Enter')
}
const nextStepSays = async (page: Page, text: string): Promise<void> => {
  await openBubble(page)
  await expect
    .poll(
      async () => {
        if (await bubble(page).isHidden()) await icon(page).click()
        await chip(page, 'Prochaine étape').click()
        return live(page)
      },
      { message: `« Prochaine étape » says: ${text}`, timeout: 15_000 },
    )
    .toContain(text)
}

/** The status list's rows (the pop-over of the signal button), first row. */
const firstErrorRow = async (page: Page) => {
  await page.getByTestId('signal-status').click()
  const row = page.getByRole('dialog', { name: 'Erreurs et avertissements' }).locator('.cr-errlist-row').first()
  await expect(row).toBeVisible()
  return row
}
const closeErrorList = async (page: Page): Promise<void> => {
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Erreurs et avertissements' })).toBeHidden()
}

for (const c of CASES) {
  test(`${c.id}: the status list, the connect dialog's « Incompatibles » reason and Oscar's answer all show the Mode Création text, never the catalog's`, async ({ page }) => {
    const rule = RULE(c.id)
    const shown = OVERRIDE(c.id)
    expect(shown, 'the override differs from the catalog text (else this test proves nothing)').not.toBe(rule.teach_fr)
    await boot(page)
    await spawnRig(page)

    // 1. the engine refuses the cable with this rule; the refusal is the status list's first row
    const r = await page.evaluate((i) => window.__creation!.dispatch({ type: 'CONNECT', a: i.a, b: i.b }), { a: c.a, b: c.b })
    expect(r.ok, 'the engine refuses the connection').toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.ruleId).toBe(c.id)
    expect(r.error.code).toBe(c.code)
    const row = await firstErrorRow(page)
    await expect(row).toHaveAttribute('data-severity', 'rejection')
    await expect(row.locator('.cr-errlist-rtitle')).toHaveText(rule.title_fr)
    await expect(row.locator('.cr-errlist-detail')).toHaveText(shown)
    await expect(row).not.toContainText(rule.teach_fr)
    await closeErrorList(page)

    // 2. the « Connecter à… » dialog: the same text, as the reason of the incompatible port
    await select(page, c.a.instance)
    const opener = page.locator(`[data-key="connect:${c.a.port}"]`)
    await opener.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByTestId('cr-connect-dialog')
    await expect(dialog).toBeVisible()
    await page.getByRole('combobox', { name: 'Filtrer' }).focus()
    await page.keyboard.press('Tab')
    const toggle = page.getByTestId('connect-rejected-toggle')
    await expect(toggle).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const entry = page.getByTestId('connect-rejected').getByRole('listitem').filter({ hasText: c.target })
    await expect(entry.locator('.cr-connect-reason')).toHaveText(rule.title_fr)
    await expect(entry.locator('.cr-connect-teach')).toHaveText(shown)
    await expect(entry).not.toContainText(rule.teach_fr)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    // 3. Oscar's answer to the rule's title
    await ask(page, c.ask)
    await expect(page.locator('.oscar-live')).toContainText(`${rule.title_fr} : ${shown}`)
    expect(await live(page)).not.toContain(rule.teach_fr)
  })
}

test('R4: the status list, the verdict bubble (« Correction à apporter ») and Oscar\'s answer all show the Mode Création text; R6 shows the catalog text', async ({ page }) => {
  const rule = RULE('R4')
  const shown = OVERRIDE('R4')
  expect(shown).not.toBe(rule.teach_fr)
  await boot(page)
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'neumann-u87-ai', instanceId: 'u87', position: [1, 0, 8] })
    c.dispatch({ type: 'SPAWN', deviceId: 'focusrite-isa-one', instanceId: 'isa', position: [2, 0, 8] })
    c.dispatch({ type: 'CONNECT', a: { instance: 'u87', port: 'out-xlr' }, b: { instance: 'isa', port: 'in-mic' } })
  })
  await page.waitForFunction(() => window.__creation!.events().some((e) => e.severity === 'error'))
  const row = await firstErrorRow(page)
  await expect(row.locator('.cr-errlist-rtitle')).toHaveText(rule.title_fr)
  await expect(row.locator('.cr-errlist-detail')).toHaveText(shown)
  await closeErrorList(page)

  await nextStepSays(page, shown)
  expect(await liveLines(page), 'the verdict bubble: the generic head, then the Mode Création text').toEqual(['Correction à apporter', shown])
  expect(await live(page)).not.toContain(rule.teach_fr)

  await ask(page, rule.title_fr)
  await expect(page.locator('.oscar-live')).toContainText(`${rule.title_fr} : ${shown}`)

  // R6 has no override: Oscar quotes the catalog text, word for word
  const r6 = RULE('R6')
  await ask(page, r6.title_fr)
  await expect(page.locator('.oscar-live')).toContainText(`${r6.title_fr} : ${r6.teach_fr}`)
})

test('legacy (?level=...): the level page keeps the catalog text in Oscar\'s answer and verdict, the override is never shown', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?level=d1&oscar=legacy')
  await page.waitForFunction(() => !!window.__audioSim)
  await expect(icon(page)).toBeVisible({ timeout: 30_000 })
  // the verdict: the level's first required connection raises R4 (as tests/e2e/guide-legacy.spec.ts pins)
  await page.evaluate(() => {
    const c = window.__audioSim!.level.requiredChain[0]
    window.__audioSim!.dispatch({ type: 'CONNECT', a: c.from, b: c.to })
  })
  const r4 = RULE('R4')
  await nextStepSays(page, r4.teach_fr)
  expect(await liveLines(page)).toEqual(['Correction à apporter', r4.teach_fr])
  expect(await live(page)).not.toContain(OVERRIDE('R4'))
  // Oscar's answer to a rule's title: the catalog row, for R1 (overridden in Mode Création) as well
  const r1 = RULE('R1')
  await ask(page, r1.title_fr)
  await expect(page.locator('.oscar-live')).toContainText(`${r1.title_fr} : ${r1.teach_fr}`)
  expect(await live(page)).not.toContain(OVERRIDE('R1'))
})
