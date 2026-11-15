/**
 * Mission 2 review (2026-11-15): « Envoyer dans la scène 3D » in two real rooms, one flat and one with a RAISED DECK (bar-club-stage-small: its stage zone is
 * 0.8 m high, roomLayout.floorAt). A plan of 4 devices at known metres and yaws (one on the deck, the others off it), 3 cables, is written under the page's own
 * key, the page is opened from the menu and the plan sent through its confirmation. Then, from the 3D page's debug hooks (window.__creation):
 *  - every placement is the plan's x / z to 1 mm and its yaw exactly; mount « floor »;
 *  - y is the floor under the device (floorAtM), so a device on the deck has y = 0.8, and its loaded body's lowest point is ON the deck (not in it, not floating);
 *  - every cable rests on its surface (cableSupportReport, mission 3 A): nothing under the surface, no flying stretch (the drop off the deck edge is a ramp).
 * All-on build by default; the product build too when E2E_PRODUCT_URL serves one; both entered in design 2 « Atelier » (the shipped default) the way a learner does.
 */
import { expect, test, type Page } from '@playwright/test'
import { cableKey } from '../../src/creation/sceneDiff'
import { BUILDS, enterDesign, openPlan } from './plan2dKit'

interface PlanDevice { id: string; deviceId: string; x: number; z: number; rot: number }
interface Placement { instanceId: string; deviceId: string; position_m: [number, number, number]; yawDeg: number; mount?: string }
interface PortRef { instance: string; port: string }
type Report = { minAboveM: number; longestUnsupportedM: number; longestMidSpanM: number; spans: unknown[] }
interface Hook {
  place(): string | null
  choosePlace(key: string): Promise<unknown>
  design(): { rig: { instances: { instanceId: string }[]; connections: { a: PortRef; b: PortRef }[] }; placements: Placement[] }
  project(): { name: string | null }
  floorAtM(x: number, z: number): number
  modelsPending(): number
  bodyBoundsInRoot(id: string): { lo: [number, number, number]; hi: [number, number, number] } | null
  cableSupportReport(key: string): Report | null
}

const ROOMS: { key: string; deck: number | null; devices: PlanDevice[] }[] = [
  {
    key: 'room:bar-club-stage-small',
    deck: 0.8,
    devices: [
      { id: 'yamaha-ql1-1', deviceId: 'yamaha-ql1', x: 0, z: 4, rot: 180 },
      { id: 'qsc-k12-2-1', deviceId: 'qsc-k12-2', x: 3, z: -4.5, rot: 30 },
      { id: 'shure-sm58-1', deviceId: 'shure-sm58', x: -1, z: -6, rot: 0 },
      { id: 'qsc-k12-2-2', deviceId: 'qsc-k12-2', x: -3.5, z: 0, rot: 270 },
    ],
  },
  {
    key: 'room:studio-live-room-medium',
    deck: null,
    devices: [
      { id: 'yamaha-ql1-1', deviceId: 'yamaha-ql1', x: 0, z: 3, rot: 180 },
      { id: 'qsc-k12-2-1', deviceId: 'qsc-k12-2', x: 2.5, z: -2, rot: 30 },
      { id: 'shure-sm58-1', deviceId: 'shure-sm58', x: -1, z: -1, rot: 0 },
      { id: 'qsc-k12-2-2', deviceId: 'qsc-k12-2', x: -3, z: 1, rot: 270 },
    ],
  },
]
const CABLES = [
  { id: 'c1', a: { dev: 'yamaha-ql1-1', port: 'out-main-l' }, b: { dev: 'qsc-k12-2-1', port: 'in-line-a' } },
  { id: 'c2', a: { dev: 'yamaha-ql1-1', port: 'out-main-r' }, b: { dev: 'qsc-k12-2-2', port: 'in-line-a' } },
  { id: 'c3', a: { dev: 'shure-sm58-1', port: 'out-xlr' }, b: { dev: 'yamaha-ql1-1', port: 'in-mic-1' } },
]
/** The same oracle bounds as creation-cables.spec.ts (bend 5 cm, loop 40 cm, ramp slope 5, a sample step). */
const MAX_END_SPAN_M = 0.4 + 4 * 0.05
const MAX_MID_SPAN_M = 0.4

/** Design 2 (the shipped default) entered as a learner does (the start screen's first answer, plan2dKit), then the room. */
async function openPlace(page: Page, key: string): Promise<void> {
  await enterDesign(page, 2)
  await page.evaluate((k) => (window as unknown as { __creation: Hook }).__creation.choosePlace(k), key)
  await page.waitForFunction((k) => (window as unknown as { __creation: Hook }).__creation.place() === k, key)
}

