import { describe, expect, it } from 'vitest'
import { type DeleteAccountDeps, handleDeleteAccount } from '../../supabase/functions/delete-account/handler'

function deps(over: Partial<DeleteAccountDeps> = {}): DeleteAccountDeps & { log: string[] } {
  const log: string[] = []
  return {
    log,
    getUserId: async (jwt) => {
      log.push('getUserId:' + jwt)
      return jwt === 'good-token' ? 'user-1' : null
    },
    deleteProfile: async (id) => {
      log.push('deleteProfile:' + id)
    },
    deleteAuthUser: async (id) => {
      log.push('deleteAuthUser:' + id)
    },
    ...over,
  }
}

const post = (headers: Record<string, string> = {}, body?: string): Request =>
  new Request('https://example.invalid/functions/v1/delete-account', { method: 'POST', headers, body })

describe('delete-account edge function handler', () => {
  it('204 and deletes the profile then the auth user of the token holder', async () => {
    const d = deps()
    const res = await handleDeleteAccount(post({ authorization: 'Bearer good-token' }), d)
    expect(res.status).toBe(204)
    expect(d.log).toEqual(['getUserId:good-token', 'deleteProfile:user-1', 'deleteAuthUser:user-1'])
  })

  it('never trusts a user id from the body or the query', async () => {
    const d = deps()
    const req = new Request('https://example.invalid/functions/v1/delete-account?id=victim', {
      method: 'POST',
      headers: { authorization: 'Bearer good-token', 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'victim', user_id: 'victim', userId: 'victim' }),
    })
    const res = await handleDeleteAccount(req, d)
    expect(res.status).toBe(204)
    expect(d.log.join(' ')).not.toContain('victim')
  })

  it('401 without a bearer token, and nothing is deleted', async () => {
    for (const headers of [{}, { authorization: '' }, { authorization: 'Basic abc' }, { authorization: 'Bearer ' }]) {
      const d = deps()
      const res = await handleDeleteAccount(post(headers), d)
      expect(res.status).toBe(401)
      expect(d.log.some((l) => l.startsWith('delete'))).toBe(false)
    }
  })

  it('401 when the token does not verify, and nothing is deleted', async () => {
    const d = deps()
    const res = await handleDeleteAccount(post({ authorization: 'Bearer forged' }), d)
    expect(res.status).toBe(401)
    expect(d.log).toEqual(['getUserId:forged'])
  })

  it('401 when verifying the token throws', async () => {
    const d = deps({ getUserId: async () => { throw new Error('boom') } })
    expect((await handleDeleteAccount(post({ authorization: 'Bearer good-token' }), d)).status).toBe(401)
  })

  it('405 for any other method', async () => {
    const d = deps()
    const res = await handleDeleteAccount(new Request('https://example.invalid/x', { method: 'GET', headers: { authorization: 'Bearer good-token' } }), d)
    expect(res.status).toBe(405)
    expect(d.log).toEqual([])
  })

  it('answers the browser preflight without checking anything', async () => {
    const d = deps()
    const res = await handleDeleteAccount(new Request('https://example.invalid/x', { method: 'OPTIONS' }), d)
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-headers')).toMatch(/authorization/i)
    expect(d.log).toEqual([])
  })

  it('500 with a generic body when a deletion fails, and the error text is not leaked', async () => {
    const d = deps({ deleteAuthUser: async () => { throw new Error('secret internal detail') } })
    const res = await handleDeleteAccount(post({ authorization: 'Bearer good-token' }), d)
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('secret internal detail')
  })

  it('does not delete the auth user when the profile deletion fails', async () => {
    const d = deps({ deleteProfile: async () => { throw new Error('db down') } })
    const res = await handleDeleteAccount(post({ authorization: 'Bearer good-token' }), d)
    expect(res.status).toBe(500)
    expect(d.log.some((l) => l.startsWith('deleteAuthUser'))).toBe(false)
  })

  it('puts the CORS headers on every answer', async () => {
    const res = await handleDeleteAccount(post({ authorization: 'Bearer good-token' }), deps())
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy()
  })
})
