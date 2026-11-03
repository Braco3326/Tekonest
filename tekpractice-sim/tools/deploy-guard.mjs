// Deploy-build guard (Task 43d D): the deploy build refuses to run while a secret would be baked into it.
//
// WHY. @anthropic-ai/sdk is bundled in the LEGACY chunk (assets/legacyMain-*.js; src/ai/anthropic.ts, `dangerouslyAllowBrowser: true`) and the coach reads its key
// from `import.meta.env.VITE_AI_COACH_KEY` (src/ai/index.ts). Vite inlines EVERY `VITE_*` variable that exists when it builds, as plain text, into the public
// JavaScript: measured in Task 43a, a scratch build with VITE_AI_COACH_KEY=zzTESTKEYzz contained `{VITE_AI_COACH_KEY:"zzTESTKEYzz"}` in legacyMain-*.js. The committed build
// has none. ADR-0006 accepts "the user's own key from their local .env" for local use; the PUBLIC deploy (https://tekonest.com/tekpractice/jouer/) must never carry one.
//
// WHAT COUNTS. A variable whose name matches /^VITE_.*(KEY|SECRET|TOKEN|PASSWORD)/i, with a non-blank value, either
//   - in the environment of the build, or
//   - defined in a `.env*` file of the project root (.env, .env.local, .env.production, .env.<mode>, ...). `.env.example`, `.env.sample` and `.env.template` are
//     documentation that Vite never loads: they are skipped. A blank value (`VITE_AI_COACH_KEY=`) ships nothing and is not refused.
// Only NAMES and file names are ever reported. A value is never printed, never returned.
//
// Usage: `node tools/deploy-guard.mjs [projectRoot]` (exit 0 clean, 1 refused). tools/build-site.mjs calls findSecretVars() itself, before anything else.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** Names that must never reach a public bundle. */
export const SECRET_VAR = /^VITE_.*(KEY|SECRET|TOKEN|PASSWORD)/i

const NEVER_LOADED = /\.(example|sample|template)$/i
const ASSIGN = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/

/** The value part of a `.env` line, without its quotes or trailing comment. Only used to know whether it is blank. */
function bareValue(raw) {
  const v = raw.trim()
  const quote = v[0]
  if ((quote === '"' || quote === "'" || quote === '`') && v.indexOf(quote, 1) > 0) return v.slice(1, v.indexOf(quote, 1))
  const hash = v.search(/\s#/)
  return (hash >= 0 ? v.slice(0, hash) : v).trim()
}

/**
 * @param {{ env?: Record<string, string | undefined>, rootDir: string }} input
 * @returns {{ name: string, source: string }[]} where each secret-looking variable is defined (names and file names only)
 */
export function findSecretVars({ env = process.env, rootDir }) {
  const found = []
  for (const [name, value] of Object.entries(env)) {
    if (SECRET_VAR.test(name) && typeof value === 'string' && value.trim() !== '') found.push({ name, source: 'the environment' })
  }
  const files = existsSync(rootDir) ? readdirSync(rootDir).filter((f) => (f === '.env' || f.startsWith('.env.')) && !NEVER_LOADED.test(f)) : []
  for (const file of files.sort()) {
    let text
    try {
      text = readFileSync(join(rootDir, file), 'utf8')
    } catch {
      continue // a directory or an unreadable file named .env*: nothing Vite could read either
    }
    for (const line of text.split(/\r?\n/)) {
      if (/^\s*#/.test(line)) continue
      const m = ASSIGN.exec(line)
      if (m && SECRET_VAR.test(m[1]) && bareValue(m[2]) !== '') found.push({ name: m[1], source: file })
    }
  }
  return found.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source))
}

/** The message printed when the build is refused. English; names the variables and where they are set; never a value. */
export function formatRefusal(found) {
  return [
    '[build-site] REFUSED: the deploy build will not run while a secret is set.',
    'Vite copies every VITE_* variable into the public JavaScript in plain text (the Anthropic SDK is bundled in the legacy chunk, assets/legacyMain-*.js, and reads',
    'VITE_AI_COACH_KEY): anyone who opens the site could read the key. Found (names only, values are never printed):',
    ...found.map((f) => `  - ${f.name}  (${f.source})`),
    'Unset the variable (PowerShell: Remove-Item Env:VITE_AI_COACH_KEY) and/or move the .env file away, then run the build again.',
    'Local development is not affected: `npm run dev` and `npm run build` still read your .env.',
  ].join('\n')
}

function main() {
  const rootDir = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..'))
  const found = findSecretVars({ rootDir })
  if (found.length) {
    console.error(formatRefusal(found))
    process.exit(1)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
