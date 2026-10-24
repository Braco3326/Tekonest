/**
 * Essais (Task 14, ADR-0012 phase 1): freeze → stale → child → compare flip
 * (read-only preview at the trial's camera) → Esc restores the live setup →
 * export / import round trip. Exam mode has no panel (D2). No acoustic numbers.
 */
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

type Pose = { alpha: number; beta: number; radius: number; target: [number, number, number] }
type StoredTrial = {
  id: string
  name: string
  parentId: string | null
  view: { pose: Pose }
  design: { placements: { instanceId: string; position_m: number[] }[] }
  evidence: { prediction: { text: string } }
}

const trials = (page: Page): Promise<StoredTrial[]> =>
  page.evaluate(() => {
    const raw = window.localStorage.getItem('audio-sim/trials')
    return raw ? JSON.parse(raw).trials : []
  })
const pose = (page: Page, id: string) => page.evaluate((i) => window.__audioSim!.pose!(i), id)
const near = (a: number, b: number, eps = 0.01): boolean => Math.abs(a - b) <= eps
/** Alpha is an angle: equal modulo 2π. */
const sameAngle = (a: number, b: number, eps = 0.01): boolean => {
  const d = (((a - b) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI
  return Math.abs(d) <= eps
}

async function freeze(page: Page, prediction: string): Promise<void> {
  await page.locator('#es-prediction').fill(prediction)
  await page.locator('#es-prediction').blur() // keys never fire while typing
  await page.keyboard.press('KeyG')
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }) // cuts, not flights: exact poses
  await page.goto('/?level=sandbox')
  await page.waitForFunction(() => !!window.__audioSim)
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!window.__audioSim)
})

