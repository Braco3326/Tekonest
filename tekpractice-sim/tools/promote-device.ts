/**
 * promote-device: `npm run promote -- <id> [--dry-run]` (Wave 0, Task 0.4). See tools/promoteDevice.ts for what it writes.
 * Exit code 0 for promoted / beta-modelled (also a no-op), 3 for blocked (nothing written), 1 for an error.
 */
import { promoteDevice } from './promoteDevice'

function main(argv: string[]): number {
  const dryRun = argv.includes('--dry-run')
  const id = argv.find((a) => !a.startsWith('--'))
  if (!id) {
    console.error('usage: npm run promote -- <id> [--dry-run]')
    return 2
  }
  try {
    const r = promoteDevice(id, { dryRun })
    console.log(`${r.id}: ${r.outcome}${dryRun ? ' (dry run: nothing written)' : ''}`)
    for (const c of r.changes) console.log(`  - ${c}`)
    if (r.reason) console.log(`  ${r.outcome === 'blocked' ? 'blocked: ' : ''}${r.reason}`)
    return r.outcome === 'blocked' ? 3 : 0
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 1
  }
}

process.exit(main(process.argv.slice(2)))
