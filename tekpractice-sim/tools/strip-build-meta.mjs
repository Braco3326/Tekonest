// Strips the build metadata from a deploy build (Task 44 N2).
//
// vite.config.ts sets `build.manifest` and the chunkModules plugin, so every `npm run build` writes dist/.vite/manifest.json and dist/.vite/chunk-modules.json for
// tools/chunk-budget.mjs. They are build artefacts, not site files: a public deploy must not serve them. tools/build-site.mjs removes them from dist-site; the Vercel
// build command (vercel.json: guard, `npm run build`, then this script) removes them from dist. Local `npm run build` keeps them (the budget needs them).
//
// Usage: `node tools/strip-build-meta.mjs [outDir]` (default: dist, next to tools/). Cross-platform (no shell `rm`). Exit 0 whether or not there was anything to remove.
import { rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'dist'))
rmSync(join(outDir, '.vite'), { recursive: true, force: true })
console.log(`[strip-build-meta] removed ${join(outDir, '.vite')} (if present)`)
