import { describe, expect, it } from 'vitest'
import {
  MeshyError,
  createMultiImageTask,
  downloadGlb,
  getBalance,
  waitForTask,
  type MeshyTask,
} from '../../../tools/assets3d/meshy'

const KEY = 'msy_SECRET_fake_key_0123456789'
const IMG = 'data:image/png;base64,AAAA'

interface Call {
  url: string
  init: RequestInit
}

type Reply = Response | Error | (() => Response | Error)

/** A scripted fake fetch: each call consumes the next reply and is recorded in `calls`. */
function fakeFetch(replies: Reply[]): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = []
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} })
    const next = replies[Math.min(calls.length - 1, replies.length - 1)]
    const r = typeof next === 'function' ? next() : next
    if (r instanceof Error) throw r
    return r.clone()
  }) as typeof fetch
  return { fetch: fn, calls }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/** A virtual clock: `sleep` advances `now`, so polling tests run instantly. */
function clock(start = 1_000_000): { now: () => number; sleep: (ms: number) => Promise<void>; sleeps: number[] } {
  let t = start
  const sleeps: number[] = []
  return {
    now: () => t,
    sleep: async (ms) => {
      sleeps.push(ms)
      t += ms
    },
    sleeps,
  }
}

function task(over: Partial<MeshyTask> = {}): MeshyTask {
  return { id: 't1', status: 'SUCCEEDED', progress: 100, ...over }
}

