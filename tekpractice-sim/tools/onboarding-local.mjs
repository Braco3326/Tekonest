// Local runner for the five design packages: `npm run onboarding:local`.
// Builds this checkout, serves dist on port 4392 (strict: it fails rather than pick another port),
// and prints the five `?design=n` addresses and how to see the first visit again.
// Port 4391 is the e2e suites' port; 4173, 4174, 4181, 5173 and 3060 belong to other tools. Never push, never deploy.
import { spawn, spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const LOCAL_PORT = 4392

/** The five package addresses, `?design=1` to `?design=5`, in order. */
export function designAddresses(port = LOCAL_PORT) {
  return [1, 2, 3, 4, 5].map((n) => `http://localhost:${port}/?design=${n}`)
}

/**
 * How to see the first visit again. The narrow reset comes first: it removes only the profile and tutorial keys (spec 4.4),
 * so saved projects stay. `localStorage.clear()` wipes everything on this address, saved projects and autosave included.
 */
export function resetTip() {
  return [
    'To see the first visit again, in the browser console on this address (own storage: port 4392 only), run these three lines and reload:',
    "  localStorage.removeItem('audio-sim/creation-onboarding.v1'); localStorage.removeItem('oscar-guide.onboarding.v1'); localStorage.removeItem('oscar-guide.state.v1')",
    'This keeps your saved projects. A private window also starts fresh (close ALL private windows between two packages: they share one memory while any stays open).',
    'If a saved bench reopens instead of the start screen, an autosave exists on this address: use a private window.',
    'Only if that is not enough: localStorage.clear() on this address also erases your saved projects there.',
  ].join('\n')
}

/** The command that stops a process AND its children: on Windows the server is started through a shell, so a plain kill leaves node running. Null elsewhere. */
export function killTreeCommand(pid, platform = process.platform) {
  return platform === 'win32' ? ['taskkill', ['/pid', String(pid), '/T', '/F']] : null
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const build = spawnSync(npm, ['run', 'build'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
  if (build.status !== 0) {
    console.error('onboarding-local: the build failed, nothing is served.')
    process.exit(build.status ?? 1)
  }
  console.log('')
  console.log(`Five design packages (local only), served from this checkout's dist on port ${LOCAL_PORT}:`)
  for (const a of designAddresses()) console.log('  ' + a)
  console.log('  without ?design: http://localhost:' + LOCAL_PORT + '/ (today\'s game)')
  console.log('')
  console.log(resetTip())
  console.log('Stop with Ctrl+C.')
  console.log('')
  const server = spawn(npm, ['run', 'preview', '--', '--port', String(LOCAL_PORT), '--strictPort'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    const cmd = killTreeCommand(server.pid)
    if (cmd) spawnSync(cmd[0], cmd[1], { stdio: 'ignore' })
    else server.kill()
  }
  process.on('SIGINT', () => {
    stop()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    stop()
    process.exit(0)
  })
  process.on('exit', stop)
  server.on('exit', (code) => process.exit(code ?? 0))
}

/** True when this file is the script node was started with (both sides through realpath). */
function isMain() {
  try {
    return !!process.argv[1] && realpathSync.native(resolve(process.argv[1])) === realpathSync.native(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isMain()) main()
