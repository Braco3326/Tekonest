/* eslint-env node */
// Last checks: the bundle grep over every chunk the app can load (from the Vite map in main-*.js), the menubar at 400 px,
// and the cube square swallowing a click outside the cube silhouette.
import { URL_APP, launch, recorder, saveResults, sleep, settle } from './lib.mjs'
import { runBundleGrep } from './extras.mjs'

const index = await fetch(URL_APP).then((r) => r.text())
const main = [...index.matchAll(/src="([^"]*main-[^"]+\.js)"/g)].map((m) => new URL(m[1], URL_APP).href)[0]
const mainText = await fetch(main).then((r) => r.text())
const deps = [...new Set([...mainText.matchAll(/"(assets\/[^"]+\.js)"/g)].map((m) => URL_APP + m[1]))]
// one more level: chunks named inside the lazy chunks
const all = new Set([main, ...deps])
for (const u of deps) {
  const t = await fetch(u).then((r) => r.text())
  for (const m of t.matchAll(/["'(/]((?:assets\/)?[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8}\.js)["')]/g)) all.add(URL_APP + (m[1].startsWith('assets/') ? m[1] : 'assets/' + m[1]))
  await sleep(100)
}
await runBundleGrep([...all])

const { steps, step } = recorder()
const browser = await launch()
const ctx = await browser.newContext({ viewport: { width: 400, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto(URL_APP)
await page.waitForFunction(() => !!window.__creation, null, { timeout: 30000 })
await page.getByTestId('place-picker').waitFor()
await step('menubar400', () =>
  page.evaluate(() => {
    const a = document.getElementById('site-link')
    const r = a?.getBoundingClientRect()
    const mb = document.querySelector('[data-testid="menubar"]')
    return { siteLink: r && { x: r.x, w: r.width, right: r.right }, innerWidth, menubarScrollW: mb?.scrollWidth, menubarClientW: mb?.clientWidth, overflowX: mb && getComputedStyle(mb).overflowX }
  })
)
await ctx.close()
const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' })
const p2 = await ctx2.newPage()
await p2.goto(URL_APP)
await p2.waitForFunction(() => !!window.__creation, null, { timeout: 30000 })
await p2.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
await p2.waitForFunction(() => window.__creation.design().rig.instances.length === 5, null, { timeout: 60000 })
await settle(p2)
await step('cubeCornerSwallow', async () => {
  const r = await p2.evaluate(() => window.__creation.cubeRect())
  const pts = []
  for (const [fx, fy] of [[0.05, 0.05], [0.95, 0.05], [0.05, 0.97], [0.7, 0.98], [0.95, 0.95]]) {
    const x = r.x + r.width * fx, y = r.y + r.height * fy
    pts.push({ fx, fy, zone: await p2.evaluate(([a, b]) => window.__creation.cubeZoneAt(a, b), [x, y]), el: await p2.evaluate(([a, b]) => { const e = document.elementFromPoint(a, b); return e ? e.className : null }, [x, y]) })
  }
  return pts
})
await browser.close()
saveResults('last', { steps, chunks: all.size })