describe('createMultiImageTask', () => {
  it('sends the bearer header and the documented body', async () => {
    const f = fakeFetch([json({ result: 'task-123' })])
    const id = await createMultiImageTask([IMG, IMG], { targetPolycount: 30000 }, { fetch: f.fetch, key: KEY })
    expect(id).toBe('task-123')
    expect(f.calls).toHaveLength(1)
    expect(f.calls[0].url).toBe('https://api.meshy.ai/openapi/v1/multi-image-to-3d')
    expect(f.calls[0].init.method).toBe('POST')
    const headers = f.calls[0].init.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${KEY}`)
    expect(headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(String(f.calls[0].init.body))).toEqual({
      image_urls: [IMG, IMG],
      ai_model: 'meshy-7.1',
      geometry_resolution: 'standard',
      should_texture: true,
      enable_pbr: true,
      texture_resolution: '2k',
      should_remesh: true,
      topology: 'triangle',
      target_polycount: 30000,
      target_formats: ['glb'],
      auto_size: false,
    })
  })

  it('requests triangle topology by default (the budget gate counts triangles) and quad only when asked', async () => {
    const f = fakeFetch([json({ result: 'a' }), json({ result: 'b' }), json({ result: 'c' })])
    await createMultiImageTask([IMG], { targetPolycount: 560 }, { fetch: f.fetch, key: KEY })
    await createMultiImageTask([IMG], { targetPolycount: 560, topology: 'triangle' }, { fetch: f.fetch, key: KEY })
    await createMultiImageTask([IMG], { targetPolycount: 560, topology: 'quad' }, { fetch: f.fetch, key: KEY })
    expect(f.calls.map((c) => JSON.parse(String(c.init.body)).topology)).toEqual(['triangle', 'triangle', 'quad'])
  })

  it('rejects an unknown topology before any request', async () => {
    const f = fakeFetch([json({ result: 'x' })])
    const opts = { targetPolycount: 560, topology: 'ngon' } as unknown as Parameters<typeof createMultiImageTask>[1]
    await expect(createMultiImageTask([IMG], opts, { fetch: f.fetch, key: KEY })).rejects.toThrow(/topology/)
    expect(f.calls).toHaveLength(0)
  })

  it('rejects more than 4 images before any request', async () => {
    const f = fakeFetch([json({ result: 'x' })])
    await expect(
      createMultiImageTask([IMG, IMG, IMG, IMG, IMG], { targetPolycount: 1000 }, { fetch: f.fetch, key: KEY }),
    ).rejects.toThrow(/1 to 4 images/)
    expect(f.calls).toHaveLength(0)
  })

  it('createMultiImageTask rejects zero images', async () => {
    const f = fakeFetch([json({ result: 'x' })])
    await expect(createMultiImageTask([], { targetPolycount: 1000 }, { fetch: f.fetch, key: KEY })).rejects.toThrow(
      /1 to 4 images/,
    )
    expect(f.calls).toHaveLength(0)
  })

  it('402 throws a MeshyError that says to buy API credits and makes no retry', async () => {
    const f = fakeFetch([json({ message: 'Insufficient credits' }, 402)])
    const err = await createMultiImageTask([IMG], { targetPolycount: 1000 }, { fetch: f.fetch, key: KEY }).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(MeshyError)
    expect((err as MeshyError).status).toBe(402)
    expect((err as MeshyError).message).toMatch(/buy API credits/i)
    expect((err as MeshyError).message).toMatch(/subscription settings/i)
    expect((err as MeshyError).message).toContain('Insufficient credits')
    expect(f.calls).toHaveLength(1)
  })

  it('429 throws without retrying', async () => {
    const f = fakeFetch([json({ message: 'Too many requests' }, 429)])
    const err = await createMultiImageTask([IMG], { targetPolycount: 1000 }, { fetch: f.fetch, key: KEY }).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(MeshyError)
    expect((err as MeshyError).status).toBe(429)
    expect(f.calls).toHaveLength(1)
  })

  it('a 5xx is not retried', async () => {
    const f = fakeFetch([json({ message: 'boom' }, 503), json({ result: 'late' })])
    const err = await createMultiImageTask([IMG], { targetPolycount: 1000 }, { fetch: f.fetch, key: KEY }).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(MeshyError)
    expect((err as MeshyError).status).toBe(503)
    expect(f.calls).toHaveLength(1)
  })

  it('error messages and thrown objects never contain the key', async () => {
    // The API echoes the key back in its message: the error must still not carry it.
    const f = fakeFetch([json({ message: `bad token ${KEY} rejected` }, 400)])
    const err = (await createMultiImageTask([IMG], { targetPolycount: 1000 }, { fetch: f.fetch, key: KEY }).catch(
      (e: unknown) => e,
    )) as MeshyError
    expect(err).toBeInstanceOf(MeshyError)
    expect(err.status).toBe(400)
    expect(err.message).not.toContain(KEY)
    expect(err.message).toContain('***')
    expect(JSON.stringify(err)).not.toContain(KEY)
    expect(String(err.stack)).not.toContain(KEY)
  })

  it('the thrown MeshyError serialized with JSON.stringify never contains the key', async () => {
    const f = fakeFetch([json({ message: `nope ${KEY}` }, 402)])
    const err = await createMultiImageTask([IMG], { targetPolycount: 1000 }, { fetch: f.fetch, key: KEY }).catch(
      (e: unknown) => e,
    )
    const serialized = JSON.stringify(err, Object.getOwnPropertyNames(err as object))
    expect(serialized).not.toContain(KEY)
    expect(JSON.stringify(err)).not.toContain(KEY)
  })

  it('network errors (fetch rejects) are rethrown with the key redacted', async () => {
    const f = fakeFetch([new Error(`connect ECONNRESET while sending Bearer ${KEY}`)])
    const err = (await createMultiImageTask([IMG], { targetPolycount: 1000 }, { fetch: f.fetch, key: KEY }).catch(
      (e: unknown) => e,
    )) as MeshyError
    expect(err).toBeInstanceOf(MeshyError)
    expect(err.message).toContain('ECONNRESET')
    expect(err.message).not.toContain(KEY)
    expect(JSON.stringify(err, Object.getOwnPropertyNames(err))).not.toContain(KEY)
    expect(f.calls).toHaveLength(1)
  })
})

describe('waitForTask', () => {
  it('waitForTask resolves on SUCCEEDED and returns consumed_credits', async () => {
    const c = clock()
    const f = fakeFetch([
      json(task({ status: 'PENDING', progress: 0 })),
      json(task({ status: 'IN_PROGRESS', progress: 40 })),
      json(task({ status: 'SUCCEEDED', progress: 100, consumed_credits: 30, model_urls: { glb: 'https://x/m.glb' } })),
    ])
    const got = await waitForTask('t1', { fetch: f.fetch, key: KEY, sleep: c.sleep, now: c.now })
    expect(got.status).toBe('SUCCEEDED')
    expect(got.consumed_credits).toBe(30)
    expect(f.calls).toHaveLength(3)
    expect(f.calls[0].url).toBe('https://api.meshy.ai/openapi/v1/multi-image-to-3d/t1')
    expect((f.calls[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`)
    expect(c.sleeps).toEqual([5000, 5000])
  })

  it('polls every opts.pollMs', async () => {
    const c = clock()
    const f = fakeFetch([json(task({ status: 'PENDING' })), json(task())])
    await waitForTask('t1', { fetch: f.fetch, key: KEY, sleep: c.sleep, now: c.now }, { pollMs: 250, timeoutMs: 10_000 })
    expect(c.sleeps).toEqual([250])
  })

  it('waitForTask throws with task_error.message on FAILED', async () => {
    const c = clock()
    const f = fakeFetch([json(task({ status: 'FAILED', progress: 12, task_error: { message: 'mesh generation failed' } }))])
    const err = await waitForTask('t1', { fetch: f.fetch, key: KEY, sleep: c.sleep, now: c.now }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(MeshyError)
    expect((err as MeshyError).message).toContain('mesh generation failed')
    expect((err as MeshyError).message).toContain('t1')
  })

  it('throws on CANCELED', async () => {
    const c = clock()
    const f = fakeFetch([json(task({ status: 'CANCELED' }))])
    await expect(waitForTask('t1', { fetch: f.fetch, key: KEY, sleep: c.sleep, now: c.now })).rejects.toThrow(/CANCELED/)
  })

  it('waitForTask times out with the task id', async () => {
    const c = clock()
    const f = fakeFetch([json(task({ status: 'IN_PROGRESS', progress: 10 }))])
    const err = await waitForTask(
      'task-abc',
      { fetch: f.fetch, key: KEY, sleep: c.sleep, now: c.now },
      { pollMs: 1000, timeoutMs: 5000 },
    ).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(MeshyError)
    expect((err as MeshyError).message).toMatch(/timed out/i)
    expect((err as MeshyError).message).toContain('task-abc')
    expect(f.calls.length).toBeLessThanOrEqual(7)
  })

  it('a 5xx on a poll is not retried', async () => {
    const c = clock()
    const f = fakeFetch([json({ message: 'down' }, 500), json(task())])
    const err = await waitForTask('t1', { fetch: f.fetch, key: KEY, sleep: c.sleep, now: c.now }).catch((e: unknown) => e)
    expect((err as MeshyError).status).toBe(500)
    expect(f.calls).toHaveLength(1)
  })
})

