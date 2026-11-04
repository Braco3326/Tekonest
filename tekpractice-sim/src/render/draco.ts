/**
 * Same-origin Draco decoder (Task 43d, audit CA-24).
 *
 * 26 of the 53 shipped .glb models are Draco-compressed (KHR_draco_mesh_compression). Babylon's glTF loader decodes them with a WebAssembly decoder that it
 * fetches, by default, from https://cdn.babylonjs.com/: a third party, blocked by some school filters, absent offline, and told every visitor's IP address.
 * The decoder is vendored under public/draco/ (draco3dgltf 1.5.7, Apache-2.0, see ASSET_LOG.md) and this points Babylon to it, under the Vite base path
 * (the deploy is served from /tekpractice/jouer/).
 *
 * The two files are one build: the Emscripten wrapper (`draco_decoder_gltf_nodejs.js`, an all-environments build despite its name: it only touches `fs` when it
 * finds Node) and the matching `draco_decoder_gltf.wasm`. No fallback script is configured on purpose: the only fallback Babylon knows is a CDN one, and a
 * browser without WebAssembly cannot run this app's 3D anyway (the .glb fails to load and the placeholder box stays, DeviceSpawner).
 *
 * Called by the two entries that load .glb files, before any model: Mode Création's boot and the legacy entry (src/legacyMain.ts). The setting is a static of
 * Babylon, shared by both, and idempotent.
 */
import { DracoCompression } from '@babylonjs/core'
import { assetUrl } from '../assetUrl'

/** Under public/, so under the Vite base path. */
export const DRACO_WASM_WRAPPER = 'draco/draco_decoder_gltf_nodejs.js'
export const DRACO_WASM_BINARY = 'draco/draco_decoder_gltf.wasm'

/** The decoder configuration Babylon takes: same-origin URLs only. */
export function dracoDecoderConfig(base: string = import.meta.env.BASE_URL): { wasmUrl: string; wasmBinaryUrl: string } {
  return { wasmUrl: assetUrl(DRACO_WASM_WRAPPER, base), wasmBinaryUrl: assetUrl(DRACO_WASM_BINARY, base) }
}

/** Point Babylon's glTF loader to the vendored decoder instead of cdn.babylonjs.com. */
export function useSameOriginDraco(): void {
  DracoCompression.Configuration = { decoder: dracoDecoderConfig() }
}
