import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { SongEntry, loadSongs, MAX_SONG_BYTES } from '../../src/audio/songs'
import { validateSongs, validateSongsAt } from '../../tools/songsCheck'

const projectRoot = resolve(__dirname, '..', '..')
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')

const tmpDirs: string[] = []
afterAll(() => tmpDirs.forEach((d) => rmSync(d, { recursive: true, force: true })))
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'tekpractice-songs-'))
  tmpDirs.push(d)
  return d
}

// Synthetic fixtures: a fake songs list over temp files (no real audio, no real track).
const LICENCE_URL = 'https://example.invalid/licence/cc0'
const FILE = 'audio/songs/synthetic-a.mp3'
const content = new Uint8Array(Buffer.from('synthetic bytes, not audio'))

const entryFor = (bytes: Uint8Array, over: Record<string, unknown> = {}) => ({
  id: 'synthetic-a',
  title: 'Synthetic A',
  author: 'Test Author',
  file: FILE,
  bytes: bytes.length,
  licence: 'CC0-1.0',
  licenceUrl: LICENCE_URL,
  sourceUrl: 'https://example.invalid/track/a',
  retrieved: '2026-01-02',
  sha256: sha(bytes),
  ...over,
})
const goodLog = `| Synthetic A | ${FILE} | ${LICENCE_URL} |\n`

const depsFor = (files: Record<string, Uint8Array>, assetLog = goodLog) => ({
  read: (f: string) => files[f] as Uint8Array,
  exists: (f: string) => f in files,
  assetLog,
})

describe('SongEntry schema', () => {
  it('accepts a well-formed entry', () => {
    expect(SongEntry.safeParse(entryFor(content)).success).toBe(true)
  })
  it.each([
    ['a licence other than CC0-1.0', { licence: 'CC-BY-4.0' }],
    ['bytes above 3 MB', { bytes: MAX_SONG_BYTES + 1 }],
    ['a non-URL licenceUrl', { licenceUrl: 'not a url' }],
    ['a short sha256', { sha256: 'abc' }],
    ['an upper-case sha256', { sha256: 'A'.repeat(64) }],
    ['a path outside audio/songs', { file: '../secret.mp3' }],
    ['a non-mp3/ogg extension', { file: 'audio/songs/x.wav' }],
    ['a malformed retrieved date', { retrieved: 'yesterday' }],
  ])('rejects %s', (_label, over) => {
    expect(SongEntry.safeParse(entryFor(content, over)).success).toBe(false)
  })
})

describe('validateSongs (synthetic entries)', () => {
  it('passes a good entry', () => {
    expect(validateSongs([entryFor(content)], depsFor({ [FILE]: content }))).toEqual([])
  })
  it('passes the empty list', () => {
    expect(validateSongs([], depsFor({}))).toEqual([])
  })
  it('fails a missing file', () => {
    const errs = validateSongs([entryFor(content)], depsFor({}))
    expect(errs.join('\n')).toMatch(/synthetic-a.*file does not exist/)
  })
  it('fails a wrong size', () => {
    const errs = validateSongs([entryFor(content, { bytes: content.length + 1 })], depsFor({ [FILE]: content }))
    expect(errs.join('\n')).toMatch(/synthetic-a.*size/)
  })
  it('fails a wrong hash', () => {
    const errs = validateSongs([entryFor(content, { sha256: 'f'.repeat(64) })], depsFor({ [FILE]: content }))
    expect(errs.join('\n')).toMatch(/synthetic-a.*sha256/)
  })
  it('fails a file above 3 MB even when bytes is declared honestly', () => {
    const big = new Uint8Array(MAX_SONG_BYTES + 1)
    const errs = validateSongs([entryFor(big)], depsFor({ [FILE]: big }))
    expect(errs.join('\n')).toMatch(/synthetic-a/)
    expect(errs.length).toBeGreaterThan(0)
  })
  it('fails a file above 3 MB when bytes understates it (real size is checked too)', () => {
    const big = new Uint8Array(MAX_SONG_BYTES + 1)
    const errs = validateSongs([entryFor(big, { bytes: 10 })], depsFor({ [FILE]: big }))
    expect(errs.join('\n')).toMatch(/3 MB/)
  })
  it('passes a file of exactly 3 MB', () => {
    const edge = new Uint8Array(MAX_SONG_BYTES)
    expect(validateSongs([entryFor(edge)], depsFor({ [FILE]: edge }))).toEqual([])
  })
  it('fails when ASSET_LOG has no line for the entry', () => {
    const errs = validateSongs([entryFor(content)], depsFor({ [FILE]: content }, '# empty log\n'))
    expect(errs.join('\n')).toMatch(/synthetic-a.*ASSET_LOG/)
  })
  it('fails when the ASSET_LOG line carries the file but not the licenceUrl', () => {
    const errs = validateSongs([entryFor(content)], depsFor({ [FILE]: content }, `| x | ${FILE} | nothing |\n`))
    expect(errs.join('\n')).toMatch(/ASSET_LOG/)
  })
  it('fails when the licenceUrl sits on a different line than the file', () => {
    const log = `${FILE}\n${LICENCE_URL}\n`
    const errs = validateSongs([entryFor(content)], depsFor({ [FILE]: content }, log))
    expect(errs.join('\n')).toMatch(/ASSET_LOG/)
  })
  it('fails a wrong licence (schema error carries the id)', () => {
    const errs = validateSongs([entryFor(content, { licence: 'CC-BY-4.0' })], depsFor({ [FILE]: content }, goodLog))
    expect(errs.join('\n')).toMatch(/synthetic-a.*licence/)
  })
  it('fails duplicate ids', () => {
    const errs = validateSongs([entryFor(content), entryFor(content)], depsFor({ [FILE]: content }))
    expect(errs.join('\n')).toMatch(/duplicate id/)
  })
  it('fails more than 3 entries', () => {
    const list = ['a', 'b', 'c', 'd'].map((n) => entryFor(content, { id: n, file: `audio/songs/${n}.mp3` }))
    const files = Object.fromEntries(list.map((e) => [e.file, content]))
    const log = list.map((e) => `${e.file} ${LICENCE_URL}`).join('\n')
    expect(validateSongs(list, depsFor(files, log)).join('\n')).toMatch(/at most 3/)
  })
  it('fails a songs file that is not an array', () => {
    expect(validateSongs({ not: 'an array' }, depsFor({})).join('\n')).toMatch(/array/)
  })
  it('reports every bad entry, not just the first', () => {
    const second = entryFor(content, { id: 'synthetic-b', file: 'audio/songs/synthetic-b.mp3' })
    const errs = validateSongs([entryFor(content), second], depsFor({}))
    expect(errs.filter((e) => /does not exist/.test(e))).toHaveLength(2)
  })
})

