/**
 * assets3d/meshy: minimal client for Meshy's multi-image-to-3D API (https://docs.meshy.ai/en/api).
 *
 *  - `createMultiImageTask` POSTs 1-4 reference images (data URIs) and returns the task id
 *  - `waitForTask` polls the task until it reaches a terminal status
 *  - `downloadGlb` fetches the finished GLB (Meshy deletes its files after 3 days: download right away)
 *
 * Money rules (every successful create spends credits; multi-image on meshy-7.1 costs 20 mesh only, 30 with 2K or 4K
 * textures, 35 with 8K textures):
 *  - exactly ONE HTTP attempt per call, no retry on 402 / 429 / 5xx: a retry loop could create, and pay for, a second task
 *  - API usage is billed from PREPAID API credits bought in the Meshy subscription settings; the plan's monthly credits may
 *    not cover it, and the free plan cannot create tasks at all (402 either way)
 * Secret rules: the API key only ever travels in the Authorization header. Every thrown message passes through `redact`, so
 * neither `err.message`, `err.stack` nor a serialized error contains it. The asset download deliberately sends no key.
 * All I/O is injectable (`fetch`, `sleep`, `now`, `key`) so tests run offline and instantly.
 */
import { redact, requireMeshyKey } from './env'

const BASE_URL = 'https://api.meshy.ai'
const TASK_PATH = '/openapi/v1/multi-image-to-3d'
const MAX_IMAGES = 4
const DEFAULT_POLL_MS = 5000
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000
const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'CANCELED'])

export interface MeshyOpts {
  /** Target face count after remeshing (Meshy accepts 100 to 300000). */
  targetPolycount: number
}

export interface MeshyTask {
  id: string
  /** 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' */
  status: string
  progress: number
  model_urls?: { glb?: string }
  /** Credits charged (0 for a FAILED task). */
  consumed_credits?: number
  /** Unix ms when Meshy deletes the files; 0 or absent when unknown. */
  expires_at?: number
  task_error?: { message: string }
}

export interface MeshyDeps {
  fetch: typeof fetch
  key: string
  sleep: (ms: number) => Promise<void>
  now: () => number
}

export interface WaitOpts {
  pollMs: number
  timeoutMs: number
}

/** A failed Meshy call. `status` is the HTTP status, or 0 when no HTTP status applies (network error, FAILED task, timeout). */
export class MeshyError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'MeshyError'
    this.status = status
  }
}

function resolveDeps(deps: Partial<MeshyDeps>): MeshyDeps {
  return {
    fetch: deps.fetch ?? globalThis.fetch,
    key: deps.key ?? requireMeshyKey(),
    sleep: deps.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms))),
    now: deps.now ?? Date.now,
  }
}

/** Pulls the API's own message out of an error response body (JSON `message`, else the first 200 chars of text). */
async function apiMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  try {
    const parsed = JSON.parse(text) as { message?: unknown }
    if (typeof parsed.message === 'string' && parsed.message) return parsed.message
  } catch {
    // not JSON: fall through to the raw text
  }
  return text.slice(0, 200)
}

async function failure(res: Response, key: string): Promise<MeshyError> {
  const detail = await apiMessage(res)
  let text = `Meshy request failed with HTTP ${res.status}`
  if (res.status === 402) {
    text =
      'Meshy returned HTTP 402: insufficient credits or a free plan. Buy API credits in the Meshy subscription settings ' +
      "(the plan's monthly credits may not cover the API; API usage is prepaid)"
  } else if (res.status === 429) {
    text = 'Meshy returned HTTP 429: rate limited, wait before trying again'
  }
  return new MeshyError(res.status, redact(detail ? `${text}: ${detail}` : text, key))
}

/** One HTTP attempt. Network errors become a MeshyError (status 0) with the key scrubbed; nothing is retried. */
async function send(url: string, init: RequestInit, d: MeshyDeps): Promise<Response> {
  try {
    return await d.fetch(url, init)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new MeshyError(0, redact(`Meshy network error: ${msg}`, d.key))
  }
}

function authHeaders(d: MeshyDeps): Record<string, string> {
  return { Authorization: `Bearer ${d.key}`, 'Content-Type': 'application/json' }
}

