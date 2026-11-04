/**
 * Night wave 2, items A to D and I: the narrow (phone sized, 400 x 800) and touch layout of the shell, and the status bar's discipline.
 *  A. Below 760 px Projet starts folded, so the 3D view is not 168 px wide; the tree can be reopened.
 *  B. Status bar at <= 760 px: place, selection, snapping, autosave, playback and mic groups give way; the Signal button is fully
 *     inside the window and opens the error list.
 *  C. Status bar discipline: no place name during a pose; on the first screen (the picker) only the message and the autosave warning.
 *  D. Notes and toast during a pose: the notes stack is capped, the missing-devices list is out of the way, the toast clears « Annuler la pose ».
 */
import { expect, test, type Page } from '@playwright/test'

const PLACE = 'room:concert-hall-medium'
type Box = { x: number; y: number; width: number; height: number }

const boot = async (page: Page, place: string | null = PLACE): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  if (place) {
    await page.evaluate((p) => window.__creation!.choosePlace(p), place)
    await page.waitForFunction((p) => window.__creation!.place() === p, place)
  }
}
const meets = (a: Box, c: Box): boolean => a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height
const box = async (loc: ReturnType<Page['locator']>): Promise<Box> => (await loc.boundingBox())!
const canvas = (page: Page) => page.locator('#renderCanvas')
const cancelButton = (page: Page) => page.getByRole('button', { name: 'Annuler la pose' })
/** Starts a pose of a console: the drawer, the Consoles tab, the device (as creation-place-extras). */
const startPose = async (page: Page): Promise<void> => {
  await canvas(page).focus()
  await page.keyboard.press('Space')
  await page.getByRole('tab', { name: 'Consoles' }).click()
  await page.locator('[data-testid="inventory-item"][data-device-id="yamaha-ql1"]').click()
  await expect(page.getByTestId('inventory-drawer')).toBeHidden()
  await expect.poll(() => page.evaluate(() => window.__creation!.placing())).toBe(true)
}

test.describe('phone sized window, 400 x 800', () => {
  test.use({ viewport: { width: 400, height: 800 } })

  test('A: Projet starts folded, the 3D view is at least 300 px wide, and the tree can be reopened', async ({ page }) => {
    await boot(page)
    const toggle = page.getByTestId('tree-collapse')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const view = await box(page.getByTestId('viewport'))
    expect(view.width, 'the view on first open').toBeGreaterThanOrEqual(300)
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('tree')).toBeVisible()
    // the user's choice stays: a script folding it again is honoured and nothing re-opens it
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('B: the Signal button is fully inside the window and opens the error list; the groups that do not fit give way', async ({ page }) => {
    await boot(page)
    const signal = page.getByTestId('signal-status')
    const s = await box(signal)
    expect(s.x, 'Signal left edge').toBeGreaterThanOrEqual(0)
    expect(s.x + s.width, 'Signal right edge').toBeLessThanOrEqual(400)
    const bar = await box(page.getByTestId('status-bar'))
    expect(s.y).toBeGreaterThanOrEqual(bar.y)
    expect(s.y + s.height).toBeLessThanOrEqual(bar.y + bar.height + 0.5)
    for (const id of ['status-selection', 'status-playback', 'status-autosave']) await expect(page.getByTestId(id)).toBeHidden()
    await expect(page.locator('.cr-status-place')).toBeHidden()
    await expect(page.locator('.cr-status-msg')).toBeVisible()
    await signal.click()
    const list = page.getByTestId('error-list')
    await expect(list).toBeVisible()
    const l = await box(list)
    expect(l.x).toBeGreaterThanOrEqual(0)
    expect(l.x + l.width).toBeLessThanOrEqual(400)
    // what a tap at its first corner reaches is the list itself, not the bar
    expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-testid="error-list"]'), { x: l.x + 20, y: l.y + 20 })).toBe(true)
  })

  test('B: the autosave WARNING survives, and « Annuler la pose » is not overlapped by the open list during a pose', async ({ page }) => {
    await boot(page)
    // a paused autosave is a warning, not an extra: it stays in the bar at this width
    await page.evaluate(() => {
      const p = document.querySelector<HTMLElement>('[data-testid="status-autosave-paused"]')!
      p.hidden = false
      p.querySelector('.cr-status-pause-text')!.textContent = 'Sauvegarde automatique en pause : exportez les données mises de côté pour la reprendre.' // the longest real line is of this size
      const b = p.querySelector<HTMLElement>('.cr-status-action')!
      b.hidden = false
      b.textContent = 'Exporter les données'
    })
    const pause = await box(page.getByTestId('status-autosave-paused'))
    expect(pause.x + pause.width, 'the warning stays inside the window').toBeLessThanOrEqual(400)
    await expect(page.getByTestId('status-autosave-paused')).toBeVisible()
    const act = await box(page.getByTestId('status-autosave-action'))
    expect(act.x + act.width, 'its action button stays inside the window').toBeLessThanOrEqual(400)
    const sg = await box(page.getByTestId('signal-status'))
    expect(sg.x + sg.width, 'with the Signal button').toBeLessThanOrEqual(400)
    expect(meets(act, sg), 'the action does not overlap Signal').toBe(false)
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('[data-testid="status-autosave-paused"]')!.hidden = true
    })
    await startPose(page)
    await page.getByTestId('signal-status').click()
    const list = await box(page.getByTestId('error-list'))
    const cancel = await box(cancelButton(page))
    expect(meets(list, cancel), `list ${JSON.stringify(list)} vs button ${JSON.stringify(cancel)}`).toBe(false)
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-testid'), { x: cancel.x + cancel.width / 2, y: cancel.y + cancel.height / 2 })).toBe('cancel-placement')
  })
})