describe('downloadGlb', () => {
  it('returns the bytes of the glb url', async () => {
    const bytes = new Uint8Array([103, 108, 84, 70, 2, 0, 0, 0])
    const f = fakeFetch([() => new Response(bytes, { status: 200 })])
    const got = await downloadGlb(
      task({ model_urls: { glb: 'https://assets.meshy.ai/m.glb?sig=1' }, expires_at: 2_000_000 }),
      { fetch: f.fetch, key: KEY, now: () => 1_000_000 },
    )
    expect(Array.from(got)).toEqual(Array.from(bytes))
    expect(f.calls[0].url).toBe('https://assets.meshy.ai/m.glb?sig=1')
    // the signed URL host must not receive the API key
    expect(JSON.stringify(f.calls[0].init)).not.toContain(KEY)
  })

  it('downloadGlb refuses an expired task', async () => {
    const f = fakeFetch([() => new Response(new Uint8Array([1]), { status: 200 })])
    await expect(
      downloadGlb(task({ model_urls: { glb: 'https://x/m.glb' }, expires_at: 999_999 }), {
        fetch: f.fetch,
        key: KEY,
        now: () => 1_000_000,
      }),
    ).rejects.toThrow(/expired/i)
    expect(f.calls).toHaveLength(0)
  })

  it('treats expires_at 0 or absent as no expiry information', async () => {
    const f = fakeFetch([() => new Response(new Uint8Array([1, 2]), { status: 200 })])
    const got = await downloadGlb(task({ model_urls: { glb: 'https://x/m.glb' }, expires_at: 0 }), {
      fetch: f.fetch,
      key: KEY,
      now: () => 1_000_000,
    })
    expect(got.byteLength).toBe(2)
  })

  it('throws when model_urls.glb is missing', async () => {
    const f = fakeFetch([() => new Response(new Uint8Array([1]), { status: 200 })])
    await expect(downloadGlb(task({ model_urls: {} }), { fetch: f.fetch, key: KEY })).rejects.toThrow(/glb/)
    await expect(downloadGlb(task(), { fetch: f.fetch, key: KEY })).rejects.toThrow(/glb/)
    expect(f.calls).toHaveLength(0)
  })

  it('throws a MeshyError on a non-2xx download', async () => {
    const f = fakeFetch([() => new Response('gone', { status: 403 })])
    const err = await downloadGlb(task({ model_urls: { glb: 'https://x/m.glb' } }), { fetch: f.fetch, key: KEY }).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(MeshyError)
    expect((err as MeshyError).status).toBe(403)
  })
})

