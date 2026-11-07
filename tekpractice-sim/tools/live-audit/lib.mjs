/* eslint-env node */
// Shared helpers for the live audit (targets PRODUCTION, read-only; never the repo's webServer).
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const ORIGIN = 'https://tekonest.com'
export const URL_APP = ORIGIN + '/tekpractice/jouer/'
export const URL_PAGE = ORIGIN + '/tekpractice/'
/** Where the screenshots and results.json go: $AUDIT_OUT, else a folder of the system temp dir. Never inside the repo. */
export const SHOTS = process.env.AUDIT_OUT ?? join(tmpdir(), 'tekpractice-live-audit')
mkdirSync(SHOTS, { recursive: true })
export const RESULTS = SHOTS + '/results.json'

/** Headless Chromium; SwiftShader unless LIVE_AUDIT_GPU=1 (software GL = weak-PC proxy). */
export async function launch() {
  const args = process.env.LIVE_AUDIT_GPU
    ? ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist']
    : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  return chromium.launch({ args })
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Records console, page errors, every response (status, type, size, origin) of a page. */
export function instrument(page, tag) {
  const log = { tag, console: [], pageErrors: [], responses: [], failed: [] }
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') log.console.push({ type: m.type(), text: m.text().slice(0, 300) })
  })
  page.on('pageerror', (e) => log.pageErrors.push(e.message.slice(0, 300)))
  page.on('requestfailed', (r) => log.failed.push({ url: r.url(), err: r.failure()?.errorText }))
  page.on('response', async (r) => {
    const h = r.headers()
    log.responses.push({ url: r.url(), status: r.status(), ct: h['content-type'] ?? '', cc: h['cache-control'] ?? '', len: Number(h['content-length'] ?? 0) })
  })
  return log
}

/** CDP transfer sizes (encoded bytes on the wire) per URL. */
export async function transferMeter(page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  const urls = new Map()
  const sizes = new Map()
  cdp.on('Network.responseReceived', (e) => urls.set(e.requestId, e.response.url))
  cdp.on('Network.loadingFinished', (e) => {
    const u = urls.get(e.requestId)
    if (u) sizes.set(u, (sizes.get(u) ?? 0) + e.encodedDataLength)
  })
  return { cdp, sizes }
}

export function saveResults(section, data) {
  const all = existsSync(RESULTS) ? JSON.parse(readFileSync(RESULTS, 'utf8')) : {}
  all[section] = data
  writeFileSync(RESULTS, JSON.stringify(all, null, 2))
}

/** A step: runs fn, records ok / value / error, never throws. */
export function recorder() {
  const steps = {}
  const step = async (id, fn) => {
    const t = Date.now()
    try {
      const v = await fn()
      steps[id] = { ok: true, ms: Date.now() - t, v }
    } catch (e) {
      steps[id] = { ok: false, ms: Date.now() - t, error: String(e?.message ?? e).slice(0, 600) }
    }
    console.log(id, JSON.stringify(steps[id]).slice(0, 500))
    return steps[id]
  }
  return { steps, step }
}

export const hook = (page, expr, arg) => page.evaluate(expr, arg)

/** Wait until the page draws no frame over 300 ms (the app's own counter), max `timeout`. */
export async function settle(page, timeout = 30000) {
  const t = Date.now()
  let last = -1
  while (Date.now() - t < timeout) {
    const n = await page.evaluate(() => window.__creation?.renders() ?? 0)
    if (n === last) return Date.now() - t
    last = n
    await sleep(700)
  }
  return -1
}

/** Wraps AudioContext so its state can be read (installed before the page scripts). */
export const AUDIO_SPY = () => {
  const w = window
  w.__ctxs = []
  const Orig = window.AudioContext
  if (!Orig) return
  window.AudioContext = class extends Orig {
    constructor(...a) {
      super(...a)
      w.__ctxs.push(this)
    }
  }
}

/** The forbidden words of the honesty brief, in visible text. */
export function honesty(text) {
  const hits = {}
  for (const [k, re] of Object.entries({ STI: /\bSTI\b/g, SPL: /\bSPL\b/g, realiste: /r[ée]aliste/gi, placeholder: /REMPLACER/g })) {
    const m = text.match(re)
    if (m) {
      const ctx = []
      let r
      const rr = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
      while ((r = rr.exec(text)) && ctx.length < 4) ctx.push(text.slice(Math.max(0, r.index - 60), r.index + 60).replace(/\s+/g, ' '))
      hits[k] = { n: m.length, ctx }
    }
  }
  return hits
}

export async function axe(page, include, tag) {
  const { default: AxeBuilder } = await import('@axe-core/playwright')
  let b = new AxeBuilder({ page })
  if (include) {
    const present = []
    for (const s of [].concat(include)) if ((await page.locator(s).count()) > 0) present.push(s)
    if (!present.length) return { tag, skipped: 'no element for ' + include }
    for (const s of present) b = b.include(s)
  }
  const r = await b.analyze()
  return {
    tag,
    violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')), summary: v.nodes[0]?.failureSummary?.slice(0, 200) })),
  }
}