// ── C: status bar discipline (desktop size) ──────────────────────────────────────────────────────
test.describe('status bar discipline at 1366 x 768', () => {
  test.use({ viewport: { width: 1366, height: 768 } })

  test('C: on the first screen the bar keeps its message, and says nothing about selection, playback, microphone or signal', async ({ page }) => {
    await boot(page, null)
    await expect(page.getByTestId('place-picker')).toBeVisible()
    for (const id of ['status-selection', 'status-playback', 'status-mic', 'signal-status']) await expect(page.getByTestId(id)).toBeHidden()
    await expect(page.locator('.cr-status-msg')).toBeVisible()
    await page.evaluate((p) => window.__creation!.choosePlace(p), PLACE)
    await page.waitForFunction((p) => window.__creation!.place() === p, PLACE)
    await expect(page.getByTestId('signal-status')).toBeVisible()
    await expect(page.getByTestId('status-selection')).toBeVisible()
    // the picker reopened over a place keeps the signal button (its « Fermer » is there: not the first screen)
    await page.getByRole('menuitem', { name: 'Lieu' }).click()
    await page.getByRole('menuitem', { name: 'Choisir un lieu…' }).click()
    await expect(page.getByTestId('place-picker')).toBeVisible()
    await expect(page.getByTestId('signal-status')).toBeVisible()
  })

  test('C: the place name is ellipsised when long, and absent from the bar while a pose runs (the key hints stay)', async ({ page }) => {
    await boot(page)
    const place = page.locator('.cr-status-place')
    await expect(place).toBeVisible()
    await page.evaluate(() => {
      document.querySelector('.cr-status-place')!.textContent = 'Un lieu dont le nom est très très long, bien plus long que trente-deux caractères'
    })
    const w = await box(place)
    expect(w.width, 'max 32ch').toBeLessThanOrEqual(32 * 8)
    expect(await place.evaluate((e) => getComputedStyle(e).textOverflow)).toBe('ellipsis')
    await page.evaluate(() => {
      document.querySelector('.cr-status-place')!.textContent = 'Salle de concert (moyenne)'
    })
    await startPose(page)
    await expect(place).toBeHidden()
    const msg = (await page.locator('.cr-status-msg').textContent())!
    expect(msg.length, 'the key hints are what the bar says during a pose').toBeGreaterThan(10)
    await page.keyboard.press('Escape')
    await expect.poll(() => page.evaluate(() => window.__creation!.placing())).toBe(false)
    await expect(place).toBeVisible()
  })
})