test('freeze → stale → child → compare flip → Esc → export / import', async ({ page }, info) => {
  // 1. Place two devices, open the panel, write a prediction.
  await page.evaluate(() => {
    const sim = window.__audioSim!
    sim.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', position: [1.2, 0, -1], rotationY: 0 })
    sim.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', position: [-1.4, 0, 0.6], rotationY: 90 })
  })
  await page.getByRole('button', { name: 'Essais' }).click()
  await expect(page.locator('#essais-panel')).toBeVisible()
  await expect(page.locator('#essais-toggle')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#essais-caption')).toHaveText('Affiché : Montage actuel · pas encore figé')
  await expect(page.locator('.es-empty')).toHaveText('Aucun essai. Placez le matériel, écrivez votre prédiction, puis figez.')

  // 2. G → one Essai, displayed, up to date.
  await freeze(page, 'Je change rien, je m’attends à un montage de base.')
  await expect(page.locator('.es-row')).toHaveCount(1)
  await expect(page.locator('.es-row').first()).toContainText('Essai A')
  await expect(page.locator('#essais-caption')).toHaveText('Affiché : Essai A · Montage actuel : à jour')
  await expect(page.locator('.es-current-state')).toHaveText("identique à l'essai A")
  const [a] = await trials(page)
  expect(a).toMatchObject({ name: 'A', parentId: null })
  const posesA = { mic: await pose(page, 'shure-sm58-s1'), desk: await pose(page, 'yamaha-ql1-s2') }

  // G again with nothing changed: a no-op, nothing is created.
  await page.keyboard.press('KeyG')
  await expect(page.locator('.es-notice')).toContainText("Rien n'a changé depuis l'essai A.")
  expect(await trials(page)).toHaveLength(1)

  // 3. Move a device (pick up, put down elsewhere) → stale.
  await page.evaluate(() => {
    const sim = window.__audioSim!
    sim.dispatch({ type: 'REMOVE', instanceId: 'yamaha-ql1-s2' })
    sim.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', position: [2.5, 0, 1.5], rotationY: 0 })
  })
  await expect(page.locator('#essais-caption')).toContainText('Résultat à refaire')
  await expect(page.locator('#essais-caption')).toHaveText('Affiché : Essai A · Résultat à refaire · Montage actuel : modifié')
  await expect(page.locator('.es-current-state')).toHaveText("modifié depuis l'essai A")
  await page.screenshot({ path: info.outputPath('essais-stale.png') })

  // 4. Orbit view (another camera), new prediction, G → Essai B, child of A.
  await page.locator('#explore-toolbar [data-act="view"]').click()
  await expect.poll(() => page.evaluate(() => window.__audioSim!.explore!().view)).toBe('orbit')
  await freeze(page, 'Je déplace la console, je m’attends au même câblage.')
  await expect(page.locator('.es-row')).toHaveCount(2)
  const [, b] = await trials(page)
  expect(b).toMatchObject({ name: 'B', parentId: a.id })
  expect(sameAngle(a.view.pose.alpha, b.view.pose.alpha) && near(a.view.pose.radius, b.view.pose.radius)).toBe(false)
  const stored = await page.evaluate(() => window.localStorage.getItem('audio-sim/trials'))

  // 5. Compare: B opens it (Essai B shown), B again flips to A, at A's camera.
  await page.keyboard.press('KeyB')
  await expect(page.locator('.es-compare')).toBeVisible()
  await expect(page.locator('#essais-caption')).toHaveText('Affiché : Essai B · comparaison en lecture seule')
  await page.keyboard.press('KeyB')
  await expect(page.locator('#essais-caption')).toHaveText('Affiché : Essai A · comparaison en lecture seule')
  await expect
    .poll(async () => {
      const cam = await page.evaluate(() => window.__audioSim!.camera())
      const p = a.view.pose
      return (
        sameAngle(cam.alpha, p.alpha) &&
        near(cam.beta, p.beta) &&
        near(cam.radius, p.radius) &&
        cam.target.every((v, i) => near(v, p.target[i]))
      )
    })
    .toBe(true)
  for (const [id, before] of [
    ['shure-sm58-s1', posesA.mic],
    ['yamaha-ql1-s2', posesA.desk],
  ] as const) {
    const now = await pose(page, id)
    expect(now, id).not.toBeNull()
    for (let k = 0; k < 3; k++) expect(near(now!.position[k], before!.position[k]), `${id}[${k}]`).toBe(true)
    expect(now!.rotationY).toBe(before!.rotationY)
  }
  expect(await pose(page, 'yamaha-ql1-s3')).toBeNull()
  // The table says what changed, in words.
  await expect(page.locator('.es-table')).toContainText('Placements')
  await expect(page.locator('.es-table')).toContainText('Changé')
  await expect(page.locator('.es-predictions')).toContainText('Je déplace la console')
  // Read-only: an edit is refused and nothing is stored.
  await page.evaluate(() =>
    window.__audioSim!.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', position: [0, 0, 0] }),
  )
  await expect(page.locator('.toast-info').last()).toContainText('Comparaison en lecture seule')
  expect(await page.evaluate(() => window.__audioSim!.assets().length)).toBe(2)
  await page.screenshot({ path: info.outputPath('essais-compare.png') })

  // 6. Esc closes the compare and gives the live setup back, exactly.
  await page.keyboard.press('Escape')
  await expect(page.locator('.es-compare')).toBeHidden()
  await expect(page.locator('#essais-panel')).toBeVisible()
  expect(await pose(page, 'yamaha-ql1-s2')).toBeNull()
  const desk = await pose(page, 'yamaha-ql1-s3')
  expect(near(desk!.position[0], 2.5) && near(desk!.position[2], 1.5)).toBe(true)
  await expect(page.locator('#essais-caption')).toHaveText('Affiché : Essai B · Montage actuel : à jour')
  expect(await page.evaluate(() => window.localStorage.getItem('audio-sim/trials'))).toBe(stored) // the preview wrote nothing

  // 7. Export (.essai.json download) → clear → import → the same trials.
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#es-export').click()])
  expect(download.suggestedFilename()).toMatch(/^essais-sandbox-\d{4}-\d{2}-\d{2}\.essai\.json$/)
  const text = await readFile((await download.path())!, 'utf8')
  const exported = JSON.parse(text)
  expect(exported).toMatchObject({ formatVersion: 1, app: 'tekpractice', declaratif: true })
  await page.evaluate(() => window.localStorage.removeItem('audio-sim/trials'))
  await page.reload()
  await page.waitForFunction(() => !!window.__audioSim)
  await page.getByRole('button', { name: 'Essais' }).click()
  await expect(page.locator('.es-row')).toHaveCount(0)
  await page.locator('#es-file').setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/json', buffer: Buffer.from(text) })
  await expect(page.locator('.es-notice')).toContainText('2 essais importés.')
  await expect(page.locator('.es-row')).toHaveCount(2)
  expect(await trials(page)).toEqual(exported.trials)
  await page.screenshot({ path: info.outputPath('essais-imported.png') })
})

/** Live poses of every placed device (the "exact live design" oracle). */
const livePoses = (page: Page) =>
  page.evaluate(() => {
    const sim = window.__audioSim!
    return Object.fromEntries(sim.assets().map((a) => [a.instanceId, sim.pose!(a.instanceId)]))
  })
/** Key presses dispatched in ONE task: no await between them (the races the review found). */
const burst = (page: Page, codes: string[]) =>
  page.evaluate((cs) => {
    for (const code of cs) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }))
      window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }))
    }
  }, codes)

