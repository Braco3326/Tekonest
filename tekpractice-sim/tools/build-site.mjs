// Deploy build for https://tekonest.com/tekpractice/jouer/ -> dist-site/
// Windows-safe (no cross-env). Strips sourcemaps, drops .glb > 25 MiB (the game
// falls back to placeholders), reports files > 20 MiB and the total file count.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'dist-site')
const MiB = 1024 * 1024
const WARN = 20 * MiB
const LIMIT = 25 * MiB

rmSync(out, { recursive: true, force: true })
const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const r = spawnSync(process.execPath, [viteBin, 'build', '--outDir', 'dist-site', '--emptyOutDir'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, TEKPRACTICE_BASE: '/tekpractice/jouer/' },
})
if (r.status !== 0) process.exit(r.status ?? 1)

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