// ── D: notes and toast during a pose ─────────────────────────────────────────────────────────────
for (const vp of [{ width: 400, height: 800 }, { width: 1366, height: 768 }]) {
  test.describe(`notes and toast during a pose, ${vp.width} x ${vp.height}`, () => {
    test.use({ viewport: vp })

    const fillNotes = async (page: Page): Promise<void> => {
      await page.evaluate(() => {
        const stack = document.querySelector('[data-testid="notes"]')!
        for (let i = 0; i < 4; i++) {
          const n = document.createElement('section')
          n.className = 'cr-note'
          n.style.minHeight = '140px'
          n.innerHTML = '<h3 class="cr-note-title">Une note</h3><p class="cr-note-body">Texte</p><ul class="cr-note-list"><li>Un appareil</li><li>Un autre</li></ul>'
          stack.append(n)
        }
      })
    }

    test('D: the notes stack never reaches the view cube and scrolls inside itself; the missing-devices list steps aside during a pose', async ({ page }) => {
      await boot(page)
      await fillNotes(page)
      const stack = page.locator('[data-testid="notes"]')
      const cube = await page.evaluate(() => window.__creation!.cubeRect())
      const s = await box(stack)
      expect(s.y, 'below the view cube').toBeGreaterThanOrEqual(cube.y + cube.height)
      const tools = await box(page.locator('.cr-cube-tools'))
      expect(meets(s, tools), 'clear of the cube tools').toBe(false)
      expect(await stack.evaluate((e) => e.scrollHeight > e.clientHeight), 'it scrolls inside itself').toBe(true)
      await expect(page.locator('.cr-note-list').first()).toBeVisible()
      // wave 2c (S7): the notes are still on screen when the drawer opens and a pose is started through it (they used to cover its tabs)
      await startPose(page)
      await expect(page.locator('.cr-note-list').first()).toBeHidden()
      const s2 = await box(stack)
      const cancel = await box(cancelButton(page))
      expect(s2.y, 'still below the view cube during a pose').toBeGreaterThanOrEqual(cube.y + cube.height)
      expect(meets(s2, cancel), 'clear of « Annuler la pose »').toBe(false)
      await page.keyboard.press('Escape')
      await expect(page.locator('.cr-note-list').first()).toBeVisible()
    })

    test('S3 and S7: a toast is drawn above the notes; the open drawer is drawn above the notes (its tabs are what a tap reaches)', async ({ page }) => {
      await boot(page)
      await fillNotes(page)
      await page.evaluate(() => {
        const t = document.querySelector<HTMLElement>('[data-testid="toast"]')!
        t.hidden = false
        t.textContent = 'Rien ici : Espace ouvre le tiroir des appareils pour en poser un.'
      })
      const z = (sel: string) => page.locator(sel).first().evaluate((e) => Number(getComputedStyle(e).zIndex))
      const t = await box(page.getByTestId('toast'))
      const s = await box(page.getByTestId('notes'))
      expect(meets(t, s), 'the toast and the notes do share some screen (the test means something)').toBe(true)
      expect(await z('.cr-toast'), 'toast above the notes').toBeGreaterThan(await z('.cr-notes'))
      await page.evaluate(() => (document.querySelector<HTMLElement>('[data-testid="toast"]')!.hidden = true))
      await page.locator('#renderCanvas').focus()
      await page.keyboard.press('Space')
      await expect(page.getByTestId('inventory-drawer')).toBeVisible()
      expect(await z('.cr-drawer'), 'drawer above the notes while open').toBeGreaterThan(await z('.cr-notes'))
      const tab = await box(page.getByRole('tab').first())
      expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('role'), { x: tab.x + tab.width / 2, y: tab.y + tab.height / 2 }), 'a tap on the first tab reaches the tab').toBe('tab')
      await page.keyboard.press('Escape')
      await expect.poll(() => z('.cr-notes'), 'the notes are back on top once the drawer is closed').toBeGreaterThan(await z('.cr-drawer'))
    })

    test('S8: a capped notes stack scrolls under a real wheel, and its scrollbar belongs to it (not to the 3D view below)', async ({ page }) => {
      await boot(page)
      await fillNotes(page)
      const stack = page.getByTestId('notes')
      expect(await stack.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true)
      const s = await box(stack)
      await page.mouse.move(s.x + s.width / 2, s.y + 60)
      await page.mouse.wheel(0, 240)
      await expect.poll(() => stack.evaluate((e) => e.scrollTop), 'a wheel over a note scrolls the stack').toBeGreaterThan(0)
      const bar = await stack.evaluate((e) => (e as HTMLElement).offsetWidth - e.clientWidth)
      if (bar === 0) test.info().annotations.push({ type: 'skipped-check', description: 'overlay scrollbars (no track width): the scrollbar-track hit test below does not apply; the wheel scroll above is the check' })
      if (bar > 0) {
        // classic scrollbars take room: the point on the bar is the stack's (a pointer-events: none stack handed it to the canvas)
        const onBar = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-testid="notes"]') !== null, { x: s.x + s.width - bar / 2, y: s.y + s.height / 2 })
        expect(onBar, 'the scrollbar track is the stack\'s').toBe(true)
      }
      expect(await stack.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe('auto')
    })

    test('night wave 3b: a stack that does not overflow takes no click in the gaps between its notes (they reach the 3D view); an overflowing one keeps its whole box', async ({ page }) => {
      await boot(page)
      const addNotes = (n: number): Promise<void> =>
        page.evaluate((count) => {
          const stack = document.querySelector('[data-testid="notes"]')!
          for (let i = 0; i < count; i++) {
            const note = document.createElement('section')
            note.className = 'cr-note'
            note.innerHTML = '<h3 class="cr-note-title">Une note</h3><p class="cr-note-body">Texte</p>'
            stack.append(note)
          }
        }, n)
      await addNotes(2)
      const stack = page.getByTestId('notes')
      expect(await stack.evaluate((e) => e.scrollHeight > e.clientHeight), 'two short notes fit').toBe(false)
      const notes = page.locator('[data-testid="notes"] .cr-note')
      const a = await box(notes.nth(0))
      const b = await box(notes.nth(1))
      const gap = { x: a.x + a.width / 2, y: (a.y + a.height + b.y) / 2 }
      expect(b.y - (a.y + a.height), 'there is a gap between the two notes (the test means something)').toBeGreaterThanOrEqual(4)
      const hit = (p: { x: number; y: number }) => page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e?.id || (e?.closest('.cr-note') ? 'note' : e?.closest('[data-testid="notes"]') ? 'notes' : e?.tagName) }, p)
      expect(await hit(gap), 'a click in the gap reaches the canvas').toBe('renderCanvas')
      expect(await stack.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe('none')
      // the notes themselves stay clickable
      expect(await hit({ x: a.x + a.width / 2, y: a.y + a.height / 2 }), 'a note takes its own clicks').toBe('note')
      await expect(page.locator('.cr-note-title').first()).toBeVisible()
      // fill it up: the stack scrolls, owns its box again (scrollbar draggable), and gives it back when it fits again
      await addNotes(6)
      await expect.poll(() => stack.evaluate((e) => e.scrollHeight > e.clientHeight), 'eight notes overflow').toBe(true)
      await expect.poll(() => stack.evaluate((e) => getComputedStyle(e).pointerEvents), 'an overflowing stack takes events (its scrollbar)').toBe('auto')
      await page.evaluate(() => { document.querySelectorAll('[data-testid="notes"] .cr-note').forEach((n, i) => i >= 2 && n.remove()) })
      await expect.poll(() => stack.evaluate((e) => getComputedStyle(e).pointerEvents), 'it fits again: events pass through').toBe('none')
    })

    test('D: the toast stands above « Annuler la pose » during a pose', async ({ page }) => {
      await boot(page)
      await startPose(page)
      await page.evaluate(() => {
        const t = document.querySelector<HTMLElement>('[data-testid="toast"]')!
        t.hidden = false
        t.textContent = 'Rien ici : Espace ouvre le tiroir des appareils pour en poser un.'
      })
      const t = await box(page.getByTestId('toast'))
      const cancel = await box(cancelButton(page))
      expect(meets(t, cancel), `toast ${JSON.stringify(t)} vs button ${JSON.stringify(cancel)}`).toBe(false)
      expect(t.x).toBeGreaterThanOrEqual(0)
      expect(t.x + t.width).toBeLessThanOrEqual(vp.width)
    })
  })
}

