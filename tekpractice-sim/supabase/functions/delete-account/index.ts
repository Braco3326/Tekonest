// Supabase Edge Function (Deno): delete-account.
// Deletes the CALLER's profile row and auth user. Deployed by the founder (see supabase/README.md); it is not run by the repository's tests,
// only handler.ts is (tests/accounts/deleteAccountFunction.test.ts).
//
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase to every edge function: nothing is written here.
// The service role key stays inside the function's environment and never reaches the browser.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { handleDeleteAccount } from './handler.ts'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): unknown
}

const url = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

Deno.serve((req) =>
  handleDeleteAccount(req, {
    // Verifies the caller's JWT with the auth server: a forged or expired token returns no user.
    async getUserId(jwt) {
      const asCaller = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
      const { data, error } = await asCaller.auth.getUser(jwt)
      return error || !data.user ? null : data.user.id
    },
    async deleteProfile(userId) {
      const { error } = await admin.from('profiles').delete().eq('id', userId)
      if (error) throw error
    },
    async deleteAuthUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) throw error
    },
  })
)
