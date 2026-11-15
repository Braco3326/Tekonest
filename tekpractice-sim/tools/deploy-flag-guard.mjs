// The deploy build must never carry a test switch. tools/build-site.mjs blanks TP_TEST_FEATURES for Vite, and this is the proof on the output: after the
// build, no JavaScript file of the output may hold a feature table with the guide's inbox, the assistant (`guide`) or the learning pages (`legacyPages`) switched
// on, and the product's own table (all of them off) must be in it. In a minified chunk a flag reads `!0` (on) or `!1` (off); an unminified or hand-written table
// reads `true` / `false`. The table is written in this key order: levels, legacyPages, guide, guideLegacy, guideInbox (src/features.ts). Pure helpers, no side
// effects except reading files.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/** The flag set to true, minified (`!0`) or written out. `!0` followed by a word character (`!0x`) is not the flag. */
export const INBOX_ON = /guideInbox\s*:\s*(?:!0|true)(?![\w$])/

/** The learning pages (levels, exam, sandbox, dashboard) switched on in a feature table. */
export const PAGES_ON = /\blegacyPages\s*:\s*(?:!0|true)(?![\w$])/

/** The assistant switched on in a feature table (the `guide` key, written before `guideLegacy`). */
export const GUIDE_ON = /\bguide\s*:\s*(?:!0|true)(?![\w$])\s*,\s*guideLegacy/

/** The product's table: levels, the learning pages, the assistant and its level-page switch, all off. */
export const PRODUCT_TABLE = /levels\s*:\s*(?:!1|false)\s*,\s*legacyPages\s*:\s*(?:!1|false)\s*,\s*guide\s*:\s*(?:!1|false)\s*,\s*guideLegacy\s*:\s*(?:!1|false)(?![\w$])/

/** The paths (as given) of the files whose text holds a switch set to on. `files` is a list of { path, text }. */
export function findTestFlags(files) {
  return files.filter((f) => typeof f.text === 'string' && (INBOX_ON.test(f.text) || PAGES_ON.test(f.text) || GUIDE_ON.test(f.text))).map((f) => f.path)
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })

const readJs = (dir) =>
  walk(dir)
    .filter((p) => /\.m?js$/i.test(p))
    .map((p) => ({ path: relative(dir, p).replaceAll('\\', '/'), text: readFileSync(p, 'utf8') }))

/** Scans every .js and .mjs file under `dir`; returns the paths relative to it with a switch on. */
export function scanOutputForTestFlags(dir) {
  if (!existsSync(dir)) return []
  return findTestFlags(readJs(dir))
}

/** True when some .js or .mjs file under `dir` holds the product's table (everything off). An output without it is not proved to be the product. */
export function hasProductTable(dir) {
  return existsSync(dir) && readJs(dir).some((f) => PRODUCT_TABLE.test(f.text))
}

export function formatFlagRefusal(paths) {
  return [
    '[build-site] REFUSED: the build output carries a test switch (the assistant, the learning pages or the guide inbox is ON in the feature table).',
    'A deploy build must have them off. Found in (file names only):',
    ...paths.map((p) => `  - ${p}`),
    'Unset TP_TEST_FEATURES in the environment, check vite.config.ts and src/features.ts, and run the build again. The output was removed.',
  ].join('\n')
}

export function formatMissingTableRefusal() {
  return [
    '[build-site] REFUSED: the build output does not carry the product feature table (levels, legacyPages, guide, guideLegacy all off).',
    'Either src/features.ts changed its key order or names, or the build was not made from it. Nothing is proved, so nothing ships. The output was removed.',
  ].join('\n')
}