// ── S7 (final fix round): on a short window the notes cap (100% - 220px) used to reach 0 ───────────────────────────────────────────────
test.describe('short landscape window with touch, 844 x 300', () => {
  test.use({ viewport: { width: 844, height: 300 }, hasTouch: true })
  test('S7: the notes stay visible (at least 96 px), clear of « Annuler la pose » and inside the window; the status bar is intact', async ({ page }) => {
    await boot(page)
    await page.evaluate(() => {
      const stack = document.querySelector('[data-testid="notes"]')!
      for (let i = 0; i < 4; i++) {
        const n = document.createElement('section')
        n.className = 'cr-note'
        n.style.minHeight = '140px'
        n.innerHTML = '<h3 class="cr-note-title">Une note</h3><p class="cr-note-body">Texte</p>'
        stack.append(n)
      }
    })
    const stack = page.getByTestId('notes')
    const before = await box(stack)
    expect(before.height, 'the capped stack is not squeezed to nothing on a 300 px window').toBeGreaterThanOrEqual(96)
    await startPose(page)
    const s = await box(stack)
    const cancel = await box(cancelButton(page))
    const status = await box(page.getByTestId('status-bar'))
    expect(s.height, 'still at least 96 px during a pose').toBeGreaterThanOrEqual(96)
    expect(meets(s, cancel), `notes ${JSON.stringify(s)} vs « Annuler la pose » ${JSON.stringify(cancel)}`).toBe(false)
    expect(s.y, 'notes inside the window (top)').toBeGreaterThanOrEqual(0)
    expect(s.y + s.height, 'notes inside the window (bottom)').toBeLessThanOrEqual(300)
    expect(meets(s, status), 'notes clear of the status bar').toBe(false)
    expect(status.y + status.height, 'the status bar ends at the window bottom').toBe(300)
    expect(status.height).toBeGreaterThan(20)
    await expect(page.getByTestId('signal-status')).toBeVisible()
  })
})