for (const build of BUILDS) {
  test.describe(build.name, () => {
    if (build.base) test.use({ baseURL: build.base })
    test.use({ viewport: { width: 1366, height: 768 } })
    test.describe.configure({ timeout: 180_000 })

    for (const room of ROOMS) {
      test(`${room.key}${room.deck ? ' (raised deck)' : ''}: the plan's metres, yaws and cables land in 3D; a deck device stands ON the deck; every cable rests on its surface`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(String(e)))
        page.on('console', (m) => {
          if (m.type() === 'error') errors.push(m.text())
        })
        await openPlace(page, room.key)
        // the plan, under the page's own key (persist.ts: audio-sim/plan2d.v1.<project>@<place>)
        await page.evaluate(
          ({ key, devices, cables }) => {
            const name = (window as unknown as { __creation: Hook }).__creation.project().name
            window.localStorage.setItem(`audio-sim/plan2d.v1.${encodeURIComponent(name ?? '')}@${encodeURIComponent(key)}`, JSON.stringify({ v: 1, roomId: key, devices, cables }))
          },
          { key: room.key, devices: room.devices, cables: CABLES },
        )
        // the floor under each plan point, read from the 3D page: the deck devices are on 0.8
        const floors = await page.evaluate((ds) => ds.map((d) => (window as unknown as { __creation: Hook }).__creation.floorAtM(d.x, d.z)), room.devices)
        if (room.deck !== null) {
          expect(floors[1], 'the speaker is on the deck').toBeCloseTo(room.deck, 6)
          expect(floors[2], 'the microphone is on the deck').toBeCloseTo(room.deck, 6)
          expect(floors[0], 'the console is off the deck').toBe(0)
          expect(floors[3], 'the second speaker is off the deck').toBe(0)
        } else expect(floors).toEqual([0, 0, 0, 0])

        const dialog = await openPlan(page)
        await expect(dialog.locator('[data-dev]')).toHaveCount(4)
        await expect(dialog.locator('[data-cable]')).toHaveCount(3)
        await dialog.getByRole('button', { name: 'Envoyer dans la scène 3D' }).click()
        const confirm = page.getByTestId('plan2d-spawn-dialog')
        await expect(confirm).toContainText('4 appareils et 3 câbles')
        await confirm.getByRole('button', { name: 'Ajouter' }).click()
        await expect(dialog.getByTestId('plan2d-report')).toContainText('Ajoutés dans la scène 3D : 4 appareils et 3 câbles')
        await dialog.getByRole('button', { name: 'Voir la scène 3D' }).click()
        await expect(dialog).toHaveCount(0)

        const design = await page.evaluate(() => (window as unknown as { __creation: Hook }).__creation.design())
        expect(design.rig.connections).toHaveLength(3)
        for (const [i, d] of room.devices.entries()) {
          const p = design.placements.find((x) => x.instanceId === d.id)
          expect(p, `${d.id} placed`).toBeTruthy()
          expect(p!.deviceId).toBe(d.deviceId)
          expect(Math.abs(p!.position_m[0] - d.x), `${d.id} x to 1 mm`).toBeLessThanOrEqual(1e-3)
          expect(Math.abs(p!.position_m[2] - d.z), `${d.id} z to 1 mm`).toBeLessThanOrEqual(1e-3)
          expect(p!.yawDeg, `${d.id} yaw`).toBe(d.rot)
          expect(p!.mount ?? 'floor').toBe('floor')
          expect(p!.position_m[1], `${d.id} stands at the floor height under it`).toBeCloseTo(floors[i]!, 6)
        }

        // the loaded bodies: the lowest vertex of each sits on its placement, so a deck device stands ON the deck (not sunk in it, not floating)
        await page.waitForFunction(() => (window as unknown as { __creation: Hook }).__creation.modelsPending() === 0, null, { timeout: 90_000 })
        for (const [i, d] of room.devices.entries()) {
          const b = await page.evaluate((id) => (window as unknown as { __creation: Hook }).__creation.bodyBoundsInRoot(id), d.id)
          expect(b, `${d.id} body loaded`).not.toBeNull()
          const p = design.placements.find((x) => x.instanceId === d.id)!
          const bottom = p.position_m[1] + b!.lo[1]
          expect(Math.abs(bottom - floors[i]!), `${d.id}: body bottom ${bottom.toFixed(4)} m on the floor ${floors[i]} m`).toBeLessThanOrEqual(0.01)
        }

        // every cable rests on the surface (floor, deck, devices): mission 3 A's oracle
        for (const c of design.rig.connections) {
          const key = cableKey(c.a, c.b)
          await expect.poll(() => page.evaluate((k) => (window as unknown as { __creation: Hook }).__creation.cableSupportReport(k) !== null, key), { timeout: 20_000 }).toBe(true)
          const r = (await page.evaluate((k) => (window as unknown as { __creation: Hook }).__creation.cableSupportReport(k), key))!
          expect(r.minAboveM, `${key}: no place under its surface`).toBeGreaterThanOrEqual(-0.002)
          expect(r.longestMidSpanM, `${key}: off its surface between the ends only on a ramp (${JSON.stringify(r.spans)})`).toBeLessThanOrEqual(MAX_MID_SPAN_M)
          expect(r.longestUnsupportedM, `${key}: no flying stretch (${JSON.stringify(r.spans)})`).toBeLessThanOrEqual(MAX_END_SPAN_M)
        }
        expect(errors, 'console errors').toEqual([])
      })
    }
  })
}