describe('getBalance', () => {
  it('GETs /openapi/v1/balance with the bearer header and returns the integer balance', async () => {
    const f = fakeFetch([json({ balance: 1000, monthly_credits: 600, permanent_credits: 400, monthly_resets_at: 1793491200000 })])
    const got = await getBalance({ fetch: f.fetch, key: KEY })
    expect(got).toBe(1000)
    expect(f.calls).toHaveLength(1)
    expect(f.calls[0].url).toBe('https://api.meshy.ai/openapi/v1/balance')
    expect(f.calls[0].init.method).toBe('GET')
    expect((f.calls[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`)
  })

  it('throws a MeshyError without the key on 401, and when balance is not an integer', async () => {
    const bad = fakeFetch([json({ message: `invalid key ${KEY}` }, 401)])
    const err = (await getBalance({ fetch: bad.fetch, key: KEY }).catch((e: unknown) => e)) as MeshyError
    expect(err).toBeInstanceOf(MeshyError)
    expect(err.status).toBe(401)
    expect(err.message).not.toContain(KEY)
    expect(bad.calls).toHaveLength(1)
    const odd = fakeFetch([json({ balance: 'lots' })])
    await expect(getBalance({ fetch: odd.fetch, key: KEY })).rejects.toThrow(/balance/)
  })
})

describe('createMultiImageTask pre-flight validation', () => {
  async function rejected(images: string[], polycount: number, pattern: RegExp): Promise<void> {
    const f = fakeFetch([json({ result: 'x' })])
    const err = await createMultiImageTask(images, { targetPolycount: polycount }, { fetch: f.fetch, key: KEY }).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(MeshyError)
    expect((err as MeshyError).status).toBe(0)
    expect((err as MeshyError).message).toMatch(pattern)
    expect((err as MeshyError).message).not.toContain(KEY)
    expect(f.calls).toHaveLength(0)
  }

  it.each([NaN, Infinity, 1000.5, 99, 300001, -5, 0])('rejects targetPolycount %s before any request', async (n) => {
    await rejected([IMG], n, /targetPolycount/)
  })

  it.each([100, 300000])('accepts the targetPolycount bound %s', async (n) => {
    const f = fakeFetch([json({ result: 'ok' })])
    await expect(createMultiImageTask([IMG], { targetPolycount: n }, { fetch: f.fetch, key: KEY })).resolves.toBe('ok')
    expect(f.calls).toHaveLength(1)
  })

  it.each([
    ['a plain http URL', 'http://example.com/a.png'],
    ['a local path', 'C:/images/front.png'],
    ['a gif data URI', 'data:image/gif;base64,AAAA'],
    ['a non-base64 data URI', 'data:image/png,AAAA'],
    ['an empty string', ''],
  ])('rejects %s before any request', async (_label, img) => {
    await rejected([IMG, img], 1000, /https URL or a data:image/)
  })

  it('accepts https URLs and png / jpeg / webp data URIs', async () => {
    const f = fakeFetch([json({ result: 'ok' })])
    const imgs = ['https://example.com/a.png', 'data:image/jpeg;base64,AAAA', 'data:image/webp;base64,AAAA']
    await expect(createMultiImageTask(imgs, { targetPolycount: 1000 }, { fetch: f.fetch, key: KEY })).resolves.toBe('ok')
  })

  it('rejects a data URI whose decoded size is over 20 MB, without decoding it', async () => {
    // 20 MiB = 20971520 bytes; 27962032 base64 chars decode to 20971524 bytes.
    const big = 'data:image/png;base64,' + 'A'.repeat(27_962_032)
    await rejected([big], 1000, /20 MB/)
  })

  it('accepts a data URI just under 20 MB', async () => {
    const f = fakeFetch([json({ result: 'ok' })])
    const edge = 'data:image/png;base64,' + 'A'.repeat(27_962_024) // 20971518 bytes
    await expect(createMultiImageTask([edge], { targetPolycount: 1000 }, { fetch: f.fetch, key: KEY })).resolves.toBe('ok')
  })
})

describe('credit safety on the create POST', () => {
  it('a rejected fetch says a task MAY already have been created', async () => {
    const f = fakeFetch([new Error(`socket hang up ${KEY}`)])
    const err = (await createMultiImageTask([IMG], { targetPolycount: 1000 }, { fetch: f.fetch, key: KEY }).catch(
      (e: unknown) => e,
    )) as MeshyError
    expect(err).toBeInstanceOf(MeshyError)
    expect(err.message).toMatch(/may already have been created/i)
    expect(err.message).toMatch(/dashboard/i)
    expect(err.message).not.toContain(KEY)
    expect(f.calls).toHaveLength(1)
  })

  it('a 500 says a task MAY already have been created, keeps the status, and is not retried', async () => {
    const f = fakeFetch([json({ message: 'internal' }, 500), json({ result: 'late' })])
    const err = (await createMultiImageTask([IMG], { targetPolycount: 1000 }, { fetch: f.fetch, key: KEY }).catch(
      (e: unknown) => e,
    )) as MeshyError
    expect(err.status).toBe(500)
    expect(err.message).toMatch(/may already have been created/i)
    expect(err.message).toMatch(/dashboard/i)
    expect(f.calls).toHaveLength(1)
  })

  it('a 200 without a task id also warns that a task may exist', async () => {
    const f = fakeFetch([json({})])
    const err = (await createMultiImageTask([IMG], { targetPolycount: 1000 }, { fetch: f.fetch, key: KEY }).catch(
      (e: unknown) => e,
    )) as MeshyError
    expect(err.message).toMatch(/may already have been created/i)
  })

  it('a 400 / 402 / 429 (nothing created) does not carry the warning', async () => {
    for (const status of [400, 402, 429]) {
      const f = fakeFetch([json({ message: 'no' }, status)])
      const err = (await createMultiImageTask([IMG], { targetPolycount: 1000 }, { fetch: f.fetch, key: KEY }).catch(
        (e: unknown) => e,
      )) as MeshyError
      expect(err.message).not.toMatch(/may already have been created/i)
    }
  })
})

describe('waitForTask poll errors', () => {
  const run = (replies: Reply[]): Promise<unknown> => {
    const c = clock()
    const f = fakeFetch(replies)
    return waitForTask('task-xyz', { fetch: f.fetch, key: KEY, sleep: c.sleep, now: c.now }).catch((e: unknown) => e)
  }

  it('a 500 poll names the task id and says it may still be running', async () => {
    const err = (await run([json({ message: 'down' }, 500)])) as MeshyError
    expect(err).toBeInstanceOf(MeshyError)
    expect(err.status).toBe(500)
    expect(err.message).toContain('task-xyz')
    expect(err.message).toMatch(/may still be running/i)
    expect(err.message).not.toContain(KEY)
  })

  it('a rejected fetch while polling names the task id, says it may still be running, and hides the key', async () => {
    const err = (await run([new Error(`ECONNRESET ${KEY}`)])) as MeshyError
    expect(err).toBeInstanceOf(MeshyError)
    expect(err.message).toContain('ECONNRESET')
    expect(err.message).toContain('task-xyz')
    expect(err.message).toMatch(/may still be running/i)
    expect(err.message).not.toContain(KEY)
    expect(JSON.stringify(err, Object.getOwnPropertyNames(err))).not.toContain(KEY)
  })

  it('a 200 with invalid JSON becomes a MeshyError, not a SyntaxError', async () => {
    const err = (await run([new Response('<html>oops</html>', { status: 200 })])) as MeshyError
    expect(err).toBeInstanceOf(MeshyError)
    expect(err.message).toContain('task-xyz')
    expect(err.message).toMatch(/may still be running/i)
    expect(err.message).not.toContain(KEY)
  })

  it('a 200 with a null body becomes a MeshyError', async () => {
    const err = (await run([json(null)])) as MeshyError
    expect(err).toBeInstanceOf(MeshyError)
    expect(err.message).toContain('task-xyz')
  })

  it('a FAILED task is not described as still running', async () => {
    const err = (await run([json(task({ status: 'FAILED', task_error: { message: 'bad mesh' } }))])) as MeshyError
    expect(err.message).toContain('bad mesh')
    expect(err.message).not.toMatch(/may still be running/i)
  })
})

describe('downloadGlb without an API key', () => {
  it('works with MESHY_API_KEY unset and no deps.key', async () => {
    const saved = process.env.MESHY_API_KEY
    delete process.env.MESHY_API_KEY
    try {
      const f = fakeFetch([() => new Response(new Uint8Array([7, 8, 9]), { status: 200 })])
      const got = await downloadGlb(task({ model_urls: { glb: 'https://assets.meshy.ai/m.glb' } }), { fetch: f.fetch })
      expect(Array.from(got)).toEqual([7, 8, 9])
      expect(f.calls[0].init.headers).toBeUndefined()
    } finally {
      if (saved !== undefined) process.env.MESHY_API_KEY = saved
    }
  })
})
