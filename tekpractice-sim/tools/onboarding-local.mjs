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

/** How to see the first visit again (the browser keeps its state per address, so this port has its own). */
export function resetTip() {
  return 'To see the first visit again: open a private window, or run localStorage.clear() in the browser console on this address, then reload.'
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
  const stop = () => server.kill()
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
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
