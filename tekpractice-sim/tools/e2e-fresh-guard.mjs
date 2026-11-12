// Guard for `npm run e2e:fresh`: Playwright must run on a private port (E2E_PORT), never one that
// another tool holds. A reused server would serve another checkout's build and the run would test the wrong code.
import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Ports other tools hold: never use them for the e2e preview server. */
export const FORBIDDEN_E2E_PORTS = [4173, 4174, 4181, 5173, 3060]

/** `{ ok, message }` for an environment; `message` is empty when ok. */
export function checkE2ePort(env) {
  const raw = (env.E2E_PORT ?? '').trim()
  if (raw === '') {
    return { ok: false, message: 'e2e:fresh needs a private port: set E2E_PORT (for example 4391; PowerShell: $env:E2E_PORT=\'4391\') and run again.' }
  }
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 65535) {
    return { ok: false, message: `e2e:fresh: E2E_PORT="${raw}" is not a port number (1 to 65535). Use 4391.` }
  }
  const port = Number(raw)
  if (FORBIDDEN_E2E_PORTS.includes(port)) {
    return { ok: false, message: `e2e:fresh: E2E_PORT=${port} belongs to another tool (never ${FORBIDDEN_E2E_PORTS.join(', ')}). Use 4391.` }
  }
  return { ok: true, message: '' }
}

function main() {
  const r = checkE2ePort(process.env)
  if (!r.ok) {
    console.error(r.message)
    process.exit(1)
  }
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
