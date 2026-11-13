/**
 * The new Oscar's character sheet for the founder (plan T5.2): the nine states at 24, 56 and 128 px on Prune, Nuit and Papier, written to
 * test-results/screens/oscar-sheet.png (git-ignored; Playwright empties test-results at the start of each run, so run this file LAST).
 * The poses are the static ones (reduced motion emulated): what each state settles on. The motion is in character.css and tested in character.spec.ts.
 * OFF unless `ONBOARDING_SCREENS=1` (it asserts nothing but that the page drew):
 * `$env:ONBOARDING_SCREENS='1'; $env:E2E_PORT='4391'; npx.cmd playwright test character-sheet` (after a fresh build, like every e2e here).
 * The labels are test-page text (state ids and sizes), never shown in the app.
 */
import { mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { CHARACTER_STATES } from '../../src/guide/character'
import { NUIT, PAPIER, PRUNE, openCharacterPage } from '../guide/characterHarness'

test.skip(process.env.ONBOARDING_SCREENS !== '1', 'screens for the founder: set ONBOARDING_SCREENS=1')
test.use({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 })
const OUT = 'test-results/screens'

test('character sheet: nine states x 24 / 56 / 128 px x Prune / Nuit / Papier', async ({ page }) => {
  mkdirSync(OUT, { recursive: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openCharacterPage(page, { ground: '#2a2529' })
  const grounds = [
    { name: 'Prune', c: PRUNE, ink: '#F3EDE3' },
    { name: 'Nuit', c: NUIT, ink: '#F3EDE3' },
    { name: 'Papier', c: PAPIER, ink: '#131114' },
  ]
  const states = [...CHARACTER_STATES]
  await page.evaluate(
    ({ grounds, states }) => {
      const sheet = document.createElement('div')
      sheet.id = 'sheet'
      sheet.style.cssText = 'display:inline-block;padding:8px'
      document.body.appendChild(sheet)
      grounds.forEach((g, gi) => {
        const band = document.createElement('div')
        band.style.cssText = `background:${g.c};color:${g.ink};padding:6px 8px 10px;margin-bottom:6px;display:grid;grid-template-columns:52px repeat(${states.length}, 140px);align-items:end;row-gap:6px`
        sheet.appendChild(band)
        const label = (t: string) => {
          const l = document.createElement('div')
          l.textContent = t
          l.style.cssText = 'font:12px/1.2 system-ui,sans-serif;opacity:.85'
          band.appendChild(l)
        }
        label(g.name)
        states.forEach((s) => label(s))
        ;[24, 56, 128].forEach((size) => {
          label(size + ' px')
          states.forEach((s, si) => {
            const holder = document.createElement('div')
            holder.id = `h-${gi}-${size}-${si}`
            band.appendChild(holder)
            window.__tpo.cell({ id: `s-${gi}-${size}-${si}`, size, state: s, ground: g.c, parent: holder.id })
          })
        })
      })
    },
    { grounds, states },
  )
  await expect(page.locator('.tpo')).toHaveCount(grounds.length * 3 * states.length)
  await page.locator('#sheet').screenshot({ path: `${OUT}/oscar-sheet.png` })
})

/**
 * The motion as a filmstrip (test-results/screens/oscar-motion.png): each state entered from idle, 9 frames from 0 to the end of its motion
 * (the real CSS animations and transitions of character.css, paused and seeked), 72 px on Nuit. Idle is its own entrance (the breath and blink).
 */
test('motion filmstrip: each state, 9 frames over its duration', async ({ page }) => {
  mkdirSync(OUT, { recursive: true })
  await openCharacterPage(page, { ground: '#2a2529' })
  const rows: { state: (typeof CHARACTER_STATES)[number]; ms: number }[] = [
    { state: 'idle', ms: 4000 },
    { state: 'walk', ms: 1100 },
    { state: 'point', ms: 220 },
    { state: 'think', ms: 5200 },
    { state: 'celebrate', ms: 1000 },
    { state: 'shrug', ms: 700 },
    { state: 'nod', ms: 600 },
    { state: 'wave', ms: 1200 },
    { state: 'sleep', ms: 200 },
  ]
  const FRAMES = 9
  const counts = await page.evaluate(
    ({ rows, FRAMES, ground }) => {
      const sheet = document.createElement('div')
      sheet.id = 'film'
      sheet.style.cssText = `display:inline-grid;grid-template-columns:90px repeat(${FRAMES}, 80px);gap:4px 6px;padding:10px;background:${ground};color:#F3EDE3;font:12px/1.2 system-ui,sans-serif;align-items:center`
      document.body.appendChild(sheet)
      const out: number[] = []
      rows.forEach((r, ri) => {
        const label = document.createElement('div')
        label.textContent = `${r.state} ${r.ms} ms`
        sheet.appendChild(label)
        for (let f = 0; f < FRAMES; f++) {
          const holder = document.createElement('div')
          holder.id = `fh-${ri}-${f}`
          sheet.appendChild(holder)
          const id = `f-${ri}-${f}`
          window.__tpo.cell({ id, size: 72, state: 'idle', ground, parent: holder.id })
          if (r.state !== 'idle') window.__tpo.pose(id, r.state)
          out.push(window.__tpo.seek(id, (r.ms * f) / (FRAMES - 1)))
        }
      })
      return out
    },
    { rows, FRAMES, ground: NUIT },
  )
  expect(counts.some((n) => n > 0)).toBe(true)
  await page.locator('#film').screenshot({ path: `${OUT}/oscar-motion.png`, animations: 'allow' })
})
