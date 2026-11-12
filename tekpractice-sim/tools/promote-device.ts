/**
 * promote-device: the two-stage promotion of a plan row (Wave 0, Task 0.4; Wave 0b). See tools/promoteDevice.ts for what each stage writes.
 *
 *   npm run promote -- <id> [--dry-run]              stage 1: asset-spec skeleton + plan row `staged`; catalogue and proposals untouched
 *   npm run promote -- <id> --commit [--dry-run]     stage 2 (after the GLB shipped and the gates are green): catalogue entry (promoted) or proposal update
 *                                                    (beta-modelled)
 *   npm run promote -- <id> --revert [--discard-spec] [--dry-run]   undo the latest stage completely
 *
 * Exit code 0 for staged / promoted / beta-modelled / reverted (also a no-op), 3 for blocked (nothing written), 1 for an error.
 */
import { promoteDevice } from './promoteDevice'

function main(argv: string[]): number {
  const flag = (f: string): boolean => argv.includes(f)
  const id = argv.find((a) => !a.startsWith('--'))
  if (!id) {
    console.error('usage: npm run promote -- <id> [--commit | --revert [--discard-spec]] [--dry-run]')
    return 2
  }
  if (flag('--commit') && flag('--revert')) {
    console.error('promote: --commit and --revert exclude each other')
    return 2
  }
  try {
    const dryRun = flag('--dry-run')
    const r = promoteDevice(id, { dryRun, commit: flag('--commit'), revert: flag('--revert'), discardSpec: flag('--discard-spec') })
    console.log(`${r.id}: ${r.outcome}${dryRun ? ' (dry run: nothing written)' : ''}`)
    for (const c of r.changes) console.log(`  - ${c}`)
    for (const i of r.issues ?? []) console.log(`  ! ${i}`)
    if (r.reason) console.log(`  ${r.outcome === 'blocked' ? 'blocked: ' : ''}${r.reason}`)
    return r.outcome === 'blocked' ? 3 : 0
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 1
  }
}

process.exit(main(process.argv.slice(2)))