async function twoEssais(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__audioSim!
    sim.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', position: [1.2, 0, -1], rotationY: 0 })
    sim.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', position: [-1.4, 0, 0.6], rotationY: 90 })
  })
  await page.getByRole('button', { name: 'Essais' }).click()
  await freeze(page, 'Premier montage.')
  await expect(page.locator('.es-row')).toHaveCount(1)
  await page.evaluate(() => window.__audioSim!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-rio3224-d2', position: [0, 0, 2] }))
  await freeze(page, 'J’ajoute la stagebox.')
  await expect(page.locator('.es-row')).toHaveCount(2)
}

test('review: a pending pick-up undo cannot edit the compare preview; V is refused; Esc gives the live setup back', async ({ page }) => {
  await page.evaluate(() => {
    const sim = window.__audioSim!
    sim.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', position: [1.2, 0, -1], rotationY: 0 })
    sim.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', position: [-1.4, 0, 0.6], rotationY: 90 })
  })
  await page.getByRole('button', { name: 'Essais' }).click()
  await freeze(page, 'Premier montage.')
  // pick the console up: an « Annuler » toast is now pending
  await page.evaluate(() => window.__audioSim!.dispatch({ type: 'REMOVE', instanceId: 'yamaha-ql1-s2' }))
  await expect(page.locator('.toast-undo')).toHaveCount(1)
  await freeze(page, 'Sans la console.')
  await expect(page.locator('.es-row')).toHaveCount(2)
  const live = await livePoses(page)

  await page.keyboard.press('KeyB') // compare: Essai B shown (no console)
  await expect(page.locator('#essais-caption')).toHaveText('Affiché : Essai B · comparaison en lecture seule')
  await expect(page.locator('.toast-undo')).toHaveCount(0) // pending undos dismissed
  await page.keyboard.press('KeyB') // flip to A: the console is in the preview
  await expect(page.locator('#essais-caption')).toHaveText('Affiché : Essai A · comparaison en lecture seule')
  const preview = await livePoses(page)
  // the undo is an intent now: refused while comparing, the preview is untouched
  await page.evaluate(() =>
    window.__audioSim!.dispatch({
      type: 'RESTORE_INSTANCE',
      instanceId: 'yamaha-ql1-s2',
      deviceId: 'yamaha-ql1',
      pose: { position: [3, 0, 3], rotationY: 0 },
      wires: [],
      controls: {},
    }),
  )
  await expect(page.locator('.toast-info').last()).toContainText('Comparaison en lecture seule')
  expect(await livePoses(page)).toEqual(preview)
  // V cannot leave Orbit during a compare
  await page.keyboard.press('KeyV')
  await expect(page.locator('.toast-info').last()).toContainText("Fermez d'abord la comparaison")
  expect(await page.evaluate(() => window.__audioSim!.explore!().view)).toBe('orbit')

  await page.keyboard.press('Escape')
  await expect(page.locator('.es-compare')).toBeHidden()
  expect(await livePoses(page)).toEqual(live)
})

test('review: B twice in one burst opens ONE compare, and Esc restores the true live design', async ({ page }) => {
  await twoEssais(page)
  // the live setup differs from both Essais (a second open would save the PREVIEW as "live")
  await page.evaluate(() => window.__audioSim!.dispatch({ type: 'REMOVE', instanceId: 'shure-sm58-s1' }))
  await page.locator('#es-prediction').blur()
  const live = await livePoses(page)
  await burst(page, ['KeyB', 'KeyB'])
  await expect(page.locator('.es-compare')).toBeVisible()
  await expect(page.locator('#essais-caption')).toHaveText('Affiché : Essai B · comparaison en lecture seule')
  await page.keyboard.press('KeyB') // a normal press still flips
  await expect(page.locator('#essais-caption')).toHaveText('Affiché : Essai A · comparaison en lecture seule')
  await page.keyboard.press('Escape')
  await expect(page.locator('.es-compare')).toBeHidden()
  expect(await livePoses(page)).toEqual(live)
})