// ── S6 (wave 2c): between 761 and ~1100 px the right group of the status bar shrinks, the Signal button never leaves the window ──────────
for (const width of [761, 800, 1024]) {
  test.describe(`status bar at ${width} px with a long selection and a playback line`, () => {
    test.use({ viewport: { width, height: 700 } })
    test(`S6: the Signal button is fully inside the window at ${width} px`, async ({ page }) => {
      await boot(page)
      await page.evaluate(() => {
        const set = (id: string, text: string) => {
          const e = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
          e.hidden = false
          e.textContent = text
        }
        set('status-selection', 'Sélection : Avid Pro Tools HDX avec un nom d’appareil vraiment très long (avid-protools-hdx)')
        set('status-playback', 'Aucune source de lecture dans le projet : branchez un ordinateur ou une interface audio')
        set('status-mic', 'Micro OK')
      })
      const s = await box(page.getByTestId('signal-status'))
      expect(s.x, 'Signal left edge').toBeGreaterThanOrEqual(0)
      expect(s.x + s.width, `Signal right edge (${JSON.stringify(s)})`).toBeLessThanOrEqual(width)
      const bar = await box(page.getByTestId('status-bar'))
      expect(s.y + s.height).toBeLessThanOrEqual(bar.y + bar.height + 0.5)
      await page.getByTestId('signal-status').click()
      await expect(page.getByTestId('error-list')).toBeVisible()
    })
  })
}
