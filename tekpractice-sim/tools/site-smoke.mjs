// Local smoke of the deploy build (dist-site/, base /tekpractice/jouer/).
// Serves dist-site with `vite preview` on 4174, opens Mode Création and ?legacy=1 in
// Chromium, and fails on a missing shell or any console error. The preview process
// is ALWAYS killed (finally), so no server is left behind.
// Usage: npm run build:site; if ($?) { npm run smoke:site }
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4174
const BASE = '/tekpractice/jouer/'
const ORIGIN = `http://localhost:${PORT}`

if (!existsSync(join(root, 'dist-site', 'index.html'))) {
  console.error('[smoke:site] dist-site/index.html missing: run `npm run build:site` first')
  process.exit(1)
}

const killTree = (child) => {
  if (!child || child.exitCode !== null || child.pid === undefined) return
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else child.kill('SIGKILL')
}

async function waitForServer(url, ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`preview did not answer at ${url} within ${ms} ms`)
}

let preview
let browser
let failed = false
try {
  preview = spawn(
    process.execPath,
    [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--outDir', 'dist-site', '--port', String(PORT), '--strictPort'],
    { cwd: root, env: { ...process.env, TEKPRACTICE_BASE: BASE }, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  preview.stderr.on('data', (d) => process.stderr.write(`[preview] ${d}`))
  await waitForServer(ORIGIN + BASE, 30_000)

  browser = await chromium.launch()
  const checks = [
    { name: 'Mode Création', url: ORIGIN + BASE, selector: '[data-testid="place-picker"]' },
    { name: '?legacy=1', url: ORIGIN + BASE + '?legacy=1', selector: '#dashboard' },
  ]
  for (const c of checks) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
    const errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(c.url)
    try {
      await page.waitForSelector(c.selector, { state: 'attached', timeout: 30_000 })
    } catch {
      errors.push(`${c.selector} never appeared`)
    }
    await page.waitForTimeout(1000) // late async errors (chunks, assets)
    if (errors.length) {
      failed = true
      console.error(`[smoke:site] FAIL ${c.name} (${c.url}):\n  ` + errors.join('\n  '))
    } else console.log(`[smoke:site] OK   ${c.name}: ${c.selector}, 0 console errors`)
    await page.close()
  }

  // CA-24 (Task 43d): under the deploy base the Draco decoder is fetched from the site itself (BASE + draco/...), answers 200, and nothing leaves the origin.
  {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
    const problems = []
    const seen = []
    const status = new Map()
    page.context().on('request', (r) => seen.push(r.url()))
    page.context().on('response', (r) => status.set(new URL(r.url()).pathname, r.status()))
    page.on('pageerror', (e) => problems.push(e.message))
    await page.goto(ORIGIN + BASE)
    await page.getByTestId('template-grid').getByRole('option').first().click() // a template with Draco-compressed devices
    const wasm = BASE + 'draco/draco_decoder_gltf.wasm'
    const wrapper = BASE + 'draco/draco_decoder_gltf_nodejs.js'
    try {
      await page.waitForFunction(() => window.__creation && window.__creation.modelsPending() === 0 && window.__creation.design().rig.instances.length > 0, null, { timeout: 30_000 })
    } catch {
      problems.push('the template never finished loading its models')
    }
    const foreign = seen.filter((u) => !u.startsWith('data:') && !u.startsWith('blob:') && new URL(u).origin !== ORIGIN)
    if (foreign.length) problems.push('cross-origin request(s): ' + [...new Set(foreign)].join(', '))
    for (const path of [wasm, wrapper]) {
      if (status.get(path) !== 200) problems.push(`${path} answered ${status.get(path) ?? 'nothing (never requested)'}`)
    }
    if (problems.length) {
      failed = true
      console.error('[smoke:site] FAIL Draco decoder under the deploy base:\n  ' + problems.join('\n  '))
    } else console.log(`[smoke:site] OK   Draco decoder: ${wasm} and ${wrapper} answered 200, 0 cross-origin request`)
    await page.close()
  }
} catch (e) {
  failed = true
  console.error('[smoke:site] ERROR', e)
} finally {
  await browser?.close().catch(() => undefined)
  killTree(preview)
}
console.log(failed ? '[smoke:site] FAILED' : '[smoke:site] OK')
process.exit(failed ? 1 : 0)