describe('validateSongsAt (real fs over a temp root)', () => {
  const makeRoot = (opts: { songs: unknown; files?: Record<string, Uint8Array>; log?: string }) => {
    const root = tmp()
    mkdirSync(join(root, 'content'), { recursive: true })
    writeFileSync(join(root, 'content', 'songs.json'), JSON.stringify(opts.songs))
    writeFileSync(join(root, 'ASSET_LOG.md'), opts.log ?? goodLog)
    for (const [f, bytes] of Object.entries(opts.files ?? {})) {
      mkdirSync(dirname(join(root, 'public', f)), { recursive: true })
      writeFileSync(join(root, 'public', f), bytes)
    }
    return root
  }

  it('passes a good entry on disk', () => {
    const root = makeRoot({ songs: [entryFor(content)], files: { [FILE]: content } })
    expect(validateSongsAt(root)).toEqual([])
  })
  it('fails a missing file on disk', () => {
    expect(validateSongsAt(makeRoot({ songs: [entryFor(content)] })).join('\n')).toMatch(/does not exist/)
  })
  it('fails a corrupted file on disk (hash)', () => {
    const corrupted = new Uint8Array(Buffer.from('synthetic bytes, not audi!'))
    const root = makeRoot({ songs: [entryFor(content)], files: { [FILE]: corrupted } })
    expect(validateSongsAt(root).join('\n')).toMatch(/sha256/)
  })
  it('fails a songs.json that is not valid JSON', () => {
    const root = tmp()
    mkdirSync(join(root, 'content'))
    writeFileSync(join(root, 'content', 'songs.json'), '{ nope')
    writeFileSync(join(root, 'ASSET_LOG.md'), '')
    expect(validateSongsAt(root).join('\n')).toMatch(/songs\.json/)
  })
})

describe('tools/validate-songs.ts (CLI)', () => {
  const tsx = join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const run = (root?: string) =>
    spawnSync(process.execPath, [tsx, join(projectRoot, 'tools', 'validate-songs.ts'), ...(root ? ['--root', root] : [])], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

  it('exits 0 on the shipped repo', () => {
    const r = run()
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/songs/)
  })
  it('exits 1 and prints the error on a bad root', () => {
    const root = tmp()
    mkdirSync(join(root, 'content'))
    writeFileSync(join(root, 'content', 'songs.json'), JSON.stringify([entryFor(content)]))
    writeFileSync(join(root, 'ASSET_LOG.md'), goodLog)
    const r = run(root)
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/synthetic-a.*does not exist/)
  })
})

describe('shipped songs list', () => {
  it('validates against the real repo (files, size, hash, ASSET_LOG)', () => {
    expect(validateSongsAt(projectRoot)).toEqual([])
  })
  it('loadSongs() returns the parsed content/songs.json', async () => {
    const raw = JSON.parse(readFileSync(join(projectRoot, 'content', 'songs.json'), 'utf8')) as unknown[]
    const songs = await loadSongs()
    expect(songs).toHaveLength(raw.length)
    expect(songs.length).toBeLessThanOrEqual(3)
  })
  it('ships the audio directory if and only if the list is not empty', async () => {
    const songs = await loadSongs()
    expect(existsSync(join(projectRoot, 'public', 'audio', 'songs'))).toBe(songs.length > 0)
  })
  it('ASSET_LOG records the demo-songs decision and the Pixabay rule', () => {
    const log = readFileSync(join(projectRoot, 'ASSET_LOG.md'), 'utf8')
    expect(log).toMatch(/Chansons de démonstration/)
    expect(log).toMatch(/Pixabay[^\n]*n'est pas CC0/)
  })
})
