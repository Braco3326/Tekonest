// Deploy build for https://tekonest.com/tekpractice/jouer/ -> dist-site/
// and the public privacy page https://tekonest.com/tekpractice/confidentialite/ -> dist-site-pages/tekpractice/confidentialite/index.html
// (tools/build-privacy-page.ts; dist-site-pages/ mirrors the umbrella site's root: the deploy copies it next to tekpractice/jouer).
// Windows-safe (no cross-env). Strips sourcemaps, drops .glb > 25 MiB (the game
// falls back to placeholders), reports files > 20 MiB and the total file count.
// REFUSES to run (exit 1, before anything is removed or built) while a VITE_*KEY/SECRET/TOKEN/PASSWORD variable is set in the environment or defined in a .env*
// file of the project root: Vite would inline it in plain text into the public bundle (the Anthropic SDK is bundled in the legacy chunk). See tools/deploy-guard.mjs.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findSecretVars, formatRefusal } from './deploy-guard.mjs'
import { formatFlagRefusal, formatMissingTableRefusal, hasProductTable, scanOutputForTestFlags } from './deploy-flag-guard.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'dist-site')
const MiB = 1024 * 1024
const WARN = 20 * MiB
const LIMIT = 25 * MiB

// Task 43d D: first of all. Nothing is removed and Vite is not started if a secret would be baked into the public build.
const secrets = findSecretVars({ env: process.env, rootDir: root })
if (secrets.length) {
  console.error(formatRefusal(secrets))
  process.exit(1)
}

rmSync(out, { recursive: true, force: true })
const pagesOut = join(root, 'dist-site-pages')
rmSync(pagesOut, { recursive: true, force: true })
const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const r = spawnSync(process.execPath, [viteBin, 'build', '--outDir', 'dist-site', '--emptyOutDir'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, TEKPRACTICE_BASE: '/tekpractice/jouer/', TP_TEST_FEATURES: '' }, // TP_TEST_FEATURES: a test-only build switch (vite.config.ts), never in a deploy build
})
if (r.status !== 0) process.exit(r.status ?? 1)
// The proof that no test switch reached the output (the variable is blanked above; this checks the result), before anything else is done with it.
const flagged = scanOutputForTestFlags(out)
if (flagged.length) {
  console.error(formatFlagRefusal(flagged))
  rmSync(out, { recursive: true, force: true })
  process.exit(1)
}
// 2026-11-15: the product table (the assistant and the learning pages off) must be in the output, so a build that lost it is not shipped as if it were clean.
if (!hasProductTable(out)) {
  console.error(formatMissingTableRefusal())
  rmSync(out, { recursive: true, force: true })
  process.exit(1)
}
// Task 43a: `build.manifest` + the chunkModules plugin write .vite/ for tools/chunk-budget.mjs (run on dist/). It is a build artefact, not a site file.
rmSync(join(out, '.vite'), { recursive: true, force: true })

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })

let files = walk(out)
for (const f of files.filter((p) => p.endsWith('.map'))) rmSync(f)
files = files.filter((p) => !p.endsWith('.map'))

const excluded = []
for (const f of files.filter((p) => p.toLowerCase().endsWith('.glb') && statSync(p).size > LIMIT)) {
  excluded.push(f)
  rmSync(f)
}
files = files.filter((p) => !excluded.includes(p))

const rel = (p) => relative(out, p).replaceAll('\\', '/')
const sized = files.map((p) => ({ p: rel(p), size: statSync(p).size })).sort((a, b) => b.size - a.size)
const mib = (n) => (n / MiB).toFixed(2) + ' MiB'

console.log('\n[build-site] output: ' + out)
console.log(`[build-site] files: ${files.length} (Cloudflare limit 20000)`)
console.log('[build-site] largest: ' + sized.slice(0, 5).map((s) => `${s.p} ${mib(s.size)}`).join(' | '))
const big = sized.filter((s) => s.size > WARN)
console.log(big.length ? `[build-site] files over 20 MiB:\n` + big.map((s) => `  ${s.p} ${mib(s.size)}`).join('\n') : '[build-site] no file over 20 MiB')
for (const f of excluded) console.log(`[build-site] EXCLUDED (> 25 MiB, placeholder fallback): ${rel(f)}`)
if (!existsSync(join(out, 'index.html'))) process.exit(1)
if (files.length > 20000) process.exit(1)

// 2026-11-16: the public privacy page, generated from src/accounts/privacyPolicy.ts (never hand-edited in the site worktree).
const tsxCli = join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const p = spawnSync(process.execPath, [tsxCli, join(root, 'tools', 'build-privacy-page.ts'), pagesOut], { cwd: root, stdio: 'inherit' })
const pageFile = join(pagesOut, 'tekpractice', 'confidentialite', 'index.html')
if (p.status !== 0 || !existsSync(pageFile)) {
  console.error('[build-site] REFUSED: the privacy page was not generated (' + pageFile + '). Nothing ships without it.')
  process.exit(1)
}
console.log('[build-site] privacy page: ' + pageFile)
console.log('[build-site] DEPLOY, two copies into website-prototype/ of the site worktree:')
console.log('  1. dist-site/                                     -> website-prototype/tekpractice/jouer/          (https://tekonest.com/tekpractice/jouer/)')
console.log('  2. dist-site-pages/tekpractice/confidentialite/   -> website-prototype/tekpractice/confidentialite/ (https://tekonest.com/tekpractice/confidentialite/)')
