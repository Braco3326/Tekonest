// The deploy build must never carry a test switch. tools/build-site.mjs blanks TP_TEST_FEATURES for Vite, and this is the proof on the output: after the
// build, no JavaScript file of the output may hold a feature table with the guide's inbox switched on. In a minified chunk the flag reads `guideInbox:!0`
// (on) or `guideInbox:!1` (off); an unminified or hand-written table reads `guideInbox: true`. Pure helpers, no side effects except reading files.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/** The flag set to true, minified (`!0`) or written out. `!0` followed by a word character (`!0x`) is not the flag. */
export const INBOX_ON = /guideInbox\s*:\s*(?:!0|true)(?![\w$])/

/** The paths (as given) of the files whose text holds the flag set to true. `files` is a list of { path, text }. */
export function findTestFlags(files) {
  return files.filter((f) => typeof f.text === 'string' && INBOX_ON.test(f.text)).map((f) => f.path)
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })

/** Scans every .js and .mjs file under `dir`; returns the paths relative to it with the flag on. */
export function scanOutputForTestFlags(dir) {
  if (!existsSync(dir)) return []
  const files = walk(dir)
    .filter((p) => /\.m?js$/i.test(p))
    .map((p) => ({ path: relative(dir, p).replaceAll('\\', '/'), text: readFileSync(p, 'utf8') }))
  return findTestFlags(files)
}

export function formatFlagRefusal(paths) {
  return [
    '[build-site] REFUSED: the build output carries a test switch (the guide inbox is ON in the feature table).',
    'A deploy build must have the flag off. Found in (file names only):',
    ...paths.map((p) => `  - ${p}`),
    'Unset TP_TEST_FEATURES in the environment, check vite.config.ts, and run the build again. The output was removed.',
  ].join('\n')
}
