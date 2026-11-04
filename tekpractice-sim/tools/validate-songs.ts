/**
 * validate-songs — checks content/songs.json against public/audio/songs and ASSET_LOG.md
 * (Task 38). `--root <dir>` points at another project root (used by the tests).
 */
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateSongsAt } from './songsCheck'

const i = process.argv.indexOf('--root')
const root = i >= 0 && process.argv[i + 1] ? resolve(process.argv[i + 1]) : resolve(dirname(fileURLToPath(import.meta.url)), '..')

const errors = validateSongsAt(root)
if (errors.length > 0) {
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error(`\nvalidate-songs: ${errors.length} error(s)`)
  process.exit(1)
}
console.log('validate-songs: OK (songs list valid)')
