/**
 * assets3d/meshy-balance: `npm run asset:balance` prints the Meshy credit balance as a bare integer on stdout.
 *
 * Endpoint: GET https://api.meshy.ai/openapi/v1/balance (confirmed in the Meshy docs, https://docs.meshy.ai/en/api/balance,
 * 2026-10-29; not yet exercised against the live API). Free to call.
 * Needs MESHY_API_KEY. The key is never printed: errors go through the client's redaction and only their message is shown.
 * Exit codes: 0 integer printed, 1 key unset or the call failed. A printed 0 means the prepaid API credits are empty:
 * buy a small API top-up in the Meshy subscription settings before generating anything.
 */
import { requireMeshyKey } from './env'
import { isMainModule } from './mainModule'
import { getBalance } from './meshy'

export async function main(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  try {
    const key = requireMeshyKey(env)
    console.log(String(await getBalance({ key })))
    return 0
  } catch (e) {
    console.error(e instanceof Error ? e.message : 'Meshy balance check failed')
    return 1
  }
}

if (isMainModule(process.argv[1], import.meta.url)) void main().then((code) => process.exit(code))
