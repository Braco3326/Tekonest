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

/** The ai_model every task requests; the builder records it as the manifest's toolVersion. */
export const MESHY_MODEL = 'meshy-7.1'
const BASE_URL = 'https://api.meshy.ai'
const TASK_PATH = '/openapi/v1/multi-image-to-3d'
const MAX_IMAGES = 4
const DEFAULT_POLL_MS = 5000
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000
const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'CANCELED'])
const MIN_POLYCOUNT = 100
const MAX_POLYCOUNT = 300000
/** Meshy rejects images over 20 MB; checked on the decoded size. */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const DATA_URI = /^data:image\/(png|jpeg|webp);base64,/
const MAY_EXIST =
  'A task MAY already have been created and charged: check the Meshy dashboard before retrying, or a second paid task could be created'

/** Remesh topology. A GLB is always triangulated, so a quad target count turns into about twice as many triangles. */
export type MeshyTopology = 'triangle' | 'quad'

export interface MeshyOpts {
  /** Target face count after remeshing (Meshy accepts 100 to 300000). */
  targetPolycount: number
  /** Default 'triangle': the target is then a triangle count, the unit of the pipeline's budget gate. */
  topology?: MeshyTopology
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

/** Fills the defaults. `needKey: false` (the pre-signed asset download) never reads the environment and yields an empty key. */
function resolveDeps(deps: Partial<MeshyDeps>, needKey = true): MeshyDeps {
  return {
    fetch: deps.fetch ?? globalThis.fetch,
    key: deps.key ?? (needKey ? requireMeshyKey() : ''),
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

/** The same error (status kept, message already redacted) with an extra sentence. */
function withNote(e: MeshyError, note: string): MeshyError {
  return new MeshyError(e.status, `${e.message}. ${note}`)
}

/** Decoded byte length of a base64 payload, computed from its length (nothing is decoded or allocated). */
function base64Bytes(payload: string): number {
  const pad = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
  return Math.floor((payload.length * 3) / 4) - pad
}

/** Pre-flight checks: anything Meshy would answer with a 400 is refused here, before a request is made. */
function validateCreateInput(images: string[], opts: MeshyOpts, key: string): void {
  const reject = (msg: string): never => {
    throw new MeshyError(0, redact(msg, key))
  }
  if (images.length < 1 || images.length > MAX_IMAGES) {
    reject(`Meshy multi-image-to-3d takes 1 to ${MAX_IMAGES} images, got ${images.length}`)
  }
  const poly = opts.targetPolycount
  if (!Number.isInteger(poly) || poly < MIN_POLYCOUNT || poly > MAX_POLYCOUNT) {
    reject(`Meshy targetPolycount must be an integer from ${MIN_POLYCOUNT} to ${MAX_POLYCOUNT}, got ${String(poly)}`)
  }
  if (opts.topology !== undefined && opts.topology !== 'triangle' && opts.topology !== 'quad') {
    reject(`Meshy topology must be 'triangle' or 'quad', got ${String(opts.topology)}`)
  }
  images.forEach((img, i) => {
    if (typeof img !== 'string') reject(`Meshy image ${i} is not a string`)
    if (img.startsWith('https://')) return
    const m = DATA_URI.exec(img)
    if (!m) reject(`Meshy image ${i} must be an https URL or a data:image/(png|jpeg|webp);base64, URI`)
    const bytes = base64Bytes(img.slice(m ? m[0].length : 0))
    if (bytes > MAX_IMAGE_BYTES) reject(`Meshy image ${i} is ${bytes} bytes decoded, over the 20 MB limit`)
  })
}

/** Starts a multi-image-to-3D task from 1-4 image data URIs and returns its id. Spends credits: called once, never retried. */
export async function createMultiImageTask(
  images: string[],
  opts: MeshyOpts,
  deps: Partial<MeshyDeps> = {},
): Promise<string> {
  validateCreateInput(images, opts, deps.key ?? '')
  const d = resolveDeps(deps)
  const body = {
    image_urls: images,
    ai_model: MESHY_MODEL,
    geometry_resolution: 'standard',
    should_texture: true,
    enable_pbr: true,
    texture_resolution: '2k',
    should_remesh: true,
    topology: opts.topology ?? 'triangle',
    target_polycount: opts.targetPolycount,
    target_formats: ['glb'],
    auto_size: false,
  }
  // A dropped connection or a 5xx can happen after Meshy accepted (and charged) the task: say so, never retry.
  let res: Response
  try {
    res = await send(BASE_URL + TASK_PATH, { method: 'POST', headers: authHeaders(d), body: JSON.stringify(body) }, d)
  } catch (e) {
    throw e instanceof MeshyError ? withNote(e, MAY_EXIST) : e
  }
  if (!res.ok) {
    const err = await failure(res, d.key)
    throw res.status >= 500 ? withNote(err, MAY_EXIST) : err
  }
  const parsed = (await res.json().catch(() => null)) as { result?: unknown } | null
  if (!parsed || typeof parsed.result !== 'string' || !parsed.result) {
    throw new MeshyError(res.status, `Meshy create response had no task id (result). ${MAY_EXIST}`)
  }
  return parsed.result
}

/** One GET of the task. Every failure (HTTP, network, unreadable body) names the id and says the task may still be running. */
async function pollOnce(id: string, d: MeshyDeps): Promise<MeshyTask> {
  const note = `Task ${id} may still be running on Meshy: check the dashboard, or poll it again with this id`
  try {
    const res = await send(`${BASE_URL}${TASK_PATH}/${encodeURIComponent(id)}`, { method: 'GET', headers: authHeaders(d) }, d)
    if (!res.ok) throw await failure(res, d.key)
    const body = (await res.json().catch(() => null)) as MeshyTask | null
    if (!body || typeof body !== 'object' || typeof body.status !== 'string') {
      throw new MeshyError(res.status, 'Meshy task response was not valid JSON for a task')
    }
    return body
  } catch (e) {
    throw withNote(e instanceof MeshyError ? e : new MeshyError(0, redact(String(e), d.key)), note)
  }
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
    const task = await pollOnce(id, d)
    if (TERMINAL.has(task.status)) {
      if (task.status === 'SUCCEEDED') return task
      const why = task.task_error?.message ? `: ${task.task_error.message}` : ''
      throw new MeshyError(0, redact(`Meshy task ${id} ${task.status}${why}`, d.key))
    }
    if (d.now() - start >= timeoutMs) {
      throw new MeshyError(
        0,
        `Meshy task ${id} timed out after ${timeoutMs} ms (last status ${task.status}, ${task.progress}%); it may still be running on Meshy`,
      )
    }
    await d.sleep(pollMs)
  }
}

/** Downloads the finished GLB. Refuses a task without a glb url or whose files Meshy already expired. */
export async function downloadGlb(task: MeshyTask, deps: Partial<MeshyDeps> = {}): Promise<Uint8Array> {
  const url = task.model_urls?.glb
  if (!url) throw new MeshyError(0, `Meshy task ${task.id} has no model_urls.glb to download`)
  const d = resolveDeps(deps, false) // no API key needed: the url is pre-signed
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
