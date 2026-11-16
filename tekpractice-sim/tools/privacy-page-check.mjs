// Real-browser check of the generated privacy page, served the way the umbrella site will serve it, READ-ONLY on the site tree.
// Usage: node tools/privacy-page-check.mjs <website-prototype dir> <dist-site-pages dir> <screenshot out dir>
// Serves, on 127.0.0.1 at a free port: /tekpractice/confidentialite/ from <dist-site-pages>, everything else (the site's CSS, fonts, logo, menu script) from
// <website-prototype>; nothing is written there. Screenshots (full page) at 1440, 820 and 390 px; axe (WCAG 2.0/2.1/2.2 A+AA) at each width; fails on a
// serious/critical violation, a request to another host, a cookie, a console error, a failed (>= 400) response, or a horizontal scroll.
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const [siteRoot, pagesRoot, outDir] = process.argv.slice(2).map((p) => p && resolve(p))
if (!siteRoot || !pagesRoot || !outDir) {
  console.error('usage: node tools/privacy-page-check.mjs <website-prototype> <dist-site-pages> <out dir>')
  process.exit(2)
}
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp' }
const PAGE = '/tekpractice/confidentialite/'

const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname
  if (path === '/tekpractice/confidentialite') {
    res.writeHead(308, { location: PAGE }).end() // Cloudflare Pages adds the trailing slash the same way
    return
  }
  const root = path.startsWith(PAGE) ? pagesRoot : siteRoot
  let file = join(root, normalize(decodeURIComponent(path)).replace(/^[/\\]+/, ''))
  if (!file.startsWith(root)) return void res.writeHead(403).end()
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
  if (!existsSync(file)) return void res.writeHead(404).end('not found')
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const origin = `http://127.0.0.1:${server.address().port}`
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const problems = []
const report = []
try {
  for (const width of [1440, 820, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await context.newPage()
    const foreign = []
    const failed = []
    const consoleErrors = []
    page.on('request', (r) => {
      if (!r.url().startsWith(origin) && !r.url().startsWith('data:')) foreign.push(r.url())
    })
    page.on('response', (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`)
    })
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text())
    })
    const resp = await page.goto(origin + '/tekpractice/confidentialite', { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    const finalUrl = page.url()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`))
    const shot = join(outDir, `privacy-${width}.png`)
    await page.screenshot({ path: shot, fullPage: true })
    await page.keyboard.press('Tab')
    const firstFocus = await page.evaluate(() => ({ text: document.activeElement?.textContent?.trim(), href: document.activeElement?.getAttribute('href') }))
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
    const bad = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    const cookies = await context.cookies()
    const row = {
      width,
      status: resp?.status(),
      finalUrl: finalUrl.replace(origin, ''),
      overflowPx: overflow,
      fontsLoaded: fonts,
      firstTab: firstFocus,
      axe: axe.violations.map((v) => `${v.impact} ${v.id} (${v.nodes.length})`),
      foreign,
      failed,
      consoleErrors,
      cookies: cookies.length,
      shot,
    }
    report.push(row)
    if (bad.length) problems.push(`${width}px axe: ${bad.map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`).join('; ')}`)
    if (foreign.length) problems.push(`${width}px requests to another host: ${foreign.join(', ')}`)
    if (failed.length) problems.push(`${width}px failed responses: ${failed.join(', ')}`)
    if (consoleErrors.length) problems.push(`${width}px console errors: ${consoleErrors.join(' | ')}`)
    if (cookies.length) problems.push(`${width}px cookies: ${cookies.length}`)
    if (overflow > 0) problems.push(`${width}px horizontal scroll: ${overflow}px`)
    if (row.finalUrl !== PAGE) problems.push(`${width}px final URL ${row.finalUrl}`)
    await context.close()
  }
} finally {
  await browser.close()
  server.close()
}
console.log(JSON.stringify(report, null, 2))
if (problems.length) {
  console.error('[privacy-page-check] PROBLEMS:\n' + problems.map((p) => '  - ' + p).join('\n'))
  process.exit(1)
}
console.log('[privacy-page-check] OK: 3 widths, no serious/critical axe violation, no foreign request, no cookie, no console error, no horizontal scroll')
