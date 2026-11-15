// The request logic of the `delete-account` edge function, kept free of Deno and SDK imports so it can be unit-tested in Node.
// index.ts wires it to Supabase with the service role read from the function's own environment.
//
// Rules:
//  - the ONLY identity is the caller's JWT (`Authorization: Bearer <token>`), verified by `getUserId`;
//  - nothing from the request body or the query string is ever read, so a user id can never be supplied by the caller;
//  - the profile row is deleted first, then the auth user (the profile row also goes with the user through `on delete cascade`);
//  - success answers 204 with no body; a failure answers a generic message (no internal detail leaks).

export interface DeleteAccountDeps {
  /** Verifies the JWT and returns the user id it belongs to, or null when it does not verify. */
  getUserId(jwt: string): Promise<string | null>
  deleteProfile(userId: string): Promise<void>
  deleteAuthUser(userId: string): Promise<void>
}

const CORS: Record<string, string> = {
  // The call is authorised by a bearer token, not by cookies, so any origin may ask; without a valid token nothing happens.
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}

function reply(status: number, message?: string): Response {
  if (status === 204) return new Response(null, { status, headers: CORS })
  return new Response(JSON.stringify({ error: message ?? 'error' }), { status, headers: { ...CORS, 'content-type': 'application/json' } })
}

export async function handleDeleteAccount(req: Request, deps: DeleteAccountDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return reply(204)
  if (req.method !== 'POST') return reply(405, 'method not allowed')

  const m = /^Bearer\s+(\S+)$/.exec(req.headers.get('authorization') ?? '')
  if (!m) return reply(401, 'unauthorized')

  let userId: string | null
  try {
    userId = await deps.getUserId(m[1])
  } catch {
    userId = null
  }
  if (!userId) return reply(401, 'unauthorized')

  try {
    await deps.deleteProfile(userId)
    await deps.deleteAuthUser(userId)
  } catch {
    return reply(500, 'deletion failed')
  }
  return reply(204)
}