test('review: G then B in one burst freezes the LIVE design, evidence and camera (B is ignored)', async ({ page }) => {
  await twoEssais(page)
  // change the live setup and the camera, then G+B at once
  await page.evaluate(() => window.__audioSim!.dispatch({ type: 'REMOVE', instanceId: 'shure-sm58-s1' }))
  await page.locator('#explore-toolbar [data-act="view"]').click()
  await page.locator('#es-prediction').fill('Sans le micro.')
  await page.locator('#es-prediction').blur()
  const live = await livePoses(page)
  const cam = await page.evaluate(() => window.__audioSim!.camera())
  const violations = await page.evaluate(() => window.__audioSim!.state().violations.map((v) => v.ruleId).sort())
  await burst(page, ['KeyG', 'KeyB'])
  await expect(page.locator('.es-row')).toHaveCount(3)
  await expect(page.locator('.es-compare')).toBeHidden()
  const c = (await trials(page))[2] as StoredTrial & { evidence: { ruleResults: { ruleId: string }[] } }
  expect(c.name).toBe('C')
  expect(c.design.placements.map((p) => p.instanceId).sort()).toEqual(Object.keys(live).sort())
  for (const p of c.design.placements) for (let k = 0; k < 3; k++) expect(near(p.position_m[k], live[p.instanceId]!.position[k])).toBe(true)
  expect(c.evidence.ruleResults.map((r) => r.ruleId).sort()).toEqual(violations)
  expect(sameAngle(c.view.pose.alpha, cam.alpha) && near(c.view.pose.radius, cam.radius)).toBe(true)
  expect(await livePoses(page)).toEqual(live)
})

test('one side panel at a time: the inventory closes the Essais panel, Esc closes it', async ({ page }) => {
  await page.getByRole('button', { name: 'Essais' }).click()
  await expect(page.locator('#essais-panel')).toBeVisible()
  await expect(page.locator('#hud-shelf')).toBeHidden() // the shelf is the other left panel
  await page.locator('#explore-toolbar [data-act="inventory"]').click()
  await expect(page.locator('.ex-panel[data-panel="inventory"]')).toBeVisible()
  await expect(page.locator('#essais-panel')).toBeHidden()
  await page.keyboard.press('Escape') // closes the inventory
  await page.getByRole('button', { name: 'Essais' }).click()
  await expect(page.locator('.ex-panel')).toHaveCount(0)
  await page.locator('#es-prediction').blur()
  await page.keyboard.press('Escape')
  await expect(page.locator('#essais-panel')).toBeHidden()
  await expect(page.locator('#hud-shelf')).toBeVisible()
})

