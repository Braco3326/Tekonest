import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { DracoCompression } from '@babylonjs/core'
import { afterEach, describe, expect, it } from 'vitest'
import { DRACO_WASM_BINARY, DRACO_WASM_WRAPPER, dracoDecoderConfig, useSameOriginDraco } from '../../src/render/draco'

/**
 * Task 43d C (CA-24): Babylon's glTF loader decodes the Draco-compressed .glb models with a decoder it fetches from https://cdn.babylonjs.com/ by default.
 * The decoder is vendored under public/draco/ (Apache-2.0, see ASSET_LOG.md) and the configuration points to it with the Vite base path.
 */
const publicDir = join(__dirname, '..', '..', 'public')

describe('dracoDecoderConfig', () => {
  it('points to same-origin files under the Vite base path (root and the /tekpractice/jouer/ deploy)', () => {
    expect(dracoDecoderConfig('/')).toEqual({ wasmUrl: '/draco/draco_decoder_gltf_nodejs.js', wasmBinaryUrl: '/draco/draco_decoder_gltf.wasm' })
    expect(dracoDecoderConfig('/tekpractice/jouer/')).toEqual({
      wasmUrl: '/tekpractice/jouer/draco/draco_decoder_gltf_nodejs.js',
      wasmBinaryUrl: '/tekpractice/jouer/draco/draco_decoder_gltf.wasm',
    })
    expect(dracoDecoderConfig('/x')).toEqual({ wasmUrl: '/x/draco/draco_decoder_gltf_nodejs.js', wasmBinaryUrl: '/x/draco/draco_decoder_gltf.wasm' })
  })
  it('names no third party and no fallback script (a fallback would be a third-party fetch again)', () => {
    const c = dracoDecoderConfig('/') as Record<string, unknown>
    expect(Object.keys(c).sort()).toEqual(['wasmBinaryUrl', 'wasmUrl'])
    expect(JSON.stringify(c)).not.toMatch(/https?:|cdn\./)
  })
})

describe('useSameOriginDraco', () => {
  const before = DracoCompression.Configuration
  afterEach(() => {
    DracoCompression.Configuration = before
  })
  it("replaces Babylon's default (CDN) decoder configuration", () => {
    expect(JSON.stringify(DracoCompression.Configuration)).toContain('cdn.babylonjs.com') // the default this task removes
    useSameOriginDraco()
    expect(DracoCompression.Configuration.decoder).toEqual(dracoDecoderConfig())
    expect(JSON.stringify(DracoCompression.Configuration)).not.toMatch(/https?:|cdn\./)
    expect(DracoCompression.DecoderAvailable).toBe(true) // wasm url + binary url, and WebAssembly exists in Node
  })
})

describe('the vendored decoder files', () => {
  const wasm = join(publicDir, DRACO_WASM_BINARY)
  const wrapper = join(publicDir, DRACO_WASM_WRAPPER)
  it('exist, are a WebAssembly binary and the Emscripten decoder wrapper, and stay well under the 25 MiB deploy limit', () => {
    expect(existsSync(wasm), wasm).toBe(true)
    expect(existsSync(wrapper), wrapper).toBe(true)
    expect([...readFileSync(wasm).subarray(0, 4)]).toEqual([0x00, 0x61, 0x73, 0x6d]) // "\0asm"
    expect(readFileSync(wrapper, 'utf8')).toContain('DracoDecoderModule')
    expect(statSync(wasm).size).toBeLessThan(25 * 1024 * 1024)
    expect(statSync(wrapper).size).toBeLessThan(25 * 1024 * 1024)
  })
  it('are the byte-identical pair that ships in draco3dgltf 1.5.7 (the wrapper and the binary must come from one build)', () => {
    const pkg = join(__dirname, '..', '..', 'node_modules', 'draco3dgltf')
    expect(JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')).version).toBe('1.5.7')
    expect(readFileSync(wasm).equals(readFileSync(join(pkg, 'draco_decoder_gltf.wasm')))).toBe(true)
    expect(readFileSync(wrapper).equals(readFileSync(join(pkg, 'draco_decoder_gltf_nodejs.js')))).toBe(true)
  })
  it('carry the Apache-2.0 licence text next to them (redistribution condition)', () => {
    const lic = readFileSync(join(publicDir, 'draco', 'LICENSE-Apache-2.0.txt'), 'utf8')
    expect(lic).toContain('Apache License')
    expect(lic).toContain('Version 2.0, January 2004')
  })
})

describe('public/draco/NOTICE.txt', () => {
  const notice = readFileSync(join(publicDir, 'draco', 'NOTICE.txt'), 'utf8')
  const sha = (f: string): string => createHash('sha256').update(readFileSync(join(publicDir, f))).digest('hex')
  it('names the source, the version and the licence', () => {
    expect(notice).toContain('draco3dgltf 1.5.7')
    expect(notice).toContain('https://github.com/google/draco')
    expect(notice).toContain('Apache License, Version 2.0')
  })
  it('carries the real SHA-256 and size of each vendored file (a swapped file makes this red)', () => {
    for (const f of [DRACO_WASM_BINARY, DRACO_WASM_WRAPPER]) {
      expect(notice, f).toContain(sha(f))
      expect(notice, f).toContain(`${statSync(join(publicDir, f)).size} bytes`)
    }
  })
  it('says why the wrapper is called nodejs and that it is not the CDN wrapper', () => {
    expect(notice).toMatch(/nodejs/)
    expect(notice).toMatch(/NOT the "draco_wasm_wrapper_gltf.js"/)
    expect(notice).toMatch(/may differ/)
  })
})

describe('ASSET_LOG.md', () => {
  it('gives the real sizes: 251 049 bytes of decoder files, and the licence as the LF blob that is committed (9 142), not the CRLF working copy', () => {
    const log = readFileSync(join(__dirname, '..', '..', 'ASSET_LOG.md'), 'utf8')
    expect(statSync(join(publicDir, DRACO_WASM_BINARY)).size + statSync(join(publicDir, DRACO_WASM_WRAPPER)).size).toBe(251_049)
    expect(log).toContain('251 049 octets')
    expect(log).toContain('9 142')
    expect(log).not.toContain('251 Kio')
    expect(log).not.toContain('9 197')
  })
  it('scopes the CA-24 claim to the sessions that were exercised', () => {
    const log = readFileSync(join(__dirname, '..', '..', 'ASSET_LOG.md'), 'utf8')
    expect(log).toMatch(/aucune requête (d'exécution )?hors origine dans les sessions exercées/)
    expect(log).toMatch(/Chromium seulement/)
  })
  it('records the vendored Draco decoder: files, version, licence and source', () => {
    const log = readFileSync(join(__dirname, '..', '..', 'ASSET_LOG.md'), 'utf8')
    expect(log).toMatch(/draco_decoder_gltf\.wasm/)
    expect(log).toMatch(/draco_decoder_gltf_nodejs\.js/)
    expect(log).toMatch(/1\.5\.7/)
    expect(log).toMatch(/Apache-2\.0/)
  })
})