/** Starts a multi-image-to-3D task from 1-4 image data URIs and returns its id. Spends credits: called once, never retried. */
export async function createMultiImageTask(
  images: string[],
  opts: MeshyOpts,
  deps: Partial<MeshyDeps> = {},
): Promise<string> {
  if (images.length < 1 || images.length > MAX_IMAGES) {
    throw new MeshyError(0, `Meshy multi-image-to-3d takes 1 to ${MAX_IMAGES} images, got ${images.length}`)
  }
  const d = resolveDeps(deps)
  const body = {
    image_urls: images,
    ai_model: 'meshy-7.1',
    geometry_resolution: 'standard',
    should_texture: true,
    enable_pbr: true,
    texture_resolution: '2k',
    should_remesh: true,
    topology: 'quad',
    target_polycount: opts.targetPolycount,
    target_formats: ['glb'],
    auto_size: false,
  }
  const res = await send(BASE_URL + TASK_PATH, { method: 'POST', headers: authHeaders(d), body: JSON.stringify(body) }, d)
  if (!res.ok) throw await failure(res, d.key)
  const parsed = (await res.json().catch(() => null)) as { result?: unknown } | null
  if (!parsed || typeof parsed.result !== 'string' || !parsed.result) {
    throw new MeshyError(res.status, 'Meshy create response had no task id (result)')
  }
  return parsed.result
}

/** Polls the task every `pollMs` until SUCCEEDED (returned), FAILED / CANCELED (thrown) or `timeoutMs` (thrown, naming the id). */
export async function waitForTask(
  id: string,
  deps: Partial<MeshyDeps> = {},
  opts: Partial<WaitOpts> = {},
): Promise<MeshyTask> {
  const d = resolveDeps(deps)
  const pollMs = opts.pollMs ?? DEFAULT_POLL_MS
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const start = d.now()
  for (;;) {
    const res = await send(`${BASE_URL}${TASK_PATH}/${encodeURIComponent(id)}`, { method: 'GET', headers: authHeaders(d) }, d)
    if (!res.ok) throw await failure(res, d.key)
    const task = (await res.json()) as MeshyTask
    if (TERMINAL.has(task.status)) {
      if (task.status === 'SUCCEEDED') return task
      const why = task.task_error?.message ? `: ${task.task_error.message}` : ''
      throw new MeshyError(0, redact(`Meshy task ${id} ${task.status}${why}`, d.key))
    }
    if (d.now() - start >= timeoutMs) {
      throw new MeshyError(0, `Meshy task ${id} timed out after ${timeoutMs} ms (last status ${task.status}, ${task.progress}%)`)
    }
    await d.sleep(pollMs)
  }
}

/** Downloads the finished GLB. Refuses a task without a glb url or whose files Meshy already expired. */
export async function downloadGlb(task: MeshyTask, deps: Partial<MeshyDeps> = {}): Promise<Uint8Array> {
  const url = task.model_urls?.glb
  if (!url) throw new MeshyError(0, `Meshy task ${task.id} has no model_urls.glb to download`)
  const d = resolveDeps(deps)
  if (task.expires_at && task.expires_at < d.now()) {
    throw new MeshyError(0, `Meshy task ${task.id} has expired (files are deleted after 3 days); its GLB can no longer be downloaded`)
  }
  // The url is pre-signed: no Authorization header, so the key never reaches the asset host.
  const res = await send(url, { method: 'GET' }, d)
  if (!res.ok) throw await failure(res, d.key)
  return new Uint8Array(await res.arrayBuffer())
}

/**
 * Credits the API key's account can spend (`GET /openapi/v1/balance`, free to call, documented 2026-10-29).
 * The docs' response also carries monthly_credits / permanent_credits / monthly_resets_at; only `balance` is used here.
 * A balance of 0 means the prepaid API credits are empty even if the plan shows monthly credits: top up in the subscription settings.
 */
export async function getBalance(deps: Partial<MeshyDeps> = {}): Promise<number> {
  const d = resolveDeps(deps)
  const res = await send(`${BASE_URL}/openapi/v1/balance`, { method: 'GET', headers: authHeaders(d) }, d)
  if (!res.ok) throw await failure(res, d.key)
  const parsed = (await res.json().catch(() => null)) as { balance?: unknown } | null
  if (!parsed || typeof parsed.balance !== 'number' || !Number.isInteger(parsed.balance)) {
    throw new MeshyError(res.status, 'Meshy balance response had no integer balance')
  }
  return parsed.balance
}