test('freezing without a prediction asks for one and creates nothing', async ({ page }) => {
  await page.evaluate(() => window.__audioSim!.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58' }))
  await page.keyboard.press('KeyG')
  await expect(page.locator('#essais-panel')).toBeVisible()
  await expect(page.locator('.es-notice')).toContainText('Écrivez votre prédiction avant de figer.')
  await expect(page.locator('#es-prediction')).toBeFocused()
  expect(await trials(page)).toHaveLength(0)
})

test('final review #1: two compare flips within 200 ms leave no ghost device (one glb root per instance)', async ({ page }) => {
  await twoEssais(page) // shure-sm58, yamaha-ql1, yamaha-rio3224-d2: all three have a real .glb
  await page.locator('#es-prediction').blur()
  await page.keyboard.press('KeyB')
  await expect(page.locator('#essais-caption')).toHaveText('Affiché : Essai B · comparaison en lecture seule')
  // two flips, ~50 ms apart: each one disposes and respawns every device while the previous glbs still load
  await page.keyboard.press('KeyB')
  await page.waitForTimeout(50)
  await page.keyboard.press('KeyB')
  await expect(page.locator('#essais-caption')).toHaveText('Affiché : Essai B · comparaison en lecture seule')
  // every live instance gets its model…
  await expect
    .poll(() => page.evaluate(() => window.__audioSim!.assets().every((a) => a.status === 'glb')), { timeout: 20_000 })
    .toBe(true)
  // …and the imports started for the disposed instances have all settled too
  await page.waitForTimeout(1500)
  const { roots, instances } = await page.evaluate(() => ({
    roots: window.__audioSim!.glbRoots!(),
    instances: window.__audioSim!.assets().length,
  }))
  expect(roots.filter((r) => !r.live), JSON.stringify(roots)).toEqual([])
  expect(roots).toHaveLength(instances)
  await page.keyboard.press('Escape')
  await expect(page.locator('.es-compare')).toBeHidden()
})

test('final review #2: two tabs freeze Essais → both kept, the other tab’s list follows', async ({ page }) => {
  const tab2 = await page.context().newPage()
  await tab2.emulateMedia({ reducedMotion: 'reduce' })
  await tab2.goto('/?level=sandbox')
  await tab2.waitForFunction(() => !!window.__audioSim)
  await tab2.getByRole('button', { name: 'Essais' }).click()
  await expect(tab2.locator('.es-row')).toHaveCount(0)

  await page.evaluate(() => window.__audioSim!.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', position: [1.2, 0, -1] }))
  await page.getByRole('button', { name: 'Essais' }).click()
  await freeze(page, 'Onglet 1.')
  await expect(page.locator('.es-row')).toHaveCount(1)
  // the storage event reaches tab 2: its list now shows tab 1's Essai
  await expect(tab2.locator('.es-row')).toHaveCount(1)

  await tab2.evaluate(() => window.__audioSim!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', position: [-1.4, 0, 0.6] }))
  await freeze(tab2, 'Onglet 2.')
  await expect(tab2.locator('.es-row')).toHaveCount(2)
  expect((await trials(page)).map((t) => t.evidence.prediction.text).sort()).toEqual(['Onglet 1.', 'Onglet 2.'])
  await expect(page.locator('.es-row')).toHaveCount(2)
  await tab2.close()
})

test('re-review: another tab writing the Essais closes an open compare and gives the live design back', async ({ page }) => {
  await twoEssais(page)
  await page.evaluate(() => window.__audioSim!.dispatch({ type: 'REMOVE', instanceId: 'shure-sm58-s1' }))
  await page.locator('#es-prediction').blur()
  const live = await livePoses(page)
  await page.keyboard.press('KeyB')
  await expect(page.locator('.es-compare')).toBeVisible()
  expect(await livePoses(page)).not.toEqual(live) // the preview is on stage

  const tab2 = await page.context().newPage()
  await tab2.goto('/?level=sandbox')
  await tab2.waitForFunction(() => !!window.__audioSim)
  await tab2.evaluate(() => window.__audioSim!.dispatch({ type: 'SPAWN', deviceId: 'shure-sm57', position: [0, 0, -2] }))
  await tab2.getByRole('button', { name: 'Essais' }).click()
  await freeze(tab2, 'Onglet 2.')
  await expect(tab2.locator('.es-row')).toHaveCount(3)

  await expect(page.locator('.es-compare')).toBeHidden()
  await expect(page.locator('.es-row')).toHaveCount(3)
  expect(await livePoses(page)).toEqual(live)
  await tab2.close()
})

test('final review #3: « Exporter puis archiver » asks to check the file; nothing is removed before the explicit button', async ({ page }) => {
  await twoEssais(page)
  // The near-budget notice carries this action; reaching 1.2 MB in a test is slow, so its button is injected.
  await page.evaluate(() => {
    const b = document.createElement('button')
    b.dataset.act = 'export-archive'
    b.id = 'test-export-archive'
    document.querySelector('#essais-panel .es-notice')!.appendChild(b)
  })
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#test-export-archive').click()])
  expect(download.suggestedFilename()).toMatch(/\.essai\.json$/)
  await expect(page.locator('#es-confirm-text')).toContainText("Vérifiez d'abord le fichier téléchargé")
  const ok = page.locator('#es-confirm-ok')
  await expect(ok).toHaveText("J'ai vérifié le fichier — archiver")
  expect(await trials(page)).toHaveLength(2) // the download alone archives nothing
  await ok.click()
  await expect(page.locator('.es-row')).toHaveCount(0)
  expect(await trials(page)).toHaveLength(0)
})

test('exam mode has no Essais panel (D2)', async ({ page }) => {
  await page.goto('/?level=a1&mode=exam')
  await page.waitForFunction(() => !!window.__audioSim)
  await expect(page.locator('#explore-toolbar')).toBeVisible()
  await expect(page.locator('#essais-toggle')).toHaveCount(0)
  await page.keyboard.press('KeyG')
  await page.waitForTimeout(400)
  await expect(page.locator('#essais-panel')).toHaveCount(0)
  expect(await trials(page)).toHaveLength(0)
})
